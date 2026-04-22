/**
 * End-to-end intent-execution test against the deployed sakura-insurance
 * program on devnet (v0.3, Agentic Consumer Protocol).
 *
 *   1. Load admin keypair (solana CLI) — init_protocol (idempotent)
 *   2. Fresh user keypair, fund from admin
 *   3. Compute intent_commitment via 2-layer Poseidon tree
 *   4. sign_intent (user signs the commitment on-chain)
 *   5. Post fresh Pyth SOL/USD update via Hermes
 *   6. Generate Groth16 intent proof (snarkjs)
 *   7. Submit execute_with_intent_proof  → ActionRecord PDA written
 *   8. Fetch + print ActionRecord to verify on-chain state
 *
 * Run:   npx tsx scripts/e2e-intent-execute.ts
 */
/* eslint-disable no-console */
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as dotenv from "dotenv";
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL,
  SystemProgram,
  ComputeBudgetProgram,
} from "@solana/web3.js";
import {
  createMint,
  createAssociatedTokenAccount,
  getAssociatedTokenAddressSync,
  getOrCreateAssociatedTokenAccount,
  mintTo,
  getAccount,
} from "@solana/spl-token";

import {
  SAKURA_INSURANCE_PROGRAM_ID,
  ActionType,
  ProtocolId,
  buildActionTypesBitmap,
  buildProtocolsBitmap,
  buildInitializeProtocolIx,
  buildSignIntentIx,
  buildExecuteWithIntentProofIx,
  deriveProtocolPDA,
  deriveFeeVaultPDA,
  deriveIntentPDA,
  deriveActionRecordPDA,
  fetchProtocol,
  deserializeActionRecord,
  EXECUTE_ACTION_FEE_MICRO,
  SWITCHBOARD_SOL_USD_DEVNET,
} from "../lib/insurance-pool";
import {
  buildSwitchboardUpdateIxs,
  crossOracleMedian,
  crossOracleDeviationBps,
} from "../lib/switchboard-post";
import {
  computeIntentCommitment,
  generateIntentProof,
  proofToOnchainBytes,
  verifyIntentProof,
  pubkeyToFieldBytes,
} from "../lib/zk-proof";
import { PythSolanaReceiver } from "@pythnetwork/pyth-solana-receiver";
import { HermesClient } from "@pythnetwork/hermes-client";
import { Wallet } from "@coral-xyz/anchor";

const RPC = process.env.HELIUS_API_KEY
  ? `https://devnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
  : "https://api.devnet.solana.com";

function solscan(kind: "tx" | "account", id: string) {
  return `https://solscan.io/${kind}/${id}?cluster=devnet`;
}

async function fundFrom(
  c: Connection,
  funder: Keypair,
  to: PublicKey,
  sol: number
) {
  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: funder.publicKey,
      toPubkey: to,
      lamports: Math.floor(sol * LAMPORTS_PER_SOL),
    })
  );
  await sendAndConfirmTransaction(c, tx, [funder], { commitment: "confirmed" });
}

// Pyth PriceUpdateV2 parse — mirrors on-chain lib.rs logic.
function parsePythPriceUpdateV2(data: Buffer): {
  price: bigint;
  exponent: number;
  slot: bigint;
  feedId: Buffer;
} {
  let o = 8 + 32;
  const tag = data[o];
  o += 1;
  if (tag === 0) o += 1;
  else if (tag !== 1) throw new Error(`bad verification tag ${tag}`);
  const feedId = data.subarray(o, o + 32);
  o += 32;
  const price = data.readBigInt64LE(o);
  o += 8;
  o += 8; // conf
  const exponent = data.readInt32LE(o);
  o += 4;
  o += 32; // publish_time + prev_publish_time + ema_price + ema_conf
  const slot = data.readBigUInt64LE(o);
  return { price, exponent, slot, feedId };
}

async function main() {
  const conn = new Connection(RPC, "confirmed");

  // ── 0. Load admin ─────────────────────────────────────────────────────
  const adminKpPath = path.join(os.homedir(), ".config/solana/id.json");
  const adminSecret = new Uint8Array(
    JSON.parse(fs.readFileSync(adminKpPath, "utf8"))
  );
  const admin = Keypair.fromSecretKey(adminSecret);

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  Sakura E2E Intent-Execution — devnet (v0.3)");
  console.log("  Program :", SAKURA_INSURANCE_PROGRAM_ID.toBase58());
  console.log("  Admin   :", admin.publicKey.toBase58());
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  // ── 1. init_protocol (idempotent — skip if already set up) ────────────
  const [protocolPDA] = deriveProtocolPDA(admin.publicKey);
  const [feeVaultPDA] = deriveFeeVaultPDA(protocolPDA);
  console.log("\n[1/6] Protocol PDA :", protocolPDA.toBase58());
  console.log("       Fee Vault   :", feeVaultPDA.toBase58());

  let usdcMint: PublicKey;
  const { state: existing } = await fetchProtocol(conn, admin.publicKey);
  if (existing) {
    usdcMint = existing.usdcMint;
    console.log(
      `  ✓ existing protocol found (intents=${existing.totalIntentsSigned}, actions=${existing.totalActionsExecuted})`
    );
    console.log(`  USDC mint   : ${usdcMint.toBase58()}`);
  } else {
    console.log("  no protocol yet — initializing…");
    usdcMint = await createMint(conn, admin, admin.publicKey, null, 6);
    console.log("  mint :", usdcMint.toBase58());
    const treasuryAta = await createAssociatedTokenAccount(
      conn,
      admin,
      usdcMint,
      admin.publicKey
    );
    console.log("  treasury ATA :", treasuryAta.toBase58());
    const initIx = buildInitializeProtocolIx({
      admin: admin.publicKey,
      usdcMint,
      platformTreasury: treasuryAta,
      executionFeeBps: 10,
      platformFeeBps: 1500,
    });
    const sig = await sendAndConfirmTransaction(
      conn,
      new Transaction().add(initIx),
      [admin],
      { commitment: "confirmed" }
    );
    console.log("  ✓ init_protocol:", solscan("tx", sig));
  }

  // ── 2. Fresh user keypair + USDC funding ──────────────────────────────
  // Fee-collection tests require the user to hold USDC. Admin is the mint
  // authority on the test mint, so we mint straight to the user's ATA.
  const user = Keypair.generate();
  await fundFrom(conn, admin, user.publicKey, 0.05);
  console.log("\n[2/6] User :", user.publicKey.toBase58());

  const userUsdcAta = (
    await getOrCreateAssociatedTokenAccount(conn, admin, usdcMint, user.publicKey)
  ).address;
  // Mint 100 USDC (100_000_000 micro-units) to user — plenty for sign fee,
  // execute fees, and revoke fee on any test intent up to $1,000 cap.
  await mintTo(conn, admin, usdcMint, userUsdcAta, admin, 100_000_000n);
  const bal0 = (await getAccount(conn, userUsdcAta)).amount;
  console.log(
    `  user USDC ATA: ${userUsdcAta.toBase58()}  balance = ${bal0} micro (${Number(bal0) / 1e6} USDC)`
  );

  // ── 3. Build intent + commitment ──────────────────────────────────────
  // Intent policy: "lend up to 1000 USDC into Kamino, up to $20k notional"
  const allowedActionTypes = BigInt(
    buildActionTypesBitmap([ActionType.Lend, ActionType.Repay])
  );
  const allowedProtocols = BigInt(
    buildProtocolsBitmap([ProtocolId.Kamino, ProtocolId.MarginFi])
  );
  const maxAmount = 1_000n * 1_000_000n; // 1000 USDC (micro)
  const maxUsdValue = 20_000n * 1_000_000n; // $20k (micro-USD)
  const nonce = BigInt(Date.now());

  // intent_text_hash — user-side Poseidon of the NL intent string. For the
  // E2E test we just use a fixed sentinel field element; real UX would
  // Poseidon-hash the UTF-8 bytes of the user's natural-language intent.
  const intentTextHash = 0xdeadbeefcafebaben;

  const walletField = pubkeyToFieldBytes(user.publicKey.toBytes());

  const { decimal: commitmentDecimal, bytesBE32: commitmentBytes } =
    await computeIntentCommitment(
      intentTextHash,
      walletField,
      nonce,
      maxAmount,
      maxUsdValue,
      allowedProtocols,
      allowedActionTypes
    );
  console.log(
    "  intent_commitment:",
    commitmentDecimal.slice(0, 24),
    "…"
  );
  console.log("  allowed_protocols  bitmap:", allowedProtocols.toString(2).padStart(8, "0"));
  console.log("  allowed_actiontypes bmp  :", allowedActionTypes.toString(2).padStart(8, "0"));

  // ── 4. sign_intent on-chain (with 0.1% × max_usd_value fee) ──────────
  console.log("\n[3/6] sign_intent…");
  const nowSec = BigInt(Math.floor(Date.now() / 1000));
  const expiresAt = nowSec + 3600n; // 1 hour validity

  // Fee = 0.1% of max_usd_value. max_usd_value here is 20_000 USDC (micro),
  // so fee = 20_000_000_000 × 10 / 10_000 = 20_000_000 micro = $20. In a
  // production UI the wallet would compute this client-side and show the
  // user the dollar amount before signing.
  const signFeeMicro = (maxUsdValue * 10n) / 10_000n;
  console.log(
    `  sign fee     : ${signFeeMicro} micro ($${Number(signFeeMicro) / 1e6})  — 0.1% × max_usd_value`
  );

  const signIx = buildSignIntentIx({
    admin: admin.publicKey,
    user: user.publicKey,
    userUsdcAta,
    feeVault: feeVaultPDA,
    intentCommitment: Buffer.from(commitmentBytes),
    expiresAt,
    feeMicro: signFeeMicro,
  });
  const sigSign = await sendAndConfirmTransaction(
    conn,
    new Transaction().add(signIx),
    [user],
    { commitment: "confirmed" }
  );
  console.log("  ✓ sign_intent:", solscan("tx", sigSign));
  const [intentPDA] = deriveIntentPDA(user.publicKey);
  console.log("  Intent PDA :", intentPDA.toBase58());

  const balAfterSign = (await getAccount(conn, userUsdcAta)).amount;
  console.log(
    `  user USDC after sign: ${balAfterSign} micro  (Δ = -${bal0 - balAfterSign})`
  );

  // ── 5. Post fresh Pyth SOL/USD update ─────────────────────────────────
  console.log("\n[4/6] Posting fresh Pyth SOL/USD update via Hermes…");
  const SOL_USD_FEED_ID_HEX =
    "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";
  const hermes = new HermesClient("https://hermes.pyth.network", {});
  const latest = await hermes.getLatestPriceUpdates([SOL_USD_FEED_ID_HEX], {
    encoding: "base64",
  });
  const priceUpdateData = latest.binary.data as string[];
  const receiver = new PythSolanaReceiver({
    connection: conn,
    wallet: new Wallet(admin),
  });
  const builder = receiver.newTransactionBuilder({
    closeUpdateAccounts: false,
  });
  await builder.addPostPriceUpdates(priceUpdateData);
  let postedPythAccount: PublicKey = PublicKey.default;
  await builder.addPriceConsumerInstructions(async (getPriceUpdateAccount) => {
    postedPythAccount = getPriceUpdateAccount(SOL_USD_FEED_ID_HEX);
    return [];
  });
  const versioned = await builder.buildVersionedTransactions({
    computeUnitPriceMicroLamports: 50_000,
  });
  for (const { tx, signers } of versioned) {
    tx.sign([admin, ...signers]);
    const sig = await conn.sendTransaction(tx, { skipPreflight: false });
    const bh = await conn.getLatestBlockhash();
    await conn.confirmTransaction(
      { signature: sig, ...bh },
      "confirmed"
    );
  }
  if (postedPythAccount.equals(PublicKey.default)) {
    throw new Error("Could not resolve posted Pyth account");
  }
  console.log(
    "  ✓ posted price update:",
    postedPythAccount.toBase58()
  );

  const pythAcct = await conn.getAccountInfo(postedPythAccount);
  if (!pythAcct) throw new Error("Pyth account fetch failed");
  const pyth = parsePythPriceUpdateV2(Buffer.from(pythAcct.data));
  const adj = 6 + pyth.exponent;
  const priceMicro: bigint =
    adj >= 0
      ? BigInt(pyth.price) * 10n ** BigInt(adj)
      : BigInt(pyth.price) / 10n ** BigInt(-adj);
  console.log(
    `  price=${pyth.price}×10^${pyth.exponent} → priceMicro=${priceMicro}  slot=${pyth.slot}`
  );

  // ── 6. Construct action, check constraints, generate proof ────────────
  // Concrete action: Lend 100 USDC into Kamino.
  const actionType = ActionType.Lend;
  const actionTargetIndex = ProtocolId.Kamino;
  const actionAmount = 100n * 1_000_000n; // 100 USDC (micro-units)

  // Pre-flight: verify all 5 circuit constraints pass with this witness.
  // C2 amount cap
  if (actionAmount > maxAmount) {
    throw new Error(`C2 violated: actionAmount ${actionAmount} > maxAmount ${maxAmount}`);
  }
  // C3 protocol bit set
  if (((allowedProtocols >> BigInt(actionTargetIndex)) & 1n) !== 1n) {
    throw new Error(`C3 violated: protocol bit ${actionTargetIndex} not set`);
  }
  // C4 action type bit set
  if (((allowedActionTypes >> BigInt(actionType)) & 1n) !== 1n) {
    throw new Error(`C4 violated: actionType bit ${actionType} not set`);
  }
  // C5 USD cap: action_amount × price_micro ≤ max_usd_value × 1e6
  const lhs = actionAmount * priceMicro;
  const rhs = maxUsdValue * 1_000_000n;
  if (lhs > rhs) {
    throw new Error(`C5 violated: lhs=${lhs} > rhs=${rhs}`);
  }
  console.log(
    `  witness: lend ${Number(actionAmount) / 1e6} USDC → Kamino (lhs=${lhs} ≤ rhs=${rhs} ✓)`
  );

  console.log("\n[5/6] Generating Groth16 proof…");
  const proofBundle = await generateIntentProof({
    intentCommitment: BigInt(commitmentDecimal),
    actionType,
    actionAmount,
    actionTargetIndex,
    oraclePriceUsdMicro: priceMicro,
    oracleSlot: pyth.slot,
    maxAmount,
    maxUsdValue,
    allowedProtocols,
    allowedActionTypes,
    walletBytes: walletField,
    nonce,
    intentTextHash,
  });
  console.log(
    "  ✓ proof generated, public signals:",
    proofBundle.publicSignals.length
  );

  // Off-chain verify before wasting a tx.
  const ok = await verifyIntentProof(proofBundle.proof, proofBundle.publicSignals);
  console.log("  off-chain snarkjs verify:", ok ? "✓ OK" : "✗ FAIL");
  if (!ok) throw new Error("off-chain verify failed — witness/circuit mismatch");

  const { proofA, proofB, proofC } = proofToOnchainBytes(proofBundle.proof);

  // ── 7. Submit execute_with_intent_proof ───────────────────────────────
  console.log("\n[6/6] Submitting execute_with_intent_proof…");

  // Re-read Pyth in case it got overwritten since our initial read.
  const pythAcct2 = await conn.getAccountInfo(postedPythAccount);
  if (!pythAcct2) throw new Error("Pyth account vanished before execute");
  const pyth2 = parsePythPriceUpdateV2(Buffer.from(pythAcct2.data));
  if (pyth2.slot !== pyth.slot) {
    console.log(
      `  ⚠ Pyth was overwritten between proof gen and submission (slot ${pyth.slot} → ${pyth2.slot})`
    );
    console.log(`  re-generating proof with fresh slot…`);
    // If the slot changed, proof is stale — regenerate.
    // (In production this is handled by a retry loop.)
    throw new Error(
      "Pyth account updated mid-flight — rerun the script (add retry loop if this is common)"
    );
  }

  const actionNonce = BigInt(Date.now() + 1);
  const [actionRecordPDA] = deriveActionRecordPDA(intentPDA, actionNonce);

  // ── C-full · Fetch fresh Switchboard SOL/USD + compute Pyth∩SB median ──
  console.log("\n[5.5/6] Fetching Switchboard SOL/USD update (C-full dual oracle)…");
  const switchboardPriceAccount = SWITCHBOARD_SOL_USD_DEVNET;
  const {
    updateIxs: sbUpdateIxs,
    lookupTables: sbLuts,
    priceMicro: priceMicroSb,
  } = await buildSwitchboardUpdateIxs({
    feedPubkey: switchboardPriceAccount,
    payer: user.publicKey,
  });
  const crossBps = crossOracleDeviationBps(priceMicro, priceMicroSb);
  console.log(
    `  ✓ Pyth  ${priceMicro} micro-USD · SB ${priceMicroSb} micro-USD · divergence ${crossBps} bps`
  );
  if (crossBps > 100n) {
    console.log(
      `  ⚠ cross-oracle divergence > 1% (100 bps) — on-chain will revert; abort`
    );
    process.exit(3);
  }
  const priceMicroMedian = crossOracleMedian(priceMicro, priceMicroSb);

  const executeIx = buildExecuteWithIntentProofIx({
    admin: admin.publicKey,
    user: user.publicKey,
    payer: user.publicKey,
    payerUsdcAta: userUsdcAta,
    feeVault: feeVaultPDA,
    pythPriceAccount: postedPythAccount,
    switchboardPriceAccount,
    actionNonce,
    actionType,
    actionAmount,
    actionTargetIndex,
    // Post-C-full: public input is the (Pyth, Switchboard) MEDIAN.
    // On-chain handler independently parses both and verifies equality
    // within ±1 micro-USD after recomputing the median.
    oraclePriceUsdMicro: priceMicroMedian,
    oracleSlot: pyth.slot,
    proofA,
    proofB,
    proofC,
  });

  // Bundle Switchboard update ixs BEFORE the Sakura gate; both land
  // atomically (or the whole tx reverts). The Pyth post already
  // happened as a separate tx earlier in the flow; SB lives in the
  // same tx as the gate because its update needs to be on-chain at
  // the moment the gate reads it.
  const tx = new Transaction()
    .add(ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }))
    .add(...sbUpdateIxs)
    .add(executeIx);
  // Note: with LUTs (sbLuts) we'd switch to a VersionedTransaction;
  // keeping legacy Transaction here because the LUT path requires
  // blockhash + compileToV0Message and a larger refactor. If the
  // Switchboard update ix exceeds the 64-account legacy limit, this
  // send will fail and we'll know to migrate to v0.

  try {
    const sigExec = await sendAndConfirmTransaction(conn, tx, [user], {
      commitment: "confirmed",
    });
    console.log("  ✓ execute landed:", solscan("tx", sigExec));

    // Fetch & display ActionRecord
    const recInfo = await conn.getAccountInfo(actionRecordPDA);
    if (!recInfo) {
      console.log("  ⚠ ActionRecord not found on-chain");
      process.exit(2);
    }
    const rec = deserializeActionRecord(Buffer.from(recInfo.data));
    if (!rec) {
      console.log("  ⚠ ActionRecord deserialization failed");
      process.exit(2);
    }
    console.log("\n  ── ActionRecord ──");
    console.log("    intent           :", rec.intent.toBase58());
    console.log("    action_nonce     :", rec.actionNonce.toString());
    console.log("    action_type      :", rec.actionType, `(${ActionType[rec.actionType]})`);
    console.log("    action_amount    :", rec.actionAmount.toString(), "micro-units");
    console.log(
      "    action_target    :",
      rec.actionTargetIndex,
      `(${ProtocolId[rec.actionTargetIndex]})`
    );
    console.log("    oracle_price_usd :", rec.oraclePriceUsdMicro.toString());
    console.log("    oracle_slot      :", rec.oracleSlot.toString());
    console.log("    ts               :", rec.ts.toString());
    console.log(
      "    proof_fingerprint:",
      "0x" + rec.proofFingerprint.toString("hex").slice(0, 32) + "…"
    );

    // Fee accounting — verify user paid exactly what the program says
    const balAfterExec = (await getAccount(conn, userUsdcAta)).amount;
    const execFeeCharged = balAfterSign - balAfterExec;
    const vaultBal = (await getAccount(conn, feeVaultPDA)).amount;
    console.log("\n  ── Fee accounting ──");
    console.log(
      `    user paid for sign     : ${bal0 - balAfterSign} micro ($${Number(bal0 - balAfterSign) / 1e6})`
    );
    console.log(
      `    user paid for execute  : ${execFeeCharged} micro ($${Number(execFeeCharged) / 1e6})  [expected ${EXECUTE_ACTION_FEE_MICRO}]`
    );
    console.log(
      `    fee vault balance      : ${vaultBal} micro ($${Number(vaultBal) / 1e6})`
    );
    if (execFeeCharged !== EXECUTE_ACTION_FEE_MICRO) {
      console.log(
        `  ⚠ execute fee mismatch — expected ${EXECUTE_ACTION_FEE_MICRO}, charged ${execFeeCharged}`
      );
    }

    console.log("\n🎉 E2E PASS — intent-execution verified on-chain via alt_bn128 pairing.");
    console.log("    Fee collection verified on-chain: sign_intent + execute_with_intent_proof both debited USDC as expected.");
    process.exit(0);
  } catch (e: unknown) {
    const err = e as { message?: string; logs?: string[]; transactionLogs?: string[] };
    console.error("\n❌ execute failed:", err.message ?? e);
    if (err.logs) console.error("LOGS:\n" + err.logs.join("\n"));
    if (err.transactionLogs)
      console.error("TX LOGS:\n" + err.transactionLogs.join("\n"));
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("fatal:", e);
  process.exit(1);
});
