/**
 * lib/zk-proof.ts — Real Groth16 proof generation + verification
 *
 * Circuit: `circuits/src/intent_proof.circom` (v0.3, Agentic Consumer Protocol)
 * Proves: action ⊆ user_signed_intent
 *
 * Artifacts expected at:
 *   public/zk/intent_proof.wasm           (witness generator)
 *   public/zk/intent_proof.zkey           (proving key)
 *   public/zk/intent_verification_key.json (verification key)
 *
 * The on-chain verifier is in `programs/sakura-insurance/src/lib.rs`
 * (instruction `execute_with_intent_proof`) using the `groth16-solana`
 * crate + Solana's alt_bn128 pairing syscall.
 *
 * Public inputs (order MUST match circuit's `public` list):
 *   [0] intent_commitment       Poseidon-tree(7 leaves — see below)
 *   [1] action_type             0=Borrow, 1=Lend, 2=Swap, 3=Repay, ...
 *   [2] action_amount           token amount in micro-units (u64)
 *   [3] action_target_index     0=Kamino, 1=MarginFi, 2=(deprecated), 3=Jupiter, ...
 *   [4] oracle_price_usd_micro  Pyth price at execution (u64 micro-USD)
 *   [5] oracle_slot             Pyth publish slot (u64)
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

/**
 * Witness for IntentProof circuit. Public portion must match what the
 * on-chain verifier reads from the transaction; private portion is the
 * user's signed-intent secret known only to the prover.
 */
export type IntentWitness = {
  // Public
  intentCommitment: bigint;
  actionType: number;              // 0..255
  actionAmount: bigint;            // u64 micro-units
  actionTargetIndex: number;       // 0..31
  oraclePriceUsdMicro: bigint;     // u64 micro-USD
  oracleSlot: bigint;              // u64

  // Private
  maxAmount: bigint;               // u64 per-action cap
  maxUsdValue: bigint;             // u64 per-action USD cap (micro-USD)
  allowedProtocols: bigint;        // u32 bitmap
  allowedActionTypes: bigint;      // u32 bitmap
  walletBytes: bigint;             // 31-byte pubkey slice as field element
  nonce: bigint;                   // anti-replay
  intentTextHash: bigint;          // Poseidon of the NL intent text (field elt)
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
 *   proof_a: 64B  (G1 point, BE-encoded x || y; NEGATED per light-protocol convention)
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
  // Negate A.y — light-protocol groth16-solana convention (VK alpha stays
  // positive, caller submits -A). Empirically verified on devnet under
  // program AnszeCRFsBKmT5fBY9WywxGsZZZob8ZPFYqboYXpuYLp.
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

// ── Poseidon intent commitment (client-side; matches circuit) ────────

/**
 * Compute the 2-layer Poseidon tree that binds all 7 intent leaves into
 * a single field-element commitment. MUST exactly match the circuit:
 *
 *     h1     = Poseidon(intent_text_hash, wallet_bytes, nonce)
 *     h2     = Poseidon(max_amount, max_usd_value, allowed_protocols)
 *     final  = Poseidon(h1, h2, allowed_action_types)
 *
 * circomlibjs's Poseidon template only supports arity-2/3 inputs, hence
 * the tree. See circuits/src/intent_proof.circom § C1.
 */
export async function computeIntentCommitment(
  intentTextHash: bigint,
  walletBytes: bigint,
  nonce: bigint,
  maxAmount: bigint,
  maxUsdValue: bigint,
  allowedProtocols: bigint,
  allowedActionTypes: bigint
): Promise<{ decimal: string; bytesBE32: Uint8Array; hex: string }> {
  // Dynamic import — circomlibjs is heavy, only load when called.
  const { buildPoseidon } = await import("circomlibjs");
  const poseidon = await buildPoseidon();

  const h1 = poseidon([intentTextHash, walletBytes, nonce]);
  const h2 = poseidon([maxAmount, maxUsdValue, allowedProtocols]);
  // Poseidon outputs are field elements; pass them back as BigInt via F.toObject.
  const h1Big = BigInt(poseidon.F.toString(h1));
  const h2Big = BigInt(poseidon.F.toString(h2));

  const hFinal = poseidon([h1Big, h2Big, allowedActionTypes]);
  const decimal = poseidon.F.toString(hFinal);
  const bytesBE32 = fieldToBE32(BigInt(decimal));
  const hex = "0x" + Buffer.from(bytesBE32).toString("hex");
  return { decimal, bytesBE32, hex };
}

/**
 * Convert a Solana pubkey (32 bytes) into a BN254-safe field element by
 * dropping the high byte and interpreting the remaining 31 bytes as a
 * big-endian integer. Matches Num2Bits(248) in the circuit.
 */
export function pubkeyToFieldBytes(pubkey32: Uint8Array): bigint {
  if (pubkey32.length !== 32) {
    throw new Error(`pubkeyToFieldBytes expects 32 bytes, got ${pubkey32.length}`);
  }
  let v = 0n;
  for (let i = 1; i < 32; i++) {
    v = (v << 8n) | BigInt(pubkey32[i]);
  }
  return v;
}

// ── Proof generation (browser or server) ─────────────────────────────

/**
 * Generate a Groth16 proof for the IntentProof circuit.
 *
 * Runs in both browser and Node. In the browser, artifacts are fetched
 * from `/zk/intent_proof.wasm` + `/zk/intent_proof.zkey`. In Node, pass
 * absolute paths via `artifactBase`.
 */
export async function generateIntentProof(
  witness: IntentWitness,
  opts: { artifactBase?: string } = {}
): Promise<ProofBundle> {
  const snarkjs = await import("snarkjs");

  // Resolve artifact base in a cwd-safe way. `./public/zk` breaks on Vercel
  // Fluid Compute when the function's working directory is the lambda root.
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

  // Input names MUST match the circom signal names verbatim.
  const input = {
    intent_commitment: witness.intentCommitment.toString(),
    action_type: witness.actionType.toString(),
    action_amount: witness.actionAmount.toString(),
    action_target_index: witness.actionTargetIndex.toString(),
    oracle_price_usd_micro: witness.oraclePriceUsdMicro.toString(),
    oracle_slot: witness.oracleSlot.toString(),
    max_amount: witness.maxAmount.toString(),
    max_usd_value: witness.maxUsdValue.toString(),
    allowed_protocols: witness.allowedProtocols.toString(),
    allowed_action_types: witness.allowedActionTypes.toString(),
    wallet_bytes: witness.walletBytes.toString(),
    nonce: witness.nonce.toString(),
    intent_text_hash: witness.intentTextHash.toString(),
  };

  const { proof, publicSignals } = await snarkjs.groth16.fullProve(
    input,
    `${base}/intent_proof.wasm`,
    `${base}/intent_proof.zkey`
  );

  const commitBytes = fieldToBE32(witness.intentCommitment);
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
 * The on-chain verifier in `sakura_insurance.execute_with_intent_proof`
 * performs the authoritative alt_bn128 pairing check — this is a fast
 * fail-closed prefilter only.
 */
export async function verifyIntentProof(
  proof: Groth16Proof,
  publicSignals: PublicSignals,
  opts: { vkPath?: string } = {}
): Promise<boolean> {
  const snarkjs = await import("snarkjs");

  let vk: any;
  if (typeof window !== "undefined") {
    const res = await fetch("/zk/intent_verification_key.json");
    vk = await res.json();
  } else {
    const fs = await import("fs");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const nodePath = require("path");
    const vkPath =
      opts.vkPath ??
      nodePath.join(
        process.cwd(),
        "public",
        "zk",
        "intent_verification_key.json"
      );
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

// ── Back-compat shims for legacy call-sites ──────────────────────────
// These let older routes (claim_payout, old API routes) keep compiling
// while we migrate. They should be removed once all callers use the
// intent-proof path.

export type LiquidationWitness = IntentWitness;

/** @deprecated Use `generateIntentProof` instead. */
export const generateLiquidationProof = generateIntentProof;

/** @deprecated Use `verifyIntentProof` instead. */
export const verifyLiquidationProof = verifyIntentProof;

/**
 * @deprecated Use `computeIntentCommitment` instead. Back-compat wrapper
 * that treats the three inputs as (intent_text_hash, wallet, nonce) and
 * zeros out the policy fields. Only safe for smoke tests.
 */
export async function computePolicyCommitment(
  a: bigint,
  b: bigint,
  c: bigint
): Promise<{ decimal: string; bytesBE32: Uint8Array; hex: string }> {
  return computeIntentCommitment(a, b, c, 0n, 0n, 0n, 0n);
}
