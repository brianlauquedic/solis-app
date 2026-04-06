import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const revalidate = 300; // cache 5 min

const UA = "Mozilla/5.0 (compatible; SakuraBot/1.0)";

async function get(url: string, ms = 8000): Promise<unknown> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { "User-Agent": UA } });
    return res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(id);
  }
}

async function rpc(method: string, params: unknown[] = [], ms = 10000): Promise<unknown> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch("https://api.mainnet-beta.solana.com", {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": UA },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: controller.signal,
    });
    const d = await res.json() as { result?: unknown };
    return d?.result ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(id);
  }
}

function fmtUsd(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}
function fmtPct(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

export async function GET() {
  // ── Parallel fetches ─────────────────────────────────────────────────────────
  const [
    solPriceRaw, solChangeRaw,
    llamaChains, llamaDexSolana, llamaFees,
    protocolTvls,
    tpsRaw, clusterNodesRaw,
    epochInfoRaw, voteAccountsRaw, supplyRaw,
    lstYieldsRaw,
    kaminoLendRaw,
  ] = await Promise.all([
    // SOL price (DeFiLlama coins — works through proxy)
    get("https://coins.llama.fi/prices/current/coingecko:solana?searchWidth=4h"),
    get(`https://coins.llama.fi/percentage/coingecko:solana?timestamp=${Math.floor(Date.now() / 1000)}&lookForward=false&period=24h`),

    // Solana chain TVL
    get("https://api.llama.fi/v2/chains"),

    // Solana DEX overview (7d volume)
    get("https://api.llama.fi/overview/dexs/solana?excludeTotalDataChartBreakdown=true&excludeTotalDataChart=true&dataType=dailyVolume"),

    // Solana protocol fees (7d)
    get("https://api.llama.fi/overview/fees/solana?excludeTotalDataChartBreakdown=true&excludeTotalDataChart=true&dataType=dailyFees"),

    // Individual protocol TVLs
    Promise.all([
      get("https://api.llama.fi/tvl/kamino"),
      get("https://api.llama.fi/tvl/jito"),
      get("https://api.llama.fi/tvl/raydium"),
      get("https://api.llama.fi/tvl/marinade"),
      get("https://api.llama.fi/tvl/meteora"),
      get("https://api.llama.fi/tvl/orca"),
      get("https://api.llama.fi/tvl/drift"),
      get("https://api.llama.fi/tvl/jupiter"),
    ]),

    // TPS via getRecentPerformanceSamples
    rpc("getRecentPerformanceSamples", [60]),

    // Cluster node count
    rpc("getClusterNodes"),

    // Epoch info
    rpc("getEpochInfo"),

    // Vote accounts for staking ratio
    rpc("getVoteAccounts", [{ commitment: "finalized", keepUnstakedDelinquents: false }], 15000),

    // Total supply
    rpc("getSupply", [{ commitment: "finalized" }]),

    // LST yields (DeFiLlama yields — filtered server-side)
    get("https://yields.llama.fi/pools"),

    // Kamino lending rates
    get("https://yields.llama.fi/pools"),
  ]);

  // ── SOL price ─────────────────────────────────────────────────────────────────
  let solUsd: number | null = null;
  let solChange24h: number | null = null;
  try {
    const pd = solPriceRaw as { coins?: { "coingecko:solana"?: { price?: number } } };
    solUsd = pd?.coins?.["coingecko:solana"]?.price ?? null;
    const cd = solChangeRaw as { coins?: { "coingecko:solana"?: number } };
    solChange24h = cd?.coins?.["coingecko:solana"] ?? null;
  } catch { /* ignore */ }

  // ── Solana TVL ────────────────────────────────────────────────────────────────
  let solanaTvl: number | null = null;
  try {
    const chains = llamaChains as Array<{ name: string; tvl: number }>;
    solanaTvl = chains?.find(c => c.name === "Solana")?.tvl ?? null;
  } catch { /* ignore */ }

  // ── DEX 7d volume ─────────────────────────────────────────────────────────────
  let dexVol7d: number | null = null;
  try {
    const d = llamaDexSolana as { total7d?: number; total24h?: number };
    dexVol7d = d?.total7d ?? (d?.total24h ? d.total24h * 7 : null);
  } catch { /* ignore */ }

  // ── Protocol fees 7d ─────────────────────────────────────────────────────────
  let fees7d: number | null = null;
  try {
    const d = llamaFees as { total7d?: number };
    fees7d = d?.total7d ?? null;
  } catch { /* ignore */ }

  // ── Individual protocol TVLs ──────────────────────────────────────────────────
  const [kaminoTvl, jitoTvl, raydiumTvl, marinadeTvl, meteoraTvl, orcaTvl, driftTvl, jupiterTvl] =
    (protocolTvls as Array<unknown>).map(v => (typeof v === "number" ? v : null));

  // ── TPS ───────────────────────────────────────────────────────────────────────
  let tpsTotal: number | null = null;
  let tpsUser: number | null = null;
  let tpsPeak: number | null = null;
  let tpsUserPeak: number | null = null;
  try {
    const samples = tpsRaw as Array<{ numTransactions: number; numNonVoteTransactions: number; samplePeriodSecs: number }>;
    if (samples?.length) {
      const totals = samples.map(s => s.numTransactions / s.samplePeriodSecs);
      const users  = samples.map(s => s.numNonVoteTransactions / s.samplePeriodSecs);
      tpsTotal    = Math.round(totals.reduce((a, b) => a + b, 0) / totals.length);
      tpsUser     = Math.round(users.reduce((a, b) => a + b, 0) / users.length);
      tpsPeak     = Math.round(Math.max(...totals));
      tpsUserPeak = Math.round(Math.max(...users));
    }
  } catch { /* ignore */ }

  // ── Cluster nodes ─────────────────────────────────────────────────────────────
  let clusterNodes: number | null = null;
  try {
    const nodes = clusterNodesRaw as unknown[];
    clusterNodes = nodes?.length ?? null;
  } catch { /* ignore */ }

  // ── Epoch info ────────────────────────────────────────────────────────────────
  let epochInfo: { epoch: number; progress: number; slotsRemaining: number; hoursRemaining: number } | null = null;
  try {
    const ei = epochInfoRaw as { epoch: number; slotIndex: number; slotsInEpoch: number } | null;
    if (ei && ei.slotsInEpoch > 0) {
      const progress = Math.round((ei.slotIndex / ei.slotsInEpoch) * 100);
      const slotsRemaining = ei.slotsInEpoch - ei.slotIndex;
      const hoursRemaining = Math.round(slotsRemaining / 2 / 3600);
      epochInfo = { epoch: ei.epoch, progress, slotsRemaining, hoursRemaining };
    }
  } catch { /* ignore */ }

  // ── Staking ratio (getVoteAccounts + getSupply) ───────────────────────────────
  let stakingRatio: string | null = null;
  try {
    type VoteAccount = { activatedStake: number };
    type VoteAccountsResult = { current: VoteAccount[]; delinquent: VoteAccount[] };
    type SupplyResult = { value: { total: number } };

    const va = voteAccountsRaw as VoteAccountsResult | null;
    const sup = supplyRaw as SupplyResult | null;

    if (va && sup?.value?.total && sup.value.total > 0) {
      const totalStake = [
        ...(va.current ?? []),
        ...(va.delinquent ?? []),
      ].reduce((sum, v) => sum + (v.activatedStake ?? 0), 0);
      const pct = (totalStake / sup.value.total) * 100;
      if (pct > 30 && pct < 100) stakingRatio = `${pct.toFixed(1)}%`;
    }
  } catch { /* ignore */ }

  // ── LST yields (filter from yields pool data) ─────────────────────────────────
  type PoolRow = { project: string; symbol: string; tvlUsd: number; apy: number; chain: string };
  const lstMap: Record<string, { apy: string; tvl: string } | null> = {};
  try {
    const pools = (lstYieldsRaw as { data?: PoolRow[] })?.data ?? [];
    const solana = pools.filter(p => p.chain === "Solana");
    const lstTargets: Array<[string, string]> = [
      ["marinade-liquid-staking", "mSOL"],
      ["jito-liquid-staking",     "jitoSOL"],
      ["jupiter-staked-sol",      "JUPSOL"],
      ["binance-staked-sol",      "BNSOL"],
      ["phantom-sol",             "PSOL"],
    ];
    for (const [proj, key] of lstTargets) {
      const pool = solana.find(p => p.project === proj);
      if (pool) {
        lstMap[key] = {
          apy: `${pool.apy.toFixed(2)}%`,
          tvl: fmtUsd(pool.tvlUsd),
        };
      } else {
        lstMap[key] = null;
      }
    }
  } catch { /* ignore */ }

  // ── Kamino lending rates ──────────────────────────────────────────────────────
  const lendMap: Record<string, string | null> = {};
  try {
    const pools = (kaminoLendRaw as { data?: PoolRow[] })?.data ?? [];
    const kamino = pools.filter(p => p.project === "kamino-lend" && p.chain === "Solana");
    for (const asset of ["USDC", "SOL", "USDT"]) {
      const pool = kamino.find(p => p.symbol === asset);
      lendMap[`kamino_${asset.toLowerCase()}_supply`] = pool ? `${(pool.apy).toFixed(2)}%` : null;
    }
  } catch { /* ignore */ }

  return NextResponse.json({
    // Core
    solanaTvl:    solanaTvl    ? fmtUsd(solanaTvl)      : null,
    solPrice:     solUsd       ? `$${solUsd.toFixed(2)}` : null,
    solChange:    solChange24h  ? fmtPct(solChange24h)   : null,
    dexVol7d:     dexVol7d     ? fmtUsd(dexVol7d)        : null,
    fees7d:       fees7d       ? fmtUsd(fees7d)           : null,

    // Network
    tpsTotal:     tpsTotal     ? tpsTotal.toLocaleString()     : null,
    tpsUser:      tpsUser      ? tpsUser.toLocaleString()      : null,
    tpsPeak:      tpsPeak      ? tpsPeak.toLocaleString()      : null,
    tpsUserPeak:  tpsUserPeak  ? tpsUserPeak.toLocaleString()  : null,
    clusterNodes: clusterNodes ? clusterNodes.toLocaleString() : null,
    epochInfo,
    stakingRatio,

    // Protocol TVLs
    protocols: {
      kamino:   kaminoTvl  ? fmtUsd(kaminoTvl)  : null,
      jito:     jitoTvl    ? fmtUsd(jitoTvl)     : null,
      raydium:  raydiumTvl ? fmtUsd(raydiumTvl)  : null,
      marinade: marinadeTvl? fmtUsd(marinadeTvl) : null,
      meteora:  meteoraTvl ? fmtUsd(meteoraTvl)  : null,
      orca:     orcaTvl    ? fmtUsd(orcaTvl)      : null,
      drift:    driftTvl   ? fmtUsd(driftTvl)    : null,
      jupiter:  jupiterTvl ? fmtUsd(jupiterTvl)  : null,
    },

    // LST yields
    lst: lstMap,

    // Lending rates
    lending: lendMap,

    updatedAt: new Date().toISOString(),
  });
}
