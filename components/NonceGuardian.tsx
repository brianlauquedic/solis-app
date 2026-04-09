"use client";

import { useState } from "react";
import { useWallet } from "@/contexts/WalletContext";
import { payWithWallet } from "@/lib/x402";
import type { NonceGuardianResult, RiskSignal } from "@/lib/nonce-scanner";

interface ProofData {
  sha256: string;
  txSig: string | null;
  explorerUrl: string | null;
  message: string;
}

interface ScanResult extends NonceGuardianResult {
  aiAnalysis?: string | null;
  proof?: ProofData | null;
}

type PaymentState = "idle" | "waiting" | "paying" | "verifying" | "done" | "error";

export default function NonceGuardian() {
  const { walletAddress } = useWallet();
  const [inputAddr, setInputAddr] = useState(walletAddress ?? "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // x402 payment state
  const [payState, setPayState] = useState<PaymentState>("idle");
  const [payChallenge, setPayChallenge] = useState<{ recipient: string; amount: number } | null>(null);
  const [payError, setPayError] = useState<string | null>(null);

  async function scan() {
    const addr = inputAddr.trim();
    if (!addr || addr.length < 32) {
      setError("請輸入有效的 Solana 錢包地址");
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    setPayState("idle");
    setPayChallenge(null);
    setPayError(null);

    try {
      const res = await fetch("/api/nonce-guardian", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: addr }),
      });

      // x402: payment required for AI analysis
      if (res.status === 402) {
        const body = await res.json();
        // Show basic scan results while prompting payment
        if (body.scanResult) setResult(body.scanResult);
        setPayChallenge({ recipient: body.recipient, amount: body.amount });
        setPayState("waiting");
        return;
      }

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: ScanResult = await res.json();
      setResult(data);
      setPayState("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "掃描失敗");
    } finally {
      setLoading(false);
    }
  }

  async function payAndGetReport() {
    if (!payChallenge) return;
    setPayState("paying");
    setPayError(null);

    const payResult = await payWithWallet({
      recipient: payChallenge.recipient,
      amount: payChallenge.amount,
      currency: "USDC",
      network: "solana-mainnet",
      description: "Sakura Nonce Guardian — AI Security Report + SHA-256 鏈上存證",
    });

    if ("error" in payResult) {
      if (payResult.error === "user_rejected") {
        setPayState("waiting");
      } else {
        setPayState("error");
        setPayError(payResult.error);
      }
      return;
    }

    // Payment done — retry with X-PAYMENT header
    setPayState("verifying");
    try {
      const res = await fetch("/api/nonce-guardian", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-PAYMENT": payResult.sig,
        },
        body: JSON.stringify({ wallet: inputAddr.trim() }),
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: ScanResult = await res.json();
      setResult(data);
      setPayState("done");
      setPayChallenge(null);
    } catch (err) {
      setPayState("error");
      setPayError(err instanceof Error ? err.message : "報告獲取失敗");
    }
  }

  const severityColor: Record<string, string> = {
    critical: "#FF4444",
    high: "#FF8C00",
    medium: "#FFD700",
    low: "var(--green)",
  };

  const severityLabel: Record<string, string> = {
    critical: "🚨 極高風險",
    high: "⚠️ 高風險",
    medium: "⚡ 中風險",
    low: "✓ 低風險",
  };

  const maxSeverity = result?.riskSignals.reduce<string | null>((acc, s) => {
    const order = ["critical", "high", "medium", "low"];
    if (acc === null) return s.severity;
    return order.indexOf(s.severity) < order.indexOf(acc) ? s.severity : acc;
  }, null);

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          background: "rgba(255,68,68,0.1)", border: "1px solid rgba(255,68,68,0.3)",
          borderRadius: 20, padding: "4px 12px", marginBottom: 12,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#FF4444", display: "inline-block" }} />
          <span style={{ fontSize: 11, color: "#FF4444", fontWeight: 500, letterSpacing: 1.2, fontFamily: "var(--font-mono)" }}>
            DURABLE NONCE GUARDIAN
          </span>
        </div>
        <h2 style={{
          fontSize: 20, fontWeight: 300, color: "var(--text-primary)",
          fontFamily: "var(--font-heading)", letterSpacing: "0.06em", marginBottom: 8,
        }}>
          🛡️ 隱形定時炸彈偵測
        </h2>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.8, maxWidth: 560 }}>
          2026年4月1日，有人因為一個看不見的「永久有效交易」損失了 $2.85億。
          本工具掃描您錢包關聯的所有 Durable Nonce 賬戶，用 AI 標記潛在「定時炸彈」。
        </p>
        {/* Pricing badge */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.3)",
          borderRadius: 8, padding: "4px 12px", marginTop: 10,
          fontSize: 11, color: "#A78BFA",
        }}>
          🔒 掃描免費 · AI 安全報告 $1.00 USDC · SHA-256 永久鏈上存證
        </div>
      </div>

      {/* Input */}
      <div style={{
        background: "var(--bg-card)", border: "1px solid var(--border)",
        borderTop: "2px solid #FF4444",
        borderRadius: 10, padding: "20px 22px", marginBottom: 20,
      }}>
        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 8, letterSpacing: "0.03em" }}>
          輸入錢包地址進行掃描
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <input
            value={inputAddr}
            onChange={e => setInputAddr(e.target.value)}
            placeholder="Solana 錢包地址 (base58)"
            style={{
              flex: 1, background: "var(--bg-base)", border: "1px solid var(--border)",
              borderRadius: 8, padding: "10px 14px", fontSize: 13,
              color: "var(--text-primary)", fontFamily: "var(--font-mono)",
              outline: "none",
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
            {loading ? "掃描中…" : "開始掃描"}
          </button>
        </div>
        {walletAddress && walletAddress !== inputAddr && (
          <button
            onClick={() => setInputAddr(walletAddress)}
            style={{
              marginTop: 8, fontSize: 11, color: "var(--accent)",
              background: "none", border: "none", cursor: "pointer", padding: 0,
              letterSpacing: "0.03em",
            }}
          >
            ↑ 使用已連接錢包地址
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

      {/* x402 Payment Prompt */}
      {payState === "waiting" && payChallenge && (
        <div style={{
          background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.35)",
          borderRadius: 12, padding: "20px 22px", marginBottom: 20,
        }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#A78BFA", marginBottom: 8 }}>
            🔒 解鎖 AI 安全報告
          </div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.8, marginBottom: 16 }}>
            基礎掃描已完成。AI 深度分析報告需支付 <strong style={{ color: "#A78BFA" }}>${payChallenge.amount} USDC</strong>。
            <br />報告 SHA-256 哈希將永久記錄於 Solana 鏈上，獨立可驗證。
          </div>
          <button
            onClick={payAndGetReport}
            style={{
              background: "linear-gradient(135deg, #7C3AED, #4F46E5)",
              border: "none", borderRadius: 8, padding: "11px 24px",
              fontSize: 13, fontWeight: 600, color: "#fff", cursor: "pointer",
              letterSpacing: "0.04em",
            }}
          >
            💳 支付 ${payChallenge.amount} USDC · 獲取 AI 報告
          </button>
        </div>
      )}

      {payState === "paying" && (
        <div style={{
          background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.35)",
          borderRadius: 12, padding: "16px 20px", marginBottom: 20,
          fontSize: 13, color: "#A78BFA",
        }}>
          🌸 等待錢包確認支付…
        </div>
      )}

      {payState === "verifying" && (
        <div style={{
          background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.35)",
          borderRadius: 12, padding: "16px 20px", marginBottom: 20,
          fontSize: 13, color: "#A78BFA",
        }}>
          ✦ 驗證付款並生成 AI 報告…
        </div>
      )}

      {payState === "error" && payError && (
        <div style={{
          background: "rgba(255,68,68,0.08)", border: "1px solid rgba(255,68,68,0.3)",
          borderRadius: 8, padding: "12px 16px", marginBottom: 16,
          fontSize: 13, color: "#FF4444",
        }}>
          ❌ {payError}
        </div>
      )}

      {/* Results */}
      {result && (
        <div>
          {/* Overall status */}
          <div style={{
            background: "var(--bg-card)", border: "1px solid var(--border)",
            borderLeft: `3px solid ${maxSeverity ? severityColor[maxSeverity] : "var(--green)"}`,
            borderRadius: 10, padding: "16px 20px", marginBottom: 16,
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 4, letterSpacing: "0.08em" }}>
                SCAN RESULT
              </div>
              <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>
                {result.accounts.length === 0
                  ? "✅ 未發現 Nonce 賬戶"
                  : `發現 ${result.accounts.length} 個 Nonce 賬戶`}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                {result.riskSignals.length === 0
                  ? "無風險信號"
                  : `${result.riskSignals.length} 個風險信號`}
              </div>
            </div>
            {maxSeverity && (
              <div style={{
                background: `${severityColor[maxSeverity]}20`,
                border: `1px solid ${severityColor[maxSeverity]}40`,
                borderRadius: 8, padding: "8px 14px",
                fontSize: 13, fontWeight: 600,
                color: severityColor[maxSeverity],
              }}>
                {severityLabel[maxSeverity]}
              </div>
            )}
          </div>

          {/* Risk signals */}
          {result.riskSignals.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{
                fontSize: 11, color: "var(--text-muted)", letterSpacing: "0.15em",
                textTransform: "uppercase", marginBottom: 10, fontFamily: "var(--font-mono)",
              }}>
                風險信號
              </div>
              {result.riskSignals.map((signal: RiskSignal, i: number) => (
                <div key={i} style={{
                  background: "var(--bg-card)", border: "1px solid var(--border)",
                  borderLeft: `3px solid ${severityColor[signal.severity] ?? "var(--border)"}`,
                  borderRadius: 8, padding: "14px 16px", marginBottom: 8,
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{
                      fontSize: 10, fontWeight: 600, letterSpacing: "0.08em",
                      color: severityColor[signal.severity],
                      background: `${severityColor[signal.severity]}15`,
                      border: `1px solid ${severityColor[signal.severity]}30`,
                      borderRadius: 4, padding: "2px 8px",
                      fontFamily: "var(--font-mono)",
                    }}>
                      {signal.severity.toUpperCase()}
                    </span>
                    <span style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
                      {signal.address.slice(0, 12)}...
                    </span>
                  </div>
                  <div style={{ fontSize: 13, color: "var(--text-primary)", lineHeight: 1.7 }}>
                    {signal.description}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Nonce account list */}
          {result.accounts.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{
                fontSize: 11, color: "var(--text-muted)", letterSpacing: "0.15em",
                textTransform: "uppercase", marginBottom: 10, fontFamily: "var(--font-mono)",
              }}>
                Nonce 賬戶列表
              </div>
              {result.accounts.map((acct, i) => (
                <div key={i} style={{
                  background: "var(--bg-card)", border: "1px solid var(--border)",
                  borderRadius: 8, padding: "12px 16px", marginBottom: 8,
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                }}>
                  <div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--text-primary)", marginBottom: 4 }}>
                      {acct.address.slice(0, 18)}...{acct.address.slice(-6)}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      Authority: {acct.authority.slice(0, 12)}...
                    </div>
                  </div>
                  <span style={{
                    fontSize: 11, borderRadius: 4, padding: "3px 8px",
                    background: acct.isOwned ? "rgba(52,199,89,0.15)" : "rgba(255,68,68,0.15)",
                    color: acct.isOwned ? "var(--green)" : "#FF4444",
                    border: `1px solid ${acct.isOwned ? "rgba(52,199,89,0.3)" : "rgba(255,68,68,0.3)"}`,
                    fontWeight: 600, letterSpacing: "0.04em",
                  }}>
                    {acct.isOwned ? "✓ 自有" : "⚠ 外部控制"}
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* AI Analysis */}
          {result.aiAnalysis && (
            <div style={{
              background: "var(--bg-card)", border: "1px solid var(--border)",
              borderTop: "2px solid var(--accent)",
              borderRadius: 10, padding: "18px 20px", marginBottom: 16,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <span style={{
                  fontSize: 10, color: "var(--accent)", letterSpacing: "0.12em",
                  fontFamily: "var(--font-mono)", fontWeight: 600,
                }}>
                  ✦ AI SECURITY ANALYSIS
                </span>
              </div>
              <div style={{
                fontSize: 13, color: "var(--text-primary)", lineHeight: 2.0,
                whiteSpace: "pre-wrap",
              }}>
                {result.aiAnalysis}
              </div>
            </div>
          )}

          {/* SHA-256 On-Chain Proof */}
          {result.proof && (
            <div style={{
              background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.3)",
              borderRadius: 10, padding: "16px 20px", marginBottom: 16,
            }}>
              <div style={{ fontSize: 11, color: "#10B981", fontWeight: 700, letterSpacing: "0.1em", marginBottom: 10 }}>
                🔒 SHA-256 永久鏈上存證
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6 }}>報告哈希</div>
              <div style={{
                fontFamily: "var(--font-mono)", fontSize: 11, color: "#10B981",
                wordBreak: "break-all", background: "var(--bg-base)",
                borderRadius: 6, padding: "8px 12px", marginBottom: 12,
              }}>
                {result.proof.sha256}
              </div>
              {result.proof.explorerUrl && (
                <a
                  href={result.proof.explorerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: 12, color: "#10B981", textDecoration: "none",
                    display: "inline-flex", alignItems: "center", gap: 4,
                    background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.3)",
                    borderRadius: 6, padding: "5px 12px",
                  }}
                >
                  🔗 Solscan 查看鏈上記錄 →
                </a>
              )}
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 10, lineHeight: 1.7 }}>
                {result.proof.message}
              </div>
            </div>
          )}

          {/* Empty state */}
          {result.accounts.length === 0 && result.riskSignals.length === 0 && (
            <div style={{
              background: "rgba(52,199,89,0.08)", border: "1px solid rgba(52,199,89,0.25)",
              borderRadius: 10, padding: "20px", textAlign: "center",
            }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
              <div style={{ fontSize: 15, color: "var(--text-primary)", fontWeight: 500, marginBottom: 6 }}>
                此錢包無 Durable Nonce 風險
              </div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                未發現任何關聯的 Nonce 賬戶。定期重新掃描以保持安全。
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
          什麼是 DURABLE NONCE？
        </div>
        <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.85 }}>
          Durable Nonce 是 Solana 的一個功能，允許創建<strong style={{ color: "var(--text-primary)" }}>永不過期的預簽名交易</strong>。
          如果攻擊者控制了一個與您錢包關聯的 Nonce 賬戶，他們可以在您不知情的情況下，
          在未來任何時間執行預先準備好的惡意交易。這是2026年4月 Drift 攻擊的核心手法。
        </div>
      </div>
    </div>
  );
}
