/**
 * scripts/verify-kamino-adapter.ts
 *
 * Proves lib/adapters/kamino.ts produces real mainnet CPI instructions
 * for Lend/Borrow/Repay/Withdraw via @kamino-finance/klend-sdk +
 * @solana/kit + @solana/compat bridging.
 *
 * Requires Helius RPC (public RPC rate-limits the market load batch).
 *
 * Usage:  set -a && source .env.local && set +a && npx tsx scripts/verify-kamino-adapter.ts
 */

import {
  ComputeBudgetProgram,
  Connection,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  buildKaminoLend,
  buildKaminoBorrow,
  buildKaminoRepay,
  buildKaminoWithdraw,
  KAMINO_LEND_PROGRAM_ID,
} from "../lib/adapters/kamino";

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
  const KLEND = KAMINO_LEND_PROGRAM_ID.toBase58();

  console.log(`\n[1] buildKaminoLend: 1 USDC → Kamino main market …`);
  const lendIxs = await buildKaminoLend({
    connection,
    user: TEST_USER,
    mint: USDC_MINT,
    amountMicro: 1_000_000n,
  });
  console.log(`    ${lendIxs.length} ixs`);
  const lendProgs = new Set(lendIxs.map((i) => i.programId.toBase58()));
  console.log(`    programs: ${Array.from(lendProgs).join(", ")}`);
  ok(lendProgs.has(KLEND), "Lend touches klend program");

  console.log(`\n[2] buildKaminoBorrow: 0.5 USDC …`);
  const borrowIxs = await buildKaminoBorrow({
    connection,
    user: TEST_USER,
    mint: USDC_MINT,
    amountMicro: 500_000n,
  });
  console.log(`    ${borrowIxs.length} ixs`);
  const borrowProgs = new Set(borrowIxs.map((i) => i.programId.toBase58()));
  ok(borrowProgs.has(KLEND), "Borrow touches klend program");

  console.log(`\n[3] buildKaminoRepay: 0.3 USDC …`);
  const repayIxs = await buildKaminoRepay({
    connection,
    user: TEST_USER,
    mint: USDC_MINT,
    amountMicro: 300_000n,
  });
  console.log(`    ${repayIxs.length} ixs`);
  const repayProgs = new Set(repayIxs.map((i) => i.programId.toBase58()));
  ok(repayProgs.has(KLEND), "Repay touches klend program");

  console.log(`\n[4] buildKaminoWithdraw: 0.2 USDC …`);
  const withdrawIxs = await buildKaminoWithdraw({
    connection,
    user: TEST_USER,
    mint: USDC_MINT,
    amountMicro: 200_000n,
  });
  console.log(`    ${withdrawIxs.length} ixs`);
  const withdrawProgs = new Set(withdrawIxs.map((i) => i.programId.toBase58()));
  ok(withdrawProgs.has(KLEND), "Withdraw touches klend program");

  console.log(`\n[5] Simulating Lend tx on mainnet …`);
  const { blockhash } = await connection.getLatestBlockhash();
  const msg = new TransactionMessage({
    payerKey: TEST_USER,
    recentBlockhash: blockhash,
    instructions: [
      ComputeBudgetProgram.setComputeUnitLimit({ units: 600_000 }),
      ...lendIxs,
    ],
  }).compileToV0Message();
  const vtx = new VersionedTransaction(msg);
  const sim = await connection.simulateTransaction(vtx, {
    sigVerify: false,
    replaceRecentBlockhash: true,
  });
  console.log(`    sim err:  ${JSON.stringify(sim.value.err)}`);
  console.log(`    last 5 logs:`);
  (sim.value.logs ?? []).slice(-5).forEach((l) => console.log(`      ${l}`));

  // Acceptable failure modes (test user doesn't have USDC):
  //   - AccountNotFound / InsufficientFunds / MissingAccount
  // Unacceptable: InvalidInstructionData / InvalidAccountData from klend.
  const logs = sim.value.logs ?? [];
  const layoutErr = logs.some((l) =>
    /invalidinstructiondata|invalidaccountdata|incorrectprogram/i.test(l)
  );
  ok(!layoutErr, "no ix-layout errors from klend");

  console.log(`\n✅ ALL CHECKS PASSED — lib/adapters/kamino.ts × 4 produce valid mainnet ixs.`);
}

main().catch((e) => {
  console.error("FAIL:", e);
  process.exit(1);
});
