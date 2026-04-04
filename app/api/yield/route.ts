import { NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { createReadOnlyAgent, SOL_MINT } from "@/lib/agent";

function fetchWithTimeout(url: string, opts: RequestInit = {}, ms = 6000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

interface YieldOpportunity {
  protocol: string;
  icon: string;
  action: string;
  apy: number;
  apyDisplay: string;
  url: string;
  color: string;
  riskLevel: "低" | "中" | "高";
  category: "stake" | "lend" | "lp";
  detail: string;
}

async function fetchMarinadeAPY(): Promise<number> {
  try {
    const res = await fetchWithTimeout("https://api.marinade.finance/msol/apy/30d", {
      next: { revalidate: 300 },
    } as RequestInit);
    if (!res.ok) return 7.2;
    const data = await res.json();
    // Returns a number like 0.0721
    return typeof data === "number" ? data * 100 : 7.2;
  } catch {
    return 7.2;
  }
}

async function fetchJitoAPY(): Promise<number> {
  try {
    const res = await fetchWithTimeout("https://kv-cache.jito.network/api/v1/jitoSOL/apy", {
      next: { revalidate: 300 },
    } as RequestInit);
    if (!res.ok) return 7.5;
    const data = await res.json();
    // Response: { value: 0.0749... }
    const val = data?.value ?? data?.apy ?? data;
    return typeof val === "number" ? val * 100 : 7.5;
  } catch {
    return 7.5;
  }
}

async function fetchKaminoUSDCAPY(): Promise<number> {
  try {
    const res = await fetchWithTimeout(
      "https://api.kamino.finance/strategies/metrics?env=mainnet-beta&status=ACTIVE",
      { next: { revalidate: 300 } } as RequestInit
    );
    if (!res.ok) return 8.2;
    const data = await res.json();
    // Find USDC lending strategy
    const usdcStrategy = Array.isArray(data)
      ? data.find((s: { tokenSymbol?: string; apy?: number }) =>
          s.tokenSymbol === "USDC" || s.tokenSymbol === "USD Coin"
        )
      : null;
    const apy = usdcStrategy?.apy;
    return typeof apy === "number" && apy > 0 ? apy * 100 : 8.2;
  } catch {
    return 8.2;
  }
}

async function fetchRaydiumAPY(): Promise<number> {
  try {
    // Raydium SOL-USDC CLMM pool fee APR via their public API
    const res = await fetchWithTimeout(
      "https://api.raydium.io/v2/ammV3/ammPools",
      { next: { revalidate: 300 } } as RequestInit
    );
    if (!res.ok) throw new Error("raydium api error");
    const data = await res.json();
    const pools: Array<{ mintA?: { symbol?: string }; mintB?: { symbol?: string }; day?: { apr?: number } }> =
      data?.data ?? [];
    // Find SOL-USDC pool with highest liquidity
    const solUsdcPool = pools.find(
      p =>
        ((p.mintA?.symbol === "SOL" && p.mintB?.symbol === "USDC") ||
         (p.mintA?.symbol === "USDC" && p.mintB?.symbol === "SOL")) &&
        typeof p.day?.apr === "number"
    );
    const apr = solUsdcPool?.day?.apr;
    if (typeof apr === "number" && apr > 0 && apr < 500) return apr;
    return 22;
  } catch {
    return 22;
  }
}

async function fetchSolendAPY(): Promise<number> {
  try {
    const res = await fetchWithTimeout(
      "https://api.save.finance/v1/markets",
      { next: { revalidate: 300 } } as RequestInit
    );
    if (!res.ok) return 5.5;
    const data = await res.json();
    const usdcReserve = Array.isArray(data?.result?.reserves)
      ? data.result.reserves.find((r: { symbol?: string; supplyInterest?: number }) =>
          r.symbol === "USDC"
        )
      : null;
    const apy = usdcReserve?.supplyInterest;
    return typeof apy === "number" && apy > 0 ? apy : 5.5;
  } catch {
    return 5.5;
  }
}

async function fetchSolPriceFromAgentKit(): Promise<number | null> {
  try {
    // Use shared createReadOnlyAgent() from /lib/agent.ts (TokenPlugin + DefiPlugin + MiscPlugin)
    const agent = createReadOnlyAgent();
    const priceStr = await agent.methods.fetchPrice(SOL_MINT as PublicKey);
    const price = parseFloat(priceStr as string);
    return !isNaN(price) && price > 0 ? price : null;
  } catch {
    return null;
  }
}

async function fetchSolPriceFromCoinGecko(): Promise<number | null> {
  try {
    const res = await fetchWithTimeout(
      "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd",
      { next: { revalidate: 60 } } as RequestInit
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data?.solana?.usd ?? null;
  } catch {
    return null;
  }
}

export async function GET() {
  // Use Agent Kit for SOL price cross-validation
  const [agentKitPrice, geckoPrice] = await Promise.all([
    fetchSolPriceFromAgentKit(),
    fetchSolPriceFromCoinGecko(),
  ]);

  let solPrice: number | null = null;
  if (agentKitPrice && geckoPrice) {
    const deviation = Math.abs(agentKitPrice - geckoPrice) / geckoPrice;
    // If prices diverge > 2%, average them and log the discrepancy
    solPrice = deviation > 0.02
      ? (agentKitPrice + geckoPrice) / 2
      : agentKitPrice;
    if (deviation > 0.02) {
      console.warn(`[yield] SOL price deviation ${(deviation * 100).toFixed(1)}%: AgentKit=${agentKitPrice}, CoinGecko=${geckoPrice}, using avg=${solPrice}`);
    }
  } else {
    solPrice = agentKitPrice ?? geckoPrice ?? null;
  }

  // Fetch all APYs in parallel
  const [marinadeAPY, jitoAPY, kaminoAPY, solendAPY, raydiumAPY] = await Promise.all([
    fetchMarinadeAPY(),
    fetchJitoAPY(),
    fetchKaminoUSDCAPY(),
    fetchSolendAPY(),
    fetchRaydiumAPY(),
  ]);

  const opportunities: YieldOpportunity[] = [
    {
      protocol: "Marinade Finance",
      icon: "🫙",
      action: "质押 SOL → mSOL",
      apy: marinadeAPY,
      apyDisplay: `${marinadeAPY.toFixed(1)}%`,
      url: "https://marinade.finance/",
      color: "#8B5CF6",
      riskLevel: "低",
      category: "stake",
      detail: "流动性质押，mSOL 可继续用于 DeFi",
    },
    {
      protocol: "Jito",
      icon: "⚡",
      action: "质押 SOL → jitoSOL",
      apy: jitoAPY,
      apyDisplay: `${jitoAPY.toFixed(1)}%`,
      url: "https://www.jito.network/staking/",
      color: "#06B6D4",
      riskLevel: "低",
      category: "stake",
      detail: "含 MEV 奖励，APY 略高于纯质押",
    },
    {
      protocol: "Kamino Finance",
      icon: "🌿",
      action: "存入 USDC 自动复利",
      apy: kaminoAPY,
      apyDisplay: `${kaminoAPY.toFixed(1)}%`,
      url: "https://app.kamino.finance/",
      color: "#10B981",
      riskLevel: "低",
      category: "lend",
      detail: "USDC 借贷，自动复利，利率随市场波动",
    },
    {
      protocol: "Save (Solend)",
      icon: "🏦",
      action: "存入 USDC 获取利息",
      apy: solendAPY,
      apyDisplay: `${solendAPY.toFixed(1)}%`,
      url: "https://save.finance/",
      color: "#3B82F6",
      riskLevel: "低",
      category: "lend",
      detail: "Solana 最老牌借贷协议，多次审计",
    },
    {
      protocol: "Raydium CLMM",
      icon: "🌊",
      action: "SOL-USDC 集中流动性",
      apy: raydiumAPY,
      apyDisplay: `${raydiumAPY.toFixed(1)}%`,
      url: "https://raydium.io/liquidity/",
      color: "#F59E0B",
      riskLevel: "中",
      category: "lp",
      detail: "集中流动性做市，手续费收益高但有无常损失风险",
    },
  ];

  // Sort by APY descending within same risk level
  opportunities.sort((a, b) => {
    const riskOrder = { 低: 0, 中: 1, 高: 2 };
    if (riskOrder[a.riskLevel] !== riskOrder[b.riskLevel])
      return riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
    return b.apy - a.apy;
  });

  return NextResponse.json({
    opportunities,
    solPrice,
    source: "solana-agent-kit + live protocol APIs",
    updatedAt: Date.now(),
  });
}
