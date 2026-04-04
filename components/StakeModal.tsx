"use client";

import { useState, useEffect } from "react";
import { useLang } from "@/contexts/LanguageContext";

interface StakeModalProps {
  protocol: "marinade" | "jito";
  amount: number; // SOL
  onClose: () => void;
}

type StakeStep = "quote" | "confirm" | "signing" | "success" | "error";

interface StakePreview {
  protocol: string;
  inputAmount: number;
  inputToken: string;
  outputAmount: number;
  outputToken: string;
  apy: string;
  earnPerYear: string;
  exchangeRate: string;
  note: string;
}

const PROTOCOL_META = {
  marinade: { icon: "🫙", color: "#8B5CF6", name: "Marinade Finance" },
  jito:     { icon: "⚡", color: "#06B6D4", name: "Jito" },
};

export default function StakeModal({ protocol, amount, onClose }: StakeModalProps) {
  const { t } = useLang();
  const [step, setStep]       = useState<StakeStep>("quote");
  const [preview, setPreview] = useState<StakePreview | null>(null);
  const [txSig, setTxSig]     = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");

  const meta = PROTOCOL_META[protocol];
  const metaDesc = protocol === "marinade" ? t("marinadeDesc") : t("jitoDesc");

  useEffect(() => { fetchPreview(); }, []);

  async function fetchPreview() {
    setStep("quote");
    setErrorMsg("");
    try {
      const res = await fetch(`/api/stake?protocol=${protocol}&amount=${amount}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setPreview(data);
      setStep("confirm");
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : t("stakeFailed"));
      setStep("error");
    }
  }

  async function executeStake() {
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

      // Build stake transaction
      const buildRes = await fetch("/api/stake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ protocol, amountSOL: amount, userPublicKey }),
      });
      const buildData = await buildRes.json();
      if (buildData.error) throw new Error(buildData.error);

      // Deserialize VersionedTransaction and sign
      const { VersionedTransaction } = await import("@solana/web3.js");
      const txBuf = Buffer.from(buildData.stakeTransaction, "base64");
      const transaction = VersionedTransaction.deserialize(txBuf);

      const { signature } = await window.solana.signAndSendTransaction(transaction);
      setTxSig(signature);
      setStep("success");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : t("stakeFailed");
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
            <div style={{ fontSize: 14, color: "#64748B" }}>{t("gettingStakePreview")}</div>
          </div>
        )}

        {/* Confirm */}
        {step === "confirm" && preview && (
          <>
            <div style={{
              background: "#0A0A0F", borderRadius: 14, padding: 20, marginBottom: 16,
            }}>
              {/* Amount flow */}
              <div style={{
                display: "flex", alignItems: "center",
                justifyContent: "space-between", marginBottom: 16,
              }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: "#475569", marginBottom: 4 }}>{t("stake")}</div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: "#E2E8F0" }}>{preview.inputAmount}</div>
                  <div style={{ fontSize: 13, color: "#8B5CF6", fontWeight: 700 }}>SOL</div>
                </div>
                <div style={{ fontSize: 24, color: "#475569" }}>→</div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 11, color: "#475569", marginBottom: 4 }}>{t("receive")}</div>
                  <div style={{ fontSize: 24, fontWeight: 900, color: "#10B981" }}>
                    {preview.outputAmount.toFixed(4)}
                  </div>
                  <div style={{ fontSize: 13, color: "#10B981", fontWeight: 700 }}>{preview.outputToken}</div>
                </div>
              </div>

              {/* Details */}
              <div style={{ borderTop: "1px solid #1E1E2E", paddingTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
                <FeeRow label={t("annualYieldApy")} value={`${preview.apy}%`} color="#10B981" />
                <FeeRow label={t("estimatedAnnualYield")} value={`+${preview.earnPerYear} SOL`} color="#10B981" />
                <FeeRow label={t("exchangeRate")} value={`1 SOL = ${preview.exchangeRate} ${preview.outputToken}`} color="#64748B" />
                <FeeRow label={t("protocol")} value={meta.name} color="#64748B" />
              </div>
            </div>

            {/* Info note */}
            <div style={{
              background: `${meta.color}10`, border: `1px solid ${meta.color}30`,
              borderRadius: 10, padding: "10px 14px", marginBottom: 16,
              fontSize: 11, color: meta.color, lineHeight: 1.6,
            }}>
              💡 {preview.note}。{metaDesc}。
            </div>

            <button
              onClick={executeStake}
              style={{
                width: "100%", padding: "14px",
                background: `linear-gradient(135deg, ${meta.color}, #06B6D4)`,
                border: "none", borderRadius: 12,
                fontSize: 15, fontWeight: 800, color: "#fff", cursor: "pointer",
              }}
            >
              {t("confirmStake")}
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
              {amount} SOL → {preview?.outputToken}
            </div>
          </div>
        )}

        {/* Success */}
        {step === "success" && txSig && (
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: "#10B981", marginBottom: 8 }}>
              {t("stakeSuccess")}
            </div>
            <div style={{ fontSize: 13, color: "#64748B", marginBottom: 8 }}>
              {amount} SOL → {preview?.outputAmount.toFixed(4)} {preview?.outputToken}
            </div>
            <div style={{ fontSize: 12, color: "#475569", marginBottom: 20 }}>
              {t("estimatedAnnualYield")} +{preview?.earnPerYear} SOL
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
              {t("stakeFailed")}
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
