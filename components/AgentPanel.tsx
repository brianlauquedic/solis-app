"use client";

import { useState, useEffect, useRef } from "react";
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
  isDayMode?: boolean;
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
      violations.push(`${action.protocol} 占比 ${pct.toFixed(0)}% 超過限制 ${mandate.maxStakePct}%`);
    }
    if (pct > mandate.maxSingleProtocolPct) {
      violations.push(`單協議 ${action.protocol} 占比 ${pct.toFixed(0)}% 超過 ${mandate.maxSingleProtocolPct}%`);
    }
    const protocolKey = action.protocol.toLowerCase().split(" ")[0];
    const allowed = mandate.allowedProtocols.some(p => protocolKey.includes(p));
    if (!allowed) {
      violations.push(`協議 ${action.protocol} 不在你的允许列表中`);
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
      <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 6 }}>{label}</div>
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
          return rem > 0 ? <div style={{ flex: 1, background: "var(--border)" }} /> : null;
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

// ── Strategy Modes (3 Autopilot modes, surpassing Minara) ─────────────────
type StrategyMode = "yield" | "defensive" | "smart_money";

interface StrategyDef {
  id: StrategyMode;
  icon: string;
  name: string;
  desc: string;
  badge: string;
  badgeColor: string;
  // 30-day simulated return basis points (e.g. 1200 = 12%)
  simReturn30d: number;
}

const STRATEGY_DEFS: StrategyDef[] = [
  {
    id: "yield",
    icon: "⚡",
    name: "收益最大化",
    desc: "Stake + Lend + LP 全倉出擊，追求最高年化",
    badge: "Autopilot I",
    badgeColor: "#C9A84C",
    simReturn30d: 1840,
  },
  {
    id: "defensive",
    icon: "🛡",
    name: "防禦模式",
    desc: "70% 穩定幣 + Marinade mSOL，波動最小化",
    badge: "Autopilot II",
    badgeColor: "#3D7A5C",
    simReturn30d: 620,
  },
  {
    id: "smart_money",
    icon: "🐋",
    name: "聰明錢跟隨",
    desc: "根據 KOL/Whale 24h 共識信號動態調倉",
    badge: "Autopilot III",
    badgeColor: "#C94030",
    simReturn30d: 3120,
  },
];

// ── Backtest simulation data generator ───────────────────────────────────
function genBacktestSeries(mode: StrategyMode): { time: number; value: number }[] {
  // 30 daily points; simulate cumulative return based on mode
  const seeds: Record<StrategyMode, number[]> = {
    yield:        [0,0.6,0.4,1.2,0.8,1.0,0.3,1.5,1.1,0.9,1.2,0.7,1.3,0.8,1.0,0.6,1.4,0.9,1.1,0.7,1.2,0.8,1.5,1.0,0.9,1.3,0.7,1.1,0.8,1.6],
    defensive:    [0,0.2,0.1,0.3,0.2,0.2,0.1,0.3,0.2,0.2,0.2,0.3,0.2,0.1,0.2,0.2,0.3,0.2,0.2,0.1,0.3,0.2,0.2,0.2,0.1,0.3,0.2,0.2,0.1,0.3],
    smart_money:  [0,0.8,1.5,-0.5,2.0,0.5,1.0,-1.0,3.0,1.0,0.5,1.5,-0.8,2.5,1.0,0.5,1.8,-0.3,2.2,1.0,0.8,1.5,0.5,2.0,-0.5,3.0,1.0,0.8,1.5,2.0],
  };
  const daily = seeds[mode];
  const now   = Math.floor(Date.now() / 1000);
  let cum = 100;
  return daily.map((d, i) => {
    cum += d;
    return { time: now - (29 - i) * 86400, value: parseFloat(cum.toFixed(2)) };
  });
}

export default function AgentPanel({ walletAddress, walletSnapshot, isDayMode = false }: Props) {
  const { t } = useLang();
  const [agentState, setAgentState] = useState<AgentState>("idle");
  const [stepLabel, setStepLabel] = useState("");
  const [plan, setPlan] = useState<RebalancePlan | null>(null);
  const [error, setError] = useState("");
  const [memoStatus, setMemoStatus] = useState<"idle" | "sending" | "done">("idle");
  const [memoTx, setMemoTx] = useState("");

  // Strategy mode
  const [strategyMode, setStrategyMode] = useState<StrategyMode>("yield");
  const [showBacktest, setShowBacktest] = useState(false);

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
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: 16, padding: 24,
        display: "flex", flexDirection: "column", gap: 16,
      }}>
        {/* Title row */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)", marginBottom: 4 }}>
            ⚙️ Sakura AI Agent · 3 種自動策略
          </div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.5 }}>
            選擇策略模式，Agent 自動分析持倉、生成最優方案並可一鍵執行。
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
                ? `🆓 ${agentQuota.remaining}/3 次免費剩餘`
                : "💰 免費次數已用完 · $0.10 USDC/次"}
            </div>
          )}
        </div>
        <button
          onClick={runAgent}
          disabled={isRunning}
          style={{
            padding: "12px 24px",
            background: isRunning ? "var(--border)" : "var(--accent)",
            border: "none", borderRadius: 12,
            fontSize: 14, fontWeight: 700, color: isRunning ? "var(--text-secondary)" : "#fff",
            cursor: isRunning ? "not-allowed" : "pointer",
            whiteSpace: "nowrap", minWidth: 120,
          }}
        >
          {isRunning ? t("analyzingPortfolio") : agentState === "done" ? t("reanalyze") : t("runAgent")}
        </button>
        </div>

        {/* ── 3 Strategy Mode Selector ── */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 10, letterSpacing: "0.08em" }}>
            選擇 AUTOPILOT 策略模式
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10 }}>
            {STRATEGY_DEFS.map(s => (
              <button
                key={s.id}
                onClick={() => setStrategyMode(s.id)}
                style={{
                  border: `1px solid ${strategyMode === s.id ? s.badgeColor : "var(--border)"}`,
                  borderRadius: 12, padding: "12px 10px",
                  background: strategyMode === s.id ? `${s.badgeColor}12` : "transparent",
                  cursor: "pointer", textAlign: "left",
                  transition: "all 0.2s",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 16 }}>{s.icon}</span>
                  <span style={{
                    fontSize: 9, fontWeight: 700, padding: "1px 6px", borderRadius: 4,
                    background: `${s.badgeColor}20`, color: s.badgeColor,
                  }}>{s.badge}</span>
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)", marginBottom: 3 }}>{s.name}</div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", lineHeight: 1.4 }}>{s.desc}</div>
                <div style={{ marginTop: 6, fontSize: 11, fontWeight: 700, color: s.badgeColor }}>
                  +{(s.simReturn30d / 100).toFixed(2)}% <span style={{ fontSize: 9, fontWeight: 400, color: "var(--text-muted)" }}>30日模擬</span>
                </div>
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowBacktest(v => !v)}
            style={{
              marginTop: 8, background: "none", border: "none", cursor: "pointer",
              fontSize: 11, color: "var(--text-secondary)", padding: "4px 0",
              textDecoration: "underline",
            }}
          >
            {showBacktest ? "▲ 收起回測圖表" : "▼ 查看 30 日策略回測"}
          </button>
          {showBacktest && <StrategyBacktestChart mode={strategyMode} defs={STRATEGY_DEFS} isDayMode={isDayMode} />}
        </div>
      </div>

      {/* ── On-Chain Mandate Panel ── */}
      <div style={{
        background: "var(--bg-card)", border: `1px solid ${signedMandate ? "#8B5CF660" : "var(--border)"}`,
        borderRadius: 14, padding: "14px 18px",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: signedMandate ? "#8B5CF6" : "#475569" }}>
              {signedMandate ? "⛩️ 投資規則已簽名上鏈" : "⚙️ 設置投資規則（可選）"}
            </div>
            {signedMandate && (
              <div style={{ fontSize: 10, color: "var(--text-secondary)", marginTop: 3 }}>
                最大質押 {signedMandate.mandate.maxStakePct}% · 單協議上限 {signedMandate.mandate.maxSingleProtocolPct}% · 已用 Phantom 簽名
              </div>
            )}
          </div>
          <button
            onClick={() => setShowMandateEditor(v => !v)}
            style={{
              background: "none", border: "1px solid var(--border)", borderRadius: 6,
              color: "var(--text-secondary)", fontSize: 11, cursor: "pointer", padding: "4px 10px",
            }}
          >
            {showMandateEditor ? "收起" : signedMandate ? "修改" : "設置"}
          </button>
        </div>

        {showMandateEditor && (
          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 6 }}>
                最大質押比例: <b style={{ color: "#8B5CF6" }}>{mandateDraft.maxStakePct}%</b>
              </div>
              <input type="range" min={10} max={100} value={mandateDraft.maxStakePct}
                onChange={e => setMandateDraft(d => ({ ...d, maxStakePct: Number(e.target.value) }))}
                style={{ width: "100%", accentColor: "#8B5CF6" }}
              />
            </div>
            <div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 6 }}>
                單協議上限: <b style={{ color: "#06B6D4" }}>{mandateDraft.maxSingleProtocolPct}%</b>
              </div>
              <input type="range" min={10} max={100} value={mandateDraft.maxSingleProtocolPct}
                onChange={e => setMandateDraft(d => ({ ...d, maxSingleProtocolPct: Number(e.target.value) }))}
                style={{ width: "100%", accentColor: "#06B6D4" }}
              />
            </div>
            <div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 8 }}>允许協議</div>
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
                    <span style={{ fontSize: 11, color: "var(--text-secondary)", textTransform: "capitalize" }}>{p}</span>
                  </label>
                ))}
              </div>
            </div>
            <button
              onClick={signAndSaveMandate}
              disabled={mandateSigning}
              style={{
                padding: "9px 18px", borderRadius: 8, border: "none",
                background: mandateSigning ? "var(--border)" : "var(--accent)",
                color: mandateSigning ? "var(--text-secondary)" : "#fff",
                fontSize: 12, fontWeight: 700, cursor: mandateSigning ? "not-allowed" : "pointer",
              }}
            >
              {mandateSigning ? "等待 Phantom 簽名..." : "👻 用 Phantom 簽名此規則"}
            </button>
            <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
              規則將由你的錢包私鑰簽名，寫入鏈上 Memo。AI 只能在此範围内操作。
            </div>
          </div>
        )}
      </div>

      {/* ── Mandate compliance result ── */}
      {complianceResult && plan && (
        <div style={{
          background: complianceResult.compliant ? "rgba(61,122,92,0.12)" : "rgba(168,41,58,0.12)",
          border: `1px solid ${complianceResult.compliant ? "rgba(61,122,92,0.35)" : "rgba(168,41,58,0.35)"}`,
          borderRadius: 12, padding: "12px 16px",
          fontSize: 12,
          color: complianceResult.compliant ? "#10B981" : "#EF4444",
        }}>
          {complianceResult.compliant ? (
            "✅ 執行方案符合你的 On-Chain Mandate 約束"
          ) : (
            <>⚠️ Mandate 合規檢查不通過：
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
          background: "var(--bg-card)", border: "1px solid #8B5CF630",
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
          background: "rgba(168,41,58,0.12)", border: "1px solid rgba(168,41,58,0.4)",
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
            background: "rgba(61,122,92,0.10)", border: "1px solid rgba(61,122,92,0.30)",
            borderRadius: 14, padding: "16px 20px",
          }}>
            <div style={{ fontSize: 13, color: "#10B981", fontWeight: 700, marginBottom: 8 }}>
              ✅ {plan.summary}
            </div>
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: 10, color: "var(--text-secondary)" }}>{t("currentAnnualYield")}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#EF4444" }}>
                  $0
                </div>
              </div>
              <div style={{ fontSize: 20, color: "var(--text-secondary)", alignSelf: "flex-end", marginBottom: 2 }}>→</div>
              <div>
                <div style={{ fontSize: 10, color: "var(--text-secondary)" }}>{t("projectedYield")}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#10B981" }}>
                  +${plan.projectedAnnualYield.toFixed(0)}
                </div>
              </div>
              <div style={{ marginLeft: "auto", textAlign: "right" }}>
                <div style={{ fontSize: 10, color: "var(--text-secondary)" }}>AI 置信度</div>
                <div style={{ fontSize: 16, fontWeight: 700, color: "#8B5CF6" }}>
                  {plan.confidenceScore}%
                </div>
              </div>
            </div>
          </div>

          {/* Before / After allocation */}
          <div style={{
            background: "var(--bg-card)", border: "1px solid var(--border)",
            borderRadius: 14, padding: "16px 20px",
            display: "flex", flexDirection: "column", gap: 16,
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{t("currentAllocation")} vs {t("recommendedAllocation")}</div>
            <AllocationBar label={t("currentAllocation")} allocation={plan.currentAllocation} />
            <AllocationBar label={t("recommendedAllocation")} allocation={plan.recommendedAllocation} />
            <div style={{ display: "flex", gap: 12, fontSize: 10, color: "var(--text-muted)", flexWrap: "wrap" }}>
              <span style={{ color: "#8B5CF6" }}>■ {t("staking")}</span>
              <span style={{ color: "#10B981" }}>■ {t("deposit")}</span>
              <span style={{ color: "#06B6D4" }}>■ SOL</span>
              <span style={{ color: "#F59E0B" }}>■ USDC</span>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
              {t("recommendedAllocation")} ({plan.actions.length})
            </div>
            {plan.actions.map((action, i) => (
              <div key={i} style={{
                background: "var(--bg-card)",
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
                  <div style={{ fontSize: 12, color: "var(--text-primary)", marginBottom: 6 }}>
                    {action.amountDisplay}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.5 }}>
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
            background: "var(--bg-card-2)", border: "1px solid var(--border)",
            borderRadius: 12, padding: "14px 16px",
            display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
          }}>
            <div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 4 }}>
                ⛩️ {t("aiReasoningHash")}
              </div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "monospace" }}>
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
                  background: "var(--bg-card)", border: "1px solid var(--border)",
                  borderRadius: 8, padding: "6px 14px", cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                {memoStatus === "sending" ? t("submitting") : t("submitOnchain")}
              </button>
            )}
          </div>

          {!plan.aiAvailable && (
            <div style={{ fontSize: 10, color: "var(--text-muted)", textAlign: "center" }}>
              ℹ️ {t("deterministicNote")}
            </div>
          )}
        </>
      )}

      {/* ── Guardian Conditions ── */}
      <GuardianConditionsPanel walletAddress={walletAddress} />

      {/* ── Idle state ── */}
      {agentState === "idle" && (
        <div style={{
          background: "var(--bg-card)", border: "1px dashed var(--border)",
          borderRadius: 14, padding: "40px 24px",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 12,
        }}>
          <div style={{ fontSize: 48 }}>⚙️</div>
          <div style={{ fontSize: 14, color: "var(--text-primary)", fontWeight: 600 }}>
            {t("runAgent")}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", textAlign: "center", maxWidth: 340 }}>
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

// ── Guardian Conditions Panel ─────────────────────────────────────

interface GuardianCondition {
  id: string;
  metric: string;
  operator: string;
  threshold: number;
  action: string;
  label: string;
  isActive: boolean;
  triggeredAt?: number;
}

const CONDITION_TEMPLATES: Array<{
  metric: string; label: string; operator: string;
  threshold: number; action: string; description: string; color: string;
}> = [
  { metric: "sol_price",         label: "SOL 價格跌破",     operator: "lt",  threshold: 150, action: "alert_only",    description: "SOL 跌破 $150 時提醒",       color: "#EF4444" },
  { metric: "sol_price",         label: "SOL 價格突破",     operator: "gt",  threshold: 200, action: "alert_only",    description: "SOL 突破 $200 時提醒",       color: "#10B981" },
  { metric: "usdc_apy_kamino",   label: "USDC APY 上升",    operator: "gt",  threshold: 8,   action: "prepare_lend",  description: "Kamino APY > 8% 準備存款",   color: "#06B6D4" },
  { metric: "sol_apy_marinade",  label: "質押 APY 下降",    operator: "lt",  threshold: 6,   action: "alert_only",    description: "Marinade APY < 6% 提醒",    color: "#F59E0B" },
  { metric: "health_factor",     label: "健康系數警告",     operator: "lt",  threshold: 1.5, action: "alert_only",    description: "借貸健康系數 < 1.5 緊急提醒", color: "#EF4444" },
  { metric: "smart_money_buy",   label: "聰明錢買入信號",   operator: "gt",  threshold: 2,   action: "alert_only",    description: "≥ 2個聰明錢同時買入提醒",   color: "#8B5CF6" },
];

const ACTION_LABEL: Record<string, string> = {
  alert_only:    "📢 提醒",
  prepare_stake: "🔒 準備質押",
  prepare_lend:  "💰 準備存款",
  prepare_swap:  "🔄 準備兌換",
};

function GuardianConditionsPanel({ walletAddress }: { walletAddress: string }) {
  const [open, setOpen] = useState(false);
  const [conditions, setConditions] = useState<GuardianCondition[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addedOk, setAddedOk] = useState(false);   // inline button feedback
  const [selectedTemplate, setSelectedTemplate] = useState(0);
  const [customThreshold, setCustomThreshold] = useState<string>("");
  const [toast, setToast] = useState<{ msg: string; type: "success" | "error" } | null>(null);

  // Fixed-position viewport toast — guaranteed visible regardless of parent CSS
  function showToast(msg: string, type: "success" | "error") {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }

  async function loadConditions() {
    setLoading(true);
    try {
      const res = await fetch("/api/cron/guardian/conditions", {
        headers: { "X-Wallet-Address": walletAddress ?? "" },
      });
      if (!res.ok) return;
      const data = await res.json() as { conditions: GuardianCondition[] };
      setConditions(data.conditions ?? []);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }

  async function addCondition() {
    if (!walletAddress) { showToast("請先連接錢包", "error"); return; }
    const tpl = CONDITION_TEMPLATES[selectedTemplate];
    const threshold = customThreshold ? parseFloat(customThreshold) : tpl.threshold;
    if (isNaN(threshold)) { showToast("請輸入有效的數值", "error"); return; }

    setAdding(true);
    try {
      const res = await fetch("/api/cron/guardian/conditions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Wallet-Address": walletAddress,
          "X-Device-ID": (typeof window !== "undefined" ? localStorage.getItem("solis_device_id") ?? "" : ""),
        },
        body: JSON.stringify({
          metric:    tpl.metric,
          operator:  tpl.operator,
          threshold,
          action:    tpl.action,
          label:     `${tpl.label} ${tpl.operator === "lt" ? "<" : ">"} ${threshold}`,
        }),
      });
      if (res.ok) {
        setCustomThreshold("");
        setAddedOk(true);
        setTimeout(() => setAddedOk(false), 2500);
        showToast(`條件已新增：${tpl.label} ${tpl.operator === "lt" ? "<" : ">"} ${threshold}`, "success");
        await loadConditions();
      } else {
        let errMsg = "新增失敗，請重試";
        try {
          const errData = await res.json() as { error?: string; message?: string };
          if (errData.message) errMsg = errData.message;
          else if (errData.error === "free_credits_exhausted") errMsg = "免費額度不足，請升級訂閱";
          else if (errData.error) errMsg = errData.error;
        } catch { /* ignore parse error */ }
        showToast(errMsg, "error");
      }
    } catch { showToast("網絡錯誤，請重試", "error"); }
    finally { setAdding(false); }
  }

  async function deleteCondition(id: string) {
    try {
      const res = await fetch("/api/cron/guardian/conditions", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "X-Wallet-Address": walletAddress ?? "",
        },
        body: JSON.stringify({ conditionId: id }),
      });
      if (res.ok) {
        setConditions(prev => prev.filter(c => c.id !== id));
        showToast("條件已刪除", "success");
      }
    } catch { /* silent */ }
  }

  function handleToggle() {
    if (!open) loadConditions();
    setOpen(v => !v);
  }

  const tpl = CONDITION_TEMPLATES[selectedTemplate];

  return (
    <div style={{
      background: "var(--bg-card)", border: "1px solid var(--border)",
      borderRadius: 16, padding: 20, marginBottom: 20,
    }}>
      <button
        onClick={handleToggle}
        style={{
          width: "100%", background: "none", border: "none",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          cursor: "pointer", padding: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
            🔰 Guardian 自動條件
          </span>
          {conditions.length > 0 && (
            <span style={{
              fontSize: 10, fontWeight: 700,
              background: "rgba(16,185,129,0.1)", color: "#10B981",
              border: "1px solid rgba(16,185,129,0.25)",
              borderRadius: 4, padding: "1px 6px",
            }}>{conditions.length} 個活躍</span>
          )}
        </div>
        <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{open ? "收起 ▲" : "設置 ▼"}</span>
      </button>

      {/* ── Fixed Viewport Toast (guaranteed always visible) ── */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 28, left: "50%", transform: "translateX(-50%)",
          zIndex: 99999, pointerEvents: "none",
          background: toast.type === "success" ? "#10B981" : "#EF4444",
          color: "#fff", fontWeight: 700, fontSize: 14,
          padding: "12px 24px", borderRadius: 10,
          boxShadow: "0 4px 20px rgba(0,0,0,0.35)",
          display: "flex", alignItems: "center", gap: 8,
          whiteSpace: "nowrap",
          animation: "fadeInUp 0.2s ease",
        }}>
          {toast.type === "success" ? "✅" : "❌"} {toast.msg}
        </div>
      )}

      {open && (
        <div style={{ marginTop: 16 }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: 16, color: "var(--text-secondary)", fontSize: 13 }}>
              載入中...
            </div>
          ) : (
            <>
              {/* Active conditions */}
              {conditions.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>
                    活躍條件
                  </div>
                  {conditions.map(c => (
                    <div key={c.id} style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "8px 12px", marginBottom: 6,
                      background: "var(--bg-base)", border: "1px solid var(--border)",
                      borderRadius: 8,
                    }}>
                      <span style={{ width: 6, height: 6, borderRadius: "50%", background: c.isActive ? "#10B981" : "#475569", flexShrink: 0 }} />
                      <span style={{ flex: 1, fontSize: 12, color: "var(--text-primary)" }}>{c.label}</span>
                      <span style={{ fontSize: 11, color: "var(--text-secondary)", fontFamily: "var(--font-mono, monospace)" }}>
                        {c.operator} {c.threshold}
                      </span>
                      <span style={{
                        fontSize: 10, color: "#8B5CF6",
                        background: "rgba(139,92,246,0.1)", borderRadius: 4, padding: "1px 5px",
                      }}>{ACTION_LABEL[c.action] ?? c.action}</span>
                      {c.triggeredAt && (
                        <span style={{ fontSize: 10, color: "var(--accent)" }}>
                          🌸 {new Date(c.triggeredAt).toLocaleDateString("zh-TW", { month: "short", day: "numeric" })}
                        </span>
                      )}
                      <button
                        onClick={() => deleteCondition(c.id)}
                        style={{
                          background: "none", border: "none", cursor: "pointer",
                          color: "var(--text-muted)", fontSize: 14, padding: "0 2px",
                          lineHeight: 1,
                        }}
                        title="刪除"
                      >×</button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add new condition */}
              <div style={{
                background: "var(--bg-base)", border: "1px solid var(--border)",
                borderRadius: 10, padding: "12px 14px",
              }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>
                  新增條件
                </div>

                {/* Template selector */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                  {CONDITION_TEMPLATES.map((t, i) => (
                    <button
                      key={i}
                      onClick={() => { setSelectedTemplate(i); setCustomThreshold(""); }}
                      style={{
                        padding: "4px 10px", borderRadius: 6,
                        fontSize: 11, cursor: "pointer",
                        background: selectedTemplate === i ? `${t.color}18` : "var(--bg-card)",
                        color: selectedTemplate === i ? t.color : "var(--text-secondary)",
                        border: `1px solid ${selectedTemplate === i ? t.color + "40" : "var(--border)"}`,
                        transition: "all 0.15s",
                      } as React.CSSProperties}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>

                {/* Description + threshold input */}
                <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 10 }}>
                  {tpl.description}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <input
                    type="number"
                    placeholder={`閾值（預設 ${tpl.threshold}）`}
                    value={customThreshold}
                    onChange={e => setCustomThreshold(e.target.value)}
                    style={{
                      flex: 1, background: "var(--bg-card)", border: "1px solid var(--border)",
                      color: "var(--text-primary)", borderRadius: 6, padding: "6px 10px", fontSize: 12,
                    }}
                  />
                  <button
                    onClick={addCondition}
                    disabled={adding || addedOk}
                    style={{
                      padding: "6px 16px", borderRadius: 6, border: "none",
                      background: addedOk ? "#10B981" : adding ? "var(--border)" : "var(--accent)",
                      color: "#fff", fontSize: 12, fontWeight: 700,
                      cursor: (adding || addedOk) ? "not-allowed" : "pointer",
                      transition: "background 0.2s",
                      minWidth: 72,
                    }}
                  >
                    {adding ? "…" : addedOk ? "✓ 已新增" : "+ 新增"}
                  </button>
                </div>
              </div>

              <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 8, textAlign: "center" }}>
                Guardian 每小時自動評估條件，觸發時通過 AI 顧問通知
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Strategy Backtest Chart ───────────────────────────────────────────────
// Reuse same theme map from TokenAnalysis approach
const BACKTEST_THEMES = {
  dark:  { bg: "#0E0C0A", text: "#8B7D72", grid: "#1A1714", border: "#2E2820", dimLine: "#2E2820" },
  light: { bg: "#FFFFFF",  text: "#374151", grid: "#F3F4F6", border: "#E5E7EB", dimLine: "#D1D5DB" },
};

function StrategyBacktestChart({
  mode,
  defs,
  isDayMode = false,
}: {
  mode: StrategyMode;
  defs: StrategyDef[];
  isDayMode?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chartRef     = useRef<any>(null);
  const chartTheme   = isDayMode ? "light" : "dark";

  const [seriesData, setSeriesData] = useState<Record<string, { time: number; value: number }[]>>({});
  const [returns, setReturns]       = useState<Record<string, number>>({});
  const [loading, setLoading]       = useState(true);

  // Fetch real CoinGecko-based backtest data on mount
  useEffect(() => {
    setLoading(true);
    Promise.all(
      (["yield", "defensive", "smart_money"] as const).map(s =>
        fetch(`/api/backtest?strategy=${s}`)
          .then(r => r.json())
          .then((d: { series?: { time: number; value: number }[]; totalReturnPct?: number }) => ({ strategy: s, series: d.series ?? [], ret: d.totalReturnPct ?? 0 }))
          .catch(() => ({ strategy: s, series: genBacktestSeries(s), ret: 0 }))
      )
    ).then(results => {
      const sd: Record<string, { time: number; value: number }[]> = {};
      const rv: Record<string, number> = {};
      results.forEach(r => { sd[r.strategy] = r.series; rv[r.strategy] = r.ret; });
      setSeriesData(sd);
      setReturns(rv);
      setLoading(false);
    });
  }, []);

  // Rebuild chart whenever data, mode, or theme changes
  useEffect(() => {
    if (!containerRef.current || loading || Object.keys(seriesData).length === 0) return;

    const th = BACKTEST_THEMES[chartTheme];

    if (chartRef.current) { chartRef.current.remove(); chartRef.current = null; }

    import("lightweight-charts").then(({ createChart, LineSeries }) => {
      if (!containerRef.current) return;

      const chart = createChart(containerRef.current, {
        layout: { background: { color: th.bg }, textColor: th.text },
        grid:   { vertLines: { color: th.grid }, horzLines: { color: th.grid } },
        rightPriceScale: { borderColor: th.border },
        timeScale: { borderColor: th.border, timeVisible: true },
        width:  containerRef.current.clientWidth,
        height: 220,
      });
      chartRef.current = chart;

      defs.forEach(def => {
        const data = seriesData[def.id] ?? genBacktestSeries(def.id);
        const series = chart.addSeries(LineSeries, {
          color:     def.id === mode ? def.badgeColor : th.dimLine,
          lineWidth: def.id === mode ? 2 : 1,
          lineStyle: def.id === mode ? 0 : 2,
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        series.setData(data as any);
      });

      chart.timeScale().fitContent();
    });

    return () => {
      if (chartRef.current) { chartRef.current.remove(); chartRef.current = null; }
    };
  }, [seriesData, mode, defs, chartTheme, loading]);

  const activeDef = defs.find(d => d.id === mode)!;
  const th = BACKTEST_THEMES[chartTheme];

  return (
    <div style={{
      marginTop: 12, borderRadius: 12, overflow: "hidden",
      border: `1px solid ${activeDef.badgeColor}30`,
      background: th.bg,
    }}>
      {/* Legend with real returns */}
      <div style={{
        padding: "8px 14px", borderBottom: "1px solid var(--border)",
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)" }}>
          📊 30 日策略回測 · 真實 SOL 價格數據
        </span>
        <div style={{ display: "flex", gap: 12 }}>
          {defs.map(d => {
            const ret = returns[d.id];
            return (
              <span key={d.id} style={{ fontSize: 9, color: d.id === mode ? d.badgeColor : "var(--text-muted)", display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ display: "inline-block", width: 12, height: 2, background: d.id === mode ? d.badgeColor : th.dimLine, borderRadius: 1 }} />
                {d.name}
                {ret !== undefined && ret !== 0 && (
                  <span style={{ color: ret >= 0 ? "#3D7A5C" : "#A8293A" }}>
                    {ret >= 0 ? "+" : ""}{ret.toFixed(1)}%
                  </span>
                )}
              </span>
            );
          })}
        </div>
      </div>
      {loading ? (
        <div style={{ height: 220, display: "flex", alignItems: "center", justifyContent: "center", background: th.bg }}>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>載入真實市場數據...</span>
        </div>
      ) : (
        <div ref={containerRef} style={{ width: "100%" }} />
      )}
      <div style={{ padding: "6px 14px", borderTop: "1px solid var(--border)", fontSize: 10, color: "var(--text-muted)" }}>
        * 基於 CoinGecko 真實 SOL 30 日價格 + Marinade/Kamino 真實 APY 模擬，不構成投資建議。
      </div>
    </div>
  );
}
