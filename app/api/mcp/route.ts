import { NextRequest, NextResponse } from "next/server";
import { Connection, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { atomicClaimPaymentSig, releasePaymentSig } from "@/lib/rate-limit";

// ── Payment config ───────────────────────────────────────────────
const HELIUS_API_KEY  = process.env.HELIUS_API_KEY ?? "";
const HELIUS_RPC      = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const SOLIS_FEE_WALLET = process.env.SOLIS_FEE_WALLET ?? "";
const USDC_MINT        = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const MCP_CALL_FEE     = 10_000; // 0.01 USDC (6 decimals) per tool call

const SOLIS_FEE_ATA = SOLIS_FEE_WALLET
  ? getAssociatedTokenAddressSync(
      new PublicKey(USDC_MINT),
      new PublicKey(SOLIS_FEE_WALLET)
    ).toString()
  : "";

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
          info?.destination === SOLIS_FEE_ATA &&
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

// ── MCP Tool Definitions ──────────────────────────────────────────
const TOOLS = [
  {
    name: "solis_token_security",
    description:
      "Analyze a Solana token's security using GoPlus 5-dimension scan + Claude AI reasoning. Returns security score (0-100), risk flags (honeypot, mint authority, freeze authority, holder concentration), and an AI-generated position recommendation.",
    inputSchema: {
      type: "object",
      properties: {
        mint: {
          type: "string",
          description: "Solana token mint address (base58)",
        },
        walletTotalUSD: {
          type: "number",
          description: "Optional: user's total wallet USD value for position sizing advice",
        },
      },
      required: ["mint"],
    },
  },
  {
    name: "solis_defi_advisor",
    description:
      "Get AI-powered DeFi advice for a Solana wallet. Analyzes current SOL/USDC balances against real-time APY opportunities (Marinade, Jito, Kamino, Raydium) and returns actionable recommendations with protocol links.",
    inputSchema: {
      type: "object",
      properties: {
        walletAddress: {
          type: "string",
          description: "Solana wallet address (base58)",
        },
        question: {
          type: "string",
          description: "Natural language question, e.g. 'What should I do with my SOL?' or 'Best yield for my USDC?'",
        },
        solBalance: {
          type: "number",
          description: "Optional: current SOL balance",
        },
        idleUSDC: {
          type: "number",
          description: "Optional: idle USDC amount",
        },
      },
      required: ["walletAddress", "question"],
    },
  },
];

// ── GET: MCP server manifest / tools list ────────────────────────
export async function GET() {
  return NextResponse.json({
    name: "solis-mcp",
    version: "1.0.0",
    description: "Sakura AI DeFi Advisor — Token security analysis and DeFi yield recommendations on Solana",
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

    // x402 payment gate — $0.01 USDC per tool call (MCPay pattern)
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
    // Atomic replay protection: claim sig slot first, then verify (prevents TOCTOU)
    const alreadyClaimed = await atomicClaimPaymentSig(paymentSig);
    if (alreadyClaimed) {
      return jsonrpcError(id, -32001, "Payment already used — send a new transaction");
    }
    const paymentValid = await verifyMCPPayment(paymentSig, MCP_CALL_FEE);
    if (!paymentValid) {
      await releasePaymentSig(paymentSig); // release so user can retry with valid sig
      return jsonrpcError(id, -32001, "Payment verification failed. Send 0.01 USDC to Sakura fee wallet.");
    }

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

  if (name === "solis_token_security") {
    const mint = String(args.mint ?? "");
    if (!mint) throw new Error("mint address is required");
    const MINT_RE = /^[1-9A-HJ-NP-Z]{32,44}$/;
    if (!MINT_RE.test(mint)) throw new Error("Invalid Solana mint address format");

    // Fetch GoPlus data first (reuse existing analyze endpoint logic)
    const goplusUrl = `https://api.gopluslabs.io/api/v1/solana/token_security?contract_addresses=${mint}`;
    const gpRes = await fetch(goplusUrl, { headers: { "Accept": "application/json" } });
    const gpData = await gpRes.json();
    const tokenData = gpData?.result?.[mint.toLowerCase()] ?? gpData?.result?.[mint] ?? null;

    if (!tokenData) {
      return { error: "Token not found in GoPlus database", mint };
    }

    // Build analyze request
    const analyzeBody = {
      mint,
      name: tokenData.token_name || "Unknown",
      symbol: tokenData.token_symbol || "???",
      securityScore: computeScore(tokenData),
      risks: buildRisks(tokenData),
      positives: buildPositives(tokenData),
      holderCount: Number(tokenData.holder_count) || undefined,
      top10HolderPct: tokenData.top10_holder_percent ? Number(tokenData.top10_holder_percent) * 100 : undefined,
      mintable: tokenData.mintable === "1",
      freezable: tokenData.freezable === "1",
      isHoneypot: tokenData.honeypot === "1",
      walletRiskyPct: 0,
      walletTotalUSD: Number(args.walletTotalUSD ?? 1000),
    };

    const analyzeRes = await fetch(`${base}/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(analyzeBody),
    });
    const analyzeData = await analyzeRes.json();

    return {
      mint,
      name: analyzeBody.name,
      symbol: analyzeBody.symbol,
      securityScore: analyzeBody.securityScore,
      decision: analyzeData.decision,
      reasoning: analyzeData.reasoning,
      risks: analyzeBody.risks,
      aiAvailable: analyzeData.aiAvailable,
      onchainProof: {
        hash: analyzeData.reasoningHash,
        memo: analyzeData.memoPayload?.slice(0, 100) + (analyzeData.memoPayload?.length > 100 ? "..." : ""),
      },
    };
  }

  if (name === "solis_defi_advisor") {
    const walletAddress = String(args.walletAddress ?? "");
    const question = String(args.question ?? "");
    if (!walletAddress || !question) throw new Error("walletAddress and question are required");

    // Fetch live yield data
    let liveYield = null;
    try {
      const yieldRes = await fetch(`${base}/api/yield`);
      liveYield = await yieldRes.json();
    } catch { /* proceed without live yield */ }

    const wallet = {
      solBalance: Number(args.solBalance ?? 1),
      idleUSDC: Number(args.idleUSDC ?? 0),
      totalUSD: Number(args.solBalance ?? 1) * 150 + Number(args.idleUSDC ?? 0),
    };

    // Collect full streaming response
    const chatRes = await fetch(`${base}/api/defi-chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: question, wallet, liveYield }),
    });

    // Parse SSE stream
    const reader = chatRes.body?.getReader();
    const decoder = new TextDecoder();
    let fullText = "";
    let actions: unknown[] = [];
    let reasoningHash = "";

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        for (const line of chunk.split("\n")) {
          if (!line.startsWith("data: ")) continue;
          try {
            const evt = JSON.parse(line.slice(6));
            if (evt.type === "token") fullText += evt.text ?? "";
            if (evt.type === "done") {
              actions = evt.actions ?? [];
              reasoningHash = evt.reasoningHash ?? "";
            }
          } catch { /* ignore malformed lines */ }
        }
      }
    }

    return {
      walletAddress,
      question,
      advice: fullText,
      actions: actions.slice(0, 3), // top 3 action cards
      onchainProof: { hash: reasoningHash },
    };
  }

  throw new Error(`Unknown tool: ${name}`);
}

// ── GoPlus score helpers ─────────────────────────────────────────
function computeScore(d: Record<string, unknown>): number {
  let score = 100;
  if (d.honeypot === "1") score -= 50;
  if (d.mintable === "1") score -= 15;
  if (d.freezable === "1") score -= 15;
  const top10 = Number(d.top10_holder_percent ?? 0) * 100;
  if (top10 > 80) score -= 15;
  else if (top10 > 60) score -= 8;
  return Math.max(0, Math.min(100, score));
}

function buildRisks(d: Record<string, unknown>): string[] {
  const r: string[] = [];
  if (d.honeypot === "1") r.push("Honeypot detected — cannot sell");
  if (d.mintable === "1") r.push("Mint authority active — supply can be inflated");
  if (d.freezable === "1") r.push("Freeze authority active — tokens can be frozen");
  const top10 = Number(d.top10_holder_percent ?? 0) * 100;
  if (top10 > 80) r.push(`Top 10 holders own ${top10.toFixed(0)}% — high concentration risk`);
  return r;
}

function buildPositives(d: Record<string, unknown>): string[] {
  const p: string[] = [];
  if (d.honeypot !== "1") p.push("No honeypot detected");
  if (d.mintable !== "1") p.push("No mint authority");
  if (d.freezable !== "1") p.push("No freeze authority");
  return p;
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
