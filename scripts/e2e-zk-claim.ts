/**
 * End-to-end ZK claim test against the deployed sakura-insurance program on
 * devnet. Uses fresh keypairs + fresh test mint so it's idempotent.
 *
 *   1. Init pool (new admin)  → PoolPDA + VaultPDA
 *   2. Buy policy (new user, commitment = Poseidon(obligation, wallet, nonce))
 *   3. Fetch real Pyth SOL/USD account  → slot + price
 *   4. Generate Groth16 proof (snarkjs)
 *   5. Submit claim_payout_with_zk_proof
 *   6. Assert user ATA balance increased by rescue amount
 *
 * Run:   npx tsx scripts/e2e-zk-claim.ts
 */
/* eslint-disable no-console */
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import {
  Connection, Keypair, PublicKey, Transaction,
  sendAndConfirmTransaction, LAMPORTS_PER_SOL, SystemProgram,
} from "@solana/web3.js";
import {
  createMint, createAssociatedTokenAccount, mintTo, getAccount,
  getAssociatedTokenAddress,
} from "@solana/spl-token";

import {
  buildInitializePoolIx, buildBuyPolicyIx, buildClaimPayoutWithZkProofIx,
  derivePoolPDA, deriveVaultPDA, derivePolicyPDA, deriveClaimRecordPDA,
  SAKURA_INSURANCE_PROGRAM_ID,
  PYTH_SOL_USD_DEVNET,
} from "../lib/insurance-pool";
import { PythSolanaReceiver } from "@pythnetwork/pyth-solana-receiver";
import { HermesClient } from "@pythnetwork/hermes-client";
import { Wallet } from "@coral-xyz/anchor";
import {
  generateLiquidationProof, proofToOnchainBytes, computePolicyCommitment,
} from "../lib/zk-proof";

const RPC = process.env.HELIUS_API_KEY
  ? `https://devnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
  : "https://api.devnet.solana.com";

function solscan(kind: "tx"|"account", id: string) {
  return `https://solscan.io/${kind}/${id}?cluster=devnet`;
}
async function airdrop(c: Connection, to: PublicKey, sol: number) {
  const sig = await c.requestAirdrop(to, sol * LAMPORTS_PER_SOL);
  const bh = await c.getLatestBlockhash();
  await c.confirmTransaction({ signature: sig, ...bh }, "confirmed");
}
// Alternative: transfer from funded admin (avoids faucet rate-limit)
async function fundFrom(c: Connection, funder: Keypair, to: PublicKey, sol: number) {
  const tx = new Transaction().add(SystemProgram.transfer({
    fromPubkey: funder.publicKey, toPubkey: to,
    lamports: Math.floor(sol * LAMPORTS_PER_SOL),
  }));
  await sendAndConfirmTransaction(c, tx, [funder], { commitment: "confirmed" });
}

// Convert Solana pubkey → 31-byte big-int (circuit wants 248 bits).
function pubkeyTo31ByteBigInt(pk: PublicKey): bigint {
  const bytes = pk.toBytes();
  let x = 0n;
  for (let i = 0; i < 31; i++) x = (x << 8n) | BigInt(bytes[i]);
  return x;
}

// Pyth PriceUpdateV2 parse — copy of lib.rs logic (tag=1 Full, tag=0 Partial).
function parsePythPriceUpdateV2(data: Buffer): { price: bigint; exponent: number; slot: bigint; feedId: Buffer } {
  let o = 8 + 32;
  const tag = data[o]; o += 1;
  if (tag === 0) o += 1;
  else if (tag !== 1) throw new Error(`bad verification tag ${tag}`);
  const feedId = data.subarray(o, o + 32); o += 32;
  const price = data.readBigInt64LE(o); o += 8;
  o += 8; // conf
  const exponent = data.readInt32LE(o); o += 4;
  o += 32; // publish_time+prev_publish_time+ema_price+ema_conf
  const slot = data.readBigUInt64LE(o);
  return { price, exponent, slot, feedId };
}

async function main() {
  const conn = new Connection(RPC, "confirmed");

  // ── 0. Load admin (solana CLI keypair — already funded) ──
  const adminKpPath = path.join(os.homedir(), ".config/solana/id.json");
  const adminSecret = new Uint8Array(JSON.parse(fs.readFileSync(adminKpPath, "utf8")));
  const admin = Keypair.fromSecretKey(adminSecret);

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  Sakura E2E ZK Claim — devnet");
  console.log("  Program:", SAKURA_INSURANCE_PROGRAM_ID.toBase58());
  console.log("  Admin  :", admin.publicKey.toBase58());
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  // ── 1. Create fresh pool_admin + user + mint_authority + treasury_owner ──
  //    We use `admin` (solana CLI key) as the *pool admin* too to save airdrops.
  //    But derive a fresh pool PDA uniqueness via seed — pool PDA is keyed by admin.
  //    To keep this test idempotent across reruns we create a brand-new mint
  //    (ensures clean vault state). Pool PDA will already exist from prior run,
  //    so we skip init if the account is there.
  const user = Keypair.generate();
  const treasuryOwner = Keypair.generate();
  await fundFrom(conn, admin, user.publicKey, 0.02);

  // Fresh test mint (treat as devnet USDC for this test)
  console.log("Creating fresh 6-decimal test mint (admin = mint authority)…");
  const mint = await createMint(conn, admin, admin.publicKey, null, 6);
  console.log("  mint:", mint.toBase58(), "→", solscan("account", mint.toBase58()));

  // Treasury ATA
  const treasuryAta = await createAssociatedTokenAccount(conn, admin, mint, treasuryOwner.publicKey);
  // User ATA + mint 10000 USDC
  const userAta = await createAssociatedTokenAccount(conn, admin, mint, user.publicKey);
  await mintTo(conn, admin, mint, userAta, admin, 10_000_000_000n); // 10k USDC
  console.log("  user ATA:", userAta.toBase58(), "balance: 10,000 USDC");

  // Use fresh admin keypair for clean pool state (idempotent across reruns).
  const poolAdmin = Keypair.generate();
  await fundFrom(conn, admin, poolAdmin.publicKey, 0.08);

  const [freshPoolPDA] = derivePoolPDA(poolAdmin.publicKey);
  const [freshVaultPDA] = deriveVaultPDA(freshPoolPDA);
  console.log("\n[1/5] Initializing fresh pool…");
  console.log("  admin:", poolAdmin.publicKey.toBase58());
  console.log("  pool :", freshPoolPDA.toBase58());
  console.log("  vault:", freshVaultPDA.toBase58());

  // Re-mint treasury ATA under NEW admin for fees
  // (admin+mint already done; treasuryAta is under admin-created mint — reuse)

  const initIx = buildInitializePoolIx({
    admin: poolAdmin.publicKey,
    adminAgent: poolAdmin.publicKey,          // any pubkey — not used by ZK path
    usdcMint: mint,
    platformTreasury: treasuryAta,
    premiumBps: 500,
    platformFeeBps: 1500,
    minStakeMultiplier: 500,
    maxCoveragePerUserUsdc: 10_000n * 1_000_000n,
    waitingPeriodSec: 0n,                     // zero wait so we can claim immediately
  });
  const sigInit = await sendAndConfirmTransaction(
    conn, new Transaction().add(initIx), [poolAdmin], { commitment: "confirmed" }
  );
  console.log("  ✓ init_pool:", solscan("tx", sigInit));

  // Fund pool vault with USDC so payouts can land. Mint straight to vault ATA.
  await mintTo(conn, admin, mint, freshVaultPDA, admin, 5_000_000_000n); // 5k USDC in vault
  console.log("  ✓ vault funded: 5,000 USDC");

  // ── 3. Buy policy ──
  console.log("\n[2/5] Buying policy…");
  // Simulate a Kamino obligation pubkey for the policy binding.
  const obligation = Keypair.generate().publicKey;
  const userWalletBI = pubkeyTo31ByteBigInt(user.publicKey);
  const obligationBI = pubkeyTo31ByteBigInt(obligation);
  const nonce = BigInt(Date.now());
  const { decimal: commitmentDecimal, bytesBE32: commitmentBytes } =
    await computePolicyCommitment(obligationBI, userWalletBI, nonce);
  console.log("  commitment (dec):", commitmentDecimal.slice(0, 20), "…");

  // Coverage $1000, premium = 5% monthly = $50. Stake >= 5x premium = $250. Use $300.
  const premium = 50n * 1_000_000n;
  const coverage = 1_000n * 1_000_000n;
  const stake = 300n * 1_000_000n;
  const buyIx = buildBuyPolicyIx({
    poolAdmin: poolAdmin.publicKey,
    user: user.publicKey,
    userUsdcAta: userAta,
    platformTreasury: treasuryAta,
    premiumMicroUsdc: premium,
    coverageCapMicroUsdc: coverage,
    stakeMicroUsdc: stake,
    commitmentHash: Buffer.from(commitmentBytes),
  });
  const sigBuy = await sendAndConfirmTransaction(
    conn, new Transaction().add(buyIx), [user], { commitment: "confirmed" }
  );
  console.log("  ✓ buy_policy:", solscan("tx", sigBuy));

  // ── 4. Post a FRESH Pyth price update (devnet static account may be stale).
  //       Fetch VAA from Hermes → post via pyth-solana-receiver → use resulting
  //       PriceUpdateV2 account in claim ix.
  console.log("\n[3/5] Posting fresh Pyth SOL/USD update…");
  const SOL_USD_FEED_ID_HEX = "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";
  const hermes = new HermesClient("https://hermes.pyth.network", {});
  const latest = await hermes.getLatestPriceUpdates([SOL_USD_FEED_ID_HEX], { encoding: "base64" });
  const priceUpdateData = latest.binary.data as string[];
  const receiver = new PythSolanaReceiver({
    connection: conn,
    wallet: new Wallet(poolAdmin),
  });
  const builder = receiver.newTransactionBuilder({ closeUpdateAccounts: false });
  await builder.addPostPriceUpdates(priceUpdateData);
  let postedPythAccount: PublicKey = PublicKey.default;
  await builder.addPriceConsumerInstructions(async (getPriceUpdateAccount) => {
    postedPythAccount = getPriceUpdateAccount(SOL_USD_FEED_ID_HEX);
    return [];
  });
  const versioned = await builder.buildVersionedTransactions({ computeUnitPriceMicroLamports: 50_000 });
  for (const { tx, signers } of versioned) {
    tx.sign([poolAdmin, ...signers]);
    const sig = await conn.sendTransaction(tx, { skipPreflight: false });
    const bh = await conn.getLatestBlockhash();
    await conn.confirmTransaction({ signature: sig, ...bh }, "confirmed");
  }
  if (postedPythAccount.equals(PublicKey.default)) throw new Error("Could not resolve posted Pyth account");
  console.log("  ✓ posted price update account:", postedPythAccount.toBase58());

  const pythAcct = await conn.getAccountInfo(postedPythAccount);
  if (!pythAcct) throw new Error("Pyth account fetch failed");
  const pyth = parsePythPriceUpdateV2(Buffer.from(pythAcct.data));
  console.log(`  price = ${pyth.price} × 10^${pyth.exponent}  slot=${pyth.slot}`);
  console.log(`  feed_id = ${pyth.feedId.toString("hex")}`);

  // Convert Pyth price to micro-USD. exp is usually -8; micro = 1e6.
  //   price_micro = price * 10^(6 + exp).  exp=-8 → ÷100
  const adj = 6 + pyth.exponent;
  let priceMicro: bigint;
  if (adj >= 0) priceMicro = BigInt(pyth.price) * (10n ** BigInt(adj));
  else priceMicro = BigInt(pyth.price) / (10n ** BigInt(-adj));
  console.log(`  price_micro_usd = ${priceMicro}`);

  // ── 5. Generate Groth16 proof ──
  //
  // CIRCUIT UNIT CONVENTION (important, was previously mis-documented):
  //   `collateral_amount` in the circuit is in WHOLE TOKEN UNITS, not
  //   lamports. `oracle_price_usd_micro` is micro-USD per WHOLE SOL.
  //   Thus (collateral_amount × oracle_price) = micro-USD of collateral
  //   value, directly comparable to `debt_usd_micro` (also micro-USD).
  //
  // Scenario: user has 10 SOL collateral against $800 USDC debt.
  //   SOL price ≈ $80  →  collateral value ≈ $800
  //   HF = 800/800 = 1.000 — underwater, below 1.05 trigger.
  //   Rescue 5 buckets × $100 = $500 USDC repay.
  //
  // Circuit constraint: coll × price × 10000 < trigger × debt × 1e6
  //   Pyth returns oracle_price_usd_micro (real SOL price, ~$80-100)
  //   We pick collateral_amount so coll × price_micro ≈ debt_micro.
  //   debt = $800 = 800_000_000 micro-USD   (in decimal)
  //   collateral = debt / price_micro × scaling that gives HF ~ 1.00
  const triggerHfBps = 10500;
  const rescueBucket = 5;                      // 5 × $100 = $500 rescue
  const rescueUsdcMicro = BigInt(rescueBucket) * 100n * 1_000_000n;
  // Target an underwater position: coll_value ≈ 0.998 × debt (HF ≈ 0.998)
  // Pick debt = $800 (comfortably > 5 × $100 bucket bound).
  const debt = 800n * 1_000_000n;              // 800_000_000 micro-USD
  // collateral (whole SOL units) chosen so coll × price < trigger/10000 × debt × 1e6 / 10000
  //   = trigger × debt × 100 / (price × 10000)  … algebra, solving inequality strictly.
  // Equivalent concrete derivation:
  //   Want (coll × price) / debt < 1.05
  //   → coll < 1.05 × debt / price
  //   → coll < 1.05 × 8e8 / priceMicro
  // Strictly below 1.05 with a small margin to avoid boundary:
  const maxCollFloat = (Number(debt) * 1.04) / Number(priceMicro);
  const collateral = BigInt(Math.max(1, Math.floor(maxCollFloat)));
  // Verify the inequality numerically before wasting a proof gen
  const lhs = collateral * priceMicro * 10000n;
  const rhs = BigInt(triggerHfBps) * debt * 1_000_000n;
  if (lhs >= rhs) {
    throw new Error(
      `circuit inequality violated pre-flight: lhs=${lhs} >= rhs=${rhs}. ` +
      `Adjust collateral/debt/price (SOL price may be too high for this scenario).`
    );
  }
  // Also ensure bucket × 1e8 <= debt
  const bucketBound = BigInt(rescueBucket) * 100_000_000n;
  if (bucketBound > debt) {
    throw new Error(
      `bucket bound violated: ${rescueBucket} × $100 = ${bucketBound} > debt ${debt}`
    );
  }
  console.log(`  witness: collateral=${collateral} whole-SOL, debt=${debt} micro-USD, trigger_hf=${triggerHfBps}`);
  console.log(`  → implied HF = ${(Number(collateral) * Number(priceMicro) / Number(debt)).toFixed(4)} (< 1.05 ✓)`);

  console.log("\n[4/5] Generating Groth16 proof…");
  const proofBundle = await generateLiquidationProof({
    policyCommitment: BigInt(commitmentDecimal),
    triggerHfBps,
    rescueAmountBucket: rescueBucket,
    oraclePriceUsdMicro: priceMicro,
    oracleSlot: pyth.slot,
    collateralAmount: collateral,
    debtUsdMicro: debt,
    positionAccountBytes: obligationBI,
    userWalletBytes: userWalletBI,
    nonce,
  });
  // proofToOnchainBytes now correctly handles the prepared-alpha convention
  // (no double-negation of proof_a). Previously this block manually rebuilt
  // proofA to work around a bug in lib/zk-proof.ts — no longer needed.
  const { proofA, proofB, proofC } = proofToOnchainBytes(proofBundle.proof);
  console.log("  ✓ proof generated (public signals:", proofBundle.publicSignals.length, ")");
  console.log("  publicSignals:", proofBundle.publicSignals);

  // Sanity-check: verify off-chain against our VK before wasting a tx.
  {
    const { verifyLiquidationProof } = await import("../lib/zk-proof");
    const ok = await verifyLiquidationProof(proofBundle.proof, proofBundle.publicSignals);
    console.log("  off-chain snarkjs verify:", ok ? "✓ OK" : "✗ FAIL");
    if (!ok) throw new Error("off-chain verify failed — circuit/witness mismatch");
  }

  // ── 6. Submit claim ──
  console.log("\n[5/5] Submitting claim_payout_with_zk_proof…");

  // Re-read the Pyth account right before submit to detect if it got
  // overwritten between initial read and claim submission.
  const pythAcct2 = await conn.getAccountInfo(postedPythAccount);
  if (!pythAcct2) throw new Error("Pyth account vanished before claim");
  const pyth2 = parsePythPriceUpdateV2(Buffer.from(pythAcct2.data));
  console.log(`  [re-check] slot=${pyth2.slot} price=${pyth2.price} (originally: slot=${pyth.slot} price=${pyth.price})`);
  if (pyth2.slot !== pyth.slot) {
    console.log(`  ⚠ Pyth account was overwritten! Using fresh values.`);
  }
  // Recompute priceMicro from fresh account (in case exponent changed too)
  const adj2 = 6 + pyth2.exponent;
  const priceMicro2: bigint = adj2 >= 0
    ? BigInt(pyth2.price) * (10n ** BigInt(adj2))
    : BigInt(pyth2.price) / (10n ** BigInt(-adj2));
  console.log(`  [re-check] price_micro=${priceMicro2} (originally: ${priceMicro})`);
  // Show EXACT bytes the program will read at the slot offset (125..133)
  const slotOffset = 125;
  const slotBytes = Array.from(pythAcct2.data.slice(slotOffset, slotOffset + 8))
    .map(b => b.toString(16).padStart(2, "0")).join(" ");
  console.log(`  [bytes] posted_slot @ offset 125 = ${slotBytes}`);

  const claimNonce = BigInt(Date.now() + 1);
  const claimIx = buildClaimPayoutWithZkProofIx({
    poolAdmin: poolAdmin.publicKey,
    policyUser: user.publicKey,
    payer: user.publicKey,
    rescueDestinationAta: userAta,
    pythPriceAccount: postedPythAccount,
    amountMicroUsdc: rescueUsdcMicro,
    claimNonce,
    triggerHfBps,
    rescueAmountBucket: rescueBucket,
    oraclePriceUsdMicro: priceMicro,
    oracleSlot: pyth.slot,
    proofA, proofB, proofC,
  });

  // Higher CU budget — pairing + syscall is heavy.
  const { ComputeBudgetProgram } = await import("@solana/web3.js");
  const tx = new Transaction()
    .add(ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }))
    .add(claimIx);

  const balBefore = (await getAccount(conn, userAta)).amount;
  try {
    const sigClaim = await sendAndConfirmTransaction(conn, tx, [user], { commitment: "confirmed" });
    const balAfter = (await getAccount(conn, userAta)).amount;
    console.log("  ✓ claim landed:", solscan("tx", sigClaim));
    console.log(`  user ATA: ${balBefore} → ${balAfter}  (Δ = ${balAfter - balBefore} micro-USDC)`);
    if (balAfter - balBefore === rescueUsdcMicro) {
      console.log("\n🎉 E2E PASS — rescue amount received, proof verified on-chain.");
      process.exit(0);
    } else {
      console.log(`\n⚠️  balance delta ${balAfter - balBefore} != expected ${rescueUsdcMicro}`);
      process.exit(2);
    }
  } catch (e: any) {
    console.error("\n❌ claim failed:", e.message ?? e);
    if (e.logs) console.error("LOGS:\n" + (e.logs as string[]).join("\n"));
    if (e.transactionLogs) console.error("TX LOGS:\n" + e.transactionLogs.join("\n"));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("fatal:", e);
  process.exit(1);
});
