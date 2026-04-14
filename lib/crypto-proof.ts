import crypto from "crypto";

/** Full SHA-256 — never truncated */
export function sha256(input: string): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}

/**
 * Canonical input builder for mandate hash.
 * Input format: "MANDATE|{mandateTxSig}|{mandateTs}|{maxUsdc}|{agent}"
 * Anyone with these values can recompute the hash.
 */
export function buildMandateInput(mandateTxSig: string, mandateTs: string, maxUsdc: number, agentPubkey: string): string {
  return `MANDATE|${mandateTxSig}|${mandateTs}|${maxUsdc}|${agentPubkey}`;
}

export function mandateHash(mandateTxSig: string, mandateTs: string, maxUsdc: number, agentPubkey: string): { hash: string; input: string } {
  const input = buildMandateInput(mandateTxSig, mandateTs, maxUsdc, agentPubkey);
  return { hash: sha256(input), input };
}

/**
 * Canonical input builder for execution hash.
 * Input format: "EXECUTION|{protocol}|{wallet8}|{rescueUsdc}|{executionTs}|{rescueSig}|{mandateHash}"
 * The mandateHash field cryptographically binds execution to its mandate.
 */
export function buildExecutionInput(
  protocol: string, wallet8: string, rescueUsdc: number,
  executionTs: string, rescueSig: string, prevMandateHash: string
): string {
  return `EXECUTION|${protocol}|${wallet8}|${rescueUsdc}|${executionTs}|${rescueSig}|${prevMandateHash}`;
}

export function executionHash(
  protocol: string, wallet8: string, rescueUsdc: number,
  executionTs: string, rescueSig: string, prevMandateHash: string
): { hash: string; input: string } {
  const input = buildExecutionInput(protocol, wallet8, rescueUsdc, executionTs, rescueSig, prevMandateHash);
  return { hash: sha256(input), input };
}

/**
 * Chain proof: SHA-256(mandateHash + executionHash)
 * This single hash proves the entire rescue sequence is intact.
 */
export function chainProof(mHash: string, eHash: string): { hash: string; input: string } {
  const input = `CHAIN|${mHash}|${eHash}`;
  return { hash: sha256(input), input };
}

/**
 * Ghost Run pre-commitment hash.
 * Input format: "GR_COMMIT|{strategyHash}|{resultHash}|{wallet8}|{ts}"
 */
export function commitmentHash(strategy: string, resultJson: string, wallet8: string, ts: string): {
  commitmentId: string;
  strategyHash: string;
  resultHash: string;
  commitInput: string;
} {
  const sHash = sha256(strategy);
  const rHash = sha256(resultJson);
  const commitInput = `GR_COMMIT|${sHash}|${rHash}|${wallet8}|${ts}`;
  const commitHash = sha256(commitInput);
  return {
    commitmentId: "GR-" + commitHash.slice(0, 8).toUpperCase(),
    strategyHash: sHash,
    resultHash: rHash,
    commitInput,
  };
}

/**
 * Ghost Run execution proof — ties execution to pre-commitment.
 * Input format: "GR_EXEC|{commitmentId}|{signatures_joined}|{ts}"
 */
export function executionProofHash(commitmentId: string, signatures: string[], ts: string): { hash: string; input: string } {
  const input = `GR_EXEC|${commitmentId}|${signatures.join(",")}|${ts}`;
  return { hash: sha256(input), input };
}

/**
 * Verify a hash by recomputing from the canonical input.
 * Returns true if sha256(input) === expectedHash.
 */
export function verifyHash(input: string, expectedHash: string): boolean {
  return sha256(input) === expectedHash;
}

/**
 * Full hash chain verification for rescue operations.
 * Takes all inputs and checks every hash in the chain.
 */
export interface HashChainVerification {
  mandateValid: boolean;
  executionValid: boolean;
  chainProofValid: boolean;
  allValid: boolean;
}

export function verifyRescueHashChain(
  mandateInput: string, expectedMandateHash: string,
  executionInput: string, expectedExecutionHash: string,
  chainInput: string, expectedChainProof: string,
): HashChainVerification {
  const mandateValid = verifyHash(mandateInput, expectedMandateHash);
  const executionValid = verifyHash(executionInput, expectedExecutionHash);
  const chainProofValid = verifyHash(chainInput, expectedChainProof);
  return {
    mandateValid,
    executionValid,
    chainProofValid,
    allValid: mandateValid && executionValid && chainProofValid,
  };
}
