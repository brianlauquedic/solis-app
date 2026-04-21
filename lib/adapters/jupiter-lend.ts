/**
 * lib/adapters/jupiter-lend.ts — Jupiter Lend adapter (REAL CPI for Earn)
 *
 * Status matrix (2026-04-22):
 *   Lend     ✅ real CPI via @jup-ag/lend/earn:getDepositIxs
 *   Withdraw ✅ real CPI via @jup-ag/lend/earn:getWithdrawIxs
 *   Borrow   🟡 Memo audit stub — needs vaultId + positionId (see below)
 *   Repay    🟡 Memo audit stub — same
 *
 * Earn (Lend/Withdraw) only needs `asset + amount`, so it maps cleanly
 * onto our (mint, amountMicro) action shape. Borrow/Repay on Jupiter
 * Lend requires `vaultId + positionId` to identify which collateralised
 * borrow position to operate on; these are not available in our
 * generic BuildActionParams shape. When the intent-executor skill
 * produces an intent that borrows, it should additionally emit the
 * chosen vaultId + positionId (or create a new position via
 * getInitPositionIx) — plumbing tracked in a follow-up commit.
 *
 * Mainnet TVL (as of 2026-04-22): ~$1.65B — #1 Solana lending by Grid
 * gridRank (88). Launched Aug 2025.
 *
 * References:
 *   - SDK npm: https://www.npmjs.com/package/@jup-ag/lend (v0.1.9+)
 *   - Docs:    https://dev.jup.ag/docs/lend
 *   - GitHub:  https://github.com/jup-ag/jupiter-lend
 */

import {
  Connection,
  PublicKey,
  TransactionInstruction,
} from "@solana/web3.js";
import BN from "bn.js";
import { getDepositIxs, getWithdrawIxs } from "@jup-ag/lend/earn";

const MEMO_PROGRAM_ID = new PublicKey(
  "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr"
);

export interface JupiterLendActionParams {
  connection: Connection;
  user: PublicKey;
  mint: PublicKey;
  amountMicro: bigint;
}

/** Lend: deposit assets into Jupiter Lend Earn vault to earn yield. REAL CPI. */
export async function buildJupiterLendLend(
  p: JupiterLendActionParams
): Promise<TransactionInstruction[]> {
  const { ixs } = await getDepositIxs({
    connection: p.connection,
    signer: p.user,
    asset: p.mint,
    amount: new BN(p.amountMicro.toString()),
  });
  return ixs;
}

/** Withdraw: redeem fTokens → underlying asset from Earn vault. REAL CPI. */
export async function buildJupiterLendWithdraw(
  p: JupiterLendActionParams
): Promise<TransactionInstruction[]> {
  const { ixs } = await getWithdrawIxs({
    connection: p.connection,
    signer: p.user,
    asset: p.mint,
    amount: new BN(p.amountMicro.toString()),
  });
  return ixs;
}

/**
 * Borrow: open or modify a collateralised borrow position.
 *
 * 🚧 Pending integration with intent-executor plumbing:
 *   - Requires `vaultId` (e.g., SOL-collateral/USDC-borrow market)
 *   - Requires `positionId` (existing user position or new via getInitPositionIx)
 *   - Delta form: `getOperateIx({ colAmount: 0, debtAmount: +amountMicro })`
 *   See @jup-ag/lend/borrow:getOperateIx signature.
 */
export async function buildJupiterLendBorrow(
  p: JupiterLendActionParams
): Promise<TransactionInstruction[]> {
  const payload =
    `sakura:v1:JupiterLend:borrow:user=${p.user.toBase58()}:` +
    `mint=${p.mint.toBase58()}:amount=${p.amountMicro}:` +
    `note=vaultId+positionId-required-see-getOperateIx`;
  return [
    new TransactionInstruction({
      programId: MEMO_PROGRAM_ID,
      keys: [{ pubkey: p.user, isSigner: true, isWritable: false }],
      data: Buffer.from(payload, "utf8"),
    }),
  ];
}

/** Repay: reduce debt on an existing borrow position. 🚧 same plumbing need as Borrow. */
export async function buildJupiterLendRepay(
  p: JupiterLendActionParams
): Promise<TransactionInstruction[]> {
  const payload =
    `sakura:v1:JupiterLend:repay:user=${p.user.toBase58()}:` +
    `mint=${p.mint.toBase58()}:amount=${p.amountMicro}:` +
    `note=vaultId+positionId-required-see-getOperateIx`;
  return [
    new TransactionInstruction({
      programId: MEMO_PROGRAM_ID,
      keys: [{ pubkey: p.user, isSigner: true, isWritable: false }],
      data: Buffer.from(payload, "utf8"),
    }),
  ];
}
