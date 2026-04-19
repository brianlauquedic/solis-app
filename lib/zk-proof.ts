/**
 * lib/zk-proof.ts — Real Groth16 proof generation + verification
 *
 * Replaces the deleted `lib/groth16-verify.ts` which was a Poseidon-hash-
 * equality "ZK" theater. This file uses actual snarkjs against the
 * compiled Circom circuit `circuits/src/liquidation_proof.circom`.
 *
 * Artifacts expected at:
 *   public/zk/liquidation_proof.wasm       (witness generator)
 *   public/zk/liquidation_proof.zkey       (proving key)
 *   public/zk/verification_key.json        (verification key)
 *
 * The on-chain verifier is in `programs/sakura-insurance/src/lib.rs`
 * (function `claim_payout_with_zk_proof`) using the `groth16-solana`
 * crate + Solana's alt_bn128 pairing syscall.
 *
 * Public inputs (order MUST match circuit's `public` list):
 *   [0] policy_commitment       Poseidon(obligation, wallet, nonce)
 *   [1] trigger_hf_bps          e.g. 10500 ⇒ HF < 1.05
 *   [2] rescue_amount_bucket    buckets of 100 USDC
 *   [3] oracle_price_usd_micro  Pyth price (micro-USD)
 *   [4] oracle_slot             Pyth publish slot
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// Re-exported types so call-sites don't need to import snarkjs directly.
export type Groth16Proof = {
  pi_a: [string, string, string];
  pi_b: [[string, string], [string, string], [string, string]];
  pi_c: [string, string, string];
  protocol: "groth16";
  curve: "bn128";
};

export type PublicSignals = string[];

export type LiquidationWitness = {
  // Public
  policyCommitment: bigint;
  triggerHfBps: number;            // e.g. 10500
  rescueAmountBucket: number;      // in buckets of 100 USDC
  oraclePriceUsdMicro: bigint;     // Pyth price scaled to 1e6
  oracleSlot: bigint;
  // Private
  collateralAmount: bigint;
  debtUsdMicro: bigint;
  positionAccountBytes: bigint;    // Kamino obligation pubkey as 31-byte big-int
  userWalletBytes: bigint;         // Solana pubkey as 31-byte big-int
  nonce: bigint;
};

export type ProofBundle = {
  proof: Groth16Proof;
  publicSignals: PublicSignals;
  commitmentHash: string;          // hex, 0x-prefixed (on-chain storage)
};

// ── BN254 byte conversion (for on-chain Groth16 verifier) ─────────────

const BN254_P =
  21888242871839275222246405745257275088696311157297823662689037894645226208583n;

function fieldToBE32(x: bigint): Uint8Array {
  let v = ((x % BN254_P) + BN254_P) % BN254_P;
  const out = new Uint8Array(32);
  for (let i = 31; i >= 0; i--) {
    out[i] = Number(v & 0xffn);
    v >>= 8n;
  }
  return out;
}

/**
 * Convert a snarkjs Groth16 proof into the `(proof_a, proof_b, proof_c)`
 * byte layout expected by the on-chain `groth16-solana` verifier:
 *
 *   proof_a: 64B  (G1 point, BE-encoded x || y; NEGATED per prepared-alpha convention)
 *   proof_b: 128B (G2 point, BE-encoded (x.c1, x.c0, y.c1, y.c0))
 *   proof_c: 64B  (G1 point, BE-encoded x || y)
 *
 * snarkjs stores Fq2 as [c0, c1] but ark-bn254 / groth16-solana expect
 * (c1, c0) — we swap.
 */
export function proofToOnchainBytes(proof: Groth16Proof): {
  proofA: Uint8Array;
  proofB: Uint8Array;
  proofC: Uint8Array;
} {
  const ax = BigInt(proof.pi_a[0]);
  const ay = BigInt(proof.pi_a[1]);
  // Negate A.y (light-protocol groth16-solana convention).
  //
  // The Groth16 identity is  e(A, B) == e(α, β) * e(Σ IC, γ) * e(C, δ).
  // Rearranged into a single pairing product equal to 1, we need to negate
  // ONE of {A, α, Σ, C}. Different implementations choose differently:
  //
  //   arkworks:        negate α inside VK (prepared-alpha), leave A alone
  //   light-protocol:  expect the SUBMITTER to negate A; keep α positive
  //
  // The on-chain groth16-solana crate (light-protocol) follows the second
  // convention — even though `parse-vk-to-rust.js` wraps α via `negateG1`
  // during VK export, the crate internally negates again, so the *net*
  // effect is that callers must provide `-A`. Empirically verified on
  // devnet 2026-04 (program AnszeCRFsBKmT5fBY9WywxGsZZZob8ZPFYqboYXpuYLp):
  // submitting A without negation caused pairing failure at ~116k CU;
  // negating restored successful verification.
  const negAy = (BN254_P - (ay % BN254_P)) % BN254_P;

  const proofA = new Uint8Array(64);
  proofA.set(fieldToBE32(ax), 0);
  proofA.set(fieldToBE32(negAy), 32);

  const proofB = new Uint8Array(128);
  proofB.set(fieldToBE32(BigInt(proof.pi_b[0][1])), 0);
  proofB.set(fieldToBE32(BigInt(proof.pi_b[0][0])), 32);
  proofB.set(fieldToBE32(BigInt(proof.pi_b[1][1])), 64);
  proofB.set(fieldToBE32(BigInt(proof.pi_b[1][0])), 96);

  const cx = BigInt(proof.pi_c[0]);
  const cy = BigInt(proof.pi_c[1]);
  const proofC = new Uint8Array(64);
  proofC.set(fieldToBE32(cx), 0);
  proofC.set(fieldToBE32(cy), 32);

  return { proofA, proofB, proofC };
}

// ── Poseidon commitment (client-side; matches circuit) ───────────────

/**
 * Compute Poseidon(position_account, user_wallet, nonce).
 * Uses circomlibjs. Must match the Poseidon template in the circuit.
 * Returns a decimal string for snarkjs + a hex string for on-chain storage.
 */
export async function computePolicyCommitment(
  positionAccountBytes: bigint,
  userWalletBytes: bigint,
  nonce: bigint
): Promise<{ decimal: string; bytesBE32: Uint8Array; hex: string }> {
  // Dynamic import — circomlibjs is a heavy module, only load when called.
  const { buildPoseidon } = await import("circomlibjs");
  const poseidon = await buildPoseidon();
  const hash = poseidon([positionAccountBytes, userWalletBytes, nonce]);
  const decimal = poseidon.F.toString(hash);
  const bytesBE32 = fieldToBE32(BigInt(decimal));
  const hex = "0x" + Buffer.from(bytesBE32).toString("hex");
  return { decimal, bytesBE32, hex };
}

// ── Proof generation (browser or server) ─────────────────────────────

/**
 * Generate a Groth16 proof for the liquidation eligibility circuit.
 *
 * Runs in both browser and Node. In the browser, artifacts are fetched
 * from `/zk/liquidation_proof.wasm` + `/zk/liquidation_proof.zkey`. In
 * Node, pass absolute paths via `artifactBase`.
 */
export async function generateLiquidationProof(
  witness: LiquidationWitness,
  opts: { artifactBase?: string } = {}
): Promise<ProofBundle> {
  const snarkjs = await import("snarkjs");

  // Resolve artifact base in a cwd-safe way. `./public/zk` breaks on Vercel
  // Fluid Compute when the function's working directory is the lambda root
  // (/var/task) — relative paths can miss the traced includes. Use
  // process.cwd() so we always resolve from the project root.
  let base: string;
  if (opts.artifactBase) {
    base = opts.artifactBase;
  } else if (typeof window !== "undefined") {
    base = "/zk";
  } else {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodePath = require("path");
    base = nodePath.join(process.cwd(), "public", "zk");
  }

  const input = {
    policy_commitment: witness.policyCommitment.toString(),
    trigger_hf_bps: witness.triggerHfBps.toString(),
    rescue_amount_bucket: witness.rescueAmountBucket.toString(),
    oracle_price_usd_micro: witness.oraclePriceUsdMicro.toString(),
    oracle_slot: witness.oracleSlot.toString(),
    collateral_amount: witness.collateralAmount.toString(),
    debt_usd_micro: witness.debtUsdMicro.toString(),
    position_account_bytes: witness.positionAccountBytes.toString(),
    user_wallet_bytes: witness.userWalletBytes.toString(),
    nonce: witness.nonce.toString(),
  };

  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    input,
    `${base}/liquidation_proof.wasm`,
    `${base}/liquidation_proof.zkey`
  );

  const commitBytes = fieldToBE32(witness.policyCommitment);
  return {
    proof: proof as Groth16Proof,
    publicSignals: publicSignals as PublicSignals,
    commitmentHash: "0x" + Buffer.from(commitBytes).toString("hex"),
  };
}

// ── Proof verification (off-chain mirror of on-chain check) ──────────

/**
 * Verify a Groth16 proof off-chain using snarkjs. Useful for API routes
 * that want to pre-filter bad proofs before submitting to chain.
 *
 * The on-chain verifier in `sakura_insurance.claim_payout_with_zk_proof`
 * performs the authoritative check via alt_bn128 pairing — this is only
 * a fast fail-closed prefilter.
 */
export async function verifyLiquidationProof(
  proof: Groth16Proof,
  publicSignals: PublicSignals,
  opts: { vkPath?: string } = {}
): Promise<boolean> {
  const snarkjs = await import("snarkjs");

  let vk: any;
  if (typeof window !== "undefined") {
    const res = await fetch("/zk/verification_key.json");
    vk = await res.json();
  } else {
    const fs = await import("fs");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodePath = require("path");
    const vkPath =
      opts.vkPath ??
      nodePath.join(process.cwd(), "public", "zk", "verification_key.json");
    vk = JSON.parse(fs.readFileSync(vkPath, "utf8"));
  }

  return snarkjs.groth16.verify(vk, publicSignals, proof);
}

// ── Memo payload helper (used by on-chain audit trail) ───────────────

/**
 * Encode a Groth16 proof bundle into a base64url string suitable for a
 * Solana Memo instruction. The on-chain verifier is authoritative; this
 * payload is for off-chain replay / audit of what proof was submitted
 * alongside a given on-chain tx.
 */
export function buildProofMemoPayload(bundle: {
  proof: Groth16Proof;
  publicSignals: PublicSignals;
  commitmentHash?: string;
}): string {
  const json = JSON.stringify({
    p: bundle.proof,
    s: bundle.publicSignals,
    c: bundle.commitmentHash ?? "",
  });
  return Buffer.from(json, "utf8").toString("base64url");
}
