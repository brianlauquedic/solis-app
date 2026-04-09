"use client";

import { useState, useEffect } from "react";
import { lookupProof, getAllProofs, ProofRecord } from "@/lib/proof-store";
import { payWithWallet } from "@/lib/x402";
import { useLang } from "@/contexts/LanguageContext";

const SAKURA_FEE_WALLET = "Goc5kAMb9NTXjobxzZogAWaHwajmQjw7CdmATWJN1mQh";

interface ChainMemoResult {
  signature: string;
  memo: string | null;
  layers: {
    decision?: string;
    simulationProof?: string;
    mandateRef?: string;
    rawMemo: string | null;
  };
  slot: number | null;
  blockTime: number | null;
  timestamp: number | null;
  feePayer: string | null;
  error?: string;
}

export default function VerifyPage() {
  const { t, lang } = useLang();
  const [input, setInput] = useState("");
  const [result, setResult] = useState<ProofRecord | null | "not-found">(null);
  const [recentProofs, setRecentProofs] = useState<ProofRecord[]>([]);
  const [showRecent, setShowRecent] = useState(false);

  // On-chain tx signature lookup
  const [txSig, setTxSig] = useState("");
  const [chainResult, setChainResult] = useState<ChainMemoResult | null>(null);
  const [chainLoading, setChainLoading] = useState(false);

  // Quota tracking
  const [verifyQuota, setVerifyQuota] = useState<{ remaining: number; used: number; admin?: boolean } | null>(null);
  const [verifyPaymentSig, setVerifyPaymentSig] = useState<string | null>(null);

  useEffect(() => {
    // Quota check disabled in v2 (no rate-limit lib)
    void verifyQuota;
  }, []);

  function handleVerify() {
    const hash = input.trim();
    if (!hash) return;
    const found = lookupProof(hash);
    setResult(found ?? "not-found");
  }

  async function fetchChainMemo() {
    const sig = txSig.trim();
    if (!sig || sig.length < 20) return;
    setChainLoading(true);
    setChainResult(null);
    try {
      const reqHeaders: Record<string, string> = {};
      if (verifyPaymentSig) reqHeaders["X-PAYMENT"] = verifyPaymentSig;

      let res = await fetch(`/api/verify/fetch-memo?sig=${encodeURIComponent(sig)}`, { headers: reqHeaders });

      // Handle payment required — pay then retry
      if (res.status === 402) {
        const body402 = await res.json() as { recipient?: string; amount?: number; description?: string };
        const payResult = await payWithWallet({
          recipient: body402.recipient ?? SAKURA_FEE_WALLET,
          amount: body402.amount ?? 0.05,
          currency: "USDC",
          network: "solana-mainnet",
          description: body402.description ?? "Sakura 链上验证 · $0.05 USDC",
        });
        if ("error" in payResult) {
          setChainResult({ signature: sig, memo: null, layers: { rawMemo: null }, slot: null, blockTime: null, timestamp: null, feePayer: null, error: "支付取消：" + payResult.error });
          return;
        }
        setVerifyPaymentSig(payResult.sig);
        res = await fetch(`/api/verify/fetch-memo?sig=${encodeURIComponent(sig)}`, {
          headers: { ...reqHeaders, "X-PAYMENT": payResult.sig },
        });
      }

      const data = await res.json() as ChainMemoResult;
      setChainResult(data);
    } catch {
      setChainResult({ signature: sig, memo: null, layers: { rawMemo: null }, slot: null, blockTime: null, timestamp: null, feePayer: null, error: "Fetch failed" });
    } finally {
      setChainLoading(false);
    }
  }

  function loadRecent() {
    setRecentProofs(getAllProofs());
    setShowRecent(true);
  }

  const verdictColor = (d: string) =>
    d === "可以考虑" ? "#10B981" : d === "谨慎操作" ? "#F59E0B" : "#EF4444";

  return (
    <main style={{ background: "#0A0A0F", minHeight: "100vh" }}>
      <div style={{ maxWidth: 680, margin: "0 auto", padding: "48px 24px" }}>

        {/* Title */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            background: "#1E3A5F", borderRadius: 20, padding: "6px 16px",
            fontSize: 11, color: "#60A5FA", fontWeight: 700,
            letterSpacing: 1, marginBottom: 20,
          }}>
            🔐 ON-CHAIN REASONING PROOF
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 900, color: "#fff", marginBottom: 12 }}>
            {t("verifyPageTitle")}
          </h1>
          <p style={{ fontSize: 14, color: "#64748B", lineHeight: 1.7, maxWidth: 520, margin: "0 auto" }}>
            {t("verifyPageDesc")}
          </p>
        </div>

        {/* How it works */}
        <div className="verify-steps" style={{
          display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12,
          marginBottom: 32,
        }}>
          {[
            { step: "01", title: t("verifyStep1Title"), desc: t("verifyStep1Desc") },
            { step: "02", title: t("verifyStep2Title"), desc: t("verifyStep2Desc") },
            { step: "03", title: t("verifyStep3Title"), desc: t("verifyStep3Desc") },
          ].map(s => (
            <div key={s.step} style={{
              background: "#13131A", border: "1px solid #1E1E2E",
              borderRadius: 12, padding: "16px",
            }}>
              <div style={{
                fontSize: 11, color: "#8B5CF6", fontWeight: 700,
                marginBottom: 6, fontFamily: "monospace",
              }}>STEP {s.step}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#E2E8F0", marginBottom: 4 }}>{s.title}</div>
              <div style={{ fontSize: 11, color: "#64748B", lineHeight: 1.5 }}>{s.desc}</div>
            </div>
          ))}
        </div>

        {/* ── On-Chain Tx Verification (Three-Layer) ── */}
        <div style={{
          background: "#080B14", border: "1px solid #1E3A5F",
          borderRadius: 16, padding: 24, marginBottom: 20,
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#60A5FA" }}>
              {t("chainVerifyTitle")}
            </div>
            {verifyQuota && !verifyQuota.admin && (
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                padding: "2px 9px", borderRadius: 20,
                background: verifyQuota.remaining > 0 ? "#10B98115" : "#8B5CF615",
                border: `1px solid ${verifyQuota.remaining > 0 ? "#10B98130" : "#8B5CF630"}`,
                fontSize: 10, fontWeight: 600,
                color: verifyQuota.remaining > 1 ? "#10B981" : verifyQuota.remaining === 1 ? "#F59E0B" : "#8B5CF6",
              }}>
                {verifyQuota.remaining > 0
                  ? `🆓 ${verifyQuota.remaining}/3 次免费`
                  : "💰 $0.05 USDC/次"}
              </div>
            )}
          </div>
          <div style={{ fontSize: 11, color: "#334155", marginBottom: 14 }}>
            {t("chainVerifyDesc")}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <input
              type="text"
              value={txSig}
              onChange={e => { setTxSig(e.target.value); setChainResult(null); }}
              onKeyDown={e => e.key === "Enter" && fetchChainMemo()}
              placeholder="Solana tx signature (base58)"
              style={{
                flex: 1, padding: "11px 14px",
                background: "#0A0A0F", border: "1px solid #1E3A5F",
                borderRadius: 10, fontSize: 12, color: "#E2E8F0",
                outline: "none", fontFamily: "monospace",
              }}
            />
            <button
              onClick={fetchChainMemo}
              disabled={chainLoading}
              style={{
                padding: "11px 18px",
                background: chainLoading ? "#1E1E2E" : "linear-gradient(135deg, #1E3A5F, #0D1A3A)",
                border: "1px solid #60A5FA40",
                borderRadius: 10, fontSize: 13, fontWeight: 700,
                color: chainLoading ? "#475569" : "#60A5FA", cursor: chainLoading ? "not-allowed" : "pointer",
                whiteSpace: "nowrap",
              }}
            >{chainLoading ? t("querying") : t("chainQuery")}</button>
          </div>

          {/* Chain result */}
          {chainResult && (
            <div style={{ marginTop: 20 }}>
              {chainResult.error ? (
                <div style={{ fontSize: 12, color: "#EF4444" }}>❌ {chainResult.error}</div>
              ) : chainResult.memo ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {/* Layer 1: Decision */}
                  <div style={{
                    background: "#13131A", border: "1px solid #10B98130",
                    borderRadius: 10, padding: "12px 14px",
                  }}>
                    <div style={{ fontSize: 10, color: "#10B981", fontWeight: 700, marginBottom: 6 }}>
                      {t("layer1Title")}
                    </div>
                    <div style={{ fontSize: 12, color: "#94A3B8", lineHeight: 1.6 }}>
                      {chainResult.layers.decision ?? chainResult.memo}
                    </div>
                    <div style={{ fontSize: 10, color: "#334155", marginTop: 6, fontFamily: "monospace" }}>
                      Slot {chainResult.slot} ·{" "}
                      {chainResult.blockTime ? new Date(chainResult.blockTime * 1000).toLocaleString(lang === "ja" ? "ja-JP" : lang === "en" ? "en-US" : "zh-TW") : "—"}
                      {chainResult.feePayer ? ` · ${chainResult.feePayer.slice(0, 8)}...` : ""}
                    </div>
                  </div>

                  {/* Layer 2: Simulation proof (if present) */}
                  {chainResult.layers.simulationProof && (
                    <div style={{
                      background: "#1A0A08", border: "1px solid #F59E0B30",
                      borderRadius: 10, padding: "12px 14px",
                    }}>
                      <div style={{ fontSize: 10, color: "#F59E0B", fontWeight: 700, marginBottom: 6 }}>
                        {t("layer2Title")}
                      </div>
                      <div style={{ fontSize: 12, color: "#94A3B8" }}>
                        {chainResult.layers.simulationProof}
                      </div>
                    </div>
                  )}

                  {/* Layer 3: Mandate reference (if present) */}
                  {chainResult.layers.mandateRef && (
                    <div style={{
                      background: "#080B14", border: "1px solid #8B5CF630",
                      borderRadius: 10, padding: "12px 14px",
                    }}>
                      <div style={{ fontSize: 10, color: "#8B5CF6", fontWeight: 700, marginBottom: 6 }}>
                        {t("layer3Title")}
                      </div>
                      <div style={{ fontSize: 12, color: "#94A3B8", fontFamily: "monospace" }}>
                        {chainResult.layers.mandateRef}
                      </div>
                    </div>
                  )}

                  {/* Raw memo */}
                  <details style={{ cursor: "pointer" }}>
                    <summary style={{ fontSize: 11, color: "#334155" }}>{t("viewRawMemo")}</summary>
                    <div style={{
                      marginTop: 8, fontSize: 11, color: "#475569",
                      fontFamily: "monospace", wordBreak: "break-all",
                      background: "#0A0A0F", padding: "10px 12px", borderRadius: 8,
                    }}>
                      {chainResult.memo}
                    </div>
                  </details>
                </div>
              ) : (
                <div style={{ fontSize: 12, color: "#475569" }}>
                  {t("noMemoField")}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Input */}
        <div style={{
          background: "#13131A", border: "1px solid #1E1E2E",
          borderRadius: 16, padding: 24, marginBottom: 20,
        }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#E2E8F0", marginBottom: 12 }}>
            {t("inputHashOrMemo")}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <input
              type="text"
              value={input}
              onChange={e => { setInput(e.target.value); setResult(null); }}
              onKeyDown={e => e.key === "Enter" && handleVerify()}
              placeholder={t("hashInputPlaceholder")}
              style={{
                flex: 1, padding: "12px 16px",
                background: "#0A0A0F", border: "1px solid #1E1E2E",
                borderRadius: 10, fontSize: 13, color: "#E2E8F0",
                outline: "none", fontFamily: "monospace",
              }}
            />
            <button
              onClick={handleVerify}
              style={{
                padding: "12px 22px",
                background: "linear-gradient(135deg, #8B5CF6, #06B6D4)",
                border: "none", borderRadius: 10,
                fontSize: 14, fontWeight: 700, color: "#fff", cursor: "pointer",
              }}
            >{t("verifyBtn")}</button>
          </div>
          <button
            onClick={loadRecent}
            style={{
              marginTop: 12, background: "none", border: "none",
              fontSize: 12, color: "#475569", cursor: "pointer", padding: 0,
            }}
          >
            {t("viewRecentProofs")}
          </button>
        </div>

        {/* Recent proofs list */}
        {showRecent && (
          <div style={{
            background: "#13131A", border: "1px solid #1E1E2E",
            borderRadius: 16, padding: 20, marginBottom: 20,
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#E2E8F0", marginBottom: 12 }}>
              {t("recentProofsCount", { n: recentProofs.length })}
            </div>
            {recentProofs.length === 0 ? (
              <div style={{ fontSize: 12, color: "#475569", textAlign: "center", padding: "16px 0" }}>
                {t("noProofsYet")}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {recentProofs.map(p => (
                  <div
                    key={p.hash}
                    onClick={() => { setInput(p.hash); setResult(p); setShowRecent(false); }}
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      background: "#0A0A0F", borderRadius: 10, padding: "10px 14px",
                      cursor: "pointer", border: "1px solid #1E1E2E",
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 2 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#E2E8F0" }}>{p.symbol}</span>
                        <span style={{
                          fontSize: 10, color: verdictColor(p.decision),
                          background: `${verdictColor(p.decision)}15`,
                          borderRadius: 4, padding: "1px 6px",
                        }}>{p.decision}</span>
                      </div>
                      <div style={{ fontSize: 10, color: "#334155", fontFamily: "monospace" }}>
                        {p.memoPayload}
                      </div>
                    </div>
                    <div style={{ fontSize: 11, color: "#475569" }}>
                      {new Date(p.timestamp).toLocaleDateString(lang === "ja" ? "ja-JP" : lang === "en" ? "en-US" : "zh-TW")}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Result */}
        {result === "not-found" && (
          <div style={{
            background: "#1A0808", border: "1px solid #EF444430",
            borderRadius: 16, padding: 24, textAlign: "center",
          }}>
            <div style={{ fontSize: 24, marginBottom: 12 }}>🔍</div>
            <div style={{ fontSize: 15, color: "#EF4444", marginBottom: 8 }}>{t("proofNotFound")}</div>
            <div style={{ fontSize: 12, color: "#64748B" }}>
              {t("proofNotFoundDesc")}
            </div>
          </div>
        )}

        {result && result !== "not-found" && (
          <div style={{
            background: "#13131A", border: "1px solid #1E3A5F",
            borderRadius: 16, overflow: "hidden",
          }}>
            {/* Verified header */}
            <div style={{
              background: "linear-gradient(135deg, #8B5CF610, #06B6D410)",
              borderBottom: "1px solid #1E3A5F",
              padding: "16px 24px",
              display: "flex", alignItems: "center", gap: 12,
            }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%",
                background: "#10B98120", border: "2px solid #10B981",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 16,
              }}>✅</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#10B981" }}>{t("hashVerifySuccess")}</div>
                <div style={{ fontSize: 11, color: "#475569" }}>
                  {new Date(result.timestamp).toLocaleString(lang === "ja" ? "ja-JP" : lang === "en" ? "en-US" : "zh-TW")} ·{" "}
                  {result.aiAvailable ? t("generatedByAI") : t("generatedByRule")}
                </div>
              </div>
            </div>

            <div style={{ padding: 24 }}>
              {/* Token info */}
              <div style={{
                display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16,
                marginBottom: 20, padding: "16px", background: "#0A0A0F",
                borderRadius: 12,
              }}>
                <InfoCell label={t("tokenLabel")} value={result.symbol} />
                <InfoCell label={t("securityScoreLabel")} value={`${result.securityScore}/100`}
                  valueColor={result.securityScore >= 70 ? "#10B981" : result.securityScore >= 45 ? "#F59E0B" : "#EF4444"} />
                <InfoCell label={t("aiDecisionLabel")} value={result.decision} valueColor={verdictColor(result.decision)} />
              </div>

              {/* Reasoning */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, color: "#475569", marginBottom: 8 }}>{t("aiReasoningContent")}</div>
                <div style={{
                  background: "#0A0A0F", border: "1px solid #1E1E2E",
                  borderRadius: 10, padding: "14px 16px",
                  fontSize: 13, color: "#94A3B8", lineHeight: 1.7,
                }}>
                  {result.reasoning}
                </div>
              </div>

              {/* Hash */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, color: "#475569", marginBottom: 8 }}>{t("sha256Hash")}</div>
                <div style={{
                  background: "#0A0A0F", border: "1px solid #1E3A5F",
                  borderRadius: 10, padding: "12px 14px",
                  fontSize: 11, fontFamily: "monospace", color: "#60A5FA",
                  wordBreak: "break-all",
                }}>
                  {result.hash}
                </div>
              </div>

              {/* Raw proof data */}
              <div style={{
                background: "#080B14", border: "1px solid #1E2A3A",
                borderRadius: 10, padding: "12px 14px",
                fontSize: 11, fontFamily: "monospace", color: "#475569", lineHeight: 1.8,
              }}>
                <div style={{ color: "#64748B", marginBottom: 6 }}>// 哈希原始输入数据</div>
                <div><span style={{ color: "#8B5CF6" }}>mint</span>: &quot;{result.mint}&quot;</div>
                <div><span style={{ color: "#8B5CF6" }}>securityScore</span>: {result.securityScore}</div>
                <div><span style={{ color: "#8B5CF6" }}>decision</span>: &quot;{result.decision}&quot;</div>
                <div><span style={{ color: "#8B5CF6" }}>timestamp</span>: {result.timestamp}</div>
                <div><span style={{ color: "#8B5CF6" }}>hashAlgo</span>: &quot;sha256&quot;</div>
              </div>
            </div>
          </div>
        )}

        {/* Explainer */}
        <div style={{
          marginTop: 32, padding: 20,
          background: "#080B14", border: "1px solid #1E2A3A",
          borderRadius: 16, fontSize: 12, color: "#475569", lineHeight: 1.8,
        }}>
          <div style={{ color: "#60A5FA", fontWeight: 700, marginBottom: 8 }}>
            🔐 为什么链上推理透明度很重要？
          </div>
          当 Sakura AI 给出"建议买入 $50"时，用户需要能够验证这个建议是否真实可靠。
          通过将推理哈希写入 Solana 交易的 Memo 字段，任何人都可以：
          <br /><br />
          • 查看 AI 当时使用的原始数据（安全评分、持仓比例等）<br />
          • 验证建议没有被篡改<br />
          • 对 AI 决策追责<br /><br />
          这是 Solana 官方 AI 生态三大焦点之一：<strong style={{ color: "#9945FF" }}>Verifiable Compute（可验证计算）</strong>——
          开放、透明、可审计的 AI 推理，正是 Agentic Economy 信任基础的核心。
        </div>

        {/* Solana AI ecosystem alignment */}
        <div style={{
          marginTop: 16, padding: "14px 20px",
          background: "#0D1117", border: "1px solid #1E2A3A",
          borderRadius: 12, display: "flex", alignItems: "center",
          gap: 16, flexWrap: "wrap",
        }}>
          <div style={{ fontSize: 11, color: "#334155", whiteSpace: "nowrap" }}>符合 Solana AI 生态</div>
          {[
            { label: "Verifiable Compute", color: "#9945FF" },
            { label: "Agentic Economy",    color: "#F59E0B" },
            { label: "Colosseum 2026",     color: "#60A5FA" },
          ].map(b => (
            <span key={b.label} style={{
              fontSize: 10, fontWeight: 700, color: b.color,
              background: `${b.color}15`, border: `1px solid ${b.color}30`,
              borderRadius: 6, padding: "3px 10px",
            }}>{b.label}</span>
          ))}
        </div>
      </div>
    </main>
  );
}

function InfoCell({ label, value, valueColor = "#E2E8F0" }: { label: string; value: string; valueColor?: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: "#475569", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: valueColor }}>{value}</div>
    </div>
  );
}
