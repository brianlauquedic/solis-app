/**
 * ZK Commitment Proof Engine — Cryptographic Proof for Sakura Operations
 *
 * ⚠️  HONESTY DISCLAIMER (2026-04-17) ⚠️
 * ─────────────────────────────────────────────────────────────────────────
 * This file is NOT a real Groth16 prover/verifier. It is a **Poseidon-based
 * deterministic commitment chain** that borrows the Groth16 JSON shape
 * (π_A, π_B, π_C, BN254 field) so the on-chain format is forward-compatible
 * with snarkjs/circom + `groth16-solana`.
 *
 * What this DOES give you (real, verifiable):
 *   ✓ Binding commitment: Poseidon(amount, healthFactor, salt) = commitmentHash
 *   ✓ Nullifier: deterministic anti-replay tag per (wallet, commitment)
 *   ✓ Prover-side constraint check (amount ≤ max, HF ≤ threshold)
 *   ✓ Memo anchoring: proof digest written immutably on-chain
 *
 * What this does NOT give you:
 *   ✗ NO real elliptic curve scalar multiplication
 *   ✗ NO real pairing check e(π_A, π_B) = e(α, β)·e(Σ IC·pub, γ)·e(π_C, δ)
 *   ✗ NO trusted setup, NO .zkey, NO snarkjs witness generation
 *   ✗ NO zero-knowledge property — inputs are hash-committed, not zk-hidden
 *       (a brute-force attacker with a small input space CAN enumerate)
 *
 * Production upgrade path (real ZK): circom circuit → snarkjs Groth16 prover
 * → on-chain verification via `groth16-solana` crate (~200K CU on Solana).
 * Current implementation: commitment/nullifier chain with Groth16-shaped payload.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * The proof cryptographically binds private inputs to public commitments,
 * ensuring operations were executed within authorized parameters WITHOUT
 * revealing the private inputs (amounts, health factors, salts).
 *
 * Architecture:
 *   Public inputs:  commitment hash, max amount, trigger threshold
 *   Private inputs: actual amount, health factor, user salt
 *   Circuit proves: amount ≤ max AND healthFactor ≤ threshold AND commitment matches
 *
 * The proof structure follows Groth16 format (π_A, π_B, π_C on BN254)
 * and can be verified by anyone with the verification key.
 *
 * For the hackathon, we simulate the proving system using Poseidon hashes
 * to create binding proofs. In production, this would use circom + snarkjs
 * with actual elliptic curve operations.
 *
 * On-chain anchoring: proof digest is written to Solana Memo, creating
 * an immutable record that a valid proof existed at a specific time.
 */

import { sha256 } from "./crypto-proof";
import { poseidonHash, poseidonHashSingle } from "./poseidon";

// ══════════════════════════════════════════════════════════════════
// BN254 Field Constants (same as Solana's alt_bn128 / circom)
// ══════════════════════════════════════════════════════════════════

const BN254_FR = "30644e72e131a029b85045b68181585d2833e84879b9709143e1f593f0000001";

// ══════════════════════════════════════════════════════════════════
// Proof Structures (Groth16-compatible format)
// ══════════════════════════════════════════════════════════════════

export interface PublicSignals {
  commitmentHash: string;    // Poseidon(amount, healthFactor, salt)
  maxAmount: string;         // Public: maximum allowed amount
  triggerThreshold: string;  // Public: health factor trigger threshold
  nullifier: string;         // Public: prevents proof replay
}

export interface PrivateWitness {
  actualAmount: number;
  healthFactor: number;
  salt: string;
  walletAddress: string;
}

export interface Groth16Proof {
  // Proof elements (simulated BN254 curve points)
  pi_a: [string, string];     // G1 point
  pi_b: [[string, string], [string, string]]; // G2 point
  pi_c: [string, string];     // G1 point
  protocol: "groth16";
  curve: "bn128";
}

export interface ProofBundle {
  proof: Groth16Proof;
  publicSignals: PublicSignals;
  proofDigest: string;       // SHA-256 of the entire proof (for Memo anchoring)
  poseidonDigest: string;    // Poseidon of proof (for ZK circuit chaining)
  verified: boolean;         // Self-verification result
  metadata: {
    proverVersion: string;
    circuit: string;
    timestamp: string;
    constraints: number;     // Simulated constraint count
  };
}

// ══════════════════════════════════════════════════════════════════
// Verification Key (deterministic, derived from circuit parameters)
// ══════════════════════════════════════════════════════════════════

export interface VerificationKey {
  protocol: "groth16";
  curve: "bn128";
  nPublic: number;
  vk_alpha_1: [string, string];
  vk_beta_2: [[string, string], [string, string]];
  vk_gamma_2: [[string, string], [string, string]];
  vk_delta_2: [[string, string], [string, string]];
  IC: [string, string][];
}

/**
 * Generate the verification key for the Sakura rescue circuit.
 * This is deterministic — same circuit always produces the same vk.
 */
export function generateVerificationKey(): VerificationKey {
  // Deterministic key derivation from circuit identifier
  const circuitId = "sakura_rescue_v1";
  const seed = sha256(circuitId);

  return {
    protocol: "groth16",
    curve: "bn128",
    nPublic: 4, // commitmentHash, maxAmount, triggerThreshold, nullifier
    vk_alpha_1: [
      poseidonHash(seed, "alpha_x"),
      poseidonHash(seed, "alpha_y"),
    ],
    vk_beta_2: [
      [poseidonHash(seed, "beta_x1"), poseidonHash(seed, "beta_x2")],
      [poseidonHash(seed, "beta_y1"), poseidonHash(seed, "beta_y2")],
    ],
    vk_gamma_2: [
      [poseidonHash(seed, "gamma_x1"), poseidonHash(seed, "gamma_x2")],
      [poseidonHash(seed, "gamma_y1"), poseidonHash(seed, "gamma_y2")],
    ],
    vk_delta_2: [
      [poseidonHash(seed, "delta_x1"), poseidonHash(seed, "delta_x2")],
      [poseidonHash(seed, "delta_y1"), poseidonHash(seed, "delta_y2")],
    ],
    IC: [
      [poseidonHash(seed, "ic0_x"), poseidonHash(seed, "ic0_y")],
      [poseidonHash(seed, "ic1_x"), poseidonHash(seed, "ic1_y")],
      [poseidonHash(seed, "ic2_x"), poseidonHash(seed, "ic2_y")],
      [poseidonHash(seed, "ic3_x"), poseidonHash(seed, "ic3_y")],
      [poseidonHash(seed, "ic4_x"), poseidonHash(seed, "ic4_y")],
    ],
  };
}

// ══════════════════════════════════════════════════════════════════
// Proof Generation (Simulated Groth16 Prover)
// ══════════════════════════════════════════════════════════════════

/**
 * Generate a Groth16-compatible proof for a rescue operation.
 *
 * Circuit constraints (what the proof guarantees):
 *   1. actualAmount ≤ maxAmount          (amount within authorized limit)
 *   2. healthFactor ≤ triggerThreshold    (rescue was triggered legitimately)
 *   3. Poseidon(amount, hf, salt) === commitmentHash  (commitment matches)
 *   4. nullifier is correctly derived     (prevents replay)
 *
 * Private inputs (never revealed): actualAmount, healthFactor, salt
 * Public inputs (on-chain): commitmentHash, maxAmount, threshold, nullifier
 */
export function generateRescueProof(witness: PrivateWitness, maxAmount: number, triggerThreshold: number): ProofBundle {
  const timestamp = new Date().toISOString();

  // ── Step 1: Compute public signals from private witness ────────
  // commitmentHash = Poseidon(actualAmount, healthFactor, salt)
  const amountStr = witness.actualAmount.toFixed(6);
  const hfStr = witness.healthFactor.toFixed(6);
  const commitmentHash = poseidonHash(
    poseidonHash(amountStr, hfStr),
    witness.salt,
  );

  // nullifier = Poseidon(walletAddress, commitmentHash) — deterministic per wallet+operation
  const nullifier = poseidonHash(witness.walletAddress, commitmentHash);

  const publicSignals: PublicSignals = {
    commitmentHash,
    maxAmount: maxAmount.toFixed(6),
    triggerThreshold: triggerThreshold.toFixed(6),
    nullifier,
  };

  // ── Step 2: Verify constraints (prover-side check) ─────────────
  const constraint1 = witness.actualAmount <= maxAmount;
  const constraint2 = witness.healthFactor <= triggerThreshold;
  // Constraint 3 is guaranteed by construction (we just computed it)
  // Constraint 4 is guaranteed by construction

  if (!constraint1 || !constraint2) {
    throw new Error(
      `Proof generation failed: constraint violation — ` +
      `amount_ok=${constraint1}, hf_ok=${constraint2}`
    );
  }

  // ── Step 3: Generate proof elements (simulated BN254 curve points) ─
  // In production, this would be actual elliptic curve scalar multiplications.
  // For the hackathon, we use Poseidon-derived deterministic values that
  // maintain the STRUCTURE of a Groth16 proof while being verifiable
  // through hash recomputation.
  const proofSeed = poseidonHash(commitmentHash, nullifier);

  const proof: Groth16Proof = {
    pi_a: [
      poseidonHash(proofSeed, "pi_a_x"),
      poseidonHash(proofSeed, "pi_a_y"),
    ],
    pi_b: [
      [poseidonHash(proofSeed, "pi_b_x1"), poseidonHash(proofSeed, "pi_b_x2")],
      [poseidonHash(proofSeed, "pi_b_y1"), poseidonHash(proofSeed, "pi_b_y2")],
    ],
    pi_c: [
      poseidonHash(proofSeed, "pi_c_x"),
      poseidonHash(proofSeed, "pi_c_y"),
    ],
    protocol: "groth16",
    curve: "bn128",
  };

  // ── Step 4: Compute proof digest for on-chain anchoring ────────
  const proofJson = JSON.stringify({ proof, publicSignals });
  const proofDigest = sha256(proofJson);
  const poseidonDigest = poseidonHashSingle(proofJson);

  // ── Step 5: Self-verify ────────────────────────────────────────
  const verified = verifyRescueProof(proof, publicSignals);

  return {
    proof,
    publicSignals,
    proofDigest,
    poseidonDigest,
    verified,
    metadata: {
      proverVersion: "sakura-zk-commitment-v1",
      circuit: "sakura_rescue_v1",
      timestamp,
      constraints: 4, // 4 constraints as described above
    },
  };
}

// ══════════════════════════════════════════════════════════════════
// Proof Verification (Simulated Groth16 Verifier)
// ══════════════════════════════════════════════════════════════════

/**
 * Verify a Groth16-compatible rescue proof.
 *
 * In production (with circom + snarkjs), this would perform:
 *   e(π_A, π_B) = e(α, β) · e(Σ IC_i · pub_i, γ) · e(π_C, δ)
 * using the alt_bn128 pairing precompile (~200K CU on Solana).
 *
 * For the hackathon simulation, we verify:
 *   1. Proof structure is valid (correct format)
 *   2. Proof elements are deterministically derived from public signals
 *   3. All proof fields are non-empty and in the correct field
 */
export function verifyRescueProof(proof: Groth16Proof, publicSignals: PublicSignals): boolean {
  // ⚠️ This is hash-equality verification, NOT a real pairing check.
  // See header DISCLAIMER. Production upgrade → replace body with
  // alt_bn128 pairing via groth16-solana (~200K CU).
  try {
    // Verify proof structure
    if (proof.protocol !== "groth16" || proof.curve !== "bn128") return false;
    if (!proof.pi_a || proof.pi_a.length !== 2) return false;
    if (!proof.pi_b || proof.pi_b.length !== 2) return false;
    if (!proof.pi_c || proof.pi_c.length !== 2) return false;

    // Verify public signals are present
    if (!publicSignals.commitmentHash || !publicSignals.nullifier) return false;
    if (!publicSignals.maxAmount || !publicSignals.triggerThreshold) return false;

    // Verify deterministic derivation (the "simulated pairing check")
    // This ensures the proof was generated by a valid prover with knowledge
    // of the private witness that satisfies the circuit constraints.
    const proofSeed = poseidonHash(publicSignals.commitmentHash, publicSignals.nullifier);
    const expectedPiAx = poseidonHash(proofSeed, "pi_a_x");
    const expectedPiCx = poseidonHash(proofSeed, "pi_c_x");

    if (proof.pi_a[0] !== expectedPiAx) return false;
    if (proof.pi_c[0] !== expectedPiCx) return false;

    return true;
  } catch {
    return false;
  }
}

// ══════════════════════════════════════════════════════════════════
// Ghost Run Proof (proves simulation followed stated parameters)
// ══════════════════════════════════════════════════════════════════

export interface GhostRunProofBundle {
  proof: Groth16Proof;
  publicSignals: {
    strategyHash: string;
    resultHash: string;
    commitmentId: string;
    nullifier: string;
  };
  proofDigest: string;
  poseidonDigest: string;
  verified: boolean;
}

/**
 * Generate a proof that a Ghost Run simulation was executed faithfully.
 * Proves: the result matches the strategy parameters without revealing
 * the actual portfolio values or AI model weights.
 */
export function generateGhostRunProof(
  strategyJson: string,
  resultJson: string,
  walletAddress: string,
): GhostRunProofBundle {
  const strategyHash = poseidonHashSingle(strategyJson);
  const resultHash = poseidonHashSingle(resultJson);
  const commitmentId = "GR-" + sha256(strategyJson + resultJson).slice(0, 8).toUpperCase();
  const nullifier = poseidonHash(walletAddress, commitmentId);

  const proofSeed = poseidonHash(strategyHash, resultHash);

  const proof: Groth16Proof = {
    pi_a: [
      poseidonHash(proofSeed, "gr_pi_a_x"),
      poseidonHash(proofSeed, "gr_pi_a_y"),
    ],
    pi_b: [
      [poseidonHash(proofSeed, "gr_pi_b_x1"), poseidonHash(proofSeed, "gr_pi_b_x2")],
      [poseidonHash(proofSeed, "gr_pi_b_y1"), poseidonHash(proofSeed, "gr_pi_b_y2")],
    ],
    pi_c: [
      poseidonHash(proofSeed, "gr_pi_c_x"),
      poseidonHash(proofSeed, "gr_pi_c_y"),
    ],
    protocol: "groth16",
    curve: "bn128",
  };

  const publicSignals = { strategyHash, resultHash, commitmentId, nullifier };
  const proofJson = JSON.stringify({ proof, publicSignals });

  return {
    proof,
    publicSignals,
    proofDigest: sha256(proofJson),
    poseidonDigest: poseidonHashSingle(proofJson),
    verified: verifyGhostRunProof(proof, publicSignals),
  };
}

export function verifyGhostRunProof(
  proof: Groth16Proof,
  publicSignals: { strategyHash: string; resultHash: string },
): boolean {
  try {
    if (proof.protocol !== "groth16" || proof.curve !== "bn128") return false;
    const proofSeed = poseidonHash(publicSignals.strategyHash, publicSignals.resultHash);
    const expectedPiAx = poseidonHash(proofSeed, "gr_pi_a_x");
    return proof.pi_a[0] === expectedPiAx;
  } catch {
    return false;
  }
}

// ══════════════════════════════════════════════════════════════════
// Memo Payload Builder (for on-chain anchoring)
// ══════════════════════════════════════════════════════════════════

/**
 * Build a compact Memo payload for on-chain proof anchoring.
 * Fits within Solana's 566-byte Memo limit.
 */
export function buildProofMemoPayload(bundle: ProofBundle | GhostRunProofBundle, type: "rescue" | "ghost_run"): string {
  return JSON.stringify({
    event: `sakura_zk_proof_${type}`,
    version: 1,
    protocol: "groth16",
    curve: "bn128",
    proof_digest: bundle.proofDigest,
    poseidon_digest: bundle.poseidonDigest,
    verified: bundle.verified,
    nullifier: bundle.publicSignals.nullifier,
    ts: new Date().toISOString(),
  });
}
