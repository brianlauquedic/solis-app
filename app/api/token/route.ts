import { NextRequest, NextResponse } from "next/server";
import { isValidSolanaAddress } from "@/lib/rate-limit";

const HELIUS_API_KEY = process.env.HELIUS_API_KEY ?? "";
const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

function fetchWithTimeout(url: string, opts: RequestInit = {}, ms = 8000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

// ── GoPlus Security ──────────────────────────────────────────────
async function getGoPlus(mint: string) {
  try {
    const res = await fetchWithTimeout(
      `https://api.gopluslabs.io/api/v1/solana/token_security?contract_addresses=${mint}`,
      { headers: { "Content-Type": "application/json" } },
      8000
    );
    const data = await res.json();
    return data?.result?.[mint.toLowerCase()] ?? data?.result?.[mint] ?? null;
  } catch {
    return null;
  }
}

// ── Jupiter Price ────────────────────────────────────────────────
async function getJupiterPrice(mint: string) {
  try {
    const res = await fetchWithTimeout(
      `https://api.jup.ag/price/v2?ids=${mint}&showExtraInfo=true`,
      {},
      6000
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data?.data?.[mint] ?? null;
  } catch {
    return null;
  }
}

// ── DexScreener Price (fallback) ─────────────────────────────────
async function getDexScreenerPrice(mint: string): Promise<number | null> {
  try {
    const res = await fetchWithTimeout(
      `https://api.dexscreener.com/latest/dex/tokens/${mint}`,
      {},
      6000
    );
    if (!res.ok) return null;
    const data = await res.json() as { pairs?: Array<{ priceUsd?: string; liquidity?: { usd?: number } }> };
    // Pick the most liquid pair
    const pairs = (data?.pairs ?? [])
      .filter(p => p.priceUsd && parseFloat(p.priceUsd) > 0)
      .sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0));
    const best = pairs[0];
    return best?.priceUsd ? parseFloat(best.priceUsd) : null;
  } catch {
    return null;
  }
}

// ── Pump.fun Bonding Curve Data ──────────────────────────────────
async function getPumpFunData(mint: string): Promise<{ price: number | null; name?: string; symbol?: string; imageUri?: string } | null> {
  try {
    const res = await fetchWithTimeout(`https://frontend-api.pump.fun/coins/${mint}`, {}, 5000);
    if (!res.ok) return null;
    const d = await res.json() as {
      name?: string; symbol?: string; image_uri?: string;
      usd_market_cap?: number; virtual_sol_reserves?: number;
      virtual_token_reserves?: number; complete?: boolean;
    };
    // If token has graduated from bonding curve, DexScreener has better data
    if (d.complete) return { price: null, name: d.name, symbol: d.symbol, imageUri: d.image_uri };
    // Bonding curve price: sol_reserves / token_reserves * SOL_price
    // virtual_sol_reserves is in lamports (1e9), virtual_token_reserves in micro-tokens (1e6)
    let price: number | null = null;
    if (d.usd_market_cap && d.virtual_token_reserves && d.virtual_token_reserves > 0) {
      // 1B total supply, market cap approach
      price = d.usd_market_cap / 1_000_000_000;
    }
    return { price, name: d.name, symbol: d.symbol, imageUri: d.image_uri };
  } catch { return null; }
}

// ── Jupiter Token Metadata ───────────────────────────────────────
async function getJupiterTokenInfo(mint: string) {
  try {
    const res = await fetchWithTimeout(`https://tokens.jup.ag/token/${mint}`, {}, 6000);
    if (!res.ok) return null;
    const data = await res.json();
    return data ?? null;
  } catch {
    return null;
  }
}

// ── Helius Token Metadata (DAS) ──────────────────────────────────
async function getHeliusMetadata(mint: string) {
  try {
    const res = await fetchWithTimeout(HELIUS_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1,
        method: "getAsset",
        params: { id: mint },
      }),
    }, 6000);
    const data = await res.json();
    return data?.result ?? null;
  } catch {
    return null;
  }
}

// ── Security Score Calculator ────────────────────────────────────
function calcSecurityScore(gp: Record<string, string> | null): {
  score: number;
  risks: string[];
  positives: string[];
} {
  if (!gp) return { score: 50, risks: ["无法获取安全数据"], positives: [] };

  let score = 100;
  const risks: string[] = [];
  const positives: string[] = [];

  // Mint authority
  if (gp.mintable === "1") {
    score -= 25;
    risks.push("🔴 合约含增发权限（Mintable）— 可无限增发代币");
  } else {
    positives.push("✅ 无增发权限，供应量固定");
  }

  // Freeze authority
  if (gp.freezable === "1") {
    score -= 20;
    risks.push("🔴 合约含冻结权限（Freezable）— 可冻结用户账户");
  } else {
    positives.push("✅ 无冻结权限");
  }

  // Holder concentration
  const topHolderPct = parseFloat(gp.top10_holder_percent ?? "0") * 100;
  if (topHolderPct > 80) {
    score -= 25;
    risks.push(`🔴 前10持币地址占 ${topHolderPct.toFixed(1)}%，高度集中`);
  } else if (topHolderPct > 50) {
    score -= 10;
    risks.push(`⚠️ 前10持币地址占 ${topHolderPct.toFixed(1)}%，较为集中`);
  } else if (topHolderPct > 0) {
    positives.push(`✅ 前10持币分散（${topHolderPct.toFixed(1)}%）`);
  }

  // Creator holding
  const creatorPct = parseFloat(gp.creator_percentage ?? "0") * 100;
  if (creatorPct > 20) {
    score -= 15;
    risks.push(`🔴 创建者持仓 ${creatorPct.toFixed(1)}%，抛压风险高`);
  } else if (creatorPct > 5) {
    risks.push(`⚠️ 创建者持仓 ${creatorPct.toFixed(1)}%`);
  } else if (creatorPct >= 0) {
    positives.push("✅ 创建者持仓比例低");
  }

  // Rug pull / honeypot
  if (gp.is_honeypot === "1") {
    score -= 40;
    risks.push("🚨 检测到 Honeypot（蜜罐骗局）— 无法卖出");
  }

  score = Math.max(0, Math.min(100, score));
  return { score, risks, positives };
}

// ── Decision Generator ───────────────────────────────────────────
function generateDecision(
  secScore: number,
  price: number | null,
  walletRiskyPct: number,
): {
  verdict: "buy" | "caution" | "avoid";
  label: string;
  reason: string;
  suggestion: string;
} {
  if (secScore < 40) {
    return {
      verdict: "avoid",
      label: "建议回避",
      reason: "安全评分过低，存在严重合约风险",
      suggestion: "该代币具有高风险合约特征，不建议买入。",
    };
  }

  if (secScore < 65) {
    return {
      verdict: "caution",
      label: "谨慎操作",
      reason: "存在潜在风险信号，需谨慎",
      suggestion: `如果决定买入，建议仓位控制在总资产的 3-5%，并设置 -30% 止损。`,
    };
  }

  // High score
  let positionAdvice = "建议仓位不超过总资产的 10%。";
  if (walletRiskyPct > 60) {
    positionAdvice = `⚠️ 你的钱包中 Meme/未知代币已占 ${walletRiskyPct.toFixed(0)}%，风险已过度集中。建议最多投入总资产的 3%。`;
  } else if (walletRiskyPct > 30) {
    positionAdvice = `你的钱包风险代币占 ${walletRiskyPct.toFixed(0)}%，建议仓位控制在 5-8%。`;
  }

  return {
    verdict: "buy",
    label: "可以考虑",
    reason: "安全评分良好，合约风险较低",
    suggestion: positionAdvice,
  };
}

// ── Main Handler ─────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const mint = req.nextUrl.searchParams.get("mint");
  const wallet = req.nextUrl.searchParams.get("wallet");

  if (!mint) return NextResponse.json({ error: "Missing mint address" }, { status: 400 });
  if (!isValidSolanaAddress(mint)) return NextResponse.json({ error: "Invalid mint address" }, { status: 400 });
  if (wallet && !isValidSolanaAddress(wallet)) return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });

  // Parallel fetch
  const isPumpFun = mint.endsWith("pump");
  const [gp, jupPrice, jupToken, heliusMeta, pumpData] = await Promise.all([
    getGoPlus(mint),
    getJupiterPrice(mint),
    getJupiterTokenInfo(mint),
    getHeliusMetadata(mint),
    isPumpFun ? getPumpFunData(mint) : Promise.resolve(null),
  ]);

  // Token name/symbol
  const name =
    jupToken?.name ??
    heliusMeta?.content?.metadata?.name ??
    heliusMeta?.token_info?.symbol ??
    pumpData?.name ??
    "Unknown Token";
  const symbol =
    jupToken?.symbol ??
    heliusMeta?.content?.metadata?.symbol ??
    pumpData?.symbol ??
    mint.slice(0, 6) + "...";
  const logoURI = jupToken?.logoURI ?? pumpData?.imageUri ?? null;

  // Price — Jupiter first, DexScreener fallback, Pump.fun bonding curve last
  let price: number | null = jupPrice?.price ? parseFloat(jupPrice.price) : null;
  if (price === null) price = await getDexScreenerPrice(mint);
  if (price === null && isPumpFun) price = pumpData?.price ?? null;

  // Security
  const { score: secScore, risks, positives } = calcSecurityScore(gp);

  // Holder info
  const holderCount = gp?.holder_count ? parseInt(gp.holder_count) : null;
  const top10Pct = gp?.top10_holder_percent
    ? (parseFloat(gp.top10_holder_percent) * 100).toFixed(1)
    : null;

  // Wallet risky % (for position advice)
  let walletRiskyPct = 0;
  if (wallet) {
    try {
      const wRes = await fetch(
        `${req.nextUrl.origin}/api/wallet?address=${wallet}`
      );
      const wData = await wRes.json();
      if (wData?.totalUSD > 0) {
        const riskyUSD = wData.tokens
          .filter((t: { type: string; usdValue: number | null }) =>
            t.type === "meme" || t.type === "unknown"
          )
          .reduce((s: number, t: { usdValue: number | null }) => s + (t.usdValue ?? 0), 0);
        walletRiskyPct = (riskyUSD / wData.totalUSD) * 100;
      }
    } catch { /* ignore */ }
  }

  const decision = generateDecision(secScore, price, walletRiskyPct);

  return NextResponse.json({
    mint,
    name,
    symbol,
    logoURI,
    price,
    securityScore: secScore,
    risks,
    positives,
    holderCount,
    top10HolderPct: top10Pct,
    mintable: gp?.mintable === "1",
    freezable: gp?.freezable === "1",
    isHoneypot: gp?.is_honeypot === "1",
    decision,
    walletRiskyPct,
  });
}
