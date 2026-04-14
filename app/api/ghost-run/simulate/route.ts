/**
 * Ghost Run — Simulate API
 *
 * POST /api/ghost-run/simulate
 * Body: { strategy: string, wallet: string }
 *
 * 1. Claude parses NL strategy → StrategyStep[]
 * 2. simulateStrategy() — Jupiter Quote API + simulateTransaction (real Solana state)
 * 3. Agentic AI analysis — SAK fetchPrice (Jupiter) + native RPC balance/stake checks
 * 4. Returns precise token deltas, gas costs, APY, feasibility analysis, AI insights
 *
 * SAK/Solana native tools used here:
 *  - getBalance + getParsedTokenAccountsByOwner  (pre-flight balance check)
 *  - SAK fetchPrice via Jupiter Price V2          (live token USD prices)
 *  - getProgramAccounts (StakeProgram)            (total portfolio picture)
 *  - simulateTransaction                          (inside simulateStrategy in lib/ghost-run.ts)
 */
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { Connection, PublicKey } from "@solana/web3.js";
import { simulateStrategy } from "@/lib/ghost-run";
import type { StrategyStep } from "@/lib/ghost-run";
import { createReadOnlyAgent, RPC_URL } from "@/lib/agent";
import { getConnection } from "@/lib/rpc";
import { getWalletLimiter, checkWalletLimitMemory, trackUsage } from "@/lib/redis";
import { DEMO_GHOST_STRATEGY, getDemoGhostResult, getDemoGhostResultMarinade, getDemoGhostResultKamino, getDemoGhostResultJito } from "@/lib/demo-data";
import type { Lang } from "@/lib/demo-data";

export const maxDuration = 60;

// ── Server-side i18n for real-mode error messages & labels ─────────────────
type SimLang = "zh" | "en" | "ja";
function parseSimLang(v: unknown): SimLang {
  if (v === "en" || v === "ja" || v === "zh") return v;
  return "zh";
}
const simI18n: Record<string, Record<SimLang, string>> = {
  noApiKey: {
    zh: "未配置 ANTHROPIC_API_KEY — 請在 Vercel 環境變數中添加此 key",
    en: "ANTHROPIC_API_KEY not configured — please add it in Vercel environment variables",
    ja: "ANTHROPIC_API_KEY が未設定です — Vercel 環境変数に追加してください",
  },
  parseFailed: {
    zh: "無法解析策略。請描述如：「質押 2 SOL 到 Marinade」或「把 50 USDC 存入 Kamino」",
    en: "Could not parse strategy. Try something like: \"Stake 2 SOL on Marinade\" or \"Lend 50 USDC on Kamino\"",
    ja: "戦略を解析できません。例：「2 SOL を Marinade にステーク」「50 USDC を Kamino に預入」",
  },
  invalidSteps: {
    zh: "策略中的操作步驟無效。支持的代幣：SOL / USDC / USDT / mSOL / jitoSOL / bSOL，操作類型：stake / lend / swap。",
    en: "Invalid strategy steps. Supported tokens: SOL / USDC / USDT / mSOL / jitoSOL / bSOL. Step types: stake / lend / swap.",
    ja: "戦略のステップが無効です。対応トークン：SOL / USDC / USDT / mSOL / jitoSOL / bSOL、操作種別：stake / lend / swap。",
  },
  condBelow: {
    zh: "當 ${token} 價格跌破 $${price} 時自動執行",
    en: "Auto-execute when ${token} drops below $${price}",
    ja: "${token} が $${price} を下回ったら自動実行",
  },
  condAbove: {
    zh: "當 ${token} 價格突破 $${price} 時自動執行",
    en: "Auto-execute when ${token} rises above $${price}",
    ja: "${token} が $${price} を上回ったら自動実行",
  },
};
function st(key: string, lang: SimLang, vars?: Record<string, string>): string {
  const tpl = simI18n[key]?.[lang] ?? simI18n[key]?.zh ?? key;
  if (!vars) return tpl;
  return tpl.replace(/\$\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}

// AI prompt output language directive per lang
const AI_LANG_DIRECTIVE: Record<SimLang, string> = {
  zh: "Then write a strategy analysis in Traditional Chinese (繁體中文):",
  en: "Then write a strategy analysis in English:",
  ja: "Then write a strategy analysis in Japanese (日本語):",
};
const AI_ANALYSIS_TEMPLATE: Record<SimLang, string> = {
  zh: `- ✅/⚠️ 資金可行性：餘額是否足夠執行每個步驟
- 💰 投入總值 vs 預期產出總值（精確 USD）
- 📈 預計年化收益（總額 USD）+ 若有質押：名義 APY vs 通脹 → 實際收益
- 🏦 LST 協議深度（mSOL/jitoSOL 總供應量）→ 流動性評估
- ⚡ Gas 費用（USD）
- 🏛️ 整體資產狀況（可用 SOL + 代幣 + 質押 SOL）
- 🎯 策略效率評分（1-10）及理由
- ⚠️ 主要風險提示`,
  en: `- ✅/⚠️ Funding feasibility: is the balance sufficient for each step?
- 💰 Total input value vs expected output value (precise USD)
- 📈 Estimated annual yield (total USD) + if staking: nominal APY vs inflation → real yield
- 🏦 LST protocol depth (mSOL/jitoSOL total supply) → liquidity assessment
- ⚡ Gas cost (USD)
- 🏛️ Overall asset status (available SOL + tokens + staked SOL)
- 🎯 Strategy efficiency score (1-10) with reasoning
- ⚠️ Key risk warnings`,
  ja: `- ✅/⚠️ 資金実行可能性：各ステップに残高は十分か？
- 💰 投入総額 vs 予想産出総額（正確な USD）
- 📈 予想年間収益（合計 USD）+ ステーキングの場合：名目 APY vs インフレ → 実質収益
- 🏦 LST プロトコル深度（mSOL/jitoSOL 総供給量）→ 流動性評価
- ⚡ ガス代（USD）
- 🏛️ 全体資産状況（利用可能 SOL + トークン + ステーク SOL）
- 🎯 戦略効率スコア（1-10）と理由
- ⚠️ 主要リスク警告`,
};

// ── Module 07: Conditional Order detection (Escrow pattern) ──────────────────
// Detects trigger conditions in strategy text (e.g. "当SOL跌到$120时执行").
// Returns a ConditionalOrder describing the on-chain escrow PDA that would
// hold the strategy until the condition is met (no extra latency — regex only).
import type { ConditionalOrder } from "@/lib/ghost-run";

function detectConditionalOrder(strategy: string, steps: StrategyStep[], _simLang: SimLang = "zh"): ConditionalOrder | null {
  const stepSummary = steps.map(s => `${s.type}:${s.inputToken}→${s.outputToken}`).join("+");

  // Price-below patterns (zh + en)
  const belowPatterns = [
    /當\s*([A-Za-z]+)\s*(?:跌|降|低於|跌到|跌破|跌至)\s*\$?(\d+(?:\.\d+)?)/i,
    /([A-Za-z]+)\s*(?:跌|降|低於|跌到|跌破)\s*\$?(\d+(?:\.\d+)?)\s*時/i,
    /when\s+([A-Za-z]+)\s+(?:drops?|falls?)\s+(?:to|below)\s+\$?(\d+(?:\.\d+)?)/i,
    /if\s+([A-Za-z]+)\s+(?:drops?|falls?)\s+(?:to|below)\s+\$?(\d+(?:\.\d+)?)/i,
    /([A-Za-z]+)\s+price[s]?\s+(?:drops?|falls?)\s+(?:to|below)\s+\$?(\d+(?:\.\d+)?)/i,
  ];
  for (const re of belowPatterns) {
    const m = strategy.match(re);
    if (m) {
      const token = m[1].toUpperCase();
      const price = parseFloat(m[2]);
      if (!isNaN(price) && price > 0 && ["SOL","USDC","USDT","mSOL","jitoSOL","bSOL"].includes(token)) {
        return {
          triggerType: "price_below",
          watchToken: token,
          triggerPriceUsd: price,
          conditionLabel: st("condBelow", _simLang, { token, price: String(price) }),
          escrowMemoTemplate: JSON.stringify({
            event: "sakura_conditional_order_set",
            condition: `${token}_BELOW_${price}`,
            strategy: stepSummary,
            oracle: "pyth_sol_usd",
            module: "07_escrow_pattern",
          }),
          pdaSeedDescription: `["sakura_order", wallet_pubkey, "${token}", "${price}"]`,
        };
      }
    }
  }

  // Price-above patterns (zh + en)
  const abovePatterns = [
    /當\s*([A-Za-z]+)\s*(?:漲|升|高於|漲到|突破|漲至)\s*\$?(\d+(?:\.\d+)?)/i,
    /([A-Za-z]+)\s*(?:漲|升|高於|漲到|突破)\s*\$?(\d+(?:\.\d+)?)\s*時/i,
    /when\s+([A-Za-z]+)\s+(?:rises?|pumps?|reaches?)\s+(?:to|above)?\s+\$?(\d+(?:\.\d+)?)/i,
    /([A-Za-z]+)\s+price[s]?\s+(?:rises?|reaches?)\s+\$?(\d+(?:\.\d+)?)/i,
  ];
  for (const re of abovePatterns) {
    const m = strategy.match(re);
    if (m) {
      const token = m[1].toUpperCase();
      const price = parseFloat(m[2]);
      if (!isNaN(price) && price > 0 && ["SOL","USDC","USDT","mSOL","jitoSOL","bSOL"].includes(token)) {
        return {
          triggerType: "price_above",
          watchToken: token,
          triggerPriceUsd: price,
          conditionLabel: st("condAbove", _simLang, { token, price: String(price) }),
          escrowMemoTemplate: JSON.stringify({
            event: "sakura_conditional_order_set",
            condition: `${token}_ABOVE_${price}`,
            strategy: stepSummary,
            oracle: "pyth_sol_usd",
            module: "07_escrow_pattern",
          }),
          pdaSeedDescription: `["sakura_order", wallet_pubkey, "${token}", "${price}"]`,
        };
      }
    }
  }

  return null;
}

const PARSE_SYSTEM = `You are a Solana DeFi strategy parser. Convert the user's natural language strategy into a JSON array of steps.

Supported step types:
- swap: exchange one token for another (e.g. SOL→USDC)
- stake: liquid stake SOL (outputs: mSOL, jitoSOL, bSOL)
- lend: deposit into Kamino lending (inputs: USDC, SOL, USDT)

Output ONLY a valid JSON array, no markdown, no explanation. Example:
[
  {"type":"stake","inputToken":"SOL","inputAmount":3,"outputToken":"mSOL","protocol":"Marinade"},
  {"type":"lend","inputToken":"USDC","inputAmount":50,"outputToken":"kUSDC","protocol":"Kamino"}
]

Supported tokens: SOL, USDC, USDT, mSOL, jitoSOL, bSOL
Protocols for stake: Marinade (→mSOL), Jito (→jitoSOL), BlazeStake (→bSOL)
Protocols for lend: Kamino`;

const TOKEN_MINT_MAP: Record<string, string> = {
  SOL:     "So11111111111111111111111111111111111111112",
  USDC:    "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  USDT:    "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
  mSOL:    "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So",
  jitoSOL: "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn",
  bSOL:    "bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1",
};
const TOKEN_PRICE_FALLBACK: Record<string, number> = {
  SOL: 170, USDC: 1, USDT: 1, mSOL: 178, jitoSOL: 178, bSOL: 176,
};

export async function POST(req: NextRequest) {
  let body: { strategy?: string; wallet?: string; demo?: boolean; lang?: string } = {};
  try { body = await req.json(); } catch { /* ok */ }

  // ── Demo mode: return preset data instantly ───────────────────────
  if (body.demo === true) {
    const lang = (["zh", "en", "ja"].includes(body.lang ?? "") ? body.lang : "zh") as Lang;
    const s = (body.strategy ?? "").toLowerCase();

    // Parse amount from strategy text (e.g. "10 USDC" → 10, "2 SOL" → 2)
    const usdcMatch = s.match(/(\d+(?:\.\d+)?)\s*usdc/);
    const solMatch  = s.match(/(\d+(?:\.\d+)?)\s*sol/);
    const usdcAmt   = usdcMatch ? parseFloat(usdcMatch[1]) : null;
    const solAmt    = solMatch  ? parseFloat(solMatch[1])  : null;

    const demoData =
      s.includes("jito") && s.includes("kamino") ? getDemoGhostResultJito(lang) :
      s.includes("marinade") && !s.includes("usdc") ? getDemoGhostResultMarinade(lang) :
      s.includes("kamino") && !s.includes("sol") ? getDemoGhostResultKamino(lang) :
      getDemoGhostResult(lang);

    // Deep-clone and patch amounts if user specified different values
    const result = JSON.parse(JSON.stringify(demoData));
    if (usdcAmt !== null) {
      for (const step of result.result.steps) {
        if (step.step.inputToken === "USDC") {
          const ratio = usdcAmt / step.step.inputAmount;
          step.step.inputAmount = usdcAmt;
          step.outputAmount     = parseFloat((step.outputAmount * ratio).toFixed(4));
          step.annualUsdYield   = parseFloat((step.annualUsdYield * ratio).toFixed(2));
        }
      }
      for (const step of result.steps) {
        if (step.inputToken === "USDC") step.inputAmount = usdcAmt;
      }
    }
    if (solAmt !== null) {
      for (const step of result.result.steps) {
        if (step.step.inputToken === "SOL") {
          const ratio = solAmt / step.step.inputAmount;
          step.step.inputAmount = solAmt;
          step.outputAmount     = parseFloat((step.outputAmount * ratio).toFixed(4));
          step.annualUsdYield   = parseFloat((step.annualUsdYield * ratio).toFixed(2));
        }
      }
      for (const step of result.steps) {
        if (step.inputToken === "SOL") step.inputAmount = solAmt;
      }
    }

    // Generate demo commitment + store run (same as real mode, so UI panels always show)
    const cryptoMod = await import("crypto");
    const demoStrategy = body.strategy ?? "demo";
    const demoCommitmentId = "GR-DEMO" + cryptoMod.createHash("sha256")
      .update(demoStrategy + Date.now()).digest("hex").slice(0, 4).toUpperCase();

    let demoRunId: string | null = null;
    try {
      const { storeRun } = await import("@/lib/run-store");
      demoRunId = await storeRun({
        strategy: demoStrategy,
        walletShort: "demo...mode",
        steps: result.steps,
        result: result.result,
        aiAnalysis: demoData.aiAnalysis,
        commitmentId: demoCommitmentId,
        commitmentMemoSig: null,
        lang,
        ts: Date.now(),
      });
    } catch { /* optional */ }

    return NextResponse.json({
      steps: result.steps,
      result: result.result,
      aiAnalysis: demoData.aiAnalysis,
      commitmentId: demoCommitmentId,
      commitmentMemoSig: null,
      runId: demoRunId,
    });
  }

  const { strategy, wallet } = body;
  const simLang = parseSimLang(body.lang);
  if (!strategy || !wallet) {
    return NextResponse.json({ error: "Missing strategy or wallet" }, { status: 400 });
  }
  // Prevent cost amplification: limit strategy length
  if (strategy.length > 2000) {
    return NextResponse.json({ error: "GHOST_ERR_TOO_LONG" }, { status: 400 });
  }
  // Validate wallet is a valid base58 Solana address
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet)) {
    return NextResponse.json({ error: "GHOST_ERR_INVALID_WALLET" }, { status: 400 });
  }

  void trackUsage("ghost", wallet);

  // ── Per-wallet hourly rate limit (Sybil defense) ───────────────────────────
  // IP-based middleware limits alone can be bypassed with rotating IPs.
  // This wallet-keyed limit is shared across ALL Vercel instances via Redis.
  // Limit: 20 simulations/hour per wallet (generous for legitimate use).
  {
    const walletLimiter = getWalletLimiter("ghost-run-simulate", 20);
    if (walletLimiter) {
      const { success, reset } = await walletLimiter.limit(wallet);
      if (!success) {
        return NextResponse.json(
          { error: "GHOST_ERR_RATE_LIMIT" },
          { status: 429, headers: { "Retry-After": String(Math.max(1, Math.ceil((reset - Date.now()) / 1000))), "X-RateLimit-Scope": "wallet", "X-RateLimit-Mode": "distributed" } }
        );
      }
    } else {
      // In-memory fallback
      const { blocked, retryAfter } = checkWalletLimitMemory("ghost-run-simulate", wallet, 20);
      if (blocked) {
        return NextResponse.json(
          { error: "GHOST_ERR_RATE_LIMIT" },
          { status: 429, headers: { "Retry-After": String(retryAfter ?? 3600), "X-RateLimit-Scope": "wallet", "X-RateLimit-Mode": "memory" } }
        );
      }
    }
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({
      error: st("noApiKey", simLang),
    }, { status: 500 });
  }

  const client = new Anthropic({ apiKey });
  let steps: StrategyStep[] = [];

  // ── Step 1: Parse NL strategy with Claude ──────────────────────────
  try {
    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      system: PARSE_SYSTEM,
      messages: [{ role: "user", content: strategy }],
    });
    const text = msg.content[0].type === "text" ? msg.content[0].text.trim() : "[]";
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    steps = jsonMatch ? (JSON.parse(jsonMatch[0]) as StrategyStep[]) : [];
  } catch (err) {
    // [SECURITY FIX M-2] Never return raw Claude/Anthropic error messages.
    // err.message can contain internal model names, account quota details, or
    // API key hints. Log server-side only, return a generic client message.
    console.error("[ghost-run/simulate] Claude parse error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "GHOST_ERR_UNAVAILABLE" }, { status: 500 });
  }

  if (steps.length === 0) {
    return NextResponse.json({
      error: st("parseFailed", simLang),
    }, { status: 400 });
  }

  // ── [SECURITY FIX H-2] Validate Claude-parsed steps before execution ───────
  // Claude's output is untrusted structured data. Malicious strategy strings could
  // cause Claude to emit steps with negative amounts, Infinity, unknown tokens, etc.
  // Strictly allowlist all fields before passing to simulateStrategy().
  const VALID_STEP_TYPES  = new Set(["swap", "stake", "lend"]);
  const VALID_TOKENS      = new Set(["SOL", "USDC", "USDT", "mSOL", "jitoSOL", "bSOL"]);
  const MAX_STEP_AMOUNT   = 10_000; // sanity cap per step ($10k+ is unrealistic for a sim)

  steps = steps.filter(s =>
    VALID_STEP_TYPES.has(s.type) &&
    VALID_TOKENS.has(s.inputToken) &&
    VALID_TOKENS.has(s.outputToken) &&
    typeof s.inputAmount === "number" &&
    Number.isFinite(s.inputAmount) &&
    s.inputAmount > 0 &&
    s.inputAmount <= MAX_STEP_AMOUNT
  );

  if (steps.length === 0) {
    return NextResponse.json({
      error: st("invalidSteps", simLang),
    }, { status: 400 });
  }

  // Cap at 10 steps even if Claude hallucinated more
  if (steps.length > 10) steps = steps.slice(0, 10);

  // ── Step 2: Simulate — Jupiter Quote API + simulateTransaction ─────
  let result;
  try {
    result = await simulateStrategy(steps, wallet);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[ghost-run/simulate] simulation error:", err);
    return NextResponse.json({ error: `Simulation failed: ${msg}` }, { status: 500 });
  }

  // ── Module 07+10: Conditional order detection + live price distance ──
  // Regex detection (zero latency) + Jupiter price fetch for distance calc.
  const conditionalOrder = detectConditionalOrder(strategy, steps, simLang);
  if (conditionalOrder) {
    // Fetch live price to calculate trigger distance (Module 10: use price feed)
    try {
      const mint = TOKEN_MINT_MAP[conditionalOrder.watchToken] ?? TOKEN_MINT_MAP.SOL;
      const priceRes = await fetch(
        `https://api.jup.ag/price/v2?ids=${mint}`,
        { signal: AbortSignal.timeout(2_000) }
      ).catch(() => null);
      if (priceRes?.ok) {
        const priceJson = await priceRes.json() as { data?: Record<string, { price?: number }> };
        const livePrice = priceJson.data?.[mint]?.price;
        if (livePrice && livePrice > 0) {
          conditionalOrder.currentPriceUsd = +livePrice.toFixed(2);
          const dist = conditionalOrder.triggerType === "price_below"
            ? ((livePrice - conditionalOrder.triggerPriceUsd) / livePrice) * 100
            : ((conditionalOrder.triggerPriceUsd - livePrice) / livePrice) * 100;
          conditionalOrder.triggerDistancePct = +dist.toFixed(1);
        }
      }
    } catch { /* skip — display without distance */ }
    // Fallback: use TOKEN_PRICE_FALLBACK if live fetch failed
    if (!conditionalOrder.currentPriceUsd) {
      const fallback = TOKEN_PRICE_FALLBACK[conditionalOrder.watchToken];
      if (fallback) {
        conditionalOrder.currentPriceUsd = fallback;
        const dist = conditionalOrder.triggerType === "price_below"
          ? ((fallback - conditionalOrder.triggerPriceUsd) / fallback) * 100
          : ((conditionalOrder.triggerPriceUsd - fallback) / fallback) * 100;
        conditionalOrder.triggerDistancePct = +dist.toFixed(1);
      }
    }
    result.conditionalOrder = conditionalOrder;
  }

  // ── Step 3: Agentic AI analysis — SAK + Solana native tools ────────
  let aiAnalysis: string | null = null;
  try {
    // Module 16: multi-RPC failover — auto-selects healthiest endpoint
    const conn = await getConnection("confirmed");
    const agent = createReadOnlyAgent();

    // ── SAK Tool definitions ──────────────────────────────────────────
    const sakTools: Anthropic.Tool[] = [
      {
        name: "check_wallet_balances",
        description: "Check exact SOL and SPL token balances using Solana native getBalance + getParsedTokenAccountsByOwner. Verifies if wallet can fund each strategy step and flags any shortfall.",
        input_schema: {
          type: "object" as const,
          properties: { wallet: { type: "string", description: "Solana wallet address (base58)" } },
          required: ["wallet"],
        },
      },
      {
        name: "get_token_price",
        description: "Get live USD price for any Solana token using SAK TokenPlugin fetchPrice (Jupiter Price V2 aggregator — Solana native). Use this for SOL, mSOL, jitoSOL, bSOL, USDC to calculate exact USD input/output values.",
        input_schema: {
          type: "object" as const,
          properties: {
            token: { type: "string", description: "Token symbol: SOL, USDC, USDT, mSOL, jitoSOL, bSOL" },
          },
          required: ["token"],
        },
      },
      {
        name: "get_stake_positions",
        description: "Get all native SOL staking positions for the wallet using getProgramAccounts on Stake Program (memcmp offset 44 = withdrawer authority). Provides full liquidity and asset picture.",
        input_schema: {
          type: "object" as const,
          properties: { wallet: { type: "string", description: "Wallet address to scan for stake accounts" } },
          required: ["wallet"],
        },
      },
      {
        name: "get_inflation_rate",
        description: "Get current Solana network inflation rate using native getInflationRate RPC. Critical for staking analysis: compares staking APY vs inflation to show the REAL yield. E.g. staking APY 7.2% - inflation 4.7% = real yield +2.5%.",
        input_schema: {
          type: "object" as const,
          properties: {},
          required: [],
        },
      },
      {
        name: "get_lst_market_depth",
        description: "Get total supply of a Liquid Staking Token (mSOL, jitoSOL, bSOL) using Solana native getTokenSupply. Confirms protocol health — billions staked = deep liquidity. Low supply = risk of illiquidity.",
        input_schema: {
          type: "object" as const,
          properties: {
            token: { type: "string", description: "LST token symbol: mSOL, jitoSOL, or bSOL" },
          },
          required: ["token"],
        },
      },
    ];

    // ── SAK Tool executor (Solana native, no external APIs) ───────────
    async function executeGhostTool(name: string, input: Record<string, unknown>): Promise<unknown> {
      try {
        switch (name) {

          case "check_wallet_balances": {
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
                const mintAddr = info?.mint as string ?? "";
                return {
                  symbol: Object.entries(TOKEN_MINT_MAP).find(([, m]) => m === mintAddr)?.[0] ?? mintAddr.slice(0, 8),
                  amount: (info?.tokenAmount?.uiAmount as number) ?? 0,
                };
              })
              .filter(t => t.amount > 0);

            // Check feasibility per step
            const feasibility = steps.map(step => {
              if (step.inputToken === "SOL") {
                const feasible = solAmount >= step.inputAmount;
                return { step: `${step.type} ${step.inputAmount} SOL`, feasible, available: +solAmount.toFixed(4), shortfall: feasible ? 0 : +(step.inputAmount - solAmount).toFixed(4) };
              }
              const tokenBal = tokens.find(t => t.symbol === step.inputToken);
              const avail = tokenBal?.amount ?? 0;
              const feasible = avail >= step.inputAmount;
              return { step: `${step.type} ${step.inputAmount} ${step.inputToken}`, feasible, available: +avail.toFixed(4), shortfall: feasible ? 0 : +(step.inputAmount - avail).toFixed(4) };
            });

            return { solAmount: +solAmount.toFixed(4), tokenBalances: tokens, feasibility, allFeasible: feasibility.every(f => f.feasible) };
          }

          case "get_token_price": {
            const token = input.token as string;
            const mint = TOKEN_MINT_MAP[token] ?? TOKEN_MINT_MAP["SOL"];
            try {
              // SAK fetchPrice uses Jupiter Price V2 API (Solana native aggregator)
              const price = await (agent.methods as Record<string, (...args: unknown[]) => Promise<number>>)
                .fetchPrice(mint);
              return { token, priceUsd: price, source: "Jupiter Price V2 (Solana native)" };
            } catch {
              return { token, priceUsd: TOKEN_PRICE_FALLBACK[token] ?? 1, source: "fallback" };
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
              positions: stakeAccounts.slice(0, 5).map(sa => ({
                address: sa.pubkey.toString().slice(0, 12),
                sol: +(sa.account.lamports / 1e9).toFixed(4),
              })),
              note: "Native staked SOL is illiquid but part of total portfolio value",
            };
          }

          case "get_inflation_rate": {
            // Solana native getInflationRate — compares staking APY vs network inflation
            const inflation = await conn.getInflationRate();
            return {
              total: +(inflation.total * 100).toFixed(3),
              validator: +(inflation.validator * 100).toFixed(3),
              foundation: +(inflation.foundation * 100).toFixed(3),
              epoch: inflation.epoch,
              note: "Staking APY must beat total inflation to generate real positive yield",
              realYieldExample: "If staking APY is 7.2% and total inflation is 4.7%, real yield ≈ +2.5%",
            };
          }

          case "get_lst_market_depth": {
            // Solana native getTokenSupply — checks LST protocol total supply (market depth)
            const lstMints: Record<string, string> = {
              mSOL:    "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So",
              jitoSOL: "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn",
              bSOL:    "bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1",
            };
            const token = input.token as string;
            const mint = lstMints[token];
            if (!mint) return { error: `Unknown LST token: ${token}` };
            const supplyInfo = await conn.getTokenSupply(new PublicKey(mint));
            const supplyAmount = supplyInfo.value.uiAmount ?? 0;
            return {
              token,
              mint: mint.slice(0, 12),
              totalSupply: +supplyAmount.toFixed(0),
              totalSupplyLabel: supplyAmount >= 1e6 ? `${(supplyAmount / 1e6).toFixed(2)}M` : `${(supplyAmount / 1e3).toFixed(1)}K`,
              liquidityAssessment: supplyAmount >= 1_000_000
                ? "DEEP — >1M tokens staked, excellent liquidity"
                : supplyAmount >= 100_000
                ? "GOOD — 100K–1M tokens staked"
                : "SHALLOW — <100K tokens, exit liquidity risk",
            };
          }

          default:
            return { error: `Unknown tool: ${name}` };
        }
      } catch (err) {
        return { error: err instanceof Error ? err.message : String(err) };
      }
    }

    // ── Agentic loop: Claude autonomously calls SAK tools ─────────────
    const simulationSummary = result.steps.map(s => ({
      type: s.step.type,
      input: `${s.step.inputAmount} ${s.step.inputToken}`,
      output: `${s.outputAmount.toFixed(4)} ${s.step.outputToken}`,
      apy: s.estimatedApy != null ? `${s.estimatedApy.toFixed(1)}%` : null,
      annualYieldUsd: s.annualUsdYield != null ? `$${s.annualUsdYield.toFixed(2)}` : null,
      gasSol: s.gasSol.toFixed(7),
      success: s.success,
      error: s.error ?? null,
    }));

    const agentMessages: Anthropic.MessageParam[] = [
      {
        role: "user",
        content: `You are a Solana DeFi strategy advisor. Analyze this strategy for wallet ${wallet.slice(0, 8)}...

STRATEGY INPUT: "${strategy}"

SIMULATION RESULTS (from Solana simulateTransaction):
${JSON.stringify(simulationSummary, null, 2)}

canExecute: ${result.canExecute}
totalGasSol: ${result.totalGasSol.toFixed(7)} SOL
warnings: ${result.warnings.join("; ") || "none"}

YOUR TASK — Use tools in this order:
1. check_wallet_balances — verify wallet can fund each step
2. get_token_price — get prices for each input AND output token (exact USD values)
3. get_stake_positions — full portfolio picture including staked SOL
4. get_inflation_rate — get current Solana inflation to calculate REAL staking yield
5. get_lst_market_depth — for any stake step, verify the LST protocol depth (mSOL/jitoSOL)

${AI_LANG_DIRECTIVE[simLang]}
${AI_ANALYSIS_TEMPLATE[simLang]}`,
      },
    ];

    let agentResponse = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1400,
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
          const toolResult = await executeGhostTool(block.name, block.input as Record<string, unknown>);
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
        max_tokens: 1400,
        tools: sakTools,
        messages: agentMessages,
      });
    }

    const textBlock = agentResponse.content.find(b => b.type === "text");
    aiAnalysis = textBlock?.type === "text" ? textBlock.text : null;
  } catch (err) {
    console.error("[ghost-run/simulate] agentic analysis error:", err);
  }

  // ── Proof-of-Simulation: cryptographic pre-commitment (full SHA-256) ─────────
  // Creates a verifiable pre-commitment: "I knew the simulation result BEFORE executing."
  // All inputs are canonical and recorded in the Memo — anyone can recompute.
  const { commitmentHash } = await import("@/lib/crypto-proof");
  const commitTs = new Date().toISOString();
  const commitResult = commitmentHash(strategy, JSON.stringify(result), wallet.slice(0, 8), commitTs);
  const commitmentId = commitResult.commitmentId;

  const commitmentPayload = JSON.stringify({
    event: "ghost_run_commitment",
    version: 2,
    commitment_id: commitmentId,
    strategy_hash: commitResult.strategyHash,
    sim_result_hash: commitResult.resultHash,
    commit_input: commitResult.commitInput,
    wallet: wallet.slice(0, 8),
    steps: steps.length,
    can_execute: result.canExecute,
    ts: commitTs,
  });

  let commitmentMemoSig: string | null = null;
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || (process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`);
    if (baseUrl) {
      const memoHeaders: Record<string, string> = { "Content-Type": "application/json" };
      if (process.env.INTERNAL_API_SECRET) memoHeaders["x-internal-secret"] = process.env.INTERNAL_API_SECRET;
      const memoRes = await fetch(`${baseUrl}/api/agent/memo`, {
        method: "POST",
        headers: memoHeaders,
        body: JSON.stringify({ memoPayload: commitmentPayload }),
      }).catch(() => null);
      if (memoRes?.ok) {
        const memoData = await memoRes.json();
        commitmentMemoSig = memoData.txSignature ?? memoData.signature ?? null;
      }
    }
  } catch { /* commitment memo is optional */ }

  // Store run for shareable report page
  let runId: string | null = null;
  try {
    const { storeRun } = await import("@/lib/run-store");
    runId = await storeRun({
      strategy,
      walletShort: wallet.slice(0, 8),
      steps,
      result,
      aiAnalysis,
      commitmentId: commitmentId ?? null,
      commitmentMemoSig,
      lang: simLang,
      ts: Date.now(),
    });
  } catch { /* store is optional */ }

  return NextResponse.json({ steps, result, aiAnalysis, commitmentId, commitmentMemoSig, runId });
}
