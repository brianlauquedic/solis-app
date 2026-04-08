/**
 * Sakura Credit System — 点数订阅模型
 *
 * 设计原则（洞察人性）：
 *   1. 免费层给 100 点 — 每个主功能各 3 次（安全分析/持倉健檢/Agent/顧問各消耗8-9点），
 *      深度分析需 150 点（付費專屬）→ 用戶能均衡體驗所有功能，自然產生升級動機；每月自動重置
 *   2. Basic $8/月，1,500 点 + 500 点结转 — 比 Netflix 便宜，有结转减少焦虑
 *      命名"Basic"而非"Standard"→ 让 Pro 看起来不贵
 *   3. Pro $28/月，6,000 点 + 未用点数结转（上限 2,000）
 *      结转机制 = 用户不愿意取消 → 月末冲动使用 → 粘性最高
 *   4. 年付省 30%：Basic $67/年($5.6/月)，Pro $235/年($19.6/月)
 *      心理："反正我会用的" → 一次性收入
 *
 * 点数成本对应 AI API 真实成本（Claude Sonnet 4.6 ~ 30× Haiku）：
 *   verify        =  1 点  (RPC 调用，几乎零成本)
 *   analyze       = 10 点  (Haiku, ~$0.003/次)
 *   portfolio     = 15 点  (Haiku + 计算, ~$0.005/次)
 *   agent         = 15 点  (Haiku rebalance, ~$0.005/次)
 *   advisor       = 30 点  (Haiku 简单对话, ~$0.01/次)   ← 心理门槛低
 *   advisor_deep  = 80 点  (Sonnet 4.6 + extended thinking, ~$0.05–0.15/次)
 *
 * 收支健康检查（Pro $28/月，6,000 点）：
 *   最坏：全用 advisor_deep → 75次 × $0.10 = $7.5 成本 → 利润 $20.5 (73%)
 *   常见：30% advisor_deep + 70% advisor → 成本 ~$3–4 → 利润 $24+ (86%)
 *   最好：全用 analyze → 600次 × $0.003 = $1.8 → 利润 $26.2 (94%)
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

// ── Tier credit allocations ───────────────────────────────────────

export const TIER_MONTHLY_CREDITS: Record<SubscriptionTier, number> = {
  free:  100,    // 1× advisor OR 10× analyze — 够体验，不够依赖
  basic: 1_500,  // ~18× advisor OR 150× analyze
  pro:   6_000,  // ~75× advisor OR 600× analyze
};

export const TIER_ROLLOVER_MAX: Record<SubscriptionTier, number> = {
  free:  0,      // no rollover
  basic: 500,    // 最多结转 500 点 — 减少月末焦虑，提高续费意愿（≈16次分析）
  pro:   2_000,  // 最多结转 2,000 点 — Pro 专属钩子，让用户不舍得取消
};

// ── Pricing (USDC, 6 decimals) ────────────────────────────────────

export const SUBSCRIPTION_PRICE_MONTHLY: Record<Exclude<SubscriptionTier, "free">, number> = {
  basic:  8_000_000,   // $8.00 USDC/月
  pro:   28_000_000,   // $28.00 USDC/月
};

export const SUBSCRIPTION_PRICE_ANNUAL: Record<Exclude<SubscriptionTier, "free">, number> = {
  basic:  67_000_000,  // $67.00 USDC/年 (原价$96，省$29，省30%)
  pro:   235_000_000,  // $235.00 USDC/年 (原价$336，省$101，省30%)
};

// ── Display info ──────────────────────────────────────────────────

export const SUBSCRIPTION_FEATURES: Record<SubscriptionTier, string[]> = {
  free: [
    "100 点/月（每月自动重置）",
    "1 次深度 AI 分析（80点）",
    "3 次简单对话（30点×3）",
    "10 次安全分析（10点×10）",
    "体验全部功能",
  ],
  basic: [
    "1,500 点/月 + 最多结转 500 点",
    "~50 次 AI 对话 / ~18 次深度分析",
    "~150 次安全分析",
    "Guardian 借贷健康监控",
    "智能钱包追踪（聪明钱）",
    "MCP 工具调用",
  ],
  pro: [
    "6,000 点/月 + 最多结转 2,000 点",
    "~200 次 AI 对话 / ~75 次深度分析",
    "自动化条件交易触发",
    "机构级实时数据可视化",
    "无限 MCP API 访问",
    "最高优先级响应 + 链上证明",
  ],
};

export const FEATURE_CREDIT_LABELS: Record<Feature, string> = {
  verify:       "1 点",
  analyze:      "10 点",
  portfolio:    "15 点",
  agent:        "15 点",
  advisor:      "30 点",
  advisor_deep: "80 点",
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

// Lua script: atomically check balance and deduct if sufficient.
// Returns: new balance (≥0) on success, -1 if no record, -2 if insufficient credits.
const DEDUCT_LUA = `
local raw = redis.call("GET", KEYS[1])
if not raw then return -1 end
local ok, rec = pcall(cjson.decode, raw)
if not ok then return -1 end
local cost = tonumber(ARGV[1])
if rec["creditBalance"] < cost then return -2 end
rec["creditBalance"] = rec["creditBalance"] - cost
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
 * Eliminates TOCTOU race between checkCreditBalance + deductCredits.
 *
 * Returns:
 *   { success: true,  newBalance: number }  — deducted OK
 *   { success: false, reason: "no_record" | "insufficient", balance: number, cost: number }
 */
export async function atomicDeductCredits(
  walletAddress: string,
  feature: Feature
): Promise<
  | { success: true; newBalance: number; tier: SubscriptionTier }
  | { success: false; reason: "no_record" | "insufficient"; balance: number; cost: number; tier: SubscriptionTier }
> {
  const cost = FEATURE_CREDIT_COST[feature];
  const key = `solis:sub:${walletAddress}`;

  // ── Redis path: atomic Lua ───────────────────────────────────────
  if (redisAvailable) {
    try {
      const result = await redisEval(DEDUCT_LUA, [key], [String(cost)]);
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
    if (record.creditBalance < cost) {
      return { success: false, reason: "insufficient", balance: record.creditBalance, cost, tier: record.tier };
    }
    const newBalance = record.creditBalance - cost;
    memSubs.set(walletAddress, { ...record, creditBalance: newBalance });
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
