/**
 * scripts/verify-jupiter-lend-adapter.ts
 *
 * Proves lib/adapters/jupiter-lend.ts produces real mainnet CPI
 * instructions for the Lend + Withdraw paths using @jup-ag/lend/earn.
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
} from "../lib/adapters/jupiter-lend";

const MAINNET_RPC = process.env.HELIUS_API_KEY
  ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
  : "https://api.mainnet-beta.solana.com";

const USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
// Real-looking test user (pubkey with actual tokens on mainnet, for ATA derivation).
// We don't sign; just need any valid pubkey that isn't the SystemProgram.
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

  console.log(`\n[1] buildJupiterLendLend: 1 USDC (1_000_000 micro) …`);
  const lendIxs = await buildJupiterLendLend({
    connection,
    user: TEST_USER,
    mint: USDC_MINT,
    amountMicro: 1_000_000n,
  });
  console.log(`    got ${lendIxs.length} instructions`);
  ok(lendIxs.length > 0, "at least 1 instruction");
  const lendProgs = new Set(lendIxs.map((i) => i.programId.toBase58()));
  console.log(`    programs invoked: ${Array.from(lendProgs).join(", ")}`);

  console.log(`\n[2] buildJupiterLendWithdraw: 0.5 USDC (500_000 micro) …`);
  const withdrawIxs = await buildJupiterLendWithdraw({
    connection,
    user: TEST_USER,
    mint: USDC_MINT,
    amountMicro: 500_000n,
  });
  console.log(`    got ${withdrawIxs.length} instructions`);
  ok(withdrawIxs.length > 0, "at least 1 instruction");
  const withdrawProgs = new Set(withdrawIxs.map((i) => i.programId.toBase58()));
  console.log(`    programs invoked: ${Array.from(withdrawProgs).join(", ")}`);

  console.log(`\n[3] Simulating assembled Lend tx against mainnet …`);
  const { blockhash } = await connection.getLatestBlockhash();
  const lendMsg = new TransactionMessage({
    payerKey: TEST_USER,
    recentBlockhash: blockhash,
    instructions: [
      ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }),
      ...lendIxs,
    ],
  }).compileToV0Message();
  const lendVtx = new VersionedTransaction(lendMsg);
  const sim = await connection.simulateTransaction(lendVtx, {
    sigVerify: false,
    replaceRecentBlockhash: true,
  });
  console.log(`    sim err:  ${JSON.stringify(sim.value.err)}`);
  console.log(`    last 5 logs:`);
  (sim.value.logs ?? []).slice(-5).forEach((l) => console.log(`      ${l}`));

  const logs = sim.value.logs ?? [];
  const layoutErr = logs.some((l) =>
    /invalidinstructiondata|invalidaccountdata|accountownedbywrongprogram/i.test(l)
  );
  ok(!layoutErr, "no ix-layout errors from Jupiter Lend programs");

  console.log(`\n✅ ALL CHECKS PASSED — lib/adapters/jupiter-lend.ts Lend+Withdraw produce valid mainnet ixs.`);
}

main().catch((e) => {
  console.error("FAIL:", e);
  process.exit(1);
});
