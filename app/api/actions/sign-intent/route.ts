/**
 * Solana Blink — Sign Sakura Intent
 *
 * One-click intent signing. The Blink URL carries the intent policy
 * parameters (max_amount, max_usd_value, allowed_protocols bitmap,
 * allowed_action_types bitmap, expires_in_seconds) as query params.
 * The user's wallet fetches this endpoint, gets a signable transaction
 * containing `sign_intent`, and prompts the user once.
 *
 *   GET  /api/actions/sign-intent?intent=<b64>&max_amount=...&...
 *        → ActionGetResponse (label, description, icon, links)
 *
 *   POST /api/actions/sign-intent?...  { account: <userPubkey> }
 *        → ActionPostResponse { transaction: <base64 serialized v0 tx> }
 *
 * Spec: https://solana.com/docs/advanced/actions
 *
 * Security notes:
 *   - The `intent_text` is passed as a URL param so a caller who shares
 *     the Blink link must trust the creator. The Poseidon commitment
 *     binds to it, so the user sees what they're signing in their wallet
 *     (via the description field).
 *   - The user's private witness (max_amount, etc.) IS IN THE URL and
 *     therefore IS NOT PRIVATE from anyone with the link. This Blink
 *     is a CONVENIENCE path for public/template intents. For private
 *     intents, users should use the in-app IntentSigner component
 *     which keeps bounds in local storage.
 */
import { NextRequest, NextResponse } from "next/server";
import {
  Connection,
  PublicKey,
  TransactionMessage,
  VersionedTransaction,
} from "@solana/web3.js";
import {
  SAKURA_INSURANCE_PROGRAM_ID,
  buildSignIntentIx,
  deriveProtocolPDA,
  deriveFeeVaultPDA,
} from "@/lib/insurance-pool";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import {
  computeIntentCommitment,
  pubkeyToFieldBytes,
} from "@/lib/zk-proof";
import { getConnection } from "@/lib/rpc";

// Actions spec CORS headers — required for wallet cross-origin fetches.
const ACTIONS_CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, Content-Encoding, Accept-Encoding",
  "Access-Control-Expose-Headers": "X-Action-Version, X-Blockchain-Ids",
  "X-Action-Version": "2.4",
  "X-Blockchain-Ids": "solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG", // devnet
  "Content-Type": "application/json",
};

// ═══════════════════════════════════════════════════════════════════════
// GET — Blink metadata
// ═══════════════════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  try {
    const params = parseIntentParams(req);
    const origin = new URL(req.url).origin;

    const body = {
      type: "action",
      icon: `${origin}/icon.png`,
      title: "Sign Sakura Intent",
      description: buildDescription(params),
      label: "Sign Intent",
      links: {
        actions: [
          {
            label: `Sign — expires in ${params.expiresInHours}h`,
            href: req.nextUrl.pathname + req.nextUrl.search,
            type: "transaction",
          },
        ],
      },
    };

    return NextResponse.json(body, { headers: ACTIONS_CORS_HEADERS });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Invalid request";
    return NextResponse.json(
      { error: { message: msg } },
      { status: 400, headers: ACTIONS_CORS_HEADERS }
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { headers: ACTIONS_CORS_HEADERS });
}

// ═══════════════════════════════════════════════════════════════════════
// POST — Build the sign_intent tx for the user to sign
// ═══════════════════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
  try {
    const params = parseIntentParams(req);

    const payload = (await req.json()) as { account?: string };
    if (!payload.account) {
      throw new Error("Missing `account` in request body");
    }
    const user = new PublicKey(payload.account);

    // Admin is the protocol deployer — hardcoded to the SAKURA_PROTOCOL_ADMIN
    // env var. The Intent PDA is keyed by user, but the protocol PDA by admin.
    const adminEnv = process.env.SAKURA_PROTOCOL_ADMIN;
    if (!adminEnv) {
      throw new Error("Server not configured (SAKURA_PROTOCOL_ADMIN missing)");
    }
    const admin = new PublicKey(adminEnv);

    // Compute the commitment the user will sign.
    const walletField = pubkeyToFieldBytes(user.toBytes());
    const intentTextHash = await hashIntentText(params.intentText);
    const { bytesBE32: commitmentBytes } = await computeIntentCommitment(
      intentTextHash,
      walletField,
      params.nonce,
      params.maxAmount,
      params.maxUsdValue,
      params.allowedProtocols,
      params.allowedActionTypes
    );

    const expiresAt =
      BigInt(Math.floor(Date.now() / 1000)) +
      BigInt(params.expiresInHours) * 3600n;

    // Fee = 0.1% of max_usd_value (honor system — the chain does not see
    // max_usd_value since it is private, but enforces an upper ceiling).
    const feeMicro = (params.maxUsdValue * 10n) / 10_000n;

    const usdcMintEnv = process.env.SAKURA_USDC_MINT;
    if (!usdcMintEnv) {
      throw new Error("Server not configured (SAKURA_USDC_MINT missing)");
    }
    const usdcMint = new PublicKey(usdcMintEnv);
    const [protocolPda] = deriveProtocolPDA(admin);
    const [feeVault] = deriveFeeVaultPDA(protocolPda);
    const userUsdcAta = getAssociatedTokenAddressSync(usdcMint, user);

    const signIx = buildSignIntentIx({
      admin,
      user,
      userUsdcAta,
      feeVault,
      intentCommitment: Buffer.from(commitmentBytes),
      expiresAt,
      feeMicro,
    });

    // Build v0 tx (Blinks require v0). The user is the sole signer.
    const conn: Connection = await getConnection("confirmed");
    const { blockhash } = await conn.getLatestBlockhash();
    const message = new TransactionMessage({
      payerKey: user,
      recentBlockhash: blockhash,
      instructions: [signIx],
    }).compileToV0Message();
    const tx = new VersionedTransaction(message);

    const serialized = Buffer.from(tx.serialize()).toString("base64");
    return NextResponse.json(
      {
        type: "transaction",
        transaction: serialized,
        message: `Signing Sakura intent — ${buildDescription(params)}`,
      },
      { headers: ACTIONS_CORS_HEADERS }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("[blink:sign-intent] error:", msg);
    return NextResponse.json(
      { error: { message: msg } },
      { status: 400, headers: ACTIONS_CORS_HEADERS }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════

interface IntentParams {
  intentText: string;
  maxAmount: bigint;
  maxUsdValue: bigint;
  allowedProtocols: bigint;
  allowedActionTypes: bigint;
  nonce: bigint;
  expiresInHours: number;
}

function parseIntentParams(req: NextRequest): IntentParams {
  const q = req.nextUrl.searchParams;
  const intentText = q.get("intent") ?? "";
  if (!intentText || intentText.length > 500) {
    throw new Error("`intent` query param required (1..500 chars)");
  }

  const maxAmount = bigintParam(q, "max_amount", 1_000_000n * 1_000_000n); // default 1M micro
  const maxUsdValue = bigintParam(q, "max_usd", 10_000n * 1_000_000n);     // default $10k
  const allowedProtocols = bigintParam(q, "protos", 0n);
  const allowedActionTypes = bigintParam(q, "actions", 0n);
  if (allowedProtocols === 0n) {
    throw new Error("`protos` bitmap required (must be non-zero)");
  }
  if (allowedActionTypes === 0n) {
    throw new Error("`actions` bitmap required (must be non-zero)");
  }
  if (allowedProtocols > 0xffffffffn || allowedActionTypes > 0xffffffffn) {
    throw new Error("bitmaps must fit in u32");
  }

  const nonce = bigintParam(q, "nonce", BigInt(Date.now()));
  const expiresInHours = Math.max(
    1,
    Math.min(24 * 365, Number(q.get("hours") ?? "1"))
  );

  return {
    intentText,
    maxAmount,
    maxUsdValue,
    allowedProtocols,
    allowedActionTypes,
    nonce,
    expiresInHours,
  };
}

function bigintParam(q: URLSearchParams, key: string, fallback: bigint): bigint {
  const raw = q.get(key);
  if (raw === null) return fallback;
  try {
    const v = BigInt(raw);
    if (v < 0n) throw new Error(`${key} must be non-negative`);
    return v;
  } catch {
    throw new Error(`${key} must be a decimal integer`);
  }
}

function buildDescription(p: IntentParams): string {
  const protos = bitmapDescribe(p.allowedProtocols, [
    "Kamino", "MarginFi", "(deprecated)", "Jupiter",
    "Marinade", "Jito", "Drift", "Zeta",
  ]);
  const actions = bitmapDescribe(p.allowedActionTypes, [
    "Borrow", "Lend", "Swap", "Repay",
    "Withdraw", "Deposit", "Stake", "Unstake",
  ]);
  const maxUsdDollars = Number(p.maxUsdValue) / 1e6;
  const maxAmountDecimal = Number(p.maxAmount) / 1e6;
  return (
    `"${p.intentText.slice(0, 80)}${p.intentText.length > 80 ? "…" : ""}" — ` +
    `actions: ${actions}; protocols: ${protos}; ` +
    `cap ${maxAmountDecimal} tokens / $${maxUsdDollars.toLocaleString()} per action; ` +
    `expires in ${p.expiresInHours}h.`
  );
}

function bitmapDescribe(bitmap: bigint, labels: string[]): string {
  const out: string[] = [];
  for (let i = 0; i < labels.length; i++) {
    if (((bitmap >> BigInt(i)) & 1n) === 1n) out.push(labels[i]);
  }
  return out.length ? out.join("+") : "(none)";
}

/**
 * Hash a UTF-8 intent string into a single field element using Poseidon.
 * Long strings are folded in 31-byte chunks (same as MCP tool).
 */
async function hashIntentText(text: string): Promise<bigint> {
  const { buildPoseidon } = await import("circomlibjs");
  const poseidon = await buildPoseidon();
  const bytes = Buffer.from(text, "utf8");
  let acc = 0n;
  for (let i = 0; i < bytes.length; i += 31) {
    const chunk = bytes.subarray(i, Math.min(i + 31, bytes.length));
    let v = 0n;
    for (let j = 0; j < chunk.length; j++) v = (v << 8n) | BigInt(chunk[j]);
    const h = poseidon([acc, v, BigInt(i)]);
    acc = BigInt(poseidon.F.toString(h));
  }
  return acc;
}
