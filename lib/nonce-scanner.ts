/**
 * Durable Nonce Guardian — nonce account scanner & risk analyzer.
 * Uses native Solana RPC only (getProgramAccounts, getSignaturesForAddress).
 * No third-party REST APIs.
 */
import { Connection, PublicKey, SystemProgram } from "@solana/web3.js";

export interface NonceAccount {
  address: string;
  authority: string;
  nonce: string;         // current nonce blockhash
  lamports: number;
  isOwned: boolean;      // authority === walletAddress
  createdSignature?: string;
}

export interface RiskSignal {
  type: "foreign_authority" | "fresh_account" | "batch_created" | "unknown_authority";
  severity: "critical" | "high" | "medium" | "low";
  description: string;
  address: string;
}

export interface NonceGuardianResult {
  accounts: NonceAccount[];
  riskSignals: RiskSignal[];
  scannedAt: number;
}

/** Parse a raw nonce account data buffer (80 bytes) */
function parseNonceData(data: Buffer, address: string, lamports: number, walletAddress: string): NonceAccount | null {
  if (data.length !== 80) return null;
  try {
    // Nonce account layout:
    // [0..4]   version (u32 LE)
    // [4..8]   state (u32 LE: 0=uninitialized, 1=initialized)
    // [8..40]  authority pubkey (32 bytes)
    // [40..72] nonce blockhash (32 bytes)
    // [72..80] fee calculator (u64 lamports_per_signature)
    const state = data.readUInt32LE(4);
    if (state !== 1) return null; // uninitialized
    const authority = new PublicKey(data.slice(8, 40)).toString();
    const nonce = new PublicKey(data.slice(40, 72)).toString();
    return { address, authority, nonce, lamports, isOwned: authority === walletAddress };
  } catch {
    return null;
  }
}

/** Scan all nonce accounts associated with a wallet address */
export async function scanNonceAccounts(
  walletAddress: string,
  rpcUrl: string
): Promise<NonceGuardianResult> {
  const conn = new Connection(rpcUrl, "confirmed");
  const walletPubkey = new PublicKey(walletAddress);

  // Strategy 1: getProgramAccounts filtering by authority (offset 8)
  const owned = await conn.getProgramAccounts(SystemProgram.programId, {
    filters: [
      { dataSize: 80 },
      { memcmp: { offset: 8, bytes: walletAddress } },
    ],
  });

  const accounts: NonceAccount[] = [];

  for (const { pubkey, account } of owned) {
    const parsed = parseNonceData(
      Buffer.from(account.data),
      pubkey.toString(),
      account.lamports,
      walletAddress
    );
    if (parsed) accounts.push(parsed);
  }

  // Strategy 2: Scan recent tx signatures for nonce accounts created by others
  // where wallet was involved (e.g. user signed a tx that used a nonce account)
  // We look for SystemInstruction.InitializeNonceAccount in recent txs
  const signatures = await conn.getSignaturesForAddress(walletPubkey, { limit: 100 });
  const recentSigs = signatures.map(s => s.signature);

  if (recentSigs.length > 0) {
    // Get parsed transactions (batch of up to 20)
    const batch = recentSigs.slice(0, 20);
    const txs = await conn.getParsedTransactions(batch, {
      maxSupportedTransactionVersion: 0,
      commitment: "confirmed",
    }).catch(() => []);

    for (const tx of txs) {
      if (!tx) continue;
      for (const ix of tx.transaction.message.instructions) {
        const parsed = (ix as { parsed?: { type?: string; info?: { nonceAccount?: string; nonceAuthority?: string } } }).parsed;
        if (parsed?.type === "initializeNonceAccount" && parsed.info?.nonceAccount) {
          const nonceAddr = parsed.info.nonceAccount;
          const authority = parsed.info.nonceAuthority ?? "";
          // Check if this nonce account is already in our list
          if (!accounts.find(a => a.address === nonceAddr)) {
            // Fetch the nonce account data
            const info = await conn.getAccountInfo(new PublicKey(nonceAddr)).catch(() => null);
            if (info && info.data.length === 80) {
              const parsedAccount = parseNonceData(
                Buffer.from(info.data),
                nonceAddr,
                info.lamports,
                walletAddress
              );
              if (parsedAccount) accounts.push(parsedAccount);
            } else if (authority) {
              // Even if we can't parse, record it as a foreign nonce account
              accounts.push({
                address: nonceAddr,
                authority,
                nonce: "unknown",
                lamports: info?.lamports ?? 0,
                isOwned: authority === walletAddress,
              });
            }
          }
        }
      }
    }
  }

  const riskSignals = analyzeRisks(accounts, walletAddress);

  return { accounts, riskSignals, scannedAt: Date.now() };
}

/** Analyze nonce accounts for risk signals */
export function analyzeRisks(accounts: NonceAccount[], walletAddress: string): RiskSignal[] {
  const signals: RiskSignal[] = [];

  for (const account of accounts) {
    // Risk 1: Foreign authority (critical) — someone else controls a nonce for this wallet
    if (account.authority !== walletAddress) {
      signals.push({
        type: "foreign_authority",
        severity: "critical",
        description: `Nonce account ${account.address.slice(0, 8)}... is controlled by ${account.authority.slice(0, 8)}... — NOT your wallet. This is the attack vector used in the Drift $285M hack.`,
        address: account.address,
      });
    }
  }

  // Risk 2: Multiple nonce accounts (batch_created) — suspicious pattern
  if (accounts.length >= 3) {
    signals.push({
      type: "batch_created",
      severity: "medium",
      description: `Found ${accounts.length} nonce accounts. Attackers often create multiple to have backup pre-signed transactions ready.`,
      address: accounts[0].address,
    });
  }

  return signals;
}
