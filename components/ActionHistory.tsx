"use client";

/**
 * ActionHistory.tsx — on-chain audit trail of the user's agent-executed actions.
 *
 * Shadcn UI + Lucide icons + 和柄 Shippo background accent.
 * All RPC/deserialization logic unchanged from the prior inline-styled version.
 */

import { useCallback, useEffect, useState } from "react";
import { Connection, PublicKey } from "@solana/web3.js";
import {
  ScrollText,
  RefreshCw,
  CircleCheck,
  CircleSlash,
  Wallet,
  Clock,
} from "lucide-react";
import { useWallet } from "@/contexts/WalletContext";
import {
  ActionType,
  ProtocolId,
  SAKURA_INSURANCE_PROGRAM_ID,
  deserializeActionRecord,
  fetchIntent,
  type ActionRecordState,
  type IntentState,
} from "@/lib/insurance-pool";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Shippo } from "@/components/WaPattern";
import { cn } from "@/lib/utils";

const RPC = process.env.NEXT_PUBLIC_SOLANA_RPC ?? "https://api.devnet.solana.com";

// Account discriminator computed lazily via Web Crypto; cached per module.
let ACCT_DISC: Buffer | null = null;
async function getActionRecordDiscriminator(): Promise<Buffer> {
  if (ACCT_DISC) return ACCT_DISC;
  const buf = new TextEncoder().encode("account:ActionRecord");
  const hash = await crypto.subtle.digest("SHA-256", buf);
  ACCT_DISC = Buffer.from(new Uint8Array(hash).slice(0, 8));
  return ACCT_DISC;
}

interface ActionRow {
  pda: string;
  state: ActionRecordState;
}

// Base58 encoder for the memcmp filter (avoids pulling bs58).
function bs58Encode(bytes: Buffer): string {
  const ALPHABET =
    "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
  let n = 0n;
  for (const b of bytes) n = (n << 8n) | BigInt(b);
  let out = "";
  while (n > 0n) {
    const rem = Number(n % 58n);
    n = n / 58n;
    out = ALPHABET[rem] + out;
  }
  for (const b of bytes) {
    if (b === 0) out = "1" + out;
    else break;
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════
// Main component
// ═══════════════════════════════════════════════════════════════════

export default function ActionHistory() {
  const { walletAddress } = useWallet();
  const [intent, setIntent] = useState<IntentState | null>(null);
  const [rows, setRows] = useState<ActionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!walletAddress) return;
    setLoading(true);
    setError(null);
    try {
      const conn = new Connection(RPC, "confirmed");
      const user = new PublicKey(walletAddress);

      const { pda: intentPda, state: intentState } = await fetchIntent(conn, user);
      setIntent(intentState);

      if (!intentState) {
        setRows([]);
        return;
      }

      const disc = await getActionRecordDiscriminator();
      const accounts = await conn.getProgramAccounts(
        SAKURA_INSURANCE_PROGRAM_ID,
        {
          commitment: "confirmed",
          filters: [
            { memcmp: { offset: 0, bytes: bs58Encode(disc) } },
            { memcmp: { offset: 8, bytes: intentPda.toBase58() } },
          ],
        }
      );

      const parsed: ActionRow[] = [];
      for (const { pubkey, account } of accounts) {
        const state = deserializeActionRecord(Buffer.from(account.data));
        if (state) parsed.push({ pda: pubkey.toBase58(), state });
      }
      parsed.sort((a, b) => Number(b.state.ts - a.state.ts));
      setRows(parsed);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [walletAddress]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 15_000);
    return () => clearInterval(id);
  }, [refresh]);

  if (!walletAddress) {
    return (
      <Card className="relative overflow-hidden border-[var(--border)] bg-[var(--bg-card)]">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--bg-card-2)]">
              <ScrollText className="h-5 w-5" style={{ color: "var(--gold)" }} />
            </div>
            <div>
              <CardTitle className="font-serif text-xl tracking-wide">
                鏈上審計
              </CardTitle>
              <CardDescription className="text-[13px] text-[var(--text-secondary)]">
                連接錢包以載入你的意圖與代理執行歷史。
              </CardDescription>
            </div>
          </div>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card className="relative overflow-hidden border-[var(--border)] bg-[var(--bg-card)]">
      <Shippo className="absolute inset-0 pointer-events-none" opacity={0.03} />

      <CardHeader className="relative z-10 flex-row items-start justify-between space-y-0 pb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-md border border-[var(--border)] bg-[var(--bg-card-2)]">
            <ScrollText className="h-5 w-5" style={{ color: "var(--gold)" }} />
          </div>
          <div>
            <CardTitle className="font-serif text-xl tracking-wide">
              鏈上審計
            </CardTitle>
            <CardDescription className="text-[13px] text-[var(--text-secondary)]">
              代理每一次動作的鏈上記錄，15 秒自動刷新。
            </CardDescription>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={refresh}
          disabled={loading}
          className="text-[var(--text-muted)] hover:text-[var(--text-primary)]"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          <span className="ml-1.5 font-mono text-[11px]">refresh</span>
        </Button>
      </CardHeader>

      <Separator className="bg-[var(--border)]" />

      <CardContent className="relative z-10 space-y-4 py-6">
        <IntentSummary intent={intent} />

        {error && (
          <div className="flex items-start gap-2 rounded-md border border-[var(--red)]/40 bg-[var(--red-soft)] px-3 py-2 text-[12px] text-[#E87C87]">
            <CircleSlash className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <span className="break-all">{error}</span>
          </div>
        )}

        {intent && rows.length === 0 && (
          <div className="rounded-md border border-dashed border-[var(--border)] bg-[var(--bg-card-2)]/40 py-8 text-center">
            <Clock className="mx-auto h-6 w-6 text-[var(--text-muted)]" />
            <p className="mt-2 text-[12px] italic text-[var(--text-muted)]">
              尚無代理動作在此意圖下執行。
            </p>
          </div>
        )}

        {rows.length > 0 && (
          <div className="max-h-[380px] space-y-2 overflow-y-auto pr-1">
            {rows.map((r) => (
              <ActionRowView key={r.pda} row={r} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════════

function IntentSummary({ intent }: { intent: IntentState | null }) {
  if (!intent) {
    return (
      <div className="rounded-md border border-dashed border-[var(--border)] bg-[var(--bg-card-2)]/30 px-4 py-5 text-[13px] text-[var(--text-secondary)]">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-[var(--text-muted)]" />
          <span>尚無活躍意圖。簽署一份以授予代理受約束的執行權限。</span>
        </div>
      </div>
    );
  }
  const expiresMs = Number(intent.expiresAt) * 1000;
  const expired = expiresMs < Date.now();
  const active = intent.isActive && !expired;

  return (
    <div className="grid grid-cols-2 gap-x-8 gap-y-3 rounded-md border border-[var(--border)] bg-[var(--bg-base)]/60 px-4 py-4 font-mono text-[11px]">
      <SummaryItem
        label="狀態"
        value={
          <Badge
            variant="outline"
            className={cn(
              "font-mono text-[10px]",
              active
                ? "border-[var(--green)]/50 bg-[var(--green-soft)] text-[#7FB88F]"
                : "border-[var(--border)] text-[var(--text-muted)]"
            )}
          >
            {active ? "✓ active" : expired ? "expired" : "revoked"}
          </Badge>
        }
      />
      <SummaryItem
        label="動作次數"
        value={<span>{intent.actionsExecuted.toString()}</span>}
      />
      <SummaryItem
        label="有效期至"
        value={
          <span>
            {new Date(expiresMs).toLocaleString(undefined, {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        }
      />
      <SummaryItem
        label="承諾雜湊"
        value={
          <span className="truncate opacity-70" title={Buffer.from(intent.intentCommitment).toString("hex")}>
            0x
            {Buffer.from(intent.intentCommitment).toString("hex").slice(0, 14)}…
          </span>
        }
      />
    </div>
  );
}

function SummaryItem({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[9px] uppercase tracking-[0.16em] text-[var(--text-muted)]">
        {label}
      </span>
      <span className="text-[12px] text-[var(--text-primary)]">{value}</span>
    </div>
  );
}

function ActionRowView({ row }: { row: ActionRow }) {
  const s = row.state;
  const tsMs = Number(s.ts) * 1000;
  const priceUsd = Number(s.oraclePriceUsdMicro) / 1e6;
  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--bg-base)]/70 px-3 py-2.5 transition-colors hover:border-[var(--border-light)] hover:bg-[var(--bg-card-2)]/60">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CircleCheck className="h-3.5 w-3.5 flex-shrink-0" style={{ color: "var(--green)" }} />
          <span className="font-mono text-[12px]" style={{ color: "var(--accent)" }}>
            {ActionType[s.actionType] ?? `action#${s.actionType}`}
          </span>
          <span className="font-mono text-[11px] text-[var(--text-muted)]">→</span>
          <span className="font-mono text-[12px] text-[var(--text-primary)]">
            {ProtocolId[s.actionTargetIndex] ?? `protocol#${s.actionTargetIndex}`}
          </span>
        </div>
        <span className="font-mono text-[10px] text-[var(--text-muted)]">
          {new Date(tsMs).toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[10px] text-[var(--text-muted)]">
        <span>
          amount
          <span className="ml-1 text-[var(--text-secondary)]">
            {(Number(s.actionAmount) / 1e6).toLocaleString()} micro
          </span>
        </span>
        <span>·</span>
        <span>
          oracle
          <span className="ml-1 text-[var(--text-secondary)]">
            ${priceUsd.toFixed(2)}
          </span>
        </span>
        <span>·</span>
        <span>
          slot
          <span className="ml-1 text-[var(--text-secondary)]">
            {s.oracleSlot.toString()}
          </span>
        </span>
        <span>·</span>
        <span>
          fp
          <span className="ml-1 text-[var(--text-secondary)]">
            0x{s.proofFingerprint.toString("hex").slice(0, 10)}…
          </span>
        </span>
      </div>
    </div>
  );
}
