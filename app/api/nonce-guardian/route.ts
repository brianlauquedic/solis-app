import { NextRequest, NextResponse } from "next/server";
import { scanNonceAccounts } from "@/lib/nonce-scanner";
import Anthropic from "@anthropic-ai/sdk";

const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY ?? ""}`;

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet");
  if (!wallet || wallet.length < 32 || wallet.length > 44) {
    return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
  }

  try {
    const result = await scanNonceAccounts(wallet, HELIUS_RPC);
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[nonce-guardian] scan error:", err);
    return NextResponse.json({ error: `Scan failed: ${msg}` }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: { wallet?: string } = {};
  try { body = await req.json(); } catch { /* ok */ }

  const wallet = body.wallet;
  if (!wallet || wallet.length < 32 || wallet.length > 44) {
    return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
  }

  // Scan first
  let scanResult;
  try {
    scanResult = await scanNonceAccounts(wallet, HELIUS_RPC);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[nonce-guardian] scan error:", err);
    return NextResponse.json({ error: `Scan failed: ${msg}` }, { status: 500 });
  }

  const { accounts, riskSignals } = scanResult;

  // AI analysis with Claude
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ ...scanResult, aiAnalysis: null });
  }

  const client = new Anthropic({ apiKey });

  const prompt = `You are a Solana security expert. Analyze these Durable Nonce accounts for wallet ${wallet.slice(0, 8)}...

Nonce Accounts Found: ${accounts.length}
${accounts.map(a => `- Address: ${a.address.slice(0, 12)}..., Authority: ${a.authority.slice(0, 12)}..., Owned by user: ${a.isOwned}`).join("\n")}

Risk Signals Detected: ${riskSignals.length}
${riskSignals.map(r => `- [${r.severity.toUpperCase()}] ${r.type}: ${r.description}`).join("\n")}

Background: On April 1, 2026, a $285M exploit used Durable Nonces — pre-signed transactions that never expire, invisible to standard wallets. If a malicious nonce account exists where the authority is NOT the user's wallet, an attacker can submit pre-signed transactions at any time.

Provide a concise security assessment in Chinese (Traditional):
1. Overall risk level (低/中/高/極高)
2. What the specific findings mean for this wallet
3. Immediate action items (if any)
4. Max 200 words.`;

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    });

    const aiAnalysis = message.content[0].type === "text" ? message.content[0].text : null;
    return NextResponse.json({ ...scanResult, aiAnalysis });
  } catch (err) {
    console.error("[nonce-guardian] AI analysis error:", err);
    return NextResponse.json({ ...scanResult, aiAnalysis: null });
  }
}
