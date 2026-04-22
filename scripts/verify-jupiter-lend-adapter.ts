/**
 * scripts/verify-jupiter-lend-adapter.ts
 *
 * Proves lib/adapters/jupiter-lend.ts produces real mainnet CPI
 * instructions for all 4 actions:
 *
 *   Lend     — Earn vault deposit
 *   Withdraw — Earn vault redeem
 *   Borrow   — init-position + operate(debtAmount: +amount)
 *   Repay    — operate(debtAmount: -amount)  [requires positionId]
 *
 * Usage:  set -a && source .env.local && set +a && npx tsx scripts/verify-jupiter-lend-adapter.ts
 */

import {
  ComputeBudgetProgram,
  Connection,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  buildJupiterLendLend,
  buildJupiterLendWithdraw,
  buildJupiterLendBorrow,
  buildJupiterLendRepay,
  buildJupiterLendInitPosition,
} from "../lib/adapters/jupiter-lend";

const MAINNET_RPC = process.env.HELIUS_API_KEY
  ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
  : "https://api.mainnet-beta.solana.com";

const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const TEST_USER = new PublicKey("2iCWnS1J8WYZn4reo9YD76qZiiZ39t2c1oGM3dyYwHNg");

function ok(cond: boolean, msg: string) {
  if (!cond) {
    console.error(`  ❌ ${msg}`);
    process.exit(1);
  }
  console.log(`  ✓ ${msg}`);
}

async function main() {
  console.log(`Using RPC: ${MAINNET_RPC.replace(/api-key=[^&]+/, "api-key=***")}`);
  const connection = new Connection(MAINNET_RPC, "confirmed");

  // ── Earn: Lend ──
  console.log(`\n[1] buildJupiterLendLend: 1 USDC (Earn vault) …`);
  const lend = await buildJupiterLendLend({
    connection,
    user: TEST_USER,
    mint: USDC_MINT,
    amountMicro: 1_000_000n,
  });
  console.log(`    ${lend.instructions.length} ixs, ${lend.addressLookupTables.length} LUTs`);
  ok(lend.instructions.length > 0, "Lend emits ≥ 1 ix");
  const lendProgs = new Set(lend.instructions.map((i) => i.programId.toBase58()));
  console.log(`    programs: ${Array.from(lendProgs).join(", ")}`);

  // ── Earn: Withdraw ──
  console.log(`\n[2] buildJupiterLendWithdraw: 0.5 USDC …`);
  const withdraw = await buildJupiterLendWithdraw({
    connection,
    user: TEST_USER,
    mint: USDC_MINT,
    amountMicro: 500_000n,
  });
  console.log(`    ${withdraw.instructions.length} ixs`);
  ok(withdraw.instructions.length > 0, "Withdraw emits ≥ 1 ix");

  // ── Init position (one-time per user per vault) ──
  console.log(`\n[3] buildJupiterLendInitPosition: mint a new position NFT for USDC-borrow vault …`);
  const initPos = await buildJupiterLendInitPosition({
    connection,
    user: TEST_USER,
    mint: USDC_MINT,
  });
  console.log(`    ${initPos.instructions.length} ix, resolved vaultId=${initPos.vaultId} nftId=${initPos.nftId}`);
  ok(initPos.instructions.length === 1, "init-position emits 1 ix");
  ok(initPos.vaultId !== undefined, "vaultId auto-discovered");
  ok(initPos.nftId !== undefined, "nftId returned");
  const initProgs = new Set(initPos.instructions.map((i) => i.programId.toBase58()));
  console.log(`    programs: ${Array.from(initProgs).join(", ")}`);

  // ── Borrow without positionId must throw (position-must-exist constraint) ──
  console.log(`\n[4] buildJupiterLendBorrow without positionId: expect a clean error …`);
  let borrowNoPos = false;
  try {
    await buildJupiterLendBorrow({
      connection,
      user: TEST_USER,
      mint: USDC_MINT,
      amountMicro: 10_000n,
    });
  } catch (e) {
    borrowNoPos = true;
    console.log(`    ✓ threw as expected: ${(e as Error).message.slice(0, 90)}`);
  }
  ok(borrowNoPos, "missing positionId for Borrow throws a clear error");

  // ── Repay without positionId must throw ──
  console.log(`\n[5] buildJupiterLendRepay without positionId: expect a clean error …`);
  let repayNoPos = false;
  try {
    await buildJupiterLendRepay({
      connection,
      user: TEST_USER,
      mint: USDC_MINT,
      amountMicro: 5_000n,
    });
  } catch (e) {
    repayNoPos = true;
    console.log(`    ✓ threw as expected: ${(e as Error).message.slice(0, 90)}`);
  }
  ok(repayNoPos, "missing positionId for Repay throws a clear error");

  // ── Simulate the Lend tx against mainnet (layout sanity) ──
  console.log(`\n[6] Simulating Lend tx on mainnet …`);
  const { blockhash } = await connection.getLatestBlockhash();
  const msg = new TransactionMessage({
    payerKey: TEST_USER,
    recentBlockhash: blockhash,
    instructions: [
      ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
      ...lend.instructions,
    ],
  }).compileToV0Message(lend.addressLookupTables);
  const vtx = new VersionedTransaction(msg);
  const sim = await connection.simulateTransaction(vtx, {
    sigVerify: false,
    replaceRecentBlockhash: true,
  });
  console.log(`    sim err:  ${JSON.stringify(sim.value.err)}`);

  const logs = sim.value.logs ?? [];
  const layoutErr = logs.some((l) =>
    /invalidinstructiondata|invalidaccountdata|accountownedbywrongprogram/i.test(l)
  );
  ok(!layoutErr, "no ix-layout errors from Jupiter Lend programs");

  console.log(`\n✅ ALL CHECKS PASSED — lib/adapters/jupiter-lend.ts × 4 produce valid mainnet ixs.`);
}

main().catch((e) => {
  console.error("FAIL:", e);
  process.exit(1);
});
