import { NextResponse } from "next/server";

export const runtime = "edge";
export const revalidate = 300; // cache 5 min

async function fetchWithTimeout(url: string, ms = 6000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { signal: controller.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

export async function GET() {
  const [solPrice, llamaChains, llamaDex, llamaFees, voteAccounts] = await Promise.allSettled([
    // 1. SOL price + 24h change
    fetchWithTimeout(
      "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd&include_24hr_change=true"
    ).then(r => r.json()),

    // 2. DeFiLlama — all chains TVL (filter Solana)
    fetchWithTimeout("https://api.llama.fi/v2/chains").then(r => r.json()),

    // 3. DeFiLlama — Jupiter DEX 7d volume
    fetchWithTimeout(
      "https://api.llama.fi/summary/dexs/Jupiter?excludeTotalDataChartBreakdown=true&excludeTotalDataChart=true&dataType=dailyVolume"
    ).then(r => r.json()),

    // 4. DeFiLlama — Solana protocol fees (7d)
    fetchWithTimeout(
      "https://api.llama.fi/overview/fees/solana?excludeTotalDataChartBreakdown=true&excludeTotalDataChart=true&dataType=dailyFees"
    ).then(r => r.json()),

    // 5. Solana mainnet RPC — vote accounts for validator count
    fetchWithTimeout("https://api.mainnet-beta.solana.com", 8000).then(r =>
      r.json().catch(() => null)
    ).catch(() => null),
  ]);

  // ── Parse SOL price ──
  let solUsd: number | null = null;
  let solChange24h: number | null = null;
  if (solPrice.status === "fulfilled" && solPrice.value?.solana) {
    solUsd = solPrice.value.solana.usd ?? null;
    solChange24h = solPrice.value.solana.usd_24h_change ?? null;
  }

  // ── Parse Solana TVL from DeFiLlama chains ──
  let solanaTvl: number | null = null;
  if (llamaChains.status === "fulfilled" && Array.isArray(llamaChains.value)) {
    const sol = (llamaChains.value as Array<{ name: string; tvl: number }>).find(
      c => c.name === "Solana"
    );
    solanaTvl = sol?.tvl ?? null;
  }

  // ── Parse Jupiter 7d volume ──
  let jupiterVolume7d: number | null = null;
  if (llamaDex.status === "fulfilled" && llamaDex.value) {
    const d = llamaDex.value as { total7d?: number; totalVolume?: number };
    jupiterVolume7d = d.total7d ?? d.totalVolume ?? null;
  }

  // ── Parse Solana protocol fees 7d ──
  let fees7d: number | null = null;
  if (llamaFees.status === "fulfilled" && llamaFees.value) {
    const d = llamaFees.value as { total7d?: number };
    fees7d = d.total7d ?? null;
  }

  // ── Validator count: fetch separately with POST ──
  let validatorCount: number | null = null;
  try {
    const rpcRes = await fetchWithTimeout("https://api.mainnet-beta.solana.com", 8000);
    // We need a POST for getVoteAccounts
    const rpcBody = await fetch("https://api.mainnet-beta.solana.com", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getVoteAccounts", params: [{ commitment: "confirmed" }] }),
    }).then(r => r.json()).catch(() => null);

    if (rpcBody?.result?.current) {
      validatorCount = rpcBody.result.current.length + (rpcBody.result.delinquent?.length ?? 0);
    }
  } catch { /* ignore */ }

  // ── Format helpers ──
  function fmtUsd(n: number): string {
    if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
    if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
    if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
    return `$${n.toFixed(2)}`;
  }
  function fmtPct(n: number): string {
    return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
  }

  return NextResponse.json({
    solanaTvl:   solanaTvl   ? fmtUsd(solanaTvl)      : null,
    solPrice:    solUsd      ? `$${solUsd.toFixed(1)}` : null,
    solChange:   solChange24h ? fmtPct(solChange24h)   : null,
    jupVol7d:    jupiterVolume7d ? fmtUsd(jupiterVolume7d) : null,
    fees7d:      fees7d      ? fmtUsd(fees7d)          : null,
    validators:  validatorCount ? validatorCount.toLocaleString() : null,
    updatedAt:   new Date().toISOString(),
  });
}
