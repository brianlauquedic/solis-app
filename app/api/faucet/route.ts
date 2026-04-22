/**
 * POST /api/faucet
 *
 * Self-service devnet funding for the Sakura testing tutorial.
 * Given a Phantom address, airdrops 0.05 SOL and mints 100 test USDC
 * (Sakura's admin-controlled mint 7rEh…Li3) to the address's ATA.
 *
 * Body:   { address: string }
 * Return: { sol_tx, usdc_tx, usdc_ata } on success
 *         { error }                      on failure (including rate limit)
 *
 * ── Env requirements ───────────────────────────────────────────
 *   SAKURA_FAUCET_ADMIN_KEYPAIR  JSON array of 64 bytes — the admin
 *                                keypair that is USDC mint authority
 *                                (same as ~/.config/solana/id.json
 *                                in local dev). Devnet-only; NEVER
 *                                set this in mainnet environments.
 *   HELIUS_API_KEY               Helius RPC API key (for reliable
 *                                airdrop + tx submission). Falls back
 *                                to public devnet if unset.
 *   UPSTASH_REDIS_REST_URL /     Distributed rate-limit backing.
 *   UPSTASH_REDIS_REST_TOKEN     Optional; route still works without
 *                                Redis but has no cross-instance
 *                                rate-limit safety.
 *
 * ── Rate limiting ──────────────────────────────────────────────
 *   · Per-address: 1 request / 24 h
 *   · Per-IP:      5 requests / 24 h  (allow small teams sharing IP)
 *
 * Both are enforced via Upstash sliding-window rate limiter.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  Transaction,
  SystemProgram,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import { Ratelimit } from "@upstash/ratelimit";
import { getRedisClient } from "@/lib/redis";

// ── Constants ─────────────────────────────────────────────────────

const USDC_MINT = new PublicKey(
  "7rEhvYrGGT41FQrCt3zNx8Bko9TFVvytYWpP1mqhtLi3"
); // Sakura devnet test USDC (admin-controlled)
const SOL_DROP_LAMPORTS = 0.05 * LAMPORTS_PER_SOL; // 0.05 SOL → ~25 signs
const USDC_MINT_MICRO = 100_000_000n; // 100 USDC (6 decimals)

const DEVNET_RPC_FALLBACK = "https://api.devnet.solana.com";

// ── Rate limiters (singletons) ────────────────────────────────────

let _perAddressLimiter: Ratelimit | null | undefined;
let _perIpLimiter: Ratelimit | null | undefined;

function getAddressLimiter(): Ratelimit | null {
  if (_perAddressLimiter !== undefined) return _perAddressLimiter;
  const redis = getRedisClient();
  _perAddressLimiter = redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(1, "24 h"),
        prefix: "sakura:faucet:addr",
        analytics: false,
      })
    : null;
  return _perAddressLimiter;
}

function getIpLimiter(): Ratelimit | null {
  if (_perIpLimiter !== undefined) return _perIpLimiter;
  const redis = getRedisClient();
  _perIpLimiter = redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(5, "24 h"),
        prefix: "sakura:faucet:ip",
        analytics: false,
      })
    : null;
  return _perIpLimiter;
}

// ── Handler ───────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // 1. Parse + validate body
  let body: { address?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 }
    );
  }
  const addressStr = (body.address ?? "").trim();
  if (!addressStr) {
    return NextResponse.json(
      { error: "Missing `address` in request body." },
      { status: 400 }
    );
  }
  let userPk: PublicKey;
  try {
    userPk = new PublicKey(addressStr);
  } catch {
    return NextResponse.json(
      { error: `Not a valid Solana pubkey: ${addressStr}` },
      { status: 400 }
    );
  }

  // 2. Rate limit — per-address (tighter) + per-IP (looser)
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";

  const addrLimiter = getAddressLimiter();
  if (addrLimiter) {
    const { success, reset } = await addrLimiter.limit(userPk.toBase58());
    if (!success) {
      const waitMs = reset - Date.now();
      return NextResponse.json(
        {
          error: `This address already received faucet funds in the last 24h. Try again in ${Math.ceil(
            waitMs / 60_000
          )} minutes.`,
        },
        { status: 429 }
      );
    }
  }
  const ipLimiter = getIpLimiter();
  if (ipLimiter) {
    const { success } = await ipLimiter.limit(ip);
    if (!success) {
      return NextResponse.json(
        {
          error: "IP rate limit exceeded (5 addresses / 24h). Please wait.",
        },
        { status: 429 }
      );
    }
  }

  // 3. Load admin keypair from env
  const adminRaw = process.env.SAKURA_FAUCET_ADMIN_KEYPAIR;
  if (!adminRaw) {
    return NextResponse.json(
      {
        error:
          "Faucet not configured: SAKURA_FAUCET_ADMIN_KEYPAIR env var missing. " +
          "Contact the team.",
      },
      { status: 503 }
    );
  }
  let admin: Keypair;
  try {
    const parsed = JSON.parse(adminRaw);
    if (!Array.isArray(parsed) || parsed.length !== 64) {
      throw new Error("keypair must be a 64-length byte array");
    }
    admin = Keypair.fromSecretKey(Uint8Array.from(parsed));
  } catch (e) {
    return NextResponse.json(
      {
        error: `Faucet keypair malformed: ${(e as Error).message}`,
      },
      { status: 500 }
    );
  }

  // 4. Connection
  const rpcUrl = process.env.HELIUS_API_KEY
    ? `https://devnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
    : DEVNET_RPC_FALLBACK;
  const conn = new Connection(rpcUrl, "confirmed");

  // 5. Transfer SOL (we don't use requestAirdrop — the devnet faucet
  //    rate-limits at 1 SOL/day/project and fails unpredictably;
  //    direct admin→user transfer is reliable and costs 0.05 SOL of
  //    admin's balance).
  let solTx: string;
  try {
    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: admin.publicKey,
        toPubkey: userPk,
        lamports: SOL_DROP_LAMPORTS,
      })
    );
    solTx = await sendAndConfirmTransaction(conn, tx, [admin], {
      commitment: "confirmed",
    });
  } catch (e) {
    return NextResponse.json(
      {
        error: `SOL transfer failed: ${(e as Error).message}. ` +
          `Admin may be out of SOL; please contact the team.`,
      },
      { status: 502 }
    );
  }

  // 6. Mint 100 USDC to user's ATA (auto-create)
  let usdcTx: string;
  let usdcAta: string;
  try {
    const ata = await getOrCreateAssociatedTokenAccount(
      conn,
      admin, // payer for ATA rent
      USDC_MINT,
      userPk
    );
    usdcAta = ata.address.toBase58();
    usdcTx = await mintTo(
      conn,
      admin,
      USDC_MINT,
      ata.address,
      admin, // mint authority
      Number(USDC_MINT_MICRO)
    );
  } catch (e) {
    return NextResponse.json(
      {
        error: `USDC mint failed: ${(e as Error).message}. ` +
          `SOL transfer already succeeded (tx: ${solTx}); ` +
          `you can retry the faucet in 24h or top up USDC manually.`,
      },
      { status: 502 }
    );
  }

  return NextResponse.json({
    sol_tx: solTx,
    usdc_tx: usdcTx,
    usdc_ata: usdcAta,
    amount_sol: SOL_DROP_LAMPORTS / LAMPORTS_PER_SOL,
    amount_usdc: Number(USDC_MINT_MICRO) / 1e6,
    usdc_mint: USDC_MINT.toBase58(),
    note:
      "Phantom UI will likely NOT display the USDC balance because " +
      "this is an admin-minted test token, not Circle's canonical " +
      "devnet USDC. Verify the balance on Solscan: " +
      `https://solscan.io/account/${usdcAta}?cluster=devnet`,
  });
}
