/**
 * lib/adapters/jito.ts — Jito stake pool adapter
 *
 * Builds unsigned `DepositSol` / `WithdrawSol` instructions against the
 * canonical SPL Stake Pool program, targeting Jito's pool state account.
 *
 * Why hand-rolled (not via `@solana/spl-stake-pool`):
 *   - This library runs client-side in a Next.js bundle. Importing the full
 *     spl-stake-pool JS package brings in BN.js + beet + extra borsh
 *     codecs we don't need. Instruction layout is stable since 2022 and
 *     easy to hand-roll with ~100 lines.
 *   - We also avoid the `buffer.writeBigUInt64LE` polyfill issue that bit
 *     us in `lib/insurance-pool.ts` — this file uses the same `writeU64LE`
 *     pattern for bit-identical safety.
 *
 * Mainnet references:
 *   - SPL Stake Pool program:  SPoo1Ku8WFXoNDMHPsrGSTSG1Y47rzgn41SLUNakuHy
 *   - Jito stake pool state:   Jito4APyf642JPZPx3hGc6WWJ8zPKtRbRs4P815Awbb
 *   - JitoSOL mint:            J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn
 *
 * Canonical instruction layouts:
 *   https://github.com/solana-program/stake-pool/blob/master/program/src/instruction.rs
 *
 * Sources:
 *   - https://www.jito.network/docs/jitosol/jitosol-liquid-staking/for-developers/staking-integration/
 *   - https://solanacompass.com/stake-pools/Jito4APyf642JPZPx3hGc6WWJ8zPKtRbRs4P815Awbb
 */

import {
  Connection,
  PublicKey,
  SystemProgram,
  SYSVAR_CLOCK_PUBKEY,
  SYSVAR_STAKE_HISTORY_PUBKEY,
  TransactionInstruction,
} from "@solana/web3.js";

// ── Program / mint / pool constants ─────────────────────────────────
export const SPL_STAKE_POOL_PROGRAM_ID = new PublicKey(
  "SPoo1Ku8WFXoNDMHPsrGSTSG1Y47rzgn41SLUNakuHy"
);
export const JITO_STAKE_POOL = new PublicKey(
  "Jito4APyf642JPZPx3hGc6WWJ8zPKtRbRs4P815Awbb"
);
export const JITOSOL_MINT = new PublicKey(
  "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn"
);

// SPL Token program + Associated Token Account program
export const SPL_TOKEN_PROGRAM_ID = new PublicKey(
  "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
);
export const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
);
// Native stake program (required for WithdrawSol)
export const STAKE_PROGRAM_ID = new PublicKey(
  "Stake11111111111111111111111111111111111111"
);

// Instruction discriminators for the SPL Stake Pool program.
// See `enum StakePoolInstruction` in instruction.rs — we only need two.
const IX_DEPOSIT_SOL = 14;
const IX_WITHDRAW_SOL = 16;

// ── Byte helpers (polyfill-safe, see lib/insurance-pool.ts) ─────────
function writeU64LE(buf: Uint8Array, value: bigint, offset: number): void {
  if (value < 0n) throw new Error(`writeU64LE: negative: ${value}`);
  if (value >= 1n << 64n) throw new Error(`writeU64LE: overflow: ${value}`);
  let v = value;
  for (let i = 0; i < 8; i++) {
    buf[offset + i] = Number(v & 0xffn);
    v >>= 8n;
  }
}

// ── StakePool state layout (offsets into account data) ──────────────
// Reference: spl_stake_pool::state::StakePool
//   0..1   account_type (u8, must == 1 for StakePool)
//   1..33  manager
//   33..65 staker
//   65..97 stake_deposit_authority
//   97..98 stake_withdraw_bump_seed (u8)
//   98..130  validator_list
//   130..162 reserve_stake
//   162..194 pool_mint
//   194..226 manager_fee_account
//   226..258 token_program_id
//   ... (rest not needed here)
export interface JitoStakePoolState {
  reserveStake: PublicKey;
  poolMint: PublicKey;
  managerFeeAccount: PublicKey;
  validatorList: PublicKey;
  withdrawBumpSeed: number;
}

export async function fetchJitoStakePoolState(
  connection: Connection
): Promise<JitoStakePoolState> {
  const acct = await connection.getAccountInfo(JITO_STAKE_POOL, "confirmed");
  if (!acct) throw new Error("Jito stake pool account not found on-chain");
  if (!acct.owner.equals(SPL_STAKE_POOL_PROGRAM_ID)) {
    throw new Error(
      `Jito pool owner mismatch — expected SPL stake pool program, got ${acct.owner.toBase58()}`
    );
  }
  const d = acct.data;
  if (d.length < 258) {
    throw new Error(`Jito pool data too short (${d.length} bytes)`);
  }
  if (d[0] !== 1) {
    throw new Error(`Jito pool account_type != StakePool (got ${d[0]})`);
  }
  const validatorList = new PublicKey(d.subarray(98, 130));
  const reserveStake = new PublicKey(d.subarray(130, 162));
  const poolMint = new PublicKey(d.subarray(162, 194));
  const managerFeeAccount = new PublicKey(d.subarray(194, 226));
  const withdrawBumpSeed = d[97];

  // Sanity: pool_mint must match the well-known JitoSOL mint
  if (!poolMint.equals(JITOSOL_MINT)) {
    throw new Error(
      `Pool mint drift — expected ${JITOSOL_MINT.toBase58()}, got ${poolMint.toBase58()}`
    );
  }
  return { reserveStake, poolMint, managerFeeAccount, validatorList, withdrawBumpSeed };
}

// ── PDA derivations ─────────────────────────────────────────────────
export function deriveStakePoolWithdrawAuthority(
  poolState: PublicKey = JITO_STAKE_POOL
): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [poolState.toBuffer(), Buffer.from("withdraw")],
    SPL_STAKE_POOL_PROGRAM_ID
  );
  return pda;
}

/** ATA derivation: PDA of [owner, token_program, mint] under ATA program. */
export function deriveAssociatedTokenAddress(
  owner: PublicKey,
  mint: PublicKey,
  tokenProgram: PublicKey = SPL_TOKEN_PROGRAM_ID
): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), tokenProgram.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  return pda;
}

/**
 * Build the `createAssociatedTokenAccountIdempotent` instruction (discriminator 1).
 * No-op if the ATA already exists; cheap to include unconditionally.
 */
function buildCreateAtaIdempotentIx(
  payer: PublicKey,
  owner: PublicKey,
  mint: PublicKey
): TransactionInstruction {
  const ata = deriveAssociatedTokenAddress(owner, mint);
  return new TransactionInstruction({
    programId: ASSOCIATED_TOKEN_PROGRAM_ID,
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: ata, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: SPL_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    data: Buffer.from([1]), // discriminator for Idempotent variant
  });
}

// ── DepositSol (variant 14) ─────────────────────────────────────────
/**
 * Build a Jito stake deposit: user pays SOL, receives JitoSOL.
 *
 * @param connection  Mainnet RPC connection — used to fetch live pool state.
 * @param user        User's pubkey (pays the SOL, signs the tx).
 * @param lamports    Amount of SOL (in lamports) to stake.
 * @returns instructions (idempotent-create-ATA + deposit_sol), in order.
 */
export async function buildJitoStakeIx(
  connection: Connection,
  user: PublicKey,
  lamports: bigint
): Promise<TransactionInstruction[]> {
  if (lamports <= 0n) throw new Error(`lamports must be > 0; got ${lamports}`);
  const pool = await fetchJitoStakePoolState(connection);
  const withdrawAuthority = deriveStakePoolWithdrawAuthority();
  const userJitoSolAta = deriveAssociatedTokenAddress(user, JITOSOL_MINT);

  // Account order per spl_stake_pool::instruction::deposit_sol
  //   0. stake_pool (w)
  //   1. withdraw_authority (r)
  //   2. reserve_stake (w)
  //   3. lamports_from (w, s)          ← user's SOL source
  //   4. pool_tokens_to (w)            ← user's JitoSOL ATA
  //   5. manager_fee_account (w)
  //   6. referrer_pool_tokens_account (w)  ← we use manager_fee to skip referrer
  //   7. pool_mint (w)
  //   8. system_program (r)
  //   9. token_program (r)
  // Optional 10. sol_deposit_authority (s) — Jito has none, so omitted.
  const keys = [
    { pubkey: JITO_STAKE_POOL, isSigner: false, isWritable: true },
    { pubkey: withdrawAuthority, isSigner: false, isWritable: false },
    { pubkey: pool.reserveStake, isSigner: false, isWritable: true },
    { pubkey: user, isSigner: true, isWritable: true },
    { pubkey: userJitoSolAta, isSigner: false, isWritable: true },
    { pubkey: pool.managerFeeAccount, isSigner: false, isWritable: true },
    { pubkey: pool.managerFeeAccount, isSigner: false, isWritable: true },
    { pubkey: pool.poolMint, isSigner: false, isWritable: true },
    { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    { pubkey: SPL_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
  ];

  const data = Buffer.alloc(1 + 8);
  data[0] = IX_DEPOSIT_SOL;
  writeU64LE(data, lamports, 1);

  const depositIx = new TransactionInstruction({
    programId: SPL_STAKE_POOL_PROGRAM_ID,
    keys,
    data,
  });

  // Prepend idempotent ATA creation so first-time stakers don't need a
  // separate tx. Costs ~0.002 SOL rent but is refundable if user burns
  // their JitoSOL later.
  const createAta = buildCreateAtaIdempotentIx(user, user, JITOSOL_MINT);

  return [createAta, depositIx];
}

// ── WithdrawSol (variant 16) ────────────────────────────────────────
/**
 * Build a Jito liquid unstake: user burns JitoSOL, receives SOL from reserves.
 *
 * Reverts on-chain if the reserve lacks sufficient SOL (rare for Jito at
 * $2B TVL but non-zero for large withdrawals). For amounts > reserve,
 * use `WithdrawStake` instead — returns a stake account the user
 * deactivates over one epoch.
 *
 * @param poolTokens  Amount of JitoSOL (in 1e9 micro-units) to burn.
 */
export async function buildJitoUnstakeIx(
  connection: Connection,
  user: PublicKey,
  poolTokens: bigint
): Promise<TransactionInstruction[]> {
  if (poolTokens <= 0n) {
    throw new Error(`poolTokens must be > 0; got ${poolTokens}`);
  }
  const pool = await fetchJitoStakePoolState(connection);
  const withdrawAuthority = deriveStakePoolWithdrawAuthority();
  const userJitoSolAta = deriveAssociatedTokenAddress(user, JITOSOL_MINT);

  // Account order per spl_stake_pool::instruction::withdraw_sol
  //   0. stake_pool (w)
  //   1. withdraw_authority (r)
  //   2. transfer_authority / user (s)
  //   3. pool_tokens_from (w)           ← user's JitoSOL ATA
  //   4. reserve_stake (w)
  //   5. lamports_to (w)                ← user's SOL dest
  //   6. manager_fee_account (w)
  //   7. pool_mint (w)
  //   8. clock sysvar (r)
  //   9. stake_history sysvar (r)
  //   10. stake_program (r)
  //   11. token_program (r)
  // Optional 12. sol_withdraw_authority (s) — Jito has none.
  const keys = [
    { pubkey: JITO_STAKE_POOL, isSigner: false, isWritable: true },
    { pubkey: withdrawAuthority, isSigner: false, isWritable: false },
    { pubkey: user, isSigner: true, isWritable: false },
    { pubkey: userJitoSolAta, isSigner: false, isWritable: true },
    { pubkey: pool.reserveStake, isSigner: false, isWritable: true },
    { pubkey: user, isSigner: false, isWritable: true },
    { pubkey: pool.managerFeeAccount, isSigner: false, isWritable: true },
    { pubkey: pool.poolMint, isSigner: false, isWritable: true },
    { pubkey: SYSVAR_CLOCK_PUBKEY, isSigner: false, isWritable: false },
    { pubkey: SYSVAR_STAKE_HISTORY_PUBKEY, isSigner: false, isWritable: false },
    { pubkey: STAKE_PROGRAM_ID, isSigner: false, isWritable: false },
    { pubkey: SPL_TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
  ];

  const data = Buffer.alloc(1 + 8);
  data[0] = IX_WITHDRAW_SOL;
  writeU64LE(data, poolTokens, 1);

  return [
    new TransactionInstruction({
      programId: SPL_STAKE_POOL_PROGRAM_ID,
      keys,
      data,
    }),
  ];
}
