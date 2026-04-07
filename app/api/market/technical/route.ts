/**
 * Technical Analysis API — 技术分析接口
 *
 * GET /api/market/technical?symbol=SOL
 * GET /api/market/technical?symbol=BONK&mint=DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263
 *
 * Data Sources:
 *   - SOL + 主流代币: CoinGecko 免费 API（日线 OHLC + 成交量）
 *   - Solana SPL 代币: Birdeye API（需 BIRDEYE_API_KEY 环境变量）
 *
 * Returns:
 *   ConfluenceResult — 六维技术分析合流结论（MACD/RSI/BB/OBV/Fib/Elliott）
 */

import { NextRequest, NextResponse } from "next/server";
import { analyzeConfluence, type OHLCV, type ConfluenceResult } from "@/lib/technical-analysis";

const BIRDEYE_KEY   = process.env.BIRDEYE_API_KEY ?? "";
const COINGECKO_KEY = process.env.COINGECKO_API_KEY ?? "";  // optional Pro key

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

// ── Fetch OHLCV from Birdeye (hourly candles, last 200 candles) ──────────────

async function fetchBirdeyeOHLCV(mint: string): Promise<OHLCV[]> {
  if (!BIRDEYE_KEY) {
    throw new Error("BIRDEYE_API_KEY not configured — cannot fetch SPL token OHLCV");
  }

  // Birdeye OHLCV endpoint: /defi/ohlcv
  // type: 1H (1 hour), limit: 200 candles
  const now    = Math.floor(Date.now() / 1000);
  const from   = now - 200 * 3600;   // 200 hours back
  const url    = `https://public-api.birdeye.so/defi/ohlcv?address=${mint}&type=1H&time_from=${from}&time_to=${now}`;

  const res = await fetch(url, {
    headers: {
      "X-API-KEY": BIRDEYE_KEY,
      "x-chain":   "solana",
    },
    next: { revalidate: 300 },
  });

  if (!res.ok) {
    throw new Error(`Birdeye OHLCV error: ${res.status} for ${mint}`);
  }

  type BirdeyeItem = {
    unixTime: number;
    o: number;
    h: number;
    l: number;
    c: number;
    v: number;
  };

  const data = await res.json() as { data?: { items?: BirdeyeItem[] } };
  const items = data?.data?.items ?? [];

  const candles: OHLCV[] = items.map((item) => ({
    timestamp: item.unixTime * 1000,
    open:   item.o,
    high:   item.h,
    low:    item.l,
    close:  item.c,
    volume: item.v,
  }));

  candles.sort((a, b) => a.timestamp - b.timestamp);
  return candles;
}

// ── Fetch token info from Birdeye (symbol lookup by mint) ────────────────────

async function fetchBirdeyeTokenInfo(mint: string): Promise<{ symbol: string; name: string; price: number } | null> {
  if (!BIRDEYE_KEY) return null;

  const url = `https://public-api.birdeye.so/defi/token_overview?address=${mint}`;
  const res = await fetch(url, {
    headers: { "X-API-KEY": BIRDEYE_KEY, "x-chain": "solana" },
    next: { revalidate: 300 },
  });

  if (!res.ok) return null;

  type TokenOverview = { data?: { symbol?: string; name?: string; price?: number } };
  const json = await res.json() as TokenOverview;
  const d = json?.data;
  if (!d) return null;
  return { symbol: d.symbol ?? "UNKNOWN", name: d.name ?? "", price: d.price ?? 0 };
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
  let source: "coingecko" | "birdeye" | "demo" = "coingecko";

  try {
    // ── Path 1: Known token with CoinGecko ID ───────────────────────
    const cgId = COINGECKO_IDS[symbol];
    if (cgId) {
      ohlcv  = await fetchCoinGeckoOHLCV(cgId);
      source = "coingecko";
      currentPrice = ohlcv[ohlcv.length - 1]?.close ?? 0;

    // ── Path 2: Unknown Solana SPL token (by mint) ──────────────────
    } else if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(mint)) {
      const [candles, info] = await Promise.all([
        fetchBirdeyeOHLCV(mint),
        fetchBirdeyeTokenInfo(mint),
      ]);
      ohlcv = candles;
      source = "birdeye";
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
    if (msg.includes("not configured") || msg.includes("BIRDEYE_API_KEY")) {
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
        warning:      "Demo data used — set BIRDEYE_API_KEY for real SPL token analysis",
      });
    }

    console.error("[technical/route] Error:", msg);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
