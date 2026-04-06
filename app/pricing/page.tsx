"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { getDeviceId } from "@/lib/device-id";
import { payWithPhantom } from "@/lib/x402";
import { useLang } from "@/contexts/LanguageContext";
import type { Lang } from "@/lib/i18n";

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
  daysRemaining: number | null;
  plans: PlanInfo[];
  creditCosts: Record<string, number>;
}

const SOLIS_FEE_WALLET = "Goc5kAMb9NTXjobxzZogAWaHwajmQjw7CdmATWJN1mQh";

function getDefaultPlans(lang: Lang): PlanInfo[] {
  const e = lang === "en", j = lang === "ja";
  return [
    {
      tier: "free", label: "Free", priceMonthly: 0, priceAnnual: 0,
      currency: "USDC", credits: 100, rollover: 0, savingsAnnual: 0,
      features: e ? [
        "100 Credits / month",
        "1× AI Deep Analysis",
        "10× Security Scans",
        "Try all features",
      ] : j ? [
        "100 クレジット / 月",
        "1× AI 深度分析",
        "10× セキュリティ分析",
        "全機能を体験",
      ] : [
        "100 點 / 月",
        "1 次 AI 深度顧問",
        "10 次安全分析",
        "體驗全部功能",
      ],
      recommended: false,
    },
    {
      tier: "basic", label: "Basic", priceMonthly: 8, priceAnnual: 67,
      currency: "USDC", credits: 1500, rollover: 500, savingsAnnual: 29,
      features: e ? [
        "1,500 Credits / month",
        "Roll over up to 500 credits",
        "~50× AI conversations",
        "~18× AI deep analysis",
        "Smart money tracking",
        "Guardian lending monitor",
      ] : j ? [
        "1,500 クレジット / 月",
        "最大500クレジット繰越",
        "~50× AI 会話",
        "~18× AI 深度分析",
        "スマートマネー追跡",
        "Guardian 融資モニター",
      ] : [
        "1,500 點 / 月",
        "結轉最多 500 點到下月",
        "~50 次 AI 對話",
        "~18 次 AI 深度分析",
        "聰明錢追蹤",
        "Guardian 借貸監控",
      ],
      recommended: true,
    },
    {
      tier: "pro", label: "Pro", priceMonthly: 28, priceAnnual: 235,
      currency: "USDC", credits: 6000, rollover: 2000, savingsAnnual: 101,
      features: e ? [
        "6,000 Credits / month",
        "Roll over up to 2,000 credits",
        "~200× AI conversations",
        "~75× AI deep analysis",
        "~600× Security scans",
        "Unlimited MCP API access",
        "Highest priority responses",
      ] : j ? [
        "6,000 クレジット / 月",
        "最大2,000クレジット繰越",
        "~200× AI 会話",
        "~75× AI 深度分析",
        "~600× セキュリティ分析",
        "MCP API 無制限アクセス",
        "最高優先度レスポンス",
      ] : [
        "6,000 點 / 月",
        "結轉最多 2,000 點到下月",
        "~200 次 AI 對話",
        "~75 次 AI 深度分析",
        "~600 次安全分析",
        "MCP API 無限存取",
        "最高優先級回應",
      ],
      recommended: false,
    },
  ];
}

function getCreditCosts(lang: Lang) {
  const e = lang === "en", j = lang === "ja";
  return [
    { icon: "🌿", label: e ? "AI Deep Analysis (Sonnet 4.6)" : j ? "AI 深度分析 (Sonnet 4.6)" : "AI 深度分析 (Sonnet 4.6)", cost: 80, feature: "advisor_deep" },
    { icon: "💬", label: e ? "AI Chat (Haiku)" : j ? "AI 会話 (Haiku)" : "AI 對話 (Haiku)", cost: 30, feature: "advisor" },
    { icon: "🔰", label: e ? "Security Scan" : j ? "セキュリティ分析" : "安全分析", cost: 10, feature: "analyze" },
    { icon: "⚙️", label: e ? "Agent Execution" : j ? "Agent 実行" : "Agent 執行", cost: 20, feature: "agent" },
    { icon: "🌸", label: e ? "Portfolio Optimize" : j ? "ポートフォリオ最適化" : "組合優化", cost: 15, feature: "portfolio" },
    { icon: "⛩️", label: e ? "On-chain Verify" : j ? "オンチェーン検証" : "鏈上驗證", cost: 5, feature: "verify" },
  ];
}

export default function PricingPage() {
  return <PricingInner />;
}

function PricingInner() {
  const router = useRouter();
  const { lang, setLang } = useLang();
  const [billing, setBilling] = useState<BillingPeriod>("monthly");
  const [planType, setPlanType] = useState<"personal" | "enterprise">("personal");
  const [status, setStatus] = useState<SubscriptionStatus | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [activating, setActivating] = useState<SubscriptionTier | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  useEffect(() => {
    const saved = localStorage.getItem("sakura_wallet");
    if (saved) setWalletAddress(saved);
  }, []);

  const fetchStatus = useCallback(async () => {
    if (!walletAddress) return;
    try {
      const res = await fetch("/api/subscription", {
        headers: { "x-wallet-address": walletAddress, "x-device-id": getDeviceId() },
      });
      setStatus(await res.json() as SubscriptionStatus);
    } catch { /* silent */ }
  }, [walletAddress]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  async function handleSubscribe(tier: "basic" | "pro") {
    if (!walletAddress) {
      setMessage({ type: "error", text: tx("請先連接 Phantom 錢包", "Please connect your Phantom wallet first", "Phantomウォレットを先に接続してください") });
      return;
    }
    const plan = (status?.plans ?? DEFAULT_PLANS).find(p => p.tier === tier);
    if (!plan) return;

    setActivating(tier);
    setMessage(null);

    try {
      const price = billing === "annual" ? plan.priceAnnual : plan.priceMonthly;
      const result = await payWithPhantom({
        recipient: SOLIS_FEE_WALLET,
        amount: price,
        currency: "USDC",
        network: "solana-mainnet",
        description: `Sakura ${plan.label} 訂閱 $${price} USDC/${billing === "annual" ? "年" : "月"}`,
      });
      if ("error" in result) throw new Error(result.error);

      const res = await fetch("/api/subscription", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-wallet-address": walletAddress,
          "x-device-id": getDeviceId(),
        },
        body: JSON.stringify({ tier, txSig: result.sig, billingPeriod: billing }),
      });
      const data = await res.json() as { success?: boolean; message?: string; error?: string };

      if (data.success) {
        setMessage({ type: "success", text: data.message ?? "訂閱已啟用！" });
        await fetchStatus();
        setTimeout(() => router.push("/"), 2000);
      } else {
        setMessage({ type: "error", text: data.error ?? "訂閱啟用失敗" });
      }
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "支付失敗" });
    } finally {
      setActivating(null);
    }
  }

  const DEFAULT_PLANS = getDefaultPlans(lang);
  const CREDIT_COSTS = getCreditCosts(lang);
  const plans = DEFAULT_PLANS;
  const currentTier = status?.tier ?? "free";

  const tx = (zh: string, en: string, ja: string) =>
    lang === "en" ? en : lang === "ja" ? ja : zh;

  const TIER_STYLE = {
    free:  { accent: "var(--text-secondary)", border: "var(--border)", bg: "var(--bg-card)", badge: "" },
    basic: { accent: "#8B5CF6", border: "rgba(139,92,246,0.35)", bg: "rgba(139,92,246,0.06)", badge: "🔵" },
    pro:   { accent: "#F59E0B", border: "rgba(245,158,11,0.35)", bg: "rgba(245,158,11,0.06)", badge: "🪷" },
  };

  const savingsPct = billing === "annual" ? 30 : 0;

  return (
    <>
      {/* ── Main Content ────────────────────────────────────────────── */}
      <main style={{ maxWidth: 1080, margin: "0 auto", padding: "40px 24px 80px", minHeight: "100vh", background: "var(--bg-base)", color: "var(--text-primary)" }}>

        {/* Title */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <h1 style={{
            fontSize: 56, fontWeight: 300,
            fontFamily: "var(--font-heading, 'Noto Serif JP', serif)",
            letterSpacing: "0.05em",
            color: "var(--text-primary)",
            margin: "0 0 24px",
          }}>{tx("定價", "Pricing", "料金")}</h1>

          {/* Plan type tabs */}
          <div style={{
            display: "inline-flex",
            background: "var(--bg-card)",
            border: "1px solid var(--border)",
            borderRadius: 10, padding: 4, gap: 2,
          }}>
            {(["personal", "enterprise"] as const).map(t => (
              <button
                key={t}
                onClick={() => setPlanType(t)}
                style={{
                  padding: "6px 22px", borderRadius: 7, border: "none",
                  fontSize: 13, fontWeight: 600, cursor: "pointer",
                  background: planType === t ? "var(--bg-base)" : "transparent",
                  color: planType === t ? "var(--text-primary)" : "var(--text-muted)",
                  boxShadow: planType === t ? "0 1px 3px rgba(0,0,0,0.15)" : "none",
                  transition: "all 0.15s",
                }}
              >
                {t === "personal" ? tx("個人", "Personal", "個人") : tx("企業", "Enterprise", "エンタープライズ")}
              </button>
            ))}
          </div>
        </div>

        {planType === "enterprise" ? (
          /* ── Enterprise placeholder ─────────────────────────────── */
          <div style={{
            textAlign: "center", padding: "80px 40px",
            background: "var(--bg-card)", border: "1px solid var(--border)",
            borderRadius: 20,
          }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⛩️</div>
            <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 12 }}>{tx("企業方案", "Enterprise Plan", "エンタープライズプラン")}</h2>
            <p style={{ fontSize: 15, color: "var(--text-secondary)", maxWidth: 480, margin: "0 auto 28px" }}>
              {tx("需要更大配額、私有部署或 API 整合？歡迎洽談企業定制方案。", "Need higher quotas, private deployment, or API integration? Contact us about enterprise pricing.", "大容量クォータ、プライベートデプロイ、またはAPI統合が必要ですか？エンタープライズプランについてお問い合わせください。")}
            </p>
            <button
              onClick={() => window.open("https://t.me/mmm0113mmm0113", "_blank")}
              style={{
                padding: "12px 32px", borderRadius: 10,
                background: "var(--accent)", border: "none",
                color: "#fff", fontSize: 14, fontWeight: 700, cursor: "pointer",
              }}
            >✈️ {tx("Telegram 聯繫我們", "Contact us on Telegram", "Telegramでお問い合わせ")}</button>
          </div>
        ) : (
          <>
            {/* ── Billing toggle ────────────────────────────────────── */}
            <div style={{ display: "flex", justifyContent: "center", marginBottom: 36 }}>
              <div style={{
                display: "flex", alignItems: "center", gap: 12,
                background: "var(--bg-card)",
                border: "1px solid var(--border)",
                borderRadius: 40, padding: "6px 20px",
              }}>
                <span style={{
                  fontSize: 13, fontWeight: billing === "monthly" ? 700 : 400,
                  color: billing === "monthly" ? "var(--text-primary)" : "var(--text-secondary)",
                  cursor: "pointer",
                }} onClick={() => setBilling("monthly")}>{tx("按月支付", "Monthly", "月払い")}</span>

                {/* Toggle switch */}
                <div
                  onClick={() => setBilling(b => b === "monthly" ? "annual" : "monthly")}
                  style={{
                    width: 44, height: 24, borderRadius: 12,
                    background: billing === "annual" ? "var(--accent)" : "var(--border)",
                    position: "relative", cursor: "pointer",
                    transition: "background 0.2s",
                  }}
                >
                  <div style={{
                    position: "absolute", top: 3,
                    left: billing === "annual" ? 23 : 3,
                    width: 18, height: 18, borderRadius: "50%",
                    background: "#fff",
                    transition: "left 0.2s",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
                  }} />
                </div>

                <span style={{
                  fontSize: 13, fontWeight: billing === "annual" ? 700 : 400,
                  color: billing === "annual" ? "var(--text-primary)" : "var(--text-secondary)",
                  cursor: "pointer",
                }} onClick={() => setBilling("annual")}>{tx("按年支付", "Annual", "年払い")}</span>

                {billing === "annual" && (
                  <span style={{
                    fontSize: 11, fontWeight: 700,
                    background: "rgba(16,185,129,0.12)",
                    color: "#10B981",
                    border: "1px solid rgba(16,185,129,0.3)",
                    borderRadius: 20, padding: "2px 8px",
                    whiteSpace: "nowrap",
                  }}>{tx("節省", "Save", "節約")} {savingsPct}%</span>
                )}
              </div>
            </div>

            {/* ── Message ───────────────────────────────────────────── */}
            {message && (
              <div style={{
                maxWidth: 600, margin: "0 auto 24px",
                padding: "12px 20px", borderRadius: 10,
                background: message.type === "success" ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
                border: `1px solid ${message.type === "success" ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`,
                fontSize: 13, textAlign: "center",
                color: message.type === "success" ? "#10B981" : "#EF4444",
              }}>
                {message.type === "success" ? "🌸" : "⚠️"} {message.text}
              </div>
            )}

            {/* ── Plans grid ───────────────────────────────────────── */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: 20,
              marginBottom: 48,
            }}>
              {plans.map(plan => {
                const style = TIER_STYLE[plan.tier];
                const isCurrent = plan.tier === currentTier;
                const price = billing === "annual" ? plan.priceAnnual : plan.priceMonthly;
                const monthlyEquiv = billing === "annual" && plan.priceAnnual > 0
                  ? (plan.priceAnnual / 12).toFixed(1)
                  : plan.priceMonthly.toString();
                const isActivating = activating === plan.tier;

                return (
                  <div key={plan.tier} style={{
                    background: isCurrent ? style.bg : "var(--bg-card)",
                    border: `1px solid ${isCurrent ? style.accent : style.border}`,
                    borderRadius: 18,
                    padding: "32px 28px",
                    position: "relative",
                    transition: "border-color 0.2s",
                  }}>
                    {/* Badge */}
                    {plan.recommended && !isCurrent && (
                      <div style={{
                        position: "absolute", top: -13, left: "50%",
                        transform: "translateX(-50%)",
                        background: "var(--accent)",
                        color: "#fff", fontSize: 11, fontWeight: 700,
                        padding: "3px 16px", borderRadius: 20, whiteSpace: "nowrap",
                      }}>{tx("推薦", "Recommended", "おすすめ")}</div>
                    )}
                    {isCurrent && plan.tier !== "free" && (
                      <div style={{
                        position: "absolute", top: -13, left: "50%",
                        transform: "translateX(-50%)",
                        background: style.accent, color: "#000",
                        fontSize: 11, fontWeight: 700,
                        padding: "3px 16px", borderRadius: 20, whiteSpace: "nowrap",
                      }}>{tx("當前方案", "Current Plan", "現在のプラン")}</div>
                    )}

                    {/* Plan name */}
                    <div style={{
                      fontSize: 20, fontWeight: 700,
                      color: style.accent !== "var(--text-secondary)" ? style.accent : "var(--text-primary)",
                      marginBottom: 4, display: "flex", alignItems: "center", gap: 6,
                    }}>
                      {style.badge && <span>{style.badge}</span>}
                      {plan.label}
                      {isCurrent && (
                        <span style={{
                          fontSize: 10, background: `${style.accent}20`,
                          color: style.accent, border: `1px solid ${style.accent}40`,
                          borderRadius: 4, padding: "1px 6px", fontWeight: 600,
                        }}>{tx("使用中", "Active", "使用中")}</span>
                      )}
                    </div>

                    {/* Price */}
                    <div style={{ marginBottom: 6 }}>
                      {plan.priceMonthly === 0 ? (
                        <div style={{ fontSize: 40, fontWeight: 800, color: "var(--text-primary)" }}>{tx("免費", "Free", "無料")}</div>
                      ) : (
                        <>
                          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
                            <span style={{ fontSize: 44, fontWeight: 800, color: "var(--text-primary)" }}>
                              ${monthlyEquiv}
                            </span>
                            <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>{tx("每月", "/ mo", "/ 月")}</span>
                          </div>
                          {billing === "annual" && (
                            <div style={{
                              fontSize: 11, color: "#10B981", marginTop: 2,
                              display: "flex", alignItems: "center", gap: 6,
                            }}>
                              <span style={{
                                display: "inline-flex", alignItems: "center",
                                background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)",
                                borderRadius: 12, padding: "1px 8px",
                              }}>{tx("按年支付", "Billed annually", "年払い")} ${plan.priceAnnual} · {tx("節省", "Save", "節約")} {savingsPct}%</span>
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {/* CTA button */}
                    <button
                      onClick={() => {
                        if (plan.tier === "free" || isCurrent) return;
                        handleSubscribe(plan.tier as "basic" | "pro");
                      }}
                      disabled={plan.tier === "free" || isCurrent || !!activating}
                      style={{
                        width: "100%", padding: "12px 0",
                        borderRadius: 10, border: "none",
                        marginBottom: 24,
                        fontSize: 14, fontWeight: 700,
                        cursor: plan.tier === "free" || isCurrent ? "default" : "pointer",
                        background: isCurrent || plan.tier === "free"
                          ? "var(--bg-base)"
                          : isActivating
                            ? "var(--border)"
                            : plan.tier === "pro"
                              ? "#F59E0B"
                              : "var(--accent)",
                        color: isCurrent || plan.tier === "free"
                          ? "var(--text-secondary)"
                          : "#fff",
                        outline: isCurrent || plan.tier === "free"
                          ? "1px solid var(--border)"
                          : "none",
                        transition: "all 0.15s",
                      } as React.CSSProperties}
                    >
                      {isCurrent
                        ? `🌸 ${tx("當前方案", "Current Plan", "現在のプラン")}`
                        : plan.tier === "free"
                          ? tx("免費開始", "Get Started Free", "無料で始める")
                          : isActivating
                            ? tx("支付中...", "Processing...", "処理中...")
                            : `${tx("訂閱", "Subscribe", "登録")} ${plan.label} · $${price} USDC`}
                    </button>

                    {/* Divider */}
                    <div style={{ height: 1, background: "var(--border)", marginBottom: 20 }} />

                    {/* Credits highlight */}
                    <div style={{ marginBottom: 16 }}>
                      <span style={{
                        fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
                        fontSize: 22, fontWeight: 700,
                        color: style.accent !== "var(--text-secondary)" ? style.accent : "var(--text-primary)",
                      }}>
                        {plan.credits.toLocaleString()} {tx("點", "Credits", "クレジット")}
                      </span>
                      <span style={{ fontSize: 12, color: "var(--text-secondary)", marginLeft: 6 }}>/{tx("月", "mo", "月")}</span>
                      {plan.rollover > 0 && (
                        <div style={{ fontSize: 11, color: "#10B981", marginTop: 3 }}>
                          ＋ {tx(`可結轉最多 ${plan.rollover.toLocaleString()} 點`, `Roll over up to ${plan.rollover.toLocaleString()} credits`, `最大${plan.rollover.toLocaleString()}クレジット繰越`)}
                        </div>
                      )}
                    </div>

                    {/* Features */}
                    <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 9 }}>
                      {plan.features.map((f, i) => (
                        <li key={i} style={{ display: "flex", gap: 8, fontSize: 13, color: "var(--text-secondary)", alignItems: "flex-start" }}>
                          <span style={{
                            color: style.accent !== "var(--text-secondary)" ? style.accent : "#10B981",
                            flexShrink: 0, marginTop: 1,
                          }}>✓</span>
                          {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>

            {/* ── Credit Cost Table ─────────────────────────────────── */}
            <div style={{
              background: "var(--bg-card)", border: "1px solid var(--border)",
              borderRadius: 16, padding: "28px 32px", marginBottom: 32,
            }}>
              <h3 style={{
                fontSize: 16, fontWeight: 700, margin: "0 0 20px",
                color: "var(--text-primary)",
              }}>{tx("功能點數消耗", "Credit Cost per Feature", "機能別クレジット消費")}</h3>
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: 12,
              }}>
                {CREDIT_COSTS.map(item => (
                  <div key={item.feature} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "10px 14px",
                    background: "var(--bg-base)",
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                  }}>
                    <span style={{ fontSize: 18 }}>{item.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{item.label}</div>
                    </div>
                    <span style={{
                      fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
                      fontSize: 16, fontWeight: 700,
                      color: "var(--accent)",
                    }}>{item.cost}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Trust footer ─────────────────────────────────────── */}
            <div style={{
              background: "var(--bg-card)", border: "1px solid var(--border)",
              borderRadius: 16, padding: "20px 28px",
              display: "flex", gap: 16, alignItems: "flex-start",
            }}>
              <span style={{ fontSize: 24, flexShrink: 0 }}>⛩️</span>
              <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.7 }}>
                <strong style={{ color: "var(--text-primary)" }}>{tx("鏈上支付，完全透明。", "On-chain payments, fully transparent.", "オンチェーン決済、完全透明。")}</strong>
                {" "}{tx(
                  "訂閱費透過 Phantom 直接發送至 Sakura 費用錢包（USDC on Solana）。點數按實際 AI API 成本設計，無綁定、隨時取消、按月自動結算。Basic 方案可結轉 500 點，Pro 方案可結轉 2,000 點到下月。",
                  "Subscription fees are sent directly to Sakura's fee wallet via Phantom (USDC on Solana). Credits are priced at actual AI API cost — no lock-in, cancel anytime, billed monthly. Basic rolls over 500 credits; Pro rolls over 2,000 credits to the next month.",
                  "サブスクリプション料金はPhantomを通じてSakuraの手数料ウォレットに直接送付されます（USDC on Solana）。クレジットは実際のAI APIコストに基づき設計されており、ロックインなし、いつでもキャンセル可能、月次自動決済。Basicは500クレジット、Proは2,000クレジットを翌月に繰り越せます。"
                )}
              </div>
            </div>
          </>
        )}
      </main>
    </>
  );
}
