/**
 * POST /api/insurance/claim-with-repay
 *
 * Atomic ZK-insurance-claim + Kamino-repay route.
 *
 * Builds a single versioned (v0) transaction that, when signed by the user,
 * executes in one slot:
 *
 *   1. compute-budget + priority-fee ixs (dynamic)
 *   2. sakura_insurance::claim_payout_with_zk_proof
 *        - Groth16 pairing verified on-chain via alt_bn128 syscall
 *        - Transfers `amount` USDC from pool vault → user's USDC ATA
 *        - Contract enforces `rescue_destination_ata.owner == policy.user`
 *   3. Kamino setup ixs (ATA init, scope refresh) — from klend-sdk
 *   4. Kamino `repay_obligation_liquidity_v2` — owner = payer = user
 *        - Decrements user's borrow balance on the given obligation
 *   5. Kamino cleanup ixs (farms, etc.)
 *
 * The atomic boundary is critical: if Kamino repay fails the ZK claim
 * reverts too (no loose USDC left in user's ATA pre-repay).
 *
 * Server-side ZK proof generation:
 *   We call `generateLiquidationProof` inside Node using the zkey at
 *   `public/zk/liquidation_proof.zkey`. snarkjs runs in WASM on the server
 *   (cold ~1.5s, warm <200ms). The proof is converted via
 *   `proofToOnchainBytes` into the (A, B, C) layout groth16-solana expects
 *   (α₁ negated, Fq2 c0/c1 swapped per ark-bn254 convention).
 *
 * Request body:
 *   {
 *     wallet: string,                 // user pubkey (also signer, fee-payer, obligation owner)
 *     poolAdmin: string,              // insurance pool admin (PDA seed)
 *     marketAddress: string,          // Kamino KaminoMarket pubkey
 *     obligationAddress: string,      // Kamino obligation pubkey (bound via policy commitment)
 *     rescueUsdc: number,             // claim amount in USDC (whole units)
 *     triggerHfBps: number,           // e.g. 10500 — HF threshold for proof (< 1.05)
 *     collateralAmount: string,       // private witness — raw collateral units (e.g. lamports)
 *     debtUsdMicro: string,           // private witness — current debt (micro-USD)
 *     nonce: string,                  // private witness — policy nonce (fresh, hex or decimal)
 *     oraclePriceUsdMicro: string,    // public input — Pyth price × 1e6
 *     oracleSlot: string,             // public input — Pyth publish slot
 *     claimNonce?: string,            // claim-record nonce (defaults to epoch ms)
 *   }
 *
 * Response:
 *   {
 *     ok: true,
 *     txBase64: string,               // unsigned v0 tx, base64-encoded
 *     proof: { a: hex, b: hex, c: hex, publicSignals: string[] },
 *     commitmentHash: string,         // 0x-prefixed hex (matches Policy.commitment_hash)
 *     rescueAmountBucket: number,     // buckets of 100 USDC used as public input
 *     lookupTableAddresses: string[],
 *   }
 */

import { NextRequest, NextResponse } from "next/server";
import {
  ComputeBudgetProgram,
  Connection,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction,
  AddressLookupTableAccount,
} from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";

import { RPC_URL } from "@/lib/agent";
import { getDevnetConnection, getDynamicPriorityFee } from "@/lib/rpc";
import {
  buildClaimPayoutWithZkProofIx,
  checkClaimEligibility,
  fetchPolicy,
  PYTH_SOL_USD_DEVNET,
  USDC_MINT_DEVNET,
} from "@/lib/insurance-pool";
import { buildKaminoRepayInstructions } from "@/lib/liquidation-shield";
import {
  computePolicyCommitment,
  generateLiquidationProof,
  proofToOnchainBytes,
  verifyLiquidationProof,
  type LiquidationWitness,
} from "@/lib/zk-proof";

export const maxDuration = 120;

// ── helpers ───────────────────────────────────────────────────────────

/**
 * Pack a Solana Pubkey into a BN254-compatible 31-byte big-integer.
 * BN254 scalar field is ~254 bits; using the first 31 bytes (248 bits)
 * leaves plenty of margin and matches what the circuit expects.
 */
function pubkeyToField31(pk: PublicKey): bigint {
  const bytes = pk.toBytes(); // 32 bytes
  const first31 = bytes.slice(0, 31);
  let v = 0n;
  for (const b of first31) v = (v << 8n) | BigInt(b);
  return v;
}

function parseBigInt(v: unknown, name: string): bigint {
  if (typeof v === "string" && /^0x[0-9a-fA-F]+$/.test(v)) return BigInt(v);
  if (typeof v === "string" && /^\d+$/.test(v)) return BigInt(v);
  if (typeof v === "number" && Number.isInteger(v)) return BigInt(v);
  throw new Error(`invalid ${name}: expected integer string`);
}

function bytesToHex(u: Uint8Array): string {
  return "0x" + Buffer.from(u).toString("hex");
}

// ── handler ───────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    const walletStr = String(body.wallet ?? "");
    const poolAdminStr = String(body.poolAdmin ?? "");
    const marketStr = String(body.marketAddress ?? "");
    const obligationStr = String(body.obligationAddress ?? "");
    const rescueUsdc = Number(body.rescueUsdc ?? 0);
    const triggerHfBps = Number(body.triggerHfBps ?? 0);

    if (!walletStr || !poolAdminStr || !obligationStr) {
      return NextResponse.json(
        { ok: false, error: "wallet, poolAdmin, obligationAddress required" },
        { status: 400 }
      );
    }
    if (!rescueUsdc || rescueUsdc < 100 || rescueUsdc > 1_000_000) {
      return NextResponse.json(
        { ok: false, error: "rescueUsdc must be 100..1_000_000" },
        { status: 400 }
      );
    }
    if (triggerHfBps < 10_000 || triggerHfBps > 20_000) {
      return NextResponse.json(
        { ok: false, error: "triggerHfBps must be 10000..20000" },
        { status: 400 }
      );
    }
    // Rescue must be a multiple of 100 USDC (circuit uses buckets)
    if (rescueUsdc % 100 !== 0) {
      return NextResponse.json(
        { ok: false, error: "rescueUsdc must be a multiple of 100" },
        { status: 400 }
      );
    }

    const user = new PublicKey(walletStr);
    const poolAdmin = new PublicKey(poolAdminStr);
    const obligation = new PublicKey(obligationStr);

    const collateralAmount = parseBigInt(body.collateralAmount, "collateralAmount");
    const debtUsdMicro = parseBigInt(body.debtUsdMicro, "debtUsdMicro");
    const nonce = parseBigInt(body.nonce, "nonce");
    const oraclePriceUsdMicro = parseBigInt(body.oraclePriceUsdMicro, "oraclePriceUsdMicro");
    const oracleSlot = parseBigInt(body.oracleSlot, "oracleSlot");
    const claimNonce = body.claimNonce
      ? parseBigInt(body.claimNonce, "claimNonce")
      : BigInt(Date.now());

    const connection: Connection = getDevnetConnection
      ? await getDevnetConnection("confirmed")
      : new Connection(RPC_URL, "confirmed");

    // ── 1. Eligibility gate (reads Pool + Policy) ─────────────────────
    const rescueMicro = BigInt(rescueUsdc) * 1_000_000n;
    const elig = await checkClaimEligibility({
      connection,
      poolAdmin,
      user,
      rescueMicroUsdc: rescueMicro,
    });
    if (!elig.eligible) {
      return NextResponse.json(
        { ok: false, error: `ineligible: ${elig.reason ?? "unknown"}` },
        { status: 400 }
      );
    }

    // ── 2. Re-derive commitment + sanity-check against on-chain Policy
    const obligationField = pubkeyToField31(obligation);
    const walletField = pubkeyToField31(user);
    const commit = await computePolicyCommitment(obligationField, walletField, nonce);

    const { state: policy } = await fetchPolicy(connection, user);
    if (!policy) {
      return NextResponse.json({ ok: false, error: "policy not found" }, { status: 400 });
    }
    const onchainCommitHex = "0x" + policy.commitmentHash.toString("hex");
    if (onchainCommitHex.toLowerCase() !== commit.hex.toLowerCase()) {
      return NextResponse.json(
        {
          ok: false,
          error: "commitment mismatch — obligation/nonce don't match policy.commitment_hash",
          onchain: onchainCommitHex,
          computed: commit.hex,
        },
        { status: 400 }
      );
    }

    // ── 3. Generate Groth16 proof ─────────────────────────────────────
    const rescueBucket = Math.floor(rescueUsdc / 100);
    const witness: LiquidationWitness = {
      policyCommitment: BigInt(commit.decimal),
      triggerHfBps,
      rescueAmountBucket: rescueBucket,
      oraclePriceUsdMicro,
      oracleSlot,
      collateralAmount,
      debtUsdMicro,
      positionAccountBytes: obligationField,
      userWalletBytes: walletField,
      nonce,
    };

    // `artifactBase` omitted so lib/zk-proof.ts resolves via
    // path.join(process.cwd(), "public", "zk") — cwd-safe on Vercel Fluid.
    const bundle = await generateLiquidationProof(witness);

    // Fail-closed off-chain prefilter using the same VK (authoritative check
    // is the on-chain pairing). If this fails the circuit inputs are wrong —
    // don't waste gas submitting.
    const offchainOk = await verifyLiquidationProof(bundle.proof, bundle.publicSignals);
    if (!offchainOk) {
      return NextResponse.json(
        { ok: false, error: "off-chain proof verification failed — inputs inconsistent" },
        { status: 400 }
      );
    }

    const { proofA, proofB, proofC } = proofToOnchainBytes(bundle.proof);

    // ── 4. Build claim_payout_with_zk_proof ix ────────────────────────
    const rescueDestinationAta = getAssociatedTokenAddressSync(
      USDC_MINT_DEVNET,
      user,
      false
    );

    // Pyth SOL/USD price account — caller may override; default is devnet.
    const pythPriceAccount = body.pythPriceAccount
      ? new PublicKey(String(body.pythPriceAccount))
      : PYTH_SOL_USD_DEVNET;

    const claimIx = buildClaimPayoutWithZkProofIx({
      poolAdmin,
      policyUser: user,
      payer: user, // user signs the whole bundle
      rescueDestinationAta,
      pythPriceAccount,
      amountMicroUsdc: rescueMicro,
      claimNonce,
      triggerHfBps,
      rescueAmountBucket: rescueBucket,
      oraclePriceUsdMicro,
      oracleSlot,
      proofA,
      proofB,
      proofC,
    });

    // ── 5. Build Kamino repay ixs (if market provided) ────────────────
    let kaminoIxs: TransactionInstruction[] = [];
    let lookupTableAddresses: string[] = [];
    if (marketStr) {
      const kamino = await buildKaminoRepayInstructions({
        walletAddress: walletStr,
        marketAddress: marketStr,
        obligationAddress: obligationStr,
        payerPubkey: walletStr, // user pays repay from the USDC just claimed
        repayMicroUsdc: rescueMicro,
        rpcUrl: RPC_URL,
      });
      if (kamino) {
        kaminoIxs = kamino.instructions;
        lookupTableAddresses = kamino.lookupTableAddresses;
      }
    }

    // ── 6. Assemble atomic v0 tx ──────────────────────────────────────
    const priorityFee = await getDynamicPriorityFee(connection);
    const prelude: TransactionInstruction[] = [
      ComputeBudgetProgram.setComputeUnitLimit({ units: 800_000 }),
      ComputeBudgetProgram.setComputeUnitPrice({ microLamports: priorityFee }),
    ];

    const allIxs: TransactionInstruction[] = [...prelude, claimIx, ...kaminoIxs];

    // Resolve LUTs (if Kamino attached any)
    const lookupTables: AddressLookupTableAccount[] = [];
    for (const lut of lookupTableAddresses) {
      try {
        const acct = await connection.getAddressLookupTable(new PublicKey(lut));
        if (acct.value) lookupTables.push(acct.value);
      } catch {
        // swallow — non-fatal, tx just gets larger
      }
    }

    const { blockhash } = await connection.getLatestBlockhash("confirmed");
    const messageV0 = new TransactionMessage({
      payerKey: user,
      recentBlockhash: blockhash,
      instructions: allIxs,
    }).compileToV0Message(lookupTables);

    const tx = new VersionedTransaction(messageV0);
    const txBase64 = Buffer.from(tx.serialize()).toString("base64");

    return NextResponse.json({
      ok: true,
      txBase64,
      proof: {
        a: bytesToHex(proofA),
        b: bytesToHex(proofB),
        c: bytesToHex(proofC),
        publicSignals: bundle.publicSignals,
      },
      commitmentHash: commit.hex,
      rescueAmountBucket: rescueBucket,
      lookupTableAddresses,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Surface stack in dev for faster triage
    const stack = err instanceof Error ? err.stack : undefined;
    return NextResponse.json(
      { ok: false, error: msg, stack: process.env.NODE_ENV === "development" ? stack : undefined },
      { status: 500 }
    );
  }
}
