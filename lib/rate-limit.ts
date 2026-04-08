/**
 * Anti-Sybil Free Quota System — with Upstash Redis persistence
 *
 * Three-dimensional identity tracking:
 *   1. X-Wallet-Address  — blockchain identity (strongest)
 *   2. X-Device-ID       — localStorage UUID (per-browser)
 *   3. X-Forwarded-For   — IP address (fallback)
 *
 * ALL available dimensions are checked simultaneously.
 * Any single dimension exceeding FREE_QUOTA blocks the request.
 * All dimensions are incremented together on each free use.
 *
 * Persistence:
 *   Production: Upstash Redis REST API (zero-dependency, pure fetch)
 *               Set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN in env.
 *   Development: In-memory Map fallback (resets on server restart).
 *
 * Quota TTL: 30 days rolling window (auto-resets, no manual intervention needed).
 */

import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { getOrCreateFreeRecord, atomicDeductCredits, FREE_TIER_FEATURE_LIMIT } from "@/lib/subscription";
import type { Feature as SubFeature } from "@/lib/subscription";

// ── Constants ─────────────────────────────────────────────────────
export type Feature = "analyze" | "advisor" | "advisor_deep" | "agent" | "verify" | "portfolio";

export const FREE_QUOTA = 3;

const ADMIN_WALLETS = new Set<string>([
  ...(process.env.SOLIS_ADMIN_WALLETS ?? "Goc5kAMb9NTXjobxzZogAWaHwajmQjw7CdmATWJN1mQh")
    .split(",")
    .map(w => w.trim())
    .filter(Boolean),
]);

export function isAdminWallet(walletAddress: string): boolean {
  return ADMIN_WALLETS.has(walletAddress.trim());
}

export function isValidSolanaAddress(addr: string): boolean {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr.trim());
}

export const FEATURE_FEE: Record<Feature, number> = {
  analyze:      100_000,  // $0.10 USDC (non-subscriber one-time)
  advisor:      200_000,  // $0.20 USDC (Haiku simple chat)
  advisor_deep: 500_000,  // $0.50 USDC (Sonnet 4.6 + extended thinking)
  agent:        100_000,  // $0.10 USDC
  verify:        50_000,  // $0.05 USDC
  portfolio:    100_000,  // $0.10 USDC
};

const USDC_MINT     = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const FEE_WALLET    = process.env.SOLIS_FEE_WALLET ?? "";
const HELIUS_RPC    = `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY ?? ""}`;

let _feeAta = "";
function getFeeAta(): string {
  if (_feeAta) return _feeAta;
  if (!FEE_WALLET) return "";
  try {
    _feeAta = getAssociatedTokenAddressSync(
      new PublicKey(USDC_MINT),
      new PublicKey(FEE_WALLET)
    ).toString();
  } catch { /* env var missing or invalid at build time */ }
  return _feeAta;
}

// ── Upstash Redis (persistent, zero-dependency) ───────────────────
const UPSTASH_URL   = process.env.UPSTASH_REDIS_REST_URL  ?? "";
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN ?? "";
const REDIS_TTL     = 2_592_000; // 30-day rolling window (seconds)

const redisAvailable = !!(UPSTASH_URL && UPSTASH_TOKEN);

type PipelineCommand = [string, ...string[]];

async function redisPipeline(
  commands: PipelineCommand[]
): Promise<{ result: unknown }[]> {
  const res = await fetch(`${UPSTASH_URL}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(commands),
  });
  if (!res.ok) throw new Error(`Upstash error: ${res.status}`);
  return res.json() as Promise<{ result: unknown }[]>;
}

// ── Payment sig replay protection ────────────────────────────────
// Txs confirmed on Solana are immutable. Store used sigs for 24h to prevent replay.
const PAYMENT_SIG_TTL = 86_400; // 24 hours

/**
 * Atomically claim a payment sig slot (SET NX).
 * Returns true if the sig was already claimed (replay), false if this is the first claim.
 * Use mark-then-verify pattern to avoid TOCTOU: claim first, then verify on-chain,
 * release with releasePaymentSig() if verification fails.
 */
export async function atomicClaimPaymentSig(txSig: string): Promise<boolean> {
  const key = `solis:used_sig:${txSig}`;
  if (redisAvailable) {
    try {
      // SET NX: returns "OK" if set (first claim), null if already exists (replay)
      const results = await redisPipeline([
        ["SET", key, "1", "EX", String(PAYMENT_SIG_TTL), "NX"],
      ]);
      const setResult = results[0]?.result;
      // "OK" = newly set (not a replay); null = already existed (replay)
      return setResult === null || setResult === undefined;
    } catch { /* fallback to memory */ }
  }
  if (memStore.has(`used_sig:${txSig}`)) return true;
  memStore.set(`used_sig:${txSig}`, 1);
  return false;
}

/** Release a previously claimed sig slot (called when on-chain verification fails). */
export async function releasePaymentSig(txSig: string): Promise<void> {
  const key = `solis:used_sig:${txSig}`;
  if (redisAvailable) {
    try {
      await redisPipeline([["DEL", key]]);
      return;
    } catch { /* fallback */ }
  }
  memStore.delete(`used_sig:${txSig}`);
}

// ── In-memory fallback ────────────────────────────────────────────
// Used when Upstash env vars are not set (local dev / offline)
const memStore = new Map<string, number>();

function memGet(key: string): number {
  return memStore.get(key) ?? 0;
}

function memIncr(key: string): void {
  memStore.set(key, (memStore.get(key) ?? 0) + 1);
}

// ── Free-tier per-feature INCR counter ───────────────────────────
// Key: solis:fc:<wallet>:<feature>  TTL: 30 days rolling
// Uses plain Redis INCR — no cjson, no Lua, 100% reliable.

const FC_TTL_SEC = 2_592_000; // 30 days

/**
 * Atomically increment the free-tier feature counter and check against limit.
 * Returns true = allowed (within limit), false = blocked (limit exceeded).
 *
 * existingUsage: usage count from featureUsage JSON field (legacy system).
 * Used to seed the INCR key via SET NX on first access, ensuring users who
 * already consumed some/all uses in the old system are not given a fresh counter.
 */
async function checkAndIncrFreeFeature(wallet: string, feature: Feature, existingUsage: number = 0): Promise<boolean> {
  const limit = FREE_TIER_FEATURE_LIMIT[feature as SubFeature];
  if (!limit || limit <= 0) return true; // feature has no per-use limit

  const key = `solis:fc:${wallet}:${feature}`;

  if (redisAvailable) {
    try {
      // Seed the counter from existing featureUsage if the key doesn't exist yet (NX = only if Not eXists).
      // This migrates users from the old cjson-based system to the new INCR system on their first post-deploy use.
      const cmds: PipelineCommand[] = [];
      if (existingUsage > 0) {
        cmds.push(["SET", key, String(existingUsage), "EX", String(FC_TTL_SEC), "NX"]);
      }
      cmds.push(["INCR", key]);
      cmds.push(["EXPIRE", key, String(FC_TTL_SEC)]);
      const results = await redisPipeline(cmds);
      // INCR result is always the last-but-one command; offset depends on whether SET NX was added
      const incrIdx = existingUsage > 0 ? 1 : 0;
      const count = Number(results[incrIdx]?.result ?? 0);
      return count <= limit;
    } catch {
      return true; // Redis error → fail open (credit gate still provides secondary protection)
    }
  }

  // In-memory fallback (dev)
  const memKey = `fc:${wallet}:${feature}`;
  const current = memStore.get(memKey) ?? existingUsage;
  const count = current + 1;
  memStore.set(memKey, count);
  return count <= limit;
}

/**
 * Read the current free-tier feature counter (non-mutating).
 * Used by /api/quota to display accurate remaining counts.
 */
export async function getFreeTierFeatureCounts(
  wallet: string,
  features: Feature[]
): Promise<Partial<Record<Feature, number>>> {
  const result: Partial<Record<Feature, number>> = {};

  if (redisAvailable) {
    try {
      const cmds: PipelineCommand[] = features.map(f => ["GET", `solis:fc:${wallet}:${f}`]);
      const results = await redisPipeline(cmds);
      features.forEach((f, i) => {
        result[f] = Number(results[i]?.result ?? 0);
      });
      return result;
    } catch { /* fall through to zero */ }
  }

  for (const f of features) {
    result[f] = memStore.get(`fc:${wallet}:${f}`) ?? 0;
  }
  return result;
}

// ── Identity extraction ───────────────────────────────────────────

// UUID v4 pattern — device IDs must be proper UUIDs generated by the client
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function extractIdentifiers(req: NextRequest): string[] {
  const ids: string[] = [];

  // Wallet address: must pass Solana base58 format check
  const wallet = (req.headers.get("x-wallet-address") ?? "").trim();
  if (wallet && isValidSolanaAddress(wallet)) ids.push(`wallet:${wallet}`);

  // Device ID: must be a valid UUID v4 (prevents arbitrary string abuse)
  const device = (req.headers.get("x-device-id") ?? "").trim();
  if (device && UUID_RE.test(device)) ids.push(`device:${device}`);

  const ip =
    (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() ||
    (req.headers.get("x-real-ip") ?? "").trim() ||
    "unknown";
  ids.push(`ip:${ip}`);

  return ids;
}

// ── Quota read (async — Redis or memory) ──────────────────────────

export async function checkQuota(
  feature: Feature,
  ids: string[]
): Promise<{ allowed: boolean; used: number; remaining: number }> {
  if (redisAvailable) {
    try {
      const commands: PipelineCommand[] = ids.map(id => ["GET", `solis:quota:${feature}:${id}`]);
      const results = await redisPipeline(commands);

      let maxUsed = 0;
      let minRemaining = FREE_QUOTA;
      for (const { result } of results) {
        const used = result !== null && result !== undefined ? Number(result) : 0;
        maxUsed = Math.max(maxUsed, used);
        minRemaining = Math.min(minRemaining, Math.max(0, FREE_QUOTA - used));
      }
      return { allowed: minRemaining > 0, used: maxUsed, remaining: minRemaining };
    } catch {
      // Redis error → fall back to memory
    }
  }

  // In-memory fallback
  let maxUsed = 0;
  let minRemaining = FREE_QUOTA;
  for (const id of ids) {
    const used = memGet(`${feature}:${id}`);
    maxUsed = Math.max(maxUsed, used);
    minRemaining = Math.min(minRemaining, Math.max(0, FREE_QUOTA - used));
  }
  return { allowed: minRemaining > 0, used: maxUsed, remaining: minRemaining };
}

// ── Quota write (async — Redis INCR+EXPIRE or memory) ────────────

export async function consumeQuota(feature: Feature, ids: string[]): Promise<void> {
  if (redisAvailable) {
    try {
      // Pipeline: INCR + EXPIRE (sliding 30-day window) for each id
      const commands: PipelineCommand[] = [];
      for (const id of ids) {
        const key = `solis:quota:${feature}:${id}`;
        commands.push(["INCR", key]);
        commands.push(["EXPIRE", key, String(REDIS_TTL)]);
      }
      await redisPipeline(commands);
      return;
    } catch {
      // Redis error → fall back to memory (don't block user)
    }
  }

  for (const id of ids) {
    memIncr(`${feature}:${id}`);
  }
}

// ── Quota peek (non-consuming read) ─────────────────────────────

export async function peekQuota(
  feature: Feature,
  ids: string[]
): Promise<{ allowed: boolean; used: number; remaining: number }> {
  return checkQuota(feature, ids);
}

// ── Payment verification ──────────────────────────────────────────

export async function verifyQuotaPayment(
  txSig: string,
  requiredAmount: number
): Promise<boolean> {
  if (!FEE_WALLET) return true;
  try {
    const conn = new Connection(HELIUS_RPC, "confirmed");
    const tx = await conn.getParsedTransaction(txSig, { maxSupportedTransactionVersion: 0 });
    if (!tx) return false;

    for (const ix of tx.transaction.message.instructions) {
      if ("parsed" in ix && ix.parsed?.type === "transferChecked") {
        const info = ix.parsed.info;
        if (
          info?.mint === USDC_MINT &&
          info?.destination === getFeeAta() &&
          Number(info?.tokenAmount?.amount ?? 0) >= requiredAmount
        ) {
          return true;
        }
      }
    }
    return false;
  } catch {
    return false;
  }
}

// ── 402 response helpers ──────────────────────────────────────────

export function quota402Body(feature: Feature, used: number) {
  const feeUSDC = FEATURE_FEE[feature] / 1_000_000;
  return {
    error: "free_quota_exhausted",
    feature,
    used,
    freeQuota: FREE_QUOTA,
    recipient: FEE_WALLET || "not-configured",
    amount: feeUSDC,
    currency: "USDC",
    network: "solana-mainnet",
    description: `Sakura ${feature} — free quota exhausted (${FREE_QUOTA} uses/device)`,
  };
}

export function quotaExhaustedResponse(feature: Feature, used: number): NextResponse {
  const feeUSDC = (FEATURE_FEE[feature] / 1_000_000).toFixed(2);
  return NextResponse.json(quota402Body(feature, used), {
    status: 402,
    headers: {
      "X-Payment-Required": "true",
      "X-Payment-Amount": feeUSDC,
      "X-Payment-Currency": "USDC",
      "X-Payment-Recipient": FEE_WALLET || "not-configured",
      "X-Payment-Network": "solana-mainnet",
      "X-Quota-Used": String(used),
      "X-Quota-Free": String(FREE_QUOTA),
    },
  });
}

// ── Full quota gate ───────────────────────────────────────────────

export async function runQuotaGate(
  req: NextRequest,
  feature: Feature
): Promise<
  | { proceed: true; ids: string[]; paid: boolean }
  | { proceed: false; response: NextResponse }
> {
  const ids = extractIdentifiers(req);

  const wallet = (req.headers.get("x-wallet-address") ?? "").trim();

  // Admin bypass
  if (wallet && isAdminWallet(wallet)) {
    console.log(`[SOLIS_ADMIN] wallet=${wallet.slice(0, 8)}… feature=${feature} ts=${new Date().toISOString()}`);
    return { proceed: true, ids, paid: false };
  }

  // ── Per-use payment path (checked BEFORE credits so wallet + X-PAYMENT = payment path) ──
  const paymentSig =
    req.headers.get("x-payment") ?? req.headers.get("X-PAYMENT");

  if (paymentSig) {
    // Atomic mark-then-verify: claim the sig slot FIRST (SET NX), then verify on-chain.
    const alreadyClaimed = await atomicClaimPaymentSig(paymentSig);
    if (alreadyClaimed) {
      return {
        proceed: false,
        response: NextResponse.json(
          { error: "Payment already used — send a new transaction" },
          { status: 402 }
        ),
      };
    }
    const valid = await verifyQuotaPayment(paymentSig, FEATURE_FEE[feature]);
    if (!valid) {
      await releasePaymentSig(paymentSig);
      return {
        proceed: false,
        response: NextResponse.json(
          { error: "Payment verification failed" },
          { status: 402 }
        ),
      };
    }
    return { proceed: true, ids, paid: true };
  }

  // ── All features require a connected wallet ───────────────────────
  if (!wallet || wallet.length < 32) {
    return {
      proceed: false,
      response: NextResponse.json(
        { error: "wallet_required", message: "請先連接錢包才能使用此功能" },
        { status: 401 }
      ),
    };
  }

  // ── Wallet credit gate (free 100pt/month + Basic/Pro subscriptions) ──
  const freeRecord = await getOrCreateFreeRecord(wallet); // ensure record exists

  // Free tier: INCR counter gate (simple Redis INCR — no cjson, no Lua, 100% reliable)
  // Runs BEFORE credit deduction so 4th+ use triggers x402 payment immediately.
  // Pass existingUsage from the legacy featureUsage JSON field so existing users
  // who already consumed uses in the old system are properly migrated (SET NX seed).
  if (freeRecord.tier === "free") {
    const existingUsage = (freeRecord.featureUsage as Record<string, number> | undefined)?.[feature] ?? 0;
    const allowed = await checkAndIncrFreeFeature(wallet, feature, existingUsage);
    if (!allowed) {
      return { proceed: false, response: quotaExhaustedResponse(feature, 3) };
    }
  }

  const result = await atomicDeductCredits(wallet, feature as SubFeature);

  if (result.success) {
    console.log(
      `[SOLIS_${result.tier.toUpperCase()}] tier=${result.tier} wallet=${wallet.slice(0, 8)}… ` +
      `feature=${feature} remaining=${result.newBalance}`
    );
    return { proceed: true, ids, paid: false };
  }

  const { balance, cost, tier } = result;

  // Free tier exhausted → x402 per-use payment ($0.10 USDC)
  if (tier === "free") {
    return { proceed: false, response: quotaExhaustedResponse(feature, 3) };
  }

  // Paid subscription (Basic/Pro) exhausted → upgrade/reset prompt
  const now = Date.now();
  const record = await getOrCreateFreeRecord(wallet);
  return {
    proceed: false,
    response: NextResponse.json(
      {
        error: "subscription_credits_exhausted",
        tier,
        feature,
        creditBalance: balance,
        creditCost: cost,
        message: tier === "basic"
          ? `Basic 點數不足（需 ${cost} 點，餘 ${balance} 點）。升級 Pro 獲得更多點數。`
          : `Pro 本月點數已用完（需 ${cost} 點，餘 ${balance} 點）。點數將在下月自動續充。`,
        upgradeUrl: "/api/subscription",
        daysUntilReset: Math.ceil((record.expiresAt - now) / (1000 * 60 * 60 * 24)),
      },
      { status: 402 }
    ),
  };
}
