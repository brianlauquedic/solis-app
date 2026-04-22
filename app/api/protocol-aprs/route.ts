/**
 * Protocol APR API
 * GET /api/protocol-aprs
 *
 * Returns live APR/APY data for the 4 龙头 protocols Sakura integrates with:
 *   - Kamino:       USDC supply APY + USDC borrow APY (main market)
 *   - Jupiter Lend: USDC supply APY (Earn vault)
 *   - Jito:         JitoSOL stake APY (LST)
 *   - Raydium:      no APR (swap fee surfaced as a flat label)
 *
 * Cached in Redis for 5 minutes. Falls back to last cached value, then
 * to conservative defaults if all live fetches fail.
 *
 * Runs on default Fluid Compute Node.js runtime — no edge restrictions
 * because we may need to spawn curl as a fallback for Cloudflare-fronted
 * APIs that block undici (same issue lib/adapters/raydium.ts had).
 */
import { NextResponse } from "next/server";
import { getRedisClient } from "@/lib/redis";

export const maxDuration = 30;

const CACHE_KEY = "sakura:protocol_aprs";
const CACHE_TTL = 300; // 5 minutes

interface ProtocolAprs {
  Kamino: { lendApy: number; borrowApy: number } | null;
  JupiterLend: { lendApy: number } | null;
  Jito: { stakeApy: number } | null;
  Raydium: { feePct: number } | null; // not an APR; surfaced as "fee" instead
  lastUpdated: string;
  source: "live" | "cached" | "fallback";
  cacheAge?: number;
}

const FALLBACK: Omit<ProtocolAprs, "lastUpdated" | "source" | "cacheAge"> = {
  Kamino: { lendApy: 8.4, borrowApy: 11.5 },
  JupiterLend: { lendApy: 9.1 },
  Jito: { stakeApy: 7.2 },
  Raydium: { feePct: 0.25 },
};

const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const KAMINO_MAIN_MARKET = "7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF";

/** Fetch JSON resilient to Node undici being CF-fingerprinted. */
async function fetchJsonResilient<T>(url: string, timeoutMs = 6000): Promise<T> {
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as T;
  } catch {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const req: any = eval("require");
    const { execFileSync } = req("child_process");
    const body = execFileSync(
      "curl",
      ["-sS", "--fail", "--max-time", "8", "-H", "Accept: application/json", url],
      { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }
    );
    return JSON.parse(body) as T;
  }
}

// ── Kamino ────────────────────────────────────────────────────────────
//
// Endpoint: /kamino-market/{market}/reserves/metrics
// Shape: array of { reserve, liquidityTokenMint, supplyApy, borrowApy, ... }
// supplyApy/borrowApy values are DECIMAL strings (e.g. "0.0554" = 5.54%);
// multiply by 100 to render as a percentage. Verified 2026-04-22 against
// the USDC reserve in the main market (95% utilisation → 5.5% supply,
// 7.2% borrow — sane lending-curve math).
interface KaminoReserveMetric {
  liquidityTokenMint?: string;
  liquidityToken?: string;
  supplyApy?: string | number;
  borrowApy?: string | number;
}
async function fetchKaminoUsdc(): Promise<{ lendApy: number; borrowApy: number } | null> {
  try {
    const metrics = await fetchJsonResilient<KaminoReserveMetric[]>(
      `https://api.kamino.finance/kamino-market/${KAMINO_MAIN_MARKET}/reserves/metrics`
    );
    if (!Array.isArray(metrics)) return null;
    const usdc = metrics.find((r) => r.liquidityTokenMint === USDC_MINT);
    if (!usdc) return null;
    return {
      lendApy: +(Number(usdc.supplyApy ?? 0) * 100).toFixed(2),
      borrowApy: +(Number(usdc.borrowApy ?? 0) * 100).toFixed(2),
    };
  } catch {
    return null;
  }
}

// ── Jupiter Lend ──────────────────────────────────────────────────────
//
// Endpoint: /lend/v1/earn/tokens
// Shape: array of { asset: { address, ... }, supplyRate, rewardsRate, totalRate }
// Rate values are basis-points ×100 (e.g. "425" = 4.25% APY).
interface JupiterEarnToken {
  asset?: { address?: string };
  totalRate?: string | number;
  supplyRate?: string | number;
  rewardsRate?: string | number;
}
async function fetchJupiterLendUsdc(): Promise<{ lendApy: number } | null> {
  try {
    const tokens = await fetchJsonResilient<JupiterEarnToken[]>(
      `https://lite-api.jup.ag/lend/v1/earn/tokens`
    );
    if (!Array.isArray(tokens)) return null;
    const usdc = tokens.find((t) => t.asset?.address === USDC_MINT);
    if (!usdc) return null;
    // totalRate = supplyRate + rewardsRate, all in bp×100 → divide by 100 for %
    const apy = Number(usdc.totalRate ?? usdc.supplyRate ?? 0) / 100;
    return { lendApy: +apy.toFixed(2) };
  } catch {
    return null;
  }
}

// ── Jito ──────────────────────────────────────────────────────────────
//
// Endpoint: kobe.mainnet.jito.network/api/v1/stake_pool_stats
// Shape: { apy: [{ data: 0.0568, date: "..." }, ...], tvl, ... }
// The `apy` field is an array of daily snapshots; `data` is decimal
// (0.0568 = 5.68% APY). Take the latest entry.
interface JitoStats {
  apy?: Array<{ data: number; date: string }>;
}
async function fetchJitoApy(): Promise<{ stakeApy: number } | null> {
  try {
    const stats = await fetchJsonResilient<JitoStats>(
      `https://kobe.mainnet.jito.network/api/v1/stake_pool_stats`,
      6000
    );
    const series = stats.apy;
    if (!Array.isArray(series) || series.length === 0) return null;
    const latest = series[series.length - 1];
    const pct = Number(latest.data ?? 0) * 100;
    if (!pct) return null;
    return { stakeApy: +pct.toFixed(2) };
  } catch {
    return null;
  }
}

export async function GET() {
  const redis = getRedisClient();

  // Serve from cache if fresh
  if (redis) {
    try {
      const cached = await redis.get<string>(CACHE_KEY);
      if (cached) {
        const data =
          typeof cached === "string"
            ? (JSON.parse(cached) as ProtocolAprs)
            : (cached as ProtocolAprs);
        const ageMs = Date.now() - new Date(data.lastUpdated).getTime();
        return NextResponse.json({
          ...data,
          source: "cached",
          cacheAge: Math.round(ageMs / 1000),
        });
      }
    } catch {
      /* ignore cache miss / parse errors */
    }
  }

  // Live fetch — all 4 in parallel; partial failures fall back to defaults
  const [kamino, jupiterLend, jito] = await Promise.all([
    fetchKaminoUsdc(),
    fetchJupiterLendUsdc(),
    fetchJitoApy(),
  ]);

  const result: ProtocolAprs = {
    Kamino: kamino ?? FALLBACK.Kamino,
    JupiterLend: jupiterLend ?? FALLBACK.JupiterLend,
    Jito: jito ?? FALLBACK.Jito,
    Raydium: FALLBACK.Raydium, // swap fee, not APR
    lastUpdated: new Date().toISOString(),
    source: kamino && jupiterLend && jito ? "live" : "fallback",
  };

  // Best-effort cache write
  if (redis) {
    try {
      await redis.set(CACHE_KEY, JSON.stringify(result), { ex: CACHE_TTL });
    } catch {
      /* ignore */
    }
  }

  return NextResponse.json(result);
}
