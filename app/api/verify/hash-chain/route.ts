/**
 * Hash Chain Verification API
 *
 * Verifies cryptographic hash chains by recomputing SHA-256 from canonical inputs.
 * Anyone can call this endpoint with the inputs from on-chain Memo data
 * and independently verify the hashes match.
 *
 * POST /api/verify/hash-chain
 * Body: { mandateInput, mandateHash, executionInput, executionHash, chainInput, chainProof }
 * Returns: { verified, details: { mandateValid, executionValid, chainProofValid } }
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyRescueHashChain, verifyHash, sha256 } from "@/lib/crypto-proof";

export async function POST(req: NextRequest) {
  let body: {
    // Rescue hash chain verification
    mandateInput?: string;
    mandateHash?: string;
    executionInput?: string;
    executionHash?: string;
    chainInput?: string;
    chainProof?: string;
    // Ghost Run single-hash verification
    input?: string;
    expectedHash?: string;
  } = {};

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Mode 1: Full rescue hash chain verification
  if (body.mandateInput && body.mandateHash && body.executionInput && body.executionHash && body.chainInput && body.chainProof) {
    const result = verifyRescueHashChain(
      body.mandateInput, body.mandateHash,
      body.executionInput, body.executionHash,
      body.chainInput, body.chainProof,
    );

    return NextResponse.json({
      verified: result.allValid,
      details: {
        mandateValid: result.mandateValid,
        mandateRecomputed: sha256(body.mandateInput),
        executionValid: result.executionValid,
        executionRecomputed: sha256(body.executionInput),
        chainProofValid: result.chainProofValid,
        chainProofRecomputed: sha256(body.chainInput),
      },
    });
  }

  // Mode 2: Single hash verification (Ghost Run commitment, or any SHA-256)
  if (body.input && body.expectedHash) {
    const valid = verifyHash(body.input, body.expectedHash);
    return NextResponse.json({
      verified: valid,
      recomputed: sha256(body.input),
      expected: body.expectedHash,
      match: valid,
    });
  }

  return NextResponse.json({
    error: "Provide either { mandateInput, mandateHash, executionInput, executionHash, chainInput, chainProof } for rescue chain verification, or { input, expectedHash } for single hash verification.",
  }, { status: 400 });
}
