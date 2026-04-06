"use client";
import { useState, useEffect } from "react";
import { useLang } from "@/contexts/LanguageContext";

interface CopyTradeModalProps {
  mint: string;
  symbol: string;
  onClose: () => void;
  walletAddress: string | null;
}

interface SecurityResult {
  securityScore: number;
  risks: string[];
  decision: { verdict: "buy" | "caution" | "avoid"; label: string; reason: string; suggestion: string };
  price: number | null;
  name: string;
}

type Step = "scanning" | "blocked" | "quoting" | "confirming" | "signing" | "done" | "error";

interface QuoteResult {
  outputAmount: number;
  outputAmountFormatted: string;
  priceImpact: string;
  platformFeePct: string;
  slippageBps: number;
  inputMint: string;
  outputMint: string;
  quoteResponse: unknown;
}

const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const AMOUNTS = [5, 10, 25, 50, 100]; // USDC preset amounts

export default function CopyTradeModal({ mint, symbol, onClose, walletAddress }: CopyTradeModalProps) {
  const [step, setStep] = useState<Step>("scanning");
  const { t } = useLang();
  const [security, setSecurity] = useState<SecurityResult | null>(null);
  const [amount, setAmount] = useState(10); // default $10 USDC
  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [txSig, setTxSig] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Step 1: Security scan on mount
  useEffect(() => {
    fetch(`/api/token?mint=${mint}`)
      .then(r => r.json())
      .then((d: SecurityResult) => {
        setSecurity(d);
        if (d.securityScore < 70) {
          setStep("blocked");
        } else {
          setStep("quoting");
        }
      })
      .catch(() => { setStep("error"); setError(t("securityScanFailed")); });
  }, [mint]);

  // Step 2: Fetch quote when amount changes (in quoting/confirming step)
  useEffect(() => {
    if (step !== "quoting" && step !== "confirming") return;
    setQuote(null);
    fetch(`/api/swap?fromMint=${USDC_MINT}&toMint=${mint}&from=USDC&amount=${amount}`)
      .then(r => r.json())
      .then((d: QuoteResult & { error?: string }) => {
        if (d.error) { setError(d.error); return; }
        setQuote(d);
        setStep("confirming");
      })
      .catch(() => { setError(t("quoteFetchFailed")); });
  }, [amount, mint, step === "quoting"]);

  async function executeSwap() {
    if (!walletAddress || !quote) return;
    setStep("signing");
    try {
      // Build transaction server-side
      const buildRes = await fetch("/api/swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inputMint: USDC_MINT,
          outputMint: mint,
          from: "USDC",
          to: symbol,
          amount,
          slippageBps: quote.slippageBps,
          userPublicKey: walletAddress,
        }),
      });
      const buildData = await buildRes.json() as { swapTransaction?: string; error?: string };
      if (!buildData.swapTransaction) throw new Error(buildData.error ?? "Transaction build failed");

      // Sign with Phantom
      const { solanaPhantom } = window as unknown as { solanaPhantom?: { signAndSendTransaction: (tx: unknown) => Promise<{ signature: string }> }; solana?: { signAndSendTransaction: (tx: unknown) => Promise<{ signature: string }> } };
      const phantom = solanaPhantom ?? (window as unknown as { solana?: { signAndSendTransaction: (tx: unknown) => Promise<{ signature: string }> } }).solana;
      if (!phantom) throw new Error(t("noPhantom"));

      const { VersionedTransaction } = await import("@solana/web3.js");
      const txBytes = Buffer.from(buildData.swapTransaction, "base64");
      const tx = VersionedTransaction.deserialize(txBytes);
      const result = await phantom.signAndSendTransaction(tx);
      setTxSig(result.signature);
      setStep("done");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("txFailed"));
      setStep("error");
    }
  }

  // Color helpers
  const scoreColor = (s: number) => s >= 80 ? "#22C55E" : s >= 60 ? "#F59E0B" : "#EF4444";
  const ACCENT = "#C0392B";

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 9999,
      background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 16,
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: "var(--bg-card, #1a1a2e)", border: "1px solid var(--border, #333)",
        borderRadius: 20, padding: 28, width: "100%", maxWidth: 420,
        fontFamily: "var(--font-body, 'Noto Sans JP', sans-serif)",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>
              {t("safeCopyTrade")}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
              {symbol} · {mint.slice(0,6)}…{mint.slice(-4)}
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "var(--text-muted)" }}>×</button>
        </div>

        {/* ── Scanning ── */}
        {step === "scanning" && (
          <div style={{ textAlign: "center", padding: "32px 0" }}>
            <div style={{ fontSize: 32, marginBottom: 12, animation: "spin 1s linear infinite" }}>🔰</div>
            <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>{t("securityScanning")}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>{t("goPlusOnchain")}</div>
          </div>
        )}

        {/* ── Blocked ── */}
        {step === "blocked" && security && (
          <div>
            <div style={{
              background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)",
              borderRadius: 12, padding: 16, marginBottom: 16,
            }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#EF4444", marginBottom: 8 }}>
                {t("copyTradeBlocked", { n: security.securityScore })}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.7 }}>
                {security.risks.slice(0, 3).map((r, i) => <div key={i}>• {r}</div>)}
              </div>
            </div>
            <div style={{
              background: "rgba(192,57,43,0.08)", borderRadius: 10, padding: 12,
              fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6,
            }}>
              <strong style={{ color: ACCENT }}>{t("safetyShieldTitle")}</strong> — {t("safetyShieldDesc")}
            </div>
            <button onClick={onClose} style={{
              width: "100%", marginTop: 16, padding: "12px 0", borderRadius: 10,
              background: "var(--bg-base)", border: "1px solid var(--border)",
              color: "var(--text-secondary)", fontSize: 14, fontWeight: 600, cursor: "pointer",
            }}>{t("close")}</button>
          </div>
        )}

        {/* ── Quoting (loading) ── */}
        {(step === "quoting") && (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>⏳</div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{t("fetchingQuote")}</div>
          </div>
        )}

        {/* ── Confirming ── */}
        {step === "confirming" && security && quote && (
          <div>
            {/* Security badge */}
            <div style={{
              display: "flex", alignItems: "center", gap: 10, marginBottom: 20,
              background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.25)",
              borderRadius: 10, padding: "10px 14px",
            }}>
              <span style={{ fontSize: 20 }}>✅</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "#22C55E" }}>{t("securityVerified")}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  GoPlus 評分 <strong style={{ color: scoreColor(security.securityScore) }}>{security.securityScore}</strong>/100 · {security.decision.label}
                </div>
              </div>
            </div>

            {/* Amount selector */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 8 }}>{t("buyAmountUSDC")}</div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {AMOUNTS.map(a => (
                  <button key={a} onClick={() => { setAmount(a); setStep("quoting"); }}
                    style={{
                      padding: "6px 14px", borderRadius: 8, fontSize: 13, fontWeight: 600,
                      cursor: "pointer", border: `1px solid ${amount === a ? ACCENT : "var(--border)"}`,
                      background: amount === a ? `${ACCENT}18` : "var(--bg-base)",
                      color: amount === a ? ACCENT : "var(--text-secondary)",
                    }}>
                    ${a}
                  </button>
                ))}
              </div>
            </div>

            {/* Quote details */}
            <div style={{
              background: "var(--bg-base)", borderRadius: 12, padding: 16, marginBottom: 16,
              border: "1px solid var(--border)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{t("pay")}</span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>${amount} USDC</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{t("receiveEstimated")}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#22C55E" }}>
                  {quote.outputAmountFormatted} {symbol}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{t("priceImpact")}</span>
                <span style={{ fontSize: 12, color: parseFloat(quote.priceImpact) > 1 ? "#F59E0B" : "var(--text-secondary)" }}>
                  {quote.priceImpact}%
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{t("platformFee")}</span>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{quote.platformFeePct}</span>
              </div>
            </div>

            {!walletAddress && (
              <div style={{ fontSize: 12, color: "#F59E0B", textAlign: "center", marginBottom: 12 }}>
                {t("connectWalletForCopy")}
              </div>
            )}

            <button
              disabled={!walletAddress}
              onClick={executeSwap}
              style={{
                width: "100%", padding: "14px 0", borderRadius: 12,
                background: walletAddress ? ACCENT : "var(--bg-base)",
                border: "none", color: walletAddress ? "#fff" : "var(--text-muted)",
                fontSize: 15, fontWeight: 700, cursor: walletAddress ? "pointer" : "not-allowed",
              }}
            >
              {t("confirmCopyTrade")}
            </button>
          </div>
        )}

        {/* ── Signing ── */}
        {step === "signing" && (
          <div style={{ textAlign: "center", padding: "32px 0" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>👻</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{t("confirmInPhantom")}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>{t("waitingForSignature")}</div>
          </div>
        )}

        {/* ── Done ── */}
        {step === "done" && txSig && (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🌸</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#22C55E", marginBottom: 8 }}>{t("copyTradeSuccess")}</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>
              {t("copyTradeBought", { symbol })}
            </div>
            <a href={`https://solscan.io/tx/${txSig}`} target="_blank" rel="noopener noreferrer"
              style={{
                display: "inline-block", padding: "8px 20px", borderRadius: 8,
                background: ACCENT, color: "#fff", fontSize: 12, fontWeight: 700,
                textDecoration: "none", marginBottom: 12,
              }}>
              {t("viewOnSolscanTx")}
            </a>
            <br />
            <button onClick={onClose} style={{
              background: "none", border: "none", color: "var(--text-muted)",
              fontSize: 12, cursor: "pointer", marginTop: 8,
            }}>{t("close")}</button>
          </div>
        )}

        {/* ── Error ── */}
        {step === "error" && (
          <div style={{ textAlign: "center", padding: "24px 0" }}>
            <div style={{ fontSize: 36, marginBottom: 12 }}>⚠️</div>
            <div style={{ fontSize: 14, color: "#EF4444", marginBottom: 16 }}>{error ?? t("genericError")}</div>
            <button onClick={onClose} style={{
              padding: "10px 24px", borderRadius: 10, background: "var(--bg-base)",
              border: "1px solid var(--border)", color: "var(--text-secondary)",
              fontSize: 13, fontWeight: 600, cursor: "pointer",
            }}>{t("close")}</button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
