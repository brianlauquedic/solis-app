"use client";

import { useState, useEffect, useCallback } from "react";
import { getDeviceId } from "@/lib/device-id";
import { payWithPhantom } from "@/lib/x402";

// ── Types ──────────────────────────────────────────────────────────

type SubscriptionTier = "free" | "basic" | "pro";
type BillingPeriod = "monthly" | "annual";

interface PlanInfo {
  tier: SubscriptionTier;
  label: string;
  priceMonthly: number;
  priceAnnual: number;
  currency: string;
  credits: number;
  features: string[];
  recommended: boolean;
  rollover: number;
  savingsAnnual: number;
}

interface SubscriptionStatus {
  tier: SubscriptionTier;
  active: boolean;
  creditBalance: number;
  monthlyCredits: number;
  rolloverCredits: number;
  daysRemaining: number | null;
  expiresAt: number | null;
  billingPeriod: BillingPeriod | null;
  admin?: boolean;
  plans: PlanInfo[];
  creditCosts: Record<string, number>;
  creditLabels: Record<string, string>;
}

interface Props {
  walletAddress: string | null;
  onSubscriptionChange?: (tier: SubscriptionTier) => void;
}

// ── Fee wallet ────────────────────────────────────────────────────

const SOLIS_FEE_WALLET =
  typeof process !== "undefined"
    ? (process.env.NEXT_PUBLIC_SOLIS_FEE_WALLET ?? "Goc5kAMb9NTXjobxzZogAWaHwajmQjw7CdmATWJN1mQh")
    : "Goc5kAMb9NTXjobxzZogAWaHwajmQjw7CdmATWJN1mQh";

// ── Subscription badge (header shortcut) ──────────────────────────

export function SubscriptionBadge({
  walletAddress,
  onClick,
}: {
  walletAddress: string | null;
  onClick: () => void;
}) {
  const [status, setStatus] = useState<{ tier: SubscriptionTier; credits: number; days: number | null } | null>(null);

  useEffect(() => {
    if (!walletAddress) return;
    fetch("/api/subscription", {
      headers: { "x-wallet-address": walletAddress, "x-device-id": getDeviceId() },
    })
      .then(r => r.json())
      .then((d: SubscriptionStatus) => setStatus({ tier: d.tier, credits: d.creditBalance, days: d.daysRemaining }))
      .catch(() => {});
  }, [walletAddress]);

  const base: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 5,
    padding: "4px 10px", borderRadius: 7, border: "none",
    fontSize: 11, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
    transition: "all 0.15s",
  };

  if (!status || status.tier === "free") {
    return (
      <button onClick={onClick} style={{ ...base, background: "#13131A", border: "1px solid #1E1E2E", color: "#64748B" }}>
        🆓 {status ? `${status.credits}点` : "免费版"} · 升级
      </button>
    );
  }
  if (status.tier === "pro") {
    return (
      <button onClick={onClick} style={{ ...base, background: "#1A0A0015", border: "1px solid #F59E0B60", color: "#F59E0B" }}>
        ⭐ Pro · {status.credits.toLocaleString()}点
        {status.days !== null && ` · ${status.days}天`}
      </button>
    );
  }
  return (
    <button onClick={onClick} style={{ ...base, background: "#0F0A1E15", border: "1px solid #8B5CF660", color: "#8B5CF6" }}>
      🔵 Basic · {status.credits.toLocaleString()}点
      {status.days !== null && ` · ${status.days}天`}
    </button>
  );
}

// ── Credit meter bar ──────────────────────────────────────────────

function CreditMeter({ balance, total, tier }: { balance: number; total: number; tier: SubscriptionTier }) {
  const pct = Math.min(100, (balance / total) * 100);
  const color = tier === "pro" ? "#F59E0B" : tier === "basic" ? "#8B5CF6" : "#64748B";
  const lowCredit = pct < 20;
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: 12 }}>
        <span style={{ color: lowCredit ? "#EF4444" : "#94A3B8" }}>
          {lowCredit ? "⚠️" : "💎"} 剩余点数
        </span>
        <span style={{ color: lowCredit ? "#EF4444" : color, fontWeight: 700 }}>
          {balance.toLocaleString()} / {total.toLocaleString()}
        </span>
      </div>
      <div style={{ height: 6, background: "#1E1E2E", borderRadius: 3, overflow: "hidden" }}>
        <div style={{
          height: "100%", width: `${pct}%`, borderRadius: 3,
          background: lowCredit ? "#EF4444" : color,
          transition: "width 0.5s ease",
        }} />
      </div>
      {lowCredit && (
        <div style={{ fontSize: 10, color: "#EF4444", marginTop: 4 }}>
          点数不足 20%，建议续费或升级以免中断使用
        </div>
      )}
    </div>
  );
}

// ── Main SubscriptionBanner modal ─────────────────────────────────

export default function SubscriptionBanner({ walletAddress, onSubscriptionChange }: Props) {
  const [open, setOpen] = useState(false);
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [activating, setActivating] = useState<"basic" | "pro" | null>(null);
  const [billingPeriod, setBillingPeriod] = useState<BillingPeriod>("monthly");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!walletAddress) return;
    setLoading(true);
    try {
      const res = await fetch("/api/subscription", {
        headers: { "x-wallet-address": walletAddress, "x-device-id": getDeviceId() },
      });
      setStatus(await res.json() as SubscriptionStatus);
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [walletAddress]);

  useEffect(() => { if (open && walletAddress) fetchStatus(); }, [open, walletAddress, fetchStatus]);

  async function handleSubscribe(tier: "basic" | "pro") {
    if (!walletAddress) {
      setMessage({ type: "error", text: "请先连接 Phantom 钱包" });
      return;
    }
    const plan = status?.plans.find(p => p.tier === tier);
    if (!plan) return;

    setActivating(tier);
    setMessage(null);

    try {
      const price = billingPeriod === "annual" ? plan.priceAnnual : plan.priceMonthly;
      const result = await payWithPhantom({
        recipient: SOLIS_FEE_WALLET,
        amount: price,
        currency: "USDC",
        network: "solana-mainnet",
        description: `Sakura ${plan.label} 订阅 $${price} USDC/${billingPeriod === "annual" ? "年" : "月"}`,
      });
      if ("error" in result) throw new Error(result.error);

      const res = await fetch("/api/subscription", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-wallet-address": walletAddress,
          "x-device-id": getDeviceId(),
        },
        body: JSON.stringify({ tier, txSig: result.sig, billingPeriod }),
      });
      const data = await res.json() as { success?: boolean; message?: string; error?: string };

      if (data.success) {
        setMessage({ type: "success", text: data.message ?? "订阅已激活！" });
        await fetchStatus();
        onSubscriptionChange?.(tier);
      } else {
        setMessage({ type: "error", text: data.error ?? "订阅激活失败" });
      }
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "支付失败" });
    } finally {
      setActivating(null);
    }
  }

  const currentTier = status?.tier ?? "free";
  const TIER_COLORS = {
    free:  { bg: "#13131A", border: "#1E1E2E", text: "#94A3B8", accent: "#64748B" },
    basic: { bg: "#0F0A1E", border: "#8B5CF660", text: "#C4B5FD", accent: "#8B5CF6" },
    pro:   { bg: "#1A0E00", border: "#F59E0B60", text: "#FCD34D", accent: "#F59E0B" },
  };

  return (
    <>
      <SubscriptionBadge walletAddress={walletAddress} onClick={() => setOpen(true)} />

      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: "fixed", inset: 0, zIndex: 1000,
            background: "rgba(0,0,0,0.8)", backdropFilter: "blur(8px)",
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "24px 16px",
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: "100%", maxWidth: 900,
              background: "#0A0A0F", border: "1px solid #1E1E2E",
              borderRadius: 20, padding: "40px 36px",
              maxHeight: "92vh", overflowY: "auto",
            }}
          >
            {/* Header */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 28 }}>
              <div>
                <h2 style={{ fontSize: 26, fontWeight: 800, color: "#E2E8F0", margin: 0 }}>
                  Sakura 点数系统
                </h2>
                <p style={{ fontSize: 13, color: "#64748B", marginTop: 6, margin: "6px 0 0" }}>
                  按实际 AI 调用成本计费 · USDC 链上支付 · 30天有效
                </p>
              </div>
              <button onClick={() => setOpen(false)} style={{
                width: 32, height: 32, borderRadius: 8, border: "1px solid #1E1E2E",
                background: "transparent", color: "#64748B", fontSize: 18, cursor: "pointer",
              }}>×</button>
            </div>

            {/* Current subscription credit meter */}
            {status && currentTier !== "free" && (
              <CreditMeter
                balance={status.creditBalance}
                total={status.monthlyCredits}
                tier={currentTier}
              />
            )}

            {/* Credit cost table */}
            <div style={{
              background: "#0D0D14", border: "1px solid #1E1E2E",
              borderRadius: 12, padding: "14px 20px", marginBottom: 24,
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#64748B", marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>
                功能点数消耗
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px 24px" }}>
                {status?.creditCosts && Object.entries(status.creditCosts).map(([feature, cost]) => (
                  <div key={feature} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12 }}>
                    <span style={{ color: "#8B5CF6", fontWeight: 700 }}>{cost} 点</span>
                    <span style={{ color: "#64748B" }}>·</span>
                    <span style={{ color: "#94A3B8" }}>
                      {feature === "advisor_deep" ? "🧠 AI 深度分析 (Sonnet 4.6)" :
                       feature === "advisor"      ? "🤖 AI 对话 (Haiku)" :
                       feature === "analyze"      ? "🔍 安全分析" :
                       feature === "agent"        ? "⚡ Agent 执行" :
                       feature === "portfolio"    ? "📊 组合优化" :
                       feature === "verify"       ? "✅ 链上验证" : feature}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Billing toggle */}
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
              <div style={{
                display: "flex", background: "#13131A",
                border: "1px solid #1E1E2E", borderRadius: 10, padding: 4,
              }}>
                {(["monthly", "annual"] as BillingPeriod[]).map(p => (
                  <button
                    key={p}
                    onClick={() => setBillingPeriod(p)}
                    style={{
                      padding: "6px 16px", borderRadius: 7, border: "none",
                      fontSize: 12, fontWeight: 700, cursor: "pointer",
                      background: billingPeriod === p
                        ? "linear-gradient(135deg, #8B5CF6, #06B6D4)"
                        : "transparent",
                      color: billingPeriod === p ? "#fff" : "#475569",
                      transition: "all 0.15s",
                    }}
                  >
                    {p === "monthly" ? "按月" : "按年"}
                    {p === "annual" && (
                      <span style={{
                        marginLeft: 6, fontSize: 10,
                        background: "#10B98120", color: "#10B981",
                        padding: "1px 5px", borderRadius: 4,
                      }}>省30%</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Message */}
            {message && (
              <div style={{
                padding: "10px 16px", borderRadius: 10, marginBottom: 20,
                background: message.type === "success" ? "#10B98115" : "#EF444415",
                border: `1px solid ${message.type === "success" ? "#10B98140" : "#EF444440"}`,
                fontSize: 13, color: message.type === "success" ? "#10B981" : "#EF4444",
              }}>
                {message.type === "success" ? "✅" : "⚠️"} {message.text}
              </div>
            )}

            {/* Plans grid */}
            {loading ? (
              <div style={{ textAlign: "center", color: "#64748B", padding: 40 }}>加载中...</div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
                {(status?.plans ?? DEFAULT_PLANS).map((plan) => {
                  const colors = TIER_COLORS[plan.tier];
                  const isCurrent = plan.tier === currentTier;
                  const price = billingPeriod === "annual" ? plan.priceAnnual : plan.priceMonthly;
                  const isActivating = activating === plan.tier;

                  return (
                    <div key={plan.tier} style={{
                      background: colors.bg,
                      border: `1px solid ${isCurrent ? colors.accent : colors.border}`,
                      borderRadius: 16, padding: "28px 22px",
                      position: "relative",
                    }}>
                      {plan.recommended && !isCurrent && (
                        <div style={{
                          position: "absolute", top: -12, left: "50%",
                          transform: "translateX(-50%)",
                          background: "linear-gradient(135deg, #8B5CF6, #06B6D4)",
                          color: "#fff", fontSize: 10, fontWeight: 700,
                          padding: "3px 14px", borderRadius: 20, whiteSpace: "nowrap",
                        }}>推荐</div>
                      )}
                      {isCurrent && plan.tier !== "free" && (
                        <div style={{
                          position: "absolute", top: -12, left: "50%",
                          transform: "translateX(-50%)",
                          background: colors.accent, color: "#000",
                          fontSize: 10, fontWeight: 700,
                          padding: "3px 14px", borderRadius: 20, whiteSpace: "nowrap",
                        }}>当前计划</div>
                      )}

                      {/* Plan name */}
                      <div style={{ fontSize: 18, fontWeight: 800, color: colors.text, marginBottom: 14 }}>
                        {plan.tier === "pro" ? "⭐ Pro" : plan.tier === "basic" ? "🔵 Basic" : "🆓 Free"}
                      </div>

                      {/* Price */}
                      <div style={{ marginBottom: 18 }}>
                        {plan.priceMonthly === 0 ? (
                          <span style={{ fontSize: 32, fontWeight: 900, color: "#E2E8F0" }}>免费</span>
                        ) : (
                          <>
                            <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                              <span style={{ fontSize: 32, fontWeight: 900, color: colors.text }}>
                                ${billingPeriod === "annual"
                                  ? (plan.priceAnnual / 12).toFixed(1)
                                  : plan.priceMonthly}
                              </span>
                              <span style={{ fontSize: 12, color: "#64748B" }}>USDC/月</span>
                            </div>
                            {billingPeriod === "annual" && plan.priceAnnual > 0 && (
                              <div style={{ fontSize: 11, color: "#10B981", marginTop: 2 }}>
                                按年付 ${plan.priceAnnual} · 省 ${plan.savingsAnnual}
                              </div>
                            )}
                          </>
                        )}
                      </div>

                      {/* Credits */}
                      <div style={{
                        background: "#0D0D14", border: "1px solid #1E1E2E",
                        borderRadius: 10, padding: "10px 14px", marginBottom: 18,
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 11, color: "#64748B" }}>月点数</span>
                          <span style={{ fontSize: 22, fontWeight: 900, color: colors.accent }}>
                            {plan.credits.toLocaleString()}
                          </span>
                        </div>
                        {plan.rollover > 0 && (
                          <div style={{ fontSize: 10, color: "#10B981", marginTop: 4 }}>
                            + 最多结转 {plan.rollover.toLocaleString()} 点到下月
                          </div>
                        )}
                        {plan.credits === 100 && (
                          <div style={{ fontSize: 10, color: "#64748B", marginTop: 4 }}>
                            ≈ 1次AI顾问 / 10次安全分析
                          </div>
                        )}
                        {plan.credits === 1500 && (
                          <div style={{ fontSize: 10, color: "#8B5CF660", marginTop: 4 }}>
                            ≈ 50次对话 / 18次深度分析 / 150次安全分析
                          </div>
                        )}
                        {plan.credits === 6000 && (
                          <div style={{ fontSize: 10, color: "#F59E0B60", marginTop: 4 }}>
                            ≈ 200次对话 / 75次深度分析 / 600次安全分析
                          </div>
                        )}
                      </div>

                      {/* Features */}
                      <ul style={{ listStyle: "none", padding: 0, margin: "0 0 22px 0", display: "flex", flexDirection: "column", gap: 7 }}>
                        {plan.features.map((f, i) => (
                          <li key={i} style={{ display: "flex", gap: 7, fontSize: 12, color: "#94A3B8" }}>
                            <span style={{ color: colors.accent, flexShrink: 0 }}>✓</span>
                            {f}
                          </li>
                        ))}
                      </ul>

                      {/* CTA */}
                      {plan.tier === "free" ? (
                        <button disabled style={{
                          width: "100%", padding: "10px 0", borderRadius: 10,
                          border: "1px solid #1E1E2E", background: "transparent",
                          color: "#475569", fontSize: 13, fontWeight: 600, cursor: "default",
                        }}>当前计划</button>
                      ) : isCurrent ? (
                        <button disabled style={{
                          width: "100%", padding: "10px 0", borderRadius: 10,
                          border: `1px solid ${colors.accent}`,
                          background: `${colors.accent}20`,
                          color: colors.text, fontSize: 13, fontWeight: 700, cursor: "default",
                        }}>✅ 已订阅</button>
                      ) : (
                        <button
                          onClick={() => handleSubscribe(plan.tier as "basic" | "pro")}
                          disabled={!!activating}
                          style={{
                            width: "100%", padding: "10px 0", borderRadius: 10, border: "none",
                            background: isActivating ? "#1E1E2E"
                              : plan.tier === "pro"
                                ? "linear-gradient(135deg, #F59E0B, #EF4444)"
                                : "linear-gradient(135deg, #8B5CF6, #06B6D4)",
                            color: isActivating ? "#64748B" : "#fff",
                            fontSize: 13, fontWeight: 700,
                            cursor: activating ? "not-allowed" : "pointer",
                          }}
                        >
                          {isActivating
                            ? "支付中..."
                            : `订阅 · $${price} USDC/${billingPeriod === "annual" ? "年" : "月"}`}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Footer */}
            <div style={{
              marginTop: 24, padding: "14px 20px",
              background: "#0D0D14", border: "1px solid #1E1E2E", borderRadius: 12,
              display: "flex", gap: 12, alignItems: "flex-start",
            }}>
              <span style={{ fontSize: 18 }}>🔒</span>
              <div style={{ fontSize: 11, color: "#64748B", lineHeight: 1.6 }}>
                <strong style={{ color: "#94A3B8" }}>链上支付，完全透明。</strong>{" "}
                订阅费通过 Phantom 直接发送至 Sakura 费用钱包（USDC on Solana）。
                点数按实际 AI API 成本设计：深度分析（Sonnet 4.6 + 扩展思考）80 点，
                简单对话（Haiku）30 点，安全分析 10 点。Basic 可结转 500 点，无绑定、随时停止。
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ── Default plans fallback ─────────────────────────────────────────

const DEFAULT_PLANS: PlanInfo[] = [
  {
    tier: "free", label: "Free", priceMonthly: 0, priceAnnual: 0,
    currency: "USDC", credits: 100, rollover: 0, savingsAnnual: 0,
    features: ["100 点/月", "1次AI顾问 / 10次安全分析", "体验全部功能"],
    recommended: false,
  },
  {
    tier: "basic", label: "Basic", priceMonthly: 8, priceAnnual: 67,
    currency: "USDC", credits: 1500, rollover: 500, savingsAnnual: 29,
    features: ["1,500 点/月 + 结转500点", "~50次AI对话 / ~18次深度分析", "智能钱包追踪 + MCP 工具", "Guardian 借贷健康监控"],
    recommended: true,
  },
  {
    tier: "pro", label: "Pro", priceMonthly: 28, priceAnnual: 235,
    currency: "USDC", credits: 6000, rollover: 2000, savingsAnnual: 101,
    features: ["6,000 点/月 + 结转2,000", "~75次AI顾问 / ~600次安全分析", "MCP API 无限访问", "最高优先级响应"],
    recommended: false,
  },
];
