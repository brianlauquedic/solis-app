/**
 * Fetch Memo from Solana chain via Helius RPC.
 * Used by /verify page for on-chain AI reasoning verification.
 *
 * Three-layer verification:
 *   Layer 1: Memo text (AI decision summary)
 *   Layer 2: Simulation proof (if contains "simulated sell")
 *   Layer 3: Mandate reference (if contains mandate data)
 */

import { NextRequest, NextResponse } from "next/server";
import { Connection } from "@solana/web3.js";
import { RPC_URL } from "@/lib/agent";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sig = searchParams.get("sig");

  // Solana tx signatures are base58-encoded 64-byte values → 87-88 chars
  const SIG_RE = /^[1-9A-HJ-NP-Za-km-z]{87,88}$/;
  if (!sig || !SIG_RE.test(sig)) {
    return NextResponse.json({ error: "Invalid transaction signature format" }, { status: 400 });
  }

  try {
    const conn = new Connection(RPC_URL, "confirmed");

    // Fetch full parsed transaction
    const tx = await conn.getParsedTransaction(sig, {
      maxSupportedTransactionVersion: 0,
      commitment: "confirmed",
    });

    if (!tx) {
      return NextResponse.json({ error: "Transaction not found or not yet confirmed" }, { status: 404 });
    }

    // Extract memo from spl-memo program instructions
    let memo: string | null = null;
    for (const ix of tx.transaction.message.instructions) {
      if ("program" in ix && ix.program === "spl-memo") {
        memo = (ix as { program: string; parsed: string }).parsed ?? null;
        break;
      }
      // Also check inner instructions
    }

    // Check inner instructions too
    if (!memo && tx.meta?.innerInstructions) {
      for (const innerSet of tx.meta.innerInstructions) {
        for (const ix of innerSet.instructions) {
          if ("program" in ix && (ix as { program?: string }).program === "spl-memo") {
            memo = ((ix as { program: string; parsed?: string }).parsed) ?? null;
            if (memo) break;
          }
        }
        if (memo) break;
      }
    }

    // Parse memo layers
    const layers: {
      decision?: string;
      simulationProof?: string;
      mandateRef?: string;
      rawMemo: string | null;
    } = { rawMemo: memo };

    if (memo) {
      // Layer 1: decision summary (anything before | or full text)
      layers.decision = memo.split(" | hash:")[0];

      // Layer 2: simulation proof
      if (memo.includes("simulated sell") || memo.includes("honeypot")) {
        const simMatch = memo.match(/simulated sell[^|]*/i);
        if (simMatch) layers.simulationProof = simMatch[0];
      }

      // Layer 3: mandate reference
      if (memo.includes("mandate:") || memo.includes("maxStake")) {
        const mandateMatch = memo.match(/mandate:[^\s|]*/i);
        if (mandateMatch) layers.mandateRef = mandateMatch[0];
      }
    }

    return NextResponse.json({
      signature: sig,
      memo,
      layers,
      slot: tx.slot,
      blockTime: tx.blockTime,
      // Compute approximate timestamp
      timestamp: tx.blockTime ? tx.blockTime * 1000 : null,
      // Fee payer (who wrote the memo)
      feePayer: tx.transaction.message.accountKeys[0]?.pubkey?.toString() ?? null,
    });
  } catch (err) {
    // Never expose raw error messages — log server-side only to prevent
    // leaking internal RPC URLs (which may contain API keys) or stack traces.
    console.error("[verify/fetch-memo] error:", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "transaction_fetch_failed" }, { status: 500 });
  }
}
