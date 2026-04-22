"use client";

/**
 * IntentSigner.tsx — user-facing intent-signing form (v0.3).
 *
 * Shadcn UI + Lucide icons + 和柄 Seigaiha background accent.
 * All logic (Poseidon commitment, USDC fee transfer, wallet signing)
 * is preserved from the prior inline-styled version; only presentation
 * was rewritten.
 */

import { useCallback, useEffect, useState } from "react";
import SealStampOverlay from "@/components/SealStampOverlay";
import NumeralSeal from "@/components/NumeralSeal";
import LogoSeal from "@/components/LogoSeal";
import {
  appendDemoAction,
  clearDemoIntentRevoked,
  setDemoIntentRevoked,
} from "@/lib/demo-store";
import {
  Connection,
  PublicKey,
  VersionedTransaction,
  TransactionMessage,
} from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import {
  Sparkles,
  ShieldCheck,
  RotateCcw,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  PenLine,
} from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import {
  ActionType,
  ProtocolId,
  buildActionTypesBitmap,
  buildProtocolsBitmap,
  buildRevokeIntentIx,
  buildSignIntentIx,
  deriveProtocolPDA,
  deriveFeeVaultPDA,
  SAKURA_INSURANCE_PROGRAM_ID,
} from "@/lib/insurance-pool";
import {
  computeIntentCommitment,
  pubkeyToFieldBytes,
} from "@/lib/zk-proof";
import {
  PROTOCOL_META,
  formatAprDisplay,
  type ProtocolAprsResponse,
  type ProtocolMeta,
} from "@/lib/protocol-meta";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Seigaiha, KyokaiDivider } from "@/components/WaPattern";
import { cn } from "@/lib/utils";

const RPC = process.env.NEXT_PUBLIC_SOLANA_RPC ?? "https://api.devnet.solana.com";

// ───────────────────────────────────────────────────────────────────
// Types
// ───────────────────────────────────────────────────────────────────

type Status =
  | { kind: "idle" }
  | { kind: "computing" }
  | { kind: "awaiting-signature" }
  | { kind: "confirming"; signature: string }
  | { kind: "success"; signature: string }
  | { kind: "error"; message: string };

interface IntentSecrets {
  intentText: string;
  maxAmountMicro: string;
  maxUsdValueMicro: string;
  allowedProtocols: number;
  allowedActionTypes: number;
  nonce: string;
  intentTextHashDecimal: string;
  expiresAt: string;
  commitmentHex: string;
  signedAt: number;
  signature: string;
}

// ───────────────────────────────────────────────────────────────────
// Option tables
// ───────────────────────────────────────────────────────────────────

// Top-4 Solana DeFi by Grid gridRank + product-fit (2026-04-22):
//   Jupiter (Lend product rank 88 — highest), Raydium (DEX rank 44),
//   Kamino (Lending rank 32), Jito (LST rank 31).
// MarginFi / Marinade / Sanctum / Solend kept in enum for forward
// compatibility but not surfaced in UI. See commit history for rationale.
//
// Display meta (logo, color, APR shape) lives in lib/protocol-meta.ts
// at module scope so React's render path stays cheap.
const PROTOCOL_LABELS = PROTOCOL_META;

// Action 朱印 kanji — each chosen so the seal-script character literally
// names the on-chain action. Shares the brand vermillion with protocol
// seals so the visual language is one consistent system.
//   預 (yù)  — deposit / entrust   → Lend
//   借 (jiè) — borrow               → Borrow
//   還 (huán) — return / repay      → Repay
//   換 (huàn) — exchange            → Swap
//   結 (jié) — bind / lock-stake    → Stake (kept distinct from Jito's 鎖)
//   出 (chū) — withdraw / take out  → Withdraw
const ACTION_LABELS: Array<{ id: ActionType; label: string; kanji: string }> = [
  { id: ActionType.Lend,     label: "Lend",     kanji: "預" },
  { id: ActionType.Borrow,   label: "Borrow",   kanji: "借" },
  { id: ActionType.Repay,    label: "Repay",    kanji: "還" },
  { id: ActionType.Swap,     label: "Swap",     kanji: "換" },
  { id: ActionType.Stake,    label: "Stake",    kanji: "結" },
  { id: ActionType.Withdraw, label: "Withdraw", kanji: "出" },
];

// ───────────────────────────────────────────────────────────────────
// Live-APR fetch hook — one-shot on mount; the API route handles
// upstream rate-limiting and Redis caching, so the client just needs
// a single GET. No SWR / polling: APRs barely move minute-to-minute.
// ───────────────────────────────────────────────────────────────────

function useProtocolAprs(): {
  aprs: ProtocolAprsResponse | null;
  isLoading: boolean;
  source: ProtocolAprsResponse["source"] | null;
} {
  const [aprs, setAprs] = useState<ProtocolAprsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/protocol-aprs")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: ProtocolAprsResponse | null) => {
        if (!cancelled && data) setAprs(data);
      })
      .catch(() => {
        /* swallow — UI shows skeleton then defaults */
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { aprs, isLoading, source: aprs?.source ?? null };
}

// ───────────────────────────────────────────────────────────────────
// Poseidon — fold UTF-8 intent text to a single field element
// ───────────────────────────────────────────────────────────────────

async function hashIntentText(text: string): Promise<bigint> {
  const { buildPoseidon } = await import("circomlibjs");
  const poseidon = await buildPoseidon();
  const bytes = new TextEncoder().encode(text);
  let acc = 0n;
  for (let i = 0; i < bytes.length; i += 31) {
    const chunk = bytes.subarray(i, Math.min(i + 31, bytes.length));
    let v = 0n;
    for (let j = 0; j < chunk.length; j++) v = (v << 8n) | BigInt(chunk[j]);
    const h = poseidon([acc, v, BigInt(i)]);
    acc = BigInt(poseidon.F.toString(h));
  }
  return acc;
}

// ═══════════════════════════════════════════════════════════════════
// Main component
// ═══════════════════════════════════════════════════════════════════

// Demo-mode placeholder user Pubkey. System Program (32 zeros) is a
// deliberately recognizable sentinel so anyone inspecting the state
// immediately sees this is simulated, not a real wallet.
const DEMO_USER_PUBKEY = "11111111111111111111111111111111";

// Devnet fallbacks for the two deployment-bound env vars. These are
// public on-chain addresses — not secrets — so hardcoding a fallback
// is safe and prevents the sign flow from crashing when the Vercel
// env vars aren't set. Override in production via `vercel env add`.
const DEVNET_PROTOCOL_ADMIN = "2iCWnS1J8WYZn4reo9YD76qZiiZ39t2c1oGM3dyYwHNg";
// Sakura's devnet protocol is initialized with an admin-controlled
// test USDC mint (see protocol PDA's usdc_mint field on-chain). This
// is NOT Circle's canonical devnet USDC (4zMMC…DncDU). Web UI must
// match the on-chain mint for the user's USDC ATA to be derivable —
// otherwise sign_intent fails with a generic "Unexpected error".
// Override via `vercel env add NEXT_PUBLIC_SAKURA_USDC_MINT`.
const DEVNET_USDC_MINT       = "7rEhvYrGGT41FQrCt3zNx8Bko9TFVvytYWpP1mqhtLi3";

export default function IntentSigner() {
  const { walletAddress, getProvider, isDemo } = useWallet();

  const [intentText, setIntentText] = useState(
    "Lend up to 1000 USDC into Kamino or MarginFi, $10k max per action."
  );
  const [maxAmountTokens, setMaxAmountTokens] = useState("1000");
  const [maxUsdDollars, setMaxUsdDollars] = useState("10000");
  const [hours, setHours] = useState("24");
  const [selectedProtocols, setSelectedProtocols] = useState<Set<ProtocolId>>(
    new Set([ProtocolId.Kamino, ProtocolId.Jupiter])
  );
  const { aprs, isLoading: aprsLoading, source: aprsSource } = useProtocolAprs();
  const [selectedActions, setSelectedActions] = useState<Set<ActionType>>(
    new Set([ActionType.Lend, ActionType.Repay])
  );
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  // Seal-stamp overlay: plays the finality moment when an intent signs.
  // Disable via `?noStamp=true` query param for screen recording / demos.
  const [sealShowing, setSealShowing] = useState(false);
  const [sealDisabled, setSealDisabled] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("noStamp") === "true") setSealDisabled(true);
  }, []);
  useEffect(() => {
    if (status.kind === "success") setSealShowing(true);
  }, [status.kind]);

  const toggleProtocol = (id: ProtocolId) =>
    setSelectedProtocols((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const toggleAction = (id: ActionType) =>
    setSelectedActions((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const handleSign = useCallback(async () => {
    // Demo mode: no real wallet, no real tx. The Poseidon commitment
    // math still runs locally so users see the actual ZK primitive in
    // action — only the chain-submit + wallet-sign steps are simulated.
    const effectiveWallet = walletAddress ?? (isDemo ? DEMO_USER_PUBKEY : null);

    if (!effectiveWallet) {
      setStatus({ kind: "error", message: "請先連接錢包。" });
      return;
    }
    const provider = isDemo ? null : getProvider();
    if (!isDemo && !provider) {
      setStatus({ kind: "error", message: "偵測不到錢包 Provider。" });
      return;
    }
    // Admin Pubkey: prefer env, fall back to the devnet protocol admin
    // (public on-chain info, not a secret). No hard error in either mode.
    const adminStr =
      process.env.NEXT_PUBLIC_SAKURA_PROTOCOL_ADMIN ?? DEVNET_PROTOCOL_ADMIN;

    try {
      setStatus({ kind: "computing" });
      const user = new PublicKey(effectiveWallet);
      const admin = new PublicKey(adminStr);

      const maxAmountMicro = BigInt(maxAmountTokens) * 1_000_000n;
      const maxUsdMicro = BigInt(maxUsdDollars) * 1_000_000n;
      const allowedProtocols = BigInt(
        buildProtocolsBitmap(Array.from(selectedProtocols))
      );
      const allowedActionTypes = BigInt(
        buildActionTypesBitmap(Array.from(selectedActions))
      );
      if (allowedProtocols === 0n) throw new Error("至少選擇一個協議。");
      if (allowedActionTypes === 0n) throw new Error("至少選擇一個動作。");

      const nonce = BigInt(Date.now());
      const intentTextHash = await hashIntentText(intentText);
      const walletField = pubkeyToFieldBytes(user.toBytes());

      const { hex, bytesBE32 } = await computeIntentCommitment(
        intentTextHash,
        walletField,
        nonce,
        maxAmountMicro,
        maxUsdMicro,
        allowedProtocols,
        allowedActionTypes
      );

      const expiresAt =
        BigInt(Math.floor(Date.now() / 1000)) + BigInt(hours) * 3600n;

      // Fee = 0.1% × max_usd_value (honor system, enforced by $1000 ceiling on-chain)
      const signFeeMicro = (maxUsdMicro * 10n) / 10_000n;

      // ── DEMO SHORT-CIRCUIT ──
      // Simulate the wallet-sign + chain-submit phases with realistic
      // timing so the user still experiences the rhythm of awaiting →
      // confirming → success (and the SealStampOverlay still fires).
      // The Poseidon commitment above is REAL — only the signature is
      // a synthetic bs58-looking string derived from the commitment.
      if (isDemo) {
        setStatus({ kind: "awaiting-signature" });
        await new Promise((r) => setTimeout(r, 600));
        // Demo signature: 88 bs58-looking chars derived deterministically
        // from the commitment's own bytes. Not a valid Solana signature
        // (never submitted on-chain), but shape-accurate for UI display.
        const BS58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
        let demoSig = "";
        for (let i = 0; i < 88; i++) {
          const b = bytesBE32[i % bytesBE32.length];
          demoSig += BS58[b % 58];
        }
        setStatus({ kind: "confirming", signature: demoSig });
        await new Promise((r) => setTimeout(r, 500));
        const secrets: IntentSecrets = {
          intentText,
          maxAmountMicro: maxAmountMicro.toString(),
          maxUsdValueMicro: maxUsdMicro.toString(),
          allowedProtocols: Number(allowedProtocols),
          allowedActionTypes: Number(allowedActionTypes),
          nonce: nonce.toString(),
          intentTextHashDecimal: intentTextHash.toString(),
          expiresAt: expiresAt.toString(),
          commitmentHex: hex,
          signedAt: Date.now(),
          signature: demoSig,
        };
        localStorage.setItem("sakura:intent:demo", JSON.stringify(secrets));

        // Append a synthetic ActionRecord row so the 鏈上審計 panel
        // reflects THIS particular sign. We pick the first selected
        // protocol + first selected action from the form, and a
        // plausible amount (maxAmount * 0.4, a "realistic" agent action
        // well inside the signed cap).
        const firstProtocol =
          Array.from(selectedProtocols)[0] ?? 0; // ProtocolId.Kamino fallback
        const firstAction =
          Array.from(selectedActions)[0] ?? 1;   // ActionType.Lend fallback
        const actionAmountMicro =
          (maxAmountMicro * 2n) / 5n; // 40% of cap
        // Strip any "0x" prefix from hex before storing — ActionHistory
        // reconstructs Buffers via Buffer.from(hex, "hex") which would
        // otherwise parse "0x..." as invalid hex and produce an empty buf.
        const hexClean = hex.replace(/^0x/i, "");
        const proofFpHex = hexClean.slice(0, 64).padEnd(64, "0");
        // Oracle price: jitter ±$3 around ~$180 so consecutive demo
        // signs don't all show the same price.
        const priceJitter = BigInt(
          Math.floor((Number(nonce) % 600) - 300) * 1_000
        );
        const oraclePriceMicro = 180_000_000n + priceJitter;
        const oracleSlot = 333_333_000n + (nonce % 1000n);
        appendDemoAction({
          nonce: nonce.toString(),
          actionType: firstAction,
          actionAmount: actionAmountMicro.toString(),
          actionTargetIndex: firstProtocol,
          oraclePriceUsdMicro: oraclePriceMicro.toString(),
          oracleSlot: oracleSlot.toString(),
          ts: Math.floor(Date.now() / 1000).toString(),
          proofFingerprintHex: proofFpHex,
          demoSignature: demoSig,
          commitmentHex: hexClean,
        });
        // Signing a new intent naturally clears any previous revocation —
        // the new commitment supersedes the old, revoked one.
        clearDemoIntentRevoked();

        setStatus({ kind: "success", signature: demoSig });
        return;
      }

      // USDC mint: prefer env, fall back to the devnet USDC mint used
      // by our on-chain IntentProtocol. Both are public.
      const usdcMintStr =
        process.env.NEXT_PUBLIC_SAKURA_USDC_MINT ?? DEVNET_USDC_MINT;
      const usdcMint = new PublicKey(usdcMintStr);
      const [protocolPda] = deriveProtocolPDA(admin);
      const [feeVault] = deriveFeeVaultPDA(protocolPda);
      const userUsdcAta = getAssociatedTokenAddressSync(usdcMint, user);

      const signIx = buildSignIntentIx({
        admin,
        user,
        userUsdcAta,
        feeVault,
        intentCommitment: Buffer.from(bytesBE32),
        expiresAt,
        feeMicro: signFeeMicro,
      });

      const conn = new Connection(RPC, "confirmed");
      const { blockhash } = await conn.getLatestBlockhash();
      const message = new TransactionMessage({
        payerKey: user,
        recentBlockhash: blockhash,
        instructions: [signIx],
      }).compileToV0Message();
      const tx = new VersionedTransaction(message);

      setStatus({ kind: "awaiting-signature" });
      let signature: string;
      // Non-null: demo branch returned earlier; real flow guarantees `provider`.
      const realProvider = provider!;
      if ("signAndSendTransaction" in realProvider) {
        const result = await (
          realProvider as unknown as {
            signAndSendTransaction: (
              t: VersionedTransaction
            ) => Promise<{ signature: string }>;
          }
        ).signAndSendTransaction(tx);
        signature = result.signature;
      } else {
        const signed = await (
          realProvider as unknown as {
            signTransaction: (
              t: VersionedTransaction
            ) => Promise<VersionedTransaction>;
          }
        ).signTransaction(tx);
        signature = await conn.sendRawTransaction(signed.serialize(), {
          skipPreflight: false,
        });
      }

      setStatus({ kind: "confirming", signature });
      await conn
        .confirmTransaction(
          { signature, blockhash, lastValidBlockHeight: 0 },
          "confirmed"
        )
        .catch(() => undefined);

      const secrets: IntentSecrets = {
        intentText,
        maxAmountMicro: maxAmountMicro.toString(),
        maxUsdValueMicro: maxUsdMicro.toString(),
        allowedProtocols: Number(allowedProtocols),
        allowedActionTypes: Number(allowedActionTypes),
        nonce: nonce.toString(),
        intentTextHashDecimal: intentTextHash.toString(),
        expiresAt: expiresAt.toString(),
        commitmentHex: hex,
        signedAt: Date.now(),
        signature,
      };
      localStorage.setItem(
        `sakura:intent:${walletAddress}`,
        JSON.stringify(secrets)
      );

      setStatus({ kind: "success", signature });
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      setStatus({ kind: "error", message });
    }
  }, [
    walletAddress,
    getProvider,
    isDemo,
    intentText,
    maxAmountTokens,
    maxUsdDollars,
    hours,
    selectedProtocols,
    selectedActions,
  ]);

  const isBusy =
    status.kind === "computing" ||
    status.kind === "awaiting-signature" ||
    status.kind === "confirming";

  return (
    <>
    <SealStampOverlay
      show={sealShowing}
      disabled={sealDisabled}
      onDone={() => setSealShowing(false)}
    />
    <Card className="relative overflow-hidden border-[var(--border)] bg-[var(--bg-card)]">
      <Seigaiha className="absolute inset-0 pointer-events-none" opacity={0.04} />

      <CardHeader className="relative z-10 px-6 pb-5 pt-4 sm:px-14 sm:pt-6">
        <div className="flex items-center gap-3.5">
          <div className="flex h-11 w-11 items-center justify-center rounded-md bg-[var(--accent-soft)]">
            <PenLine className="h-5 w-5" style={{ color: "var(--accent)" }} />
          </div>
          <div>
            <CardTitle className="font-serif text-xl tracking-[0.04em]">
              簽一次意圖
            </CardTitle>
            <CardDescription className="mt-0.5 text-[13px] leading-relaxed text-[var(--text-secondary)]">
              一句話寫下代理權限邊界，鏈上只存 32 位元組雜湊。
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <Separator className="bg-[var(--border)]" />

      <CardContent className="relative z-10 space-y-7 px-6 py-7 sm:px-14 sm:py-9">
        {/* Intent text */}
        <div className="space-y-2.5">
          <Label className="font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--text-muted)]">
            意圖 Intent
          </Label>
          <Textarea
            value={intentText}
            onChange={(e) => setIntentText(e.target.value)}
            rows={2}
            maxLength={500}
            disabled={isBusy}
            className="resize-y border-[var(--border)] bg-[var(--bg-base)] px-4 py-3 font-mono text-[13px] leading-relaxed text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
            placeholder="代理可在 Kamino 借貸，單次最多 $500 USDC，為期一週。"
          />
        </div>

        {/* Numeric inputs — 3 columns */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <NumField
            label="單次上限（代幣）"
            value={maxAmountTokens}
            onChange={setMaxAmountTokens}
            disabled={isBusy}
            min={1}
          />
          <NumField
            label="單次上限（美元）"
            value={maxUsdDollars}
            onChange={setMaxUsdDollars}
            disabled={isBusy}
            min={1}
          />
          <NumField
            label="有效期（小時）"
            value={hours}
            onChange={setHours}
            disabled={isBusy}
            min={1}
            max={8760}
          />
        </div>

        {/* Protocols — 朱印 cards, 2-col grid for breathing room */}
        <div className="space-y-3">
          <div className="flex items-baseline justify-between gap-2">
            <Label className="font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--text-muted)]">
              允許協議 Allowed protocols
            </Label>
            {aprsSource && (
              <span
                className="font-mono text-[10px] tracking-[0.06em] text-[var(--text-muted)]"
                title="Live mainnet APR source"
              >
                APR · {aprsSource}
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {PROTOCOL_LABELS.map((meta) => (
              <ProtocolCard
                key={meta.id}
                meta={meta}
                active={selectedProtocols.has(meta.id)}
                apr={formatAprDisplay(meta, aprs)}
                loading={aprsLoading && !aprs}
                onClick={() => toggleProtocol(meta.id)}
                disabled={isBusy}
              />
            ))}
          </div>
        </div>

        {/* Actions — matching 朱印 tiles, 3-col on desktop */}
        <div className="space-y-3">
          <Label className="font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--text-muted)]">
            允許動作 Allowed actions
          </Label>
          <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-6">
            {ACTION_LABELS.map(({ id, label, kanji }) => (
              <ActionTile
                key={id}
                label={label}
                kanji={kanji}
                active={selectedActions.has(id)}
                onClick={() => toggleAction(id)}
                disabled={isBusy}
              />
            ))}
          </div>
        </div>

        <KyokaiDivider className="py-2" />

        {/* Primary action */}
        <Button
          onClick={handleSign}
          disabled={isBusy || (!walletAddress && !isDemo)}
          size="lg"
          className="w-full font-serif text-[15px] tracking-[0.08em]"
          style={{
            background: "var(--accent)",
            color: "white",
          }}
        >
          {status.kind === "computing" && (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              計算 Poseidon 承諾中…
            </>
          )}
          {status.kind === "awaiting-signature" && (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              等待錢包簽名…
            </>
          )}
          {status.kind === "confirming" && (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              鏈上確認中…
            </>
          )}
          {(status.kind === "idle" ||
            status.kind === "error" ||
            status.kind === "success") && (
            <>
              <ShieldCheck className="mr-2 h-5 w-5" />
              簽署意圖
            </>
          )}
        </Button>

        {/* Revoke row */}
        <RevokeRow disabled={isBusy} />

        {/* Result banners */}
        {status.kind === "success" && (
          <StatusBanner
            tone="success"
            icon={<CheckCircle2 className="h-4 w-4" />}
            title={isDemo ? "意圖已簽署（Demo · 模擬上鏈）" : "意圖已上鏈簽署"}
            linkLabel={
              isDemo
                ? `${status.signature.slice(0, 12)}… · demo sig`
                : `${status.signature.slice(0, 12)}…`
            }
            href={
              isDemo
                ? undefined
                : `https://solscan.io/tx/${status.signature}?cluster=devnet`
            }
          />
        )}
        {status.kind === "error" && (
          <StatusBanner
            tone="error"
            icon={<AlertTriangle className="h-4 w-4" />}
            title={status.message}
          />
        )}
      </CardContent>

      <CardFooter className="relative z-10 justify-between border-t border-[var(--border)] bg-[var(--bg-card-2)]/40 px-6 py-4 sm:px-14">
        <span className="font-mono text-[10px] tracking-[0.06em] text-[var(--text-muted)]">
          Program · {SAKURA_INSURANCE_PROGRAM_ID.toBase58().slice(0, 10)}…
        </span>
        <span className="font-mono text-[10px] tracking-[0.06em] text-[var(--text-muted)]">
          簽名費 0.1% × max_usd_value
        </span>
      </CardFooter>
    </Card>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════════

function NumField({
  label,
  value,
  onChange,
  disabled,
  min,
  max,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  min?: number;
  max?: number;
}) {
  return (
    <div className="space-y-2.5">
      <Label className="font-mono text-[11px] uppercase tracking-[0.06em] text-[var(--text-muted)]">
        {label}
      </Label>
      <Input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        min={min}
        max={max}
        className="h-10 border-[var(--border)] bg-[var(--bg-base)] font-mono text-[13px] text-[var(--text-primary)]"
      />
    </div>
  );
}

/**
 * Wrap NumeralSeal (homepage 朱印 with 桜紋 gold pattern + 4-corner
 * bead flourishes) in an active-state animation container. Hand-stamped
 * tilt amplifies on selection.
 */
function SealMark({
  kanji,
  active,
  size,
}: {
  kanji: string;
  active: boolean;
  size: number;
}) {
  return (
    <span
      aria-hidden="true"
      className="inline-flex shrink-0 items-center justify-center"
      style={{
        transform: active ? "rotate(-4deg) scale(1.04)" : "rotate(-2deg)",
        transition: "transform 220ms cubic-bezier(.2,.8,.2,1), filter 220ms ease",
        filter: active
          ? "drop-shadow(0 4px 10px rgba(201,49,42,0.32))"
          : "drop-shadow(0 1px 4px rgba(201,49,42,0.18))",
      }}
    >
      <NumeralSeal numeral={kanji} size={size} />
    </span>
  );
}

function ActionTile({
  label,
  kanji,
  active,
  onClick,
  disabled,
}: {
  label: string;
  kanji: string;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        "flex w-full flex-col items-center justify-center gap-1.5 rounded-xl border px-2 py-3 text-center transition-all",
        "min-h-[88px] disabled:cursor-not-allowed disabled:opacity-50",
        active
          ? "border-[var(--accent)]/60 bg-[var(--accent-soft)] text-[var(--text-primary)] shadow-sm"
          : "border-[var(--border)] bg-transparent text-[var(--text-secondary)] hover:border-[var(--border-light)] hover:bg-[var(--bg-card-2)]/40 hover:text-[var(--text-primary)]"
      )}
    >
      <SealMark kanji={kanji} active={active} size={38} />
      <span className="font-mono text-[12px] font-semibold tracking-[0.04em] text-[var(--text-primary)]">
        {label}
      </span>
    </button>
  );
}

function ProtocolCard({
  meta,
  active,
  apr,
  loading,
  onClick,
  disabled,
}: {
  meta: ProtocolMeta;
  active: boolean;
  apr: { value: string; label: string } | null;
  loading: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        "group flex w-full flex-col items-center gap-2.5 rounded-xl border px-3.5 py-4 text-center transition-all",
        "min-h-[140px] disabled:cursor-not-allowed disabled:opacity-50",
        active
          ? "border-[var(--accent)]/60 bg-[var(--accent-soft)] text-[var(--text-primary)] shadow-sm"
          : "border-[var(--border)] bg-transparent text-[var(--text-secondary)] hover:border-[var(--border-light)] hover:bg-[var(--bg-card-2)]/40 hover:text-[var(--text-primary)]"
      )}
    >
      {/* Seal — centered */}
      <span
        className="inline-flex items-center justify-center"
        style={{
          transform: active ? "rotate(-4deg) scale(1.04)" : "rotate(-2deg)",
          transition: "transform 220ms cubic-bezier(.2,.8,.2,1), filter 220ms ease",
          filter: active
            ? "drop-shadow(0 4px 10px rgba(201,49,42,0.32))"
            : "drop-shadow(0 1px 4px rgba(201,49,42,0.18))",
        }}
        aria-hidden="true"
      >
        <LogoSeal logoSrc={meta.logoSrc} label={meta.label} size={40} />
      </span>

      {/* Name + active sparkle — centered */}
      <span className="flex items-center justify-center gap-1">
        <span className="truncate font-mono text-[13px] font-semibold tracking-[0.03em] text-[var(--text-primary)]">
          {meta.label}
        </span>
        {active && (
          <Sparkles className="h-3 w-3 shrink-0 text-[var(--accent)]" aria-hidden="true" />
        )}
      </span>

      {/* Tagline — centered, single line */}
      <span className="w-full truncate font-mono text-[10.5px] tracking-[0.02em] text-[var(--text-muted)]">
        {meta.tagline}
      </span>

      {/* APR value + label — centered, bottom-pinned */}
      <div className="mt-auto flex items-baseline justify-center gap-1.5">
        {loading ? (
          <span className="inline-block h-3 w-16 animate-pulse rounded bg-[var(--border)]/60" />
        ) : (
          <span
            className="font-mono text-[14px] font-semibold tabular-nums text-[var(--text-primary)]"
            title={apr?.label}
          >
            {apr?.value ?? "—"}
          </span>
        )}
        <span className="font-mono text-[10px] uppercase tracking-[0.06em] text-[var(--text-muted)]">
          {apr?.label ?? "\u00A0"}
        </span>
      </div>
    </button>
  );
}

function Pill({
  label,
  active,
  onClick,
  disabled,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5",
        "font-mono text-[11px] tracking-[0.05em] transition-all",
        "disabled:cursor-not-allowed disabled:opacity-50",
        active
          ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--text-primary)]"
          : "border-[var(--border)] bg-transparent text-[var(--text-secondary)] hover:border-[var(--border-light)] hover:bg-[var(--bg-card-2)]/40 hover:text-[var(--text-primary)]"
      )}
    >
      {active && <Sparkles className="h-3 w-3" style={{ color: "var(--accent)" }} />}
      {label}
    </button>
  );
}

function StatusBanner({
  tone,
  icon,
  title,
  linkLabel,
  href,
}: {
  tone: "success" | "error";
  icon: React.ReactNode;
  title: string;
  linkLabel?: string;
  href?: string;
}) {
  const palette =
    tone === "success"
      ? {
          bg: "rgba(61, 122, 92, 0.08)",
          border: "rgba(61, 122, 92, 0.35)",
          fg: "#7FB88F",
        }
      : {
          bg: "rgba(168, 41, 58, 0.08)",
          border: "rgba(168, 41, 58, 0.35)",
          fg: "#E87C87",
        };
  return (
    <div
      className="flex items-start gap-2.5 rounded-md border px-3 py-2.5 text-[12px]"
      style={{
        background: palette.bg,
        borderColor: palette.border,
        color: palette.fg,
      }}
    >
      <span className="mt-0.5 flex-shrink-0">{icon}</span>
      <div className="min-w-0 flex-1 break-words">
        <div>{title}</div>
        {linkLabel && href && (
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="mt-1 inline-flex items-center gap-1 font-mono text-[11px] underline underline-offset-2 opacity-90 hover:opacity-100"
          >
            {linkLabel}
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
        {linkLabel && !href && (
          <span className="mt-1 inline-block font-mono text-[11px] opacity-70">
            {linkLabel}
          </span>
        )}
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────
// Revoke row — marks the user's on-chain Intent as is_active = false.
// Fee = 0.1% × max_usd_value (pulled from cached localStorage secrets).
// ───────────────────────────────────────────────────────────────────
function RevokeRow({ disabled }: { disabled?: boolean }) {
  const { walletAddress, getProvider, isDemo } = useWallet();
  const [revoking, setRevoking] = useState(false);
  const [result, setResult] = useState<
    { kind: "idle" } | { kind: "ok"; sig: string } | { kind: "err"; msg: string }
  >({ kind: "idle" });
  const [revokeOverlay, setRevokeOverlay] = useState(false);

  const handleRevoke = async () => {
    const effectiveWallet =
      walletAddress ?? (isDemo ? DEMO_USER_PUBKEY : null);
    if (!effectiveWallet) return;

    const confirmed = window.confirm(
      "撤銷當前意圖？代理將無法再對此意圖執行任何動作。你可以之後重新簽署。"
    );
    if (!confirmed) return;

    // ── DEMO SHORT-CIRCUIT ──
    // Mirrors the on-chain revoke_intent: flips the intent's active flag.
    // History rows stay (they're immutable audit entries); IntentSummary
    // re-renders as "revoked"; a new sign will clear the revoked flag
    // automatically (see handleSign's demo branch).
    if (isDemo && !walletAddress) {
      try {
        setRevoking(true);
        setResult({ kind: "idle" });
        await new Promise((r) => setTimeout(r, 500));
        setDemoIntentRevoked(Date.now());
        setRevokeOverlay(true);
        const demoRevokeSig =
          "DemoRevoke" + Math.floor(Date.now() / 1000).toString(36);
        setResult({ kind: "ok", sig: demoRevokeSig });
      } finally {
        setRevoking(false);
      }
      return;
    }

    const provider = getProvider();
    if (!provider) return;

    try {
      setRevoking(true);
      setResult({ kind: "idle" });
      const user = new PublicKey(effectiveWallet);

      const cached = localStorage.getItem(`sakura:intent:${effectiveWallet}`);
      if (!cached) {
        throw new Error(
          "本機找不到意圖密鑰。請先簽署一次意圖，或清除狀態後重試。"
        );
      }
      const secrets = JSON.parse(cached) as { maxUsdValueMicro: string };
      const revokeFeeMicro =
        (BigInt(secrets.maxUsdValueMicro) * 10n) / 10_000n;

      const adminStr =
        process.env.NEXT_PUBLIC_SAKURA_PROTOCOL_ADMIN ?? DEVNET_PROTOCOL_ADMIN;
      const usdcMintStr =
        process.env.NEXT_PUBLIC_SAKURA_USDC_MINT ?? DEVNET_USDC_MINT;
      const admin = new PublicKey(adminStr);
      const usdcMint = new PublicKey(usdcMintStr);
      const [protocolPda] = deriveProtocolPDA(admin);
      const [feeVault] = deriveFeeVaultPDA(protocolPda);
      const userUsdcAta = getAssociatedTokenAddressSync(usdcMint, user);

      const ix = buildRevokeIntentIx({
        admin,
        user,
        userUsdcAta,
        feeVault,
        feeMicro: revokeFeeMicro,
      });

      const conn = new Connection(RPC, "confirmed");
      const { blockhash } = await conn.getLatestBlockhash();
      const message = new TransactionMessage({
        payerKey: user,
        recentBlockhash: blockhash,
        instructions: [ix],
      }).compileToV0Message();
      const tx = new VersionedTransaction(message);

      let signature: string;
      if ("signAndSendTransaction" in provider) {
        const res = await (
          provider as unknown as {
            signAndSendTransaction: (
              t: VersionedTransaction
            ) => Promise<{ signature: string }>;
          }
        ).signAndSendTransaction(tx);
        signature = res.signature;
      } else {
        const signed = await (
          provider as unknown as {
            signTransaction: (
              t: VersionedTransaction
            ) => Promise<VersionedTransaction>;
          }
        ).signTransaction(tx);
        signature = await conn.sendRawTransaction(signed.serialize());
      }

      localStorage.removeItem(`sakura:intent:${effectiveWallet}`);
      setResult({ kind: "ok", sig: signature });
    } catch (e: unknown) {
      setResult({
        kind: "err",
        msg: e instanceof Error ? e.message : String(e),
      });
    } finally {
      setRevoking(false);
    }
  };

  const revokeDisabled = disabled || revoking || (!walletAddress && !isDemo);
  return (
    <>
      <SealStampOverlay
        show={revokeOverlay}
        mode="revoke"
        onDone={() => setRevokeOverlay(false)}
      />
      <div className="flex items-center justify-between gap-3 py-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleRevoke}
          disabled={revokeDisabled}
          className="text-[12px] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
        >
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
          {revoking ? "撤銷中…" : "撤銷當前意圖"}
        </Button>
        {result.kind === "ok" && !isDemo && (
          <a
            href={`https://solscan.io/tx/${result.sig}?cluster=devnet`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-mono text-[11px] text-[var(--green)] hover:underline"
          >
            <CheckCircle2 className="h-3 w-3" />
            已撤銷 {result.sig.slice(0, 8)}…
          </a>
        )}
        {result.kind === "ok" && isDemo && (
          <span className="inline-flex items-center gap-1 font-mono text-[11px] text-[var(--text-muted)]">
            <CheckCircle2 className="h-3 w-3" />
            已撤銷（Demo · 模擬）
          </span>
        )}
        {result.kind === "err" && (
          <span className="font-mono text-[11px] text-[var(--red)]">
            {result.msg}
          </span>
        )}
      </div>
    </>
  );
}
