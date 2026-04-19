"use client";

/**
 * MutualPool.tsx — headline product UI for Sakura Mutual v0.2.
 *
 * The hackathon narrative: "First insurance protocol where claims are
 * settled by math." User deposits premium + stake, locks in a ZK-binding
 * commitment to their lending position, and when the position drifts
 * toward liquidation, the agent submits a Groth16 proof to the on-chain
 * verifier, which atomically moves USDC from the pool to the user's ATA
 * and repays Kamino debt — all in one v0 transaction, no trust required.
 *
 * Three subordinate tech-layers (Nonce Guardian, Ghost Run, Liquidation
 * Shield) are tabs in `app/page.tsx`. This component is the keystone.
 */

import { useEffect, useState } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { useLang } from "@/contexts/LanguageContext";
import { VersionedTransaction } from "@solana/web3.js";

type PoolView = {
  admin: string;
  adminAgent: string;
  platformTreasury: string;
  usdcMint: string;
  usdcVault: string;
  totalStakesUsdc: number;
  coverageOutstandingUsdc: number;
  totalClaimsPaidUsdc: number;
  premiumBps: number;
  platformFeeBps: number;
  minStakeMultiplier: number;
  maxCoveragePerUserUsdc: number;
  waitingPeriodSec: number;
  paused: boolean;
};

type PolicyView = {
  user: string;
  coverageCapUsdc: number;
  premiumPaidUsdc: number;
  stakeUsdc: number;
  paidThrough: string;
  boughtAt: string;
  totalClaimedUsdc: number;
  remainingCoverageUsdc: number;
  rescueCount: number;
  commitmentHash: string;
  isActive: boolean;
};

type Status = {
  poolAdmin?: string;
  programId?: string;
  pool: PoolView | null;
  policy: PolicyView | null;
};

const INSURANCE_PROGRAM_ID =
  process.env.NEXT_PUBLIC_INSURANCE_PROGRAM_ID?.trim() ||
  // v0.3 — redeployed at Ansze... after the Pyth-tag-parsing fix.
  // Old A91n... binary had inverted VerificationLevel discriminants
  // (treated tag=1 as Partial, tag=0 as Full) which corrupted every
  // posted_slot read and made every claim revert with OraclePriceMismatch.
  "AnszeCRFsBKmT5fBY9WywxGsZZZob8ZPFYqboYXpuYLp";

const POOL_ADMIN =
  process.env.NEXT_PUBLIC_INSURANCE_ADMIN?.trim() ||
  "2iCWnS1J8WYZn4reo9YD76qZiiZ39t2c1oGM3dyYwHNg";

export default function MutualPool({ isDemo }: { isDemo?: boolean }) {
  const { walletAddress, getProvider } = useWallet();
  const { t } = useLang();
  const [status, setStatus] = useState<Status | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [claimResult, setClaimResult] = useState<
    | null
    | {
        txSig?: string;
        txBase64?: string;
        commitmentHash?: string;
        proof?: { a: string; b: string; c: string; publicSignals: string[] };
        error?: string;
      }
  >(null);
  const [claimLoading, setClaimLoading] = useState(false);
  const [buyResult, setBuyResult] = useState<
    | null
    | {
        txSig?: string;
        commitmentHash?: string;
        nonce?: string;
        error?: string;
      }
  >(null);
  const [buyLoading, setBuyLoading] = useState(false);
  const [coverageCap, setCoverageCap] = useState<number>(500);

  // Poll pool/policy status
  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setErr(null);
      try {
        const qs = walletAddress ? `?user=${walletAddress}` : "";
        const res = await fetch(`/api/insurance/status${qs}`, { cache: "no-store" });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const json = (await res.json()) as Status;
        if (!cancelled) setStatus(json);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    const id = setInterval(load, 15000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [walletAddress]);

  async function buyPolicy() {
    if (!walletAddress) {
      setBuyResult({ error: t("mutualErrConnect") });
      return;
    }
    const provider = getProvider();
    if (!provider) {
      setBuyResult({ error: t("mutualErrNoProvider") });
      return;
    }
    setBuyLoading(true);
    setBuyResult(null);
    try {
      const res = await fetch("/api/insurance/buy-policy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: walletAddress,
          poolAdmin: POOL_ADMIN,
          coverageCapUsdc: coverageCap,
          // obligationAddress & nonceHex omitted → server uses defaults
          //   obligation = wallet (demo), nonce = random 128-bit
        }),
      });
      const json = await res.json();
      if (!res.ok || json.ok === false) {
        setBuyResult({ error: json.error ?? `HTTP ${res.status}` });
        return;
      }

      // Deserialize + sign v0 tx via wallet provider
      const txBytes = Uint8Array.from(atob(json.txBase64), (c) =>
        c.charCodeAt(0)
      );
      const vTx = VersionedTransaction.deserialize(txBytes);
      const signResult = await provider.signAndSendTransaction(vTx);
      const txSig =
        typeof signResult === "string" ? signResult : signResult?.signature;

      // Persist nonce locally so user can claim later
      try {
        localStorage.setItem(
          `sakura_policy_nonce_${walletAddress}`,
          JSON.stringify({
            nonce: json.nonce,
            commitmentHash: json.commitmentHash,
            boughtAt: Date.now(),
          })
        );
      } catch {
        // quota exceeded or storage disabled — non-fatal
      }

      setBuyResult({
        txSig,
        commitmentHash: json.commitmentHash,
        nonce: json.nonce,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Phantom rejection → friendlier error
      if (msg.includes("User rejected") || msg.includes("rejected")) {
        setBuyResult({ error: t("mutualErrRejected") });
      } else {
        setBuyResult({ error: msg });
      }
    } finally {
      setBuyLoading(false);
    }
  }

  async function triggerDemoClaim() {
    if (!walletAddress) {
      setClaimResult({ error: t("mutualErrConnect") });
      return;
    }
    setClaimLoading(true);
    setClaimResult(null);
    try {
      // Pull the nonce we saved when the policy was bought; falls back to "1"
      // so the demo-mode path still produces a proof (it'll fail on-chain
      // verification but lets the UI demonstrate the flow).
      let storedNonce = "1";
      try {
        const raw = localStorage.getItem(
          `sakura_policy_nonce_${walletAddress}`
        );
        if (raw) {
          const parsed = JSON.parse(raw) as { nonce?: string };
          if (parsed.nonce) storedNonce = parsed.nonce;
        }
      } catch {
        // localStorage parse error → fall back to "1"
      }

      const body = {
        wallet: walletAddress,
        poolAdmin: POOL_ADMIN,
        obligationAddress: walletAddress, // demo — production binds to Kamino obligation pubkey
        marketAddress: "",                // no Kamino repay in demo (pure ZK claim)
        rescueUsdc: 100,
        triggerHfBps: 10500,
        collateralAmount: "10000000000",  // 10 SOL in lamports
        debtUsdMicro: "1500000000",       // $1500 in micro-USD
        nonce: storedNonce,
        oraclePriceUsdMicro: "180000000", // $180 SOL (demo)
        oracleSlot: "0",                  // will be updated in real flow
      };
      const res = await fetch("/api/insurance/claim-with-repay", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || json.ok === false) {
        setClaimResult({ error: json.error ?? "claim failed" });
      } else {
        setClaimResult({
          txBase64: json.txBase64,
          commitmentHash: json.commitmentHash,
          proof: json.proof,
        });
      }
    } catch (e) {
      setClaimResult({ error: e instanceof Error ? e.message : String(e) });
    } finally {
      setClaimLoading(false);
    }
  }

  const hasPolicy = !!status?.policy && status.policy.isActive;
  const poolReady = !!status?.pool && !status.pool.paused;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Headline narrative card */}
      <div
        style={{
          padding: 20,
          border: "1px solid var(--accent-mid)",
          background: "var(--accent-soft)",
          borderRadius: 10,
        }}
      >
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 11,
            letterSpacing: "0.12em",
            color: "var(--accent)",
            marginBottom: 8,
          }}
        >
          {t("mutualBrandTag")}
        </div>
        <h2
          style={{
            margin: 0,
            fontSize: 22,
            fontWeight: 400,
            color: "var(--text-primary)",
            lineHeight: 1.3,
            letterSpacing: "0.02em",
          }}
        >
          {t("mutualHeadline1")} <em style={{ color: "var(--accent)", fontStyle: "normal" }}>{t("mutualHeadlineMath")}</em>{t("mutualHeadline2")}
        </h2>
        <p style={{ margin: "12px 0 0", fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>
          {t("mutualDescription")}{" "}
          <code style={{ color: "var(--accent)" }}>alt_bn128_pairing</code>
          {t("mutualDescriptionEnd")}
        </p>
      </div>

      {/* Pool state card */}
      <StateCard
        title={t("mutualPoolState")}
        loading={loading}
        err={err}
        empty={!status?.pool}
        emptyText={
          isDemo
            ? t("mutualPoolNotInitDemo")
            : t("mutualPoolNotInit")
        }
      >
        {status?.pool && (
          <Grid
            rows={[
              [t("mutualRowProgram"), short(INSURANCE_PROGRAM_ID)],
              [t("mutualRowAdmin"), short(status.pool.admin)],
              [t("mutualRowTotalStakes"), `$${fmt(status.pool.totalStakesUsdc)}`],
              [t("mutualRowCoverageOut"), `$${fmt(status.pool.coverageOutstandingUsdc)}`],
              [t("mutualRowClaimsPaid"), `$${fmt(status.pool.totalClaimsPaidUsdc)}`],
              [
                t("mutualRowPremiumFee"),
                `${(status.pool.premiumBps / 100).toFixed(2)}% / ${(status.pool.platformFeeBps / 100).toFixed(2)}%`,
              ],
              [
                t("mutualRowStakeMul"),
                `${(status.pool.minStakeMultiplier / 100).toFixed(2)}×`,
              ],
              [
                t("mutualRowWaitPeriod"),
                `${status.pool.waitingPeriodSec}s`,
              ],
              [t("mutualRowPaused"), status.pool.paused ? t("mutualYes") : t("mutualNo")],
            ]}
          />
        )}
      </StateCard>

      {/* Policy state card */}
      <StateCard
        title={t("mutualYourPolicy")}
        loading={loading}
        err={err}
        empty={!hasPolicy}
        emptyText={
          walletAddress
            ? t("mutualNoPolicy")
            : t("mutualConnectForPolicy")
        }
      >
        {status?.policy && (
          <Grid
            rows={[
              [t("mutualRowActive"), status.policy.isActive ? t("mutualActiveYes") : t("mutualActiveNo")],
              [t("mutualRowCoverageCap"), `$${fmt(status.policy.coverageCapUsdc)}`],
              [t("mutualRowRemaining"), `$${fmt(status.policy.remainingCoverageUsdc)}`],
              [t("mutualRowStake"), `$${fmt(status.policy.stakeUsdc)}`],
              [t("mutualRowPremiumPaid"), `$${fmt(status.policy.premiumPaidUsdc)}`],
              [t("mutualRowCommitment"), status.policy.commitmentHash.slice(0, 18) + "…"],
              [t("mutualRowRescuesUsed"), String(status.policy.rescueCount)],
              [t("mutualRowValidThru"), status.policy.paidThrough.slice(0, 10)],
            ]}
          />
        )}
      </StateCard>

      {/* Buy-policy form (only visible if no active policy) */}
      {!hasPolicy && (
        <div
          style={{
            padding: 16,
            border: "1px solid var(--border)",
            borderRadius: 10,
            background: "var(--bg-card)",
            display: "flex",
            flexDirection: "column",
            gap: 12,
          }}
        >
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: "0.14em",
              color: "var(--text-muted)",
            }}
          >
            {t("mutualBuyPolicy")}
          </div>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              fontSize: 13,
              color: "var(--text-secondary)",
            }}
          >
            <span style={{ minWidth: 120, fontFamily: "var(--font-mono)" }}>
              {t("mutualCoverageCap")}
            </span>
            <input
              type="number"
              min={10}
              max={status?.pool?.maxCoveragePerUserUsdc ?? 10000}
              step={10}
              value={coverageCap}
              onChange={(e) => setCoverageCap(Number(e.target.value))}
              style={{
                flex: 1,
                padding: "6px 10px",
                borderRadius: 6,
                border: "1px solid var(--border)",
                background: "var(--bg-base)",
                color: "var(--text-primary)",
                fontFamily: "var(--font-mono)",
                fontSize: 13,
              }}
            />
            <span style={{ color: "var(--text-muted)", fontSize: 12 }}>USDC</span>
          </label>
          {status?.pool && (
            <div
              style={{
                fontSize: 11,
                color: "var(--text-muted)",
                fontFamily: "var(--font-mono)",
                lineHeight: 1.6,
              }}
            >
              {t("mutualPremiumLine", {
                p: (coverageCap * status.pool.premiumBps / 10000).toFixed(2),
                s: (
                  (coverageCap * status.pool.premiumBps / 10000) *
                  (status.pool.minStakeMultiplier / 100)
                ).toFixed(2),
                w: status.pool.waitingPeriodSec,
              })}
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <ActionButton
          disabled={!walletAddress || !poolReady || hasPolicy || buyLoading}
          onClick={buyPolicy}
          label={buyLoading ? t("mutualBtnSigning") : t("mutualBtnBuy")}
          primary
        />
        <ActionButton
          disabled={!walletAddress || !hasPolicy || claimLoading}
          onClick={triggerDemoClaim}
          label={claimLoading ? t("mutualBtnProving") : t("mutualBtnRescue")}
        />
      </div>

      {/* Buy result */}
      {buyResult && (
        <div
          style={{
            padding: 16,
            border: "1px solid var(--border)",
            borderRadius: 10,
            background: "var(--bg-card)",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            color: "var(--text-secondary)",
          }}
        >
          {buyResult.error ? (
            <div style={{ color: "var(--red, #e66)" }}>✗ {buyResult.error}</div>
          ) : (
            <>
              <div style={{ color: "var(--green)", marginBottom: 8 }}>
                {t("mutualBoughtOk")}
              </div>
              {buyResult.txSig && (
                <div>
                  tx:{" "}
                  <a
                    href={`https://explorer.solana.com/tx/${buyResult.txSig}?cluster=devnet`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: "var(--accent)" }}
                  >
                    {buyResult.txSig.slice(0, 12)}…{buyResult.txSig.slice(-6)}
                  </a>
                </div>
              )}
              <div>commitment: {buyResult.commitmentHash?.slice(0, 20)}…</div>
              <div style={{ marginTop: 8, color: "var(--accent)" }}>
                {t("mutualNonceSaved")}
              </div>
            </>
          )}
        </div>
      )}

      {/* Claim result */}
      {claimResult && (
        <div
          style={{
            padding: 16,
            border: "1px solid var(--border)",
            borderRadius: 10,
            background: "var(--bg-card)",
            fontFamily: "var(--font-mono)",
            fontSize: 12,
            color: "var(--text-secondary)",
          }}
        >
          {claimResult.error ? (
            <div style={{ color: "var(--red, #e66)" }}>✗ {claimResult.error}</div>
          ) : (
            <>
              <div style={{ color: "var(--green)", marginBottom: 8 }}>{t("mutualProofOk")}</div>
              <div>commitment: {claimResult.commitmentHash}</div>
              {claimResult.proof && (
                <>
                  <div>A (64B): {claimResult.proof.a.slice(0, 22)}…</div>
                  <div>B (128B): {claimResult.proof.b.slice(0, 22)}…</div>
                  <div>C (64B): {claimResult.proof.c.slice(0, 22)}…</div>
                  <div style={{ marginTop: 8, color: "var(--text-muted)" }}>
                    {t("mutualPublicSignals", { n: claimResult.proof.publicSignals.length })}
                  </div>
                </>
              )}
              <div style={{ marginTop: 8, color: "var(--accent)" }}>
                {t("mutualSubmitHint")}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── tiny subcomponents ─────────────────────────────────────────────────

function StateCard({
  title,
  loading,
  err,
  empty,
  emptyText,
  children,
}: {
  title: string;
  loading: boolean;
  err: string | null;
  empty: boolean;
  emptyText: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      style={{
        padding: 16,
        border: "1px solid var(--border)",
        borderRadius: 10,
        background: "var(--bg-card)",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          letterSpacing: "0.14em",
          color: "var(--text-muted)",
          marginBottom: 12,
        }}
      >
        {title}
      </div>
      {loading && !children ? (
        <Skel />
      ) : err ? (
        <div style={{ fontSize: 12, color: "var(--red, #e66)" }}>✗ {err}</div>
      ) : empty ? (
        <div style={{ fontSize: 12, color: "var(--text-muted)", fontStyle: "italic" }}>{emptyText}</div>
      ) : (
        children
      )}
    </div>
  );
}

function Grid({ rows }: { rows: [string, string][] }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(160px, 1fr) auto",
        rowGap: 6,
        columnGap: 16,
        fontSize: 12,
        fontFamily: "var(--font-mono)",
      }}
    >
      {rows.map(([k, v]) => (
        <Row key={k} k={k} v={v} />
      ))}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <>
      <div style={{ color: "var(--text-muted)" }}>{k}</div>
      <div style={{ color: "var(--text-primary)", textAlign: "right" }}>{v}</div>
    </>
  );
}

function ActionButton({
  onClick,
  label,
  primary,
  disabled,
}: {
  onClick: () => void;
  label: string;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: "10px 16px",
        borderRadius: 8,
        border: primary ? "1px solid var(--accent)" : "1px solid var(--border)",
        background: primary ? "var(--accent-soft)" : "var(--bg-card)",
        color: primary ? "var(--accent)" : "var(--text-primary)",
        fontSize: 13,
        fontWeight: 500,
        letterSpacing: "0.04em",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        fontFamily: "var(--font-body)",
      }}
    >
      {label}
    </button>
  );
}

function Skel() {
  return (
    <div
      style={{
        height: 80,
        background: "linear-gradient(90deg, var(--bg-card), var(--border), var(--bg-card))",
        backgroundSize: "200% 100%",
        animation: "shimmer 1.2s infinite",
        borderRadius: 6,
      }}
    />
  );
}

// ── utils ─────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function short(s: string): string {
  return s.length > 16 ? `${s.slice(0, 6)}…${s.slice(-4)}` : s;
}
