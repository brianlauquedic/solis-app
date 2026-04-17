/**
 * Sakura Mandate Program — TypeScript Client
 *
 * Interacts with the on-chain Anchor program (sakura-mandate) that stores
 * rescue mandates as PDAs. Each wallet has one active mandate authorizing
 * the Sakura agent to execute emergency debt repayment.
 *
 * PDA: seeds = ["sakura_mandate", wallet_pubkey]
 *
 * This module provides:
 *   1. PDA derivation
 *   2. Create/update/close mandate instruction builders
 *   3. Execute rescue instruction builder (agent-only)
 *   4. Read mandate state from on-chain PDA
 */

import {
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  Connection,
} from "@solana/web3.js";
import * as borsh from "@coral-xyz/borsh"; // may need install

// ── Program ID ──────────────────────────────────────────────────────
// Replace with actual deployed program ID after `anchor deploy`
export const SAKURA_MANDATE_PROGRAM_ID = new PublicKey(
  process.env.NEXT_PUBLIC_MANDATE_PROGRAM_ID ??
    "AnszeCRFsBKmT5fBY9WywxGsZZZob8ZPFYqboYXpuYLp"
);

// ── PDA Derivation ──────────────────────────────────────────────────

export function deriveMandatePDA(
  walletPubkey: PublicKey,
  programId: PublicKey = SAKURA_MANDATE_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("sakura_mandate"), walletPubkey.toBuffer()],
    programId
  );
}

// ── On-chain State Layout ───────────────────────────────────────────

export interface RescueMandateState {
  authority: PublicKey;
  agent: PublicKey;
  maxUsdc: bigint;          // micro-USDC
  triggerHfBps: number;     // e.g., 150 = HF 1.50
  totalRescued: bigint;     // cumulative micro-USDC rescued
  rescueCount: bigint;      // u64 — supports unlimited rescues (was u8 before bug fix)
  createdAt: bigint;        // Unix timestamp
  lastRescueAt: bigint;
  isActive: boolean;
  bump: number;
}

// Anchor account discriminator: first 8 bytes of SHA-256("account:RescueMandate")
import crypto from "crypto";
const MANDATE_DISCRIMINATOR = crypto
  .createHash("sha256")
  .update("account:RescueMandate")
  .digest()
  .subarray(0, 8);

/**
 * Deserialize on-chain RescueMandate account data.
 * Layout: 8 (discriminator) + 32 + 32 + 8 + 2 + 8 + 8 + 8 + 8 + 1 + 1 = 116 bytes
 * (rescue_count widened from u8 to u64 to prevent overflow after 256 rescues)
 */
export const MANDATE_ACCOUNT_SIZE = 116;

export function deserializeMandate(data: Buffer): RescueMandateState | null {
  if (data.length < MANDATE_ACCOUNT_SIZE) return null;

  // Verify discriminator
  const disc = data.subarray(0, 8);
  if (!disc.equals(MANDATE_DISCRIMINATOR)) return null;

  let offset = 8;
  const authority = new PublicKey(data.subarray(offset, offset + 32));
  offset += 32;
  const agent = new PublicKey(data.subarray(offset, offset + 32));
  offset += 32;
  const maxUsdc = data.readBigUInt64LE(offset);
  offset += 8;
  const triggerHfBps = data.readUInt16LE(offset);
  offset += 2;
  const totalRescued = data.readBigUInt64LE(offset);
  offset += 8;
  const rescueCount = data.readBigUInt64LE(offset);
  offset += 8;
  const createdAt = data.readBigInt64LE(offset);
  offset += 8;
  const lastRescueAt = data.readBigInt64LE(offset);
  offset += 8;
  const isActive = data.readUInt8(offset) === 1;
  offset += 1;
  const bump = data.readUInt8(offset);

  return {
    authority,
    agent,
    maxUsdc,
    triggerHfBps,
    totalRescued,
    rescueCount,
    createdAt,
    lastRescueAt,
    isActive,
    bump,
  };
}

// ── Read Mandate from Chain ─────────────────────────────────────────

export async function fetchMandate(
  connection: Connection,
  walletPubkey: PublicKey
): Promise<{ pda: PublicKey; state: RescueMandateState | null }> {
  const [pda] = deriveMandatePDA(walletPubkey);
  try {
    const accountInfo = await connection.getAccountInfo(pda);
    if (!accountInfo || !accountInfo.data) {
      return { pda, state: null };
    }
    const state = deserializeMandate(Buffer.from(accountInfo.data));
    return { pda, state };
  } catch {
    return { pda, state: null };
  }
}

// ── Anchor Instruction Discriminators ───────────────────────────────
// Anchor uses SHA-256("global:<function_name>")[0..8] as instruction discriminator

function anchorDiscriminator(name: string): Buffer {
  return crypto
    .createHash("sha256")
    .update(`global:${name}`)
    .digest()
    .subarray(0, 8) as Buffer;
}

const IX_CREATE = anchorDiscriminator("create_mandate");
const IX_EXECUTE = anchorDiscriminator("execute_rescue");
const IX_UPDATE = anchorDiscriminator("update_mandate");
const IX_CLOSE = anchorDiscriminator("close_mandate");

// ── Instruction Builders ────────────────────────────────────────────

/**
 * Build create_mandate instruction.
 * User signs this to create a PDA authorizing the agent.
 */
export function buildCreateMandateIx(
  authority: PublicKey,
  agent: PublicKey,
  maxUsdc: bigint,        // micro-USDC (e.g., 1000_000_000 = $1000)
  triggerHfBps: number,   // e.g., 150 = HF 1.50
): TransactionInstruction {
  const [mandatePda] = deriveMandatePDA(authority);

  // Serialize: max_usdc (u64 LE) + trigger_hf_bps (u16 LE)
  const data = Buffer.alloc(8 + 8 + 2);
  IX_CREATE.copy(data, 0);
  data.writeBigUInt64LE(maxUsdc, 8);
  data.writeUInt16LE(triggerHfBps, 16);

  return new TransactionInstruction({
    programId: SAKURA_MANDATE_PROGRAM_ID,
    keys: [
      { pubkey: mandatePda, isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: true },
      { pubkey: agent, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

/**
 * Build execute_rescue instruction.
 * Agent signs this to execute a rescue transfer.
 *
 * Account order MUST match the Anchor program's ExecuteRescue struct:
 *   1. mandate PDA (writable)
 *   2. agent (signer, SPL delegate on user_usdc_ata)
 *   3. user_usdc_ata (writable, source)
 *   4. repay_vault (writable, destination, must be USDC mint)
 *   5. usdc_mint
 *   6. token_program
 *   7. associated_token_program
 */
export const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
export const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
);

export function buildExecuteRescueIx(
  mandatePda: PublicKey,
  agent: PublicKey,
  userUsdcAta: PublicKey,
  repayVault: PublicKey,
  usdcMint: PublicKey,
  rescueAmount: bigint,     // micro-USDC
  reportedHfBps: number,
  proofHash: Buffer,        // 32 bytes SHA-256
): TransactionInstruction {
  if (proofHash.length !== 32) {
    throw new Error(`proofHash must be exactly 32 bytes, got ${proofHash.length}`);
  }

  // Serialize: rescue_amount (u64) + reported_hf_bps (u16) + proof_hash ([u8; 32])
  const data = Buffer.alloc(8 + 8 + 2 + 32);
  IX_EXECUTE.copy(data, 0);
  data.writeBigUInt64LE(rescueAmount, 8);
  data.writeUInt16LE(reportedHfBps, 16);
  proofHash.copy(data, 18, 0, 32);

  return new TransactionInstruction({
    programId: SAKURA_MANDATE_PROGRAM_ID,
    keys: [
      { pubkey: mandatePda, isSigner: false, isWritable: true },
      { pubkey: agent, isSigner: true, isWritable: false },
      { pubkey: userUsdcAta, isSigner: false, isWritable: true },
      { pubkey: repayVault, isSigner: false, isWritable: true },
      { pubkey: usdcMint, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: ASSOCIATED_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data,
  });
}

/**
 * Build update_mandate instruction.
 * User signs this to update their mandate parameters.
 */
export function buildUpdateMandateIx(
  authority: PublicKey,
  newMaxUsdc?: bigint,
  newTriggerHfBps?: number,
): TransactionInstruction {
  const [mandatePda] = deriveMandatePDA(authority);

  // Serialize: Option<u64> + Option<u16>
  // Anchor Option: 1 byte flag (0=None, 1=Some) + value if Some
  const parts: Buffer[] = [IX_UPDATE];

  if (newMaxUsdc !== undefined) {
    const buf = Buffer.alloc(9);
    buf.writeUInt8(1, 0); // Some
    buf.writeBigUInt64LE(newMaxUsdc, 1);
    parts.push(buf);
  } else {
    parts.push(Buffer.from([0])); // None
  }

  if (newTriggerHfBps !== undefined) {
    const buf = Buffer.alloc(3);
    buf.writeUInt8(1, 0); // Some
    buf.writeUInt16LE(newTriggerHfBps, 1);
    parts.push(buf);
  } else {
    parts.push(Buffer.from([0])); // None
  }

  return new TransactionInstruction({
    programId: SAKURA_MANDATE_PROGRAM_ID,
    keys: [
      { pubkey: mandatePda, isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: false },
    ],
    data: Buffer.concat(parts),
  });
}

/**
 * Build close_mandate instruction.
 * User signs to revoke agent authority and reclaim rent.
 */
export function buildCloseMandateIx(
  authority: PublicKey,
): TransactionInstruction {
  const [mandatePda] = deriveMandatePDA(authority);

  return new TransactionInstruction({
    programId: SAKURA_MANDATE_PROGRAM_ID,
    keys: [
      { pubkey: mandatePda, isSigner: false, isWritable: true },
      { pubkey: authority, isSigner: true, isWritable: true },
    ],
    data: IX_CLOSE,
  });
}

// ── Utility ─────────────────────────────────────────────────────────

/** Convert USDC amount to micro-USDC (6 decimals) */
export function usdcToMicro(usdc: number): bigint {
  return BigInt(Math.ceil(usdc * 1_000_000));
}

/** Convert micro-USDC to USDC */
export function microToUsdc(micro: bigint): number {
  return Number(micro) / 1_000_000;
}

/** Format mandate state for API response */
export function formatMandateState(state: RescueMandateState) {
  return {
    authority: state.authority.toString(),
    agent: state.agent.toString(),
    maxUsdc: microToUsdc(state.maxUsdc),
    triggerHf: state.triggerHfBps / 100,
    totalRescued: microToUsdc(state.totalRescued),
    // rescueCount is bigint (u64 on-chain); convert for JSON. Number is safe
    // up to 2^53 — more than enough for rescue counters.
    rescueCount: Number(state.rescueCount),
    remainingUsdc: microToUsdc(state.maxUsdc - state.totalRescued),
    createdAt: new Date(Number(state.createdAt) * 1000).toISOString(),
    lastRescueAt: state.lastRescueAt > 0
      ? new Date(Number(state.lastRescueAt) * 1000).toISOString()
      : null,
    isActive: state.isActive,
  };
}
