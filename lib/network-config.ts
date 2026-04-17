/**
 * Network Configuration — Mainnet-Beta / Devnet switching.
 *
 * Env var `SOLANA_NETWORK` controls target cluster:
 *  - "mainnet-beta" (default) → production RPC, real liquidations, real money
 *  - "devnet"                  → test RPC, test tokens, for hackathon demos
 *
 * All on-chain operations (Anchor mandate PDA, SPL approve, SAK lendAsset,
 * rescue execution, Memo anchoring) route through the selected cluster.
 */

export type SolanaNetwork = "mainnet-beta" | "devnet";

export interface NetworkConfig {
  network: SolanaNetwork;
  rpcUrl: string;
  usdcMint: string;
  /** sakura-mandate Anchor Program ID for this network */
  mandateProgramId: string;
  /** Solscan base URL for tx links */
  explorerBase: string;
  /** Cluster suffix for explorer (?cluster=devnet) */
  explorerSuffix: string;
}

const MANDATE_PROGRAM_DEVNET  = "AnszeCRFsBKmT5fBY9WywxGsZZZob8ZPFYqboYXpuYLp";
const MANDATE_PROGRAM_MAINNET = process.env.MANDATE_PROGRAM_MAINNET ?? MANDATE_PROGRAM_DEVNET;

const USDC_MAINNET = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
// Devnet USDC (minted by Circle; widely recognized):
const USDC_DEVNET  = "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU";

export function getNetwork(): SolanaNetwork {
  const raw = (process.env.SOLANA_NETWORK ?? "mainnet-beta").toLowerCase();
  return raw === "devnet" ? "devnet" : "mainnet-beta";
}

export function getNetworkConfig(): NetworkConfig {
  const network = getNetwork();
  const isDevnet = network === "devnet";
  const heliusKey = process.env.HELIUS_API_KEY ?? "";

  const defaultMainnet = `https://mainnet.helius-rpc.com/?api-key=${heliusKey}`;
  const defaultDevnet  = `https://devnet.helius-rpc.com/?api-key=${heliusKey}`;

  return {
    network,
    rpcUrl: process.env.HELIUS_RPC_URL ?? (isDevnet ? defaultDevnet : defaultMainnet),
    usdcMint: isDevnet ? USDC_DEVNET : USDC_MAINNET,
    mandateProgramId: isDevnet ? MANDATE_PROGRAM_DEVNET : MANDATE_PROGRAM_MAINNET,
    explorerBase: "https://solscan.io",
    explorerSuffix: isDevnet ? "?cluster=devnet" : "",
  };
}

/** Build a Solscan tx URL for the current network. */
export function explorerTxUrl(signature: string): string {
  const cfg = getNetworkConfig();
  return `${cfg.explorerBase}/tx/${signature}${cfg.explorerSuffix}`;
}

/** Build a Solscan address URL for the current network. */
export function explorerAddressUrl(address: string): string {
  const cfg = getNetworkConfig();
  return `${cfg.explorerBase}/account/${address}${cfg.explorerSuffix}`;
}
