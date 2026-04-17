/**
 * Merkle Audit Tree — Persistence Layer
 *
 * Solves the Vercel cold-start problem: `MerkleAuditTree` in `merkle-audit.ts`
 * holds leaves in-process memory, so Vercel's ephemeral Lambda / Fluid Compute
 * workers lose the tree on cold start. This layer persists leaves + anchors to
 * Upstash Redis (or degrades to memory-only when Redis is not configured).
 *
 * Schema:
 *   sakura:merkle:leaves   → Redis LIST of JSON-serialized MerkleLeaf entries
 *   sakura:merkle:anchors  → Redis LIST of JSON-serialized anchor records
 *
 * API:
 *   loadMerkleState()       — rehydrate tree from Redis at startup
 *   persistLeaf(leaf)       — append one leaf (fire-and-forget)
 *   persistAnchor(record)   — append one anchor record
 *
 * Degradation: if Redis env vars are missing, all functions no-op silently
 * (tree remains in-memory only). No hard dependency on Redis.
 */

import { getRedisClient } from "./redis";
import type { MerkleLeaf } from "./merkle-audit";

const KEY_LEAVES  = "sakura:merkle:leaves";
const KEY_ANCHORS = "sakura:merkle:anchors";

export interface MerkleAnchorRecord {
  root: string;
  leafCount: number;
  anchoredAt?: string; // Memo tx signature
  ts: string;          // ISO timestamp
}

/**
 * Load all persisted leaves + anchors from Redis.
 * Returns empty arrays if Redis is not configured or the keys don't exist.
 * Safe to call at module import time — never throws.
 */
export async function loadMerkleState(): Promise<{
  leaves: MerkleLeaf[];
  anchors: MerkleAnchorRecord[];
}> {
  const redis = getRedisClient();
  if (!redis) return { leaves: [], anchors: [] };

  try {
    const [rawLeaves, rawAnchors] = await Promise.all([
      redis.lrange(KEY_LEAVES,  0, -1),
      redis.lrange(KEY_ANCHORS, 0, -1),
    ]);

    const parse = <T>(s: unknown): T | null => {
      try {
        if (typeof s === "string") return JSON.parse(s) as T;
        // Upstash sometimes returns already-parsed objects
        if (typeof s === "object" && s !== null) return s as T;
        return null;
      } catch { return null; }
    };

    const leaves  = (rawLeaves  as unknown[]).map(x => parse<MerkleLeaf>(x)).filter((x): x is MerkleLeaf => !!x);
    const anchors = (rawAnchors as unknown[]).map(x => parse<MerkleAnchorRecord>(x)).filter((x): x is MerkleAnchorRecord => !!x);
    return { leaves, anchors };
  } catch (err) {
    console.error("[merkle-persistence] load error:", err);
    return { leaves: [], anchors: [] };
  }
}

/**
 * Append one leaf to persistent storage. Fire-and-forget.
 * Never throws — failure is logged and swallowed.
 */
export async function persistLeaf(leaf: MerkleLeaf): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;
  try {
    await redis.rpush(KEY_LEAVES, JSON.stringify(leaf));
  } catch (err) {
    console.error("[merkle-persistence] persistLeaf error:", err);
  }
}

/**
 * Append one anchor record to persistent storage. Fire-and-forget.
 */
export async function persistAnchor(record: MerkleAnchorRecord): Promise<void> {
  const redis = getRedisClient();
  if (!redis) return;
  try {
    await redis.rpush(KEY_ANCHORS, JSON.stringify(record));
  } catch (err) {
    console.error("[merkle-persistence] persistAnchor error:", err);
  }
}

/**
 * Clear all persisted Merkle state. Admin / test utility.
 * Guard-railed: requires explicit `confirm: true` argument.
 */
export async function clearMerkleState(confirm: { confirm: true }): Promise<void> {
  if (!confirm?.confirm) throw new Error("clearMerkleState requires {confirm: true}");
  const redis = getRedisClient();
  if (!redis) return;
  try {
    await Promise.all([redis.del(KEY_LEAVES), redis.del(KEY_ANCHORS)]);
  } catch (err) {
    console.error("[merkle-persistence] clear error:", err);
  }
}
