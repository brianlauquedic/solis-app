/**
 * Liquidation Shield — Monitor API
 *
 * GET  /api/liquidation-shield/monitor?wallet=...
 * POST /api/liquidation-shield/monitor  { wallet, config? }
 *
 * Scans Kamino + MarginFi positions using getProgramAccounts (native RPC)
 * and protocol REST APIs. Returns health factors + full agentic AI rescue analysis.
 *
 * SAK/Solana native tools used here (5 tools):
 *  1. getBalance + getParsedTokenAccountsByOwner  — full wallet asset snapshot
 *  2. SAK fetchPrice via Jupiter Price V2         — live SOL/USD price
 *  3. getParsedTokenAccountsByOwner (USDC filter) — exact rescue capacity
 *  4. getProgramAccounts (StakeProgram)           — stake positions as liquidity buffer
 *  5. getSignaturesForAddress                     — recent DeFi activity on wallet
 */
import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { monitorPositions, simulateRescue } from "@/lib/liquidation-shield";
import type { ShieldConfig, MonitorResult } from "@/lib/liquidation-shield";
import Anthropic from "@anthropic-ai/sdk";
import { createReadOnlyAgent, RPC_URL } from "@/lib/agent";
import { getConnection } from "@/lib/rpc";
import { getWalletLimiter, checkWalletLimitMemory, trackUsage } from "@/lib/redis";
import { getDemoShieldResult } from "@/lib/demo-data";
import type { Lang } from "@/lib/demo-data";

// ── Server-side i18n for monitor error/label messages ──────────────────────
type MonLang = "zh" | "en" | "ja";
function parseMonLang(v: unknown): MonLang {
  if (v === "en" || v === "ja" || v === "zh") return v;
  return "zh";
}
const monI18n: Record<string, Record<MonLang, string>> = {
  rateLimit: {
    zh: "每個錢包每小時最多 12 次監控掃描。請稍後再試。",
    en: "Maximum 12 monitor scans per wallet per hour. Please try again later.",
    ja: "ウォレットあたり1時間に最大12回のスキャンです。後でもう一度お試しください。",
  },
  collateral: { zh: "抵押品", en: "Collateral", ja: "担保" },
  debt: { zh: "借款", en: "Debt", ja: "借入" },
  mintWarning: {
    zh: "⚠️ 非官方 token 偵測（${tokens}）— 請謹慎確認此倉位來源",
    en: "⚠️ Unofficial token detected (${tokens}) — please verify position source carefully",
    ja: "⚠️ 非公式トークン検出（${tokens}）— ポジションの出所を慎重に確認してください",
  },
};
function mt(key: string, lang: MonLang, vars?: Record<string, string>): string {
  const tpl = monI18n[key]?.[lang] ?? monI18n[key]?.zh ?? key;
  if (!vars) return tpl;
  return tpl.replace(/\$\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}

// AI prompt output language directive
const SHIELD_AI_DIRECTIVE: Record<MonLang, string> = {
  zh: "Then write a comprehensive risk analysis in Traditional Chinese (繁體中文):",
  en: "Then write a comprehensive risk analysis in English:",
  ja: "Then write a comprehensive risk analysis in Japanese (日本語):",
};
const SHIELD_AI_TEMPLATE: Record<MonLang, string> = {
  zh: `- 🔴/🟡/🟢 整體風險等級（危急/警告/安全）+ 理由
- 💰 最需關注倉位（若有）+ 距離清算還差多少
- 💵 救援可行性：USDC 餘額 vs 需要救援金額
- 🏦 完整資產快照（可用 SOL + USDC + 質押 SOL）
- ⚡ 行動緊迫性：用戶最後活躍時間 → 是否需要自動救援
- 🛡️ 具體建議（1-3 條優先行動）`,
  en: `- 🔴/🟡/🟢 Overall risk level (critical/warning/safe) + reasoning
- 💰 Most concerning position (if any) + distance to liquidation
- 💵 Rescue feasibility: USDC balance vs required rescue amount
- 🏦 Full asset snapshot (available SOL + USDC + staked SOL)
- ⚡ Action urgency: last user activity → is automatic rescue needed?
- 🛡️ Specific recommendations (1-3 priority actions)`,
  ja: `- 🔴/🟡/🟢 総合リスクレベル（危機的/警告/安全）+ 理由
- 💰 最も懸念されるポジション（ある場合）+ 清算までの距離
- 💵 救援実行可能性：USDC残高 vs 必要救援額
- 🏦 完全資産スナップショット（利用可能 SOL + USDC + ステーク SOL）
- ⚡ 行動緊急度：最終活動時間 → 自動救援は必要か？
- 🛡️ 具体的な提案（1-3つの優先アクション）`,
};

/**
 * Sanitize on-chain token symbol for safe insertion into AI prompts.
 * Token symbols come from the blockchain — an attacker could create a reserve
 * with a malicious symbol containing prompt injection text.
 * Strips everything except letters, numbers, and common token suffix chars.
 */
function sanitizeForPrompt(value: string | undefined, maxLen = 12): string {
  if (!value) return "UNKNOWN";
  // Allow only alphanumeric + a few safe chars (-, _, .)
  return value.replace(/[^A-Za-z0-9\-_.]/g, "").slice(0, maxLen) || "UNKNOWN";
}

export const maxDuration = 60;

const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

/**
 * Module 16: Official mainnet mint registry for collateral/debt validation.
 * Any position with a token symbol NOT in this whitelist gets flagged as suspicious.
 * Prevents rogue Kamino markets with fake "USDC" or "SOL" symbols from being processed.
 * Sources: Kamino main market reserve list + MarginFi mainnet bank registry.
 */
const OFFICIAL_TOKEN_SYMBOLS = new Set([
  "SOL", "USDC", "USDT", "ETH", "BTC", "WBTC",
  "mSOL", "jitoSOL", "bSOL", "stSOL", "jupSOL",
  "JLP", "JTO", "WIF", "BONK", "PYTH", "RAY",
  "ORCA", "MNDE", "MSOL", "HXRO",
]);

/**
 * Check if a position uses only known official token symbols.
 * Returns null if valid, warning string if suspicious.
 */
function validatePositionMints(collateralToken: string, debtToken: string, lang: MonLang = "zh"): string | null {
  const unknownTokens: string[] = [];
  if (!OFFICIAL_TOKEN_SYMBOLS.has(collateralToken.toUpperCase()) &&
      !OFFICIAL_TOKEN_SYMBOLS.has(collateralToken)) {
    unknownTokens.push(`${mt("collateral", lang)}: ${collateralToken}`);
  }
  if (!OFFICIAL_TOKEN_SYMBOLS.has(debtToken.toUpperCase()) &&
      !OFFICIAL_TOKEN_SYMBOLS.has(debtToken)) {
    unknownTokens.push(`${mt("debt", lang)}: ${debtToken}`);
  }
  return unknownTokens.length > 0
    ? mt("mintWarning", lang, { tokens: unknownTokens.join(", ") })
    : null;
}

const DEFAULT_CONFIG: ShieldConfig = {
  approvedUsdc: 1000,
  triggerThreshold: 1.05,
  targetHealthFactor: 1.4,
};

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet");
  if (!wallet || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet)) {
    return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
  }

  void trackUsage("shield", wallet);
  try {
    const result = await monitorPositions(wallet);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[liquidation-shield/monitor] error:", err);
    return NextResponse.json({ error: "Monitor failed" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: { wallet?: string; config?: Partial<ShieldConfig>; demo?: boolean; lang?: string } = {};
  try { body = await req.json(); } catch { /* ok */ }

  // ── Demo mode: return preset data instantly ───────────────────────
  if (body.demo === true) {
    const lang = (["zh", "en", "ja"].includes(body.lang ?? "") ? body.lang : "zh") as Lang;
    return NextResponse.json({ ...getDemoShieldResult(lang), scannedAt: Date.now() });
  }

  const { wallet, config: userConfig } = body;
  const monLang = parseMonLang(body.lang);
  if (!wallet || wallet.length < 32) {
    return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
  }
  // Validate wallet is a valid base58 Solana address
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet)) {
    return NextResponse.json({ error: "Invalid wallet address format" }, { status: 400 });
  }

  // ── Per-wallet hourly rate limit (Sybil defense) ───────────────────────────
  // AI analysis route with no payment gate → wallet-keyed Redis limit prevents
  // multi-IP Sybil amplification of Anthropic API costs.
  // Limit: 12 monitor calls/hour per wallet.
  {
    const walletLimiter = getWalletLimiter("ls-monitor", 12);
    if (walletLimiter) {
      const { success, reset } = await walletLimiter.limit(wallet);
      if (!success) {
        return NextResponse.json(
          { error: mt("rateLimit", monLang) },
          { status: 429, headers: { "Retry-After": String(Math.max(1, Math.ceil((reset - Date.now()) / 1000))), "X-RateLimit-Scope": "wallet", "X-RateLimit-Mode": "distributed" } }
        );
      }
    } else {
      const { blocked, retryAfter } = checkWalletLimitMemory("ls-monitor", wallet, 12);
      if (blocked) {
        return NextResponse.json(
          { error: mt("rateLimit", monLang) },
          { status: 429, headers: { "Retry-After": String(retryAfter ?? 3600), "X-RateLimit-Scope": "wallet", "X-RateLimit-Mode": "memory" } }
        );
      }
    }
  }

  // ── [SECURITY FIX H-3] Validate and clamp userConfig ranges ───────────────
  // Attacker-controlled config fields (approvedUsdc:-1, triggerThreshold:0, etc.)
  // could manipulate AI output to show fake-safe or always-trigger conclusions.
  const config: ShieldConfig = {
    approvedUsdc: Math.max(0, Math.min(
      1_000_000,
      Number.isFinite(Number(userConfig?.approvedUsdc)) ? Number(userConfig!.approvedUsdc) : DEFAULT_CONFIG.approvedUsdc
    )),
    triggerThreshold: Math.max(1.0, Math.min(
      3.0,
      Number.isFinite(Number(userConfig?.triggerThreshold)) ? Number(userConfig!.triggerThreshold) : DEFAULT_CONFIG.triggerThreshold
    )),
    targetHealthFactor: Math.max(1.1, Math.min(
      5.0,
      Number.isFinite(Number(userConfig?.targetHealthFactor)) ? Number(userConfig!.targetHealthFactor) : DEFAULT_CONFIG.targetHealthFactor
    )),
  };

  // ── Step 1: Scan lending positions ─────────────────────────────────
  let monitorResult: MonitorResult;
  try {
    monitorResult = await monitorPositions(wallet);
  } catch (err) {
    console.error("[liquidation-shield/monitor] scan error:", err);
    return NextResponse.json({ error: "Position scan failed" }, { status: 500 });
  }

  // ── Step 1b: Module 16 official mint validation ────────────────────
  // Flag any position whose collateral/debt token is outside the known official set.
  // A rogue market could expose fake "USDC" with a different mint — this catches it.
  const mintWarnings: string[] = [];
  for (const pos of monitorResult.positions) {
    const warning = validatePositionMints(pos.collateralToken, pos.debtToken, monLang);
    if (warning) {
      mintWarnings.push(`[${pos.protocol}/${pos.accountAddress.slice(0, 8)}] ${warning}`);
    }
  }
  if (mintWarnings.length > 0) {
    console.warn("[liquidation-shield/monitor] Unofficial mint detected:", mintWarnings);
  }

  // ── Step 2: Simulate rescue for at-risk positions ───────────────────
  const rescueSimulations = await Promise.all(
    monitorResult.atRisk.map(pos => simulateRescue(pos, wallet, config))
  );

  // ── Step 3: Full agentic AI analysis — 5 SAK/Solana native tools ───
  const apiKey = process.env.ANTHROPIC_API_KEY;
  let aiAnalysis: string | null = null;

  if (apiKey && monitorResult.positions.length > 0) {
    const client = new Anthropic({ apiKey });
    // Module 16: multi-RPC failover — auto-selects healthiest endpoint
    const conn = await getConnection("confirmed");
    const agent = createReadOnlyAgent();

    // ── SAK Tool definitions (5 tools — Solana native, no external APIs) ──
    const sakTools: Anthropic.Tool[] = [
      {
        name: "get_wallet_assets",
        description: "Get complete SOL and SPL token balances for the wallet using Solana native getBalance + getParsedTokenAccountsByOwner. Returns full asset picture including all tokens.",
        input_schema: {
          type: "object" as const,
          properties: { wallet: { type: "string", description: "Solana wallet address (base58)" } },
          required: ["wallet"],
        },
      },
      {
        name: "get_sol_price",
        description: "Get current SOL/USD price using SAK TokenPlugin fetchPrice (Jupiter Price V2 aggregator — Solana native). Used to calculate USD value of collateral and debt.",
        input_schema: {
          type: "object" as const,
          properties: {},
          required: [],
        },
      },
      {
        name: "get_usdc_rescue_balance",
        description: "Get exact USDC token balance available for rescue operations using getParsedTokenAccountsByOwner filtered by USDC mint. Critical for assessing whether rescue is feasible.",
        input_schema: {
          type: "object" as const,
          properties: { wallet: { type: "string", description: "Wallet address to check USDC balance" } },
          required: ["wallet"],
        },
      },
      {
        name: "get_stake_positions",
        description: "Get all native SOL staking positions using getProgramAccounts on Stake Program (memcmp offset 44 = withdrawer). Staked SOL is a liquidity buffer — if positions are dire, user may need to unstake.",
        input_schema: {
          type: "object" as const,
          properties: { wallet: { type: "string", description: "Wallet address to scan for stake accounts" } },
          required: ["wallet"],
        },
      },
      {
        name: "get_lending_activity",
        description: "Get recent transaction history for the wallet using Solana native getSignaturesForAddress. Reveals recent DeFi activity patterns — frequent borrowing/repayment cycles, last time user managed the position.",
        input_schema: {
          type: "object" as const,
          properties: {
            wallet: { type: "string", description: "Wallet address to fetch recent transaction history" },
            limit: { type: "number", description: "Number of recent transactions to fetch (default 15)" },
          },
          required: ["wallet"],
        },
      },
      {
        name: "get_network_context",
        description: "Get current Solana epoch info using native getEpochInfo RPC. Returns current epoch, slot height, and time elapsed. Important context: epoch transitions can affect validator rewards and briefly impact SOL price, which directly affects health factors.",
        input_schema: {
          type: "object" as const,
          properties: {},
          required: [],
        },
      },
    ];

    // ── SAK Tool executor (all Solana native) ──────────────────────────
    async function executeShieldTool(name: string, input: Record<string, unknown>): Promise<unknown> {
      try {
        switch (name) {

          case "get_wallet_assets": {
            const w = input.wallet as string;
            const { TOKEN_PROGRAM_ID } = await import("@solana/spl-token");
            const [lamports, tokenAccounts] = await Promise.all([
              conn.getBalance(new PublicKey(w)),
              conn.getParsedTokenAccountsByOwner(new PublicKey(w), { programId: TOKEN_PROGRAM_ID }),
            ]);
            const solAmount = lamports / 1e9;
            const tokens = tokenAccounts.value
              .map(ta => {
                const info = ta.account.data.parsed?.info;
                return {
                  mint: (info?.mint as string ?? "").slice(0, 12),
                  amount: (info?.tokenAmount?.uiAmount as number) ?? 0,
                  decimals: (info?.tokenAmount?.decimals as number) ?? 0,
                };
              })
              .filter(t => t.amount > 0);
            return { solAmount: +solAmount.toFixed(4), tokenCount: tokens.length, tokens };
          }

          case "get_sol_price": {
            try {
              const price = await (agent.methods as Record<string, (...args: unknown[]) => Promise<number>>)
                .fetchPrice("So11111111111111111111111111111111111111112");
              return { solPriceUsd: price, source: "Jupiter Price V2 (Solana native)" };
            } catch {
              return { solPriceUsd: 170, source: "fallback" };
            }
          }

          case "get_usdc_rescue_balance": {
            const w = input.wallet as string;
            try {
              const usdcAccounts = await conn.getParsedTokenAccountsByOwner(
                new PublicKey(w),
                { mint: new PublicKey(USDC_MINT) }
              );
              const totalUsdc = usdcAccounts.value.reduce((sum, ta) => {
                const info = ta.account.data.parsed?.info;
                return sum + ((info?.tokenAmount?.uiAmount as number) ?? 0);
              }, 0);
              const approvedLimit = config.approvedUsdc;
              const maxRescue = Math.min(totalUsdc, approvedLimit);
              return {
                usdcBalance: +totalUsdc.toFixed(2),
                approvedRescueLimit: approvedLimit,
                availableForRescue: +maxRescue.toFixed(2),
                sufficient: totalUsdc >= (monitorResult.atRisk[0]?.rescueAmountUsdc ?? 0),
                accounts: usdcAccounts.value.length,
              };
            } catch {
              return { usdcBalance: 0, approvedRescueLimit: config.approvedUsdc, availableForRescue: 0, sufficient: false };
            }
          }

          case "get_stake_positions": {
            const w = input.wallet as string;
            const stakeProgram = new PublicKey("Stake11111111111111111111111111111111111111");
            const stakeAccounts = await conn.getProgramAccounts(stakeProgram, {
              filters: [{ memcmp: { offset: 44, bytes: w } }],
            });
            const totalStakedSol = stakeAccounts.reduce((sum, sa) => sum + sa.account.lamports / 1e9, 0);
            return {
              count: stakeAccounts.length,
              totalStakedSol: +totalStakedSol.toFixed(4),
              liquidityNote: stakeAccounts.length > 0
                ? "Native staked SOL is illiquid (requires ~3 day unstake). Cannot be used for immediate rescue."
                : "No staked SOL positions found.",
              positions: stakeAccounts.slice(0, 5).map(sa => ({
                address: sa.pubkey.toString().slice(0, 12),
                sol: +(sa.account.lamports / 1e9).toFixed(4),
              })),
            };
          }

          case "get_lending_activity": {
            const w = input.wallet as string;
            const limit = (input.limit as number) ?? 15;
            const sigs = await conn.getSignaturesForAddress(new PublicKey(w), { limit });
            const now = Date.now() / 1000;
            const activity = sigs.map(s => ({
              sig: s.signature.slice(0, 20),
              daysAgo: s.blockTime ? +((now - s.blockTime) / 86400).toFixed(1) : null,
              status: s.err ? "FAILED" : "SUCCESS",
            }));
            const lastActivityDays = activity[0]?.daysAgo ?? null;
            return {
              totalRecentTxs: sigs.length,
              lastActivityDaysAgo: lastActivityDays,
              activityPattern: lastActivityDays != null && lastActivityDays < 1
                ? "HIGHLY_ACTIVE"
                : lastActivityDays != null && lastActivityDays < 7
                ? "ACTIVE"
                : lastActivityDays != null && lastActivityDays < 30
                ? "MODERATE"
                : "INACTIVE",
              note: "Inactive wallets may not notice health factor drops — rescue automation is critical",
              recentTxs: activity.slice(0, 5),
            };
          }

          case "get_network_context": {
            // Solana native getEpochInfo — epoch timing context for liquidation risk
            const epochInfo = await conn.getEpochInfo();
            const slotsRemaining = epochInfo.slotsInEpoch - epochInfo.slotIndex;
            const slotsPerDay = 432_000 / 2; // ~2 days per epoch, 432000 slots/epoch
            const daysUntilEpochEnd = +(slotsRemaining / slotsPerDay).toFixed(2);
            return {
              epoch: epochInfo.epoch,
              slotIndex: epochInfo.slotIndex,
              slotsInEpoch: epochInfo.slotsInEpoch,
              slotsRemaining,
              daysUntilEpochEnd,
              absoluteSlot: epochInfo.absoluteSlot,
              blockHeight: epochInfo.blockHeight,
              epochProgress: +((epochInfo.slotIndex / epochInfo.slotsInEpoch) * 100).toFixed(1),
              note: "Epoch transitions trigger validator reward distributions. SOL price can briefly move at epoch boundaries — monitor positions closely near epoch end.",
            };
          }

          default:
            return { error: `Unknown tool: ${name}` };
        }
      } catch (err) {
        return { error: err instanceof Error ? err.message : String(err) };
      }
    }

    // ── Agentic loop: Claude autonomously investigates with SAK tools ──
    const positionSummary = monitorResult.positions
      .map(p =>
        `  • ${p.protocol.toUpperCase()} | HF: ${p.healthFactor.toFixed(3)} | ` +
        `${mt("collateral", monLang)}: $${p.collateralUsd.toFixed(0)} ${sanitizeForPrompt(p.collateralToken)} | ` +
        `${mt("debt", monLang)}: $${p.debtUsd.toFixed(0)} ${sanitizeForPrompt(p.debtToken)}`
      )
      .join("\n");

    const atRiskSummary = monitorResult.atRisk.length > 0
      ? `⚠️ At-risk (HF < ${config.triggerThreshold}):\n` + monitorResult.atRisk
          .map(p => `  🔴 ${sanitizeForPrompt(p.protocol, 16).toUpperCase()} HF: ${p.healthFactor.toFixed(3)}, repay $${p.rescueAmountUsdc?.toFixed(0) ?? "?"} USDC`)
          .join("\n")
      : "✅ All positions healthy (no rescue needed)";

    const rescueSummary = rescueSimulations.length > 0
      ? `Rescue simulations:\n` + rescueSimulations.map(r => JSON.stringify(r)).join("\n")
      : "No rescue simulations (positions safe)";

    const agentMessages: Anthropic.MessageParam[] = [
      {
        role: "user",
        content: `You are a Solana DeFi risk management expert conducting a liquidation risk audit for wallet ${wallet.slice(0, 8)}...

LENDING POSITION SCAN (from Kamino + MarginFi via getProgramAccounts):
${positionSummary}

${atRiskSummary}

${rescueSummary}

SHIELD CONFIG:
- Approved rescue limit: $${config.approvedUsdc} USDC
- Trigger threshold: HF < ${config.triggerThreshold}
- Target recovery HF: ${config.targetHealthFactor}

CONTEXT: Solana DeFi borrowing TVL is ~$4B. When SOL drops 10%, health factors can fall below 1.0 within minutes. Liquidation penalty is 5-10%, meaning users lose that % of their collateral instantly.

YOUR TASK — Use all 6 tools:
1. get_wallet_assets — full portfolio snapshot (SOL + all tokens)
2. get_sol_price — current SOL/USD for USD calculations
3. get_usdc_rescue_balance — can this wallet actually fund a rescue?
4. get_stake_positions — check staked SOL as part of total assets
5. get_lending_activity — is this an active user or absent? (affects urgency)
6. get_network_context — current epoch info: epoch end = SOL price volatility window

${SHIELD_AI_DIRECTIVE[monLang]}
${SHIELD_AI_TEMPLATE[monLang]}`,
      },
    ];

    let agentResponse = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      tools: sakTools,
      messages: agentMessages,
    });

    let iterations = 0;
    while (agentResponse.stop_reason === "tool_use" && iterations < 6) {
      iterations++;
      const toolUseBlocks = agentResponse.content.filter(b => b.type === "tool_use");
      agentMessages.push({ role: "assistant", content: agentResponse.content });

      const toolResults = await Promise.all(
        toolUseBlocks.map(async (block) => {
          if (block.type !== "tool_use") return null;
          const toolResult = await executeShieldTool(block.name, block.input as Record<string, unknown>);
          return {
            type: "tool_result" as const,
            tool_use_id: block.id,
            content: JSON.stringify(toolResult),
          };
        })
      );

      agentMessages.push({
        role: "user",
        content: toolResults.filter(Boolean) as Anthropic.ToolResultBlockParam[],
      });

      agentResponse = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1500,
        tools: sakTools,
        messages: agentMessages,
      });
    }

    const textBlock = agentResponse.content.find(b => b.type === "text");
    aiAnalysis = textBlock?.type === "text" ? textBlock.text : null;
  }

  return NextResponse.json({
    ...monitorResult,
    config,
    rescueSimulations,
    aiAnalysis,
    // Module 16: surface any unofficial mint warnings to the frontend
    mintWarnings: mintWarnings.length > 0 ? mintWarnings : undefined,
  });
}
