import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";

const ANTHROPIC_API_KEY  = process.env.ANTHROPIC_API_KEY ?? "";
const HELIUS_API_KEY     = process.env.HELIUS_API_KEY ?? "";
const HELIUS_RPC         = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const SOLIS_FEE_WALLET   = process.env.SOLIS_FEE_WALLET ?? "";   // Solana address that receives USDC
const REQUIRED_USDC_AMOUNT = 1_000_000; // 1.00 USDC (6 decimals)
const USDC_MINT          = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

// Compute ATA once — USDC transferChecked sends to ATA, not raw wallet address
const SOLIS_FEE_ATA = SOLIS_FEE_WALLET
  ? getAssociatedTokenAddressSync(
      new PublicKey(USDC_MINT),
      new PublicKey(SOLIS_FEE_WALLET)
    ).toString()
  : "";

const DEMO_MODE = !SOLIS_FEE_WALLET; // No fee wallet = demo: skip payment check

// ── Payment Verification ─────────────────────────────────────────
async function verifyUSDCPayment(txSig: string): Promise<boolean> {
  if (DEMO_MODE) return true; // demo: always pass

  try {
    const conn = new Connection(HELIUS_RPC, "confirmed");
    const tx = await conn.getParsedTransaction(txSig, { maxSupportedTransactionVersion: 0 });
    if (!tx) return false;

    // Find a USDC transfer instruction to our fee wallet
    const instructions = tx.transaction.message.instructions;
    for (const ix of instructions) {
      if ("parsed" in ix && ix.parsed?.type === "transferChecked") {
        const info = ix.parsed.info;
        if (
          info?.mint === USDC_MINT &&
          info?.destination === SOLIS_FEE_ATA &&
          Number(info?.tokenAmount?.amount ?? 0) >= REQUIRED_USDC_AMOUNT
        ) {
          return true;
        }
      }
    }
    return false;
  } catch {
    return false;
  }
}

// ── AI Deep Analysis ─────────────────────────────────────────────
async function generateAIAnalysis(
  mint: string,
  basicData: Record<string, unknown>
): Promise<string> {
  if (!ANTHROPIC_API_KEY || ANTHROPIC_API_KEY === "your-anthropic-api-key-here") {
    return `**深度 AI 分析报告**

安全评分：${basicData.securityScore}/100

**风险评估**
${Array.isArray(basicData.risks) && basicData.risks.length > 0
  ? (basicData.risks as string[]).map(r => `• ${r}`).join("\n")
  : "• 未发现明显风险因素"}

**优势因素**
${Array.isArray(basicData.positives) && basicData.positives.length > 0
  ? (basicData.positives as string[]).map(p => `• ${p}`).join("\n")
  : "• 无明显优势数据"}

**投资建议**
${(basicData.decision as { verdict?: string; suggestion?: string })?.suggestion ?? "建议谨慎决策"}

*此分析由 Sakura 规则引擎生成（AI API 未配置时的回退方案）*`;
  }

  const systemPrompt = `你是 Sakura 链上安全专家。根据代币安全数据，用中文生成简洁的深度分析报告（不超过200字）。分析包括：1) 最大风险点 2) 持仓集中度风险 3) 短期价格风险 4) 明确的仓位建议（占总资产%）。语气专业但直接。`;

  const userContent = `分析代币 ${mint}：
安全评分: ${basicData.securityScore}/100
可增发: ${basicData.mintable ? "是（高风险）" : "否"}
可冻结: ${basicData.freezable ? "是（风险）" : "否"}
蜜罐: ${basicData.isHoneypot ? "是（极高风险）" : "否"}
前10持有人占比: ${basicData.top10HolderPct ?? "未知"}%
持有人数: ${basicData.holderCount ?? "未知"}
风险因素: ${Array.isArray(basicData.risks) ? (basicData.risks as string[]).join(", ") : "无"}
优势: ${Array.isArray(basicData.positives) ? (basicData.positives as string[]).join(", ") : "无"}
AI裁决: ${(basicData.decision as { verdict?: string; label?: string })?.label ?? "未知"}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 400,
        system: systemPrompt,
        messages: [{ role: "user", content: userContent }],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    if (!res.ok) return "AI 分析暂不可用";
    const data = await res.json();
    return data?.content?.[0]?.text ?? "AI 分析暂不可用";
  } catch {
    return "AI 分析暂不可用（网络超时）";
  }
}

// ── Main handler ─────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mint = searchParams.get("mint");

  if (!mint) {
    return NextResponse.json({ error: "mint required" }, { status: 400 });
  }

  // Check for payment proof
  const paymentSig = req.headers.get("X-PAYMENT") ?? req.headers.get("x-payment");

  if (!paymentSig) {
    // Return 402 with payment challenge
    return NextResponse.json(
      {
        recipient: SOLIS_FEE_WALLET || "demo-mode",
        amount: 1.00,
        currency: "USDC",
        network: "solana-mainnet",
        description: `Sakura 深度 AI 代币分析 — ${mint.slice(0, 8)}...`,
      },
      {
        status: 402,
        headers: {
          "X-Payment-Required": "true",
          "X-Payment-Currency": "USDC",
          "X-Payment-Amount": "1.00",
          "X-Payment-Recipient": SOLIS_FEE_WALLET || "demo-mode",
          "X-Payment-Network": "solana-mainnet",
        },
      }
    );
  }

  // Verify payment
  const valid = await verifyUSDCPayment(paymentSig);
  if (!valid) {
    return NextResponse.json(
      { error: "Payment verification failed. Ensure 1.00 USDC was sent to the Sakura fee wallet." },
      { status: 402 }
    );
  }

  // Fetch basic token data from existing /api/token
  let basicData: Record<string, unknown> = {};
  try {
    const baseUrl = req.nextUrl.origin;
    const r = await fetch(`${baseUrl}/api/token?mint=${mint}&wallet=none`);
    if (r.ok) basicData = await r.json() as Record<string, unknown>;
  } catch { /* use empty */ }

  // Generate AI deep analysis
  const aiAnalysis = await generateAIAnalysis(mint, basicData);

  // Build SHA-256 hash for verifiable proof
  const payload = JSON.stringify({
    mint,
    analysis: aiAnalysis.slice(0, 100),
    paymentSig: paymentSig.slice(0, 16),
    ts: Math.floor(Date.now() / 1000),
  });
  const msgBuf = new TextEncoder().encode(payload);
  const hashBuf = await crypto.subtle.digest("SHA-256", msgBuf);
  const analysisHash = Array.from(new Uint8Array(hashBuf))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");

  return NextResponse.json({
    ...basicData,
    aiDeepAnalysis: aiAnalysis,
    paymentVerified: true,
    paymentSig,
    analysisHash,
    memoPayload: `solis:premium:${analysisHash.slice(0, 16)}`,
    demoMode: DEMO_MODE,
  });
}
