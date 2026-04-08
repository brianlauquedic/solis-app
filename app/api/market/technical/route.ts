/**
 * Technical Analysis API — 技术分析接口
 *
 * GET /api/market/technical?symbol=SOL
 * GET /api/market/technical?symbol=BONK&mint=DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263
 *
 * Data Sources:
 *   - SOL + 主流代币: CoinGecko 免费 API（日线 OHLC + 成交量）
 *   - Solana SPL 代币: GMGN API（免費）+ DexScreener token info（免費）
 *
 * Returns:
 *   ConfluenceResult — 六维技术分析合流结论（MACD/RSI/BB/OBV/Fib/Elliott）
 */

import { NextRequest, NextResponse } from "next/server";
import { analyzeConfluence, type OHLCV, type ConfluenceResult } from "@/lib/technical-analysis";
import { isValidSolanaAddress } from "@/lib/rate-limit";

const COINGECKO_KEY = process.env.COINGECKO_API_KEY ?? "";  // optional Pro key
const GMGN_BASE    = process.env.GMGN_HOST ?? "https://openapi.gmgn.ai";
const GMGN_API_KEY = process.env.GMGN_API_KEY ?? "gmgn_solbscbaseethmonadtron";

// ── CoinGecko ID mapping for common Solana tokens ────────────────────────────
const COINGECKO_IDS: Record<string, string> = {
  SOL:   "solana",
  WSOL:  "solana",
  BTC:   "bitcoin",
  ETH:   "ethereum",
  USDC:  "usd-coin",
  USDT:  "tether",
  BONK:  "bonk",
  WIF:   "dogwifcoin",
  JUP:   "jupiter-exchange-solana",
  PYTH:  "pyth-network",
  JITO:  "jito-governance-token",
  RAY:   "raydium",
  ORCA:  "orca",
  MSOL:  "msol",
  JSOL:  "jpool-sol",
  BSOL:  "blazestake-staked-sol",
  RENDER:"render-token",
  HNT:   "helium",
  MOBILE:"helium-mobile",
  IOT:   "helium-iot",
  DRIFT: "drift-protocol",
  MNGO:  "mango-markets",
};

// ── Fetch OHLCV from CoinGecko (daily candles, 90 days) ──────────────────────

async function fetchCoinGeckoOHLCV(coinId: string): Promise<OHLCV[]> {
  const cgBase  = "https://api.coingecko.com/api/v3";
  const headers: Record<string, string> = COINGECKO_KEY
    ? { "x-cg-pro-api-key": COINGECKO_KEY }
    : {};

  // Fetch OHLC (returns [timestamp_ms, open, high, low, close])
  const ohlcUrl   = `${cgBase}/coins/${coinId}/ohlc?vs_currency=usd&days=90`;
  const chartUrl  = `${cgBase}/coins/${coinId}/market_chart?vs_currency=usd&days=90&interval=daily`;

  const [ohlcRes, chartRes] = await Promise.all([
    fetch(ohlcUrl,  { headers, next: { revalidate: 300 } }),
    fetch(chartUrl, { headers, next: { revalidate: 300 } }),
  ]);

  if (!ohlcRes.ok) {
    throw new Error(`CoinGecko OHLC error: ${ohlcRes.status} for ${coinId}`);
  }

  const ohlcRaw: [number, number, number, number, number][] = await ohlcRes.json();

  // Volume comes from market_chart (array of [timestamp_ms, volume_usd])
  let volumeMap = new Map<number, number>();
  if (chartRes.ok) {
    const chartData = await chartRes.json() as {
      total_volumes?: [number, number][];
    };
    for (const [ts, vol] of (chartData.total_volumes ?? [])) {
      // Round timestamp to nearest day-bucket to align with OHLC
      const dayKey = Math.round(ts / 86_400_000) * 86_400_000;
      volumeMap.set(dayKey, vol);
    }
  }

  const candles: OHLCV[] = ohlcRaw.map(([ts, open, high, low, close]) => {
    const dayKey = Math.round(ts / 86_400_000) * 86_400_000;
    return {
      timestamp: ts,
      open,
      high,
      low,
      close,
      volume: volumeMap.get(dayKey) ?? volumeMap.get(dayKey - 86_400_000) ?? 0,
    };
  });

  // Sort oldest → newest (CoinGecko already does this, but be safe)
  candles.sort((a, b) => a.timestamp - b.timestamp);
  return candles;
}

// ── Fetch OHLCV from GMGN (hourly candles, last 200) — free, no key needed ───

async function fetchGmgnOHLCV(mint: string): Promise<OHLCV[]> {
  const limit = 200;
  const nowS  = Math.floor(Date.now() / 1000);
  const fromMs = (nowS - limit * 3600) * 1000;
  const toMs   = nowS * 1000;

  const url = new URL(`${GMGN_BASE}/v1/market/token_kline`);
  url.searchParams.set("chain",      "sol");
  url.searchParams.set("address",    mint);
  url.searchParams.set("resolution", "1h");
  url.searchParams.set("from",       String(fromMs));
  url.searchParams.set("to",         String(toMs));
  url.searchParams.set("timestamp",  String(nowS));
  url.searchParams.set("client_id",  crypto.randomUUID());

  const res = await fetch(url.toString(), {
    headers: { "X-APIKEY": GMGN_API_KEY, "Accept": "application/json" },
    signal: AbortSignal.timeout(8000),
    next: { revalidate: 300 },
  });

  if (!res.ok) throw new Error(`GMGN OHLCV error: ${res.status} for ${mint}`);

  const raw = await res.json();
  const list: unknown[] = Array.isArray(raw?.data?.list)
    ? raw.data.list : Array.isArray(raw?.data) ? raw.data : [];

  const candles: OHLCV[] = list.map((c: unknown) => {
    const item = c as Record<string, number>;
    const ts = Number(item.time ?? item.t ?? item.timestamp);
    return {
      timestamp: ts > 1e12 ? ts : ts * 1000,
      open:   Number(item.open  ?? item.o),
      high:   Number(item.high  ?? item.h),
      low:    Number(item.low   ?? item.l),
      close:  Number(item.close ?? item.c),
      volume: Number(item.volume ?? item.v ?? 0),
    };
  }).filter(c => c.timestamp && c.open && c.close);

  candles.sort((a, b) => a.timestamp - b.timestamp);
  return candles;
}

// ── Fetch token info from DexScreener (free, no key needed) ──────────────────

async function fetchDexScreenerTokenInfo(mint: string): Promise<{ symbol: string; name: string; price: number } | null> {
  const url = `https://api.dexscreener.com/latest/dex/tokens/${mint}`;
  const res = await fetch(url, { next: { revalidate: 300 }, signal: AbortSignal.timeout(5000) });
  if (!res.ok) return null;

  type DexPair = { baseToken?: { symbol?: string; name?: string }; priceUsd?: string };
  const json = await res.json() as { pairs?: DexPair[] };
  const pair = json?.pairs?.[0];
  if (!pair) return null;

  return {
    symbol: pair.baseToken?.symbol ?? "UNKNOWN",
    name:   pair.baseToken?.name ?? "",
    price:  parseFloat(pair.priceUsd ?? "0") || 0,
  };
}

// ── Demo OHLCV generator (when no API keys, for development) ────────────────

function generateDemoOHLCV(basePrice: number, periods = 90): OHLCV[] {
  const candles: OHLCV[] = [];
  let price = basePrice;
  const now = Date.now();

  for (let i = periods - 1; i >= 0; i--) {
    const ts     = now - i * 86_400_000;
    const drift  = (Math.random() - 0.48) * 0.03;
    const vol    = (0.015 + Math.random() * 0.025) * price;
    const open   = price;
    price       *= (1 + drift);
    const high   = Math.max(open, price) + Math.random() * vol * 0.4;
    const low    = Math.min(open, price) - Math.random() * vol * 0.4;
    const close  = price;
    const volume = (1e6 + Math.random() * 9e6) * basePrice;

    candles.push({ timestamp: ts, open, high, low, close, volume });
  }
  return candles;
}

// ── Main Route ───────────────────────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(req.url);
  const symbol = (searchParams.get("symbol") ?? "SOL").toUpperCase().trim();
  const mint   = searchParams.get("mint") ?? "";

  let ohlcv: OHLCV[];
  let tokenName = symbol;
  let currentPrice = 0;
  let source: "coingecko" | "gmgn" | "demo" = "coingecko";

  try {
    // ── Path 1: Known token with CoinGecko ID ───────────────────────
    const cgId = COINGECKO_IDS[symbol];
    if (cgId) {
      ohlcv  = await fetchCoinGeckoOHLCV(cgId);
      source = "coingecko";
      currentPrice = ohlcv[ohlcv.length - 1]?.close ?? 0;

    // ── Path 2: Unknown Solana SPL token (by mint) — use GMGN + DexScreener ──
    } else if (mint && isValidSolanaAddress(mint)) {
      const [candles, info] = await Promise.all([
        fetchGmgnOHLCV(mint),
        fetchDexScreenerTokenInfo(mint),
      ]);
      ohlcv = candles;
      source = "gmgn";
      if (info) {
        tokenName    = info.symbol || symbol;
        currentPrice = info.price;
      } else {
        currentPrice = ohlcv[ohlcv.length - 1]?.close ?? 0;
      }

    // ── Path 3: Demo mode (development without API keys) ────────────
    } else {
      const demoPrice = symbol === "SOL" ? 148 : symbol === "BTC" ? 82000 : 1;
      ohlcv  = generateDemoOHLCV(demoPrice);
      source = "demo";
      currentPrice = ohlcv[ohlcv.length - 1]?.close ?? demoPrice;
    }

    if (ohlcv.length < 35) {
      return NextResponse.json(
        { error: "Insufficient price data", candles: ohlcv.length, minimum: 35 },
        { status: 422 }
      );
    }

    // ── Run full confluence analysis ─────────────────────────────────
    const result: ConfluenceResult = analyzeConfluence(ohlcv);

    return NextResponse.json({
      symbol:       tokenName,
      mint:         mint || null,
      source,
      currentPrice,
      candleCount:  ohlcv.length,
      analysis:     result,
      generatedAt:  Date.now(),
    }, {
      headers: {
        // Cache 5 min on CDN, stale-while-revalidate 1 min
        "Cache-Control": "public, s-maxage=300, stale-while-revalidate=60",
      },
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : "Technical analysis failed";

    // Graceful fallback: if API key missing, return demo analysis
    if (msg.includes("GMGN") || msg.includes("upstream")) {
      const demoPrice = 1;
      ohlcv = generateDemoOHLCV(demoPrice, 90);
      const result = analyzeConfluence(ohlcv);
      return NextResponse.json({
        symbol:       tokenName,
        mint:         mint || null,
        source:       "demo",
        currentPrice: ohlcv[ohlcv.length - 1]?.close ?? demoPrice,
        candleCount:  ohlcv.length,
        analysis:     result,
        generatedAt:  Date.now(),
        warning:      "Demo data used — GMGN unavailable",
      });
    }

    console.error("[technical/route] Error:", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
