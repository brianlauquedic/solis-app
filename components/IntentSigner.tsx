"use client";

/**
 * IntentSigner.tsx — user-facing intent-signing form (v0.3).
 *
 * Shadcn UI + Lucide icons + 和柄 Seigaiha background accent.
 * All logic (Poseidon commitment, USDC fee transfer, wallet signing)
 * is preserved from the prior inline-styled version; only presentation
 * was rewritten.
 */

import { useCallback, useState } from "react";
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

const PROTOCOL_LABELS = [
  { id: ProtocolId.Kamino, label: "Kamino" },
  { id: ProtocolId.MarginFi, label: "MarginFi" },
  { id: ProtocolId.Solend, label: "Solend" },
  { id: ProtocolId.Jupiter, label: "Jupiter" },
  { id: ProtocolId.Marinade, label: "Marinade" },
  { id: ProtocolId.Jito, label: "Jito" },
];

const ACTION_LABELS = [
  { id: ActionType.Lend, label: "Lend" },
  { id: ActionType.Repay, label: "Repay" },
  { id: ActionType.Swap, label: "Swap" },
  { id: ActionType.Stake, label: "Stake" },
  { id: ActionType.Withdraw, label: "Withdraw" },
  { id: ActionType.Borrow, label: "Borrow" },
];

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

export default function IntentSigner() {
  const { walletAddress, getProvider } = useWallet();

  const [intentText, setIntentText] = useState(
    "Lend up to 1000 USDC into Kamino or MarginFi, $10k max per action."
  );
  const [maxAmountTokens, setMaxAmountTokens] = useState("1000");
  const [maxUsdDollars, setMaxUsdDollars] = useState("10000");
  const [hours, setHours] = useState("24");
  const [selectedProtocols, setSelectedProtocols] = useState<Set<ProtocolId>>(
    new Set([ProtocolId.Kamino, ProtocolId.MarginFi])
  );
  const [selectedActions, setSelectedActions] = useState<Set<ActionType>>(
    new Set([ActionType.Lend, ActionType.Repay])
  );
  const [status, setStatus] = useState<Status>({ kind: "idle" });

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
    if (!walletAddress) {
      setStatus({ kind: "error", message: "請先連接錢包。" });
      return;
    }
    const provider = getProvider();
    if (!provider) {
      setStatus({ kind: "error", message: "偵測不到錢包 Provider。" });
      return;
    }
    const adminStr = process.env.NEXT_PUBLIC_SAKURA_PROTOCOL_ADMIN;
    if (!adminStr) {
      setStatus({
        kind: "error",
        message: "未設置 NEXT_PUBLIC_SAKURA_PROTOCOL_ADMIN 環境變量。",
      });
      return;
    }

    try {
      setStatus({ kind: "computing" });
      const user = new PublicKey(walletAddress);
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

      const usdcMintStr = process.env.NEXT_PUBLIC_SAKURA_USDC_MINT;
      if (!usdcMintStr) {
        throw new Error("未設置 NEXT_PUBLIC_SAKURA_USDC_MINT 環境變量。");
      }
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
      if ("signAndSendTransaction" in provider) {
        const result = await (
          provider as unknown as {
            signAndSendTransaction: (
              t: VersionedTransaction
            ) => Promise<{ signature: string }>;
          }
        ).signAndSendTransaction(tx);
        signature = result.signature;
      } else {
        const signed = await (
          provider as unknown as {
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
    <Card className="relative overflow-hidden border-[var(--border)] bg-[var(--bg-card)]">
      <Seigaiha className="absolute inset-0 pointer-events-none" opacity={0.04} />

      <CardHeader className="relative z-10 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--bg-card-2)]">
            <PenLine className="h-5 w-5" style={{ color: "var(--accent)" }} />
          </div>
          <div>
            <CardTitle className="font-serif text-xl tracking-wide">
              簽一次意圖
            </CardTitle>
            <CardDescription className="text-[13px] text-[var(--text-secondary)]">
              一句話寫下代理權限邊界，鏈上只存 32 位元組雜湊。
            </CardDescription>
          </div>
        </div>
      </CardHeader>

      <Separator className="bg-[var(--border)]" />

      <CardContent className="relative z-10 space-y-6 py-6">
        {/* Intent text */}
        <div className="space-y-2">
          <Label className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--text-muted)]">
            意圖 Intent
          </Label>
          <Textarea
            value={intentText}
            onChange={(e) => setIntentText(e.target.value)}
            rows={2}
            maxLength={500}
            disabled={isBusy}
            className="resize-y border-[var(--border)] bg-[var(--bg-base)] font-mono text-[13px] text-[var(--text-primary)] placeholder:text-[var(--text-muted)]"
            placeholder="代理可在 Kamino 借貸，單次最多 $500 USDC，為期一週。"
          />
        </div>

        {/* Numeric inputs — 3 columns */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
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

        {/* Protocols */}
        <div className="space-y-2">
          <Label className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--text-muted)]">
            允許協議 Allowed protocols
          </Label>
          <div className="flex flex-wrap gap-2">
            {PROTOCOL_LABELS.map(({ id, label }) => (
              <Pill
                key={id}
                label={label}
                active={selectedProtocols.has(id)}
                onClick={() => toggleProtocol(id)}
                disabled={isBusy}
              />
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          <Label className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--text-muted)]">
            允許動作 Allowed actions
          </Label>
          <div className="flex flex-wrap gap-2">
            {ACTION_LABELS.map(({ id, label }) => (
              <Pill
                key={id}
                label={label}
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
          disabled={isBusy || !walletAddress}
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
            title="意圖已上鏈簽署"
            linkLabel={`${status.signature.slice(0, 12)}…`}
            href={`https://solscan.io/tx/${status.signature}?cluster=devnet`}
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

      <CardFooter className="relative z-10 justify-between border-t border-[var(--border)] bg-[var(--bg-card-2)]/40 py-3">
        <span className="font-mono text-[10px] text-[var(--text-muted)]">
          Program · {SAKURA_INSURANCE_PROGRAM_ID.toBase58().slice(0, 10)}…
        </span>
        <span className="font-mono text-[10px] text-[var(--text-muted)]">
          簽名費 0.1% × max_usd_value
        </span>
      </CardFooter>
    </Card>
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
    <div className="space-y-2">
      <Label className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--text-muted)]">
        {label}
      </Label>
      <Input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        min={min}
        max={max}
        className="border-[var(--border)] bg-[var(--bg-base)] font-mono text-[13px] text-[var(--text-primary)]"
      />
    </div>
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
      </div>
    </div>
  );
}

// ───────────────────────────────────────────────────────────────────
// Revoke row — marks the user's on-chain Intent as is_active = false.
// Fee = 0.1% × max_usd_value (pulled from cached localStorage secrets).
// ───────────────────────────────────────────────────────────────────
function RevokeRow({ disabled }: { disabled?: boolean }) {
  const { walletAddress, getProvider } = useWallet();
  const [revoking, setRevoking] = useState(false);
  const [result, setResult] = useState<
    { kind: "idle" } | { kind: "ok"; sig: string } | { kind: "err"; msg: string }
  >({ kind: "idle" });

  const handleRevoke = async () => {
    if (!walletAddress) return;
    const provider = getProvider();
    if (!provider) return;

    const confirmed = window.confirm(
      "撤銷當前意圖？代理將無法再對此意圖執行任何動作。你可以之後重新簽署。"
    );
    if (!confirmed) return;

    try {
      setRevoking(true);
      setResult({ kind: "idle" });
      const user = new PublicKey(walletAddress);

      const cached = localStorage.getItem(`sakura:intent:${walletAddress}`);
      if (!cached) {
        throw new Error(
          "本機找不到意圖密鑰。請先簽署一次意圖，或清除狀態後重試。"
        );
      }
      const secrets = JSON.parse(cached) as { maxUsdValueMicro: string };
      const revokeFeeMicro =
        (BigInt(secrets.maxUsdValueMicro) * 10n) / 10_000n;

      const adminStr = process.env.NEXT_PUBLIC_SAKURA_PROTOCOL_ADMIN;
      const usdcMintStr = process.env.NEXT_PUBLIC_SAKURA_USDC_MINT;
      if (!adminStr || !usdcMintStr) {
        throw new Error(
          "缺少 NEXT_PUBLIC_SAKURA_PROTOCOL_ADMIN 或 NEXT_PUBLIC_SAKURA_USDC_MINT 環境變量。"
        );
      }
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

      localStorage.removeItem(`sakura:intent:${walletAddress}`);
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

  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={handleRevoke}
        disabled={disabled || revoking || !walletAddress}
        className="text-[12px] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
      >
        <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
        {revoking ? "撤銷中…" : "撤銷當前意圖"}
      </Button>
      {result.kind === "ok" && (
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
      {result.kind === "err" && (
        <span className="font-mono text-[11px] text-[var(--red)]">
          {result.msg}
        </span>
      )}
    </div>
  );
}
