/**
 * Server-side Solana RPC proxy.
 * Forwards JSON-RPC requests to Helius without exposing the API key to clients.
 * Clients call /api/rpc instead of connecting to Helius directly.
 */
import { NextRequest, NextResponse } from "next/server";

const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY ?? ""}`;
const FALLBACK_RPC = "https://api.mainnet-beta.solana.com";

// Allowed JSON-RPC methods (allowlist — block dangerous methods)
// sendTransaction is intentionally excluded: clients must submit transactions
// directly to Solana (or use a dedicated signing flow) to prevent abuse of
// our Helius API key for arbitrary transaction broadcasting.
const ALLOWED_METHODS = new Set([
  "getLatestBlockhash",
  "getBalance",
  "getAccountInfo",
  "getTokenAccountBalance",
  "getTokenAccountsByOwner",
  "getParsedTransaction",
  "getParsedAccountInfo",
  "simulateTransaction",
  "getMinimumBalanceForRentExemption",
  "getRecentBlockhash",
  "getFeeForMessage",
  "getSlot",
  "getBlockTime",
  "getConfirmationStatus",
  "getSignatureStatuses",
  "getTransaction",
  "getMultipleAccounts",
]);

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Validate method allowlist (prevent abuse of dangerous RPC methods)
  const rpc = body as { method?: string };
  if (rpc.method && !ALLOWED_METHODS.has(rpc.method)) {
    return NextResponse.json(
      { jsonrpc: "2.0", id: null, error: { code: -32601, message: "Method not allowed" } },
      { status: 403 }
    );
  }

  const targetRpc = process.env.HELIUS_API_KEY ? HELIUS_RPC : FALLBACK_RPC;

  try {
    const res = await fetch(targetRpc, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "RPC proxy error";
    return NextResponse.json(
      { jsonrpc: "2.0", id: null, error: { code: -32603, message: msg } },
      { status: 500 }
    );
  }
}
