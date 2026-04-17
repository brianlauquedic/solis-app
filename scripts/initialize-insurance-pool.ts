/**
 * scripts/initialize-insurance-pool.ts
 *
 * One-shot bootstrap for the Sakura Rescue Insurance Pool on devnet.
 *
 * Usage:
 *   npx tsx scripts/initialize-insurance-pool.ts
 *
 * Required env (.env.local):
 *   NEXT_PUBLIC_INSURANCE_PROGRAM_ID  — the deployed program id
 *   SAKURA_INSURANCE_ADMIN_PUBKEY     — the pool admin wallet (deploy authority)
 *   SAKURA_AGENT_PRIVATE_KEY          — used as admin_agent (signer for claim_payout)
 *
 * The admin signs via ~/.config/solana/id.json (solana CLI default keypair).
 */

import {
  Connection,
  Keypair,
  PublicKey,
  sendAndConfirmTransaction,
  Transaction,
} from "@solana/web3.js";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

import {
  buildInitializePoolIx,
  derivePoolPDA,
  deriveVaultPDA,
  deserializePool,
  USDC_MINT_DEVNET,
  SAKURA_INSURANCE_PROGRAM_ID,
} from "../lib/insurance-pool";

const DEVNET_RPC = process.env.HELIUS_API_KEY
  ? `https://devnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
  : "https://api.devnet.solana.com";
const PREMIUM_BPS = 500;       // 5% annual premium
const MIN_RESERVE_BPS = 2000;  // 20% of deposits must stay liquid

async function main() {
  // 1. Load admin keypair from solana CLI default path
  const adminKpPath = path.join(os.homedir(), ".config/solana/id.json");
  if (!fs.existsSync(adminKpPath)) {
    console.error(`❌ admin keypair not found at ${adminKpPath}`);
    process.exit(1);
  }
  const adminSecret = new Uint8Array(
    JSON.parse(fs.readFileSync(adminKpPath, "utf8"))
  );
  const admin = Keypair.fromSecretKey(adminSecret);

  const expectedAdmin = process.env.SAKURA_INSURANCE_ADMIN_PUBKEY?.trim();
  if (expectedAdmin && admin.publicKey.toBase58() !== expectedAdmin) {
    console.error(
      `❌ admin mismatch: solana CLI keypair is ${admin.publicKey.toBase58()} ` +
        `but SAKURA_INSURANCE_ADMIN_PUBKEY=${expectedAdmin}`
    );
    process.exit(1);
  }

  // 2. Derive admin_agent from SAKURA_AGENT_PRIVATE_KEY
  const agentSecretRaw = process.env.SAKURA_AGENT_PRIVATE_KEY?.trim();
  if (!agentSecretRaw) {
    console.error("❌ SAKURA_AGENT_PRIVATE_KEY missing from .env.local");
    process.exit(1);
  }
  const agentSecret = new Uint8Array(JSON.parse(agentSecretRaw));
  const adminAgent = Keypair.fromSecretKey(agentSecret);

  console.log("Sakura Insurance Pool bootstrap");
  console.log("  program id :", SAKURA_INSURANCE_PROGRAM_ID.toBase58());
  console.log("  admin      :", admin.publicKey.toBase58());
  console.log("  admin_agent:", adminAgent.publicKey.toBase58());
  console.log("  usdc mint  :", USDC_MINT_DEVNET.toBase58(), "(devnet test)");
  console.log("  premium    :", PREMIUM_BPS, "bps");
  console.log("  min reserve:", MIN_RESERVE_BPS, "bps");

  const [poolPda] = derivePoolPDA(admin.publicKey);
  const [vaultPda] = deriveVaultPDA(poolPda);
  console.log("  pool PDA   :", poolPda.toBase58());
  console.log("  vault PDA  :", vaultPda.toBase58());

  const conn = new Connection(DEVNET_RPC, "confirmed");

  // 3. Check if pool already exists (idempotent)
  const existing = await conn.getAccountInfo(poolPda);
  if (existing && existing.data.length > 0) {
    const pool = deserializePool(existing.data);
    if (pool) {
      console.log("\n✅ pool already initialized:");
      console.log("   totalShares          :", pool.totalShares.toString());
      console.log("   coverageOutstanding  :", pool.coverageOutstanding.toString());
      console.log("   paused               :", pool.paused);
      console.log("   premiumBps           :", pool.premiumBps);
      console.log("   minReserveBps        :", pool.minReserveBps);
      console.log("\n(Skipping initialize_pool — already done.)");
      return;
    }
  }

  // 4. Build + send initialize_pool tx
  const ix = buildInitializePoolIx({
    admin: admin.publicKey,
    adminAgent: adminAgent.publicKey,
    usdcMint: USDC_MINT_DEVNET,
    premiumBps: PREMIUM_BPS,
    minReserveBps: MIN_RESERVE_BPS,
  });

  const tx = new Transaction().add(ix);
  tx.feePayer = admin.publicKey;
  const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash();
  tx.recentBlockhash = blockhash;
  tx.lastValidBlockHeight = lastValidBlockHeight;

  console.log("\nSending initialize_pool...");
  const sig = await sendAndConfirmTransaction(conn, tx, [admin], {
    commitment: "confirmed",
  });
  console.log("✅ success!");
  console.log("   signature:", sig);
  console.log(
    `   explorer : https://explorer.solana.com/tx/${sig}?cluster=devnet`
  );

  // 5. Verify state
  const after = await conn.getAccountInfo(poolPda);
  if (after) {
    const pool = deserializePool(after.data);
    if (pool) {
      console.log("\n--- on-chain pool state ---");
      console.log("   admin                :", pool.admin.toBase58());
      console.log("   admin_agent          :", pool.adminAgent.toBase58());
      console.log("   usdc_mint            :", pool.usdcMint.toBase58());
      console.log("   usdc_vault           :", pool.usdcVault.toBase58());
      console.log("   totalShares          :", pool.totalShares.toString());
      console.log("   premiumBps           :", pool.premiumBps);
      console.log("   minReserveBps        :", pool.minReserveBps);
      console.log("   coverageOutstanding  :", pool.coverageOutstanding.toString());
      console.log("   paused               :", pool.paused);
      console.log("   bump                 :", pool.bump);
    }
  }
}

main().catch((err) => {
  console.error("❌ initialize failed:", err);
  process.exit(1);
});
