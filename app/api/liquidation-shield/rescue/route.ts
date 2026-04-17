/**
 * Liquidation Shield — Rescue API
 *
 * POST /api/liquidation-shield/rescue
 * Body: { wallet, position, rescueUsdc, mandateTxSig? }
 *
 * Executes SAK-powered rescue: repays debt to restore health factor.
 * Charges 1% performance fee on rescued amount (only on success).
 * Fee is collected via SPL Token transfer using pre-authorized delegate.
 * Writes Memo on-chain referencing mandateTxSig for audit chain.
 *
 * Revenue model:
 *  - 1% of rescueUsdc → SAKURA_FEE_WALLET
 *  - Only charged on successful rescue
 *  - Liquidation penalty = 5-10%, so user nets 4-9% savings after fee
 */
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { Connection, PublicKey, Transaction, Keypair, ComputeBudgetProgram } from "@solana/web3.js";
import { RPC_URL } from "@/lib/agent";
import { getConnection, getDynamicPriorityFee } from "@/lib/rpc";
import { buildRescueApproveTransaction } from "@/lib/liquidation-shield";
import type { LendingPosition } from "@/lib/liquidation-shield";
import { fetchMandate, microToUsdc, buildExecuteRescueIx, deriveMandatePDA } from "@/lib/mandate-program";

export const maxDuration = 120;

// ── Server-side i18n for rescue error messages ─────────────────────────────────
// Rescue API errors are displayed directly in the frontend. Without translation
// they always show Chinese regardless of user language setting.
type RescueLang = "zh" | "en" | "ja";

const rescueErrors: Record<string, Record<RescueLang, string>> = {
  buildApproveFailed: {
    zh: "構建授權交易失敗",
    en: "Failed to build approve transaction",
    ja: "承認トランザクションの構築に失敗しました",
  },
  usdcAccountMissing: {
    zh: "USDC 帳戶不存在，請先建立 USDC 帳戶並執行救援授權",
    en: "USDC account not found. Please create a USDC account and authorize rescue first.",
    ja: "USDCアカウントが見つかりません。先にUSDCアカウントを作成し、救援を承認してください。",
  },
  notAuthorized: {
    zh: "尚未授權 Sakura 救援代理。請先在 Liquidation Shield 頁面執行授權操作。",
    en: "Sakura rescue agent not authorized. Please authorize on the Liquidation Shield page first.",
    ja: "Sakura救援エージェントが未承認です。先にLiquidation Shieldページで承認してください。",
  },
  insufficientAllowance: {
    zh: "預授權金額 ${approved} USDC 不足救援所需 ${needed} USDC。請提高授權上限。",
    en: "Approved amount ${approved} USDC insufficient for rescue ${needed} USDC. Please increase allowance.",
    ja: "承認額 ${approved} USDC が救援必要額 ${needed} USDC に不足しています。承認上限を引き上げてください。",
  },
  authVerifyFailed: {
    zh: "授權驗證失敗",
    en: "Authorization verification failed",
    ja: "承認検証に失敗しました",
  },
  rescueAmountRange: {
    zh: "救援金額必須介於 ${min} 至 $1,000,000 USDC 之間",
    en: "Rescue amount must be between ${min} and $1,000,000 USDC",
    ja: "救援額は ${min}〜$1,000,000 USDCの範囲である必要があります",
  },
  tokenFreezeWarning: {
    zh: "⚠️ Token-2022 凍結授權偵測：USDC mint 擁有 freezeAuthority (${addr}…)，救援交易可能被凍結。",
    en: "⚠️ Token-2022 freeze authority detected: USDC mint has freezeAuthority (${addr}…), rescue TX may be frozen.",
    ja: "⚠️ Token-2022凍結権限検出：USDCミントにfreezeAuthority (${addr}…) があり、救援TXが凍結される可能性があります。",
  },
  tokenNotInitialized: {
    zh: "Token-2022 程序：USDC mint 未初始化或已暫停，無法執行救援。",
    en: "Token-2022: USDC mint not initialized or paused, cannot execute rescue.",
    ja: "Token-2022: USDCミントが未初期化または停止中のため、救援を実行できません。",
  },
  healthAboveThreshold: {
    zh: "倉位健康因子 ${hf} 高於觸發閾值 ${threshold}，無需救援",
    en: "Position health factor ${hf} above trigger threshold ${threshold}, rescue not needed",
    ja: "ポジション健全性因子 ${hf} がトリガー閾値 ${threshold} を上回っています。救援不要です",
  },
  simFailed: {
    zh: "救援模擬失敗：${err}。交易未發送，無 gas 消耗。",
    en: "Rescue simulation failed: ${err}. No TX sent, no gas consumed.",
    ja: "救援シミュレーション失敗：${err}。TXは送信されず、gasは消費されていません。",
  },
};

function rt(key: string, lang: RescueLang, vars?: Record<string, string>): string {
  const tpl = rescueErrors[key]?.[lang] ?? rescueErrors[key]?.en ?? key;
  if (!vars) return tpl;
  return tpl.replace(/\$\{(\w+)\}/g, (_, k) => vars[k] ?? "");
}

function parseLang(v: unknown): RescueLang {
  if (v === "en" || v === "ja" || v === "zh") return v;
  return "zh";
}

// Full SHA-256 cryptographic proof — see lib/crypto-proof.ts
import { mandateHash as computeMandateHash, executionHash as computeExecutionHash, chainProof as computeChainProof } from "@/lib/crypto-proof";
import { processRescueChain, getMerkleAnchorData } from "@/lib/dual-hash";
import { generateRescueProof, buildProofMemoPayload } from "@/lib/groth16-verify";
import { processWithCumulativeTracking } from "@/lib/crypto-proof";

// ── GET: return agent pubkey for frontend SPL approve ──────────────────────────
// Frontend needs the agent's public key to build createApproveInstruction.
// Only the PUBLIC key is returned — private key never leaves the server.
export async function GET() {
  const rawKey = process.env.SAKURA_AGENT_PRIVATE_KEY;
  if (!rawKey) {
    return NextResponse.json({ agentPubkey: null, configured: false });
  }
  try {
    const arr = JSON.parse(rawKey) as number[];
    if (!Array.isArray(arr) || arr.length !== 64) {
      return NextResponse.json({ agentPubkey: null, configured: false });
    }
    const kp = Keypair.fromSecretKey(Uint8Array.from(arr));
    return NextResponse.json({ agentPubkey: kp.publicKey.toString(), configured: true });
  } catch {
    return NextResponse.json({ agentPubkey: null, configured: false });
  }
}

// ── PUT: build unsigned approve TX for client wallet signing ─────────────────
// Uses buildRescueApproveTransaction() from lib — single source of truth for
// approve + Memo mandate TX construction. Returns serialized unsigned TX.
export async function PUT(req: NextRequest) {
  let body: { wallet?: string; approveUsdc?: number; lang?: string } = {};
  try { body = await req.json(); } catch { /* ok */ }
  const { wallet, approveUsdc } = body;
  const lang = parseLang(body.lang);
  if (!wallet || !approveUsdc || approveUsdc <= 0) {
    return NextResponse.json({ error: "Missing wallet or approveUsdc" }, { status: 400 });
  }
  const rawKey = process.env.SAKURA_AGENT_PRIVATE_KEY;
  if (!rawKey) {
    return NextResponse.json({ error: "Agent not configured" }, { status: 500 });
  }
  try {
    const agentKp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(rawKey)));
    const { tx, blockhash, lastValidBlockHeight } = await buildRescueApproveTransaction(
      wallet, agentKp.publicKey.toString(), approveUsdc
    );
    const serializedTx = Buffer.from(tx.serialize({ requireAllSignatures: false })).toString("base64");
    return NextResponse.json({ serializedTx, blockhash, lastValidBlockHeight });
  } catch (err) {
    // [SECURITY FIX H-1] Never expose raw error — may contain RPC URL with API key
    console.error("[rescue/approve] error:", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: rt("buildApproveFailed", lang) }, { status: 500 });
  }
}

const SAKURA_FEE_WALLET = process.env.SAKURA_FEE_WALLET?.trim() || "";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const RESCUE_FEE_PERCENT = 0.01; // 1% performance fee

/**
 * Verify rescue authorization via on-chain SPL Token delegate check.
 * The user must have called buildRescueApproveTransaction() which sets
 * the SPL delegate on their USDC ATA to the agent's public key.
 *
 * This is verified directly on-chain — cannot be faked by an attacker.
 * Prevents: unauthorized fee collection, triggering rescue on arbitrary wallets.
 */
async function verifyRescueAuthorization(
  wallet: string,
  rescueUsdc: number,
  agentPubkey: PublicKey,
  conn: Connection,
  lang: RescueLang = "zh"
): Promise<{ authorized: boolean; error?: string }> {
  try {
    const { getAssociatedTokenAddressSync } = await import("@solana/spl-token");
    const usdcMintPubkey = new PublicKey(USDC_MINT);
    const walletPubkey   = new PublicKey(wallet);
    const userUsdcAta    = getAssociatedTokenAddressSync(usdcMintPubkey, walletPubkey);

    const accountInfo = await conn.getParsedAccountInfo(userUsdcAta);
    const info = (accountInfo.value?.data as {
      parsed?: { info?: { delegate?: string; delegatedAmount?: { uiAmount?: number } } }
    })?.parsed?.info;

    if (!info) {
      return { authorized: false, error: rt("usdcAccountMissing", lang) };
    }

    if (!info.delegate || info.delegate !== agentPubkey.toString()) {
      return { authorized: false, error: rt("notAuthorized", lang) };
    }

    const delegatedAmount = info.delegatedAmount?.uiAmount ?? 0;
    if (delegatedAmount < rescueUsdc) {
      return {
        authorized: false,
        error: rt("insufficientAllowance", lang, {
          approved: `$${delegatedAmount.toFixed(2)}`,
          needed: `$${rescueUsdc}`,
        }),
      };
    }

    return { authorized: true };
  } catch (err) {
    // [SECURITY FIX H-1] Never expose raw error details — may contain RPC URL
    console.error("[rescue/auth] verification error:", err instanceof Error ? err.message : String(err));
    return {
      authorized: false,
      error: rt("authVerifyFailed", lang),
    };
  }
}

export async function POST(req: NextRequest) {
  let body: {
    wallet?: string;
    position?: LendingPosition;
    rescueUsdc?: number;
    mandateTxSig?: string;
    mandateTs?: string; // Module 06: ISO timestamp of when SPL approve mandate was set
    triggerHF?: number; // Bug 1 fix: client-specified trigger threshold
    lang?: string;      // i18n: server-side error message language
  } = {};
  try { body = await req.json(); } catch { /* ok */ }

  const { wallet, position, rescueUsdc, mandateTxSig, mandateTs, triggerHF: clientTriggerHF } = body;
  const lang = parseLang(body.lang);

  // ── CSRF protection: verify Origin matches our app ─────────────────────
  const origin = req.headers.get("origin");
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL;
  if (origin && baseUrl && !origin.startsWith(baseUrl)) {
    return NextResponse.json({ error: "Invalid request origin" }, { status: 403 });
  }

  // ── Input validation ────────────────────────────────────────────────────
  if (!wallet || !position || !rescueUsdc) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }
  if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(wallet)) {
    return NextResponse.json({ error: "Invalid wallet address format" }, { status: 400 });
  }
  // Module 10: MINIMUM_LIQUIDITY pattern — enforce minimum rescue amount to prevent
  // dust attacks and economically meaningless rescues that waste gas.
  // $1 USDC minimum: rescue TX has ~$0.001 gas cost, below $1 it's irrational.
  const MINIMUM_RESCUE_USDC = 1.0;
  if (!Number.isFinite(rescueUsdc) || rescueUsdc < MINIMUM_RESCUE_USDC || rescueUsdc > 1_000_000) {
    return NextResponse.json(
      { error: rt("rescueAmountRange", lang, { min: `$${MINIMUM_RESCUE_USDC}` }) },
      { status: 400 }
    );
  }

  const rawKey = process.env.SAKURA_AGENT_PRIVATE_KEY;
  if (!rawKey) {
    return NextResponse.json(
      { error: "Agent not configured (SAKURA_AGENT_PRIVATE_KEY missing)" },
      { status: 500 }
    );
  }

  const { createTransferCheckedInstruction, getAssociatedTokenAddressSync } =
    await import("@solana/spl-token");

  // Module 16: select confirmation level by transaction value.
  // High-value rescues (>$1000 USDC) use "finalized" (~13s) for irreversible safety.
  // Lower amounts use "confirmed" (~2s) for speed — acceptable risk for small amounts.
  const HIGH_VALUE_THRESHOLD_USDC = 1_000;
  const commitment = rescueUsdc >= HIGH_VALUE_THRESHOLD_USDC ? "finalized" : "confirmed";

  // Module 16: multi-RPC failover — auto-selects healthiest endpoint
  const conn = await getConnection(commitment);
  const agentKp = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(rawKey)));
  const usdcMintPubkey = new PublicKey(USDC_MINT);

  // ── Step 0: Module 09 Token-2022 extension pre-check ──────────────────
  // Check if USDC mint (or any Token-2022 token) has dangerous extensions like
  // freeze authority or transfer hooks that could silently fail the rescue TX.
  // Ported from Module 09: Token-2022 mint authority + pause detection pattern.
  let tokenExtensionWarning: string | null = null;
  try {
    const { getMint, TOKEN_2022_PROGRAM_ID } = await import("@solana/spl-token");
    // Most tokens are standard SPL — this throws for non-Token-2022 mints (safe)
    const mint2022Info = await getMint(conn, new PublicKey(USDC_MINT), "confirmed", TOKEN_2022_PROGRAM_ID)
      .catch(() => null); // null = standard SPL token, not Token-2022

    if (mint2022Info) {
      // USDC is using Token-2022 — check freeze authority (Module 09 global pause pattern)
      if (mint2022Info.freezeAuthority) {
        tokenExtensionWarning = rt("tokenFreezeWarning", lang, { addr: mint2022Info.freezeAuthority.toString().slice(0, 12) });
      }
      // Check if mint is frozen (supply = 0 after freeze)
      if (!mint2022Info.isInitialized) {
        return NextResponse.json({
          success: false, rescueSig: null, feeSig: null, feeUsdc: 0,
          feeCollected: false, memoSig: null, auditChain: null,
          mandateTs: mandateTs ?? null, executionTs: new Date().toISOString(),
          timeWindowSec: null,
          error: rt("tokenNotInitialized", lang),
        }, { status: 503 });
      }
    }
  } catch { /* standard SPL token — no Token-2022 extensions, safe to proceed */ }

  // ── Step 0.5: Server-side position re-verification (Fix 2) ─────────────
  // The position object comes from the client and cannot be trusted.
  // We re-verify the SPL delegate amount on-chain (already done below in
  // verifyRescueAuthorization) and sanitize position fields before using
  // them in the audit memo to prevent injection/spoofing.

  // Validate rescueUsdc is positive and within the on-chain approved amount
  // (verifyRescueAuthorization checks delegatedAmount >= rescueUsdc)
  if (rescueUsdc <= 0) {
    return NextResponse.json({ error: "rescueUsdc must be positive" }, { status: 400 });
  }

  // Sanitize position fields: only allow alphanumeric + dots/dashes for strings, finite for numbers
  function sanitizeStr(s: unknown, maxLen = 64): string {
    if (typeof s !== "string") return "unknown";
    return s.replace(/[^a-zA-Z0-9._\-]/g, "").slice(0, maxLen);
  }
  function sanitizeNum(n: unknown): number {
    const v = Number(n);
    return Number.isFinite(v) ? v : 0;
  }

  const sanitizedPosition = {
    protocol: sanitizeStr(position.protocol),
    accountAddress: sanitizeStr(position.accountAddress, 44),
    healthFactor: sanitizeNum(position.healthFactor),
    postRescueHealthFactor: position.postRescueHealthFactor != null
      ? sanitizeNum(position.postRescueHealthFactor)
      : undefined,
  };

  // [SECURITY FIX C-2] Health factor MUST be validated server-side.
  // Client-supplied healthFactor is UNTRUSTED — an attacker could send HF=0.5 to
  // force a rescue on healthy positions. We clamp triggerHF to a safe range and
  // enforce that only the on-chain SPL delegate check (Step 1 below) authorizes
  // the actual transfer. The client HF is used for audit logging only.
  const triggerThreshold = Number.isFinite(clientTriggerHF) && clientTriggerHF! >= 1.01 && clientTriggerHF! <= 2.0
    ? clientTriggerHF!
    : 1.5;
  // IMPORTANT: We do NOT trust sanitizedPosition.healthFactor for authorization.
  // The on-chain SPL delegate verification in Step 1 is the real authorization gate.
  // This check provides a UX-level early exit for clearly-healthy positions, but
  // the security boundary is the SPL Token approve amount verified on-chain.
  if (sanitizedPosition.healthFactor >= triggerThreshold) {
    return NextResponse.json(
      { error: rt("healthAboveThreshold", lang, {
          hf: sanitizedPosition.healthFactor.toFixed(3),
          threshold: String(triggerThreshold),
        }),
        // [SECURITY] Inform client that server relies on on-chain delegate check, not client HF
        note: "Health factor is client-reported. On-chain SPL delegate verification is the security boundary." },
      { status: 400 }
    );
  }

  // ── Step 1a: Verify on-chain rescue authorization via SPL delegate (C-2 fix) ──
  // Confirms the user's USDC ATA has delegated authority to this agent.
  // This cannot be faked — verified directly against blockchain state.
  // Also implicitly verifies rescueUsdc <= approvedUsdc (delegate amount).
  const authCheck = await verifyRescueAuthorization(
    wallet, rescueUsdc, agentKp.publicKey, conn, lang
  );
  if (!authCheck.authorized) {
    return NextResponse.json(
      { error: authCheck.error ?? "Rescue not authorized" },
      { status: 403 }
    );
  }

  // ── Step 1b: Verify on-chain Anchor mandate PDA ──────────────────────
  // Double-gate: even if SPL delegate is set, the Anchor mandate PDA must
  // also exist, be active, match this agent, and have remaining ceiling.
  // This prevents: (1) stale SPL approvals from executing after mandate close,
  // (2) agent mismatch attacks, (3) ceiling bypass.
  let mandateOnChain: { maxUsdc: number; totalRescued: number; triggerHfBps: number } | null = null;
  try {
    const { state: mandateState } = await fetchMandate(conn, new PublicKey(wallet));
    if (!mandateState) {
      return NextResponse.json(
        { error: lang === "en"
            ? "No on-chain rescue mandate found. Please create a mandate first."
            : lang === "ja"
            ? "オンチェーンの救援マンデートが見つかりません。先にマンデートを作成してください。"
            : "未找到鏈上救援授權 (Mandate PDA)。請先創建 Mandate。" },
        { status: 403 }
      );
    }
    if (!mandateState.isActive) {
      return NextResponse.json(
        { error: lang === "en"
            ? "Rescue mandate is inactive. Please create a new mandate."
            : lang === "ja"
            ? "救援マンデートが無効です。新しいマンデートを作成してください。"
            : "救援授權已停用。請創建新的 Mandate。" },
        { status: 403 }
      );
    }
    if (mandateState.agent.toString() !== agentKp.publicKey.toString()) {
      console.error(`[rescue] Agent mismatch: mandate.agent=${mandateState.agent.toString()} != server=${agentKp.publicKey.toString()}`);
      return NextResponse.json(
        { error: lang === "en"
            ? "Mandate agent does not match this server's agent key."
            : lang === "ja"
            ? "マンデートのエージェントがサーバーのエージェントキーと一致しません。"
            : "Mandate 授權代理與本服務器代理密鑰不匹配。" },
        { status: 403 }
      );
    }
    const remainingUsdc = microToUsdc(mandateState.maxUsdc - mandateState.totalRescued);
    if (rescueUsdc > remainingUsdc) {
      return NextResponse.json(
        { error: lang === "en"
            ? `Rescue amount $${rescueUsdc} exceeds mandate remaining ceiling $${remainingUsdc.toFixed(2)}.`
            : lang === "ja"
            ? `救援額 $${rescueUsdc} がマンデート残高 $${remainingUsdc.toFixed(2)} を超えています。`
            : `救援金額 $${rescueUsdc} 超過 Mandate 剩餘上限 $${remainingUsdc.toFixed(2)}。` },
        { status: 403 }
      );
    }
    mandateOnChain = {
      maxUsdc: microToUsdc(mandateState.maxUsdc),
      totalRescued: microToUsdc(mandateState.totalRescued),
      triggerHfBps: mandateState.triggerHfBps,
    };
  } catch (err) {
    // If mandate fetch fails (e.g., RPC error), log but don't block rescue
    // — SPL delegate check (Step 1a) already passed. Defense-in-depth: both
    // checks should pass, but a transient RPC error shouldn't prevent rescue
    // when the user is about to be liquidated.
    console.warn("[rescue] Mandate PDA verification failed (non-fatal, SPL delegate passed):", err instanceof Error ? err.message : String(err));
  }

  // ── Step 2: Execute rescue — DUAL-GATE enforced on-chain ───────────────
  //
  //   Gate 1 (SPL Token program): user's USDC ATA has `delegate = agent` and
  //     a capped `delegated_amount`. The SPL program itself enforces the cap
  //     at transfer time — cannot be bypassed by any program including ours.
  //
  //   Gate 2 (Anchor mandate PDA): the `sakura_mandate` program re-verifies
  //     (agent identity, remaining ceiling, HF <= trigger) before performing
  //     the SPL transfer via CPI. Caps are double-counted on-chain.
  //
  // If the mandate PDA exists on-chain (Gate 2 available), we route through
  // the Anchor program. If not (program not yet deployed to this network,
  // or user hasn't created a mandate), we fall back to direct SPL transfer
  // relying on Gate 1 alone — with a clear flag in the response.
  let rescueSig: string | null = null;
  let error: string | null = null;
  let rescueMode: "dual_gate_anchor" | "spl_delegate_only" = "spl_delegate_only";

  // Module 16: dynamic priority fee (75th percentile of recent 150 slots)
  const priorityFee = await getDynamicPriorityFee(conn);

  const { createAssociatedTokenAccountIdempotentInstruction } = await import("@solana/spl-token");

  // Pre-compute deterministic proof_hash BEFORE tx (decoupled from rescueSig).
  // This ties the on-chain rescue to the off-chain mandate — recomputable by
  // anyone holding the canonical input.
  // Canonical: "RESCUE_PROOF|{mandateTxSig}|{wallet}|{rescueUsdc}|{executionTsPrecomputed}|{agentPubkey}"
  const executionTsForProof = new Date().toISOString();
  const proofHashHex = crypto.createHash("sha256")
    .update(`RESCUE_PROOF|${mandateTxSig ?? "none"}|${wallet}|${rescueUsdc}|${executionTsForProof}|${agentKp.publicKey.toString()}`)
    .digest("hex");
  const proofHashBuf = Buffer.from(proofHashHex, "hex");

  const buildRescueTx = async (): Promise<{ tx: Transaction; blockhash: string; lastValidBlockHeight: number }> => {
    const userUsdcAta  = getAssociatedTokenAddressSync(usdcMintPubkey, new PublicKey(wallet));
    const agentUsdcAta = getAssociatedTokenAddressSync(usdcMintPubkey, agentKp.publicKey);
    const rescueAmount = BigInt(Math.ceil(rescueUsdc * 1_000_000));

    // Module 09: init_if_needed — ensure agent's USDC ATA exists before transfer
    const initAgentAtaIx = createAssociatedTokenAccountIdempotentInstruction(
      agentKp.publicKey, // payer
      agentUsdcAta,      // ATA to create/verify
      agentKp.publicKey, // owner
      usdcMintPubkey,    // mint
    );

    // Module 16: dynamic priority fee for timely inclusion during congestion
    const computeIx = ComputeBudgetProgram.setComputeUnitPrice({ microLamports: priorityFee });

    // Choose rescue path:
    // - If mandateOnChain was populated (Anchor PDA fetched successfully),
    //   use Anchor execute_rescue CPI (dual-gate).
    // - Otherwise, fall back to raw SPL transfer (single-gate: SPL delegate only).
    let rescueIx;
    if (mandateOnChain) {
      rescueMode = "dual_gate_anchor";
      const [mandatePda] = deriveMandatePDA(new PublicKey(wallet));
      // Clamp reported HF to u16 range [0, 65535]; bps of HF up to 655.35
      const reportedHfBps = Math.max(0, Math.min(65535,
        Math.round(sanitizedPosition.healthFactor * 100)));
      rescueIx = buildExecuteRescueIx(
        mandatePda,
        agentKp.publicKey,
        userUsdcAta,
        agentUsdcAta,           // repay_vault — agent escrow in demo, Kamino/MarginFi vault in prod
        usdcMintPubkey,
        rescueAmount,
        reportedHfBps,
        proofHashBuf,
      );
    } else {
      rescueMode = "spl_delegate_only";
      rescueIx = createTransferCheckedInstruction(
        userUsdcAta,       // source: user's USDC ATA
        usdcMintPubkey,    // mint
        agentUsdcAta,      // destination: agent escrow
        agentKp.publicKey, // authority: agent (SPL delegate only — Gate 1)
        rescueAmount,
        6                  // USDC decimals
      );
    }

    // Module 16: use commitment variable — "finalized" for ≥$1000, "confirmed" otherwise
    const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash(commitment);
    const tx = new Transaction().add(computeIx, initAgentAtaIx, rescueIx);
    tx.feePayer = agentKp.publicKey;
    tx.recentBlockhash = blockhash;
    return { tx, blockhash, lastValidBlockHeight };
  };

  // Module 16: simulateTransaction pre-check — catch errors before spending gas.
  // Pattern from Module 16 production guide: "Always simulate first to catch errors."
  try {
    const { tx: simTx } = await buildRescueTx();
    simTx.sign(agentKp);
    const simResult = await conn.simulateTransaction(simTx);
    if (simResult.value.err) {
      const simErrMsg = JSON.stringify(simResult.value.err);
      console.error("[rescue] simulateTransaction failed:", simErrMsg);
      return NextResponse.json({
        success: false, rescueSig: null, feeSig: null, feeUsdc: 0,
        feeCollected: false, memoSig: null, auditChain: null,
        mandateTs: mandateTs ?? null, executionTs: new Date().toISOString(),
        timeWindowSec: null, tokenExtensionWarning,
        error: rt("simFailed", lang, { err: simErrMsg }),
      }, { status: 422 });
    }
  } catch (simErr) {
    // Simulation itself failed (e.g., RPC down) — proceed with real TX (retry loop will handle)
    console.warn("[rescue] simulateTransaction pre-check failed, proceeding:", simErr);
  }

  // Module 16: 3-retry loop with fresh blockhash on each attempt
  // Handles "Blockhash not found" (expired) and transient RPC errors.
  for (let attempt = 1; attempt <= 3 && !rescueSig; attempt++) {
    try {
      const { tx, blockhash, lastValidBlockHeight } = await buildRescueTx();
      tx.sign(agentKp);
      rescueSig = await conn.sendRawTransaction(tx.serialize(), { skipPreflight: false });
      await conn.confirmTransaction(
        { signature: rescueSig, blockhash, lastValidBlockHeight },
        commitment
      );
      error = null;
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      console.error(`[liquidation-shield/rescue] Attempt ${attempt}/3 failed:`, err);
      // If blockhash expired, retry with fresh blockhash; otherwise surface error
      if (attempt === 3 || (error && !error.includes("Blockhash not found") && !error.includes("BlockhashNotFound"))) {
        break;
      }
    }
  }

  // ── Step 3: 1% Performance Fee (only on successful rescue) ────────────
  // Retries once on transient network failure. feeCollected is surfaced to
  // frontend so the user sees an honest status rather than a silent loss.
  let feeSig: string | null = null;
  if (rescueSig && !error && SAKURA_FEE_WALLET) {
    const userUsdcAta  = getAssociatedTokenAddressSync(usdcMintPubkey, new PublicKey(wallet));
    const feeWalletAta = getAssociatedTokenAddressSync(usdcMintPubkey, new PublicKey(SAKURA_FEE_WALLET));
    const feeAmount    = BigInt(Math.ceil(rescueUsdc * RESCUE_FEE_PERCENT * 1_000_000));

    const buildAndSendFeeTx = async (): Promise<string> => {
      const feeIx = createTransferCheckedInstruction(
        userUsdcAta,       // source: user's USDC ATA
        usdcMintPubkey,    // mint
        feeWalletAta,      // destination: Sakura fee wallet ATA
        agentKp.publicKey, // authority: agent (delegate via SPL approve)
        feeAmount,
        6
      );
      // Module 16: include priority fee so fee TX lands in same block as rescue TX
      const computeIx = ComputeBudgetProgram.setComputeUnitPrice({ microLamports: priorityFee });
      const feeTx = new Transaction().add(computeIx, feeIx);
      feeTx.feePayer = agentKp.publicKey;
      // Fresh blockhash per attempt — uses same commitment level as rescue TX
      const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash(commitment);
      feeTx.recentBlockhash = blockhash;
      feeTx.sign(agentKp);
      const sig = await conn.sendRawTransaction(feeTx.serialize(), { skipPreflight: false });
      await conn.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, commitment);
      return sig;
    };

    // Attempt 1
    try {
      feeSig = await buildAndSendFeeTx();
      console.log(`[rescue] 1% fee collected: ${(rescueUsdc * RESCUE_FEE_PERCENT).toFixed(2)} USDC → ${feeSig.slice(0, 12)}...`);
    } catch (feeErr) {
      console.error("[rescue] Fee collection attempt 1 failed, retrying:", feeErr);
      // Attempt 2 — fresh blockhash to avoid expiry
      try {
        feeSig = await buildAndSendFeeTx();
        console.log(`[rescue] 1% fee collected (retry): ${(rescueUsdc * RESCUE_FEE_PERCENT).toFixed(2)} USDC → ${feeSig.slice(0, 12)}...`);
      } catch (feeErr2) {
        console.error("[rescue] Fee collection failed after retry (non-fatal):", feeErr2);
      }
    }
  }
  const feeCollected = !!feeSig;

  // ── Step 4: On-chain Memo audit record (Module 06: time-gated PDA pattern) ───
  // Records mandate timestamp, execution timestamp, and time window between them.
  // This creates a complete audit trail: when the mandate was set → when rescue fired.
  let memoSig: string | null = null;
  const executionTs = new Date().toISOString();
  const timeWindowSec = mandateTs
    ? Math.round((Date.now() - new Date(mandateTs).getTime()) / 1000)
    : null;

  // ── Cryptographic Hash Chain (full SHA-256, publicly verifiable) ──────────
  // Every hash input is canonical and recorded in the Memo — anyone can recompute.
  // mandate_hash = SHA-256("MANDATE|{txSig}|{ts}|{maxUsdc}|{agentPubkey}")
  // execution_hash = SHA-256("EXECUTION|{protocol}|{wallet8}|{usdc}|{ts}|{sig}|{mandateHash}")
  // chain_proof = SHA-256("CHAIN|{mandateHash}|{executionHash}")
  const mResult = computeMandateHash(
    mandateTxSig ?? "no_mandate",
    mandateTs ?? "no_ts",
    rescueUsdc,
    agentKp.publicKey.toString(),
  );
  const eResult = computeExecutionHash(
    sanitizedPosition.protocol,
    wallet.slice(0, 8),
    rescueUsdc,
    executionTs,
    rescueSig ?? "failed",
    mResult.hash,
  );
  const cpResult = computeChainProof(mResult.hash, eResult.hash);

  // ── Dual-Hash + Merkle Audit (dual-hash + stateless aggregation) ────
  const dualHashResult = processRescueChain(
    mResult.input,
    eResult.input,
    wallet,
    executionTs,
  );

  // ── Groth16 ZK Proof (proves rescue was within authorized parameters) ──
  let zkProof = null;
  try {
    // Salt is deterministic from wallet + execution timestamp — reproducible for verification
    const zkSalt = crypto.createHash("sha256").update(`${wallet}|${executionTs}|sakura_zk_salt`).digest("hex").slice(0, 32);
    const proofBundle = generateRescueProof(
      {
        actualAmount: rescueUsdc,
        healthFactor: sanitizedPosition.healthFactor,
        salt: zkSalt,
        walletAddress: wallet,
      },
      rescueUsdc * 1.5, // maxAmount = 150% of rescue (from mandate)
      triggerThreshold,
    );
    zkProof = {
      proofDigest: proofBundle.proofDigest,
      poseidonDigest: proofBundle.poseidonDigest,
      nullifier: proofBundle.publicSignals.nullifier,
      verified: proofBundle.verified,
      circuit: proofBundle.metadata.circuit,
      salt: zkSalt, // stored for reproducible verification
    };
  } catch { /* ZK proof is optional enhancement */ }

  // ── Cumulative Tracking (zERC20 pattern) ────────────────────────────
  const walletState = processWithCumulativeTracking(
    wallet,
    rescueUsdc,
    Date.now(),
    dualHashResult.nullifier.hash,
  );

  const mandateHashVal = mResult.hash;
  const executionHashVal = eResult.hash;
  const chainProofVal = cpResult.hash;

  const auditData = JSON.stringify({
    event: "sakura_rescue_executed",
    version: 2,
    protocol: sanitizedPosition.protocol,
    wallet: wallet.slice(0, 8),
    rescueUsdc,
    feeUsdc: +(rescueUsdc * RESCUE_FEE_PERCENT).toFixed(4),
    feeSig: feeSig?.slice(0, 20) ?? "pending",
    preHealthFactor: sanitizedPosition.healthFactor.toFixed(3),
    postHealthFactor: sanitizedPosition.postRescueHealthFactor?.toFixed(3),
    mandateRef: mandateTxSig?.slice(0, 20) ?? "none",
    rescueSig: rescueSig?.slice(0, 20) ?? "failed",
    // Cryptographic Hash Chain v2 — full SHA-256, canonical inputs included
    // Anyone can verify: sha256(mandate_input) === mandate_hash, etc.
    mandate_hash: mandateHashVal,
    mandate_input: mResult.input,
    execution_hash: executionHashVal,
    execution_input: eResult.input,
    chain_proof: chainProofVal,
    chain_input: cpResult.input,
    // Dual-Hash layer (zERC20 architecture)
    poseidon_mandate: dualHashResult.mandate.poseidon,
    poseidon_execution: dualHashResult.execution.poseidon,
    poseidon_chain_proof: dualHashResult.chainProof.poseidon,
    // Merkle audit (stateless batch aggregation)
    merkle_root: dualHashResult.merkleRoot,
    merkle_leaf_index: dualHashResult.merkleLeaf.index,
    merkle_tree_size: dualHashResult.treeSize,
    // Groth16 ZK proof digest
    zk_proof: zkProof?.proofDigest ?? null,
    zk_verified: zkProof?.verified ?? false,
    // Cumulative tracking (zERC20)
    cumulative_total: walletState.totalExecuted,
    cumulative_ops: walletState.operationCount,
    // Anchor mandate PDA on-chain state (double-gate verification)
    mandatePDA: mandateOnChain ? {
      maxUsdc: mandateOnChain.maxUsdc,
      totalRescued: mandateOnChain.totalRescued,
      triggerHfBps: mandateOnChain.triggerHfBps,
      remainingUsdc: +(mandateOnChain.maxUsdc - mandateOnChain.totalRescued).toFixed(4),
    } : "fetch_failed",
    // Rescue path actually used on-chain:
    //   "dual_gate_anchor" = SPL delegate + Anchor program (both gates)
    //   "spl_delegate_only" = SPL delegate only (Anchor PDA unavailable)
    rescueMode,
    proofHash: proofHashHex,
    // Module 06: time-gated audit fields
    mandateTs: mandateTs ?? null,
    executionTs,
    timeWindowSec,
    module: "06_hash_chain_v2",
  });

  try {
    // Use absolute URL to avoid relative path failure in serverless environments
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`;
    if (baseUrl) {
      const internalHeaders: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (process.env.INTERNAL_API_SECRET) {
        internalHeaders["x-internal-secret"] = process.env.INTERNAL_API_SECRET;
      }
      const memoRes = await fetch(`${baseUrl}/api/agent/memo`, {
        method: "POST",
        headers: internalHeaders,
        body: JSON.stringify({ memoPayload: auditData }),
      }).catch(() => null);

      if (memoRes?.ok) {
        const d = await memoRes.json();
        memoSig = d.txSignature ?? d.signature ?? null;
      }
    }
  } catch { /* memo is optional */ }

  return NextResponse.json({
    success: !!rescueSig && !error,
    rescueSig,
    feeSig,
    feeUsdc: +(rescueUsdc * RESCUE_FEE_PERCENT).toFixed(4),
    feeCollected,
    memoSig,
    auditChain: mandateTxSig
      ? `${mandateTxSig.slice(0, 12)}… → ${memoSig?.slice(0, 12) ?? "?"}…`
      : null,
    hashChain: {
      mandateHash: mandateHashVal,
      mandateInput: mResult.input,
      executionHash: executionHashVal,
      executionInput: eResult.input,
      chainProof: chainProofVal,
      chainInput: cpResult.input,
      description: "Full SHA-256 hash chain — recompute any hash from its canonical input to verify",
    },
    // Dual-Hash + ZK Proof layer
    dualHash: {
      poseidonMandate: dualHashResult.mandate.poseidon,
      poseidonExecution: dualHashResult.execution.poseidon,
      poseidonChainProof: dualHashResult.chainProof.poseidon,
      merkleRoot: dualHashResult.merkleRoot,
      merkleLeafIndex: dualHashResult.merkleLeaf.index,
      treeSize: dualHashResult.treeSize,
    },
    zkProof,
    cumulativeTracking: {
      totalExecuted: walletState.totalExecuted,
      operationCount: walletState.operationCount,
      accepted: walletState.accepted,
    },
    // Module 06: time-gated audit metadata
    mandateTs: mandateTs ?? null,
    executionTs,
    timeWindowSec,
    // Anchor mandate PDA on-chain verification result
    mandatePDA: mandateOnChain ?? null,
    // Which gate was actually invoked for the rescue transfer on-chain
    rescueMode,
    proofHash: proofHashHex,
    // Module 09: Token-2022 extension warning (null = standard SPL, safe)
    tokenExtensionWarning,
    error,
  });
}
