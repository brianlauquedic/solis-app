/**
 * x402 / Agent Payment client helper for Sakura.
 * Handles the HTTP 402 → USDC payment → retry flow.
 *
 * Flow:
 *   1. Client calls /api/token/premium?mint=xxx  → 402 with payment info
 *   2. Client creates a Solana USDC transfer tx to SOLIS_FEE_WALLET
 *   3. Client retries with X-PAYMENT: <txSignature> header
 *   4. Server verifies tx on-chain → returns full analysis
 */

export interface PaymentChallenge {
  recipient: string;   // SOLIS_FEE_WALLET
  amount: number;      // in USDC (e.g. 0.1)
  currency: "USDC";
  network: "solana-mainnet";
  description: string;
}

export interface X402PaymentResult {
  txSignature: string;
  paymentChallenge: PaymentChallenge;
}

const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const USDC_DECIMALS = 6;
const PAYMENT_TIMEOUT_MS = 45_000; // 45 seconds max for entire payment flow

/**
 * Returns the active wallet provider: Phantom first, OKX as fallback.
 * Works in both browser contexts.
 */
function getWalletProvider() {
  if (typeof window === "undefined") return null;
  if (window.solana?.isPhantom) return window.solana;
  if (window.okxwallet?.solana) return window.okxwallet.solana;
  return null;
}

/**
 * Create and send a Solana USDC transfer transaction via Phantom or OKX wallet.
 * Returns the tx signature on success.
 * Includes a 45-second timeout to prevent UI from being stuck in "支付中...".
 */
export async function payWithWallet(
  challenge: PaymentChallenge
): Promise<{ sig: string } | { error: string }> {
  if (!getWalletProvider()) return { error: "no_wallet" };

  // Race against a 45-second timeout — prevents infinite "支付中..." stuck state
  const timeoutPromise = new Promise<{ error: string }>(resolve =>
    setTimeout(() => resolve({ error: "支付超時，請重試 (45s timeout)" }), PAYMENT_TIMEOUT_MS)
  );

  return Promise.race([timeoutPromise, _doPayment(challenge)]);
}

/** @deprecated Use payWithWallet instead */
export const payWithPhantom = payWithWallet;

async function _doPayment(
  challenge: PaymentChallenge
): Promise<{ sig: string } | { error: string }> {
  try {
    const {
      Connection, PublicKey, Transaction,
    } = await import("@solana/web3.js");

    // Lazy-load token program for USDC transfers
    const { createTransferCheckedInstruction, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, getAccount } =
      await import("@solana/spl-token").catch(() => ({ createTransferCheckedInstruction: null, getAssociatedTokenAddress: null, createAssociatedTokenAccountInstruction: null, getAccount: null }));

    if (!createTransferCheckedInstruction || !getAssociatedTokenAddress) {
      return { error: "spl-token not available" };
    }

    const RPC = typeof window !== "undefined"
      ? `${window.location.origin}/api/rpc`
      : `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY ?? ""}`;
    const conn = new Connection(RPC, "confirmed");

    const provider = getWalletProvider()!;
    await provider.connect({ onlyIfTrusted: true });
    const senderPubkey = new PublicKey(provider.publicKey!.toString());
    const recipientPubkey = new PublicKey(challenge.recipient);
    const usdcMint = new PublicKey(USDC_MINT);

    const senderATA  = await getAssociatedTokenAddress(usdcMint, senderPubkey);
    const receiverATA = await getAssociatedTokenAddress(usdcMint, recipientPubkey);

    // Check sender has enough USDC
    try {
      const { getAccount: _getAccount } = await import("@solana/spl-token");
      const senderAccount = await _getAccount(conn, senderATA).catch(() => null);
      if (senderAccount) {
        const usdcBalance = Number(senderAccount.amount) / 10 ** USDC_DECIMALS;
        if (usdcBalance < challenge.amount) {
          return { error: `USDC 餘額不足：需要 ${challenge.amount} USDC，目前只有 ${usdcBalance.toFixed(2)} USDC` };
        }
      }
    } catch {
      // Non-fatal: proceed anyway
    }

    const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash("confirmed");
    const tx = new Transaction({ recentBlockhash: blockhash, feePayer: senderPubkey });

    // Create receiver ATA if needed
    try {
      await getAccount(conn, receiverATA);
    } catch {
      tx.add(createAssociatedTokenAccountInstruction(senderPubkey, receiverATA, recipientPubkey, usdcMint));
    }

    const amountLamports = BigInt(Math.round(challenge.amount * 10 ** USDC_DECIMALS));
    tx.add(createTransferCheckedInstruction(senderATA, usdcMint, receiverATA, senderPubkey, amountLamports, USDC_DECIMALS));

    const { signature } = await provider.signAndSendTransaction(tx);
    await conn.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");
    return { sig: signature };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "payment failed";

    // Friendly error messages
    if (msg.includes("User rejected") || msg.includes("user_rejected") || msg.includes("rejected the request")) {
      return { error: "user_rejected" };
    }
    if (msg.includes("insufficient lamports") || msg.includes("0x1") || msg.includes("Insufficient funds for fee")) {
      return { error: "SOL 不足支付 Gas 費，請確保錢包有至少 0.002 SOL" };
    }
    if (msg.includes("insufficient funds") || msg.includes("Insufficient")) {
      return { error: "餘額不足，請檢查 USDC 和 SOL 餘額" };
    }
    return { error: msg };
  }
}

/**
 * Call a x402-protected endpoint.
 * On 402: extracts payment challenge, pays, retries with X-PAYMENT header.
 * On success: returns the JSON response.
 */
export async function fetchWithPayment<T>(
  url: string,
  options?: RequestInit
): Promise<{ data: T } | { error: string; needsPayment: boolean; challenge?: PaymentChallenge }> {
  // First attempt (no payment)
  const res = await fetch(url, options);

  if (res.ok) {
    const data = await res.json() as T;
    return { data };
  }

  if (res.status !== 402) {
    return { error: `HTTP ${res.status}`, needsPayment: false };
  }

  // Parse 402 challenge
  let challenge: PaymentChallenge;
  try {
    challenge = await res.json() as PaymentChallenge;
  } catch {
    return { error: "Invalid 402 response", needsPayment: true };
  }

  // Pay via Phantom or OKX wallet
  const payResult = await payWithWallet(challenge);
  if ("error" in payResult) {
    return { error: payResult.error, needsPayment: true, challenge };
  }

  // Retry with payment proof
  const retryRes = await fetch(url, {
    ...options,
    headers: {
      ...(options?.headers ?? {}),
      "X-PAYMENT": payResult.sig,
    },
  });

  if (retryRes.ok) {
    const data = await retryRes.json() as T;
    return { data };
  }

  return { error: `Payment verification failed (${retryRes.status})`, needsPayment: true };
}
