import { NextRequest, NextResponse } from "next/server";

// ── Kamino constants ──────────────────────────────────────────────
const KAMINO_API = "https://api.kamino.finance";

// Kamino USDC market addresses (main market)
const KAMINO_MAIN_MARKET  = "7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF";
const USDC_MINT           = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

function fetchWithTimeout(url: string, opts: RequestInit = {}, ms = 8000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

// ── Get Kamino USDC supply APY ────────────────────────────────────
async function getKaminoUSDCRate(): Promise<{ supplyApy: number; utilizationRate: number }> {
  try {
    const res = await fetchWithTimeout(
      `${KAMINO_API}/v2/lending-market/${KAMINO_MAIN_MARKET}/reserves`,
      {},
      5000,
    );
    if (!res.ok) throw new Error("Kamino API error");
    const data = await res.json();

    // Find USDC reserve
    const reserves = Array.isArray(data) ? data : (data.reserves ?? data.data ?? []);
    const usdcReserve = reserves.find(
      (r: { mintAddress?: string; mint?: string }) =>
        r.mintAddress === USDC_MINT || r.mint === USDC_MINT
    );

    if (usdcReserve) {
      const supplyApy =
        parseFloat(usdcReserve.supplyInterestAPY ?? usdcReserve.supplyApy ?? usdcReserve.supply_apy ?? 8.2);
      const utilization =
        parseFloat(usdcReserve.utilizationRatio ?? usdcReserve.utilization ?? 0.7);
      return { supplyApy: supplyApy * 100 > 1 ? supplyApy : supplyApy * 100, utilizationRate: utilization };
    }
    return { supplyApy: 8.2, utilizationRate: 0.72 };
  } catch {
    return { supplyApy: 8.2, utilizationRate: 0.72 };
  }
}

// ── GET: Lend preview ─────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const protocol  = searchParams.get("protocol") ?? "kamino";
    const amountUSDC = parseFloat(searchParams.get("amount") ?? "100");

    if (isNaN(amountUSDC) || amountUSDC <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    const { supplyApy, utilizationRate } = await getKaminoUSDCRate();
    const earnPerYear  = amountUSDC * (supplyApy / 100);
    const earnPerMonth = earnPerYear / 12;

    return NextResponse.json({
      protocol,
      inputAmount: amountUSDC,
      inputToken: "USDC",
      outputToken: "kUSDC",  // Kamino receipt token
      supplyApy: supplyApy.toFixed(1),
      earnPerYear: earnPerYear.toFixed(2),
      earnPerMonth: earnPerMonth.toFixed(2),
      utilizationRate: (utilizationRate * 100).toFixed(0),
      note: "存款随时可取回，自动复利，利率随借贷需求浮动",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Lend preview failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── POST: Build deposit instruction via Kamino API ────────────────
export async function POST(req: NextRequest) {
  try {
    const { protocol, amountUSDC, userPublicKey } = await req.json();

    if (!userPublicKey) {
      return NextResponse.json({ error: "Missing userPublicKey" }, { status: 400 });
    }
    if (!amountUSDC || amountUSDC <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }
    if (protocol === "marginfi") {
      return NextResponse.json({
        error: "Marginfi 暂不支持直接存款，请访问 app.marginfi.com",
        externalUrl: "https://app.marginfi.com/",
      }, { status: 400 });
    }

    const usdcLamports = Math.round(amountUSDC * 1e6); // USDC = 6 decimals

    // Kamino deposit transaction via their API
    const res = await fetchWithTimeout(
      `${KAMINO_API}/v2/lending-market/${KAMINO_MAIN_MARKET}/deposit`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: userPublicKey,
          mint: USDC_MINT,
          amount: usdcLamports,
        }),
      },
      10000,
    );

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Kamino API ${res.status}: ${text.slice(0, 200)}`);
    }

    const data = await res.json();
    const tx = data.transaction ?? data.tx ?? data.data?.transaction;
    if (!tx) throw new Error("No transaction in Kamino response");

    return NextResponse.json({
      lendTransaction: tx,
      protocol: protocol ?? "kamino",
      outputToken: "kUSDC",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Lend build failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
