/**
 * Upstash Redis utility — distributed rate limiting & replay protection.
 *
 * Graceful degradation: if UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
 * are not set, all functions return null / fall back to the in-memory caller.
 * The rest of the app runs normally; Redis just adds true cross-instance safety.
 *
 * Setup (Vercel):
 *   Dashboard → Storage → Create Database → Upstash KV
 *   → Environment Variables are auto-injected as:
 *       UPSTASH_REDIS_REST_URL
 *       UPSTASH_REDIS_REST_TOKEN
 */

import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

// ── Singleton Redis client ────────────────────────────────────────────────────

let _redis: Redis | null | undefined = undefined; // undefined = not yet initialised

export function getRedisClient(): Redis | null {
  if (_redis !== undefined) return _redis;
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  _redis = url && token ? new Redis({ url, token }) : null;
  return _redis;
}

// ── Per-route rate limiter cache ──────────────────────────────────────────────

const _limiters = new Map<string, Ratelimit>();

/**
 * Returns an Upstash sliding-window rate limiter for the given route + rpm.
 * Returns null if Redis is not configured (caller falls back to in-memory).
 */
export function getDistributedLimiter(
  routeKey: string,
  rpm: number
): Ratelimit | null {
  const redis = getRedisClient();
  if (!redis) return null;

  const cacheKey = `${routeKey}:${rpm}`;
  if (!_limiters.has(cacheKey)) {
    _limiters.set(
      cacheKey,
      new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(rpm, "60 s"),
        analytics: false,
        prefix: `sakura:rl:${routeKey.replace(/\//g, ":")}`,
      })
    );
  }
  return _limiters.get(cacheKey)!;
}

// General (per-IP) limiter — separate instance for clean key namespace
let _generalLimiter: Ratelimit | null | undefined = undefined;

export function getGeneralLimiter(rpm: number): Ratelimit | null {
  if (_generalLimiter !== undefined) return _generalLimiter;
  const redis = getRedisClient();
  if (!redis) { _generalLimiter = null; return null; }
  _generalLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(rpm, "60 s"),
    analytics: false,
    prefix: "sakura:rl:general",
  });
  return _generalLimiter;
}

// ── Per-wallet hourly rate limiter (Sybil defense for AI compute routes) ────────
//
// IP-based rate limits alone cannot stop Sybil attacks where an attacker
// rotates through many IP addresses while targeting expensive AI/RPC endpoints.
// Per-wallet limits add a second axis: even with unlimited IPs, the same wallet
// address is throttled across all Vercel instances.
//
// Redis mode: `sakura:rl:wallet:<routeKey>:<wallet>` key in Upstash.
// Fallback: in-memory Map (per-instance, dev / single-instance).

const _walletLimiters  = new Map<string, Ratelimit>();
const _walletWindows   = new Map<string, number[]>(); // in-memory fallback

/**
 * Returns a per-wallet sliding-window rate limiter with a 1-hour window.
 * Returns null if Redis is not configured (caller falls back to in-memory).
 */
export function getWalletLimiter(
  routeKey: string,
  requestsPerHour: number
): Ratelimit | null {
  const redis = getRedisClient();
  if (!redis) return null;

  const cacheKey = `${routeKey}:rph${requestsPerHour}`;
  if (!_walletLimiters.has(cacheKey)) {
    _walletLimiters.set(
      cacheKey,
      new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(requestsPerHour, "1 h"),
        analytics: false,
        prefix: `sakura:rl:wallet:${routeKey.replace(/\//g, ":")}`,
      })
    );
  }
  return _walletLimiters.get(cacheKey)!;
}

/**
 * In-memory fallback for per-wallet hourly rate limiting.
 * Used when Redis is not configured (dev / single-instance).
 */
export function checkWalletLimitMemory(
  routeKey: string,
  wallet: string,
  requestsPerHour: number
): { blocked: boolean; retryAfter?: number } {
  // [SECURITY FIX L-3] Lazy GC: purge stale entries every 10 minutes
  // to prevent unbounded _walletWindows growth in long-running dev servers.
  _maybeCleanupWalletWindows();

  const windowKey   = `${routeKey}:${wallet}`;
  const now         = Date.now();
  const windowStart = now - 3_600_000; // 1 hour

  const ts = (_walletWindows.get(windowKey) ?? []).filter(t => t > windowStart);
  ts.push(now);
  _walletWindows.set(windowKey, ts);

  if (ts.length > requestsPerHour) {
    const oldest = ts[0];
    const retryAfter = Math.max(1, Math.ceil((oldest + 3_600_000 - now) / 1000));
    return { blocked: true, retryAfter };
  }
  return { blocked: false };
}

let _lastWalletCleanup = Date.now();
function _maybeCleanupWalletWindows() {
  const now = Date.now();
  if (now - _lastWalletCleanup < 600_000) return; // run at most every 10 minutes
  _lastWalletCleanup = now;
  const gc = now - 3_600_000; // discard timestamps older than 1 hour
  for (const [k, ts] of _walletWindows) {
    const f = ts.filter(t => t > gc);
    f.length ? _walletWindows.set(k, f) : _walletWindows.delete(k);
  }
}

// ── Replay-protection helper ──────────────────────────────────────────────────

/**
 * Redis SETNX replay guard.
 *
 * Returns true  → first time this key is seen (allowed).
 * Returns false → key already exists (replay detected).
 *
 * If Redis is not configured, falls back to the provided in-memory Set.
 * TTL defaults to 24 h (sufficient for payment txSig replay window).
 */
export async function checkAndMarkUsed(
  key: string,
  fallbackSet: Set<string>,
  ttlSeconds = 86_400
): Promise<boolean> {
  const redis = getRedisClient();
  if (redis) {
    try {
      // SET key "1" NX EX ttl → "OK" if newly set, null if already present
      const result = await redis.set(key, "1", { nx: true, ex: ttlSeconds });
      return result === "OK";
    } catch {
      // Redis temporarily unreachable → degrade to in-memory
    }
  }
  // In-memory fallback
  if (fallbackSet.has(key)) return false;
  fallbackSet.add(key);
  return true;
}

// Usage tracking (Feature/trackUsage/getUsageStats) removed in L2 cleanup —
// those were v0.1 per-feature counters for nonce/ghost/shield, deleted along
// with the corresponding routes. v0.3 usage metrics, if/when needed, will be
// derived from on-chain IntentProtocol state (total_intents_signed,
// total_actions_executed) rather than Redis.
