/**
 * Liquidation Shield — Rescue API
 *
 * POST /api/liquidation-shield/rescue
 * Body: { wallet, position, rescueUsdc, mandateTxSig? }
 *
 * Executes SAK-powered rescue: repays debt to restore health factor.
 * Charges 1% performance fee on rescued amount (only on success).
 * Fee is collected via SPL Token transfer using pre-authorized delegate.
 * Writes Memo on-chain referencing mandateTxSig for audit chain.
 *
 * Revenue model:
 *  - 1% of rescueUsdc → SAKURA_FEE_WALLET
 *  - Only charged on successful rescue
 *  - Liquidation penalty = 5-10%, so user nets 4-9% savings after fee
 */
import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey, Transaction, Keypair } from "@solana/web3.js";
import { RPC_URL } from "@/lib/agent";
import type { LendingPosition } from "@/lib/liquidation-shield";

export const maxDuration = 120;

// ── GET: return agent pubkey for frontend SPL approve ──────────────────────────
// Frontend needs the agent's public key to build createApproveInstruction.
// Only the PUBLIC key is returned — private key never leaves the server.
export async function GET() {
  const rawKey = process.env.SAKURA_AGENT_PRIVATE_KEY;
  if (!rawKey) {
    return NextResponse.json({ agentPubkey: null, configured: false });
  }
  try {
    const arr = JSON.parse(rawKey) as number[];
    if (!Array.isArray(arr) || arr.length !== 64) {
      return NextResponse.json({ agentPubkey: null, configured: false });
    }
    const kp = Keypair.fromSecretKey(Uint8Array.from(arr));
    return NextResponse.json({ agentPubkey: kp.publicKey.toString(), configured: true });
  } catch {
    return NextResponse.json({ agentPubkey: null, configured: false });
  }
}

const SAKURA_FEE_WALLET = process.env.SAKURA_FEE_WALLET ?? "";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const RESCUE_FEE_PERCENT = 0.01; // 1% performance fee

/**
 * Verify rescue authorization via on-chain SPL Token delegate check.
 * The user must have called buildRescueApproveTransaction() which sets
 * the SPL delegate on their USDC ATA to the agent's public key.
 *
 * This is verified directly on-chain — cannot be faked by an attacker.
 * Prevents: unauthorized fee collection, triggering rescue on arbitrary wallets.
 */
async function verifyRescueAuthorization(
  wallet: string,
  rescueUsdc: number,
  agentPubkey: PublicKey,
  conn: Connection
): Promise<{ authorized: boolean; error?: string }> {
  try {
    const { getAssociatedTokenAddressSync } = await import("@solana/spl-token");
    const usdcMintPubkey = new PublicKey(USDC_MINT);
    const walletPubkey   = new PublicKey(wallet);
    const userUsdcAta    = getAssociatedTokenAddressSync(usdcMintPubkey, walletPubkey);

    const accountInfo = await conn.getParsedAccountInfo(userUsdcAta);
    const info = (accountInfo.value?.data as {
      parsed?: { info?: { delegate?: string; delegatedAmount?: { uiAmount?: number } } }
    })?.parsed?.info;

    if (!info) {
      return { authorized: false, error: "USDC 帳戶不存在，請先建立 USDC 帳戶並執行救援授權" };
    }

    if (!info.delegate || info.delegate !== agentPubkey.toString()) {
      return {
        authorized: false,
        error: "尚未授權 Sakura 救援代理。請先在 Liquidation Shield 頁面執行授權操作。",
      };
    }

    const delegatedAmount = info.delegatedAmount?.uiAmount ?? 0;
    if (delegatedAmount < rescueUsdc) {
      return {
        authorized: false,
        error: `預授權金額 $${delegatedAmount.toFixed(2)} USDC 不足救援所需 $${rescueUsdc} USDC。請提高授權上限。`,
      };
    }

    return { authorized: true };
  } catch (err) {
    return {
      authorized: false,
      error: err instanceof Error ? `授權驗證失敗: ${err.message}` : "授權驗證失敗",
    };
  }
}

export async function POST(req: NextRequest) {
  let body: {
    wallet?: string;
    position?: LendingPosition;
    rescueUsdc?: number;
    mandateTxSig?: string;
  } = {};
  try { body = await req.json(); } catch { /* ok */ }

  const { wallet, position, rescueUsdc, mandateTxSig } = body;

  // ── Input validation ────────────────────────────────────────────────────
  if (!wallet || !position || !rescueUsdc) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet)) {
    return NextResponse.json({ error: "Invalid wallet address format" }, { status: 400 });
  }
  if (rescueUsdc <= 0 || rescueUsdc > 1_000_000) {
    return NextResponse.json({ error: "Invalid rescue amount" }, { status: 400 });
  }

  const rawKey = process.env.SAKURA_AGENT_PRIVATE_KEY;
  if (!rawKey) {
    return NextResponse.json(
      { error: "Agent not configured (SAKURA_AGENT_PRIVATE_KEY missing)" },
      { status: 500 }
    );
  }

  const { createTransferCheckedInstruction, getAssociatedTokenAddressSync } =
    await import("@solana/spl-token");

  const conn = new Connection(RPC_URL, "confirmed");
  const agentKp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(rawKey)));
  const usdcMintPubkey = new PublicKey(USDC_MINT);

  // ── Step 1: Verify on-chain rescue authorization (C-2 fix) ─────────────
  // Confirms the user's USDC ATA has delegated authority to this agent.
  // This cannot be faked — verified directly against blockchain state.
  const authCheck = await verifyRescueAuthorization(
    wallet, rescueUsdc, agentKp.publicKey, conn
  );
  if (!authCheck.authorized) {
    return NextResponse.json(
      { error: authCheck.error ?? "Rescue not authorized" },
      { status: 403 }
    );
  }

  // ── Step 2: Execute rescue via SPL delegate transfer ───────────────────
  // The agent holds SPL Token delegate authority (set by buildRescueApproveTransaction).
  // We transfer rescueUsdc from the user's USDC ATA to the agent's escrow ATA.
  //
  // NOTE: In production, this transfer would target the Kamino/MarginFi repay
  // vault directly (using KaminoAction.buildRepayTxns from @kamino-finance/klend-sdk).
  // This demo implementation uses agent escrow as a proxy to demonstrate the
  // delegate mechanism. The agent ATA would then route to the protocol.
  let rescueSig: string | null = null;
  let error: string | null = null;

  try {
    const userUsdcAta  = getAssociatedTokenAddressSync(usdcMintPubkey, new PublicKey(wallet));
    const agentUsdcAta = getAssociatedTokenAddressSync(usdcMintPubkey, agentKp.publicKey);

    // Rescue amount in micro-USDC (6 decimals)
    const rescueAmount = BigInt(Math.ceil(rescueUsdc * 1_000_000));

    // Transfer USDC from user's ATA to agent escrow using delegate authority
    const rescueIx = createTransferCheckedInstruction(
      userUsdcAta,       // source: user's USDC ATA
      usdcMintPubkey,    // mint
      agentUsdcAta,      // destination: agent escrow
      agentKp.publicKey, // authority: agent (delegate via SPL approve)
      rescueAmount,
      6                  // USDC decimals
    );

    const rescueTx = new Transaction().add(rescueIx);
    rescueTx.feePayer = agentKp.publicKey;
    const { blockhash: rescueBlockhash, lastValidBlockHeight: rescueLVBH } =
      await conn.getLatestBlockhash("confirmed");
    rescueTx.recentBlockhash = rescueBlockhash;
    rescueTx.sign(agentKp);

    rescueSig = await conn.sendRawTransaction(rescueTx.serialize(), { skipPreflight: false });
    await conn.confirmTransaction(
      { signature: rescueSig, blockhash: rescueBlockhash, lastValidBlockHeight: rescueLVBH },
      "confirmed"
    );
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
    console.error("[liquidation-shield/rescue] SAK error:", err);
  }

  // ── Step 3: 1% Performance Fee (only on successful rescue) ────────────
  // Retries once on transient network failure. feeCollected is surfaced to
  // frontend so the user sees an honest status rather than a silent loss.
  let feeSig: string | null = null;
  if (rescueSig && !error && SAKURA_FEE_WALLET) {
    const userUsdcAta  = getAssociatedTokenAddressSync(usdcMintPubkey, new PublicKey(wallet));
    const feeWalletAta = getAssociatedTokenAddressSync(usdcMintPubkey, new PublicKey(SAKURA_FEE_WALLET));
    const feeAmount    = BigInt(Math.ceil(rescueUsdc * RESCUE_FEE_PERCENT * 1_000_000));

    const buildAndSendFeeTx = async (): Promise<string> => {
      const feeIx = createTransferCheckedInstruction(
        userUsdcAta,       // source: user's USDC ATA
        usdcMintPubkey,    // mint
        feeWalletAta,      // destination: Sakura fee wallet ATA
        agentKp.publicKey, // authority: agent (delegate via SPL approve)
        feeAmount,
        6
      );
      const feeTx = new Transaction().add(feeIx);
      feeTx.feePayer = agentKp.publicKey;
      const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash("confirmed");
      feeTx.recentBlockhash = blockhash;
      feeTx.sign(agentKp);
      const sig = await conn.sendRawTransaction(feeTx.serialize(), { skipPreflight: false });
      await conn.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
      return sig;
    };

    // Attempt 1
    try {
      feeSig = await buildAndSendFeeTx();
      console.log(`[rescue] 1% fee collected: ${(rescueUsdc * RESCUE_FEE_PERCENT).toFixed(2)} USDC → ${feeSig.slice(0, 12)}...`);
    } catch (feeErr) {
      console.error("[rescue] Fee collection attempt 1 failed, retrying:", feeErr);
      // Attempt 2 — fresh blockhash to avoid expiry
      try {
        feeSig = await buildAndSendFeeTx();
        console.log(`[rescue] 1% fee collected (retry): ${(rescueUsdc * RESCUE_FEE_PERCENT).toFixed(2)} USDC → ${feeSig.slice(0, 12)}...`);
      } catch (feeErr2) {
        console.error("[rescue] Fee collection failed after retry (non-fatal):", feeErr2);
      }
    }
  }
  const feeCollected = !!feeSig;

  // ── Step 4: On-chain Memo audit record ────────────────────────────────
  let memoSig: string | null = null;
  const auditData = JSON.stringify({
    event: "sakura_rescue_executed",
    protocol: position.protocol,
    wallet: wallet.slice(0, 8),
    rescueUsdc,
    feeUsdc: +(rescueUsdc * RESCUE_FEE_PERCENT).toFixed(4),
    feeSig: feeSig?.slice(0, 20) ?? "pending",
    preHealthFactor: position.healthFactor.toFixed(3),
    postHealthFactor: position.postRescueHealthFactor?.toFixed(3),
    mandateRef: mandateTxSig?.slice(0, 20) ?? "none",
    rescueSig: rescueSig?.slice(0, 20) ?? "failed",
    ts: new Date().toISOString(),
  });

  try {
    // Use absolute URL to avoid relative path failure in serverless environments
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
    if (baseUrl) {
      const internalHeaders: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (process.env.INTERNAL_API_SECRET) {
        internalHeaders["x-internal-secret"] = process.env.INTERNAL_API_SECRET;
      }
      const memoRes = await fetch(`${baseUrl}/api/agent/memo`, {
        method: "POST",
        headers: internalHeaders,
        body: JSON.stringify({ memoPayload: auditData }),
      }).catch(() => null);

      if (memoRes?.ok) {
        const d = await memoRes.json();
        memoSig = d.txSignature ?? d.signature ?? null;
      }
    }
  } catch { /* memo is optional */ }

  return NextResponse.json({
    success: !!rescueSig && !error,
    rescueSig,
    feeSig,
    feeUsdc: +(rescueUsdc * RESCUE_FEE_PERCENT).toFixed(4),
    feeCollected,
    memoSig,
    auditChain: mandateTxSig
      ? `${mandateTxSig.slice(0, 12)}… → ${memoSig?.slice(0, 12) ?? "?"}…`
      : null,
    error,
  });
}
