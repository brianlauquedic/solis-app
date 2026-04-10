"use client";

import { useState } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { useLang } from "@/contexts/LanguageContext";
import type { TranslationKey } from "@/lib/i18n";
import type { LendingPosition, RescueSimulation, MonitorResult, ShieldConfig } from "@/lib/liquidation-shield";

interface MonitorResponse extends MonitorResult {
  config: ShieldConfig;
  rescueSimulations: RescueSimulation[];
  aiAnalysis: string | null;
}

interface RescueResponse {
  success: boolean;
  rescueSig: string | null;
  feeSig: string | null;
  feeUsdc: number;
  feeCollected: boolean;
  memoSig: string | null;
  auditChain: string | null;
  error: string | null;
}

import type { SolanaWalletProvider } from "@/types/phantom";

function getWalletProvider(): SolanaWalletProvider | null {
  if (typeof window === "undefined") return null;
  if (window.solana?.isPhantom) return window.solana;
  if (window.okxwallet?.solana) return window.okxwallet.solana;
  return null;
}

const PROTOCOL_COLOR: Record<string, string> = {
  kamino: "#FF9F0A",
  marginfi: "#34C759",
  solend: "#7C6FFF",
  unknown: "var(--text-muted)",
};

function healthColor(hf: number): string {
  if (hf < 1.05) return "#FF4444";
  if (hf < 1.2) return "#FF8C00";
  if (hf < 1.5) return "#FFD700";
  return "var(--green)";
}

function healthLabelKey(hf: number): string {
  if (hf < 1.0) return "shieldHLiquidating";
  if (hf < 1.05) return "shieldHCritical";
  if (hf < 1.2) return "shieldHWarning";
  if (hf < 1.5) return "shieldHCaution";
  return "shieldHSafe";
}

function healthLabelIcon(hf: number): string {
  if (hf < 1.0) return "🚨";
  if (hf < 1.05) return "🔴";
  if (hf < 1.2) return "⚠️";
  if (hf < 1.5) return "⚡";
  return "✅";
}

export default function LiquidationShield() {
  const { walletAddress } = useWallet();
  const { t } = useLang();
  const [inputAddr, setInputAddr] = useState(walletAddress ?? "");
  const [maxUsdc, setMaxUsdc] = useState("1000");
  const [triggerHF, setTriggerHF] = useState("1.05");
  const [loading, setLoading] = useState(false);
  const [rescuingIdx, setRescuingIdx] = useState<number | null>(null);
  const [result, setResult] = useState<MonitorResponse | null>(null);
  const [rescueResults, setRescueResults] = useState<Record<number, RescueResponse>>({});
  const [error, setError] = useState<string | null>(null);

  // ── SPL Approve authorization state ──────────────────────────────
  const [approveState, setApproveState] = useState<"idle" | "approving" | "approved" | "error">("idle");
  const [approveError, setApproveError] = useState<string | null>(null);
  const [approveSig, setApproveSig] = useState<string | null>(null);

  async function scan() {
    const addr = inputAddr.trim();
    if (!addr || addr.length < 32) { setError(t("shieldInvalidAddr")); return; }
    setLoading(true);
    setError(null);
    setResult(null);
    setRescueResults({});
    // Reset approval when scanning a new wallet
    setApproveState("idle");
    setApproveError(null);
    setApproveSig(null);
    try {
      const res = await fetch("/api/liquidation-shield/monitor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: addr,
          config: {
            approvedUsdc: parseFloat(maxUsdc) || 1000,
            triggerThreshold: parseFloat(triggerHF) || 1.05,
            targetHealthFactor: 1.4,
          },
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error((d as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      const data: MonitorResponse = await res.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("shieldScanFailed"));
    } finally {
      setLoading(false);
    }
  }

  // ── Step 1 of rescue: user authorizes SPL delegate via Phantom/OKX ──
  async function authorizeRescue() {
    if (!walletAddress) return;
    setApproveState("approving");
    setApproveError(null);

    try {
      // 1. Get agent pubkey from server (safe — public key only, no private key)
      const agentRes = await fetch("/api/liquidation-shield/rescue");
      if (!agentRes.ok) throw new Error("無法取得代理公鑰");
      const { agentPubkey, configured } = await agentRes.json() as {
        agentPubkey: string | null; configured: boolean;
      };
      if (!configured || !agentPubkey) {
        throw new Error("平台救援代理尚未配置 (SAKURA_AGENT_PRIVATE_KEY 未設置)");
      }

      // 2. Build SPL Token approve instruction
      const { Connection, PublicKey, Transaction } = await import("@solana/web3.js");
      const { createApproveInstruction, getAssociatedTokenAddressSync } =
        await import("@solana/spl-token");

      const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
      const conn = new Connection(`${window.location.origin}/api/rpc`, "confirmed");

      const walletPubkey  = new PublicKey(walletAddress);
      const agentPubkeyObj = new PublicKey(agentPubkey);
      const usdcMintPubkey = new PublicKey(USDC_MINT);
      const userUsdcAta   = getAssociatedTokenAddressSync(usdcMintPubkey, walletPubkey);

      // Approve = pre-authorized max rescue amount in micro-USDC (6 decimals)
      const approveAmount = BigInt(Math.ceil((parseFloat(maxUsdc) || 1000) * 1_000_000));

      const approveIx = createApproveInstruction(
        userUsdcAta,      // token account to delegate
        agentPubkeyObj,   // delegate (Sakura rescue agent)
        walletPubkey,     // owner (user)
        approveAmount     // max USDC in micro-USDC
      );

      const { blockhash, lastValidBlockHeight } = await conn.getLatestBlockhash("confirmed");
      const tx = new Transaction({
        recentBlockhash: blockhash,
        feePayer: walletPubkey,
      }).add(approveIx);

      // 3. Sign and send via Phantom / OKX
      const provider = getWalletProvider();
      if (!provider) throw new Error("請連接 Phantom 或 OKX 錢包");

      const { signature } = await provider.signAndSendTransaction(tx);
      await conn.confirmTransaction(
        { signature, blockhash, lastValidBlockHeight },
        "confirmed"
      );

      setApproveSig(signature);
      setApproveState("approved");
    } catch (err) {
      setApproveState("error");
      const msg = err instanceof Error ? err.message : "授權失敗";
      // Friendly messages for common wallet rejections
      if (msg.includes("User rejected") || msg.includes("user_rejected") || msg.includes("rejected")) {
        setApproveError("用戶取消了簽名請求");
      } else {
        setApproveError(msg);
      }
    }
  }

  // ── Step 2: Execute rescue (requires prior SPL approve) ───────────
  async function executeRescue(sim: RescueSimulation, idx: number) {
    if (!walletAddress) return;
    setRescuingIdx(idx);
    try {
      const res = await fetch("/api/liquidation-shield/rescue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          wallet: walletAddress,
          position: sim.position,
          rescueUsdc: sim.rescueUsdc,
          mandateTxSig: approveSig ?? undefined,
        }),
      });
      const data: RescueResponse = await res.json();
      setRescueResults(prev => ({ ...prev, [idx]: data }));
    } catch (err) {
      setRescueResults(prev => ({
        ...prev,
        [idx]: {
          success: false,
          rescueSig: null, feeSig: null, feeUsdc: 0, feeCollected: false,
          memoSig: null, auditChain: null,
          error: err instanceof Error ? err.message : t("shieldRescueFailed2"),
        },
      }));
    } finally {
      setRescuingIdx(null);
    }
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          background: "rgba(255,68,68,0.08)", border: "1px solid rgba(255,68,68,0.25)",
          borderRadius: 20, padding: "4px 12px", marginBottom: 12,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#FF4444", display: "inline-block", animation: "pulse 2s infinite" }} />
          <span style={{ fontSize: 11, color: "#FF4444", fontWeight: 500, letterSpacing: 1.2, fontFamily: "var(--font-mono)" }}>
            LIQUIDATION SHIELD — ACTIVE MONITORING
          </span>
        </div>
        <h2 style={{
          fontSize: 20, fontWeight: 300, color: "var(--text-primary)",
          fontFamily: "var(--font-heading)", letterSpacing: "0.06em", marginBottom: 8,
        }}>
          {t("shieldTitle")}
        </h2>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.8, maxWidth: 560 }}>
          {t("shieldDesc")}
        </p>
      </div>

      {/* Config Panel */}
      <div style={{
        background: "var(--bg-card)", border: "1px solid var(--border)",
        borderTop: "2px solid #FF4444",
        borderRadius: 10, padding: "20px 22px", marginBottom: 20,
      }}>
        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 14 }}>
          {t("shieldConfigLabel")}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>{t("shieldMaxUsdc")}</div>
            <input
              type="number"
              value={maxUsdc}
              onChange={e => setMaxUsdc(e.target.value)}
              min={0}
              style={{
                width: "100%", background: "var(--bg-base)", border: "1px solid var(--border)",
                borderRadius: 8, padding: "8px 12px", fontSize: 13,
                color: "var(--text-primary)", fontFamily: "var(--font-mono)", boxSizing: "border-box",
              }}
            />
            <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>{t("shieldMaxUsdcHint")}</div>
          </div>
          <div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>{t("shieldTriggerHF")}</div>
            <input
              type="number"
              value={triggerHF}
              onChange={e => setTriggerHF(e.target.value)}
              min={1.0} max={2.0} step={0.05}
              style={{
                width: "100%", background: "var(--bg-base)", border: "1px solid var(--border)",
                borderRadius: 8, padding: "8px 12px", fontSize: 13,
                color: "var(--text-primary)", fontFamily: "var(--font-mono)", boxSizing: "border-box",
              }}
            />
            <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>{t("shieldTriggerHFHint")}</div>
          </div>
        </div>

        {/* Wallet input */}
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <input
            value={inputAddr}
            onChange={e => setInputAddr(e.target.value)}
            placeholder={t("addressPlaceholder")}
            style={{
              flex: 1, background: "var(--bg-base)", border: "1px solid var(--border)",
              borderRadius: 8, padding: "10px 14px", fontSize: 13,
              color: "var(--text-primary)", fontFamily: "var(--font-mono)", outline: "none",
            }}
            onKeyDown={e => e.key === "Enter" && scan()}
          />
          <button
            onClick={scan}
            disabled={loading}
            style={{
              background: loading ? "var(--border)" : "#FF4444",
              border: "none", borderRadius: 8, padding: "10px 20px",
              fontSize: 13, fontWeight: 500, color: "#fff",
              cursor: loading ? "not-allowed" : "pointer",
              letterSpacing: "0.04em", whiteSpace: "nowrap",
            }}
          >
            {loading ? t("shieldScanning") : t("shieldScanBtn")}
          </button>
        </div>
        {walletAddress && walletAddress !== inputAddr && (
          <button
            onClick={() => setInputAddr(walletAddress)}
            style={{ marginTop: 8, fontSize: 11, color: "var(--accent)", background: "none", border: "none", cursor: "pointer", padding: 0 }}
          >
            {t("shieldUseConnected")}
          </button>
        )}
      </div>

      {/* Error */}
      {error && (
        <div style={{
          background: "rgba(255,68,68,0.08)", border: "1px solid rgba(255,68,68,0.3)",
          borderRadius: 8, padding: "12px 16px", marginBottom: 16,
          fontSize: 13, color: "#FF4444",
        }}>
          ⚠️ {error}
        </div>
      )}

      {/* Results */}
      {result && (
        <div>
          {/* Summary bar */}
          <div style={{
            background: "var(--bg-card)", border: "1px solid var(--border)",
            borderRadius: 10, padding: "16px 20px", marginBottom: 16,
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4, letterSpacing: "0.08em", fontFamily: "var(--font-mono)" }}>
                POSITION SCAN
              </div>
              <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>
                {result.positions.length === 0
                  ? t("shieldNoPositions")
                  : `${result.positions.length} · ${result.atRisk.length > 0 ? `${result.atRisk.length} ${t("shieldAtRisk")}` : t("shieldAllSafe")}`}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                SOL: ${result.solPrice} · Kamino + MarginFi
              </div>
            </div>
            {result.atRisk.length > 0 && (
              <div style={{
                background: "rgba(255,68,68,0.12)", border: "1px solid rgba(255,68,68,0.3)",
                borderRadius: 8, padding: "8px 14px", fontSize: 13, fontWeight: 600, color: "#FF4444",
              }}>
                🚨 {result.atRisk.length} {t("shieldHighRisk")}
              </div>
            )}
          </div>

          {/* ── SPL Approve Authorization Panel (shown when at-risk positions exist) ── */}
          {result.atRisk.length > 0 && (
            <div style={{
              background: "var(--bg-card)", border: "1px solid var(--border)",
              borderTop: `2px solid ${approveState === "approved" ? "var(--green)" : "#FF9F0A"}`,
              borderRadius: 10, padding: "16px 20px", marginBottom: 16,
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 11, color: approveState === "approved" ? "var(--green)" : "#FF9F0A", letterSpacing: "0.08em", fontFamily: "var(--font-mono)", marginBottom: 4 }}>
                    {approveState === "approved" ? "✓ RESCUE AUTHORIZED" : "STEP 1 — AUTHORIZE RESCUE"}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.7 }}>
                    {approveState === "approved"
                      ? `已授權最高 $${maxUsdc} USDC 給 Sakura 救援代理。可執行下方救援操作。`
                      : `授權 Sakura 代理最高使用 $${maxUsdc} USDC 執行救援。這是 SPL Token 委派授權，不會立即移動資金。`}
                  </div>
                </div>
                {approveState === "approved" && approveSig && (
                  <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "var(--font-mono)", textAlign: "right" }}>
                    Approve TX<br />{approveSig.slice(0, 14)}…
                  </div>
                )}
              </div>

              {approveState !== "approved" && (
                <button
                  onClick={authorizeRescue}
                  disabled={approveState === "approving"}
                  style={{
                    background: approveState === "approving" ? "var(--border)" : "#FF9F0A",
                    border: "none", borderRadius: 8, padding: "9px 20px",
                    fontSize: 12, fontWeight: 600, color: approveState === "approving" ? "var(--text-muted)" : "#000",
                    cursor: approveState === "approving" ? "not-allowed" : "pointer",
                    letterSpacing: "0.04em",
                  }}
                >
                  {approveState === "approving"
                    ? "⏳ 等待錢包簽名…"
                    : approveState === "error"
                    ? "🔄 重試授權"
                    : `🔐 授權救援（$${maxUsdc} USDC 上限）`}
                </button>
              )}

              {approveState === "error" && approveError && (
                <div style={{ fontSize: 12, color: "#FF4444", marginTop: 8 }}>
                  ⚠️ {approveError}
                </div>
              )}
            </div>
          )}

          {/* Positions */}
          {result.positions.map((pos: LendingPosition, i: number) => {
            const sim = result.rescueSimulations[i];
            const rescueRes = rescueResults[i];

            return (
              <div key={i} style={{
                background: "var(--bg-card)", border: "1px solid var(--border)",
                borderLeft: `3px solid ${healthColor(pos.healthFactor)}`,
                borderRadius: 10, padding: "16px 20px", marginBottom: 12,
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{
                      fontSize: 10, fontWeight: 600, letterSpacing: "0.08em",
                      color: PROTOCOL_COLOR[pos.protocol],
                      background: `${PROTOCOL_COLOR[pos.protocol]}18`,
                      border: `1px solid ${PROTOCOL_COLOR[pos.protocol]}35`,
                      borderRadius: 4, padding: "2px 8px", fontFamily: "var(--font-mono)",
                    }}>
                      {pos.protocol.toUpperCase()}
                    </span>
                    {pos.accountAddress && (
                      <span style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                        {pos.accountAddress.slice(0, 12)}…
                      </span>
                    )}
                  </div>
                  <HealthBadge hf={pos.healthFactor} />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, marginBottom: 12 }}>
                  <MetricBox label={t("shieldCollateral")} value={`$${pos.collateralUsd.toFixed(0)}`} sub={pos.collateralToken} />
                  <MetricBox label={t("shieldDebt")} value={`$${pos.debtUsd.toFixed(0)}`} sub={pos.debtToken} />
                  <MetricBox label={t("shieldHealthFactor")} value={pos.healthFactor.toFixed(3)} highlight={healthColor(pos.healthFactor)} />
                  <MetricBox label={t("shieldLiqThreshold")} value={`${(pos.liquidationThreshold * 100).toFixed(0)}%`} />
                </div>

                {/* Rescue simulation (for at-risk positions) */}
                {sim && pos.healthFactor < parseFloat(triggerHF) + 0.1 && (
                  <div style={{
                    background: "rgba(255,68,68,0.05)", border: "1px solid rgba(255,68,68,0.2)",
                    borderRadius: 8, padding: "12px 14px", marginBottom: 12,
                  }}>
                    <div style={{ fontSize: 11, color: "#FF4444", letterSpacing: "0.08em", marginBottom: 8, fontFamily: "var(--font-mono)" }}>
                      RESCUE SIMULATION (simulateTransaction)
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
                      <MetricBox label={t("shieldRescueNeeded")} value={`$${sim.rescueUsdc.toFixed(2)} USDC`} highlight="#FF9F0A" />
                      <MetricBox label="救援費用 (1%)" value={`$${(sim.rescueUsdc * 0.01).toFixed(4)} USDC`} highlight="var(--text-muted)" />
                      <MetricBox label={t("shieldPostHF")} value={sim.postRescueHealth.toFixed(3)} highlight="var(--green)" />
                      <MetricBox label="Gas" value={`${(sim.gasSol * 1e6).toFixed(1)} μSOL`} />
                    </div>
                    <div style={{ marginTop: 8, fontSize: 11, color: sim.withinMandate ? "var(--green)" : "#FF4444" }}>
                      {sim.withinMandate
                        ? `✓ ≤ $${result.config.approvedUsdc} USDC`
                        : `✗ > $${result.config.approvedUsdc} USDC`}
                    </div>

                    {/* STEP 2: Rescue button — only enabled after SPL approval */}
                    {!rescueRes && sim.withinMandate && (
                      <div style={{ marginTop: 10 }}>
                        {approveState !== "approved" ? (
                          <div style={{
                            padding: "8px 14px", borderRadius: 8,
                            background: "rgba(255,159,10,0.08)", border: "1px solid rgba(255,159,10,0.3)",
                            fontSize: 12, color: "#FF9F0A",
                          }}>
                            ⬆️ 請先完成上方「Step 1 授權救援」後再執行救援
                          </div>
                        ) : (
                          <button
                            onClick={() => executeRescue(sim, i)}
                            disabled={rescuingIdx === i}
                            style={{
                              background: rescuingIdx === i ? "var(--border)" : "#FF4444",
                              border: "none", borderRadius: 8, padding: "8px 18px",
                              fontSize: 12, fontWeight: 600, color: "#fff",
                              cursor: rescuingIdx === i ? "not-allowed" : "pointer",
                            }}
                          >
                            {rescuingIdx === i ? t("shieldRescuing") : `${t("shieldRescueBtn")} ($${sim.rescueUsdc.toFixed(2)} USDC · 1% fee)`}
                          </button>
                        )}
                      </div>
                    )}

                    {rescueRes && (
                      <div style={{
                        marginTop: 10, padding: "10px 12px",
                        background: rescueRes.success ? "rgba(52,199,89,0.1)" : "rgba(255,68,68,0.1)",
                        borderRadius: 8,
                      }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: rescueRes.success ? "var(--green)" : "#FF4444", marginBottom: 6 }}>
                          {rescueRes.success ? t("shieldRescueSuccess") : t("shieldRescueFailed")}
                        </div>
                        {rescueRes.rescueSig && (
                          <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                            TX: {rescueRes.rescueSig.slice(0, 20)}…
                          </div>
                        )}
                        {rescueRes.feeCollected && rescueRes.feeSig ? (
                          <div style={{ fontSize: 11, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginTop: 2 }}>
                            Fee TX (1% = ${rescueRes.feeUsdc.toFixed(4)} USDC): {rescueRes.feeSig.slice(0, 20)}…
                          </div>
                        ) : rescueRes.success ? (
                          <div style={{ fontSize: 11, color: "#FF9F0A", marginTop: 2 }}>
                            ⚠️ 1% 服務費收取失敗（已重試，網路問題所致，救援仍成功）
                          </div>
                        ) : null}
                        {rescueRes.auditChain && (
                          <div style={{ fontSize: 11, color: "var(--accent)", marginTop: 4, fontFamily: "var(--font-mono)" }}>
                            {t("shieldAuditChain")}: {rescueRes.auditChain}
                          </div>
                        )}
                        {rescueRes.error && (
                          <div style={{ fontSize: 12, color: "#FF4444", marginTop: 4 }}>{rescueRes.error}</div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* AI Analysis */}
          {result.aiAnalysis && (
            <div style={{
              background: "var(--bg-card)", border: "1px solid var(--border)",
              borderTop: "2px solid var(--accent)",
              borderRadius: 10, padding: "18px 20px", marginBottom: 16,
            }}>
              <div style={{ fontSize: 10, color: "var(--accent)", letterSpacing: "0.12em", fontFamily: "var(--font-mono)", fontWeight: 600, marginBottom: 12 }}>
                ✦ AI RISK ANALYSIS
              </div>
              <div style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 2.0, whiteSpace: "pre-wrap" }}>
                {result.aiAnalysis}
              </div>
            </div>
          )}

          {/* Empty state */}
          {result.positions.length === 0 && (
            <div style={{
              background: "rgba(52,199,89,0.08)", border: "1px solid rgba(52,199,89,0.25)",
              borderRadius: 10, padding: "24px", textAlign: "center",
            }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
              <div style={{ fontSize: 15, color: "var(--text-primary)", fontWeight: 500, marginBottom: 6 }}>
                {t("shieldNoPositions")}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                {t("shieldNoPositionsDesc")}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Educational footer */}
      <div style={{
        marginTop: 24, padding: "14px 18px",
        background: "var(--bg-card)", border: "1px solid var(--border)",
        borderRadius: 8,
      }}>
        <div style={{ fontSize: 11, color: "var(--text-muted)", letterSpacing: "0.08em", marginBottom: 6, fontFamily: "var(--font-mono)" }}>
          {t("shieldHowTitle")}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.85 }}>
          {t("shieldHowDesc")}
        </div>
      </div>
    </div>
  );
}

function HealthBadge({ hf }: { hf: number }) {
  const { t } = useLang();
  return (
    <div style={{
      background: `${healthColor(hf)}18`,
      border: `1px solid ${healthColor(hf)}40`,
      borderRadius: 8, padding: "6px 12px",
      fontSize: 13, fontWeight: 700, color: healthColor(hf),
      display: "flex", alignItems: "center", gap: 6,
    }}>
      <span>{healthLabelIcon(hf)} {t(healthLabelKey(hf) as TranslationKey)}</span>
      <span style={{ fontFamily: "var(--font-mono)", fontSize: 12 }}>{hf.toFixed(3)}</span>
    </div>
  );
}

function MetricBox({ label, value, sub, highlight }: {
  label: string; value: string; sub?: string; highlight?: string
}) {
  return (
    <div style={{ background: "var(--bg-base)", borderRadius: 8, padding: "10px 12px" }}>
      <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 4, letterSpacing: "0.08em", fontFamily: "var(--font-mono)" }}>
        {label}
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color: highlight ?? "var(--text-primary)" }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}
