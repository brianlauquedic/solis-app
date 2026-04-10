"use client";

import { useState } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { useLang } from "@/contexts/LanguageContext";
import type { StrategyStep, GhostRunResult, StepSimulation } from "@/lib/ghost-run";

interface SimulateResponse {
  steps: StrategyStep[];
  result: GhostRunResult;
  aiAnalysis: string | null;
}

interface UnsignedSwapTx {
  stepIdx: number;
  token: string;         // e.g. "SOL→USDC"
  swapTransaction: string; // base64-encoded VersionedTransaction from Jupiter
}

interface ExecuteResponse {
  success: boolean;
  signatures: string[];
  unsignedSwapTxs: UnsignedSwapTx[];   // swap steps: user must sign
  requiresUserSignature: boolean;
  memoSig: string | null;
  platformFeeInjected: boolean;
  platformFee: string;
  errors: string[];
}

import type { SolanaWalletProvider } from "@/types/phantom";

function getWalletProvider(): SolanaWalletProvider | null {
  if (typeof window === "undefined") return null;
  if (window.solana?.isPhantom) return window.solana;
  if (window.okxwallet?.solana) return window.okxwallet.solana;
  return null;
}

export default function GhostRun() {
  const { walletAddress } = useWallet();
  const { t } = useLang();

  const EXAMPLE_STRATEGIES = [
    t("ghostExample1"),
    t("ghostExample2"),
    t("ghostExample3"),
  ];
  const [strategy, setStrategy] = useState("");
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [signingSwap, setSigningSwap] = useState(false);
  const [simResult, setSimResult] = useState<SimulateResponse | null>(null);
  const [execResult, setExecResult] = useState<ExecuteResponse | null>(null);
  const [swapSigs, setSwapSigs] = useState<string[]>([]);
  const [auditChain, setAuditChain] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function runSimulation() {
    const text = strategy.trim();
    if (!text) { setError(t("ghostInputError")); return; }
    if (!walletAddress) { setError(t("enterAddressError")); return; }

    setLoading(true);
    setError(null);
    setSimResult(null);
    setExecResult(null);
    setSwapSigs([]);
    setAuditChain(null);

    try {
      const res = await fetch("/api/ghost-run/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strategy: text, wallet: walletAddress }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error((d as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      const data: SimulateResponse = await res.json();
      setSimResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "模擬失敗");
    } finally {
      setLoading(false);
    }
  }

  async function executeStrategy() {
    if (!simResult || !walletAddress) return;
    setExecuting(true);
    setExecResult(null);
    setSwapSigs([]);
    setError(null);

    try {
      // ── Step 1: Execute stake/lend steps via platform wallet ───────────────
      const res = await fetch("/api/ghost-run/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ steps: simResult.steps, wallet: walletAddress }),
      });
      const data: ExecuteResponse = await res.json();
      setExecResult(data);

      // ── Step 2: Sign swap transactions via user's Phantom/OKX wallet ───────
      // Swap txs are non-custodial — only the user's private key can sign them.
      // Jupiter builds the VersionedTransaction; we pass it to the wallet adapter.
      if (data.unsignedSwapTxs && data.unsignedSwapTxs.length > 0) {
        setSigningSwap(true);
        const provider = getWalletProvider();
        if (!provider) {
          setError("請連接 Phantom 或 OKX 錢包以簽署兌換交易");
          return;
        }

        const { VersionedTransaction } = await import("@solana/web3.js");
        const collectedSigs: string[] = [];

        for (const unsignedTx of data.unsignedSwapTxs) {
          // Decode base64 → Uint8Array → VersionedTransaction
          const txBytes = Uint8Array.from(
            atob(unsignedTx.swapTransaction),
            c => c.charCodeAt(0)
          );
          const vTx = VersionedTransaction.deserialize(txBytes);

          // Sign and broadcast — wallet handles gas and submission
          const result = await provider.signAndSendTransaction(vTx);
          const sig = typeof result === "string" ? result : result.signature;
          collectedSigs.push(sig);
        }

        setSwapSigs(collectedSigs);

        // Merge swap sigs into execResult for display
        setExecResult(prev => prev ? {
          ...prev,
          signatures: [...prev.signatures, ...collectedSigs],
          success: prev.errors.length === 0,
        } : prev);

        // ── Step 3: Post swap signatures to audit endpoint ────────────────
        // Platform Memo only records stake/lend TXs. Swap sigs are signed
        // non-custodially and must be posted back to complete the audit chain.
        try {
          const auditRes = await fetch("/api/ghost-run/audit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              swapSigs: collectedSigs,
              wallet: walletAddress,
              executeMemoSig: data.memoSig ?? undefined,
            }),
          });
          if (auditRes.ok) {
            const auditData = await auditRes.json() as { auditChain?: string | null };
            if (auditData.auditChain) setAuditChain(auditData.auditChain);
          }
        } catch { /* audit is non-critical */ }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "執行失敗";
      // Friendly messages for wallet rejections
      if (msg.includes("User rejected") || msg.includes("user_rejected") || msg.includes("rejected")) {
        setError("用戶取消了簽名請求");
      } else {
        setError(msg);
      }
    } finally {
      setExecuting(false);
      setSigningSwap(false);
    }
  }

  const stepTypeLabel: Record<string, string> = {
    swap: "兌換",
    stake: "質押",
    lend: "存款",
  };
  const stepTypeColor: Record<string, string> = {
    swap: "#7C6FFF",
    stake: "#34C759",
    lend: "#FF9F0A",
  };

  // Determine button label based on execution phase
  function getExecButtonLabel() {
    if (signingSwap) return "⏳ 等待錢包簽名兌換…";
    if (executing) return t("ghostExecuting");
    return t("ghostConfirmBtn");
  }

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          background: "rgba(124,111,255,0.1)", border: "1px solid rgba(124,111,255,0.3)",
          borderRadius: 20, padding: "4px 12px", marginBottom: 12,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#7C6FFF", display: "inline-block" }} />
          <span style={{ fontSize: 11, color: "#7C6FFF", fontWeight: 500, letterSpacing: 1.2, fontFamily: "var(--font-mono)" }}>
            GHOST RUN — STRATEGY SIMULATOR
          </span>
        </div>
        <h2 style={{
          fontSize: 20, fontWeight: 300, color: "var(--text-primary)",
          fontFamily: "var(--font-heading)", letterSpacing: "0.06em", marginBottom: 8,
        }}>
          {t("ghostTitle")}
        </h2>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.8, maxWidth: 560 }}>
          {t("ghostDesc")}
        </p>
      </div>

      {/* Strategy input */}
      <div style={{
        background: "var(--bg-card)", border: "1px solid var(--border)",
        borderTop: "2px solid #7C6FFF",
        borderRadius: 10, padding: "20px 22px", marginBottom: 20,
      }}>
        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 8 }}>
          {t("ghostInputLabel")}
        </div>
        <textarea
          value={strategy}
          onChange={e => setStrategy(e.target.value)}
          placeholder={t("ghostPlaceholder")}
          rows={3}
          style={{
            width: "100%", background: "var(--bg-base)", border: "1px solid var(--border)",
            borderRadius: 8, padding: "10px 14px", fontSize: 13,
            color: "var(--text-primary)", fontFamily: "var(--font-body)",
            outline: "none", resize: "vertical", boxSizing: "border-box",
            lineHeight: 1.7,
          }}
        />
        {/* Example strategies */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
          {EXAMPLE_STRATEGIES.map((ex, i) => (
            <button
              key={i}
              onClick={() => setStrategy(ex)}
              style={{
                fontSize: 11, color: "var(--text-muted)",
                background: "var(--bg-base)", border: "1px solid var(--border)",
                borderRadius: 6, padding: "4px 10px", cursor: "pointer",
                letterSpacing: "0.02em",
              }}
            >
              {ex}
            </button>
          ))}
        </div>
        <button
          onClick={runSimulation}
          disabled={loading}
          style={{
            marginTop: 14, background: loading ? "var(--border)" : "#7C6FFF",
            border: "none", borderRadius: 8, padding: "10px 24px",
            fontSize: 13, fontWeight: 500, color: "#fff",
            cursor: loading ? "not-allowed" : "pointer",
            letterSpacing: "0.04em",
          }}
        >
          {loading ? t("ghostSimulating") : t("ghostSimBtn")}
        </button>
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

      {/* Simulation results */}
      {simResult && (
        <div>
          {/* Step-by-step results */}
          <div style={{
            fontSize: 11, color: "var(--text-muted)", letterSpacing: "0.15em",
            textTransform: "uppercase", marginBottom: 12, fontFamily: "var(--font-mono)",
          }}>
            幽靈執行結果
          </div>

          {simResult.result.steps.map((sim: StepSimulation, i: number) => (
            <div key={i} style={{
              background: "var(--bg-card)", border: "1px solid var(--border)",
              borderLeft: `3px solid ${stepTypeColor[sim.step.type] ?? "var(--accent)"}`,
              borderRadius: 10, padding: "16px 20px", marginBottom: 12,
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 600, letterSpacing: "0.08em",
                    color: stepTypeColor[sim.step.type],
                    background: `${stepTypeColor[sim.step.type]}18`,
                    border: `1px solid ${stepTypeColor[sim.step.type]}35`,
                    borderRadius: 4, padding: "2px 8px",
                    fontFamily: "var(--font-mono)",
                  }}>
                    {stepTypeLabel[sim.step.type] ?? sim.step.type}
                  </span>
                  <span style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 500 }}>
                    {sim.step.inputAmount} {sim.step.inputToken} → {sim.step.outputToken}
                  </span>
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                    via {sim.step.protocol}
                  </span>
                  {/* Swap indicator: requires wallet signature */}
                  {sim.step.type === "swap" && (
                    <span style={{
                      fontSize: 10, color: "#7C6FFF",
                      background: "rgba(124,111,255,0.1)", border: "1px solid rgba(124,111,255,0.3)",
                      borderRadius: 4, padding: "2px 6px", fontFamily: "var(--font-mono)",
                    }}>
                      🔑 需要錢包簽名
                    </span>
                  )}
                </div>
                <span style={{
                  fontSize: 11, borderRadius: 4, padding: "3px 8px",
                  background: sim.success ? "rgba(52,199,89,0.12)" : "rgba(255,68,68,0.12)",
                  color: sim.success ? "var(--green)" : "#FF4444",
                  border: `1px solid ${sim.success ? "rgba(52,199,89,0.3)" : "rgba(255,68,68,0.3)"}`,
                  fontWeight: 600,
                }}>
                  {sim.success ? "✓ 可執行" : "✗ 失敗"}
                </span>
              </div>

              {sim.success && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
                  <MetricBox
                    label="預期獲得"
                    value={`${sim.outputAmount.toFixed(4)} ${sim.step.outputToken}`}
                    color="var(--green)"
                  />
                  <MetricBox
                    label="Gas 費用"
                    value={`${(sim.gasSol * 1e6).toFixed(1)} μSOL`}
                    color="var(--text-muted)"
                  />
                  {sim.estimatedApy !== undefined && (
                    <MetricBox
                      label="年化收益率"
                      value={`${sim.estimatedApy.toFixed(1)}%`}
                      color="#FF9F0A"
                    />
                  )}
                  {sim.annualUsdYield !== undefined && (
                    <MetricBox
                      label="預計年收益"
                      value={`+$${sim.annualUsdYield.toFixed(2)}`}
                      color="var(--green)"
                    />
                  )}
                </div>
              )}

              {sim.error && (
                <div style={{ fontSize: 12, color: "#FF4444", marginTop: 8 }}>
                  {sim.error}
                </div>
              )}
            </div>
          ))}

          {/* Summary */}
          <div style={{
            background: "var(--bg-card)", border: "1px solid var(--border)",
            borderRadius: 10, padding: "16px 20px", marginBottom: 16,
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4, letterSpacing: "0.08em", fontFamily: "var(--font-mono)" }}>
                SIMULATION SUMMARY
              </div>
              <div style={{ fontSize: 14, color: "var(--text-primary)", fontWeight: 500 }}>
                {simResult.result.steps.length} 步策略 ·
                總 Gas: {(simResult.result.totalGasSol * 1e6).toFixed(1)} μSOL (~$
                {(simResult.result.totalGasSol * 170 * 1000).toFixed(3)})
              </div>
              {/* Show swap fee note if any swap steps exist */}
              {simResult.steps.some(s => s.type === "swap") && (
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>
                  兌換步驟含 0.3% 平台費（由 Jupiter 自動收取）
                </div>
              )}
              {simResult.result.warnings.map((w, i) => (
                <div key={i} style={{ fontSize: 12, color: "#FF9F0A", marginTop: 4 }}>{w}</div>
              ))}
            </div>
            <div style={{
              fontSize: 15, fontWeight: 700,
              color: simResult.result.canExecute ? "var(--green)" : "#FF4444",
            }}>
              {simResult.result.canExecute ? "✅ 可安全執行" : "⚠️ 請檢查警告"}
            </div>
          </div>

          {/* Confirm execution */}
          {simResult.result.canExecute && !execResult && (
            <button
              onClick={executeStrategy}
              disabled={executing || signingSwap}
              style={{
                width: "100%", padding: "14px",
                background: (executing || signingSwap) ? "var(--border)" : "linear-gradient(135deg, #7C6FFF, #5A4FD1)",
                border: "none", borderRadius: 10,
                fontSize: 14, fontWeight: 600, color: "#fff",
                cursor: (executing || signingSwap) ? "not-allowed" : "pointer",
                letterSpacing: "0.05em",
              }}
            >
              {getExecButtonLabel()}
            </button>
          )}

          {/* Execution result */}
          {execResult && (
            <div style={{
              background: execResult.success ? "rgba(52,199,89,0.08)" : "rgba(255,68,68,0.08)",
              border: `1px solid ${execResult.success ? "rgba(52,199,89,0.3)" : "rgba(255,68,68,0.3)"}`,
              borderRadius: 10, padding: "18px 20px",
            }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: execResult.success ? "var(--green)" : "#FF4444", marginBottom: 10 }}>
                {execResult.success ? t("ghostSuccessMsg") : t("ghostPartialMsg")}
              </div>

              {/* Platform-signed txs (stake/lend) */}
              {execResult.signatures.filter(s => !swapSigs.includes(s)).map((sig, i) => (
                <div key={i} style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: 4 }}>
                  Platform TX {i + 1}: {sig.slice(0, 20)}…
                </div>
              ))}

              {/* User-signed swap txs */}
              {swapSigs.map((sig, i) => (
                <div key={i} style={{ fontSize: 12, color: "#7C6FFF", fontFamily: "var(--font-mono)", marginBottom: 4 }}>
                  Swap TX {i + 1} (你簽名): {sig.slice(0, 20)}…
                </div>
              ))}

              {execResult.memoSig && (
                <div style={{ fontSize: 12, color: "var(--accent)", marginTop: 8, fontFamily: "var(--font-mono)" }}>
                  ✦ 鏈上執行憑證: {execResult.memoSig.slice(0, 20)}…
                </div>
              )}
              {auditChain && (
                <div style={{ fontSize: 12, color: "var(--accent)", marginTop: 4, fontFamily: "var(--font-mono)" }}>
                  ✦ 完整審計鏈: {auditChain}
                </div>
              )}
              {execResult.platformFee && (
                <div style={{
                  fontSize: 11, marginTop: 6,
                  color: execResult.platformFeeInjected === false && execResult.requiresUserSignature
                    ? "#FF9F0A"
                    : "var(--text-muted)",
                }}>
                  {execResult.platformFee}
                </div>
              )}
              {execResult.errors.map((e, i) => (
                <div key={i} style={{ fontSize: 12, color: "#FF4444", marginTop: 4 }}>{e}</div>
              ))}
            </div>
          )}
          {/* AI Strategy Analysis */}
          {simResult.aiAnalysis && (
            <div style={{
              background: "var(--bg-card)", border: "1px solid var(--border)",
              borderTop: "2px solid #7C6FFF",
              borderRadius: 10, padding: "18px 20px", marginBottom: 16,
            }}>
              <div style={{ fontSize: 10, color: "#7C6FFF", letterSpacing: "0.12em", fontFamily: "var(--font-mono)", fontWeight: 600, marginBottom: 12 }}>
                ✦ AI STRATEGY ANALYSIS
              </div>
              <div style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 2.0, whiteSpace: "pre-wrap" }}>
                {simResult.aiAnalysis}
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
          {t("ghostHowTitle")}
        </div>
        <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.85 }}>
          {t("ghostHowDesc")}
        </div>
      </div>
    </div>
  );
}

function MetricBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      background: "var(--bg-base)", borderRadius: 8, padding: "10px 12px",
    }}>
      <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 4, letterSpacing: "0.08em", fontFamily: "var(--font-mono)" }}>
        {label}
      </div>
      <div style={{ fontSize: 14, fontWeight: 600, color }}>
        {value}
      </div>
    </div>
  );
}
