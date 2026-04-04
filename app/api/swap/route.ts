import { NextRequest, NextResponse } from "next/server";
import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";

// ── Solis 平台手续费钱包 ──────────────────────────────────────────
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
    const amount = parseFloat(searchParams.get("amount") ?? "1");

    if (isNaN(amount) || amount <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    const inputMint = TOKEN_MINTS[from];
    const outputMint = TOKEN_MINTS[to];
    if (!inputMint || !outputMint) {
      return NextResponse.json({ error: `Unsupported token: ${from} or ${to}` }, { status: 400 });
    }

    // Convert to lamports (SOL = 9 decimals, USDC = 6 decimals)
    const decimals = from === "SOL" ? 9 : 6;
    const amountLamports = Math.round(amount * 10 ** decimals);

    const rawSlippage = parseInt(searchParams.get("slippage") ?? "50");
    const slippageBps = Math.min(Math.max(rawSlippage, 10), 300); // clamp 0.1% – 3%
    const quote = await getQuote(inputMint, outputMint, amountLamports, slippageBps);

    // Calculate human-readable output
    const outDecimals = to === "SOL" ? 9 : 6;
    const outAmount = parseInt(quote.outAmount) / 10 ** outDecimals;
    const priceImpact = parseFloat(quote.priceImpactPct ?? "0");
    const platformFeeUSD = (amount * PLATFORM_FEE_BPS) / 10000;

    return NextResponse.json({
      from,
      to,
      inputAmount: amount,
      outputAmount: outAmount,
      outputAmountFormatted: outAmount.toLocaleString(undefined, { maximumFractionDigits: to === "SOL" ? 4 : 2 }),
      priceImpact: priceImpact.toFixed(3),
      platformFeePct: `${(PLATFORM_FEE_BPS / 100).toFixed(1)}%`,
      platformFeeUSD: platformFeeUSD.toFixed(4),
      slippageBps,
      quoteResponse: quote, // pass back for swap execution
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
      // Preferred: re-fetch quote from params
      const from = String(body.from).toUpperCase();
      const to   = String(body.to).toUpperCase();
      const amount = parseFloat(body.amount);
      const slippageBps = Math.min(Math.max(parseInt(body.slippageBps ?? "50"), 10), 300);

      if (isNaN(amount) || amount <= 0) {
        return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
      }
      const inputMint  = TOKEN_MINTS[from];
      const outputMint = TOKEN_MINTS[to];
      if (!inputMint || !outputMint) {
        return NextResponse.json({ error: `Unsupported token pair` }, { status: 400 });
      }
      const decimals = from === "SOL" ? 9 : 6;
      const amountLamports = Math.round(amount * 10 ** decimals);
      freshQuote = await getQuote(inputMint, outputMint, amountLamports, slippageBps);

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
