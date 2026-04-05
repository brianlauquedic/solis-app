import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";

// ── Sakura 平台手续费钱包 ──────────────────────────────────────────
const SOLIS_FEE_WALLET = process.env.SOLIS_FEE_WALLET ?? "Goc5kAMb9NTXjobxzZogAWaHwajmQjw7CdmATWJN1mQh";

// 平台手续费：0.3%（30 bps）
const PLATFORM_FEE_BPS = 30;

const SOL_MINT = "So11111111111111111111111111111111111111112";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

const TOKEN_MINTS: Record<string, string> = {
  SOL:  SOL_MINT,
  USDC: USDC_MINT,
  USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
  BONK: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
  JUP:  "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN",
  RAY:  "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R",
};

// Resolve any token symbol to mint, or pass through if already a mint address
async function resolveMint(symbolOrMint: string): Promise<{ mint: string; decimals: number } | null> {
  // Already a mint address (base58, 32-44 chars)
  if (symbolOrMint.length >= 32) return { mint: symbolOrMint, decimals: 6 };
  // Known tokens
  const known = TOKEN_MINTS[symbolOrMint.toUpperCase()];
  if (known) {
    const dec = symbolOrMint.toUpperCase() === "SOL" ? 9 : 6;
    return { mint: known, decimals: dec };
  }
  // Jupiter token search
  try {
    const res = await fetch(`https://tokens.jup.ag/token/${symbolOrMint}`, { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const d = await res.json() as { address?: string; decimals?: number };
      if (d.address) return { mint: d.address, decimals: d.decimals ?? 6 };
    }
  } catch { /* ignore */ }
  return null;
}

function fetchWithTimeout(url: string, opts: RequestInit = {}, ms = 10000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

// ── Step 1: Get Jupiter Quote ─────────────────────────────────────
async function getQuote(
  inputMint: string,
  outputMint: string,
  amountLamports: number,
  slippageBps: number = 50
) {
  const params = new URLSearchParams({
    inputMint,
    outputMint,
    amount: amountLamports.toString(),
    slippageBps: slippageBps.toString(),
    platformFeeBps: PLATFORM_FEE_BPS.toString(),
  });

  const res = await fetchWithTimeout(
    `https://quote-api.jup.ag/v6/quote?${params}`,
    {},
    8000
  );
  if (!res.ok) throw new Error(`Jupiter quote failed: ${res.status}`);
  return res.json();
}

// ── Step 2: Build Swap Transaction ───────────────────────────────
async function buildSwapTx(
  quoteResponse: unknown,
  userPublicKey: string
) {
  // Jupiter requires feeAccount to be the ATA of the fee wallet for the output token
  const outputMint = (quoteResponse as { outputMint: string }).outputMint;
  let feeAccount = SOLIS_FEE_WALLET;
  try {
    feeAccount = getAssociatedTokenAddressSync(
      new PublicKey(outputMint),
      new PublicKey(SOLIS_FEE_WALLET)
    ).toString();
  } catch { /* fallback to wallet address */ }

  const res = await fetchWithTimeout(
    "https://quote-api.jup.ag/v6/swap",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quoteResponse,
        userPublicKey,
        wrapAndUnwrapSol: true,
        feeAccount,
        dynamicComputeUnitLimit: true,
        prioritizationFeeLamports: "auto",
      }),
    },
    10000
  );
  if (!res.ok) throw new Error(`Jupiter swap build failed: ${res.status}`);
  return res.json();
}

// ── GET: Quote endpoint ───────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const from = searchParams.get("from")?.toUpperCase() ?? "SOL";
    const to = searchParams.get("to")?.toUpperCase() ?? "USDC";
    const fromMintOverride = searchParams.get("fromMint");
    const toMintOverride   = searchParams.get("toMint");
    const amount = parseFloat(searchParams.get("amount") ?? "1");

    if (isNaN(amount) || amount <= 0)
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });

    // Resolve mints — explicit overrides take priority
    const inputResolved  = fromMintOverride
      ? { mint: fromMintOverride, decimals: from === "SOL" ? 9 : 6 }
      : await resolveMint(from);
    const outputResolved = toMintOverride
      ? { mint: toMintOverride, decimals: 6 }
      : await resolveMint(to);

    if (!inputResolved)  return NextResponse.json({ error: `Cannot resolve token: ${from}` }, { status: 400 });
    if (!outputResolved) return NextResponse.json({ error: `Cannot resolve token: ${to}` }, { status: 400 });

    const amountLamports = Math.round(amount * 10 ** inputResolved.decimals);
    const rawSlippage = parseInt(searchParams.get("slippage") ?? "50");
    const slippageBps = Math.min(Math.max(rawSlippage, 10), 300);

    // Also fetch recommended slippage from GMGN if available
    let finalSlippage = slippageBps;
    try {
      const slipRes = await fetch(
        `https://gmgn.ai/api/v1/recommend_slippage/sol/${outputResolved.mint}`,
        { signal: AbortSignal.timeout(3000) }
      );
      if (slipRes.ok) {
        const slipData = await slipRes.json() as { recommend_slippage?: string; has_tax?: boolean };
        if (slipData.recommend_slippage) {
          const gmgnSlip = parseFloat(slipData.recommend_slippage) * 100; // percent → bps
          finalSlippage = Math.max(slippageBps, Math.min(gmgnSlip, 300));
        }
      }
    } catch { /* use default */ }

    const quote = await getQuote(inputResolved.mint, outputResolved.mint, amountLamports, finalSlippage);

    const outDecimals = outputResolved.decimals;
    const outAmount = parseInt(quote.outAmount) / 10 ** outDecimals;
    const priceImpact = parseFloat(quote.priceImpactPct ?? "0");
    const platformFeeUSD = (amount * PLATFORM_FEE_BPS) / 10000;

    return NextResponse.json({
      from, to,
      inputAmount: amount,
      outputAmount: outAmount,
      outputAmountFormatted: outAmount.toLocaleString(undefined, { maximumFractionDigits: outDecimals > 6 ? 4 : 2 }),
      priceImpact: priceImpact.toFixed(3),
      platformFeePct: `${(PLATFORM_FEE_BPS / 100).toFixed(1)}%`,
      platformFeeUSD: platformFeeUSD.toFixed(4),
      slippageBps: finalSlippage,
      inputMint: inputResolved.mint,
      outputMint: outputResolved.mint,
      quoteResponse: quote,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Quote failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── POST: Build swap transaction for Phantom to sign ─────────────
// Security: always re-fetches quote server-side — never trusts client quote
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { userPublicKey } = body;

    // Accept either original params (preferred, most secure) or legacy quoteResponse
    let freshQuote: unknown;

    if (body.from && body.to && body.amount) {
      const from = String(body.from).toUpperCase();
      const to   = String(body.to).toUpperCase();
      const amount = parseFloat(body.amount);
      const slippageBps = Math.min(Math.max(parseInt(body.slippageBps ?? "50"), 10), 300);

      if (isNaN(amount) || amount <= 0)
        return NextResponse.json({ error: "Invalid amount" }, { status: 400 });

      // Support direct mint overrides from copy-trade flow
      const inputResolved  = body.inputMint
        ? { mint: String(body.inputMint), decimals: from === "SOL" ? 9 : 6 }
        : await resolveMint(from);
      const outputResolved = body.outputMint
        ? { mint: String(body.outputMint), decimals: 6 }
        : await resolveMint(to);

      if (!inputResolved || !outputResolved)
        return NextResponse.json({ error: "Cannot resolve token pair" }, { status: 400 });

      const amountLamports = Math.round(amount * 10 ** inputResolved.decimals);
      freshQuote = await getQuote(inputResolved.mint, outputResolved.mint, amountLamports, slippageBps);

    } else if (body.quoteResponse) {
      // Legacy: re-validate by re-fetching with same params from the original quote
      const q = body.quoteResponse as {
        inputMint?: string; outputMint?: string; inAmount?: string; slippageBps?: number;
      };
      if (!q.inputMint || !q.outputMint || !q.inAmount) {
        return NextResponse.json({ error: "Invalid quoteResponse: missing required fields" }, { status: 400 });
      }
      // Re-fetch with same params — never use client-supplied route/outAmount
      freshQuote = await getQuote(
        q.inputMint,
        q.outputMint,
        parseInt(q.inAmount),
        q.slippageBps ?? 50
      );

    } else {
      return NextResponse.json(
        { error: "Provide either {from, to, amount} or {quoteResponse}" },
        { status: 400 }
      );
    }

    if (!userPublicKey) {
      return NextResponse.json({ error: "Missing userPublicKey" }, { status: 400 });
    }

    const swapData = await buildSwapTx(freshQuote, userPublicKey);

    return NextResponse.json({
      swapTransaction: swapData.swapTransaction,
      lastValidBlockHeight: swapData.lastValidBlockHeight,
      platformFee: `${(PLATFORM_FEE_BPS / 100).toFixed(1)}%`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Swap build failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
