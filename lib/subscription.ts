/**
 * Sakura Credit System — 点数订阅模型
 *
 * 设计原则（洞察人性）：
 *   1. 免费层给 100 点 — 每个主功能各 3 次（安全分析/持倉健檢/Agent/顧問各消耗8-9点），
 *      深度分析需 150 点（付費專屬）→ 用戶能均衡體驗所有功能，自然產生升級動機；每月自動重置
 *   2. Basic $15/月，1,350 点 + 450 点结转 — 低于 ChatGPT Plus $20，专业 DeFi 工具更有价值
 *      命名"Basic"而非"Standard"→ 让 Pro 看起来不贵
 *   3. Pro $30/月，3,500 点 + 1,000 点结转
 *      Basic→Pro 多付 $15 得 2.6× 点数，升级划算；结转机制提高黏性
 *   4. 年付省 30%：Basic $126/年($10.5/月)，Pro $252/年($21/月)
 *      心理："反正我会用的" → 一次性收入
 *
 * 点数成本对应 AI API 真实成本（Claude Sonnet 4.6）：
 *   verify        =  1 点  (RPC 调用，几乎零成本)
 *   analyze       =  8 点  (~$0.003/次, free: 3次)
 *   portfolio     =  8 点  (~$0.005/次, free: 3次)
 *   agent         =  8 点  (~$0.005/次, free: 3次)
 *   advisor       =  9 点  (~$0.01/次,  free: 3次)
 *   advisor_deep  = 150 点 (~$0.05–0.15/次, 付費專屬)
 *
 * 收支健康检查（典型用户 30% advisor + 70% 其他）：
 *   Basic $15 最坏：全用 advisor → 150次 × $0.01 = $1.50 成本 → 利润 $13.50 (90%)
 *   Pro   $30 最坏：全用 advisor → 388次 × $0.01 = $3.88 成本 → 利润 $26.12 (87%)
 *   典型用户：利润 93-94%
 */

import { Connection, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";

// ── Types ─────────────────────────────────────────────────────────

export type SubscriptionTier = "free" | "basic" | "pro";
export type BillingPeriod = "monthly" | "annual";

export interface SubscriptionRecord {
  tier: SubscriptionTier;
  activatedAt: number;       // Unix ms
  expiresAt: number;         // Unix ms
  txSig: string;             // Activation payment tx
  walletAddress: string;
  billingPeriod: BillingPeriod;
  creditBalance: number;     // Current credit balance
  creditGrantedAt: number;   // Last monthly grant timestamp
  rolloverCredits: number;   // Carried over from previous month (Pro only)
  featureUsage?: Partial<Record<Feature, number>>;  // Per-feature use count (free tier display)
}

// ── Credit costs per feature ──────────────────────────────────────
// Reflects actual Claude API cost ratios

export type Feature = "analyze" | "advisor" | "advisor_deep" | "agent" | "verify" | "portfolio";

export const FEATURE_CREDIT_COST: Record<Feature, number> = {
  verify:       1,   // RPC only                            → ~$0.0001/次
  analyze:      8,   // claude-sonnet-4-6                   → ~$0.003/次  (free: 3次)
  portfolio:    8,   // claude-sonnet-4-6                   → ~$0.005/次  (free: 3次)
  agent:        8,   // claude-sonnet-4-6 rebalance         → ~$0.005/次  (free: 3次)
  advisor:      9,   // claude-sonnet-4-6 简单对话           → ~$0.01/次   (free: 3次)
  advisor_deep: 150, // claude-sonnet-4-6 + thinking       → ~$0.05–0.15/次 (free: 0次，付費專屬)
};

// ── Free tier per-feature hard limits ────────────────────────────
// 0 = no hard limit (rely on credit balance check instead)
export const FREE_TIER_FEATURE_LIMIT: Record<Feature, number> = {
  verify:       0,    // ~100 uses on 100pts — effectively unlimited, use credit gate
  analyze:      3,
  portfolio:    3,
  agent:        3,
  advisor:      3,
  advisor_deep: 0,    // Blocked by credit balance (150pts > 100pts free budget)
};

// ── Tier credit allocations ───────────────────────────────────────

export const TIER_MONTHLY_CREDITS: Record<SubscriptionTier, number> = {
  free:  100,    // 每月 3× 各主功能体验
  basic: 1_350,  // ~150× advisor OR ~168× analyze
  pro:   3_500,  // ~388× advisor OR ~437× analyze
};

export const TIER_ROLLOVER_MAX: Record<SubscriptionTier, number> = {
  free:  0,      // no rollover
  basic: 450,    // 最多结转 450 点（~33% of 1350）— 减少月末焦虑，提高续费意愿
  pro:   1_000,  // 最多结转 1,000 点 — Pro 专属钩子，让用户不舍得取消
};

// ── Pricing (USDC, 6 decimals) ────────────────────────────────────

export const SUBSCRIPTION_PRICE_MONTHLY: Record<Exclude<SubscriptionTier, "free">, number> = {
  basic:  15_000_000,  // $15.00 USDC/月
  pro:    30_000_000,  // $30.00 USDC/月
};

export const SUBSCRIPTION_PRICE_ANNUAL: Record<Exclude<SubscriptionTier, "free">, number> = {
  basic:  126_000_000, // $126.00 USDC/年 (原价$180，省$54，省30%)
  pro:    252_000_000, // $252.00 USDC/年 (原价$360，省$108，省30%)
};

// ── Display info ──────────────────────────────────────────────────

export const SUBSCRIPTION_FEATURES: Record<SubscriptionTier, string[]> = {
  free: [
    "100 点/月（每月自动重置）",
    "每项功能各 3 次体验",
    "深度分析为付費專屬",
    "体验全部功能",
  ],
  basic: [
    "1,350 点/月 + 最多结转 450 点",
    "~150 次 AI 顧問 / ~9 次深度分析",
    "~168 次安全分析",
    "Guardian 借贷健康监控",
    "智能钱包追踪（聪明钱）",
    "MCP 工具调用",
  ],
  pro: [
    "3,500 点/月 + 最多结转 1,000 点",
    "~388 次 AI 顧問 / ~23 次深度分析",
    "~437 次安全分析",
    "自动化条件交易触发",
    "机构级实时数据可视化",
    "最高优先级响应 + 链上证明",
  ],
};

export const FEATURE_CREDIT_LABELS: Record<Feature, string> = {
  verify:       "1 点",
  analyze:      "8 点",
  portfolio:    "8 点",
  agent:        "8 点",
  advisor:      "9 点",
  advisor_deep: "150 点",
};

// ── TTL constants ─────────────────────────────────────────────────

const MONTHLY_TTL_MS  = 30 * 24 * 60 * 60 * 1_000;
const MONTHLY_TTL_SEC = 30 * 24 * 60 * 60;
const ANNUAL_TTL_MS   = 365 * 24 * 60 * 60 * 1_000;
const ANNUAL_TTL_SEC  = 365 * 24 * 60 * 60;

// ── External service constants ────────────────────────────────────

const USDC_MINT   = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const FEE_WALLET  = process.env.SOLIS_FEE_WALLET ?? "";
const HELIUS_RPC  = `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY ?? ""}`;

let _feeAtaSub = "";
function getFeeAta(): string {
  if (_feeAtaSub) return _feeAtaSub;
  if (!FEE_WALLET) return "";
  try {
    _feeAtaSub = getAssociatedTokenAddressSync(
      new PublicKey(USDC_MINT),
      new PublicKey(FEE_WALLET)
    ).toString();
  } catch { /* env var missing or invalid at build time */ }
  return _feeAtaSub;
}

// ── Upstash Redis ─────────────────────────────────────────────────

const UPSTASH_URL   = process.env.UPSTASH_REDIS_REST_URL  ?? "";
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN ?? "";
const redisAvailable = !!(UPSTASH_URL && UPSTASH_TOKEN);

async function redisPipeline(
  commands: [string, ...string[]][]
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

async function redisGetJson<T>(key: string): Promise<T | null> {
  if (!redisAvailable) return null;
  try {
    const results = await redisPipeline([["GET", key]]);
    const raw = results[0]?.result;
    if (!raw || typeof raw !== "string") return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function redisSetJson(key: string, value: unknown, exSeconds: number): Promise<void> {
  if (!redisAvailable) return;
  try {
    await redisPipeline([["SET", key, JSON.stringify(value), "EX", String(exSeconds)]]);
  } catch { /* silent */ }
}

// ── Upstash Lua eval (atomic check-and-deduct) ───────────────────

async function redisEval(script: string, keys: string[], args: string[]): Promise<unknown> {
  const res = await fetch(`${UPSTASH_URL}/eval`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([script, keys.length, ...keys, ...args]),
  });
  if (!res.ok) throw new Error(`Upstash eval error: ${res.status}`);
  const data = await res.json() as { result: unknown };
  return data.result;
}

// Lua script: atomically check balance, deduct credits, and track per-feature usage.
// ARGV[1] = cost, ARGV[2] = feature name, ARGV[3] = free tier feature limit (0 = skip check)
// Returns:
//   ≥0  — success (new credit balance)
//   -1  — no record found
//   -2  — insufficient credit balance
//   -3  — free tier per-feature limit reached (featureUsage[feature] >= limit)
const DEDUCT_LUA = `
local raw = redis.call("GET", KEYS[1])
if not raw then return -1 end
local ok, rec = pcall(cjson.decode, raw)
if not ok then return -1 end
local cost = tonumber(ARGV[1])
local feature = ARGV[2]
local freeLimit = tonumber(ARGV[3]) or 0
if rec["creditBalance"] < cost then return -2 end
if rec["tier"] == "free" and feature and feature ~= "" and freeLimit > 0 then
  if not rec["featureUsage"] then rec["featureUsage"] = {} end
  local usedCount = rec["featureUsage"][feature] or 0
  if usedCount >= freeLimit then return -3 end
end
rec["creditBalance"] = rec["creditBalance"] - cost
if feature and feature ~= "" then
  if not rec["featureUsage"] then rec["featureUsage"] = {} end
  rec["featureUsage"][feature] = (rec["featureUsage"][feature] or 0) + 1
end
local ttl = redis.call("TTL", KEYS[1])
redis.call("SET", KEYS[1], cjson.encode(rec), "EX", tostring(math.max(ttl, 1)))
return rec["creditBalance"]
`;

// ── In-memory lock (per-wallet mutex for dev fallback) ───────────
const memLocks = new Map<string, Promise<void>>();

// ── In-memory fallback ────────────────────────────────────────────

const memSubs = new Map<string, SubscriptionRecord>();

// ── Core: get subscription ────────────────────────────────────────

export async function getSubscription(
  walletAddress: string
): Promise<SubscriptionRecord | null> {
  if (!walletAddress || walletAddress.length < 32) return null;

  const key = `solis:sub:${walletAddress}`;

  let record: SubscriptionRecord | null;
  if (redisAvailable) {
    record = await redisGetJson<SubscriptionRecord>(key);
  } else {
    record = memSubs.get(walletAddress) ?? null;
  }

  if (!record) return null;
  if (record.expiresAt < Date.now()) {
    if (!redisAvailable) memSubs.delete(walletAddress);
    return null;
  }

  // Monthly credit top-up: if a new 30-day window has started, grant fresh credits
  record = maybeTopUpCredits(record);
  if (redisAvailable) {
    const ttlSec = Math.ceil((record.expiresAt - Date.now()) / 1000);
    await redisSetJson(key, record, ttlSec);
  } else {
    memSubs.set(walletAddress, record);
  }

  return record;
}

/**
 * If 30+ days have passed since last credit grant, top up credits.
 * Pro tier: carry over unused credits (up to TIER_ROLLOVER_MAX).
 */
function maybeTopUpCredits(record: SubscriptionRecord): SubscriptionRecord {
  const now = Date.now();
  const daysSinceGrant = (now - record.creditGrantedAt) / (1000 * 60 * 60 * 24);
  if (daysSinceGrant < 30) return record;

  const freshCredits = TIER_MONTHLY_CREDITS[record.tier];
  const rolloverMax  = TIER_ROLLOVER_MAX[record.tier];
  const rollover     = Math.min(record.creditBalance, rolloverMax);

  return {
    ...record,
    creditBalance:   freshCredits + rollover,
    rolloverCredits: rollover,
    creditGrantedAt: now,
    featureUsage:    {},  // Reset per-feature counters on monthly renewal
  };
}

export async function getSubscriptionTier(
  walletAddress: string
): Promise<SubscriptionTier> {
  const record = await getSubscription(walletAddress);
  return record?.tier ?? "free";
}

/**
 * Check if wallet has enough credits for a feature.
 * Returns { allowed, balance, cost }.
 */
export async function checkCreditBalance(
  walletAddress: string,
  feature: Feature
): Promise<{ allowed: boolean; balance: number; cost: number; tier: SubscriptionTier }> {
  const record = await getSubscription(walletAddress);
  const tier = record?.tier ?? "free";
  const balance = record?.creditBalance ?? TIER_MONTHLY_CREDITS.free;
  const cost = FEATURE_CREDIT_COST[feature];
  return { allowed: balance >= cost, balance, cost, tier };
}

/**
 * Deduct credits for a feature use.
 * Returns updated balance.
 */
export async function deductCredits(
  walletAddress: string,
  feature: Feature
): Promise<number> {
  const record = await getSubscription(walletAddress);
  if (!record) return 0;

  const cost = FEATURE_CREDIT_COST[feature];
  const newBalance = Math.max(0, record.creditBalance - cost);
  const updated: SubscriptionRecord = { ...record, creditBalance: newBalance };

  const key = `solis:sub:${walletAddress}`;
  const ttlSec = Math.ceil((record.expiresAt - Date.now()) / 1000);
  if (redisAvailable) {
    await redisSetJson(key, updated, ttlSec);
  } else {
    memSubs.set(walletAddress, updated);
  }
  return newBalance;
}

/**
 * Atomically check balance and deduct credits in one Redis operation.
 * Also enforces free tier per-feature hard limits (e.g. 3 uses of analyze).
 *
 * Returns:
 *   { success: true,  newBalance: number }  — deducted OK
 *   { success: false, reason: "no_record" | "insufficient" | "feature_limit" }
 */
export async function atomicDeductCredits(
  walletAddress: string,
  feature: Feature
): Promise<
  | { success: true; newBalance: number; tier: SubscriptionTier }
  | { success: false; reason: "no_record" | "insufficient" | "feature_limit"; balance: number; cost: number; tier: SubscriptionTier }
> {
  const cost = FEATURE_CREDIT_COST[feature];
  const freeLimit = FREE_TIER_FEATURE_LIMIT[feature];
  const key = `solis:sub:${walletAddress}`;

  // ── Redis path: atomic Lua ───────────────────────────────────────
  if (redisAvailable) {
    try {
      const result = await redisEval(DEDUCT_LUA, [key], [String(cost), feature, String(freeLimit)]);
      const num = Number(result);
      if (num >= 0) {
        // Success — read tier from cached record (non-blocking best-effort)
        const record = await getSubscription(walletAddress);
        return { success: true, newBalance: num, tier: record?.tier ?? "free" };
      }
      if (num === -2) {
        const record = await getSubscription(walletAddress);
        const balance = record?.creditBalance ?? 0;
        return { success: false, reason: "insufficient", balance, cost, tier: record?.tier ?? "free" };
      }
      if (num === -3) {
        // Free tier per-feature limit reached
        const record = await getSubscription(walletAddress);
        const balance = record?.creditBalance ?? 0;
        return { success: false, reason: "feature_limit", balance, cost, tier: "free" };
      }
      // -1: no record — fall through to getOrCreate path
    } catch {
      // Redis error → fall through to non-atomic path (don't block user)
    }
  }

  // ── In-memory path: JS mutex per wallet ─────────────────────────
  // Prevents concurrent in-process races during dev / Redis-unavailable
  const runWithLock = async (): Promise<ReturnType<typeof atomicDeductCredits>> => {
    const record = await getSubscription(walletAddress);
    if (!record) return { success: false, reason: "no_record", balance: 0, cost, tier: "free" };
    // Free tier feature limit check
    if (record.tier === "free" && freeLimit > 0) {
      const usedCount = record.featureUsage?.[feature] ?? 0;
      if (usedCount >= freeLimit) {
        return { success: false, reason: "feature_limit", balance: record.creditBalance, cost, tier: "free" };
      }
    }
    if (record.creditBalance < cost) {
      return { success: false, reason: "insufficient", balance: record.creditBalance, cost, tier: record.tier };
    }
    const newBalance = record.creditBalance - cost;
    const prevUsage = record.featureUsage ?? {};
    memSubs.set(walletAddress, {
      ...record,
      creditBalance: newBalance,
      featureUsage: { ...prevUsage, [feature]: (prevUsage[feature] ?? 0) + 1 },
    });
    return { success: true, newBalance, tier: record.tier };
  };

  // Chain onto existing lock for this wallet (if any) to serialize
  const prev = memLocks.get(walletAddress) ?? Promise.resolve();
  let resolve!: () => void;
  const lock = new Promise<void>(r => { resolve = r; });
  memLocks.set(walletAddress, prev.then(() => lock));

  try {
    await prev;
    return await runWithLock();
  } finally {
    resolve();
    // Clean up lock entry once settled
    if (memLocks.get(walletAddress) === lock) memLocks.delete(walletAddress);
  }
}

// ── Payment verification ──────────────────────────────────────────

async function verifySubscriptionPayment(
  txSig: string,
  requiredAmount: number
): Promise<boolean> {
  if (!FEE_WALLET) return true; // demo mode
  try {
    const conn = new Connection(HELIUS_RPC, "confirmed");
    const tx = await conn.getParsedTransaction(txSig, {
      maxSupportedTransactionVersion: 0,
    });
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

// ── Activate subscription ─────────────────────────────────────────

export async function activateSubscription(
  walletAddress: string,
  tier: Exclude<SubscriptionTier, "free">,
  txSig: string,
  billingPeriod: BillingPeriod = "monthly"
): Promise<{ success: boolean; record?: SubscriptionRecord; error?: string }> {
  if (!walletAddress || walletAddress.length < 32) {
    return { success: false, error: "Invalid wallet address" };
  }
  if (!txSig) {
    return { success: false, error: "Missing payment transaction signature" };
  }

  const requiredAmount = billingPeriod === "annual"
    ? SUBSCRIPTION_PRICE_ANNUAL[tier]
    : SUBSCRIPTION_PRICE_MONTHLY[tier];

  const valid = await verifySubscriptionPayment(txSig, requiredAmount);
  if (!valid) {
    const price = (requiredAmount / 1_000_000).toFixed(2);
    return {
      success: false,
      error: `支付验证失败。请向 ${FEE_WALLET || "费用钱包"} 发送 $${price} USDC`,
    };
  }

  // Idempotency: same txSig → return existing
  const existing = await getSubscription(walletAddress);
  if (existing?.txSig === txSig) {
    return { success: true, record: existing };
  }

  const now = Date.now();
  const ttlMs = billingPeriod === "annual" ? ANNUAL_TTL_MS : MONTHLY_TTL_MS;

  // Pro tier inherits rollover from previous subscription
  const prevRollover = (existing?.tier === "pro" && tier === "pro")
    ? Math.min(existing.creditBalance, TIER_ROLLOVER_MAX.pro)
    : 0;

  const record: SubscriptionRecord = {
    tier,
    billingPeriod,
    activatedAt:    now,
    expiresAt:      now + ttlMs,
    txSig,
    walletAddress,
    creditBalance:  TIER_MONTHLY_CREDITS[tier] + prevRollover,
    creditGrantedAt: now,
    rolloverCredits: prevRollover,
  };

  const key = `solis:sub:${walletAddress}`;
  const ttlSec = billingPeriod === "annual" ? ANNUAL_TTL_SEC : MONTHLY_TTL_SEC;
  if (redisAvailable) {
    await redisSetJson(key, record, ttlSec);
  } else {
    memSubs.set(walletAddress, record);
  }

  return { success: true, record };
}

// ── Free tier auto-create ─────────────────────────────────────────
/**
 * Get or create a free-tier credit record for any wallet address.
 * Called for wallet-connected users with no paid subscription.
 * Stores 100pts/month in Redis; auto-resets after 30 days.
 */
export async function getOrCreateFreeRecord(
  walletAddress: string
): Promise<SubscriptionRecord> {
  if (!walletAddress || walletAddress.length < 32) {
    // Return ephemeral record for invalid wallet
    const now = Date.now();
    return {
      tier: "free", billingPeriod: "monthly",
      activatedAt: now, expiresAt: now + MONTHLY_TTL_MS,
      txSig: "free_tier", walletAddress,
      creditBalance: TIER_MONTHLY_CREDITS.free,
      creditGrantedAt: now, rolloverCredits: 0,
    };
  }

  // Check if a paid (or existing free) record already exists
  const existing = await getSubscription(walletAddress);
  if (existing) return existing;

  // No record — create fresh free-tier record
  const now = Date.now();
  const record: SubscriptionRecord = {
    tier: "free",
    billingPeriod: "monthly",
    activatedAt: now,
    expiresAt: now + MONTHLY_TTL_MS,
    txSig: "free_tier",
    walletAddress,
    creditBalance: TIER_MONTHLY_CREDITS.free, // 100
    creditGrantedAt: now,
    rolloverCredits: 0,
  };

  const key = `solis:sub:${walletAddress}`;
  if (redisAvailable) {
    await redisSetJson(key, record, MONTHLY_TTL_SEC);
  } else {
    memSubs.set(walletAddress, record);
  }

  return record;
}

// ── Summary helper ────────────────────────────────────────────────

export interface SubscriptionSummary {
  tier: SubscriptionTier;
  active: boolean;
  expiresAt: number | null;
  daysRemaining: number | null;
  creditBalance: number;
  monthlyCredits: number;
  rolloverCredits: number;
  billingPeriod: BillingPeriod | null;
  price: number | null;
}

export function subscriptionSummary(record: SubscriptionRecord | null): SubscriptionSummary {
  if (!record) {
    return {
      tier:           "free",
      active:         false,
      expiresAt:      null,
      daysRemaining:  null,
      creditBalance:  TIER_MONTHLY_CREDITS.free,
      monthlyCredits: TIER_MONTHLY_CREDITS.free,
      rolloverCredits: 0,
      billingPeriod:  null,
      price:          null,
    };
  }
  const daysRemaining = Math.ceil((record.expiresAt - Date.now()) / (1000 * 60 * 60 * 24));
  const priceMap = record.billingPeriod === "annual"
    ? SUBSCRIPTION_PRICE_ANNUAL
    : SUBSCRIPTION_PRICE_MONTHLY;
  const price = record.tier !== "free"
    ? priceMap[record.tier as Exclude<SubscriptionTier, "free">] / 1_000_000
    : 0;

  return {
    tier:           record.tier,
    active:         true,
    expiresAt:      record.expiresAt,
    daysRemaining:  Math.max(0, daysRemaining),
    creditBalance:  record.creditBalance,
    monthlyCredits: TIER_MONTHLY_CREDITS[record.tier],
    rolloverCredits: record.rolloverCredits,
    billingPeriod:  record.billingPeriod,
    price,
  };
}
