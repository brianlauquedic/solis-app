/**
 * Sakura — Agentic Consumer Protocol TypeScript Client (v0.3)
 *
 * Interacts with the on-chain Anchor program `sakura_insurance` at
 * `programs/sakura-insurance/src/lib.rs` — v0.3 is the intent-execution
 * protocol where users sign intents and AI agents execute actions within
 * mathematically-enforced policy bounds.
 *
 * v0.3 replaces the v0.2 mutual-insurance model. PDAs/instructions:
 *   Pool    → IntentProtocol   (seeds: "sakura_intent_v3", admin)
 *   Policy  → Intent           (seeds: "sakura_intent_account", user)
 *   Claim   → ActionRecord     (seeds: "sakura_action", intent, nonce)
 *
 * Instructions exposed:
 *   - initialize_protocol       (admin, once per deployment; admin is
 *                                immutable thereafter — see lib.rs note)
 *   - set_paused                (emergency stop)
 *   - sign_intent               (user signs, creates Intent PDA)
 *   - revoke_intent             (user revokes)
 *   - execute_with_intent_proof (ZK-gated action execution)
 *
 * Oracle verification (same as v0.2): chain parses Pyth PriceUpdateV2 and
 * cross-checks oracle_price_usd_micro + oracle_slot against the actual
 * Pyth account at instruction execution time.
 */

import {
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
  TransactionInstruction,
  Connection,
} from "@solana/web3.js";
import crypto from "crypto";

// ══════════════════════════════════════════════════════════════════════
// Big-int LE helpers — browser-polyfill-safe
//
// Some Next.js bundles ship a Buffer polyfill (`buffer@6` / feross) whose
// `writeBigUInt64LE` / `readBigUInt64LE` / `readBigInt64LE` methods end up
// as `undefined` after minification, producing runtime errors like
// "i.writeBigUInt64LE is not a function". We avoid the polyfill's bigint
// surface entirely by reading/writing 8 little-endian bytes via plain
// indexed access, which works on any `Uint8Array` (all Buffer instances
// are Uint8Arrays).
// ══════════════════════════════════════════════════════════════════════

function writeU64LE(buf: Uint8Array, value: bigint, offset: number): void {
  if (value < 0n) {
    throw new Error(`writeU64LE: value must be >= 0; got ${value}`);
  }
  if (value >= 1n << 64n) {
    throw new Error(`writeU64LE: value overflows u64: ${value}`);
  }
  let v = value;
  for (let i = 0; i < 8; i++) {
    buf[offset + i] = Number(v & 0xffn);
    v >>= 8n;
  }
}

function readU64LE(buf: Uint8Array, offset: number): bigint {
  let v = 0n;
  for (let i = 7; i >= 0; i--) {
    v = (v << 8n) | BigInt(buf[offset + i]);
  }
  return v;
}

function readI64LE(buf: Uint8Array, offset: number): bigint {
  const u = readU64LE(buf, offset);
  // Two's-complement sign-extend: if the high bit is set, value is negative.
  return u >= 1n << 63n ? u - (1n << 64n) : u;
}

// ══════════════════════════════════════════════════════════════════════
// Constants — Program ID, token mints
// ══════════════════════════════════════════════════════════════════════

export const SAKURA_INSURANCE_PROGRAM_ID = new PublicKey(
  (process.env.NEXT_PUBLIC_INSURANCE_PROGRAM_ID ?? "").trim() ||
    // v0.3 deployment on devnet (intent-execution protocol)
    "AnszeCRFsBKmT5fBY9WywxGsZZZob8ZPFYqboYXpuYLp"
);

// Back-compat alias for any remaining legacy imports
export const SAKURA_PROGRAM_ID = SAKURA_INSURANCE_PROGRAM_ID;

export const TOKEN_PROGRAM_ID = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
);

export const USDC_MINT_MAINNET = new PublicKey(
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
);
// NOTE: this is the admin-controlled TEST USDC mint that the current
// devnet Sakura protocol was initialized with (see protocol PDA's
// usdc_mint field on-chain). It is NOT the canonical Circle devnet
// USDC (4zMMC…DncDU). Integrators on devnet must use the mint the
// protocol was deployed against, not Circle's.
export const USDC_MINT_DEVNET = new PublicKey(
  "7rEhvYrGGT41FQrCt3zNx8Bko9TFVvytYWpP1mqhtLi3"
);

// Pyth SOL/USD price feed on devnet (the static account — v0.3 E2E posts
// fresh VAAs via Hermes, but this is useful for fallback / staging).
export const PYTH_SOL_USD_DEVNET = new PublicKey(
  "7UVimffxr9ow1uXYxsr4LHAcV58mLzhmwaeKvJ1pjLiE"
);

// ── C-full dual oracle (Pyth + Switchboard) ──

/**
 * Switchboard On-Demand program IDs, verified against
 * `@switchboard-xyz/on-demand` SDK `utils/index.js`:
 *   ON_DEMAND_DEVNET_PID  = Aio4gaXjXzJNVLtzwtNVmSqGKpANtXhybbkhtAC94ji2
 *   ON_DEMAND_MAINNET_PID = SBondMDrcV3K4kxZR1HNVT7osZxAHVHgYXL5Ze1oMUv
 * The Sakura Anchor program hardcodes the devnet PID; keep this
 * constant pointing at the devnet PID until the program is migrated
 * to mainnet (see docs/SQUADS_MIGRATION_RUNBOOK.md).
 */
export const SWITCHBOARD_PROGRAM_ID = new PublicKey(
  "Aio4gaXjXzJNVLtzwtNVmSqGKpANtXhybbkhtAC94ji2"
);
export const SWITCHBOARD_PROGRAM_ID_MAINNET = new PublicKey(
  "SBondMDrcV3K4kxZR1HNVT7osZxAHVHgYXL5Ze1oMUv"
);

/**
 * Canonical Switchboard On-Demand SOL/USD pull-feed account.
 *
 * The devnet feed was verified on 2026-04-22 by reading the PullFeed
 * `feed_hash` via getAccountInfo; it matches the value hardcoded on
 * the Sakura Anchor side (`EXPECTED_SWITCHBOARD_FEED_HASH_SOL_USD`).
 *
 * ⚠️ TODO: populate MAINNET feed pubkey before mainnet deploy by
 * querying https://ondemand.switchboard.xyz/solana/mainnet for the
 * canonical SOL/USD feed and replacing the system-program placeholder
 * below.
 */
export const SWITCHBOARD_SOL_USD_DEVNET = new PublicKey(
  "GgGVgSLWAyL9Xf4fGaAQQCkmWetBjX7PCNz8kTK97DKB"
);
export const SWITCHBOARD_SOL_USD_MAINNET = new PublicKey(
  "11111111111111111111111111111111"
);

// ══════════════════════════════════════════════════════════════════════
// Action-type + Protocol enums (must match circuit bitmap interpretation)
// ══════════════════════════════════════════════════════════════════════

/** Bit index (0..31) in allowed_action_types bitmap */
export enum ActionType {
  Borrow = 0,
  Lend = 1,
  Swap = 2,
  Repay = 3,
  Withdraw = 4,
  Deposit = 5,
  Stake = 6,
  Unstake = 7,
  // 8..31 reserved
}

/** Bit index (0..31) in allowed_protocols bitmap.
 *
 * LIVE integrations (surfaced in UI + handled by lib/sak-executor.ts dispatcher):
 *   Kamino(0), Jupiter(3), Jito(5), Raydium(8) = 4 protocols / 12 CPI cells.
 *
 * RESERVED slots below are kept for on-chain bitmap compatibility — altering
 * their numeric positions would break the trusted setup / verifying key.
 * They must NOT be exposed in UI and must NOT be added to the dispatcher.
 */
export enum ProtocolId {
  Kamino = 0,
  /** @deprecated Reserved — MarginFi is not integrated. Bitmap slot kept for
   * trusted-setup compatibility. Do not expose in UI or adapter dispatcher. */
  MarginFi = 1,
  /** @deprecated Solend support removed 2026-04 — protocol is dormant; value
   * reserved in the bitmap for on-chain backwards compatibility. Do not
   * expose in UI or adapter dispatcher. */
  Solend = 2,
  Jupiter = 3,
  /** @deprecated Reserved — Marinade is not integrated (Jito is the sole LST
   * integration). Bitmap slot kept for trusted-setup compatibility. Do not
   * expose in UI or adapter dispatcher. */
  Marinade = 4,
  Jito = 5,
  /** @deprecated Reserved — Drift is not integrated. Bitmap slot kept for
   * trusted-setup compatibility. Do not expose in UI or adapter dispatcher. */
  Drift = 6,
  /** @deprecated Reserved — Zeta is not integrated. Bitmap slot kept for
   * trusted-setup compatibility. Do not expose in UI or adapter dispatcher. */
  Zeta = 7,
  /** Added 2026-04 — Raydium direct swap route (bypasses Jupiter aggregator). */
  Raydium = 8,
  // 9..31 reserved
}

/** Build an allowed_protocols bitmap from a list of ProtocolId values. */
export function buildProtocolsBitmap(ids: ProtocolId[]): number {
  return ids.reduce((acc, id) => acc | (1 << id), 0);
}

/** Build an allowed_action_types bitmap from a list of ActionType values. */
export function buildActionTypesBitmap(types: ActionType[]): number {
  return types.reduce((acc, t) => acc | (1 << t), 0);
}

// ══════════════════════════════════════════════════════════════════════
// PDA Derivation
// ══════════════════════════════════════════════════════════════════════

export function deriveProtocolPDA(
  admin: PublicKey,
  programId: PublicKey = SAKURA_INSURANCE_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("sakura_intent_v3"), admin.toBuffer()],
    programId
  );
}

export function deriveFeeVaultPDA(
  protocol: PublicKey,
  programId: PublicKey = SAKURA_INSURANCE_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("sakura_fee_vault"), protocol.toBuffer()],
    programId
  );
}

export function deriveIntentPDA(
  user: PublicKey,
  programId: PublicKey = SAKURA_INSURANCE_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("sakura_intent_account"), user.toBuffer()],
    programId
  );
}

export function deriveActionRecordPDA(
  intent: PublicKey,
  actionNonce: bigint,
  programId: PublicKey = SAKURA_INSURANCE_PROGRAM_ID
): [PublicKey, number] {
  const nonceBuf = Buffer.alloc(8);
  writeU64LE(nonceBuf, actionNonce, 0);
  return PublicKey.findProgramAddressSync(
    [Buffer.from("sakura_action"), intent.toBuffer(), nonceBuf],
    programId
  );
}

// ── Trust-hardening PDAs (Guardian + PendingAdminAction) ────────────
export function deriveGuardianPDA(
  protocol: PublicKey,
  programId: PublicKey = SAKURA_INSURANCE_PROGRAM_ID
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("sakura_guardian"), protocol.toBuffer()],
    programId
  );
}

export function derivePendingAdminActionPDA(
  protocol: PublicKey,
  actionId: bigint,
  programId: PublicKey = SAKURA_INSURANCE_PROGRAM_ID
): [PublicKey, number] {
  const idBuf = Buffer.alloc(8);
  writeU64LE(idBuf, actionId, 0);
  return PublicKey.findProgramAddressSync(
    [Buffer.from("sakura_pending"), protocol.toBuffer(), idBuf],
    programId
  );
}

// ── Back-compat PDA aliases (so old callers don't break hard) ─────────
export const derivePoolPDA = deriveProtocolPDA;
export const deriveVaultPDA = deriveFeeVaultPDA;
export const derivePolicyPDA = deriveIntentPDA;
export const deriveClaimRecordPDA = deriveActionRecordPDA;

// ══════════════════════════════════════════════════════════════════════
// Anchor discriminators
// ══════════════════════════════════════════════════════════════════════

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

const IX_INIT_PROTOCOL = anchorIxDiscriminator("initialize_protocol");
// `IX_ROTATE_ADMIN` removed — rotate_admin was removed from the program
// because mutating protocol.admin orphans the PDA (seeded by admin.key).
// Admin is now immutable after initialize_protocol; governance migration
// = redeploy with multisig as admin. See docs/SQUADS_MIGRATION_RUNBOOK.md.
const IX_SET_PAUSED = anchorIxDiscriminator("set_paused");
const IX_SIGN_INTENT = anchorIxDiscriminator("sign_intent");
const IX_REVOKE_INTENT = anchorIxDiscriminator("revoke_intent");
const IX_INIT_GUARDIAN = anchorIxDiscriminator("initialize_guardian");
const IX_PROPOSE_ADMIN_ACTION = anchorIxDiscriminator("propose_admin_action");
const IX_EXECUTE_ADMIN_ACTION = anchorIxDiscriminator("execute_admin_action");
const IX_CANCEL_ADMIN_ACTION = anchorIxDiscriminator("cancel_admin_action");

// Admin action type codes — must match lib.rs ADMIN_ACTION_* constants.
export const ADMIN_ACTION_SET_PAUSED = 1;
export const ADMIN_ACTION_UPDATE_FEES = 2;

const IX_EXECUTE_WITH_INTENT_PROOF = anchorIxDiscriminator(
  "execute_with_intent_proof"
);

const ACCT_PROTOCOL = anchorAccountDiscriminator("IntentProtocol");
const ACCT_INTENT = anchorAccountDiscriminator("Intent");
const ACCT_ACTION_RECORD = anchorAccountDiscriminator("ActionRecord");

// ══════════════════════════════════════════════════════════════════════
// Account state types (v0.3 layout)
// ══════════════════════════════════════════════════════════════════════

export interface IntentProtocolState {
  admin: PublicKey;
  usdcMint: PublicKey;
  feeVault: PublicKey;
  platformTreasury: PublicKey;
  totalIntentsSigned: bigint;
  totalActionsExecuted: bigint;
  executionFeeBps: number;
  platformFeeBps: number;
  paused: boolean;
  bump: number;
}

export interface IntentState {
  user: PublicKey;
  intentCommitment: Buffer; // 32 bytes
  signedAt: bigint;
  expiresAt: bigint;
  actionsExecuted: bigint;
  isActive: boolean;
  bump: number;
}

export interface ActionRecordState {
  intent: PublicKey;
  actionNonce: bigint;
  actionType: number;
  actionAmount: bigint;
  actionTargetIndex: number;
  oraclePriceUsdMicro: bigint;
  oracleSlot: bigint;
  ts: bigint;
  proofFingerprint: Buffer; // 32 bytes keccak256
  bump: number;
}

// ══════════════════════════════════════════════════════════════════════
// Deserializers
// ══════════════════════════════════════════════════════════════════════

export function deserializeProtocol(data: Buffer): IntentProtocolState | null {
  // 8 disc + 32*4 + 8*2 + 2*2 + 1 + 1 = 158
  if (data.length < 158) return null;
  if (!data.subarray(0, 8).equals(ACCT_PROTOCOL)) return null;

  let o = 8;
  const admin = new PublicKey(data.subarray(o, o + 32)); o += 32;
  const usdcMint = new PublicKey(data.subarray(o, o + 32)); o += 32;
  const feeVault = new PublicKey(data.subarray(o, o + 32)); o += 32;
  const platformTreasury = new PublicKey(data.subarray(o, o + 32)); o += 32;
  const totalIntentsSigned = readU64LE(data, o); o += 8;
  const totalActionsExecuted = readU64LE(data, o); o += 8;
  const executionFeeBps = data.readUInt16LE(o); o += 2;
  const platformFeeBps = data.readUInt16LE(o); o += 2;
  const paused = data.readUInt8(o) === 1; o += 1;
  const bump = data.readUInt8(o);

  return {
    admin,
    usdcMint,
    feeVault,
    platformTreasury,
    totalIntentsSigned,
    totalActionsExecuted,
    executionFeeBps,
    platformFeeBps,
    paused,
    bump,
  };
}

export function deserializeIntent(data: Buffer): IntentState | null {
  // 8 disc + 32 + 32 + 8*3 + 1 + 1 = 98
  if (data.length < 98) return null;
  if (!data.subarray(0, 8).equals(ACCT_INTENT)) return null;

  let o = 8;
  const user = new PublicKey(data.subarray(o, o + 32)); o += 32;
  const intentCommitment = Buffer.from(data.subarray(o, o + 32)); o += 32;
  const signedAt = readI64LE(data, o); o += 8;
  const expiresAt = readI64LE(data, o); o += 8;
  const actionsExecuted = readU64LE(data, o); o += 8;
  const isActive = data.readUInt8(o) === 1; o += 1;
  const bump = data.readUInt8(o);

  return {
    user,
    intentCommitment,
    signedAt,
    expiresAt,
    actionsExecuted,
    isActive,
    bump,
  };
}

export function deserializeActionRecord(
  data: Buffer
): ActionRecordState | null {
  // 8 disc + 32 + 8 + 1 + 8 + 1 + 8 + 8 + 8 + 32 + 1 = 115
  if (data.length < 115) return null;
  if (!data.subarray(0, 8).equals(ACCT_ACTION_RECORD)) return null;

  let o = 8;
  const intent = new PublicKey(data.subarray(o, o + 32)); o += 32;
  const actionNonce = readU64LE(data, o); o += 8;
  const actionType = data.readUInt8(o); o += 1;
  const actionAmount = readU64LE(data, o); o += 8;
  const actionTargetIndex = data.readUInt8(o); o += 1;
  const oraclePriceUsdMicro = readU64LE(data, o); o += 8;
  const oracleSlot = readU64LE(data, o); o += 8;
  const ts = readI64LE(data, o); o += 8;
  const proofFingerprint = Buffer.from(data.subarray(o, o + 32)); o += 32;
  const bump = data.readUInt8(o);

  return {
    intent,
    actionNonce,
    actionType,
    actionAmount,
    actionTargetIndex,
    oraclePriceUsdMicro,
    oracleSlot,
    ts,
    proofFingerprint,
    bump,
  };
}

// ══════════════════════════════════════════════════════════════════════
// On-chain fetch helpers
// ══════════════════════════════════════════════════════════════════════

export async function fetchProtocol(
  connection: Connection,
  admin: PublicKey
): Promise<{ pda: PublicKey; state: IntentProtocolState | null }> {
  const [pda] = deriveProtocolPDA(admin);
  const info = await connection.getAccountInfo(pda);
  if (!info) return { pda, state: null };
  return { pda, state: deserializeProtocol(Buffer.from(info.data)) };
}

export async function fetchIntent(
  connection: Connection,
  user: PublicKey
): Promise<{ pda: PublicKey; state: IntentState | null }> {
  const [pda] = deriveIntentPDA(user);
  const info = await connection.getAccountInfo(pda);
  if (!info) return { pda, state: null };
  return { pda, state: deserializeIntent(Buffer.from(info.data)) };
}

// ── Back-compat fetch aliases ─────────────────────────────────────────
export const fetchPool = fetchProtocol;
export const fetchPolicy = fetchIntent;

// ══════════════════════════════════════════════════════════════════════
// Instruction builders
// ══════════════════════════════════════════════════════════════════════

/**
 * initialize_protocol: admin sets up the IntentProtocol PDA + fee vault.
 */
export function buildInitializeProtocolIx(params: {
  admin: PublicKey;
  usdcMint: PublicKey;
  platformTreasury: PublicKey;
  executionFeeBps: number;
  platformFeeBps: number;
}): TransactionInstruction {
  const { admin, usdcMint, platformTreasury, executionFeeBps, platformFeeBps } =
    params;
  const [protocol] = deriveProtocolPDA(admin);
  const [feeVault] = deriveFeeVaultPDA(protocol);

  const data = Buffer.alloc(8 + 2 + 2);
  let o = 0;
  IX_INIT_PROTOCOL.copy(data, o); o += 8;
  data.writeUInt16LE(executionFeeBps, o); o += 2;
  data.writeUInt16LE(platformFeeBps, o);

  return new TransactionInstruction({
    programId: SAKURA_INSURANCE_PROGRAM_ID,
    keys: [
      { pubkey: protocol, isSigner: false, isWritable: true },
      { pubkey: admin, isSigner: true, isWritable: true },
      { pubkey: usdcMint, isSigner: false, isWritable: false },
      { pubkey: feeVault, isSigner: false, isWritable: true },
      { pubkey: platformTreasury, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: SYSVAR_RENT_PUBKEY, isSigner: false, isWritable: false },
    ],
    data,
  });
}

/**
 * sign_intent: user signs a new intent (or rotates existing).
 *
 * `intentCommitment` is a 32-byte Poseidon-tree hash computed via
 * `computeIntentCommitment` in lib/zk-proof.ts over:
 *   (intent_text_hash, wallet, nonce, max_amount, max_usd_value,
 *    allowed_protocols, allowed_action_types)
 *
 * `expiresAt` is a Unix timestamp (i64) — intent cannot be used past this.
 */
export function buildSignIntentIx(params: {
  admin: PublicKey;       // protocol admin (PDA seed)
  user: PublicKey;
  userUsdcAta: PublicKey; // user's USDC ATA — source of sign fee
  feeVault: PublicKey;    // protocol fee vault (USDC ATA, PDA-owned)
  intentCommitment: Buffer; // 32 bytes
  expiresAt: bigint;        // i64 Unix timestamp
  /**
   * Fee in USDC micro-units ($0.01 = 10_000). Caller is expected to
   * compute `fee_micro = 0.1% × max_usd_value`. The program enforces
   * only `0 < fee_micro <= 1_000_000_000` ($1,000 ceiling).
   */
  feeMicro: bigint;
}): TransactionInstruction {
  if (params.intentCommitment.length !== 32) {
    throw new Error(
      `intentCommitment must be 32 bytes, got ${params.intentCommitment.length}`
    );
  }
  if (params.feeMicro <= 0n || params.feeMicro > 1_000_000_000n) {
    throw new Error(
      `feeMicro must be in (0, 1_000_000_000]; got ${params.feeMicro}`
    );
  }
  const [protocol] = deriveProtocolPDA(params.admin);
  const [intent] = deriveIntentPDA(params.user);

  // Data: 8 disc + 32 commitment + 8 expiresAt + 8 feeMicro
  const data = Buffer.alloc(8 + 32 + 8 + 8);
  let o = 0;
  IX_SIGN_INTENT.copy(data, o); o += 8;
  params.intentCommitment.copy(data, o); o += 32;
  // expiresAt is declared i64 on-chain but is always a positive Unix
  // timestamp in practice. Writing a non-negative bigint as unsigned is
  // bit-identical to signed (two's-complement) and our `writeU64LE`
  // helper sidesteps Buffer-polyfill bigint-method gaps entirely.
  if (params.expiresAt < 0n) {
    throw new Error(`expiresAt must be >= 0; got ${params.expiresAt}`);
  }
  writeU64LE(data, params.expiresAt, o); o += 8;
  writeU64LE(data, params.feeMicro, o);

  return new TransactionInstruction({
    programId: SAKURA_INSURANCE_PROGRAM_ID,
    keys: [
      { pubkey: protocol, isSigner: false, isWritable: true },
      { pubkey: intent, isSigner: false, isWritable: true },
      { pubkey: params.user, isSigner: true, isWritable: true },
      { pubkey: params.userUsdcAta, isSigner: false, isWritable: true },
      { pubkey: params.feeVault, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

/**
 * revoke_intent: user marks their intent inactive. Charges the same
 * 0.1% fee as sign_intent (declared by caller; honor system).
 */
export function buildRevokeIntentIx(params: {
  admin: PublicKey;
  user: PublicKey;
  userUsdcAta: PublicKey;
  feeVault: PublicKey;
  feeMicro: bigint;
}): TransactionInstruction {
  if (params.feeMicro <= 0n || params.feeMicro > 1_000_000_000n) {
    throw new Error(
      `feeMicro must be in (0, 1_000_000_000]; got ${params.feeMicro}`
    );
  }
  const [protocol] = deriveProtocolPDA(params.admin);
  const [intent] = deriveIntentPDA(params.user);

  // Data: 8 disc + 8 feeMicro
  const data = Buffer.alloc(8 + 8);
  let o = 0;
  IX_REVOKE_INTENT.copy(data, o); o += 8;
  writeU64LE(data, params.feeMicro, o);

  return new TransactionInstruction({
    programId: SAKURA_INSURANCE_PROGRAM_ID,
    keys: [
      { pubkey: protocol, isSigner: false, isWritable: true },
      { pubkey: intent, isSigner: false, isWritable: true },
      { pubkey: params.user, isSigner: true, isWritable: true },
      { pubkey: params.userUsdcAta, isSigner: false, isWritable: true },
      { pubkey: params.feeVault, isSigner: false, isWritable: true },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data,
  });
}

/**
 * execute_with_intent_proof: ZK-gated action execution. Verifies that
 * the proposed action falls within the bounds of the user's signed intent.
 *
 * On success: writes an ActionRecord PDA (seeded by intent + nonce) for
 * audit trail. The actual DeFi action (Kamino borrow, etc.) should be
 * placed by the client as a subsequent instruction in the same atomic
 * v0 transaction — if this instruction fails, the whole tx reverts.
 *
 * Public inputs to ZK proof (must match circom `public` list order):
 *   [0] intent_commitment
 *   [1] action_type
 *   [2] action_amount
 *   [3] action_target_index
 *   [4] oracle_price_usd_micro
 *   [5] oracle_slot
 */
export function buildExecuteWithIntentProofIx(params: {
  admin: PublicKey;
  user: PublicKey;                    // intent owner
  payer: PublicKey;                   // pays ActionRecord rent + $0.01 fee
  payerUsdcAta: PublicKey;            // source of $0.01 flat fee
  feeVault: PublicKey;                // protocol fee vault
  pythPriceAccount: PublicKey;        // Pyth PriceUpdateV2 account
  switchboardPriceAccount: PublicKey; // Switchboard On-Demand PullFeedAccountData
  actionNonce: bigint;
  actionType: number;       // u8
  actionAmount: bigint;     // u64
  actionTargetIndex: number;// u8
  /**
   * MUST be the MEDIAN of Pyth and Switchboard prices (arithmetic mean
   * with exactly two oracles). Client computes this off-chain; the
   * on-chain handler verifies equality within ±1 micro-USD after
   * independently parsing both oracle accounts.
   */
  oraclePriceUsdMicro: bigint;
  oracleSlot: bigint;
  proofA: Uint8Array;       // 64 bytes
  proofB: Uint8Array;       // 128 bytes
  proofC: Uint8Array;       // 64 bytes
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

  const [protocol] = deriveProtocolPDA(params.admin);
  const [intent] = deriveIntentPDA(params.user);
  const [actionRecord] = deriveActionRecordPDA(intent, params.actionNonce);

  // Layout: 8 disc + 8 nonce + 1 type + 8 amount + 1 target + 8 price +
  //         8 slot + 64 A + 128 B + 64 C = 298 bytes
  const data = Buffer.alloc(8 + 8 + 1 + 8 + 1 + 8 + 8 + 64 + 128 + 64);
  let o = 0;
  IX_EXECUTE_WITH_INTENT_PROOF.copy(data, o); o += 8;
  writeU64LE(data, params.actionNonce, o); o += 8;
  data.writeUInt8(params.actionType, o); o += 1;
  writeU64LE(data, params.actionAmount, o); o += 8;
  data.writeUInt8(params.actionTargetIndex, o); o += 1;
  writeU64LE(data, params.oraclePriceUsdMicro, o); o += 8;
  writeU64LE(data, params.oracleSlot, o); o += 8;
  Buffer.from(params.proofA).copy(data, o); o += 64;
  Buffer.from(params.proofB).copy(data, o); o += 128;
  Buffer.from(params.proofC).copy(data, o); o += 64;

  return new TransactionInstruction({
    programId: SAKURA_INSURANCE_PROGRAM_ID,
    keys: [
      { pubkey: protocol, isSigner: false, isWritable: true },
      { pubkey: intent, isSigner: false, isWritable: true },
      { pubkey: params.payer, isSigner: true, isWritable: true },
      { pubkey: actionRecord, isSigner: false, isWritable: true },
      { pubkey: params.payerUsdcAta, isSigner: false, isWritable: true },
      { pubkey: params.feeVault, isSigner: false, isWritable: true },
      { pubkey: params.pythPriceAccount, isSigner: false, isWritable: false },
      { pubkey: params.switchboardPriceAccount, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

/** Flat per-action fee hard-coded in the program (10_000 micro-USDC = $0.01). */
export const EXECUTE_ACTION_FEE_MICRO = 10_000n;

/** Maximum Pyth-vs-Switchboard cross-oracle deviation (bps). 100 = 1%. */
export const MAX_CROSS_ORACLE_DEVIATION_BPS = 100n;

// ══════════════════════════════════════════════════════════════════════
// Back-compat instruction-builder aliases
// Older code imports `buildInitializePoolIx` / `buildBuyPolicyIx` /
// `buildClaimPayoutWithZkProofIx`. These aliases let legacy callers
// continue compiling, while new code should use the v0.3 names directly.
// Legacy calls will fail at runtime (different parameter schemas), which
// is intentional — the v0.2 mutual-insurance flow no longer exists.
// ══════════════════════════════════════════════════════════════════════

export const buildInitializePoolIx = buildInitializeProtocolIx;

// ══════════════════════════════════════════════════════════════════════
// Helper: claim eligibility stub (for back-compat with claim-with-repay
// route that used to check whether a user's rescue is allowed).
// v0.3 replaces this with intent-level checks; this stub always allows
// and lets the on-chain ZK verification be the authoritative gate.
// ══════════════════════════════════════════════════════════════════════

export async function checkClaimEligibility(params: {
  connection: Connection;
  poolAdmin: PublicKey;
  user: PublicKey;
  rescueMicroUsdc: bigint;
}): Promise<{ eligible: boolean; reason?: string }> {
  const { connection, user } = params;
  const { state: intent } = await fetchIntent(connection, user);
  if (!intent) {
    return { eligible: false, reason: "no active intent signed" };
  }
  if (!intent.isActive) {
    return { eligible: false, reason: "intent is revoked" };
  }
  const now = BigInt(Math.floor(Date.now() / 1000));
  if (now > intent.expiresAt) {
    return { eligible: false, reason: "intent expired" };
  }
  return { eligible: true };
}

// ══════════════════════════════════════════════════════════════════════
// Trust-hardening instruction builders
//
//   initialize_guardian   — admin registers a guardian pubkey (one-time)
//   propose_admin_action  — admin queues a time-locked action
//   execute_admin_action  — admin executes after 24h delay
//   cancel_admin_action   — guardian vetoes during the delay window
//
// See programs/sakura-insurance/src/lib.rs for on-chain semantics and
// docs/TRUST_HARDENING_DEPLOY.md for deploy order.
// ══════════════════════════════════════════════════════════════════════

export function buildInitializeGuardianIx(params: {
  admin: PublicKey;
  guardian: PublicKey;
}): TransactionInstruction {
  const [protocol] = deriveProtocolPDA(params.admin);
  const [guardianPda] = deriveGuardianPDA(protocol);

  const data = Buffer.alloc(8 + 32);
  IX_INIT_GUARDIAN.copy(data, 0);
  params.guardian.toBuffer().copy(data, 8);

  return new TransactionInstruction({
    programId: SAKURA_INSURANCE_PROGRAM_ID,
    keys: [
      { pubkey: protocol, isSigner: false, isWritable: false },
      { pubkey: params.admin, isSigner: true, isWritable: true },
      { pubkey: guardianPda, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

export function buildProposeAdminActionIx(params: {
  admin: PublicKey;
  actionId: bigint;        // u64 — caller-supplied unique identifier
  actionType: number;      // ADMIN_ACTION_SET_PAUSED | ADMIN_ACTION_UPDATE_FEES
  payload: Buffer;         // 32 bytes — action-specific data
}): TransactionInstruction {
  if (params.payload.length !== 32) {
    throw new Error(`payload must be 32 bytes, got ${params.payload.length}`);
  }
  const [protocol] = deriveProtocolPDA(params.admin);
  const [pending] = derivePendingAdminActionPDA(protocol, params.actionId);

  // Data: 8 disc + 8 actionId + 1 actionType + 32 payload
  const data = Buffer.alloc(8 + 8 + 1 + 32);
  let o = 0;
  IX_PROPOSE_ADMIN_ACTION.copy(data, o); o += 8;
  writeU64LE(data, params.actionId, o); o += 8;
  data.writeUInt8(params.actionType, o); o += 1;
  params.payload.copy(data, o);

  return new TransactionInstruction({
    programId: SAKURA_INSURANCE_PROGRAM_ID,
    keys: [
      { pubkey: protocol, isSigner: false, isWritable: false },
      { pubkey: params.admin, isSigner: true, isWritable: true },
      { pubkey: pending, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    data,
  });
}

export function buildExecuteAdminActionIx(params: {
  admin: PublicKey;
  actionId: bigint;
}): TransactionInstruction {
  const [protocol] = deriveProtocolPDA(params.admin);
  const [pending] = derivePendingAdminActionPDA(protocol, params.actionId);

  const data = Buffer.alloc(8 + 8);
  IX_EXECUTE_ADMIN_ACTION.copy(data, 0);
  writeU64LE(data, params.actionId, 8);

  return new TransactionInstruction({
    programId: SAKURA_INSURANCE_PROGRAM_ID,
    keys: [
      { pubkey: protocol, isSigner: false, isWritable: true },
      { pubkey: params.admin, isSigner: true, isWritable: false },
      { pubkey: pending, isSigner: false, isWritable: true },
    ],
    data,
  });
}

export function buildCancelAdminActionIx(params: {
  admin: PublicKey;          // only used to derive protocol PDA — NOT a signer
  guardianSigner: PublicKey;
  actionId: bigint;
}): TransactionInstruction {
  const [protocol] = deriveProtocolPDA(params.admin);
  const [guardianPda] = deriveGuardianPDA(protocol);
  const [pending] = derivePendingAdminActionPDA(protocol, params.actionId);

  const data = Buffer.alloc(8 + 8);
  IX_CANCEL_ADMIN_ACTION.copy(data, 0);
  writeU64LE(data, params.actionId, 8);

  return new TransactionInstruction({
    programId: SAKURA_INSURANCE_PROGRAM_ID,
    keys: [
      { pubkey: protocol, isSigner: false, isWritable: false },
      { pubkey: guardianPda, isSigner: false, isWritable: false },
      { pubkey: params.guardianSigner, isSigner: true, isWritable: false },
      { pubkey: pending, isSigner: false, isWritable: true },
    ],
    data,
  });
}

/**
 * Helper · build a 32-byte payload for `ADMIN_ACTION_SET_PAUSED`.
 * Layout: byte[0] = paused flag (0 = unpause, 1 = pause); rest zero.
 */
export function encodeSetPausedPayload(paused: boolean): Buffer {
  const buf = Buffer.alloc(32);
  buf.writeUInt8(paused ? 1 : 0, 0);
  return buf;
}

/**
 * Helper · build a 32-byte payload for `ADMIN_ACTION_UPDATE_FEES`.
 * Layout: u16 LE executionFeeBps (≤200) + u16 LE platformFeeBps (≤10_000)
 * at bytes [0..4]; remaining 28 bytes zero.
 */
export function encodeUpdateFeesPayload(
  executionFeeBps: number,
  platformFeeBps: number
): Buffer {
  if (executionFeeBps < 0 || executionFeeBps > 200) {
    throw new Error(`executionFeeBps out of range: ${executionFeeBps}`);
  }
  if (platformFeeBps < 0 || platformFeeBps > 10_000) {
    throw new Error(`platformFeeBps out of range: ${platformFeeBps}`);
  }
  const buf = Buffer.alloc(32);
  buf.writeUInt16LE(executionFeeBps, 0);
  buf.writeUInt16LE(platformFeeBps, 2);
  return buf;
}
