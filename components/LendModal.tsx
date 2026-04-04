"use client";

import { useState, useEffect } from "react";
import { useLang } from "@/contexts/LanguageContext";

interface LendModalProps {
  protocol: "kamino" | "solend";
  amount: number; // USDC
  onClose: () => void;
}

type LendStep = "quote" | "confirm" | "signing" | "success" | "error";

interface LendPreview {
  protocol: string;
  inputAmount: number;
  inputToken: string;
  outputToken: string;
  supplyApy: string;
  earnPerYear: string;
  earnPerMonth: string;
  utilizationRate: string;
  note: string;
}

const PROTOCOL_META = {
  kamino: { icon: "🌿", color: "#10B981", name: "Kamino Finance" },
  solend: { icon: "🏦", color: "#3B82F6", name: "Save (Solend)" },
};

export default function LendModal({ protocol, amount, onClose }: LendModalProps) {
  const { t } = useLang();
  const [step, setStep]         = useState<LendStep>("quote");
  const [preview, setPreview]   = useState<LendPreview | null>(null);
  const [txSig, setTxSig]       = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const meta = PROTOCOL_META[protocol];
  const metaDesc = protocol === "kamino" ? t("kaminoDesc") : t("solendDesc");

  useEffect(() => { fetchPreview(); }, []);

  async function fetchPreview() {
    setStep("quote");
    setErrorMsg("");
    try {
      const res = await fetch(`/api/lend?protocol=${protocol}&amount=${amount}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setPreview(data);
      setStep("confirm");
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : t("depositFailed"));
      setStep("error");
    }
  }

  async function executeLend() {
    if (!preview) return;
    if (!window.solana?.isPhantom) {
      setErrorMsg(t("noPhantom"));
      setStep("error");
      return;
    }

    setStep("signing");

    try {
      const { publicKey } = await window.solana.connect({ onlyIfTrusted: true });
      const userPublicKey = publicKey.toString();

      const buildRes = await fetch("/api/lend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ protocol, amountUSDC: amount, userPublicKey }),
      });
      const buildData = await buildRes.json();
      if (buildData.error) throw new Error(buildData.error);

      const { VersionedTransaction, Transaction } = await import("@solana/web3.js");

      // Try VersionedTransaction first, fall back to legacy Transaction
      let signature: string;
      try {
        const txBuf = Buffer.from(buildData.lendTransaction, "base64");
        const transaction = VersionedTransaction.deserialize(txBuf);
        const result = await window.solana.signAndSendTransaction(transaction);
        signature = result.signature;
      } catch {
        // Legacy transaction fallback
        const txBuf = Buffer.from(buildData.lendTransaction, "base64");
        const transaction = Transaction.from(txBuf);
        const result = await window.solana.signAndSendTransaction(transaction);
        signature = result.signature;
      }

      setTxSig(signature);
      setStep("success");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t("depositFailed");
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
            {meta.icon} {meta.name}
          </div>
          <button onClick={onClose} style={{
            background: "none", border: "none", color: "#475569",
            fontSize: 18, cursor: "pointer",
          }}>✕</button>
        </div>

        {/* Loading */}
        {step === "quote" && (
          <div style={{ textAlign: "center", padding: "40px 0" }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>⏳</div>
            <div style={{ fontSize: 14, color: "#64748B" }}>{t("gettingRates")}</div>
          </div>
        )}

        {/* Confirm */}
        {step === "confirm" && preview && (
          <>
            <div style={{
              background: "#0A0A0F", borderRadius: 14, padding: 20, marginBottom: 16,
            }}>
              {/* Deposit summary */}
              <div style={{
                display: "flex", alignItems: "center",
                justifyContent: "space-between", marginBottom: 16,
              }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: "#475569", marginBottom: 4 }}>{t("deposit")}</div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: "#E2E8F0" }}>${preview.inputAmount.toFixed(0)}</div>
                  <div style={{ fontSize: 13, color: "#10B981", fontWeight: 700 }}>USDC</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <div style={{ fontSize: 14, color: "#475569" }}>→</div>
                  <div style={{
                    fontSize: 11, background: "#10B98120", color: "#10B981",
                    borderRadius: 6, padding: "2px 8px", fontWeight: 700,
                  }}>APY {preview.supplyApy}%</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: "#475569", marginBottom: 4 }}>{t("estimatedMonthly")}</div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: "#10B981" }}>+${preview.earnPerMonth}</div>
                  <div style={{ fontSize: 13, color: "#10B981", fontWeight: 700 }}>{t("interestYield")}</div>
                </div>
              </div>

              <div style={{ borderTop: "1px solid #1E1E2E", paddingTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                <FeeRow label={t("depositApy")} value={`${preview.supplyApy}%`} color="#10B981" />
                <FeeRow label={t("estimatedAnnualYield")} value={`$${preview.earnPerYear}`} color="#10B981" />
                <FeeRow label={t("utilizationRate")} value={`${preview.utilizationRate}%`} color="#64748B" />
                <FeeRow label={t("receiptToken")} value={preview.outputToken} color="#64748B" />
                <FeeRow label={t("protocol")} value={meta.name} color="#64748B" />
              </div>
            </div>

            <div style={{
              background: `${meta.color}10`, border: `1px solid ${meta.color}30`,
              borderRadius: 10, padding: "10px 14px", marginBottom: 16,
              fontSize: 11, color: meta.color, lineHeight: 1.6,
            }}>
              💡 {preview.note}。{metaDesc}。
            </div>

            <button
              onClick={executeLend}
              style={{
                width: "100%", padding: "14px",
                background: `linear-gradient(135deg, ${meta.color}, #06B6D4)`,
                border: "none", borderRadius: 12,
                fontSize: 15, fontWeight: 800, color: "#fff", cursor: "pointer",
              }}
            >
              {t("confirmDeposit")}
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
              ${amount} USDC → {meta.name}
            </div>
          </div>
        )}

        {/* Success */}
        {step === "success" && txSig && (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#10B981", marginBottom: 8 }}>
              {t("depositSuccess")}
            </div>
            <div style={{ fontSize: 13, color: "#64748B", marginBottom: 8 }}>
              ${preview?.inputAmount.toFixed(0)} USDC → {meta.name}
            </div>
            <div style={{ fontSize: 12, color: "#10B981", marginBottom: 20, fontWeight: 600 }}>
              {t("estimatedAnnualYield")} +${preview?.earnPerYear}
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
              background: `linear-gradient(135deg, ${meta.color}, #06B6D4)`,
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
              {t("depositFailed")}
            </div>
            <div style={{ fontSize: 12, color: "#64748B", marginBottom: 20, lineHeight: 1.6 }}>
              {errorMsg}
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button onClick={fetchPreview} style={{
                flex: 1, padding: "12px",
                background: `linear-gradient(135deg, ${meta.color}, #06B6D4)`,
                border: "none", borderRadius: 10,
                fontSize: 13, fontWeight: 700, color: "#fff", cursor: "pointer",
              }}>{t("retry")}</button>
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

function FeeRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <span style={{ fontSize: 11, color: "#64748B" }}>{label}</span>
      <span style={{ fontSize: 11, color, fontWeight: 600 }}>{value}</span>
    </div>
  );
}
