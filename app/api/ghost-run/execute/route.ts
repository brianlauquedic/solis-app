/**
 * Ghost Run — Execute API
 *
 * POST /api/ghost-run/execute
 * Body: { steps: StrategyStep[], wallet: string }
 *
 * Executes confirmed strategy steps via SAK + Jupiter.
 * Ghost Run charges 0.3% platform fee (platformFeeBps: 30) on every swap
 * via Jupiter's native integrator fee — embedded in the transaction, zero friction.
 * Writes on-chain execution proof via Solana Memo Program.
 */
import { NextRequest, NextResponse } from "next/server";
import { Connection } from "@solana/web3.js";
import { createSigningAgent, RPC_URL } from "@/lib/agent";
import { getConnection } from "@/lib/rpc";
import type { StrategyStep } from "@/lib/ghost-run";
import { getWalletLimiter, checkWalletLimitMemory } from "@/lib/redis";

export const maxDuration = 120;

const SAKURA_FEE_WALLET = process.env.SAKURA_FEE_WALLET?.trim() || "";
const PLATFORM_FEE_BPS = 30; // 0.3% — competitive vs Phantom (0.85%)

// Prevent platform wallet drain: cap per-step amounts on server-signed operations.
// stake/lend use the platform signing agent's wallet — limits bound the financial exposure.
const MAX_STAKE_SOL_PER_STEP  = 5;    // max 5 SOL per stake (platform wallet limit)
const MAX_LEND_AMOUNT_PER_STEP = 500; // max $500 equivalent per lend step

export async function POST(req: NextRequest) {
  let body: { steps?: StrategyStep[]; wallet?: string } = {};
  try { body = await req.json(); } catch { /* ok */ }

  const { steps, wallet } = body;
  // Validate wallet address format
  if (!steps?.length || !wallet) {
    return NextResponse.json({ error: "Missing steps or wallet" }, { status: 400 });
  }
  // Validate step count (prevent cost amplification)
  if (steps.length > 10) {
    return NextResponse.json({ error: "Maximum 10 steps per execution" }, { status: 400 });
  }
  // Validate wallet is valid base58 (44 chars for base58-encoded 32-byte pubkey)
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet)) {
    return NextResponse.json({ error: "Invalid wallet address format" }, { status: 400 });
  }

  // ── Per-wallet hourly rate limit (Sybil / platform wallet drain defense) ──
  // stake and lend steps use the PLATFORM signing wallet — multiple IPs with the
  // same economic target can rotate around per-IP limits. Wallet-keyed Redis limit
  // ensures 10 executions/hour per wallet across ALL Vercel instances.
  {
    const walletLimiter = getWalletLimiter("ghost-run-execute", 10);
    if (walletLimiter) {
      const { success, reset } = await walletLimiter.limit(wallet);
      if (!success) {
        return NextResponse.json(
          { error: "Rate limit exceeded. Max 10 executions per hour per wallet." },
          { status: 429, headers: { "Retry-After": String(Math.max(1, Math.ceil((reset - Date.now()) / 1000))), "X-RateLimit-Scope": "wallet", "X-RateLimit-Mode": "distributed" } }
        );
      }
    } else {
      const { blocked, retryAfter } = checkWalletLimitMemory("ghost-run-execute", wallet, 10);
      if (blocked) {
        return NextResponse.json(
          { error: "Rate limit exceeded. Max 10 executions per hour per wallet." },
          { status: 429, headers: { "Retry-After": String(retryAfter ?? 3600), "X-RateLimit-Scope": "wallet", "X-RateLimit-Mode": "memory" } }
        );
      }
    }
  }

  const agent = createSigningAgent();
  if (!agent) {
    return NextResponse.json({ error: "Agent not configured (SAKURA_AGENT_PRIVATE_KEY missing)" }, { status: 500 });
  }

  // Module 16: multi-RPC failover — auto-selects healthiest endpoint
  const conn = await getConnection("confirmed");
  const signatures: string[] = [];
  const errors: string[] = [];
  const unsignedSwapTxs: Array<{ stepIdx: number; token: string; swapTransaction: string }> = [];
  let platformFeeInjected = false; // tracks whether 0.3% fee was actually embedded

  for (let stepIdx = 0; stepIdx < steps.length; stepIdx++) {
    const step = steps[stepIdx];
    try {
      let sig: string | undefined;

      if (step.type === "stake" && step.outputToken === "mSOL") {
        if (step.inputAmount > MAX_STAKE_SOL_PER_STEP) throw new Error(`Stake amount exceeds per-step limit of ${MAX_STAKE_SOL_PER_STEP} SOL`);
        // Marinade liquid stake via Jupiter
        const result = await (agent as unknown as {
          stakeWithJup: (amount: number) => Promise<string>
        }).stakeWithJup(step.inputAmount);
        sig = result;
        if (sig) await conn.confirmTransaction(sig, "confirmed");
      } else if (step.type === "stake" && step.outputToken === "jitoSOL") {
        if (step.inputAmount > MAX_STAKE_SOL_PER_STEP) throw new Error(`Stake amount exceeds per-step limit of ${MAX_STAKE_SOL_PER_STEP} SOL`);
        // Jito liquid stake via Jupiter
        const result = await (agent as unknown as {
          stakeWithJup: (amount: number, validator?: string) => Promise<string>
        }).stakeWithJup(step.inputAmount, "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn");
        sig = result;
        if (sig) await conn.confirmTransaction(sig, "confirmed");
      } else if (step.type === "lend") {
        if (step.inputAmount > MAX_LEND_AMOUNT_PER_STEP) throw new Error(`Lend amount exceeds per-step limit of ${MAX_LEND_AMOUNT_PER_STEP}`);
        const result = await (agent as unknown as {
          lendAsset: (assetMint: string, amount: number) => Promise<string>
        }).lendAsset(
          step.inputToken === "USDC"
            ? "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
            : "So11111111111111111111111111111111111111112",
          step.inputAmount
        );
        sig = result;
        if (sig) await conn.confirmTransaction(sig, "confirmed");
      } else if (step.type === "swap") {
        const { PublicKey, VersionedTransaction } = await import("@solana/web3.js");
        const { getConnection: getConn } = await import("@/lib/rpc");
        const conn = await getConn("confirmed");
        const { TOKEN_MINTS, TOKEN_DECIMALS } = await import("@/lib/ghost-run");

        const inputMint = TOKEN_MINTS[step.inputToken] ?? step.inputToken;
        const outputMint = TOKEN_MINTS[step.outputToken] ?? step.outputToken;
        const inDecimals = TOKEN_DECIMALS[step.inputToken] ?? 9;
        const inputLamports = Math.round(step.inputAmount * Math.pow(10, inDecimals));

        // Get Jupiter quote
        const quoteRes = await fetch(
          `https://quote-api.jup.ag/v6/quote?inputMint=${inputMint}&outputMint=${outputMint}&amount=${inputLamports}&slippageBps=50`
        );
        if (!quoteRes.ok) throw new Error("Jupiter quote failed");
        const quote = await quoteRes.json();

        // Compute feeAccount = Sakura fee wallet's ATA for output token
        // Jupiter will collect 0.3% of output amount into this account
        let feeAccount: string | undefined;
        if (SAKURA_FEE_WALLET) {
          try {
            const { getAssociatedTokenAddressSync } = await import("@solana/spl-token");
            feeAccount = getAssociatedTokenAddressSync(
              new PublicKey(outputMint),
              new PublicKey(SAKURA_FEE_WALLET)
            ).toString();
          } catch { /* skip fee if ATA computation fails */ }
        }

        // Get swap transaction — inject 0.3% platform fee
        const swapBody: Record<string, unknown> = {
          quoteResponse: quote,
          userPublicKey: wallet,
          wrapAndUnwrapSol: true,
        };

        if (feeAccount && SAKURA_FEE_WALLET) {
          swapBody.platformFeeBps = PLATFORM_FEE_BPS; // 0.3%
          swapBody.feeAccount = feeAccount;
          platformFeeInjected = true;
        }

        const swapRes = await fetch("https://quote-api.jup.ag/v6/swap", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(swapBody),
        });
        if (!swapRes.ok) throw new Error("Jupiter swap build failed");
        const { swapTransaction } = await swapRes.json();

        // ── Return unsigned transaction for frontend wallet signing ──────
        // Jupiter swap transactions MUST be signed by the user's private key.
        // The platform cannot sign on behalf of the user (non-custodial).
        // Frontend receives swapTransaction and signs via wallet adapter.
        unsignedSwapTxs.push({
          stepIdx,
          token: `${step.inputToken}→${step.outputToken}`,
          swapTransaction, // base64-encoded unsigned VersionedTransaction
        });
        // Do NOT call sendRawTransaction here — user must sign first
      }

      if (sig) signatures.push(sig);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${step.type} ${step.inputToken}→${step.outputToken}: ${msg}`);
    }
  }

  // Write on-chain execution proof via Memo Program
  let memoSig: string | null = null;
  if (signatures.length > 0) {
    try {
      const proofText = JSON.stringify({
        event: "sakura_ghost_run_executed",
        wallet: wallet.slice(0, 8),
        steps: steps.length,
        platformFeeBps: PLATFORM_FEE_BPS,
        signatures: signatures.map(s => s.slice(0, 12)),
        ts: new Date().toISOString(),
      });

      const execBaseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`;
      if (execBaseUrl) {
        const execMemoHeaders: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (process.env.INTERNAL_API_SECRET) {
          execMemoHeaders["x-internal-secret"] = process.env.INTERNAL_API_SECRET;
        }
        const memoRes = await fetch(`${execBaseUrl}/api/agent/memo`, {
          method: "POST",
          headers: execMemoHeaders,
          body: JSON.stringify({ memoPayload: proofText }),
        }).catch(() => null);

        if (memoRes?.ok) {
          const memoData = await memoRes.json();
          memoSig = memoData.txSignature ?? memoData.signature ?? null;
        }
      }
    } catch { /* memo is optional */ }
  }

  const hasSwaps = unsignedSwapTxs.length > 0;
  return NextResponse.json({
    success: errors.length === 0,
    signatures,
    unsignedSwapTxs,
    requiresUserSignature: hasSwaps,
    memoSig,
    platformFeeInjected,
    platformFee: hasSwaps
      ? (platformFeeInjected
          ? `${PLATFORM_FEE_BPS / 100}% 平台費已嵌入 Jupiter 兌換交易`
          : "⚠️ 平台費未能嵌入（費錢包未配置），本次兌換免費")
      : "無兌換步驟，不收平台費",
    errors,
  });
}
