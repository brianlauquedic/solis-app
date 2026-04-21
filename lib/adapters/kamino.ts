/**
 * lib/adapters/kamino.ts — Kamino Lend adapter (REAL CPI via klend-sdk)
 *
 * Status (2026-04-22): all 4 actions produce real mainnet CPI ixs.
 *
 * Kamino's SDK uses the new `@solana/kit` type system (`Address`,
 * `Rpc<...>`, `TransactionSigner`), while our executor speaks classic
 * `@solana/web3.js` (`PublicKey`, `Connection`, `TransactionInstruction`).
 * This adapter bridges the two:
 *
 *   Legacy PublicKey        → kit Address     via @solana/compat
 *   Legacy Connection URL   → kit Rpc         via @solana/kit
 *   (no real signing)       → NoopSigner      via @solana/signers
 *   kit Instruction[]       → legacy TransactionInstruction[]  (inlined below)
 *
 * KaminoAction returns FOUR instruction arrays — computeBudgetIxs,
 * setupIxs, lendingIxs, cleanupIxs — which we concatenate in order.
 * `setupIxs` contains ATA creation + init-obligation for first-time
 * users, so this is safe to call even when the user has no Kamino
 * obligation yet.
 *
 * Mainnet constants:
 *   Program:      KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD
 *   Main Market:  7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF
 *   USDC Reserve: D6q6wuQSrifJKZYpR1M8R4YawnLDtDsMmWM1NbBmgJ59
 *   SOL Reserve:  d4A2prbA2whesmvHaL88BH6Ewn5N4bTSU2Ze8P6Bc4Q
 *
 * References:
 *   - SDK:    https://www.npmjs.com/package/@kamino-finance/klend-sdk
 *   - GitHub: https://github.com/Kamino-Finance/klend-sdk
 */

import {
  Connection,
  PublicKey,
  TransactionInstruction,
} from "@solana/web3.js";
import BN from "bn.js";
import { createSolanaRpc } from "@solana/kit";
import { fromLegacyPublicKey } from "@solana/compat";
import { createNoopSigner } from "@solana/signers";
import {
  KaminoMarket,
  KaminoAction,
  VanillaObligation,
  type KaminoAction as KaminoActionType,
} from "@kamino-finance/klend-sdk";

export const KAMINO_LEND_PROGRAM_ID = new PublicKey(
  "KLend2g3cP87fffoy8q1mQqGKjrxjC8boSyAYavgmjD"
);
export const KAMINO_MAIN_MARKET = new PublicKey(
  "7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF"
);
export const KAMINO_MAIN_USDC_RESERVE = new PublicKey(
  "D6q6wuQSrifJKZYpR1M8R4YawnLDtDsMmWM1NbBmgJ59"
);
export const KAMINO_MAIN_SOL_RESERVE = new PublicKey(
  "d4A2prbA2whesmvHaL88BH6Ewn5N4bTSU2Ze8P6Bc4Q"
);

// Solana's nominal slot time — used by klend-sdk for interest-accrual
// interpolation between snapshot loads. 460ms is the network median.
const SLOT_DURATION_MS = 460;

export interface KaminoActionParams {
  connection: Connection;
  user: PublicKey;
  mint: PublicKey;
  amountMicro: bigint;
}

// ── kit ↔ legacy bridge ─────────────────────────────────────────────

/**
 * Convert a kit `IInstruction` to a legacy `TransactionInstruction`.
 *
 * Kit's IAccountMeta uses an `AccountRole` enum (0..3); the bit pattern
 * is: bit 0 = writable, bit 1 = signer.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function kitIxToLegacy(ix: any): TransactionInstruction {
  const programId = new PublicKey(ix.programAddress as string);
  const keys = (ix.accounts ?? []).map((a: { address: string; role: number }) => ({
    pubkey: new PublicKey(a.address),
    isSigner: (a.role & 0b10) !== 0, // roles 2, 3
    isWritable: (a.role & 0b01) !== 0, // roles 1, 3
  }));
  const data = ix.data ? Buffer.from(ix.data as Uint8Array) : Buffer.alloc(0);
  return new TransactionInstruction({ programId, keys, data });
}

function extractAllIxs(action: KaminoActionType): TransactionInstruction[] {
  return [
    ...action.computeBudgetIxs,
    ...action.setupIxs,
    ...action.lendingIxs,
    ...action.cleanupIxs,
  ].map(kitIxToLegacy);
}

/**
 * Boot a kit RPC + KaminoMarket instance. Reused across all 4 actions
 * per call — KaminoMarket.load does a single getMultipleAccounts batch
 * so the cost is one RPC round trip total.
 */
async function bootKamino(connection: Connection): Promise<{
  market: KaminoMarket;
  programAddress: ReturnType<typeof fromLegacyPublicKey>;
}> {
  const rpc = createSolanaRpc(connection.rpcEndpoint);
  const programAddress = fromLegacyPublicKey(KAMINO_LEND_PROGRAM_ID);
  const marketAddress = fromLegacyPublicKey(KAMINO_MAIN_MARKET);
  const market = await KaminoMarket.load(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rpc as any,
    marketAddress,
    SLOT_DURATION_MS,
    programAddress,
    true // withReserves
  );
  if (!market) {
    throw new Error(
      `KaminoMarket.load returned null for ${KAMINO_MAIN_MARKET.toBase58()}`
    );
  }
  return { market, programAddress };
}

// ── Public API ──────────────────────────────────────────────────────

export async function buildKaminoLend(
  p: KaminoActionParams
): Promise<TransactionInstruction[]> {
  const { market, programAddress } = await bootKamino(p.connection);
  const userAddr = fromLegacyPublicKey(p.user);
  const signer = createNoopSigner(userAddr);
  const obligation = new VanillaObligation(programAddress);

  const action = await KaminoAction.buildDepositTxns(
    market,
    new BN(p.amountMicro.toString()),
    fromLegacyPublicKey(p.mint),
    signer,
    obligation,
    true, // useV2Ixs
    undefined, // scopeRefreshConfig
    0, // extraComputeBudget (we add our own CU limit in the executor)
    true // includeAtaIxs
  );
  return extractAllIxs(action);
}

export async function buildKaminoBorrow(
  p: KaminoActionParams
): Promise<TransactionInstruction[]> {
  const { market, programAddress } = await bootKamino(p.connection);
  const userAddr = fromLegacyPublicKey(p.user);
  const signer = createNoopSigner(userAddr);
  const obligation = new VanillaObligation(programAddress);

  const action = await KaminoAction.buildBorrowTxns(
    market,
    new BN(p.amountMicro.toString()),
    fromLegacyPublicKey(p.mint),
    signer,
    obligation,
    true,
    undefined,
    0,
    true
  );
  return extractAllIxs(action);
}

export async function buildKaminoRepay(
  p: KaminoActionParams
): Promise<TransactionInstruction[]> {
  const { market, programAddress } = await bootKamino(p.connection);
  const userAddr = fromLegacyPublicKey(p.user);
  const signer = createNoopSigner(userAddr);
  const obligation = new VanillaObligation(programAddress);

  // buildRepayTxns requires currentSlot for accrual-aware repay-all handling
  const slot = await p.connection.getSlot("confirmed");

  const action = await KaminoAction.buildRepayTxns(
    market,
    new BN(p.amountMicro.toString()),
    fromLegacyPublicKey(p.mint),
    signer,
    obligation,
    true, // useV2Ixs
    undefined, // scopeRefreshConfig
    BigInt(slot), // currentSlot
    undefined, // payer (defaults to signer)
    0, // extraComputeBudget
    true // includeAtaIxs
  );
  return extractAllIxs(action);
}

export async function buildKaminoWithdraw(
  p: KaminoActionParams
): Promise<TransactionInstruction[]> {
  const { market, programAddress } = await bootKamino(p.connection);
  const userAddr = fromLegacyPublicKey(p.user);
  const signer = createNoopSigner(userAddr);
  const obligation = new VanillaObligation(programAddress);

  const action = await KaminoAction.buildWithdrawTxns(
    market,
    new BN(p.amountMicro.toString()),
    fromLegacyPublicKey(p.mint),
    signer,
    obligation,
    true,
    undefined,
    0,
    true
  );
  return extractAllIxs(action);
}
