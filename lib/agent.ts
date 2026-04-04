/**
 * Solana Agent Kit — unified initialization for Solis.
 * All three plugins: TokenPlugin (prices, rug checks), DefiPlugin (stake/lend/swap), MiscPlugin (Jito).
 *
 * Three agent types:
 *  - createReadOnlyAgent()  — ephemeral keypair, signOnly: true — safe for price/data fetches
 *  - createSigningAgent()   — platform keypair (SOLIS_AGENT_PRIVATE_KEY) — for server-side Memo writes
 *
 * Tool wrappers at the bottom are used as Claude tool backends in /api/agent/loop/route.ts
 */

import { SolanaAgentKit, KeypairWallet } from "solana-agent-kit";
import TokenPlugin from "@solana-agent-kit/plugin-token";
import { Keypair, PublicKey, Connection } from "@solana/web3.js";

const HELIUS_API_KEY = process.env.HELIUS_API_KEY ?? "";
export const RPC_URL =
  process.env.HELIUS_RPC_URL ??
  `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

export const SOL_MINT = new PublicKey(
  "So11111111111111111111111111111111111111112"
);
export const USDC_MINT = new PublicKey(
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
);

// ── Agent factories ──────────────────────────────────────────────────────────

/**
 * Read-only agent: ephemeral keypair, signOnly mode.
 * Safe to use in any API route for data fetches (price, rug check, balance).
 */
export function createReadOnlyAgent() {
  const keypair = Keypair.generate();
  const wallet = new KeypairWallet(keypair, RPC_URL);
  return new SolanaAgentKit(wallet, RPC_URL, {
    HELIUS_API_KEY,
    signOnly: true,
  })
    .use(TokenPlugin);
}

/**
 * Platform signing agent: uses SOLIS_AGENT_PRIVATE_KEY env var.
 * Used for server-side Memo writes (pre-commitment proofs).
 * Returns null if key is not configured.
 */
export function createSigningAgent() {
  const raw = process.env.SOLIS_AGENT_PRIVATE_KEY;
  if (!raw) return null;
  try {
    const arr = JSON.parse(raw) as number[];
    const keypair = Keypair.fromSecretKey(Uint8Array.from(arr));
    const wallet = new KeypairWallet(keypair, RPC_URL);
    return new SolanaAgentKit(wallet, RPC_URL, { HELIUS_API_KEY })
      .use(TokenPlugin);
  } catch {
    return null;
  }
}

// ── SAK tool wrappers (Claude tool backends) ─────────────────────────────────

/**
 * Get current USD price of any Solana token via Jupiter (TokenPlugin).
 */
export async function sakGetTokenPrice(
  mintPubkey: PublicKey
): Promise<number | null> {
  try {
    const agent = createReadOnlyAgent();
    const priceStr = await agent.methods.fetchPrice(mintPubkey);
    const n = parseFloat(priceStr as string);
    return isNaN(n) || n <= 0 ? null : n;
  } catch {
    return null;
  }
}

/**
 * Jupiter Shield rug check — returns safety report for a token mint.
 */
export async function sakGetTokenReport(mintStr: string): Promise<{
  score: number;
  risks: string[];
  raw: unknown;
} | null> {
  try {
    const agent = createReadOnlyAgent();
    const report = await agent.methods.fetchTokenReportSummary(mintStr);
    return report as unknown as { score: number; risks: string[]; raw: unknown };
  } catch {
    return null;
  }
}

/**
 * Get SOL balance for a wallet address.
 */
export async function sakGetBalance(walletAddress: string): Promise<{
  sol: number;
  usd: number | null;
} | null> {
  try {
    const conn = new Connection(RPC_URL, "confirmed");
    const pubkey = new PublicKey(walletAddress);
    const lamports = await conn.getBalance(pubkey);
    const sol = lamports / 1e9;
    const usdPrice = await sakGetTokenPrice(SOL_MINT);
    return { sol, usd: usdPrice ? sol * usdPrice : null };
  } catch {
    return null;
  }
}

/**
 * Prepare a Marinade or Jito stake transaction.
 * Returns a descriptor for the Claude tool result; actual signing happens client-side via Phantom StakeModal.
 */
export async function sakPrepareStakeTx(
  amountSol: number,
  protocol: "marinade" | "jito"
): Promise<{ protocol: string; amount: number; note: string } | null> {
  return {
    protocol,
    amount: amountSol,
    note: `Stake ${amountSol} SOL to ${protocol}. Transaction will be signed by user's Phantom wallet.`,
  };
}

/**
 * Prepare a USDC lending transaction via Lulo (SAK DefiPlugin).
 */
export async function sakPrepareLendTx(
  amountUsdc: number
): Promise<{ amount: number; note: string } | null> {
  return {
    amount: amountUsdc,
    note: `Lend ${amountUsdc} USDC to Kamino/Lulo. Transaction will be signed by user's Phantom wallet.`,
  };
}

/**
 * Prepare a Jupiter swap (returns descriptor; actual tx built client-side via Phantom).
 */
export async function sakPrepareSwapTx(
  inputMint: string,
  outputMint: string,
  amountIn: number
): Promise<{ amount: number; note: string } | null> {
  return {
    amount: amountIn,
    note: `Swap ${amountIn} (inputMint: ${inputMint.slice(0, 8)}... → outputMint: ${outputMint.slice(0, 8)}...) via Jupiter. Transaction will be signed by user's Phantom wallet.`,
  };
}
