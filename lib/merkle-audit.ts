/**
 * Merkle Audit Tree — Stateless operation aggregation
 *
 * Every Sakura operation (Ghost Run, Liquidation Shield rescue, Nonce Guardian scan)
 * becomes a leaf in a binary Merkle tree. The root is periodically anchored on-chain
 * via Solana Memo. Anyone can verify any individual operation by requesting its
 * Merkle proof path and checking against the on-chain root.
 *
 * Architecture:
 *   leaf = SHA-256("SAKURA_LEAF|" + operationType + "|" + operationHash + "|" + timestamp)
 *   internal_node = SHA-256(left_child + "|" + right_child)
 *   root = top of the tree
 *
 * This gives O(log n) verification for any single operation.
 */

import { sha256 } from "./crypto-proof";
import { persistLeaf, persistAnchor, loadMerkleState, type MerkleAnchorRecord } from "./merkle-persistence";

export interface MerkleLeaf {
  index: number;
  operationType: "ghost_run" | "rescue" | "nonce_scan";
  operationHash: string;  // the hash of the operation (e.g., chainProof from rescue)
  timestamp: string;
  leafHash: string;
}

export interface MerkleProof {
  leaf: MerkleLeaf;
  siblings: Array<{ hash: string; position: "left" | "right" }>;
  root: string;
}

/**
 * Compute a leaf hash from operation data.
 */
export function computeLeafHash(
  operationType: string,
  operationHash: string,
  timestamp: string,
): string {
  return sha256(`SAKURA_LEAF|${operationType}|${operationHash}|${timestamp}`);
}

/**
 * Compute an internal node from two children.
 * Convention: always hash as SHA-256(left + "|" + right) for determinism.
 */
export function computeNodeHash(left: string, right: string): string {
  return sha256(`${left}|${right}`);
}

/**
 * In-memory Merkle tree that accumulates operations.
 * In production, this would be backed by a database.
 */
class MerkleAuditTree {
  private leaves: MerkleLeaf[] = [];
  private roots: Array<{ root: string; leafCount: number; anchoredAt?: string }> = [];

  /**
   * Add an operation to the tree.
   * Returns the new leaf and current root.
   */
  addOperation(
    operationType: "ghost_run" | "rescue" | "nonce_scan",
    operationHash: string,
    timestamp: string = new Date().toISOString(),
  ): { leaf: MerkleLeaf; root: string; treeSize: number } {
    const leafHash = computeLeafHash(operationType, operationHash, timestamp);
    const leaf: MerkleLeaf = {
      index: this.leaves.length,
      operationType,
      operationHash,
      timestamp,
      leafHash,
    };
    this.leaves.push(leaf);
    const root = this.computeRoot();
    // Fire-and-forget persistence — survives Vercel cold starts.
    // No await: we want addOperation() to stay synchronous for hot paths.
    void persistLeaf(leaf);
    return { leaf, root, treeSize: this.leaves.length };
  }

  /**
   * Rehydrate tree from persistent storage (Upstash Redis).
   * Call once at server startup; safely degrades to empty tree if Redis not configured.
   * Idempotent-ish: overwrites current in-memory state with persisted state.
   */
  async hydrateFromPersistence(): Promise<{ leafCount: number; anchorCount: number }> {
    const { leaves, anchors } = await loadMerkleState();
    if (leaves.length > 0) this.leaves = leaves;
    if (anchors.length > 0) {
      this.roots = anchors.map(a => ({
        root: a.root,
        leafCount: a.leafCount,
        anchoredAt: a.anchoredAt,
      }));
    }
    return { leafCount: this.leaves.length, anchorCount: this.roots.length };
  }

  /**
   * Compute the Merkle root from all current leaves.
   * Uses a standard binary tree construction with padding for non-power-of-2 sizes.
   */
  computeRoot(): string {
    if (this.leaves.length === 0) return sha256("SAKURA_EMPTY_TREE");

    let level = this.leaves.map(l => l.leafHash);

    while (level.length > 1) {
      const next: string[] = [];
      for (let i = 0; i < level.length; i += 2) {
        if (i + 1 < level.length) {
          next.push(computeNodeHash(level[i], level[i + 1]));
        } else {
          // Odd leaf: hash with itself (standard padding)
          next.push(computeNodeHash(level[i], level[i]));
        }
      }
      level = next;
    }

    return level[0];
  }

  /**
   * Generate a Merkle proof for a specific leaf.
   * The proof is a list of sibling hashes with their position (left/right).
   */
  getProof(leafIndex: number): MerkleProof | null {
    if (leafIndex < 0 || leafIndex >= this.leaves.length) return null;

    const siblings: Array<{ hash: string; position: "left" | "right" }> = [];
    let level = this.leaves.map(l => l.leafHash);
    let idx = leafIndex;

    while (level.length > 1) {
      const next: string[] = [];
      for (let i = 0; i < level.length; i += 2) {
        if (i + 1 < level.length) {
          next.push(computeNodeHash(level[i], level[i + 1]));
          if (i === idx || i + 1 === idx) {
            // Record sibling
            if (idx % 2 === 0) {
              siblings.push({ hash: level[i + 1], position: "right" });
            } else {
              siblings.push({ hash: level[i], position: "left" });
            }
          }
        } else {
          next.push(computeNodeHash(level[i], level[i]));
          if (i === idx) {
            siblings.push({ hash: level[i], position: "right" });
          }
        }
      }
      level = next;
      idx = Math.floor(idx / 2);
    }

    return {
      leaf: this.leaves[leafIndex],
      siblings,
      root: level[0],
    };
  }

  /**
   * Record that the current root has been anchored on-chain.
   */
  recordAnchor(memoSig: string): void {
    const root = this.computeRoot();
    const leafCount = this.leaves.length;
    this.roots.push({ root, leafCount, anchoredAt: memoSig });
    const record: MerkleAnchorRecord = {
      root,
      leafCount,
      anchoredAt: memoSig,
      ts: new Date().toISOString(),
    };
    void persistAnchor(record);
  }

  /**
   * Get tree statistics.
   */
  getStats(): {
    totalLeaves: number;
    currentRoot: string;
    anchors: Array<{ root: string; leafCount: number; anchoredAt?: string }>;
    treeDepth: number;
  } {
    const totalLeaves = this.leaves.length;
    return {
      totalLeaves,
      currentRoot: this.computeRoot(),
      anchors: [...this.roots],
      treeDepth: totalLeaves > 0 ? Math.ceil(Math.log2(totalLeaves)) : 0,
    };
  }

  /**
   * Get all leaves (for debugging/display).
   */
  getLeaves(): MerkleLeaf[] {
    return [...this.leaves];
  }
}

/**
 * Verify a Merkle proof independently.
 * Given a leaf hash and the sibling path, recompute the root
 * and check if it matches the expected root.
 */
export function verifyMerkleProof(proof: MerkleProof): boolean {
  let currentHash = proof.leaf.leafHash;

  for (const sibling of proof.siblings) {
    if (sibling.position === "left") {
      currentHash = computeNodeHash(sibling.hash, currentHash);
    } else {
      currentHash = computeNodeHash(currentHash, sibling.hash);
    }
  }

  return currentHash === proof.root;
}

/**
 * Verify a leaf hash by recomputing from its components.
 */
export function verifyLeafHash(leaf: MerkleLeaf): boolean {
  const recomputed = computeLeafHash(leaf.operationType, leaf.operationHash, leaf.timestamp);
  return recomputed === leaf.leafHash;
}

// ── Singleton instance ───────────────────────────────────────────
// Shared across the server process. In production, back with Redis/DB.
export const auditTree = new MerkleAuditTree();

export default MerkleAuditTree;
