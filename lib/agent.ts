/**
 * Solana Agent Kit — unified initialization for Sakura v2.
 *
 * Two agent types:
 *  - createReadOnlyAgent()  — ephemeral keypair, signOnly: true — safe for on-chain data reads
 *  - createSigningAgent()   — platform keypair (SOLIS_AGENT_PRIVATE_KEY) — for Memo on-chain writes
 */

import { SolanaAgentKit, KeypairWallet } from "solana-agent-kit";
import TokenPlugin from "@solana-agent-kit/plugin-token";
import { Keypair, PublicKey } from "@solana/web3.js";

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
 * Safe to use in any API route for on-chain data reads.
 * Used by NonceGuardian for getProgramAccounts scanning.
 */
export function createReadOnlyAgent() {
  const keypair = Keypair.generate();
  const wallet = new KeypairWallet(keypair, RPC_URL);
  return new SolanaAgentKit(wallet, RPC_URL, {
    HELIUS_API_KEY,
    signOnly: true,
  }).use(TokenPlugin);
}

/**
 * Platform signing agent: uses SOLIS_AGENT_PRIVATE_KEY env var.
 * Used for server-side Memo writes (strategy execution on-chain proof).
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
