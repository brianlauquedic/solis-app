import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";

// ── Payment config ───────────────────────────────────────────────
const HELIUS_API_KEY  = process.env.HELIUS_API_KEY ?? "";
const HELIUS_RPC      = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const SOLIS_FEE_WALLET = process.env.SOLIS_FEE_WALLET ?? "";
const USDC_MINT        = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const MCP_CALL_FEE     = 10_000; // 0.01 USDC (6 decimals) per tool call

// Simple in-memory replay protection (ephemeral; good enough for demo)
const usedSigs = new Set<string>();

let _mcpFeeAta = "";
function getSolisFeeAta(): string {
  if (_mcpFeeAta) return _mcpFeeAta;
  if (!SOLIS_FEE_WALLET) return "";
  try {
    _mcpFeeAta = getAssociatedTokenAddressSync(
      new PublicKey(USDC_MINT),
      new PublicKey(SOLIS_FEE_WALLET)
    ).toString();
  } catch { /* env var missing at build time */ }
  return _mcpFeeAta;
}

async function verifyMCPPayment(txSig: string, requiredAmount: number): Promise<boolean> {
  if (!SOLIS_FEE_WALLET) return true; // demo mode: no fee wallet configured
  try {
    const conn = new Connection(HELIUS_RPC, "confirmed");
    const tx = await conn.getParsedTransaction(txSig, { maxSupportedTransactionVersion: 0 });
    if (!tx) return false;
    for (const ix of tx.transaction.message.instructions) {
      if ("parsed" in ix && ix.parsed?.type === "transferChecked") {
        const info = ix.parsed.info;
        if (
          info?.mint === USDC_MINT &&
          info?.destination === getSolisFeeAta() &&
          Number(info?.tokenAmount?.amount ?? 0) >= requiredAmount
        ) {
          return true;
        }
      }
    }
    return false;
  } catch {
    return false;
  }
}

// ── MCP Tool Definitions (v2 — 3 core features) ──────────────────
const TOOLS = [
  {
    name: "sakura_nonce_guardian",
    description:
      "Scan a Solana wallet for Durable Nonce accounts and detect security risks. Durable Nonces enable pre-signed transactions that never expire — the attack vector used in the April 2026 Drift $285M hack. Returns nonce accounts, risk signals, and AI analysis.",
    inputSchema: {
      type: "object",
      properties: {
        wallet: {
          type: "string",
          description: "Solana wallet address (base58) to scan for nonce accounts",
        },
      },
      required: ["wallet"],
    },
  },
  {
    name: "sakura_compile_strategy",
    description:
      "Convert a natural language DeFi strategy description into structured JSON. Supports scheduling (cron), APY-threshold triggers, and actions like stake/lend/swap across Kamino, Marinade, and Jito.",
    inputSchema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "Natural language strategy, e.g. '每週五把我 50% USDC 存入 Kamino'",
        },
      },
      required: ["text"],
    },
  },
  {
    name: "sakura_compile_safety_rules",
    description:
      "Convert natural language safety constraints into structured AI agent guardrails. Returns rules like max-per-tx limits, protocol whitelists, and approval requirements that gate every DeFi action.",
    inputSchema: {
      type: "object",
      properties: {
        text: {
          type: "string",
          description: "Natural language safety rules, e.g. '每次最多動 $100 USDC，只能去 Kamino 和 Marinade'",
        },
      },
      required: ["text"],
    },
  },
];

// ── GET: MCP server manifest / tools list ────────────────────────
export async function GET() {
  return NextResponse.json({
    name: "sakura-v2-mcp",
    version: "2.0.0",
    description: "Sakura v2 — Durable Nonce Guardian + NL Strategy Compiler + NL Safety Rules on Solana",
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

    // x402 payment gate — $0.01 USDC per tool call
    const paymentSig = req.headers.get("x-payment") ?? req.headers.get("X-PAYMENT");
    if (!paymentSig) {
      return NextResponse.json(
        { jsonrpc: "2.0", id, error: { code: -32001, message: "Payment required: 0.01 USDC per tool call" } },
        {
          status: 402,
          headers: {
            "X-Payment-Required": "true",
            "X-Payment-Amount": "0.01",
            "X-Payment-Currency": "USDC",
            "X-Payment-Recipient": SOLIS_FEE_WALLET || "not-configured",
            "X-Payment-Network": "solana-mainnet",
          },
        }
      );
    }

    // Replay protection
    if (usedSigs.has(paymentSig)) {
      return jsonrpcError(id, -32001, "Payment already used — send a new transaction");
    }
    const paymentValid = await verifyMCPPayment(paymentSig, MCP_CALL_FEE);
    if (!paymentValid) {
      return jsonrpcError(id, -32001, "Payment verification failed. Send 0.01 USDC to Sakura fee wallet.");
    }
    usedSigs.add(paymentSig);

    try {
      const result = await callTool(params.name, params.arguments ?? {});
      return jsonrpcResult(id, {
        content: [{ type: "text", text: typeof result === "string" ? result : JSON.stringify(result, null, 2) }],
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Tool execution failed";
      return jsonrpcError(id, -32603, msg);
    }
  }

  return jsonrpcError(id, -32601, `Method not found: ${rpc.method}`);
}

// ── Tool dispatch ────────────────────────────────────────────────
async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const base = process.env.VERCEL_URL
    ? `https://${process.env.VERCEL_URL}`
    : "http://localhost:3000";

  if (name === "sakura_nonce_guardian") {
    const wallet = String(args.wallet ?? "");
    if (!wallet || wallet.length < 32) throw new Error("wallet address is required");
    const res = await fetch(`${base}/api/nonce-guardian`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ wallet }),
    });
    if (!res.ok) throw new Error(`Nonce Guardian failed: HTTP ${res.status}`);
    return await res.json();
  }

  if (name === "sakura_compile_strategy") {
    const text = String(args.text ?? "");
    if (!text) throw new Error("text is required");
    const res = await fetch(`${base}/api/strategy/compile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error(`Strategy compilation failed: HTTP ${res.status}`);
    return await res.json();
  }

  if (name === "sakura_compile_safety_rules") {
    const text = String(args.text ?? "");
    if (!text) throw new Error("text is required");
    const res = await fetch(`${base}/api/safety-rules/compile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error(`Safety rules compilation failed: HTTP ${res.status}`);
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
