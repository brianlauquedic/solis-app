/**
 * Unified Verification API — One endpoint to verify all Sakura cryptographic proofs.
 *
 * POST /api/verify
 * Body: { mode, ...params }
 *
 * Modes:
 *   "hash_chain"     — Verify SHA-256 rescue hash chain (3 hashes)
 *   "single_hash"    — Verify any single SHA-256 hash
 *   "dual_hash"      — Verify SHA-256 + Poseidon dual-hash record
 *   "merkle_proof"   — Verify Merkle inclusion proof
 *   "zk_rescue"      — Verify ZK commitment proof for rescue operation
 *   "zk_ghost_run"   — Verify ZK commitment proof for Ghost Run
 *   "commitment"     — Verify a commitment preimage
 *   "nullifier"      — Verify a nullifier derivation
 *   "full_rescue"    — Verify ALL layers of a rescue operation at once
 */

import { NextRequest, NextResponse } from "next/server";
import {
  verifyRescueHashChain, verifyHash, sha256,
  verifyCommitment, verifyNullifier,
} from "@/lib/crypto-proof";
import { verifyDualHash } from "@/lib/dual-hash";
import { verifyMerkleProof, verifyLeafHash } from "@/lib/merkle-audit";
import type { MerkleProof } from "@/lib/merkle-audit";
import { verifyRescueProof, verifyGhostRunProof, generateVerificationKey } from "@/lib/groth16-verify";
import type { Groth16Proof, PublicSignals } from "@/lib/groth16-verify";

export async function POST(req: NextRequest) {
  let body: Record<string, any> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const mode = body.mode as string;
  if (!mode) {
    return NextResponse.json({
      error: "Missing 'mode' field",
      availableModes: [
        "hash_chain", "single_hash", "dual_hash", "merkle_proof",
        "zk_rescue", "zk_ghost_run", "commitment", "nullifier", "full_rescue",
      ],
    }, { status: 400 });
  }

  try {
    switch (mode) {
      // ── Mode 1: SHA-256 rescue hash chain ──────────────────────
      case "hash_chain": {
        const { mandateInput, mandateHash, executionInput, executionHash, chainInput, chainProof } = body;
        if (!mandateInput || !mandateHash || !executionInput || !executionHash || !chainInput || !chainProof) {
          return NextResponse.json({ error: "hash_chain requires: mandateInput, mandateHash, executionInput, executionHash, chainInput, chainProof" }, { status: 400 });
        }
        const result = verifyRescueHashChain(mandateInput, mandateHash, executionInput, executionHash, chainInput, chainProof);
        return NextResponse.json({
          mode: "hash_chain",
          verified: result.allValid,
          details: {
            mandateValid: result.mandateValid,
            executionValid: result.executionValid,
            chainProofValid: result.chainProofValid,
          },
        });
      }

      // ── Mode 2: Single SHA-256 hash ────────────────────────────
      case "single_hash": {
        const { input, expectedHash } = body;
        if (!input || !expectedHash) {
          return NextResponse.json({ error: "single_hash requires: input, expectedHash" }, { status: 400 });
        }
        const recomputed = sha256(input);
        return NextResponse.json({
          mode: "single_hash",
          verified: recomputed === expectedHash,
          recomputed,
          expected: expectedHash,
        });
      }

      // ── Mode 3: Dual-hash (SHA-256 + Poseidon) ────────────────
      case "dual_hash": {
        const { canonicalInput, operationType, expectedSha256, expectedPoseidon } = body;
        if (!canonicalInput || !operationType || !expectedSha256 || !expectedPoseidon) {
          return NextResponse.json({ error: "dual_hash requires: canonicalInput, operationType, expectedSha256, expectedPoseidon" }, { status: 400 });
        }
        const result = verifyDualHash(canonicalInput, operationType, expectedSha256, expectedPoseidon);
        return NextResponse.json({
          mode: "dual_hash",
          verified: result.bothValid,
          details: {
            sha256Valid: result.sha256Valid,
            poseidonValid: result.poseidonValid,
          },
        });
      }

      // ── Mode 4: Merkle inclusion proof ─────────────────────────
      case "merkle_proof": {
        const { proof } = body as { proof?: MerkleProof };
        if (!proof || !proof.leaf || !proof.siblings || !proof.root) {
          return NextResponse.json({ error: "merkle_proof requires: proof (with leaf, siblings, root)" }, { status: 400 });
        }
        const leafValid = verifyLeafHash(proof.leaf);
        const proofValid = verifyMerkleProof(proof);
        return NextResponse.json({
          mode: "merkle_proof",
          verified: leafValid && proofValid,
          details: {
            leafHashValid: leafValid,
            merklePathValid: proofValid,
            root: proof.root,
            leafIndex: proof.leaf.index,
            treeDepth: proof.siblings.length,
          },
        });
      }

      // ── Mode 5: ZK commitment proof (rescue) ──────────────────
      case "zk_rescue": {
        const { proof, publicSignals } = body as { proof?: Groth16Proof; publicSignals?: PublicSignals };
        if (!proof || !publicSignals) {
          return NextResponse.json({ error: "zk_rescue requires: proof, publicSignals" }, { status: 400 });
        }
        const verified = verifyRescueProof(proof, publicSignals);
        const vk = generateVerificationKey();
        return NextResponse.json({
          mode: "zk_rescue",
          verified,
          // HONESTY DISCLAIMER: This system uses a Poseidon-over-BN254 commitment
          // proof with Groth16-shaped structure for future snarkjs compatibility.
          // It is NOT a real Groth16 pairing check. See README.md "Cryptographic
          // claims — honest disclosure" section for full details.
          proofSystem: "Poseidon commitment proof (BN254) with Groth16-shaped structure",
          disclaimer: "Not a pairing-verified Groth16 proof — commitment-style proof only. See README.md for details.",
          publicSignals: {
            commitmentHash: publicSignals.commitmentHash,
            nullifier: publicSignals.nullifier,
            maxAmount: publicSignals.maxAmount,
            triggerThreshold: publicSignals.triggerThreshold,
          },
          verificationKey: {
            nPublic: vk.nPublic,
            circuit: "sakura_rescue_v1",
          },
        });
      }

      // ── Mode 6: ZK commitment proof (Ghost Run) ───────────────
      case "zk_ghost_run": {
        const { proof, publicSignals } = body as {
          proof?: Groth16Proof;
          publicSignals?: { strategyHash: string; resultHash: string };
        };
        if (!proof || !publicSignals) {
          return NextResponse.json({ error: "zk_ghost_run requires: proof, publicSignals" }, { status: 400 });
        }
        const verified = verifyGhostRunProof(proof, publicSignals);
        return NextResponse.json({
          mode: "zk_ghost_run",
          verified,
          proofSystem: "Poseidon commitment proof (BN254) with Groth16-shaped structure",
          disclaimer: "Not a pairing-verified Groth16 proof — commitment-style proof only. See README.md for details.",
        });
      }

      // ── Mode 7: Commitment preimage ────────────────────────────
      case "commitment": {
        const { preimage, expectedCommitment } = body;
        if (!preimage || !expectedCommitment) {
          return NextResponse.json({ error: "commitment requires: preimage, expectedCommitment" }, { status: 400 });
        }
        const verified = verifyCommitment(preimage, expectedCommitment);
        return NextResponse.json({
          mode: "commitment",
          verified,
          recomputed: sha256(preimage),
          expected: expectedCommitment,
        });
      }

      // ── Mode 8: Nullifier derivation ───────────────────────────
      case "nullifier": {
        const { commitment, walletAddress, expectedNullifier } = body;
        if (!commitment || !walletAddress || !expectedNullifier) {
          return NextResponse.json({ error: "nullifier requires: commitment, walletAddress, expectedNullifier" }, { status: 400 });
        }
        const verified = verifyNullifier(commitment, walletAddress, expectedNullifier);
        return NextResponse.json({
          mode: "nullifier",
          verified,
        });
      }

      // ── Mode 9: Full rescue verification (all layers) ─────────
      case "full_rescue": {
        const results: Record<string, any> = {};
        let allValid = true;

        // Layer 1: Hash chain
        if (body.mandateInput && body.mandateHash) {
          const hc = verifyRescueHashChain(
            body.mandateInput, body.mandateHash,
            body.executionInput, body.executionHash,
            body.chainInput, body.chainProof,
          );
          results.hashChain = { verified: hc.allValid, details: hc };
          if (!hc.allValid) allValid = false;
        }

        // Layer 2: Dual-hash
        if (body.canonicalInput && body.expectedSha256 && body.expectedPoseidon) {
          const dh = verifyDualHash(body.canonicalInput, "rescue", body.expectedSha256, body.expectedPoseidon);
          results.dualHash = { verified: dh.bothValid, details: dh };
          if (!dh.bothValid) allValid = false;
        }

        // Layer 3: Merkle proof
        if (body.merkleProof) {
          const lv = verifyLeafHash(body.merkleProof.leaf);
          const mv = verifyMerkleProof(body.merkleProof);
          results.merkle = { verified: lv && mv, leafValid: lv, proofValid: mv };
          if (!(lv && mv)) allValid = false;
        }

        // Layer 4: ZK proof
        if (body.zkProof && body.zkPublicSignals) {
          const zv = verifyRescueProof(body.zkProof, body.zkPublicSignals);
          results.zkProof = { verified: zv };
          if (!zv) allValid = false;
        }

        // Layer 5: Commitment
        if (body.preimage && body.expectedCommitment) {
          const cv = verifyCommitment(body.preimage, body.expectedCommitment);
          results.commitment = { verified: cv };
          if (!cv) allValid = false;
        }

        return NextResponse.json({
          mode: "full_rescue",
          allVerified: allValid,
          layers: results,
          layerCount: Object.keys(results).length,
        });
      }

      default:
        return NextResponse.json({
          error: `Unknown mode: ${mode}`,
          availableModes: [
            "hash_chain", "single_hash", "dual_hash", "merkle_proof",
            "zk_rescue", "zk_ghost_run", "commitment", "nullifier", "full_rescue",
          ],
        }, { status: 400 });
    }
  } catch (err) {
    // [SECURITY FIX H-1] Never expose raw error details to client
    console.error("[verify] error:", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "Verification error", verified: false }, { status: 500 });
  }
}

// GET: return available verification modes and verification key
export async function GET() {
  const vk = generateVerificationKey();
  return NextResponse.json({
    service: "Sakura Unified Cryptographic Verifier",
    version: 2,
    availableModes: [
      { mode: "hash_chain", description: "Verify SHA-256 rescue hash chain (mandate → execution → chain_proof)" },
      { mode: "single_hash", description: "Verify any single SHA-256 hash from canonical input" },
      { mode: "dual_hash", description: "Verify SHA-256 + Poseidon dual-hash" },
      { mode: "merkle_proof", description: "Verify Merkle inclusion proof (stateless batch aggregation)" },
      { mode: "zk_rescue", description: "Verify Poseidon commitment proof for rescue operation" },
      { mode: "zk_ghost_run", description: "Verify Poseidon commitment proof for Ghost Run simulation" },
      { mode: "commitment", description: "Verify commitment preimage" },
      { mode: "nullifier", description: "Verify nullifier derivation from commitment + wallet" },
      { mode: "full_rescue", description: "Verify ALL cryptographic layers of a rescue operation at once" },
    ],
    verificationKey: {
      nPublic: vk.nPublic,
      circuit: "sakura_rescue_v1",
    },
    cryptographicStack: {
      hashFunctions: ["SHA-256 (universal)", "Poseidon over BN254 (ZK-friendly)"],
      // HONEST LABELING — do NOT claim "Groth16" without pairing verification.
      proofSystem: "Poseidon commitment proof over BN254 (Groth16-shaped structure for future snarkjs compatibility)",
      auditTrail: "Binary Merkle Tree with O(log n) inclusion proofs",
      antiReplay: "Cumulative tracking with monotonic index",
      techniques: [
        "Stateless Merkle aggregation",
        "Dual-hash architecture (SHA-256 + Poseidon)",
        "Poseidon commitment proofs over BN254",
      ],
      honestyDisclaimer:
        "Proof objects use Groth16-shaped A/B/C fields so a future real Groth16 " +
        "circuit can be dropped in without changing the verifier API surface. " +
        "Current implementation is a Poseidon commitment proof — NOT a pairing-verified " +
        "Groth16 proof. The on-chain Memo + hash chain is what provides verifiable audit " +
        "today. See README.md section 'Cryptographic claims' for the full breakdown.",
    },
  });
}
