import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { checkAndMarkUsed } from "@/lib/redis";
import { getConnection } from "@/lib/rpc";

// ── Payment config ───────────────────────────────────────────────
const HELIUS_API_KEY  = process.env.HELIUS_API_KEY ?? "";
const HELIUS_RPC      = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const SAKURA_FEE_WALLET = process.env.SAKURA_FEE_WALLET ?? "";
const USDC_MINT        = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const MCP_CALL_FEE     = 1_000_000; // 1.00 USDC (6 decimals) per tool call

// In-memory fallback for replay protection (used when Redis is not configured).
// Redis mode: distributed across all Vercel instances via checkAndMarkUsed().
const usedSigs = new Set<string>();

let _mcpFeeAta = "";
function getSakuraFeeAta(): string {
  if (_mcpFeeAta) return _mcpFeeAta;
  if (!SAKURA_FEE_WALLET) return "";
  try {
    _mcpFeeAta = getAssociatedTokenAddressSync(
      new PublicKey(USDC_MINT),
      new PublicKey(SAKURA_FEE_WALLET)
    ).toString();
  } catch { /* env var missing at build time */ }
  return _mcpFeeAta;
}

async function verifyMCPPayment(
  txSig: string,
  requiredAmount: number,
  callerWallet?: string   // [SECURITY FIX M-1] Sender verification
): Promise<boolean> {
  if (!SAKURA_FEE_WALLET) return true; // demo mode: no fee wallet configured
  try {
    // Module 16: multi-RPC failover for payment verification
    const conn = await getConnection("confirmed");
    const tx = await conn.getParsedTransaction(txSig, { maxSupportedTransactionVersion: 0 });
    if (!tx) return false;
    for (const ix of tx.transaction.message.instructions) {
      if ("parsed" in ix && ix.parsed?.type === "transferChecked") {
        const info = ix.parsed.info;
        if (
          info?.mint === USDC_MINT &&
          info?.destination === getSakuraFeeAta() &&
          Number(info?.tokenAmount?.amount ?? 0) >= requiredAmount
        ) {
          // [SECURITY FIX M-1] Verify sender matches the caller's wallet.
          // Without this check, any user could share a valid txSig and let
          // others call MCP tools for free using the same payment transaction.
          if (callerWallet && info?.authority && info.authority !== callerWallet) {
            return false; // Payment sent by a different wallet — not valid for this caller
          }
          return true;
        }
      }
    }
    return false;
  } catch {
    return false;
  }
}

// ── MCP Tool Definitions (v3 — Shielded Lending core) ──────────────
//
// v3 collapses the prior 3-tab architecture (Nonce Guardian / Ghost Run /
// Liquidation Shield) into a single focused product: Shielded Lending,
// powered by on-chain Groth16 pairing verification on Solana's alt_bn128
// syscall. The exposed MCP tool returns honest pool + policy state read
// from the deployed program — no AI fluff, no simulated proofs.
const TOOLS = [
  {
    name: "sakura_shielded_lending_status",
    description:
      "Read the on-chain state of Sakura's Shielded Lending pool (mutual self-insured) and the caller's policy if any. Returns: program id, pool TVL, total stakes, total claims paid, plus the user's coverage cap, stake, claims-to-date, and policy commitment hash. All data is fetched live from the deployed Anchor program on Solana devnet.",
    inputSchema: {
      type: "object",
      properties: {
        wallet: {
          type: "string",
          description: "Optional Solana wallet address (base58). If provided, returns the policy state for this user; if omitted, returns only the global pool state.",
        },
      },
      required: [],
    },
  },
];

// ── GET: MCP server manifest / tools list ────────────────────────
export async function GET() {
  return NextResponse.json({
    name: "sakura-mcp",
    version: "3.0.0",
    description: "Sakura — Shielded Lending on Solana with on-chain Groth16 pairing verification",
    tools: TOOLS,
  });
}

// ── POST: MCP JSON-RPC 2.0 handler ──────────────────────────────
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonrpcError(null, -32700, "Parse error");
  }

  const rpc = body as { jsonrpc?: string; id?: unknown; method?: string; params?: unknown };

  if (rpc.jsonrpc !== "2.0") {
    return jsonrpcError(rpc.id ?? null, -32600, "Invalid Request: jsonrpc must be '2.0'");
  }

  const id = rpc.id ?? null;

  // tools/list
  if (rpc.method === "tools/list") {
    return jsonrpcResult(id, { tools: TOOLS });
  }

  // tools/call
  if (rpc.method === "tools/call") {
    const params = rpc.params as { name?: string; arguments?: Record<string, unknown> };
    if (!params?.name) {
      return jsonrpcError(id, -32602, "Invalid params: missing tool name");
    }

    // x402 payment gate — $1.00 USDC per tool call
    const paymentSig = req.headers.get("x-payment") ?? req.headers.get("X-PAYMENT");
    if (!paymentSig) {
      return NextResponse.json(
        { jsonrpc: "2.0", id, error: { code: -32001, message: "Payment required: 1.00 USDC per tool call" } },
        {
          status: 402,
          headers: {
            "X-Payment-Required": "true",
            "X-Payment-Amount": "1.00",
            "X-Payment-Currency": "USDC",
            "X-Payment-Recipient": SAKURA_FEE_WALLET || "not-configured",
            "X-Payment-Network": "solana-mainnet",
          },
        }
      );
    }

    // Replay protection — Redis (distributed) or in-memory fallback
    // checkAndMarkUsed returns false if key was already seen
    const isFirstUse = await checkAndMarkUsed(`mcp:sig:${paymentSig}`, usedSigs);
    if (!isFirstUse) {
      return jsonrpcError(id, -32001, "Payment already used — send a new transaction");
    }
    // Extract caller wallet from tool arguments for sender verification (M-1 fix)
    const callerWallet = typeof params.arguments?.wallet === "string"
      ? params.arguments.wallet
      : undefined;
    const paymentValid = await verifyMCPPayment(paymentSig, MCP_CALL_FEE, callerWallet);
    if (!paymentValid) {
      return jsonrpcError(id, -32001, "Payment verification failed. Send 1.00 USDC from your wallet to Sakura fee wallet.");
    }

    try {
      const result = await callTool(params.name, params.arguments ?? {});
      return jsonrpcResult(id, {
        content: [{ type: "text", text: typeof result === "string" ? result : JSON.stringify(result, null, 2) }],
      });
    } catch (err: unknown) {
      // [SECURITY FIX N-2] Never expose raw error messages — err.message can
      // contain Helius RPC URLs (with API key) or Anthropic error details.
      console.error("[mcp] tool execution error:", err instanceof Error ? err.message : err);
      return jsonrpcError(id, -32603, "Tool execution failed. Please try again.");
    }
  }

  return jsonrpcError(id, -32601, `Method not found: ${rpc.method}`);
}

// ── Tool dispatch ────────────────────────────────────────────────
async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const base = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";

  if (name === "sakura_shielded_lending_status") {
    const wallet = String(args.wallet ?? "");
    const url = wallet && wallet.length >= 32
      ? `${base}/api/insurance/status?user=${encodeURIComponent(wallet)}`
      : `${base}/api/insurance/status`;
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) throw new Error(`Shielded Lending status fetch failed: HTTP ${res.status}`);
    return await res.json();
  }

  throw new Error(`Unknown tool: ${name}`);
}

// ── JSON-RPC helpers ─────────────────────────────────────────────
function jsonrpcResult(id: unknown, result: unknown) {
  return NextResponse.json({ jsonrpc: "2.0", id, result });
}

function jsonrpcError(id: unknown, code: number, message: string) {
  return NextResponse.json(
    { jsonrpc: "2.0", id, error: { code, message } },
    { status: code === -32700 || code === -32600 ? 400 : 200 }
  );
}
