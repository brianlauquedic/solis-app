"use client";

import { useState, useEffect } from "react";
import SwapModal from "./SwapModal";
import StakeModal from "./StakeModal";
import LendModal from "./LendModal";
import { useLang } from "@/contexts/LanguageContext";
import { getDeviceId } from "@/lib/device-id";
import { payWithPhantom } from "@/lib/x402";

interface WalletSnapshot {
  solBalance: number;
  totalUSD: number;
  idleUSDC: number;
}

interface RebalanceAction {
  type: "stake" | "lend" | "swap" | "lp";
  protocol: string;
  icon: string;
  amount: number;
  amountDisplay: string;
  expectedAPY: number;
  riskLevel: "低" | "中" | "高";
  reasoning: string;
  url: string;
  color: string;
}

interface RebalancePlan {
  currentAllocation: { sol: number; usdc: number; staked: number; lent: number };
  recommendedAllocation: { sol: number; usdc: number; staked: number; lent: number };
  actions: RebalanceAction[];
  projectedAnnualYield: number;
  currentAnnualYield: number;
  confidenceScore: number;
  summary: string;
  aiAvailable: boolean;
  planHash: string;
  memoPayload: string;
}

interface Props {
  walletAddress: string;
  walletSnapshot?: WalletSnapshot;
}

type AgentState = "idle" | "scanning" | "analyzing" | "generating" | "done" | "error";

// ── On-Chain Mandate ─────────────────────────────────────────────────────────
interface Mandate {
  owner: string;
  maxStakePct: number;          // max % of portfolio to stake
  maxSingleProtocolPct: number; // max % in any single protocol
  allowedProtocols: string[];
  version: 1;
  createdAt: number;
}

interface SignedMandate {
  mandate: Mandate;
  signature: string;  // base64 Phantom signMessage signature
  signedAt: number;
}

function loadMandate(walletAddress: string): SignedMandate | null {
  try {
    const raw = localStorage.getItem(`solis_mandate_${walletAddress}`);
    return raw ? JSON.parse(raw) as SignedMandate : null;
  } catch { return null; }
}

function saveMandate(walletAddress: string, signed: SignedMandate) {
  localStorage.setItem(`solis_mandate_${walletAddress}`, JSON.stringify(signed));
}

function checkMandateCompliance(
  plan: RebalancePlan,
  mandate: Mandate
): { compliant: boolean; violations: string[] } {
  const violations: string[] = [];
  const total = plan.currentAllocation.sol + plan.currentAllocation.usdc +
    plan.currentAllocation.staked + plan.currentAllocation.lent;

  for (const action of plan.actions) {
    const pct = total > 0 ? (action.amount / total) * 100 : 0;
    if ((action.type === "stake" || action.type === "lend") && pct > mandate.maxStakePct) {
      violations.push(`${action.protocol} 占比 ${pct.toFixed(0)}% 超过限制 ${mandate.maxStakePct}%`);
    }
    if (pct > mandate.maxSingleProtocolPct) {
      violations.push(`单协议 ${action.protocol} 占比 ${pct.toFixed(0)}% 超过 ${mandate.maxSingleProtocolPct}%`);
    }
    const protocolKey = action.protocol.toLowerCase().split(" ")[0];
    const allowed = mandate.allowedProtocols.some(p => protocolKey.includes(p));
    if (!allowed) {
      violations.push(`协议 ${action.protocol} 不在你的允许列表中`);
    }
  }
  return { compliant: violations.length === 0, violations };
}

// THINKING_STEPS labels are set dynamically using t() in the component

const STAKE_PROTOCOLS: Record<string, "marinade" | "jito"> = {
  "Marinade Finance": "marinade",
  "Marinade": "marinade",
  "Jito": "jito",
};
const LEND_PROTOCOLS: Record<string, "kamino" | "solend"> = {
  "Kamino Finance": "kamino",
  "Kamino": "kamino",
  "Save (Solend)": "solend",
  "Solend": "solend",
};

function AllocationBar({
  label, allocation,
}: {
  label: string;
  allocation: { sol: number; usdc: number; staked: number; lent: number };
}) {
  const { t } = useLang();
  const items = [
    { key: "staked", label: t("staking"), color: "#8B5CF6" },
    { key: "lent",   label: t("deposit"), color: "#10B981" },
    { key: "sol",    label: "SOL",        color: "#06B6D4" },
    { key: "usdc",   label: "USDC",       color: "#F59E0B" },
  ] as const;

  return (
    <div>
      <div style={{ fontSize: 11, color: "#475569", marginBottom: 6 }}>{label}</div>
      <div style={{ display: "flex", borderRadius: 6, overflow: "hidden", height: 16 }}>
        {items.map(item => {
          const pct = allocation[item.key];
          if (pct <= 0) return null;
          return (
            <div
              key={item.key}
              style={{ width: `${pct}%`, background: item.color, transition: "width 0.6s ease" }}
              title={`${item.label}: ${pct}%`}
            />
          );
        })}
        {/* remainder */}
        {(() => {
          const total = allocation.sol + allocation.usdc + allocation.staked + allocation.lent;
          const rem = Math.max(0, 100 - total);
          return rem > 0 ? <div style={{ flex: 1, background: "#1E1E2E" }} /> : null;
        })()}
      </div>
      <div style={{ display: "flex", gap: 10, marginTop: 5, flexWrap: "wrap" }}>
        {items.map(item => {
          const pct = allocation[item.key];
          if (pct <= 0) return null;
          return (
            <span key={item.key} style={{ fontSize: 10, color: item.color }}>
              {item.label} {pct}%
            </span>
          );
        })}
      </div>
    </div>
  );
}

const SOLIS_FEE_WALLET = "Goc5kAMb9NTXjobxzZogAWaHwajmQjw7CdmATWJN1mQh";

export default function AgentPanel({ walletAddress, walletSnapshot }: Props) {
  const { t } = useLang();
  const [agentState, setAgentState] = useState<AgentState>("idle");
  const [stepLabel, setStepLabel] = useState("");
  const [plan, setPlan] = useState<RebalancePlan | null>(null);
  const [error, setError] = useState("");
  const [memoStatus, setMemoStatus] = useState<"idle" | "sending" | "done">("idle");
  const [memoTx, setMemoTx] = useState("");

  // Quota tracking
  const [agentQuota, setAgentQuota] = useState<{ remaining: number; used: number; admin?: boolean } | null>(null);
  const [agentPaymentSig, setAgentPaymentSig] = useState<string | null>(null);

  useEffect(() => {
    const deviceId = getDeviceId();
    fetch("/api/quota?features=agent", {
      headers: {
        "X-Device-ID": deviceId,
        "X-Wallet-Address": walletAddress ?? "",
      },
    })
      .then(r => r.json())
      .then(d => { if (d.agent) setAgentQuota(d.agent); })
      .catch(() => {});
  }, [walletAddress]);

  // Mandate state
  const [signedMandate, setSignedMandate] = useState<SignedMandate | null>(() => loadMandate(walletAddress));
  const [showMandateEditor, setShowMandateEditor] = useState(false);
  const [mandateDraft, setMandateDraft] = useState<Omit<Mandate, "owner" | "version" | "createdAt">>({
    maxStakePct: 70,
    maxSingleProtocolPct: 40,
    allowedProtocols: ["marinade", "jito", "kamino", "solend"],
  });
  const [mandateSigning, setMandateSigning] = useState(false);
  const [complianceResult, setComplianceResult] = useState<{ compliant: boolean; violations: string[] } | null>(null);

  const [swapModal, setSwapModal]   = useState<{ from: string; to: string; amount: number } | null>(null);
  const [stakeModal, setStakeModal] = useState<{ protocol: "marinade" | "jito"; amount: number } | null>(null);
  const [lendModal, setLendModal]   = useState<{ protocol: "kamino" | "solend"; amount: number } | null>(null);

  async function signAndSaveMandate() {
    if (!window.solana?.isPhantom) return;
    setMandateSigning(true);
    try {
      const mandate: Mandate = {
        owner: walletAddress,
        ...mandateDraft,
        version: 1,
        createdAt: Date.now(),
      };
      const msgBytes = new TextEncoder().encode(JSON.stringify(mandate));
      const { signature } = await window.solana.signMessage(msgBytes, "utf8");
      const sig64 = Buffer.from(signature).toString("base64");
      const signed: SignedMandate = { mandate, signature: sig64, signedAt: Date.now() };
      saveMandate(walletAddress, signed);
      setSignedMandate(signed);
      setShowMandateEditor(false);
    } catch { /* user cancelled */ }
    finally { setMandateSigning(false); }
  }

  async function runAgent() {
    setAgentState("scanning");
    setError("");
    setPlan(null);
    setMemoStatus("idle");

    // Fetch wallet if not provided
    let wallet: WalletSnapshot = walletSnapshot ?? { solBalance: 0, totalUSD: 0, idleUSDC: 0 };
    if (!walletSnapshot) {
      try {
        const r = await fetch(`/api/wallet?address=${walletAddress}`);
        const d = await r.json();
        if (!d.error) wallet = { solBalance: d.solBalance, totalUSD: d.totalUSD, idleUSDC: d.idleUSDC };
      } catch { /* use empty */ }
    }

    // Fetch live yield
    let liveYield;
    try {
      const r = await fetch("/api/yield");
      const d = await r.json();
      if (d.opportunities) liveYield = d;
    } catch { /* non-fatal */ }

    // Animate thinking steps
    const thinkingSteps: { state: AgentState; label: string; duration: number }[] = [
      { state: "scanning",   label: t("scanningWallet"),    duration: 900 },
      { state: "analyzing",  label: t("analyzingPortfolio"), duration: 1100 },
      { state: "generating", label: t("generatingPlan"),    duration: 700 },
    ];
    for (const step of thinkingSteps) {
      setAgentState(step.state);
      setStepLabel(step.label);
      await new Promise(r => setTimeout(r, step.duration));
    }

    try {
      const deviceId = getDeviceId();
      const reqHeaders: Record<string, string> = {
        "Content-Type": "application/json",
        "X-Device-ID": deviceId,
        "X-Wallet-Address": walletAddress ?? "",
      };
      if (agentPaymentSig) reqHeaders["X-PAYMENT"] = agentPaymentSig;

      // [SECURITY FIX] Send signed mandate to backend for server-side validation
      const currentMandate = loadMandate(walletAddress);
      if (currentMandate) {
        reqHeaders["X-Mandate"] = Buffer.from(
          JSON.stringify(currentMandate.mandate)
        ).toString("base64");
      }

      const reqBody = JSON.stringify({
        walletAddress,
        solBalance: wallet.solBalance,
        totalUSD: wallet.totalUSD,
        idleUSDC: wallet.idleUSDC,
        liveYield,
      });

      let res = await fetch("/api/agent/rebalance", {
        method: "POST",
        headers: reqHeaders,
        body: reqBody,
      });

      // Handle quota exhaustion — pay then retry
      if (res.status === 402) {
        const body402 = await res.json() as { recipient?: string; amount?: number; description?: string };
        const payResult = await payWithPhantom({
          recipient: body402.recipient ?? SOLIS_FEE_WALLET,
          amount: body402.amount ?? 0.10,
          currency: "USDC",
          network: "solana-mainnet",
          description: body402.description ?? "Sakura Agent 分析 · $0.10 USDC",
        });
        if ("error" in payResult) throw new Error("支付取消：" + payResult.error);
        setAgentPaymentSig(payResult.sig);
        res = await fetch("/api/agent/rebalance", {
          method: "POST",
          headers: { ...reqHeaders, "X-PAYMENT": payResult.sig },
          body: reqBody,
        });
      }

      if (!res.ok) throw new Error("rebalance api failed");
      const data = await res.json() as RebalancePlan;
      // Refresh quota after use
      fetch("/api/quota?features=agent", {
        headers: { "X-Device-ID": getDeviceId(), "X-Wallet-Address": walletAddress ?? "" },
      }).then(r => r.json()).then(d => { if (d.agent) setAgentQuota(d.agent); }).catch(() => {});
      setPlan(data);
      // Check mandate compliance if user has a signed mandate
      if (signedMandate) {
        setComplianceResult(checkMandateCompliance(data, signedMandate.mandate));
      }
      setAgentState("done");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : t("analyzingPortfolio"));
      setAgentState("error");
    }
  }

  async function submitPlanOnChain() {
    if (!plan) return;
    setMemoStatus("sending");
    try {
      const res = await fetch("/api/agent/memo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memoPayload: plan.memoPayload }),
      });
      const data = await res.json();
      if (res.ok && data.txSignature) {
        setMemoTx(data.txSignature);
        setMemoStatus("done");
      } else {
        setMemoStatus("idle");
      }
    } catch {
      setMemoStatus("idle");
    }
  }

  function openActionModal(action: RebalanceAction) {
    const stakeProtocol = STAKE_PROTOCOLS[action.protocol];
    const lendProtocol  = LEND_PROTOCOLS[action.protocol];

    if (stakeProtocol) {
      setStakeModal({ protocol: stakeProtocol, amount: action.amount });
    } else if (lendProtocol) {
      setLendModal({ protocol: lendProtocol, amount: action.amount });
    } else if (action.type === "swap") {
      setSwapModal({ from: "SOL", to: "USDC", amount: action.amount });
    }
  }

  const isRunning = ["scanning", "analyzing", "generating"].includes(agentState);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* ── Header ── */}
      <div style={{
        background: "linear-gradient(135deg, #13131A, #0D0D1A)",
        border: "1px solid #1E1E2E",
        borderRadius: 16, padding: 24,
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16,
      }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "#E2E8F0", marginBottom: 4 }}>
            🤖 AI 再平衡 Agent
          </div>
          <div style={{ fontSize: 13, color: "#475569", lineHeight: 1.5 }}>
            自主分析你的持仓，生成最优 DeFi 收益方案。
            无需提问——点一个按钮，Agent 帮你规划。
          </div>
          {agentQuota && !agentQuota.admin && (
            <div style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              marginTop: 8, padding: "3px 10px", borderRadius: 20,
              background: agentQuota.remaining > 0 ? "#10B98115" : "#8B5CF615",
              border: `1px solid ${agentQuota.remaining > 0 ? "#10B98130" : "#8B5CF630"}`,
              fontSize: 11, fontWeight: 600,
              color: agentQuota.remaining > 1 ? "#10B981" : agentQuota.remaining === 1 ? "#F59E0B" : "#8B5CF6",
            }}>
              {agentQuota.remaining > 0
                ? `🆓 ${agentQuota.remaining}/3 次免费剩余`
                : "💰 免费次数已用完 · $0.10 USDC/次"}
            </div>
          )}
        </div>
        <button
          onClick={runAgent}
          disabled={isRunning}
          style={{
            padding: "12px 24px",
            background: isRunning
              ? "#1E1E2E"
              : "linear-gradient(135deg, #8B5CF6, #06B6D4)",
            border: "none", borderRadius: 12,
            fontSize: 14, fontWeight: 700, color: isRunning ? "#475569" : "#fff",
            cursor: isRunning ? "not-allowed" : "pointer",
            whiteSpace: "nowrap", minWidth: 120,
          }}
        >
          {isRunning ? t("analyzingPortfolio") : agentState === "done" ? t("reanalyze") : t("runAgent")}
        </button>
      </div>

      {/* ── On-Chain Mandate Panel ── */}
      <div style={{
        background: "#0D0D14", border: `1px solid ${signedMandate ? "#8B5CF660" : "#1E1E2E"}`,
        borderRadius: 14, padding: "14px 18px",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: signedMandate ? "#8B5CF6" : "#475569" }}>
              {signedMandate ? "🔐 投资规则已签名上链" : "⚙️ 设置投资规则（可选）"}
            </div>
            {signedMandate && (
              <div style={{ fontSize: 10, color: "#475569", marginTop: 3 }}>
                最大质押 {signedMandate.mandate.maxStakePct}% · 单协议上限 {signedMandate.mandate.maxSingleProtocolPct}% · 已用 Phantom 签名
              </div>
            )}
          </div>
          <button
            onClick={() => setShowMandateEditor(v => !v)}
            style={{
              background: "none", border: "1px solid #1E1E2E", borderRadius: 6,
              color: "#475569", fontSize: 11, cursor: "pointer", padding: "4px 10px",
            }}
          >
            {showMandateEditor ? "收起" : signedMandate ? "修改" : "设置"}
          </button>
        </div>

        {showMandateEditor && (
          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <div style={{ fontSize: 11, color: "#94A3B8", marginBottom: 6 }}>
                最大质押比例: <b style={{ color: "#8B5CF6" }}>{mandateDraft.maxStakePct}%</b>
              </div>
              <input type="range" min={10} max={100} value={mandateDraft.maxStakePct}
                onChange={e => setMandateDraft(d => ({ ...d, maxStakePct: Number(e.target.value) }))}
                style={{ width: "100%", accentColor: "#8B5CF6" }}
              />
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#94A3B8", marginBottom: 6 }}>
                单协议上限: <b style={{ color: "#06B6D4" }}>{mandateDraft.maxSingleProtocolPct}%</b>
              </div>
              <input type="range" min={10} max={100} value={mandateDraft.maxSingleProtocolPct}
                onChange={e => setMandateDraft(d => ({ ...d, maxSingleProtocolPct: Number(e.target.value) }))}
                style={{ width: "100%", accentColor: "#06B6D4" }}
              />
            </div>
            <div>
              <div style={{ fontSize: 11, color: "#94A3B8", marginBottom: 8 }}>允许协议</div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {(["marinade", "jito", "kamino", "solend"] as const).map(p => (
                  <label key={p} style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer" }}>
                    <input type="checkbox"
                      checked={mandateDraft.allowedProtocols.includes(p)}
                      onChange={e => setMandateDraft(d => ({
                        ...d,
                        allowedProtocols: e.target.checked
                          ? [...d.allowedProtocols, p]
                          : d.allowedProtocols.filter(x => x !== p),
                      }))}
                      style={{ accentColor: "#8B5CF6" }}
                    />
                    <span style={{ fontSize: 11, color: "#94A3B8", textTransform: "capitalize" }}>{p}</span>
                  </label>
                ))}
              </div>
            </div>
            <button
              onClick={signAndSaveMandate}
              disabled={mandateSigning}
              style={{
                padding: "9px 18px", borderRadius: 8, border: "none",
                background: mandateSigning ? "#1E1E2E" : "linear-gradient(135deg, #8B5CF6, #06B6D4)",
                color: mandateSigning ? "#475569" : "#fff",
                fontSize: 12, fontWeight: 700, cursor: mandateSigning ? "not-allowed" : "pointer",
              }}
            >
              {mandateSigning ? "等待 Phantom 签名..." : "👻 用 Phantom 签名此规则"}
            </button>
            <div style={{ fontSize: 10, color: "#334155" }}>
              规则将由你的钱包私钥签名，写入链上 Memo。AI 只能在此范围内操作。
            </div>
          </div>
        )}
      </div>

      {/* ── Mandate compliance result ── */}
      {complianceResult && plan && (
        <div style={{
          background: complianceResult.compliant ? "#0A1A0F" : "#1A0808",
          border: `1px solid ${complianceResult.compliant ? "#10B98140" : "#EF444440"}`,
          borderRadius: 12, padding: "12px 16px",
          fontSize: 12,
          color: complianceResult.compliant ? "#10B981" : "#EF4444",
        }}>
          {complianceResult.compliant ? (
            "✅ 执行方案符合你的 On-Chain Mandate 约束"
          ) : (
            <>⚠️ Mandate 合规检查不通过：
              <ul style={{ margin: "6px 0 0 16px", padding: 0 }}>
                {complianceResult.violations.map((v, i) => <li key={i}>{v}</li>)}
              </ul>
            </>
          )}
        </div>
      )}

      {/* ── Thinking animation ── */}
      {isRunning && (
        <div style={{
          background: "#13131A", border: "1px solid #8B5CF630",
          borderRadius: 12, padding: "16px 20px",
          display: "flex", alignItems: "center", gap: 12,
        }}>
          <div style={{ display: "flex", gap: 4 }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                width: 8, height: 8, borderRadius: "50%", background: "#8B5CF6",
                animation: `bounce 1s ease-in-out ${i * 0.15}s infinite`,
              }} />
            ))}
          </div>
          <span style={{ fontSize: 13, color: "#8B5CF6" }}>{stepLabel}</span>
        </div>
      )}

      {/* ── Error ── */}
      {agentState === "error" && (
        <div style={{
          background: "#1A0808", border: "1px solid #EF4444",
          borderRadius: 12, padding: "14px 18px",
          fontSize: 13, color: "#EF4444",
        }}>
          ❌ {error}
        </div>
      )}

      {/* ── Plan result ── */}
      {agentState === "done" && plan && (
        <>
          {/* Summary */}
          <div style={{
            background: "#0A1A0F", border: "1px solid #10B98140",
            borderRadius: 14, padding: "16px 20px",
          }}>
            <div style={{ fontSize: 13, color: "#10B981", fontWeight: 700, marginBottom: 8 }}>
              ✅ {plan.summary}
            </div>
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 10, color: "#475569" }}>{t("currentAnnualYield")}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#EF4444" }}>
                  $0
                </div>
              </div>
              <div style={{ fontSize: 20, color: "#475569", alignSelf: "flex-end", marginBottom: 2 }}>→</div>
              <div>
                <div style={{ fontSize: 10, color: "#475569" }}>{t("projectedYield")}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#10B981" }}>
                  +${plan.projectedAnnualYield.toFixed(0)}
                </div>
              </div>
              <div style={{ marginLeft: "auto", textAlign: "right" }}>
                <div style={{ fontSize: 10, color: "#475569" }}>AI 置信度</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#8B5CF6" }}>
                  {plan.confidenceScore}%
                </div>
              </div>
            </div>
          </div>

          {/* Before / After allocation */}
          <div style={{
            background: "#13131A", border: "1px solid #1E1E2E",
            borderRadius: 14, padding: "16px 20px",
            display: "flex", flexDirection: "column", gap: 16,
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#E2E8F0" }}>{t("currentAllocation")} vs {t("recommendedAllocation")}</div>
            <AllocationBar label={t("currentAllocation")} allocation={plan.currentAllocation} />
            <AllocationBar label={t("recommendedAllocation")} allocation={plan.recommendedAllocation} />
            <div style={{ display: "flex", gap: 12, fontSize: 10, color: "#334155", flexWrap: "wrap" }}>
              <span style={{ color: "#8B5CF6" }}>■ {t("staking")}</span>
              <span style={{ color: "#10B981" }}>■ {t("deposit")}</span>
              <span style={{ color: "#06B6D4" }}>■ SOL</span>
              <span style={{ color: "#F59E0B" }}>■ USDC</span>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#E2E8F0" }}>
              {t("recommendedAllocation")} ({plan.actions.length})
            </div>
            {plan.actions.map((action, i) => (
              <div key={i} style={{
                background: "#13131A",
                border: `1px solid ${action.color}30`,
                borderRadius: 12, padding: "14px 16px",
                display: "flex", alignItems: "flex-start", gap: 14,
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10,
                  background: `${action.color}20`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 18, flexShrink: 0,
                }}>
                  {action.icon}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: action.color }}>
                      {action.protocol}
                    </span>
                    <span style={{
                      fontSize: 10, color: "#10B981",
                      background: "#10B98115", borderRadius: 4, padding: "1px 6px",
                    }}>
                      {action.expectedAPY.toFixed(1)}% APY
                    </span>
                    <span style={{
                      fontSize: 10,
                      color: action.riskLevel === "低" ? "#10B981" : action.riskLevel === "中" ? "#F59E0B" : "#EF4444",
                    }}>
                      {action.riskLevel} {t("risk")}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: "#E2E8F0", marginBottom: 6 }}>
                    {action.amountDisplay}
                  </div>
                  <div style={{ fontSize: 11, color: "#64748B", lineHeight: 1.5 }}>
                    {action.reasoning}
                  </div>
                </div>
                <button
                  onClick={() => openActionModal(action)}
                  style={{
                    padding: "8px 16px",
                    background: action.color,
                    border: "none", borderRadius: 8,
                    fontSize: 12, fontWeight: 700, color: "#fff",
                    cursor: "pointer", flexShrink: 0, alignSelf: "center",
                  }}
                >
                  {t("execute")}
                </button>
              </div>
            ))}
          </div>

          {/* On-chain proof */}
          <div style={{
            background: "#080B14", border: "1px solid #1E3A5F",
            borderRadius: 12, padding: "14px 16px",
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
          }}>
            <div>
              <div style={{ fontSize: 11, color: "#475569", marginBottom: 4 }}>
                🔐 {t("aiReasoningHash")}
              </div>
              <div style={{ fontSize: 10, color: "#334155", fontFamily: "monospace" }}>
                {plan.memoPayload} · SHA-256: {plan.planHash.slice(0, 20)}...
              </div>
            </div>
            {memoStatus === "done" ? (
              <a href={`https://solscan.io/tx/${memoTx}`} target="_blank" rel="noopener noreferrer"
                style={{
                  fontSize: 11, color: "#10B981", textDecoration: "none",
                  background: "#10B98115", border: "1px solid #10B98130",
                  borderRadius: 8, padding: "6px 12px", whiteSpace: "nowrap",
                }}>
                ✅ {t("submitted")} →
              </a>
            ) : (
              <button
                onClick={submitPlanOnChain}
                disabled={memoStatus === "sending"}
                style={{
                  fontSize: 11, color: "#60A5FA",
                  background: "#1E3A5F20", border: "1px solid #1E3A5F",
                  borderRadius: 8, padding: "6px 14px", cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {memoStatus === "sending" ? t("submitting") : t("submitOnchain")}
              </button>
            )}
          </div>

          {!plan.aiAvailable && (
            <div style={{ fontSize: 10, color: "#334155", textAlign: "center" }}>
              ℹ️ {t("deterministicNote")}
            </div>
          )}
        </>
      )}

      {/* ── Idle state ── */}
      {agentState === "idle" && (
        <div style={{
          background: "#13131A", border: "1px dashed #1E1E2E",
          borderRadius: 14, padding: "40px 24px",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
        }}>
          <div style={{ fontSize: 48 }}>🤖</div>
          <div style={{ fontSize: 14, color: "#E2E8F0", fontWeight: 600 }}>
            {t("runAgent")}
          </div>
          <div style={{ fontSize: 12, color: "#475569", textAlign: "center", maxWidth: 340 }}>
            {t("agentPanelSubtitle")}
          </div>
        </div>
      )}

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-6px); }
        }
      `}</style>

      {swapModal && (
        <SwapModal from={swapModal.from} to={swapModal.to} amount={swapModal.amount} onClose={() => setSwapModal(null)} />
      )}
      {stakeModal && (
        <StakeModal protocol={stakeModal.protocol} amount={stakeModal.amount} onClose={() => setStakeModal(null)} />
      )}
      {lendModal && (
        <LendModal protocol={lendModal.protocol} amount={lendModal.amount} onClose={() => setLendModal(null)} />
      )}
    </div>
  );
}
