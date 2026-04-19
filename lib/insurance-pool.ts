/**
 * Sakura Mutual Insurance Pool — TypeScript Client (v0.2)
 *
 * Interacts with the on-chain Anchor program `sakura_insurance` at
 * `programs/sakura-insurance/src/lib.rs`.
 *
 * v0.2 is the **mutual self-insurance** model:
 *   - No external LPs. Users buy policies + post refundable stake.
 *   - Premium splits: `platform_fee_bps → treasury`, rest → pool vault.
 *   - Claims are gated by on-chain Groth16 pairing (no agent trust).
 *   - Oracle price + slot are public inputs; chain enforces freshness.
 *
 * This module provides:
 *   1. PDA derivation for Pool / Policy / ClaimRecord
 *   2. Typed Anchor instruction builders (no @coral-xyz/anchor runtime)
 *   3. Borsh-compatible account deserializers
 *
 * Design notes:
 *   - Uses raw @solana/web3.js + crypto.sha256 for Anchor discriminators.
 *   - Policy commitment_hash is `Poseidon(obligation, wallet, nonce)` —
 *     computed by `computePolicyCommitment` in `lib/zk-proof.ts`.
 */

import {
  PublicKey,
  SystemProgram,
  TransactionInstruction,
  Connection,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import crypto from "crypto";

// ── Program ID ──────────────────────────────────────────────────────
// .trim() defends against accidental whitespace/newlines in the env
// value (e.g. when added via `echo "..." | vercel env add`). A stray
// `\n` in the pubkey turns the base58 parse into a "Non-base58
// character" crash at module load — which kills every route that
// imports this file.
export const SAKURA_INSURANCE_PROGRAM_ID = new PublicKey(
  (process.env.NEXT_PUBLIC_INSURANCE_PROGRAM_ID ?? "").trim() ||
    // v0.3 — redeployed at Ansze... after Pyth-tag-parsing fix in lib.rs.
    // The old A91n... binary inverted VerificationLevel discriminants
    // (treated tag=1 as Partial), corrupting every posted_slot read and
    // making every claim_payout_with_zk_proof revert with OraclePriceMismatch.
    "AnszeCRFsBKmT5fBY9WywxGsZZZob8ZPFYqboYXpuYLp"
);

export const TOKEN_PROGRAM_ID = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
);

// USDC mints (override in env if running devnet with a test mint)
export const USDC_MINT_MAINNET = new PublicKey(
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
);
export const USDC_MINT_DEVNET = new PublicKey(
  "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU"
);

// ── PDA Derivation ──────────────────────────────────────────────────

export function derivePoolPDA(
  admin: PublicKey,
  programId: PublicKey = SAKURA_INSURANCE_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("sakura_pool_v2"), admin.toBuffer()],
    programId
  );
}

export function deriveVaultPDA(
  pool: PublicKey,
  programId: PublicKey = SAKURA_INSURANCE_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("sakura_vault"), pool.toBuffer()],
    programId
  );
}

export function derivePolicyPDA(
  user: PublicKey,
  programId: PublicKey = SAKURA_INSURANCE_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("sakura_policy"), user.toBuffer()],
    programId
  );
}

export function deriveClaimRecordPDA(
  policy: PublicKey,
  claimNonce: bigint,
  programId: PublicKey = SAKURA_INSURANCE_PROGRAM_ID
): [PublicKey, number] {
  const nonceBuf = Buffer.alloc(8);
  nonceBuf.writeBigUInt64LE(claimNonce, 0);
  return PublicKey.findProgramAddressSync(
    [Buffer.from("sakura_claim"), policy.toBuffer(), nonceBuf],
    programId
  );
}

// ── Anchor discriminators ───────────────────────────────────────────

function anchorIxDiscriminator(name: string): Buffer {
  return crypto
    .createHash("sha256")
    .update(`global:${name}`)
    .digest()
    .subarray(0, 8) as Buffer;
}

function anchorAccountDiscriminator(name: string): Buffer {
  return crypto
    .createHash("sha256")
    .update(`account:${name}`)
    .digest()
    .subarray(0, 8) as Buffer;
}

const IX_INIT_POOL = anchorIxDiscriminator("initialize_pool");
const IX_ROTATE_AGENT = anchorIxDiscriminator("rotate_admin_agent");
const IX_SET_PAUSED = anchorIxDiscriminator("set_paused");
const IX_BUY_POLICY = anchorIxDiscriminator("buy_policy");
const IX_CLOSE_POLICY = anchorIxDiscriminator("close_policy");
const IX_CLAIM_PAYOUT_ZK = anchorIxDiscriminator("claim_payout_with_zk_proof");

const ACCT_POOL = anchorAccountDiscriminator("Pool");
const ACCT_POLICY = anchorAccountDiscriminator("Policy");
const ACCT_CLAIM = anchorAccountDiscriminator("ClaimRecord");

// ── Account state types (v0.2 layout) ───────────────────────────────

export interface PoolState {
  admin: PublicKey;
  adminAgent: PublicKey;
  platformTreasury: PublicKey;
  usdcMint: PublicKey;
  usdcVault: PublicKey;
  totalStakes: bigint;
  coverageOutstanding: bigint;
  totalClaimsPaid: bigint;
  premiumBps: number;
  platformFeeBps: number;
  minStakeMultiplier: number;
  maxCoveragePerUserUsdc: bigint;
  waitingPeriodSec: bigint;
  paused: boolean;
  bump: number;
}

export interface PolicyState {
  user: PublicKey;
  coverageCapUsdc: bigint;
  premiumPaidMicro: bigint;
  stakeUsdc: bigint;
  paidThroughUnix: bigint;
  boughtAtUnix: bigint;
  totalClaimed: bigint;
  rescueCount: bigint;
  commitmentHash: Buffer; // 32 bytes
  isActive: boolean;
  bump: number;
}

export interface ClaimRecordState {
  policy: PublicKey;
  amountUsdc: bigint;
  rescueSigHash: Buffer;
  claimNonce: bigint;
  ts: bigint;
  bump: number;
}

// ── Deserializers ───────────────────────────────────────────────────

export function deserializePool(data: Buffer): PoolState | null {
  // 8 (disc) + 32*5 + 8*3 + 2*3 + 8 + 8 + 1 + 1 = 196
  if (data.length < 196) return null;
  if (!data.subarray(0, 8).equals(ACCT_POOL)) return null;

  let o = 8;
  const admin = new PublicKey(data.subarray(o, o + 32)); o += 32;
  const adminAgent = new PublicKey(data.subarray(o, o + 32)); o += 32;
  const platformTreasury = new PublicKey(data.subarray(o, o + 32)); o += 32;
  const usdcMint = new PublicKey(data.subarray(o, o + 32)); o += 32;
  const usdcVault = new PublicKey(data.subarray(o, o + 32)); o += 32;
  const totalStakes = data.readBigUInt64LE(o); o += 8;
  const coverageOutstanding = data.readBigUInt64LE(o); o += 8;
  const totalClaimsPaid = data.readBigUInt64LE(o); o += 8;
  const premiumBps = data.readUInt16LE(o); o += 2;
  const platformFeeBps = data.readUInt16LE(o); o += 2;
  const minStakeMultiplier = data.readUInt16LE(o); o += 2;
  const maxCoveragePerUserUsdc = data.readBigUInt64LE(o); o += 8;
  const waitingPeriodSec = data.readBigInt64LE(o); o += 8;
  const paused = data.readUInt8(o) === 1; o += 1;
  const bump = data.readUInt8(o);

  return {
    admin, adminAgent, platformTreasury, usdcMint, usdcVault,
    totalStakes, coverageOutstanding, totalClaimsPaid,
    premiumBps, platformFeeBps, minStakeMultiplier,
    maxCoveragePerUserUsdc, waitingPeriodSec, paused, bump,
  };
}

export function deserializePolicy(data: Buffer): PolicyState | null {
  // 8 (disc) + 32 + 8*7 + 32 + 1 + 1 = 130
  if (data.length < 130) return null;
  if (!data.subarray(0, 8).equals(ACCT_POLICY)) return null;

  let o = 8;
  const user = new PublicKey(data.subarray(o, o + 32)); o += 32;
  const coverageCapUsdc = data.readBigUInt64LE(o); o += 8;
  const premiumPaidMicro = data.readBigUInt64LE(o); o += 8;
  const stakeUsdc = data.readBigUInt64LE(o); o += 8;
  const paidThroughUnix = data.readBigInt64LE(o); o += 8;
  const boughtAtUnix = data.readBigInt64LE(o); o += 8;
  const totalClaimed = data.readBigUInt64LE(o); o += 8;
  const rescueCount = data.readBigUInt64LE(o); o += 8;
  const commitmentHash = Buffer.from(data.subarray(o, o + 32)); o += 32;
  const isActive = data.readUInt8(o) === 1; o += 1;
  const bump = data.readUInt8(o);

  return {
    user, coverageCapUsdc, premiumPaidMicro, stakeUsdc,
    paidThroughUnix, boughtAtUnix, totalClaimed, rescueCount,
    commitmentHash, isActive, bump,
  };
}

export function deserializeClaimRecord(data: Buffer): ClaimRecordState | null {
  if (data.length < 8 + 32 + 8 + 32 + 8 + 8 + 1) return null;
  if (!data.subarray(0, 8).equals(ACCT_CLAIM)) return null;

  let o = 8;
  const policy = new PublicKey(data.subarray(o, o + 32)); o += 32;
  const amountUsdc = data.readBigUInt64LE(o); o += 8;
  const rescueSigHash = Buffer.from(data.subarray(o, o + 32)); o += 32;
  const claimNonce = data.readBigUInt64LE(o); o += 8;
  const ts = data.readBigInt64LE(o); o += 8;
  const bump = data.readUInt8(o);

  return { policy, amountUsdc, rescueSigHash, claimNonce, ts, bump };
}

// ── On-chain fetch helpers ──────────────────────────────────────────

export async function fetchPool(
  connection: Connection,
  admin: PublicKey
): Promise<{ pda: PublicKey; state: PoolState | null }> {
  const [pda] = derivePoolPDA(admin);
  const info = await connection.getAccountInfo(pda);
  if (!info) return { pda, state: null };
  return { pda, state: deserializePool(Buffer.from(info.data)) };
}

export async function fetchPolicy(
  connection: Connection,
  user: PublicKey
): Promise<{ pda: PublicKey; state: PolicyState | null }> {
  const [pda] = derivePolicyPDA(user);
  const info = await connection.getAccountInfo(pda);
  if (!info) return { pda, state: null };
  return { pda, state: deserializePolicy(Buffer.from(info.data)) };
}

// ── Instruction builders (v0.2) ─────────────────────────────────────

/**
 * initialize_pool: admin creates the pool PDA + vault token account.
 *
 * Args:
 *   premium_bps            (u16)   bps/month of coverage_cap (1..=1000)
 *   platform_fee_bps       (u16)   bps of premium → treasury (0..=3000)
 *   min_stake_multiplier   (u16)   stake ≥ this/100 × premium (≥100)
 *   max_coverage_per_user  (u64)   per-user coverage cap (micro-USDC)
 *   waiting_period_sec     (i64)   seconds before first claim (0..=30d)
 */
export function buildInitializePoolIx(params: {
  admin: PublicKey;
  adminAgent: PublicKey;
  usdcMint: PublicKey;
  platformTreasury: PublicKey;
  premiumBps: number;
  platformFeeBps: number;
  minStakeMultiplier: number;
  maxCoveragePerUserUsdc: bigint;
  waitingPeriodSec: bigint;
}): TransactionInstruction {
  const {
    admin, adminAgent, usdcMint, platformTreasury,
    premiumBps, platformFeeBps, minStakeMultiplier,
    maxCoveragePerUserUsdc, waitingPeriodSec,
  } = params;
  const [pool] = derivePoolPDA(admin);
  const [vault] = deriveVaultPDA(pool);

  // 8 disc + 2 + 2 + 2 + 8 + 8 = 30 bytes
  const data = Buffer.alloc(8 + 2 + 2 + 2 + 8 + 8);
  IX_INIT_POOL.copy(data, 0);
  data.writeUInt16LE(premiumBps, 8);
  data.writeUInt16LE(platformFeeBps, 10);
  data.writeUInt16LE(minStakeMultiplier, 12);
  data.writeBigUInt64LE(maxCoveragePerUserUsdc, 14);
  data.writeBigInt64LE(waitingPeriodSec, 22);

  return new TransactionInstruction({
    programId: SAKURA_INSURANCE_PROGRAM_ID,
    keys: [
      { pubkey: pool, isSigner: false, isWritable: true },
      { pubkey: admin, isSigner: true, isWritable: true },
      { pubkey: adminAgent, isSigner: false, isWritable: false },
      { pubkey: usdcMint, isSigner: false, isWritable: false },
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: platformTreasury, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ],
    data,
  });
}

/** rotate_admin_agent: admin updates the legacy-path agent pubkey. */
export function buildRotateAdminAgentIx(params: {
  admin: PublicKey;
  newAgent: PublicKey;
}): TransactionInstruction {
  const [pool] = derivePoolPDA(params.admin);
  const data = Buffer.alloc(8 + 32);
  IX_ROTATE_AGENT.copy(data, 0);
  params.newAgent.toBuffer().copy(data, 8);

  return new TransactionInstruction({
    programId: SAKURA_INSURANCE_PROGRAM_ID,
    keys: [
      { pubkey: pool, isSigner: false, isWritable: true },
      { pubkey: params.admin, isSigner: true, isWritable: false },
    ],
    data,
  });
}

/** set_paused: admin pauses / unpauses the pool. */
export function buildSetPausedIx(params: {
  admin: PublicKey;
  paused: boolean;
}): TransactionInstruction {
  const [pool] = derivePoolPDA(params.admin);
  const data = Buffer.alloc(8 + 1);
  IX_SET_PAUSED.copy(data, 0);
  data.writeUInt8(params.paused ? 1 : 0, 8);

  return new TransactionInstruction({
    programId: SAKURA_INSURANCE_PROGRAM_ID,
    keys: [
      { pubkey: pool, isSigner: false, isWritable: true },
      { pubkey: params.admin, isSigner: true, isWritable: false },
    ],
    data,
  });
}

/**
 * buy_policy (v0.2): user pays premium + stake and registers a ZK
 * commitment. On first call this opens a new Policy PDA; subsequent
 * calls extend term, top up stake, and (optionally) rotate commitment.
 *
 * Args:
 *   premium_amount_usdc (u64, micro)    — split into treasury fee + pool
 *   coverage_cap_usdc   (u64, micro)    — max payout over life of policy
 *   stake_amount_usdc   (u64, micro)    — refundable, last-loss tranche
 *   commitment_hash     ([u8;32])       — Poseidon(obligation, wallet, nonce)
 */
export function buildBuyPolicyIx(params: {
  poolAdmin: PublicKey;
  user: PublicKey;
  userUsdcAta: PublicKey;
  platformTreasury: PublicKey;
  premiumMicroUsdc: bigint;
  coverageCapMicroUsdc: bigint;
  stakeMicroUsdc: bigint;
  commitmentHash: Buffer; // 32 bytes
}): TransactionInstruction {
  if (params.commitmentHash.length !== 32) {
    throw new Error(
      `commitmentHash must be 32 bytes, got ${params.commitmentHash.length}`
    );
  }
  const [pool] = derivePoolPDA(params.poolAdmin);
  const [vault] = deriveVaultPDA(pool);
  const [policy] = derivePolicyPDA(params.user);

  // 8 disc + 8 + 8 + 8 + 32 = 64 bytes
  const data = Buffer.alloc(8 + 8 + 8 + 8 + 32);
  IX_BUY_POLICY.copy(data, 0);
  data.writeBigUInt64LE(params.premiumMicroUsdc, 8);
  data.writeBigUInt64LE(params.coverageCapMicroUsdc, 16);
  data.writeBigUInt64LE(params.stakeMicroUsdc, 24);
  params.commitmentHash.copy(data, 32, 0, 32);

  return new TransactionInstruction({
    programId: SAKURA_INSURANCE_PROGRAM_ID,
    keys: [
      { pubkey: pool, isSigner: false, isWritable: true },
      { pubkey: policy, isSigner: false, isWritable: true },
      { pubkey: params.user, isSigner: true, isWritable: true },
      { pubkey: params.userUsdcAta, isSigner: false, isWritable: true },
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: params.platformTreasury, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

/**
 * close_policy: deactivate, refund unused premium + pro-rata stake.
 * Stake refund is haircut if claims drained the pool (last-loss tranche).
 */
export function buildClosePolicyIx(params: {
  poolAdmin: PublicKey;
  user: PublicKey;
  userUsdcAta: PublicKey;
}): TransactionInstruction {
  const [pool] = derivePoolPDA(params.poolAdmin);
  const [vault] = deriveVaultPDA(pool);
  const [policy] = derivePolicyPDA(params.user);

  return new TransactionInstruction({
    programId: SAKURA_INSURANCE_PROGRAM_ID,
    keys: [
      { pubkey: pool, isSigner: false, isWritable: true },
      { pubkey: policy, isSigner: false, isWritable: true },
      { pubkey: params.user, isSigner: true, isWritable: false },
      { pubkey: params.userUsdcAta, isSigner: false, isWritable: true },
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: IX_CLOSE_POLICY,
  });
}

/**
 * claim_payout_with_zk_proof (v0.2 ZK-verified claim):
 *
 * Submits a Groth16 proof (produced by snarkjs from the circuit at
 * `circuits/src/liquidation_proof.circom`) to the on-chain alt_bn128
 * pairing verifier. No agent signature is required — math, not trust.
 *
 * Public inputs (MUST match circuit order):
 *   [0] policy_commitment      — read from Policy PDA on-chain
 *   [1] trigger_hf_bps         — e.g. 10500 ⇒ HF < 1.05
 *   [2] rescue_amount_bucket   — buckets of 100 USDC
 *   [3] oracle_price_usd_micro — Pyth price × 1e6
 *   [4] oracle_slot            — Pyth publish slot (must be ≤150 slots old)
 *
 * Proof bytes are in BN254 big-endian encoding with α₁ negated
 * (prepared-alpha convention). See `proofToOnchainBytes` in
 * `lib/zk-proof.ts`.
 */
export function buildClaimPayoutWithZkProofIx(params: {
  poolAdmin: PublicKey;
  policyUser: PublicKey;
  payer: PublicKey;
  rescueDestinationAta: PublicKey;
  pythPriceAccount: PublicKey;
  amountMicroUsdc: bigint;
  claimNonce: bigint;
  triggerHfBps: number;        // 10000..=20000
  rescueAmountBucket: number;  // u32
  oraclePriceUsdMicro: bigint;
  oracleSlot: bigint;
  proofA: Uint8Array;          // 64 bytes
  proofB: Uint8Array;          // 128 bytes
  proofC: Uint8Array;          // 64 bytes
}): TransactionInstruction {
  if (params.proofA.length !== 64) {
    throw new Error(`proofA must be 64 bytes, got ${params.proofA.length}`);
  }
  if (params.proofB.length !== 128) {
    throw new Error(`proofB must be 128 bytes, got ${params.proofB.length}`);
  }
  if (params.proofC.length !== 64) {
    throw new Error(`proofC must be 64 bytes, got ${params.proofC.length}`);
  }

  const [pool] = derivePoolPDA(params.poolAdmin);
  const [vault] = deriveVaultPDA(pool);
  const [policy] = derivePolicyPDA(params.policyUser);
  const [claimRecord] = deriveClaimRecordPDA(policy, params.claimNonce);

  // Layout:
  //   8  disc
  //   8  amount_usdc        (u64)
  //   8  claim_nonce        (u64)
  //   2  trigger_hf_bps     (u16)
  //   4  rescue_bucket      (u32)
  //   8  oracle_price       (u64)
  //   8  oracle_slot        (u64)
  //   64 proof_a
  //   128 proof_b
  //   64 proof_c
  // total = 302 bytes
  const data = Buffer.alloc(8 + 8 + 8 + 2 + 4 + 8 + 8 + 64 + 128 + 64);
  let o = 0;
  IX_CLAIM_PAYOUT_ZK.copy(data, o); o += 8;
  data.writeBigUInt64LE(params.amountMicroUsdc, o); o += 8;
  data.writeBigUInt64LE(params.claimNonce, o); o += 8;
  data.writeUInt16LE(params.triggerHfBps, o); o += 2;
  data.writeUInt32LE(params.rescueAmountBucket, o); o += 4;
  data.writeBigUInt64LE(params.oraclePriceUsdMicro, o); o += 8;
  data.writeBigUInt64LE(params.oracleSlot, o); o += 8;
  Buffer.from(params.proofA).copy(data, o); o += 64;
  Buffer.from(params.proofB).copy(data, o); o += 128;
  Buffer.from(params.proofC).copy(data, o); o += 64;

  return new TransactionInstruction({
    programId: SAKURA_INSURANCE_PROGRAM_ID,
    keys: [
      { pubkey: pool, isSigner: false, isWritable: true },
      { pubkey: policy, isSigner: false, isWritable: true },
      { pubkey: params.payer, isSigner: true, isWritable: true },
      { pubkey: claimRecord, isSigner: false, isWritable: true },
      { pubkey: vault, isSigner: false, isWritable: true },
      { pubkey: params.rescueDestinationAta, isSigner: false, isWritable: true },
      { pubkey: params.pythPriceAccount, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

// ── Pyth price feed addresses (SOL/USD PriceUpdateV2) ───────────────
// Devnet/mainnet Pyth "Pull" oracle (PriceUpdateV2) SOL/USD accounts.
// Source: https://www.pyth.network/developers/price-feed-ids
export const PYTH_SOL_USD_DEVNET = new PublicKey(
  "7UVimffxr9ow1uXYxsr4LHAcV58mLzhmwaeKvJ1pjLiE"
);
export const PYTH_SOL_USD_MAINNET = new PublicKey(
  "7UVimffxr9ow1uXYxsr4LHAcV58mLzhmwaeKvJ1pjLiE"
);

// ── High-level helpers ──────────────────────────────────────────────

/**
 * Check whether a ZK rescue claim is eligible for this user:
 *   - Policy PDA exists and is active
 *   - now ≥ bought_at + pool.waiting_period_sec
 *   - now ≤ paid_through + 48h grace
 *   - (coverage_cap - total_claimed) ≥ rescueMicroUsdc
 */
export async function checkClaimEligibility(params: {
  connection: Connection;
  poolAdmin: PublicKey;
  user: PublicKey;
  rescueMicroUsdc: bigint;
  nowUnix?: number;
}): Promise<{
  eligible: boolean;
  policyPda: PublicKey;
  policy: PolicyState | null;
  reason?: string;
}> {
  const now = params.nowUnix ?? Math.floor(Date.now() / 1000);
  const [{ state: pool }, { pda, state }] = await Promise.all([
    fetchPool(params.connection, params.poolAdmin),
    fetchPolicy(params.connection, params.user),
  ]);

  if (!pool) {
    return { eligible: false, policyPda: pda, policy: state, reason: "no_pool" };
  }
  if (!state) {
    return { eligible: false, policyPda: pda, policy: null, reason: "no_policy" };
  }
  if (!state.isActive) {
    return { eligible: false, policyPda: pda, policy: state, reason: "inactive" };
  }
  const waitEndsAt = state.boughtAtUnix + pool.waitingPeriodSec;
  if (BigInt(now) < waitEndsAt) {
    return {
      eligible: false,
      policyPda: pda,
      policy: state,
      reason: "waiting_period",
    };
  }
  const graceSec = 48n * 3600n;
  if (BigInt(now) > state.paidThroughUnix + graceSec) {
    return { eligible: false, policyPda: pda, policy: state, reason: "lapsed" };
  }
  const remaining = state.coverageCapUsdc - state.totalClaimed;
  if (remaining < params.rescueMicroUsdc) {
    return {
      eligible: false,
      policyPda: pda,
      policy: state,
      reason: "insufficient_coverage",
    };
  }
  return { eligible: true, policyPda: pda, policy: state };
}

// ── Utility ─────────────────────────────────────────────────────────

/** Hash a signature string into a 32-byte digest (legacy/rescue memos). */
export function hashRescueSig(rescueSig: string): Buffer {
  return crypto.createHash("sha256").update(rescueSig).digest();
}

/** Convert USDC (float) to micro-USDC (6 decimals). */
export function usdcToMicro(usdc: number): bigint {
  return BigInt(Math.ceil(usdc * 1_000_000));
}

/** Convert micro-USDC to USDC float. */
export function microToUsdc(micro: bigint): number {
  return Number(micro) / 1_000_000;
}

/** Pretty-print a PolicyState for API responses. */
export function formatPolicy(state: PolicyState) {
  return {
    user: state.user.toString(),
    coverageCapUsdc: microToUsdc(state.coverageCapUsdc),
    premiumPaidUsdc: microToUsdc(state.premiumPaidMicro),
    stakeUsdc: microToUsdc(state.stakeUsdc),
    paidThrough: new Date(Number(state.paidThroughUnix) * 1000).toISOString(),
    boughtAt: new Date(Number(state.boughtAtUnix) * 1000).toISOString(),
    totalClaimedUsdc: microToUsdc(state.totalClaimed),
    remainingCoverageUsdc: microToUsdc(state.coverageCapUsdc - state.totalClaimed),
    rescueCount: Number(state.rescueCount),
    commitmentHash: "0x" + state.commitmentHash.toString("hex"),
    isActive: state.isActive,
  };
}

/** Pretty-print a PoolState for API responses. */
export function formatPool(state: PoolState) {
  return {
    admin: state.admin.toString(),
    adminAgent: state.adminAgent.toString(),
    platformTreasury: state.platformTreasury.toString(),
    usdcMint: state.usdcMint.toString(),
    usdcVault: state.usdcVault.toString(),
    totalStakesUsdc: microToUsdc(state.totalStakes),
    coverageOutstandingUsdc: microToUsdc(state.coverageOutstanding),
    totalClaimsPaidUsdc: microToUsdc(state.totalClaimsPaid),
    premiumBps: state.premiumBps,
    platformFeeBps: state.platformFeeBps,
    minStakeMultiplier: state.minStakeMultiplier,
    maxCoveragePerUserUsdc: microToUsdc(state.maxCoveragePerUserUsdc),
    waitingPeriodSec: Number(state.waitingPeriodSec),
    paused: state.paused,
  };
}
