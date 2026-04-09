import { NextRequest, NextResponse } from "next/server";
import { scanNonceAccounts } from "@/lib/nonce-scanner";
import { Connection, PublicKey, Transaction, TransactionInstruction, Keypair } from "@solana/web3.js";
import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "crypto";

const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY ?? ""}`;
const SAKURA_FEE_WALLET = process.env.SAKURA_FEE_WALLET ?? "";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const AI_REPORT_FEE_USDC = 1.0;           // $1.00 USDC per AI analysis report
const AI_REPORT_FEE_MICRO = 1_000_000;    // 1.00 USDC in micro-USDC (6 decimals)
const MEMO_PROGRAM = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";

export const maxDuration = 60;

// ── Verify x402 USDC payment on-chain ────────────────────────────────────────

async function verifyPayment(txSig: string): Promise<boolean> {
  if (!SAKURA_FEE_WALLET) return true; // demo mode
  try {
    const { getAssociatedTokenAddressSync } = await import("@solana/spl-token");
    const conn = new Connection(HELIUS_RPC, "confirmed");
    const feeWalletAta = getAssociatedTokenAddressSync(
      new PublicKey(USDC_MINT),
      new PublicKey(SAKURA_FEE_WALLET)
    ).toString();

    const tx = await conn.getParsedTransaction(txSig, { maxSupportedTransactionVersion: 0 });
    if (!tx) return false;

    for (const ix of tx.transaction.message.instructions) {
      if ("parsed" in ix && ix.parsed?.type === "transferChecked") {
        const info = ix.parsed.info;
        if (
          info?.mint === USDC_MINT &&
          info?.destination === feeWalletAta &&
          Number(info?.tokenAmount?.amount ?? 0) >= AI_REPORT_FEE_MICRO
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

// ── Write SHA-256 report hash to Solana Memo Program ─────────────────────────

async function writeReportHashOnChain(
  reportHash: string,
  wallet: string,
  paymentSig: string
): Promise<string | null> {
  try {
    const rawKey = process.env.SAKURA_AGENT_PRIVATE_KEY;
    if (!rawKey) return null;

    const conn = new Connection(HELIUS_RPC, "confirmed");
    const agentKp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(rawKey)));

    // Memo payload: permanently records report hash, wallet, payment proof
    const memoPayload = JSON.stringify({
      event: "sakura_nonce_report",
      sha256: reportHash,
      wallet: wallet.slice(0, 8),
      paymentRef: paymentSig.slice(0, 20),
      ts: new Date().toISOString(),
    });

    const memoIx = new TransactionInstruction({
      keys: [{ pubkey: agentKp.publicKey, isSigner: true, isWritable: false }],
      programId: new PublicKey(MEMO_PROGRAM),
      data: Buffer.from(memoPayload),
    });

    const tx = new Transaction().add(memoIx);
    tx.feePayer = agentKp.publicKey;
    const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash("confirmed");
    tx.recentBlockhash = blockhash;
    tx.sign(agentKp);

    const sig = await conn.sendRawTransaction(tx.serialize(), { skipPreflight: false });
    await conn.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
    return sig;
  } catch (err) {
    console.error("[nonce-guardian] on-chain hash write failed:", err);
    return null;
  }
}

// ── GET: free scan ────────────────────────────────────────────────────────────

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
    return NextResponse.json({ error: `Scan failed: ${msg}` }, { status: 500 });
  }
}

// ── POST: AI report (x402 — $1.00 USDC + SHA-256 on-chain) ───────────────────

export async function POST(req: NextRequest) {
  let body: { wallet?: string } = {};
  try { body = await req.json(); } catch { /* ok */ }

  const wallet = body.wallet;
  if (!wallet || wallet.length < 32 || wallet.length > 44) {
    return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
  }

  // ── Step 1: Free scan ─────────────────────────────────────────────
  let scanResult;
  try {
    scanResult = await scanNonceAccounts(wallet, HELIUS_RPC);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Scan failed: ${msg}` }, { status: 500 });
  }

  // ── Step 2: x402 Gate — $1.00 USDC for AI report ─────────────────
  const paymentSig = req.headers.get("x-payment") ?? req.headers.get("X-PAYMENT");

  if (!paymentSig && SAKURA_FEE_WALLET) {
    return NextResponse.json(
      {
        recipient:   SAKURA_FEE_WALLET,
        amount:      AI_REPORT_FEE_USDC,
        currency:    "USDC" as const,
        network:     "solana-mainnet" as const,
        description: "Sakura Nonce Guardian — AI Security Report + SHA-256 永久鏈上存證",
        scanResult,  // free scan included so UI can show basic results
      },
      {
        status: 402,
        headers: {
          "X-Payment-Required":  "true",
          "X-Payment-Amount":    String(AI_REPORT_FEE_USDC),
          "X-Payment-Currency":  "USDC",
          "X-Payment-Recipient": SAKURA_FEE_WALLET,
          "X-Payment-Network":   "solana-mainnet",
        },
      }
    );
  }

  // Verify payment on-chain
  if (paymentSig && SAKURA_FEE_WALLET) {
    const valid = await verifyPayment(paymentSig);
    if (!valid) {
      return NextResponse.json(
        { error: "Payment verification failed — send 1.00 USDC to Sakura fee wallet" },
        { status: 402 }
      );
    }
  }

  // ── Step 3: Claude AI analysis ────────────────────────────────────
  const { accounts, riskSignals } = scanResult;
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

  let aiAnalysis: string | null = null;
  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    });
    aiAnalysis = message.content[0].type === "text" ? message.content[0].text : null;
  } catch (err) {
    console.error("[nonce-guardian] AI analysis error:", err);
  }

  // ── Step 4: SHA-256 hash → Solana Memo (永久鏈上存證) ─────────────
  let reportHash: string | null = null;
  let proofTxSig: string | null = null;

  if (aiAnalysis) {
    // Hash the complete report: analysis + scan data + wallet + timestamp
    const reportPayload = JSON.stringify({
      wallet,
      accounts: accounts.length,
      riskSignals: riskSignals.length,
      aiAnalysis,
      generatedAt: new Date().toISOString(),
    });
    reportHash = createHash("sha256").update(reportPayload).digest("hex");

    // Write hash permanently to Solana blockchain
    proofTxSig = await writeReportHashOnChain(
      reportHash,
      wallet,
      paymentSig ?? "demo"
    );
  }

  return NextResponse.json({
    ...scanResult,
    aiAnalysis,
    // On-chain proof
    proof: reportHash ? {
      sha256:    reportHash,
      txSig:     proofTxSig,
      explorerUrl: proofTxSig
        ? `https://solscan.io/tx/${proofTxSig}`
        : null,
      message:   "此報告已永久記錄於 Solana 鏈上，SHA-256 哈希獨立可驗證",
    } : null,
  });
}
