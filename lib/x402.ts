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

/**
 * Create and send a Solana USDC transfer transaction via Phantom.
 * Returns the tx signature on success.
 */
export async function payWithPhantom(
  challenge: PaymentChallenge
): Promise<{ sig: string } | { error: string }> {
  if (!window.solana?.isPhantom) return { error: "no_wallet" };

  try {
    const {
      Connection, PublicKey, Transaction,
      SystemProgram,
    } = await import("@solana/web3.js");

    // Lazy-load token program for USDC transfers
    const { createTransferCheckedInstruction, getAssociatedTokenAddress, createAssociatedTokenAccountInstruction, getAccount } =
      await import("@solana/spl-token").catch(() => ({ createTransferCheckedInstruction: null, getAssociatedTokenAddress: null, createAssociatedTokenAccountInstruction: null, getAccount: null }));

    if (!createTransferCheckedInstruction || !getAssociatedTokenAddress) {
      return { error: "spl-token not available" };
    }

    const RPC = typeof window !== "undefined"
      ? "/api/rpc"
      : `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY ?? ""}`;
    const conn = new Connection(RPC, "confirmed");

    await window.solana.connect({ onlyIfTrusted: true });
    const senderPubkey = new PublicKey(window.solana.publicKey!.toString());
    const recipientPubkey = new PublicKey(challenge.recipient);
    const usdcMint = new PublicKey(USDC_MINT);

    const senderATA  = await getAssociatedTokenAddress(usdcMint, senderPubkey);
    const receiverATA = await getAssociatedTokenAddress(usdcMint, recipientPubkey);

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

    const { signature } = await window.solana.signAndSendTransaction(tx);
    await conn.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, "confirmed");
    return { sig: signature };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "payment failed";
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

  // Pay via Phantom
  const payResult = await payWithPhantom(challenge);
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
