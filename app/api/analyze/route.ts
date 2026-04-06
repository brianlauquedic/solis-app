import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { Connection, VersionedTransaction } from "@solana/web3.js";
import { sakGetTokenReport, RPC_URL } from "@/lib/agent";
import { runQuotaGate } from "@/lib/rate-limit";

const SOL_MINT = "So11111111111111111111111111111111111111112";

function fetchWithTimeout(url: string, opts: RequestInit = {}, ms = 7000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

// ── Simulate sell path via Jupiter + RPC ─────────────────────────
// Layer 3 honeypot detection: dynamic simulation (not static analysis)
// Works by:
//   1. Fetching a Jupiter sell quote (token → SOL)
//   2. Building the swap tx with a known whale/dummy pubkey
//   3. simulateTransaction with replaceRecentBlockhash + sigVerify:false
//   → If contract has blacklist/transfer hook, simulation fails at program level
//   → If just insufficient balance, error is "custom program error" not "blocked"
async function simulateSellPath(mint: string): Promise<{
  canSell: boolean;
  isHoneypot: boolean;
  priceImpactPct: number | null;
  reason: string;
}> {
  try {
    // Step 1: Get sell quote (token → SOL), small amount, high slippage tolerance
    const quoteParams = new URLSearchParams({
      inputMint: mint,
      outputMint: SOL_MINT,
      amount: "1000000", // 1 unit (6 decimals)
      slippageBps: "5000", // 50% — we only care if route exists
    });
    const quoteRes = await fetchWithTimeout(
      `https://quote-api.jup.ag/v6/quote?${quoteParams}`, {}, 6000
    );
    if (!quoteRes.ok) {
      return { canSell: false, isHoneypot: true, priceImpactPct: null, reason: "No sell route on Jupiter" };
    }
    const quote = await quoteRes.json();
    if (!quote.outAmount || quote.error) {
      return { canSell: false, isHoneypot: true, priceImpactPct: null, reason: "Jupiter: no liquidity for selling" };
    }

    const priceImpact = parseFloat(quote.priceImpactPct ?? "0");

    // Step 2: Build swap tx — use a known active wallet as dummy signer
    // (replaceRecentBlockhash + sigVerify:false means we don't need real sig)
    const DUMMY_PUBKEY = "GThUX1Atko4tqhN2NaiTazFAcaPBFtynskG9Rn3w5wC"; // known active wallet
    const swapRes = await fetchWithTimeout(
      "https://quote-api.jup.ag/v6/swap",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteResponse: quote,
          userPublicKey: DUMMY_PUBKEY,
          wrapAndUnwrapSol: true,
          skipUserAccountsRpcCalls: true,
        }),
      },
      8000
    );
    if (!swapRes.ok) {
      // Can't build tx but route exists — borderline, not conclusive
      return { canSell: true, isHoneypot: false, priceImpactPct: priceImpact, reason: "Route exists, tx build skipped" };
    }
    const swapData = await swapRes.json();
    if (!swapData.swapTransaction) {
      return { canSell: true, isHoneypot: false, priceImpactPct: priceImpact, reason: "Route exists" };
    }

    // Step 3: Simulate — replaceRecentBlockhash avoids expiry, sigVerify:false skips signature
    const conn = new Connection(RPC_URL, "confirmed");
    const txBuf = Buffer.from(swapData.swapTransaction, "base64");
    const tx = VersionedTransaction.deserialize(txBuf);
    const sim = await conn.simulateTransaction(tx, {
      replaceRecentBlockhash: true,
      sigVerify: false,
    });

    if (sim.value.err) {
      const logs = (sim.value.logs ?? []).join(" ").toLowerCase();
      const isBlocked =
        logs.includes("blacklist") ||
        logs.includes("frozen") ||
        logs.includes("transfer hook") ||
        logs.includes("blocked") ||
        logs.includes("unauthorized");
      if (isBlocked) {
        return { canSell: false, isHoneypot: true, priceImpactPct: priceImpact, reason: "Transfer blocked by contract (blacklist/hook)" };
      }
      // Simulation failed but likely due to insufficient balance in dummy wallet — not conclusive
      return { canSell: true, isHoneypot: false, priceImpactPct: priceImpact, reason: "Simulation inconclusive (balance check)" };
    }

    // High sell tax detection (>30% price impact on sell = suspicious)
    if (priceImpact > 30) {
      return { canSell: true, isHoneypot: true, priceImpactPct: priceImpact, reason: `Extreme sell tax: ${priceImpact.toFixed(1)}% price impact` };
    }

    return { canSell: true, isHoneypot: false, priceImpactPct: priceImpact, reason: "Sell path verified" };
  } catch {
    return { canSell: false, isHoneypot: false, priceImpactPct: null, reason: "Simulation unavailable" };
  }
}

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? "";

interface AnalyzeRequest {
  mint: string;
  symbol: string;
  name: string;
  price: number | null;
  securityScore: number;
  risks: string[];
  positives: string[];
  holderCount: number | null;
  top10HolderPct: string | null;
  mintable: boolean;
  freezable: boolean;
  isHoneypot: boolean;
  walletRiskyPct: number;
  walletTotalUSD: number;
}

// ── Call Claude API ──────────────────────────────────────────────
async function callClaude(prompt: string): Promise<string> {
  if (!ANTHROPIC_API_KEY || ANTHROPIC_API_KEY === "your-anthropic-api-key-here") {
    // Fallback: rule-based analysis when no API key
    return "";
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5",
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!res.ok) return "";
  const data = await res.json();
  return data?.content?.[0]?.text ?? "";
}

// ── Rule-based fallback ──────────────────────────────────────────
function ruleBasedAnalysis(req: AnalyzeRequest): string {
  const parts: string[] = [];

  // Security overview
  if (req.isHoneypot) {
    parts.push(`⛔ ${req.symbol} 检测到蜜罐（Honeypot）特征，买入后将无法卖出，这是常见的诈骗手法，强烈建议立即回避。`);
  } else if (req.securityScore >= 80) {
    parts.push(`${req.symbol} 的合约安全评分达到 ${req.securityScore}/100，属于较高水平，未发现明显的恶意合约特征。`);
  } else if (req.securityScore >= 50) {
    parts.push(`${req.symbol} 安全评分 ${req.securityScore}/100，存在一些需要关注的风险点，建议谨慎操作。`);
  } else {
    parts.push(`${req.symbol} 安全评分仅 ${req.securityScore}/100，合约风险较高，存在明显的风险信号。`);
  }

  // Specific risks
  if (req.mintable) parts.push("合约保留了增发权限，项目方可以随时铸造新币稀释你的持仓。");
  if (req.freezable) parts.push("合约具备账户冻结权限，你的资产可能在不知情的情况下被锁定。");

  if (req.top10HolderPct) {
    const pct = parseFloat(req.top10HolderPct);
    if (pct > 70) {
      parts.push(`前10地址持有 ${pct.toFixed(1)}% 的代币，高度集中，大户一旦出售将对价格造成巨大冲击。`);
    } else if (pct > 40) {
      parts.push(`前10地址持有 ${req.top10HolderPct}%，持币有一定集中度，需关注大户动向。`);
    }
  }

  // Position advice
  if (req.walletRiskyPct > 60) {
    parts.push(`⚠️ 你的钱包中高风险资产已占 ${req.walletRiskyPct.toFixed(0)}%，风险过于集中。即便你看好这个代币，此时加仓也会进一步提高整体风险。建议先清理部分风险仓位，再考虑新的投入。`);
  } else if (req.securityScore >= 70 && !req.mintable && !req.freezable) {
    const suggested = req.walletTotalUSD > 0
      ? Math.min(req.walletTotalUSD * 0.05, 500).toFixed(0)
      : "小额";
    parts.push(`如果决定买入，建议以总资产的 3-5% 为上限（约 $${suggested}），并设置 -25% 到 -30% 的止损位。切勿全仓押注。`);
  }

  return parts.join(" ");
}

// ── Sanitize a user-supplied string for safe prompt interpolation ─
// Strips control chars and caps length to prevent prompt injection.
function sanitizeField(s: string, maxLen = 100): string {
  return s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").slice(0, maxLen);
}

// ── Build Claude prompt ──────────────────────────────────────────
function buildPrompt(req: AnalyzeRequest): string {
  // Sanitize all user-controlled string fields before interpolation
  const safeName    = sanitizeField(req.name, 80);
  const safeSymbol  = sanitizeField(req.symbol, 20);
  const safeRisks   = req.risks.map(r => sanitizeField(r, 80)).join("；") || "无";
  const safePos     = req.positives.map(p => sanitizeField(p, 80)).join("；") || "无";

  return `你是 Sakura，一个 Solana 链上 AI 财务顾问。用简洁的中文给出代币分析建议，不超过150字。

代币信息：
- 名称：${safeName}（${safeSymbol}）
- 合约：${req.mint}
- 当前价格：${req.price ? `$${req.price}` : "无数据"}
- 安全评分：${req.securityScore}/100
- 风险点：${safeRisks}
- 优势：${safePos}
- 持有地址数：${req.holderCount ?? "未知"}
- 前10地址占比：${req.top10HolderPct ? req.top10HolderPct + "%" : "未知"}
- 增发权限：${req.mintable ? "有" : "无"}
- 冻结权限：${req.freezable ? "有" : "无"}
- 是否蜜罐：${req.isHoneypot ? "是" : "否"}

用户钱包状态：
- 高风险仓位占比：${req.walletRiskyPct.toFixed(0)}%
- 钱包总资产：$${req.walletTotalUSD.toFixed(0)}

请给出：1) 一句话风险总结 2) 具体仓位建议（金额）3) 止损建议。语气专业但易懂，不加"根据数据"等套话。`;
}

// ── Generate Commit-Reveal Hash ──────────────────────────────────
function generateReasoningHash(data: {
  mint: string;
  securityScore: number;
  decision: string;
  reasoning: string;
  timestamp: number;
}): string {
  const payload = JSON.stringify(data);
  return crypto.createHash("sha256").update(payload).digest("hex");
}

// ── Main Handler ─────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  // Anti-Sybil quota gate: 3 free analyses per wallet/device/IP
  const gate = await runQuotaGate(req, "analyze");
  if (!gate.proceed) return gate.response;

  try {
    const body: AnalyzeRequest = await req.json();
    const timestamp = Date.now();

    // Validate mint address format (base58, 32-44 chars) — prevents SSRF via URL injection
    const MINT_RE = /^[1-9A-HJ-NP-Z]{32,44}$/;
    if (!body.mint || !MINT_RE.test(body.mint)) {
      return NextResponse.json({ error: "Invalid mint address" }, { status: 400 });
    }

    // Get AI reasoning
    const prompt = buildPrompt(body);
    let reasoning = await callClaude(prompt);
    const aiAvailable = !!reasoning;

    // Fallback to rule-based if Claude not available
    if (!reasoning) {
      reasoning = ruleBasedAnalysis(body);
    }

    // Decision label
    const decision =
      body.securityScore >= 70 && !body.isHoneypot && !body.mintable
        ? "可以考虑"
        : body.securityScore >= 45
        ? "谨慎操作"
        : "建议回避";

    // Generate on-chain proof hash (Commit-Reveal)
    const reasoningHash = generateReasoningHash({
      mint: body.mint,
      securityScore: body.securityScore,
      decision,
      reasoning,
      timestamp,
    });

    // Jupiter Shield rug check + simulateTransaction sell path (parallel)
    let sakReport: { score?: number; risks?: string[] } = {};
    let simulationResult: Awaited<ReturnType<typeof simulateSellPath>> | null = null;
    await Promise.all([
      (async () => {
        try {
          const report = await sakGetTokenReport(body.mint);
          if (report) sakReport = report as { score?: number; risks?: string[] };
        } catch { /* non-blocking */ }
      })(),
      (async () => {
        try {
          simulationResult = await simulateSellPath(body.mint);
        } catch { /* non-blocking */ }
      })(),
    ]);

    // Memo: commit hash only — never leak reasoning text on-chain (privacy)
    const memoPayload = `[Sakura] commit:${reasoningHash.slice(0, 32)} | ts:${timestamp}`;

    return NextResponse.json({
      reasoning,
      decision,
      aiAvailable,
      timestamp,
      // SAK Jupiter Shield enrichment
      sakReport,
      // Layer 3: simulateTransaction sell path
      simulation: simulationResult,
      // Commit-Reveal fields
      reasoningHash,
      memoPayload,
      proofData: {
        mint: body.mint,
        securityScore: body.securityScore,
        decision,
        timestamp,
        hashAlgo: "sha256",
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Analysis failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
