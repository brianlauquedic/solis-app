import { NextRequest, NextResponse } from "next/server";
import { PublicKey, Transaction, SystemProgram, VersionedTransaction } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";

// ── Constants ─────────────────────────────────────────────────────
const MARINADE_API      = "https://api.marinade.finance";
const SOLIS_FEE_WALLET  = process.env.SOLIS_FEE_WALLET ?? "Goc5kAMb9NTXjobxzZogAWaHwajmQjw7CdmATWJN1mQh";
const PLATFORM_FEE_BPS  = 30; // 0.3%
// Referral codes — register at https://marinade.finance/app/referral/
// Marinade pays ~0.1% of staked SOL as referral reward
const MARINADE_REFERRAL = process.env.MARINADE_REFERRAL_CODE ?? ""; // set in .env.local

// mSOL mint address
const MSOL_MINT = "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So";

// Jito liquid staking pool state
const JITO_SOL_MINT = "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn";

function fetchWithTimeout(url: string, opts: RequestInit = {}, ms = 8000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

// ── Marinade exchange rate ─────────────────────────────────────────
async function getMarinadeRate(): Promise<{ msolPerSol: number; apy: number }> {
  const FALLBACK = { msolPerSol: 0.893, apy: 7.2 };
  try {
    const res = await fetchWithTimeout(`${MARINADE_API}/msol/price_sol`, {}, 5000);
    if (!res.ok) throw new Error("Marinade API error");
    const data = await res.json();
    const solPerMsol = typeof data === "number" ? data : parseFloat(data);
    // Sanity bounds: SOL/mSOL should always be between 0.8 and 1.1
    // Values outside this range indicate API manipulation or data corruption
    if (!isFinite(solPerMsol) || solPerMsol < 0.8 || solPerMsol > 1.1) {
      console.warn(`[SECURITY] Marinade rate out of bounds: ${solPerMsol} — using fallback`);
      return FALLBACK;
    }
    return { msolPerSol: 1 / solPerMsol, apy: 7.2 };
  } catch {
    return FALLBACK;
  }
}

// ── Marinade stake transaction ─────────────────────────────────────
async function buildMarinadeStakeTx(
  userPublicKey: string,
  lamports: number,
): Promise<string> {
  const referralParam = MARINADE_REFERRAL ? `&referralCode=${MARINADE_REFERRAL}` : "";
  const res = await fetchWithTimeout(
    `${MARINADE_API}/v1/liquid-stake?userPublicKey=${userPublicKey}&amount=${lamports}${referralParam}`,
    { method: "POST", headers: { "Content-Type": "application/json" } },
    10000,
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Marinade API ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  // Marinade returns { transaction: "<base64>" }
  if (!data.transaction) throw new Error("No transaction in Marinade response");

  // Prepend platform fee SOL transfer so Marinade has same fee as Jito
  const feeLamports = Math.round(lamports * PLATFORM_FEE_BPS / 10000);
  if (feeLamports > 0 && SOLIS_FEE_WALLET) {
    try {
      const txBuf = Buffer.from(data.transaction as string, "base64");
      // Try legacy Transaction first, fall back to VersionedTransaction
      let modifiedBase64: string;
      try {
        const tx = Transaction.from(txBuf);
        tx.instructions.unshift(
          SystemProgram.transfer({
            fromPubkey: new PublicKey(userPublicKey),
            toPubkey: new PublicKey(SOLIS_FEE_WALLET),
            lamports: feeLamports,
          })
        );
        modifiedBase64 = tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString("base64");
      } catch {
        // VersionedTransaction: add fee instruction to message
        const vtx = VersionedTransaction.deserialize(txBuf);
        // For versioned txs, prepend a legacy fee tx instead — return as two-tx array is complex;
        // fall back to unmodified tx + note (Marinade referral covers fees passively)
        modifiedBase64 = Buffer.from(vtx.serialize()).toString("base64");
      }
      return modifiedBase64;
    } catch {
      // If modification fails, return original — fee collected via referral
    }
  }

  return data.transaction as string;
}

// ── GET: Preview stake (exchange rate + estimated mSOL) ────────────
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const protocol = searchParams.get("protocol") ?? "marinade"; // "marinade" | "jito"
    const amountSOL = parseFloat(searchParams.get("amount") ?? "1");

    if (isNaN(amountSOL) || amountSOL <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    const { msolPerSol, apy } = await getMarinadeRate();
    const outputAmount = amountSOL * msolPerSol;
    const earnPerYear = amountSOL * (apy / 100);

    return NextResponse.json({
      protocol,
      inputAmount: amountSOL,
      inputToken: "SOL",
      outputAmount: parseFloat(outputAmount.toFixed(6)),
      outputToken: protocol === "marinade" ? "mSOL" : "jitoSOL",
      outputMint: protocol === "marinade" ? MSOL_MINT : JITO_SOL_MINT,
      apy: apy.toFixed(1),
      earnPerYear: earnPerYear.toFixed(4),
      exchangeRate: msolPerSol.toFixed(6),
      note: "流动性质押代币可随时赎回，同时可用于 DeFi",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Stake preview failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── POST: Build stake transaction ──────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const { protocol, amountSOL, userPublicKey } = await req.json();

    if (!userPublicKey) {
      return NextResponse.json({ error: "Missing userPublicKey" }, { status: 400 });
    }
    if (!amountSOL || amountSOL <= 0) {
      return NextResponse.json({ error: "Invalid amount" }, { status: 400 });
    }

    const lamports = Math.round(amountSOL * 1e9);

    if (protocol === "jito") {
      // Jito: use Jupiter swap SOL → jitoSOL (most reliable)
      const params = new URLSearchParams({
        inputMint: "So11111111111111111111111111111111111111112",
        outputMint: JITO_SOL_MINT,
        amount: lamports.toString(),
        slippageBps: "50",
        platformFeeBps: PLATFORM_FEE_BPS.toString(),
      });
      const quoteRes = await fetchWithTimeout(
        `https://quote-api.jup.ag/v6/quote?${params}`, {}, 8000
      );
      if (!quoteRes.ok) throw new Error("Jupiter quote for Jito failed");
      const quoteData = await quoteRes.json();

      // Fee account: ATA of fee wallet for jitoSOL
      let jitoFeeAccount = SOLIS_FEE_WALLET;
      try {
        jitoFeeAccount = getAssociatedTokenAddressSync(
          new PublicKey(JITO_SOL_MINT),
          new PublicKey(SOLIS_FEE_WALLET)
        ).toString();
      } catch { /* fallback */ }

      const swapRes = await fetchWithTimeout("https://quote-api.jup.ag/v6/swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteResponse: quoteData,
          userPublicKey,
          wrapAndUnwrapSol: true,
          feeAccount: jitoFeeAccount,
          dynamicComputeUnitLimit: true,
          prioritizationFeeLamports: "auto",
        }),
      }, 10000);
      if (!swapRes.ok) throw new Error("Jupiter swap build for Jito failed");
      const swapData = await swapRes.json();

      return NextResponse.json({
        stakeTransaction: swapData.swapTransaction,
        protocol: "jito",
        outputToken: "jitoSOL",
      });
    }

    // Marinade (default)
    const tx = await buildMarinadeStakeTx(userPublicKey, lamports);
    return NextResponse.json({
      stakeTransaction: tx,
      protocol: "marinade",
      outputToken: "mSOL",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Stake build failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
