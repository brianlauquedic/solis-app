import { NextRequest, NextResponse } from "next/server";

// GMGN OpenAPI — discovered from gmgn-skills source code
// Auth: X-APIKEY header; public read-only test key available
const GMGN_BASE = process.env.GMGN_HOST ?? "https://openapi.gmgn.ai";
const GMGN_API_KEY = process.env.GMGN_API_KEY ?? "gmgn_solbscbaseethmonadtron";

const RESOLUTION_SECONDS: Record<string, number> = {
  "1m":  60,
  "5m":  300,
  "15m": 900,
  "1h":  3600,
  "4h":  14400,
  "1d":  86400,
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const mint       = searchParams.get("mint");
  const resolution = searchParams.get("resolution") ?? "1h";
  const limit      = Math.min(parseInt(searchParams.get("limit") ?? "150"), 500);

  if (!mint) {
    return NextResponse.json({ error: "mint is required" }, { status: 400 });
  }

  const secPerCandle = RESOLUTION_SECONDS[resolution] ?? 3600;
  const nowS   = Math.floor(Date.now() / 1000);
  const fromMs = (nowS - limit * secPerCandle) * 1000;
  const toMs   = nowS * 1000;
  const clientId = crypto.randomUUID();

  const gmgnUrl = new URL(`${GMGN_BASE}/v1/market/token_kline`);
  gmgnUrl.searchParams.set("chain",      "sol");
  gmgnUrl.searchParams.set("address",    mint);
  gmgnUrl.searchParams.set("resolution", resolution);
  gmgnUrl.searchParams.set("from",       String(fromMs));
  gmgnUrl.searchParams.set("to",         String(toMs));
  gmgnUrl.searchParams.set("timestamp",  String(nowS));
  gmgnUrl.searchParams.set("client_id",  clientId);

  try {
    const res = await fetch(gmgnUrl.toString(), {
      headers: {
        "X-APIKEY": GMGN_API_KEY,
        "Accept":   "application/json",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      console.warn("[gmgn/kline] upstream error", res.status);
      return NextResponse.json(
        { error: "upstream_error", status: res.status },
        { status: 502 }
      );
    }

    const raw = await res.json();

    // GMGN returns { data: { list: [...] } } or { data: [...] }
    const list: unknown[] = Array.isArray(raw?.data?.list)
      ? raw.data.list
      : Array.isArray(raw?.data)
      ? raw.data
      : Array.isArray(raw)
      ? raw
      : [];

    // Normalise to lightweight-charts CandlestickData format
    // { time (unix seconds), open, high, low, close, volume }
    const candles = list.map((c: unknown) => {
      const item = c as Record<string, number>;
      return {
        time:   Math.floor(Number(item.time ?? item.t ?? item.timestamp) / (item.time > 1e10 ? 1000 : 1)),
        open:   Number(item.open  ?? item.o),
        high:   Number(item.high  ?? item.h),
        low:    Number(item.low   ?? item.l),
        close:  Number(item.close ?? item.c),
        volume: Number(item.volume ?? item.v ?? 0),
      };
    }).filter(c => c.time && c.open && c.close);

    return NextResponse.json(
      { candles, resolution, mint, updatedAt: Date.now() },
      { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=30" } }
    );
  } catch (err) {
    console.error("[gmgn/kline] fetch failed", err);
    return NextResponse.json({ error: "fetch_failed" }, { status: 502 });
  }
}
