"use client";

import { useState, useEffect } from "react";
import { useLang } from "@/contexts/LanguageContext";

interface SwapModalProps {
  from: string;
  to: string;
  amount: number;
  onClose: () => void;
}

type SwapStep = "quote" | "confirm" | "signing" | "success" | "error";

interface QuoteData {
  from: string;
  to: string;
  inputAmount: number;
  outputAmount: number;
  outputAmountFormatted: string;
  priceImpact: string;
  platformFeePct: string;
  platformFeeUSD: string;
  quoteResponse: unknown;
}

export default function SwapModal({ from, to, amount, onClose }: SwapModalProps) {
  const { t } = useLang();
  const [step, setStep] = useState<SwapStep>("quote");
  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [txSig, setTxSig] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  // Fetch quote on mount
  useEffect(() => {
    fetchQuote();
  }, []);

  async function fetchQuote() {
    setStep("quote");
    setErrorMsg("");
    try {
      const res = await fetch(`/api/swap?from=${from}&to=${to}&amount=${amount}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setQuote(data);
      setStep("confirm");
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : t("gettingQuote"));
      setStep("error");
    }
  }

  async function executeSwap() {
    if (!quote || !window.solana?.isPhantom) {
      setErrorMsg(t("noPhantom"));
      setStep("error");
      return;
    }

    setStep("signing");

    try {
      // Connect wallet if needed
      const { publicKey } = await window.solana.connect({ onlyIfTrusted: true });
      const userPublicKey = publicKey.toString();

      // Build swap transaction
      const buildRes = await fetch("/api/swap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quoteResponse: quote.quoteResponse,
          userPublicKey,
        }),
      });
      const buildData = await buildRes.json();
      if (buildData.error) throw new Error(buildData.error);

      // Deserialize and sign with Phantom
      const { VersionedTransaction } = await import("@solana/web3.js");
      const swapTxBuf = Buffer.from(buildData.swapTransaction, "base64");
      const transaction = VersionedTransaction.deserialize(swapTxBuf);

      const { signature } = await window.solana.signAndSendTransaction(transaction);

      setTxSig(signature);
      setStep("success");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t("swapFailed");
      if (msg.toLowerCase().includes("user rejected") || msg.toLowerCase().includes("cancel")) {
        setErrorMsg(t("userCancelled"));
      } else {
        setErrorMsg(msg);
      }
      setStep("error");
    }
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 2000,
        background: "rgba(0,0,0,0.85)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 24,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: "#13131A", border: "1px solid #1E1E2E",
          borderRadius: 20, padding: 28, width: "100%", maxWidth: 420,
          boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#fff" }}>
            🪐 Jupiter Swap
          </div>
          <button onClick={onClose} style={{
            background: "none", border: "none", color: "#475569",
            fontSize: 18, cursor: "pointer",
          }}>✕</button>
        </div>

        {/* Loading quote */}
        {step === "quote" && (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
            <div style={{ fontSize: 14, color: "#64748B" }}>{t("gettingQuote")}</div>
          </div>
        )}

        {/* Confirm step */}
        {step === "confirm" && quote && (
          <>
            {/* Swap summary */}
            <div style={{
              background: "#0A0A0F", borderRadius: 14, padding: 20, marginBottom: 16,
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: "#475569", marginBottom: 4 }}>{t("pay")}</div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: "#E2E8F0" }}>{quote.inputAmount}</div>
                  <div style={{ fontSize: 13, color: "#8B5CF6", fontWeight: 700 }}>{quote.from}</div>
                </div>
                <div style={{ fontSize: 24, color: "#475569" }}>→</div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: "#475569", marginBottom: 4 }}>{t("receive")}</div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: "#10B981" }}>{quote.outputAmountFormatted}</div>
                  <div style={{ fontSize: 13, color: "#10B981", fontWeight: 700 }}>{quote.to}</div>
                </div>
              </div>

              {/* Details */}
              <div style={{ borderTop: "1px solid #1E1E2E", paddingTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                <FeeRow label={t("priceImpact")} value={`${quote.priceImpact}%`}
                  color={parseFloat(quote.priceImpact) > 1 ? "#F59E0B" : "#64748B"} />
                <FeeRow label={t("slippageProtection")} value="0.5%" color="#64748B" />
                <FeeRow label={t("platformFee")} value={`${quote.platformFeePct} ≈ $${quote.platformFeeUSD}`}
                  color="#8B5CF620"
                  labelColor="#8B5CF6" />
                <FeeRow label={t("route")} value="Jupiter v6" color="#64748B" />
              </div>
            </div>

            {/* Platform fee note */}
            <div style={{
              background: "#8B5CF610", border: "1px solid #8B5CF630",
              borderRadius: 10, padding: "10px 14px", marginBottom: 16,
              fontSize: 11, color: "#8B5CF6", lineHeight: 1.6,
            }}>
              💡 {t("swapFeeNotice", { pct: quote.platformFeePct })}
            </div>

            <button
              onClick={executeSwap}
              style={{
                width: "100%", padding: "14px",
                background: "linear-gradient(135deg, #8B5CF6, #06B6D4)",
                border: "none", borderRadius: 12,
                fontSize: 15, fontWeight: 800, color: "#fff", cursor: "pointer",
              }}
            >
              {t("confirmSwap")}
            </button>
            <button onClick={onClose} style={{
              width: "100%", marginTop: 10, padding: "12px",
              background: "none", border: "1px solid #1E1E2E",
              borderRadius: 12, fontSize: 13, color: "#475569", cursor: "pointer",
            }}>{t("cancel")}</button>
          </>
        )}

        {/* Signing */}
        {step === "signing" && (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>👻</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#E2E8F0", marginBottom: 8 }}>
              {t("confirmInPhantom")}
            </div>
            <div style={{ fontSize: 12, color: "#64748B" }}>
              {t("checkAndConfirm")}
            </div>
          </div>
        )}

        {/* Success */}
        {step === "success" && txSig && (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#10B981", marginBottom: 8 }}>
              {t("swapSuccess")}
            </div>
            <div style={{ fontSize: 13, color: "#64748B", marginBottom: 20 }}>
              {quote?.inputAmount} {quote?.from} → {quote?.outputAmountFormatted} {quote?.to}
            </div>
            <div style={{
              background: "#10B98115", border: "1px solid #10B98130",
              borderRadius: 10, padding: "10px 14px", marginBottom: 20,
              fontSize: 10, fontFamily: "monospace", color: "#10B981",
              wordBreak: "break-all",
            }}>
              {txSig}
            </div>
            <a
              href={`https://solscan.io/tx/${txSig}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "block", padding: "12px",
                background: "#13131A", border: "1px solid #1E3A5F",
                borderRadius: 10, fontSize: 13, color: "#60A5FA",
                textDecoration: "none", marginBottom: 10,
              }}
            >
              {t("viewOnSolscanLink")}
            </a>
            <button onClick={onClose} style={{
              width: "100%", padding: "12px",
              background: "linear-gradient(135deg, #8B5CF6, #06B6D4)",
              border: "none", borderRadius: 10,
              fontSize: 13, fontWeight: 700, color: "#fff", cursor: "pointer",
            }}>{t("done")}</button>
          </div>
        )}

        {/* Error */}
        {step === "error" && (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>❌</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#EF4444", marginBottom: 8 }}>
              {t("swapFailed")}
            </div>
            <div style={{ fontSize: 12, color: "#64748B", marginBottom: 20, lineHeight: 1.6 }}>
              {errorMsg}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={fetchQuote} style={{
                flex: 1, padding: "12px",
                background: "linear-gradient(135deg, #8B5CF6, #06B6D4)",
                border: "none", borderRadius: 10,
                fontSize: 13, fontWeight: 700, color: "#fff", cursor: "pointer",
              }}>{t("requote")}</button>
              <button onClick={onClose} style={{
                flex: 1, padding: "12px",
                background: "none", border: "1px solid #1E1E2E",
                borderRadius: 10, fontSize: 13, color: "#475569", cursor: "pointer",
              }}>{t("cancel")}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FeeRow({
  label, value, color, labelColor,
}: {
  label: string; value: string; color: string; labelColor?: string;
}) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontSize: 11, color: labelColor ?? "#64748B" }}>{label}</span>
      <span style={{ fontSize: 11, color, fontWeight: 600 }}>{value}</span>
    </div>
  );
}
