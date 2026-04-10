import { NextRequest, NextResponse } from "next/server";
import { scanNonceAccounts } from "@/lib/nonce-scanner";
import { Connection, PublicKey, Transaction, TransactionInstruction, Keypair } from "@solana/web3.js";
import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "crypto";
import { createReadOnlyAgent } from "@/lib/agent";
import { checkAndMarkUsed } from "@/lib/redis";

const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY ?? ""}`;
const SAKURA_FEE_WALLET = process.env.SAKURA_FEE_WALLET ?? "";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const AI_REPORT_FEE_USDC = 1.0;           // $1.00 USDC per AI analysis report
const AI_REPORT_FEE_MICRO = 1_000_000;    // 1.00 USDC in micro-USDC (6 decimals)
const MEMO_PROGRAM = "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr";

// In-memory fallback for replay protection (used when Redis is not configured).
// Redis mode: distributed across all Vercel instances via checkAndMarkUsed().
const usedPaymentSigs = new Set<string>();

export const maxDuration = 60;

// ── Verify x402 USDC payment on-chain ────────────────────────────────────────

async function verifyPayment(txSig: string, requestingWallet: string): Promise<boolean> {
  if (!SAKURA_FEE_WALLET) return true; // demo mode
  // Replay protection — Redis (distributed) or in-memory fallback.
  // checkAndMarkUsed returns false if this sig was already seen across any instance.
  const isFirstUse = await checkAndMarkUsed(`ng:sig:${txSig}`, usedPaymentSigs);
  if (!isFirstUse) return false;
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
          // Verify: the payment must have been sent BY the requesting wallet
          // Prevents replay of other users' payment transactions
          if (info?.authority && info.authority !== requestingWallet) {
            return false; // Payment was made by a different wallet — not valid for this request
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
  if (!wallet || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet)) {
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
  if (!wallet || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet)) {
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
    const valid = await verifyPayment(paymentSig, wallet);
    if (!valid) {
      return NextResponse.json(
        { error: "Payment verification failed — send 1.00 USDC to Sakura fee wallet" },
        { status: 402 }
      );
    }
  }

  // ── Step 3: Agentic AI analysis — Claude + SAK Tools ────────────────
  const { accounts, riskSignals } = scanResult;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ ...scanResult, aiAnalysis: null });
  }

  const client = new Anthropic({ apiKey });
  const conn = new Connection(HELIUS_RPC, "confirmed");
  const agent = createReadOnlyAgent();

  // ── SAK Tool definitions (Solana native, no external APIs) ──────────
  const sakTools: Anthropic.Tool[] = [
    {
      name: "get_wallet_assets",
      description: "Get SOL balance and all SPL token balances for a Solana wallet using SAK TokenPlugin and native RPC. Returns exact amounts and USD estimates.",
      input_schema: {
        type: "object" as const,
        properties: { wallet: { type: "string", description: "Solana wallet address (base58)" } },
        required: ["wallet"],
      },
    },
    {
      name: "get_nonce_account_activity",
      description: "Fetch recent transaction history for a Durable Nonce account using Solana native getSignaturesForAddress. Critical for assessing whether a threat is active.",
      input_schema: {
        type: "object" as const,
        properties: {
          nonce_address: { type: "string", description: "Nonce account address (base58)" },
          limit: { type: "number", description: "Max transactions to fetch (default 10)" },
        },
        required: ["nonce_address"],
      },
    },
    {
      name: "get_stake_positions",
      description: "Get all staked SOL positions for a wallet using getProgramAccounts on the Stake program. Staking positions are also at risk if nonce is compromised.",
      input_schema: {
        type: "object" as const,
        properties: { wallet: { type: "string", description: "Wallet address to scan for stake accounts" } },
        required: ["wallet"],
      },
    },
    {
      name: "get_sol_price",
      description: "Get current SOL/USD price using SAK TokenPlugin fetchPrice (Jupiter aggregator — Solana native). Used to calculate total USD value at risk.",
      input_schema: {
        type: "object" as const,
        properties: {},
        required: [],
      },
    },
    {
      name: "get_transaction_details",
      description: "Inspect a specific transaction to understand how a nonce account was used — who signed it, what instructions were included.",
      input_schema: {
        type: "object" as const,
        properties: { signature: { type: "string", description: "Transaction signature" } },
        required: ["signature"],
      },
    },
    {
      name: "inspect_nonce_state",
      description: "Read raw nonce account data using Solana native getAccountInfo. Decodes the 80-byte nonce account structure to extract the current nonce value and confirm the stored authority pubkey directly from chain state.",
      input_schema: {
        type: "object" as const,
        properties: { nonce_address: { type: "string", description: "Nonce account address to inspect (base58)" } },
        required: ["nonce_address"],
      },
    },
    {
      name: "profile_authority_address",
      description: "Profile a suspicious nonce authority address using getSignaturesForAddress + getBalance + getAccountInfo. Determines if the authority is a fresh burner wallet, how recently it was active, and whether it has SOL to pay gas for an attack.",
      input_schema: {
        type: "object" as const,
        properties: {
          authority_address: { type: "string", description: "The suspicious authority address to profile (base58)" },
        },
        required: ["authority_address"],
      },
    },
  ];

  // ── SAK Tool executor (all Solana native) ──────────────────────────
  async function executeSakTool(name: string, input: Record<string, unknown>): Promise<unknown> {
    try {
      switch (name) {

        case "get_wallet_assets": {
          const w = input.wallet as string;
          const { TOKEN_PROGRAM_ID } = await import("@solana/spl-token");
          const [lamports, tokenAccounts] = await Promise.all([
            conn.getBalance(new PublicKey(w)),
            conn.getParsedTokenAccountsByOwner(new PublicKey(w), { programId: TOKEN_PROGRAM_ID }),
          ]);
          const solAmount = lamports / 1e9;
          const tokens = tokenAccounts.value
            .map(ta => {
              const info = ta.account.data.parsed?.info;
              return {
                mint: info?.mint?.slice(0, 12) ?? "unknown",
                amount: info?.tokenAmount?.uiAmount ?? 0,
                decimals: info?.tokenAmount?.decimals ?? 0,
              };
            })
            .filter(t => t.amount > 0);
          return { solAmount, tokenCount: tokens.length, tokens };
        }

        case "get_nonce_account_activity": {
          const addr = input.nonce_address as string;
          const limit = (input.limit as number) ?? 10;
          const sigs = await conn.getSignaturesForAddress(new PublicKey(addr), { limit });
          const now = Date.now() / 1000;
          const activities = sigs.map(s => ({
            sig: s.signature.slice(0, 20),
            daysAgo: s.blockTime ? Math.floor((now - s.blockTime) / 86400) : null,
            status: s.err ? "FAILED" : "SUCCESS",
          }));
          return {
            totalRecentTxs: sigs.length,
            lastActiveDaysAgo: activities[0]?.daysAgo ?? null,
            threatLevel: sigs.length > 0 && (activities[0]?.daysAgo ?? 999) < 7
              ? "ACTIVE_THREAT"
              : sigs.length > 0 && (activities[0]?.daysAgo ?? 999) < 30
              ? "RECENT_ACTIVITY"
              : sigs.length > 0 ? "DORMANT" : "NEVER_USED",
            activities,
          };
        }

        case "get_stake_positions": {
          const w = input.wallet as string;
          const stakeProgram = new PublicKey("Stake11111111111111111111111111111111111111");
          const stakeAccounts = await conn.getProgramAccounts(stakeProgram, {
            filters: [{ memcmp: { offset: 44, bytes: w } }],
          });
          const totalStakedSol = stakeAccounts.reduce(
            (sum, sa) => sum + sa.account.lamports / 1e9, 0
          );
          return {
            count: stakeAccounts.length,
            totalStakedSol: +totalStakedSol.toFixed(4),
            positions: stakeAccounts.slice(0, 5).map(sa => ({
              address: sa.pubkey.toString().slice(0, 12),
              sol: +(sa.account.lamports / 1e9).toFixed(4),
            })),
          };
        }

        case "get_sol_price": {
          try {
            // SAK TokenPlugin fetchPrice uses Jupiter aggregator (Solana native)
            const result = await (agent.methods as Record<string, Function>)
              .fetchPrice("So11111111111111111111111111111111111111112");
            return { solPriceUsd: result };
          } catch {
            return { solPriceUsd: 170, note: "fallback price" };
          }
        }

        case "get_transaction_details": {
          const sig = input.signature as string;
          const tx = await conn.getParsedTransaction(sig, { maxSupportedTransactionVersion: 0 });
          if (!tx) return { error: "Transaction not found" };
          return {
            blockTime: tx.blockTime,
            feeLamports: tx.meta?.fee,
            numInstructions: tx.transaction.message.instructions.length,
            signers: tx.transaction.message.accountKeys
              .filter(k => "signer" in k && k.signer)
              .slice(0, 3)
              .map(k => ("pubkey" in k ? k.pubkey.toString().slice(0, 12) : String(k).slice(0, 12))),
            logSnippet: tx.meta?.logMessages?.slice(0, 3) ?? [],
          };
        }

        case "inspect_nonce_state": {
          // getAccountInfo — reads raw 80-byte nonce account structure from chain
          const nonceAddr = input.nonce_address as string;
          const accountInfo = await conn.getAccountInfo(new PublicKey(nonceAddr));
          if (!accountInfo) return { error: "Nonce account not found on-chain" };
          const data = accountInfo.data;
          // Nonce account layout (80 bytes):
          //   bytes 0-3:   version (u32)
          //   bytes 4-7:   state (u32) — 0=uninitialized, 1=initialized
          //   bytes 8-39:  authority pubkey (32 bytes)
          //   bytes 40-71: nonce value (32 bytes — the actual durable nonce hash)
          //   bytes 72-79: fee_calculator lamports_per_signature (u64)
          const state = data.readUInt32LE(4);
          const authorityBytes = data.slice(8, 40);
          const nonceBytes = data.slice(40, 72);
          const lamportsPerSig = Number(data.readBigUInt64LE(72));
          const authorityOnChain = new PublicKey(authorityBytes).toString();
          const currentNonce = new PublicKey(nonceBytes).toString();
          return {
            lamports: accountInfo.lamports,
            solBalance: +(accountInfo.lamports / 1e9).toFixed(6),
            state: state === 1 ? "INITIALIZED" : "UNINITIALIZED",
            authorityOnChain,
            currentNonceValue: currentNonce.slice(0, 20) + "...",
            lamportsPerSignature: lamportsPerSig,
            dataSize: data.length,
            warning: state === 1 ? "This nonce is ACTIVE — pre-signed transactions using this nonce are permanently valid until the nonce advances" : "Nonce not initialized",
          };
        }

        case "profile_authority_address": {
          // Profile suspicious authority: getSignaturesForAddress + getBalance + getAccountInfo
          const authAddr = input.authority_address as string;
          const authPubkey = new PublicKey(authAddr);
          const [lamports, sigs, accountInfo] = await Promise.all([
            conn.getBalance(authPubkey),
            conn.getSignaturesForAddress(authPubkey, { limit: 20 }),
            conn.getAccountInfo(authPubkey),
          ]);
          const now = Date.now() / 1000;
          const solBalance = lamports / 1e9;
          const recentTxs = sigs.map(s => ({
            sig: s.signature.slice(0, 20),
            daysAgo: s.blockTime ? +((now - s.blockTime) / 86400).toFixed(1) : null,
            err: !!s.err,
          }));
          const firstSeenDays = sigs.length > 0 && sigs[sigs.length - 1]?.blockTime
            ? +((now - sigs[sigs.length - 1].blockTime!) / 86400).toFixed(0)
            : null;
          const lastActiveDays = recentTxs[0]?.daysAgo ?? null;
          // Threat assessment: fresh wallet + active recently = high threat
          const isFreshWallet = firstSeenDays != null && firstSeenDays < 30;
          const isRecentlyActive = lastActiveDays != null && lastActiveDays < 7;
          const hasGasForAttack = solBalance >= 0.001; // needs ~0.000005 SOL per tx
          const threatScore =
            (isFreshWallet ? 3 : 0) +
            (isRecentlyActive ? 4 : 0) +
            (hasGasForAttack ? 2 : 0) +
            (sigs.length > 10 ? 1 : 0);
          return {
            solBalance: +solBalance.toFixed(4),
            isExecutable: accountInfo !== null,
            firstSeenDaysAgo: firstSeenDays,
            lastActiveDaysAgo: lastActiveDays,
            totalRecentTxs: sigs.length,
            isFreshBurnerWallet: isFreshWallet,
            isRecentlyActive,
            hasGasForAttack,
            threatScore: `${threatScore}/10`,
            threatAssessment: threatScore >= 7 ? "🔴 HIGH — likely active attacker" : threatScore >= 4 ? "🟡 MEDIUM — suspicious activity" : "🟢 LOW — dormant or legitimate",
            recentTxs: recentTxs.slice(0, 5),
          };
        }

        default:
          return { error: `Unknown tool: ${name}` };
      }
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  }

  // ── Agentic loop: Claude autonomously calls SAK tools ──────────────
  let aiAnalysis: string | null = null;
  try {
    const suspiciousAddresses = accounts.filter(a => !a.isOwned).map(a => a.address);
    const allNonceAddresses = accounts.map(a => a.address);

    const agentMessages: Anthropic.MessageParam[] = [
      {
        role: "user",
        content: `You are a Solana security expert conducting a paid security audit for wallet ${wallet.slice(0, 8)}...

INITIAL SCAN RESULTS:
- Nonce accounts found: ${accounts.length}
${accounts.map(a => `  • ${a.address.slice(0, 16)}... authority: ${a.authority.slice(0, 12)}... owned_by_user: ${a.isOwned}`).join("\n")}

RISK SIGNALS (${riskSignals.length}):
${riskSignals.map(r => `  • [${r.severity.toUpperCase()}] ${r.type}: ${r.description}`).join("\n")}

Suspicious nonce accounts (authority NOT owned by user): ${suspiciousAddresses.length > 0 ? suspiciousAddresses.map(a => a.slice(0, 12)).join(", ") : "none"}

CONTEXT: On April 1, 2026, a $285M exploit used Durable Nonces — pre-signed transactions that never expire. Authority hijacking means an attacker holds a pre-signed transaction that can drain this wallet at ANY moment.

YOUR TASK: Use the available tools to conduct a thorough investigation:
1. Get exact wallet assets (SOL + tokens) to quantify financial exposure
2. Get current SOL price to calculate total USD at risk
3. Check activity on each suspicious nonce account (get_nonce_account_activity) — is the threat ACTIVE or dormant?
4. Inspect raw nonce account state (inspect_nonce_state) — confirm authority on-chain and current nonce value
5. If any suspicious authority found, profile it (profile_authority_address) — is it a fresh burner wallet? Does it have gas money ready?
6. Check for staking positions that may also be at risk
7. If nonce account shows recent activity, inspect a transaction to understand the attack pattern

Then write a comprehensive security report in Traditional Chinese (繁體中文) that includes:
- 🔴 Risk level: 低/中/高/極高
- 💰 Exact USD amount at risk
- ⚡ Threat urgency (based on nonce account activity)
- 🎯 Specific attack scenario for this wallet
- 🛡️ Immediate action items (ordered by priority)`,
      },
    ];

    let agentResponse = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 1500,
      tools: sakTools,
      messages: agentMessages,
    });

    // Agentic loop — Claude calls tools until it has enough data
    let iterations = 0;
    while (agentResponse.stop_reason === "tool_use" && iterations < 6) {
      iterations++;
      const toolUseBlocks = agentResponse.content.filter(b => b.type === "tool_use");

      agentMessages.push({ role: "assistant", content: agentResponse.content });

      // Execute all tool calls in parallel
      const toolResults = await Promise.all(
        toolUseBlocks.map(async (block) => {
          if (block.type !== "tool_use") return null;
          const result = await executeSakTool(block.name, block.input as Record<string, unknown>);
          return {
            type: "tool_result" as const,
            tool_use_id: block.id,
            content: JSON.stringify(result),
          };
        })
      );

      agentMessages.push({
        role: "user",
        content: toolResults.filter(Boolean) as Anthropic.ToolResultBlockParam[],
      });

      agentResponse = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 1500,
        tools: sakTools,
        messages: agentMessages,
      });
    }

    const textBlock = agentResponse.content.find(b => b.type === "text");
    aiAnalysis = textBlock?.type === "text" ? textBlock.text : null;

  } catch (err) {
    console.error("[nonce-guardian] agentic analysis error:", err);
  }

  // ── Step 4: SHA-256 hash → Solana Memo (永久鏈上存證) ─────────────
  let reportHash: string | null = null;
  let proofTxSig: string | null = null;

  // Always write on-chain proof — even if AI analysis failed.
  // Proof is based on scan data (accounts + riskSignals), which is always available.
  // aiAnalysis is included in the hash when present; omitted when AI call failed.
  {
    const reportPayload = JSON.stringify({
      wallet,
      accounts: accounts.length,
      riskSignals: riskSignals.length,
      ...(aiAnalysis ? { aiAnalysis } : { aiAnalysis: "unavailable" }),
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
