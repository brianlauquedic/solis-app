/**
 * Ghost Run — Swap Audit API
 *
 * POST /api/ghost-run/audit
 * Body: { swapSigs: string[], wallet: string, executeMemoSig?: string }
 *
 * Called by frontend AFTER the user signs swap transactions via their wallet.
 * Jupiter swap TXs must be signed non-custodially; the execute endpoint cannot
 * sign them. Once the user signs, the frontend posts the swap signatures here
 * so they are appended to the on-chain audit trail via Solana Memo Program.
 *
 * This completes the audit chain:
 *   execute memo (platform TXs) → audit memo (user-signed swap TXs)
 */
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let body: { swapSigs?: string[]; wallet?: string; executeMemoSig?: string } = {};
  try { body = await req.json(); } catch { /* ok */ }

  const { swapSigs, wallet, executeMemoSig } = body;

  if (!swapSigs?.length || !wallet) {
    return NextResponse.json({ error: "Missing swapSigs or wallet" }, { status: 400 });
  }
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet)) {
    return NextResponse.json({ error: "Invalid wallet address format" }, { status: 400 });
  }
  if (swapSigs.length > 20) {
    return NextResponse.json({ error: "Too many swap signatures" }, { status: 400 });
  }

  const auditPayload = JSON.stringify({
    event: "sakura_ghost_run_swaps_signed",
    wallet: wallet.slice(0, 8),
    swapCount: swapSigs.length,
    swapSigs: swapSigs.map(s => s.slice(0, 20)),
    executeMemoRef: executeMemoSig?.slice(0, 20) ?? "none",
    ts: new Date().toISOString(),
  });

  let auditMemoSig: string | null = null;
  try {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
    if (baseUrl) {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (process.env.INTERNAL_API_SECRET) {
        headers["x-internal-secret"] = process.env.INTERNAL_API_SECRET;
      }
      const memoRes = await fetch(`${baseUrl}/api/agent/memo`, {
        method: "POST",
        headers,
        body: JSON.stringify({ memoPayload: auditPayload }),
      }).catch(() => null);

      if (memoRes?.ok) {
        const d = await memoRes.json();
        auditMemoSig = d.txSignature ?? d.signature ?? null;
      }
    }
  } catch { /* memo is optional — never fail the response */ }

  return NextResponse.json({
    success: true,
    auditMemoSig,
    auditChain: executeMemoSig
      ? `${executeMemoSig.slice(0, 12)}… → ${auditMemoSig?.slice(0, 12) ?? "?"}…`
      : auditMemoSig?.slice(0, 12) ?? null,
    swapCount: swapSigs.length,
  });
}
