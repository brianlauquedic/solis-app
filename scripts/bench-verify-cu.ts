/**
 * CU benchmark · sakura_insurance::execute_with_intent_proof
 *
 * Goal: measure the real on-chain Compute Unit consumption of the in-program
 * Groth16 verify (via Solana alt_bn128 syscall) + Pyth parse + ActionRecord
 * init + CPI fee transfer — the whole instruction as submitted.
 *
 * Measurement strategy:
 *   1. Load admin + a fresh user keypair (user funded from admin).
 *   2. sign_intent ONCE with generous bounds (reused across iterations).
 *   3. Loop 5 times: fetch Pyth → generate proof → submit
 *      execute_with_intent_proof with ComputeBudgetProgram.setComputeUnitLimit
 *      maxed at 1.4M so the runtime does NOT truncate observable usage.
 *      After each tx lands, read tx.meta.computeUnitsConsumed.
 *   4. Report min / mean / max CU + Solscan links for independent verification.
 *   5. Write /tmp/bench-verify-cu-{ts}.json for downstream report generation.
 *
 * Run:
 *   export SOLANA_KEYPAIR=$HOME/.config/solana/id.json     # funded >0.2 SOL devnet
 *   npm run bench:verify-cu
 *
 * See docs: /Users/brianlau/.claude/plans/composed-doodling-pelican.md
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
  getOrCreateAssociatedTokenAccount,
  mintTo,
  getAccount,
  createMint,
  createAssociatedTokenAccount,
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
} from "../lib/insurance-pool";
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

const ITERATIONS = 5;
const PER_TX_CU_CEILING = 1_400_000;
const SOLANA_TX_CU_LIMIT = 1_400_000; // MAX_COMPUTE_UNIT_LIMIT (Agave master)
const SOL_USD_FEED_ID_HEX =
  "0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d";

const RPC = process.env.HELIUS_API_KEY
  ? `https://devnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
  : "https://api.devnet.solana.com";

function solscan(sig: string) {
  return `https://solscan.io/tx/${sig}?cluster=devnet`;
}

function loadKeypair(): Keypair {
  const envPath = process.env.SOLANA_KEYPAIR;
  const fallback = path.join(os.homedir(), ".config/solana/id.json");
  const p = envPath || fallback;
  if (!fs.existsSync(p)) {
    console.error(`keypair not found: ${p}`);
    console.error(
      "Set SOLANA_KEYPAIR env var, or place solana CLI keypair at ~/.config/solana/id.json"
    );
    process.exit(1);
  }
  const secret = new Uint8Array(JSON.parse(fs.readFileSync(p, "utf8")));
  return Keypair.fromSecretKey(secret);
}

function parsePythPriceUpdateV2(data: Buffer): {
  price: bigint;
  exponent: number;
  slot: bigint;
} {
  let o = 8 + 32;
  const tag = data[o];
  o += 1;
  if (tag === 0) o += 1;
  else if (tag !== 1) throw new Error(`bad verification tag ${tag}`);
  o += 32; // feedId
  const price = data.readBigInt64LE(o);
  o += 8;
  o += 8; // conf
  const exponent = data.readInt32LE(o);
  o += 4;
  o += 32; // publish_time + prev_publish_time + ema_price + ema_conf
  const slot = data.readBigUInt64LE(o);
  return { price, exponent, slot };
}

async function postFreshPythUpdate(
  conn: Connection,
  admin: Keypair
): Promise<PublicKey> {
  const hermes = new HermesClient("https://hermes.pyth.network", {});
  const latest = await hermes.getLatestPriceUpdates([SOL_USD_FEED_ID_HEX], {
    encoding: "base64",
  });
  const priceUpdateData = latest.binary.data as string[];
  const receiver = new PythSolanaReceiver({
    connection: conn,
    wallet: new Wallet(admin),
  });
  const builder = receiver.newTransactionBuilder({ closeUpdateAccounts: false });
  await builder.addPostPriceUpdates(priceUpdateData);
  let posted: PublicKey = PublicKey.default;
  await builder.addPriceConsumerInstructions(async (getPriceUpdateAccount) => {
    posted = getPriceUpdateAccount(SOL_USD_FEED_ID_HEX);
    return [];
  });
  const versioned = await builder.buildVersionedTransactions({
    computeUnitPriceMicroLamports: 50_000,
  });
  for (const { tx, signers } of versioned) {
    tx.sign([admin, ...signers]);
    const sig = await conn.sendTransaction(tx, { skipPreflight: false });
    const bh = await conn.getLatestBlockhash();
    await conn.confirmTransaction({ signature: sig, ...bh }, "confirmed");
  }
  if (posted.equals(PublicKey.default)) {
    throw new Error("failed to resolve posted Pyth account");
  }
  return posted;
}

type RunResult = {
  run: number;
  cu: number | null;
  sig: string | null;
  pythSlot: string;
  error?: string;
};

async function main() {
  const conn = new Connection(RPC, "confirmed");
  const admin = loadKeypair();

  const balLamports = await conn.getBalance(admin.publicKey);
  const balSol = balLamports / LAMPORTS_PER_SOL;
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  Sakura · execute_with_intent_proof CU benchmark");
  console.log("  Network  : devnet");
  console.log("  Program  :", SAKURA_INSURANCE_PROGRAM_ID.toBase58());
  console.log("  Admin    :", admin.publicKey.toBase58(), `(${balSol.toFixed(4)} SOL)`);
  console.log("  Tx CU cap:", SOLANA_TX_CU_LIMIT.toLocaleString());
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  if (balSol < 0.15) {
    console.error(
      `admin balance ${balSol.toFixed(4)} SOL < 0.15 — airdrop: solana airdrop 1 --url devnet`
    );
    process.exit(1);
  }

  // ── init_protocol (idempotent) ────────────────────────────────
  const [protocolPDA] = deriveProtocolPDA(admin.publicKey);
  const [feeVaultPDA] = deriveFeeVaultPDA(protocolPDA);
  let usdcMint: PublicKey;
  const { state: existing } = await fetchProtocol(conn, admin.publicKey);
  if (existing) {
    usdcMint = existing.usdcMint;
    console.log(
      `  [init] protocol already initialized (intents=${existing.totalIntentsSigned}, actions=${existing.totalActionsExecuted})`
    );
  } else {
    console.log("  [init] creating test USDC mint + protocol…");
    usdcMint = await createMint(conn, admin, admin.publicKey, null, 6);
    const treasuryAta = await createAssociatedTokenAccount(
      conn,
      admin,
      usdcMint,
      admin.publicKey
    );
    const initIx = buildInitializeProtocolIx({
      admin: admin.publicKey,
      usdcMint,
      platformTreasury: treasuryAta,
      executionFeeBps: 10,
      platformFeeBps: 1500,
    });
    await sendAndConfirmTransaction(conn, new Transaction().add(initIx), [admin], {
      commitment: "confirmed",
    });
  }

  // ── Fresh user + USDC funding ─────────────────────────────────
  const user = Keypair.generate();
  const fundIx = SystemProgram.transfer({
    fromPubkey: admin.publicKey,
    toPubkey: user.publicKey,
    lamports: Math.floor(0.08 * LAMPORTS_PER_SOL),
  });
  await sendAndConfirmTransaction(conn, new Transaction().add(fundIx), [admin], {
    commitment: "confirmed",
  });
  const userUsdcAta = (
    await getOrCreateAssociatedTokenAccount(conn, admin, usdcMint, user.publicKey)
  ).address;
  await mintTo(conn, admin, usdcMint, userUsdcAta, admin, 100_000_000n);
  console.log(`  [user] ${user.publicKey.toBase58()} — 0.08 SOL + 100 USDC`);

  // ── sign_intent once, reused across all iterations ────────────
  const allowedActionTypes = BigInt(
    buildActionTypesBitmap([ActionType.Lend, ActionType.Repay])
  );
  const allowedProtocols = BigInt(
    buildProtocolsBitmap([ProtocolId.Kamino, ProtocolId.MarginFi])
  );
  const maxAmount = 1_000n * 1_000_000n;
  const maxUsdValue = 20_000n * 1_000_000n;
  const nonce = BigInt(Date.now());
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

  const expiresAt = BigInt(Math.floor(Date.now() / 1000) + 3600);
  const signFeeMicro = (maxUsdValue * 10n) / 10_000n;
  const signIx = buildSignIntentIx({
    admin: admin.publicKey,
    user: user.publicKey,
    userUsdcAta,
    feeVault: feeVaultPDA,
    intentCommitment: Buffer.from(commitmentBytes),
    expiresAt,
    feeMicro: signFeeMicro,
  });
  const signSig = await sendAndConfirmTransaction(
    conn,
    new Transaction().add(signIx),
    [user],
    { commitment: "confirmed" }
  );
  console.log(`  [sign] intent signed: ${solscan(signSig)}`);
  const [intentPDA] = deriveIntentPDA(user.publicKey);

  // ── Loop: measure execute_with_intent_proof ───────────────────
  const results: RunResult[] = [];
  console.log("\n  ── Runs ──");

  for (let i = 1; i <= ITERATIONS; i++) {
    let result: RunResult = {
      run: i,
      cu: null,
      sig: null,
      pythSlot: "",
    };
    try {
      const postedPyth = await postFreshPythUpdate(conn, admin);
      const pythAcct = await conn.getAccountInfo(postedPyth);
      if (!pythAcct) throw new Error("posted Pyth account fetch failed");
      const pyth = parsePythPriceUpdateV2(Buffer.from(pythAcct.data));
      const adj = 6 + pyth.exponent;
      const priceMicro: bigint =
        adj >= 0
          ? pyth.price * 10n ** BigInt(adj)
          : pyth.price / 10n ** BigInt(-adj);

      const actionAmount = 10n * 1_000_000n; // lend 10 USDC — trivial action, all constraints pass
      const proofBundle = await generateIntentProof({
        intentCommitment: BigInt(commitmentDecimal),
        actionType: ActionType.Lend,
        actionAmount,
        actionTargetIndex: ProtocolId.Kamino,
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
      const ok = await verifyIntentProof(
        proofBundle.proof,
        proofBundle.publicSignals
      );
      if (!ok) throw new Error("off-chain proof verify failed");
      const { proofA, proofB, proofC } = proofToOnchainBytes(proofBundle.proof);

      const actionNonce = BigInt(Date.now() + i);
      const executeIx = buildExecuteWithIntentProofIx({
        admin: admin.publicKey,
        user: user.publicKey,
        payer: user.publicKey,
        payerUsdcAta: userUsdcAta,
        feeVault: feeVaultPDA,
        pythPriceAccount: postedPyth,
        actionNonce,
        actionType: ActionType.Lend,
        actionAmount,
        actionTargetIndex: ProtocolId.Kamino,
        oraclePriceUsdMicro: priceMicro,
        oracleSlot: pyth.slot,
        proofA,
        proofB,
        proofC,
      });
      const tx = new Transaction()
        .add(ComputeBudgetProgram.setComputeUnitLimit({ units: PER_TX_CU_CEILING }))
        .add(executeIx);
      const sig = await sendAndConfirmTransaction(conn, tx, [user], {
        commitment: "confirmed",
      });
      const txInfo = await conn.getTransaction(sig, {
        commitment: "confirmed",
        maxSupportedTransactionVersion: 0,
      });
      const cu = txInfo?.meta?.computeUnitsConsumed ?? null;
      result = {
        run: i,
        cu: cu !== null ? Number(cu) : null,
        sig,
        pythSlot: pyth.slot.toString(),
      };
      console.log(
        `  Run ${i}: ${cu !== null ? cu.toLocaleString() : "???"} CU  sig: ${sig.slice(0, 12)}…  pyth=${pyth.slot}`
      );
    } catch (err) {
      result.error = err instanceof Error ? err.message : String(err);
      console.log(`  Run ${i}: FAILED — ${result.error}`);
    }
    results.push(result);
  }

  // ── Summary ────────────────────────────────────────────────────
  const good = results.filter((r) => r.cu !== null) as Array<
    RunResult & { cu: number }
  >;
  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  if (good.length === 0) {
    console.log("  all runs failed — no CU measurement available");
  } else {
    const cus = good.map((r) => r.cu);
    const min = Math.min(...cus);
    const max = Math.max(...cus);
    const mean = Math.round(cus.reduce((a, b) => a + b, 0) / cus.length);
    console.log(
      `  ${good.length}/${ITERATIONS} runs succeeded · min=${min.toLocaleString()}  mean=${mean.toLocaleString()}  max=${max.toLocaleString()} CU`
    );
    console.log(
      `  headroom within ${SOLANA_TX_CU_LIMIT.toLocaleString()} per-tx: ~${(SOLANA_TX_CU_LIMIT - mean).toLocaleString()} CU`
    );
    console.log(
      `  analytical predicted: ~130,000 for Groth16 verify alone (syscall arithmetic × 6 public inputs)`
    );
  }
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  // ── Write machine-readable JSON for downstream report generation ──
  const outFile = `/tmp/bench-verify-cu-${Date.now()}.json`;
  const balAfter = await conn.getBalance(admin.publicKey);
  fs.writeFileSync(
    outFile,
    JSON.stringify(
      {
        network: "devnet",
        program: SAKURA_INSURANCE_PROGRAM_ID.toBase58(),
        runs: results,
        summary:
          good.length === 0
            ? null
            : {
                successful: good.length,
                total: ITERATIONS,
                min: Math.min(...good.map((r) => r.cu)),
                max: Math.max(...good.map((r) => r.cu)),
                mean: Math.round(
                  good.map((r) => r.cu).reduce((a, b) => a + b, 0) / good.length
                ),
                headroom_1_4M: SOLANA_TX_CU_LIMIT - Math.round(
                  good.map((r) => r.cu).reduce((a, b) => a + b, 0) / good.length
                ),
              },
        admin: admin.publicKey.toBase58(),
        user: user.publicKey.toBase58(),
        sol_cost_lamports: balLamports - balAfter,
        timestamp: new Date().toISOString(),
      },
      null,
      2
    )
  );
  console.log(`  raw results written: ${outFile}`);
}

main().catch((err) => {
  console.error("bench failed:", err);
  process.exit(1);
});
