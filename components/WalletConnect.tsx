"use client";

import AnimatedNumber from "@/components/AnimatedNumber";
import { useLang } from "@/contexts/LanguageContext";

const AGENT_KEYS = [
  { tag: "Security Agent", titleKey: "agent1Title" as const, descKey: "agent1Desc" as const, icon: "🛡️", color: "#10B981" },
  { tag: "Portfolio Agent", titleKey: "agent2Title" as const, descKey: "agent2Desc" as const, icon: "📊", color: "#8B5CF6" },
  { tag: "Advisor Agent",  titleKey: "agent3Title" as const, descKey: "agent3Desc" as const, icon: "💬", color: "#06B6D4" },
  { tag: "Rebalance Agent",titleKey: "agent4Title" as const, descKey: "agent4Desc" as const, icon: "🤖", color: "#F59E0B" },
];

const PROTOCOLS = [
  { name: "Jupiter",          color: "#06B6D4" },
  { name: "Marinade",         color: "#10B981" },
  { name: "Jito",             color: "#F59E0B" },
  { name: "Kamino",           color: "#8B5CF6" },
  { name: "GoPlus Security",  color: "#EF4444" },
  { name: "Helius RPC",       color: "#9945FF" },
  { name: "Solana Agent Kit", color: "#06B6D4" },
  { name: "Claude AI",        color: "#CC785C" },
  { name: "Stripe MPP",       color: "#635BFF" },
];

const STATS = [
  { numValue: 5,   suffix: "",        labelKey: "statLabel1" as const },
  { numValue: 4,   suffix: "",        labelKey: "statLabel2" as const },
  { numValue: 8.2, suffix: "%",       labelKey: "statLabel3" as const },
  { numValue: 100, suffix: "%",       labelKey: "statLabel4" as const },
];

export default function WalletConnect() {
  const { t } = useLang();

  return (
    <div style={{ maxWidth: 800, margin: "0 auto" }}>

      {/* ── Hero ── */}
      <div style={{ textAlign: "center", marginBottom: 52 }}>

        {/* Badge */}
        <div className="fade-in-up fade-in-up-1" style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          background: "#8B5CF610", border: "1px solid #8B5CF640",
          borderRadius: 20, padding: "6px 14px", marginBottom: 24,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10B981", display: "inline-block" }} />
          <span style={{ fontSize: 11, color: "#8B5CF6", fontWeight: 700, letterSpacing: 0.5 }}>
            {t("hackathonBadge")}
          </span>
        </div>

        {/* Logo */}
        <div style={{
          width: 68, height: 68, borderRadius: 18, margin: "0 auto 20px",
          background: "linear-gradient(135deg, #8B5CF6, #06B6D4)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 30, fontWeight: 900, color: "#fff",
          boxShadow: "0 0 40px #8B5CF640",
        }}>S</div>

        <h1 className="fade-in-up fade-in-up-1" style={{
          fontSize: 48, fontWeight: 900, color: "#fff",
          lineHeight: 1.1, marginBottom: 10, letterSpacing: -1.5,
        }}>
          <span style={{ background: "linear-gradient(135deg, #8B5CF6, #06B6D4)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            Solis
          </span>
        </h1>

        <div className="fade-in-up fade-in-up-1" style={{
          fontSize: 18, fontWeight: 700, color: "#94A3B8", marginBottom: 16, letterSpacing: -0.3,
        }}>
          {t("heroTagline")}
        </div>

        <p className="fade-in-up fade-in-up-2" style={{
          fontSize: 14, color: "#475569", maxWidth: 520, margin: "0 auto 32px", lineHeight: 1.8,
        }}>
          {t("heroSubtitle")}
        </p>

        {/* Trust signals */}
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap", marginBottom: 32 }}>
          {(["trust1", "trust2", "trust3", "trust4"] as const).map(k => (
            <span key={k} style={{
              fontSize: 11, color: "#475569",
              background: "#13131A", border: "1px solid #1E1E2E",
              borderRadius: 20, padding: "4px 12px",
            }}>{t(k)}</span>
          ))}
        </div>

        {/* ── Primary CTA ── */}
        <div style={{
          background: "linear-gradient(135deg, #8B5CF615, #06B6D415)",
          border: "1px solid #8B5CF640",
          borderRadius: 20, padding: "28px 32px",
          marginBottom: 52, maxWidth: 480, margin: "0 auto 52px",
        }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: "#E2E8F0", marginBottom: 8 }}>
            {t("ctaFreeLabel")}
          </div>
          <div style={{ fontSize: 12, color: "#64748B", lineHeight: 1.7, marginBottom: 20 }}>
            {t("ctaFreeDesc")}
          </div>
          {/* Free tier pills */}
          <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginBottom: 20 }}>
            {[
              { label: "3× 安全分析", color: "#10B981" },
              { label: "3× AI 顧問", color: "#8B5CF6" },
              { label: "3× Agent 再平衡", color: "#F59E0B" },
            ].map(pill => (
              <span key={pill.label} style={{
                fontSize: 11, fontWeight: 700,
                color: pill.color, background: `${pill.color}18`,
                border: `1px solid ${pill.color}35`,
                borderRadius: 20, padding: "4px 12px",
              }}>✓ {pill.label}</span>
            ))}
          </div>
          {/* The actual connect button is rendered by the parent (app/page.tsx) —
              this section just signals users visually what they get for free */}
          <div style={{
            background: "linear-gradient(135deg, #8B5CF6, #06B6D4)",
            borderRadius: 12, padding: "12px 24px",
            fontSize: 14, fontWeight: 800, color: "#fff",
            cursor: "default", letterSpacing: 0.3,
            boxShadow: "0 4px 20px #8B5CF640",
          }}>
            {t("ctaFreeBtn")}
          </div>
          <div style={{ fontSize: 10, color: "#334155", marginTop: 10 }}>
            {t("ctaSubNote")}
          </div>
        </div>
      </div>

      {/* ── 4 Agent Cards ── */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 11, color: "#475569", fontWeight: 700, letterSpacing: 1, marginBottom: 16, textTransform: "uppercase" }}>
          {t("agentsTitle")}
        </div>
        <div className="feature-grid" style={{
          display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12,
        }}>
          {AGENT_KEYS.map(a => (
            <div key={a.tag} style={{
              background: "#13131A", border: "1px solid #1E1E2E",
              borderRadius: 16, padding: "18px 20px",
              borderLeft: `3px solid ${a.color}`,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 22 }}>{a.icon}</span>
                <span style={{
                  fontSize: 9, fontWeight: 800, letterSpacing: 1,
                  color: a.color, background: `${a.color}15`,
                  border: `1px solid ${a.color}30`,
                  borderRadius: 4, padding: "2px 6px",
                }}>{a.tag}</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#E2E8F0", marginBottom: 6 }}>{t(a.titleKey)}</div>
              <div style={{ fontSize: 11, color: "#475569", lineHeight: 1.7 }}>{t(a.descKey)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Differentiator ── */}
      <div style={{
        background: "linear-gradient(135deg, #8B5CF608, #06B6D408)",
        border: "1px solid #8B5CF620",
        borderRadius: 14, padding: "16px 20px", marginBottom: 16, marginTop: 20,
        display: "flex", alignItems: "flex-start", gap: 14,
      }}>
        <span style={{ fontSize: 20, flexShrink: 0 }}>⛓️</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#E2E8F0", marginBottom: 4 }}>
            {t("diffTitle")}
          </div>
          <div style={{ fontSize: 12, color: "#64748B", lineHeight: 1.7 }}>
            {t("diffDesc")}
          </div>
        </div>
      </div>

      {/* ── Stripe MPP Section ── */}
      <div style={{
        background: "linear-gradient(135deg, #635BFF0A, #06B6D408)",
        border: "1px solid #635BFF35",
        borderRadius: 14, padding: "18px 20px", marginBottom: 16,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          {/* Stripe logo mark */}
          <div style={{
            width: 28, height: 28, borderRadius: 8, flexShrink: 0,
            background: "#635BFF", display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: 14, fontWeight: 900, color: "#fff",
          }}>S</div>
          <div style={{ fontSize: 13, fontWeight: 800, color: "#E2E8F0" }}>
            {t("stripeSectionTitle")}
          </div>
        </div>
        <div style={{ fontSize: 12, color: "#64748B", lineHeight: 1.75, marginBottom: 12 }}>
          {t("stripeSectionDesc")}
        </div>
        {/* Three feature pills */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {(["stripeFeature1", "stripeFeature2", "stripeFeature3"] as const).map(k => (
            <div key={k} style={{
              fontSize: 11, fontWeight: 600, color: "#A78BFA",
              background: "#635BFF10", border: "1px solid #635BFF25",
              borderRadius: 8, padding: "5px 10px",
            }}>{t(k)}</div>
          ))}
        </div>
        {/* MCP endpoint hint */}
        <div style={{
          marginTop: 12, fontSize: 10, fontFamily: "monospace",
          color: "#334155", background: "#0A0A0F",
          border: "1px solid #1E1E2E", borderRadius: 6, padding: "6px 10px",
        }}>
          POST /api/mcp · HTTP 402 · x402-payment: USDC · Solana Mainnet
        </div>
      </div>

      {/* ── Stats row ── */}
      <div className="stats-grid" style={{
        display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
        gap: 1, background: "#1E1E2E", borderRadius: 14,
        overflow: "hidden", marginBottom: 20,
      }}>
        {STATS.map(s => (
          <div key={s.labelKey} style={{ background: "#0D0D14", padding: "16px 0", textAlign: "center" }}>
            <div style={{ fontSize: 18, fontWeight: 800 }}>
              <AnimatedNumber
                value={s.numValue}
                suffix={s.suffix}
                decimals={s.numValue % 1 !== 0 ? 1 : 0}
                duration={1400}
                style={{
                  background: "linear-gradient(135deg, #8B5CF6, #06B6D4)",
                  WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                }}
              />
            </div>
            <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>{t(s.labelKey)}</div>
          </div>
        ))}
      </div>

      {/* ── Protocol ecosystem ── */}
      <div style={{
        background: "#0D0D14", border: "1px solid #1E1E2E",
        borderRadius: 14, padding: "14px 20px", marginBottom: 16,
      }}>
        <div style={{ fontSize: 10, color: "#334155", fontWeight: 700, letterSpacing: 1, marginBottom: 10, textTransform: "uppercase" }}>
          {t("integratedProtocols")}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {PROTOCOLS.map(e => (
            <span key={e.name} style={{
              fontSize: 11, fontWeight: 700, color: e.color,
              background: `${e.color}12`, border: `1px solid ${e.color}25`,
              borderRadius: 6, padding: "3px 10px",
            }}>{e.name}</span>
          ))}
        </div>
      </div>

      <div style={{ textAlign: "center", fontSize: 11, color: "#1E3A5F" }}>
        {t("footerText")}
      </div>
    </div>
  );
}

