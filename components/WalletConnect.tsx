"use client";

import AnimatedNumber from "@/components/AnimatedNumber";
import { useLang } from "@/contexts/LanguageContext";
import WaBijinSVG from "@/components/WaBijinSVG";
import { useWallet } from "@/contexts/WalletContext";

const AGENT_KEYS = [
  { tag: "Security Agent",  titleKey: "agent1Title" as const, descKey: "agent1Desc" as const, icon: "護", color: "var(--green)" },
  { tag: "Portfolio Agent", titleKey: "agent2Title" as const, descKey: "agent2Desc" as const, icon: "覧", color: "var(--gold)" },
  { tag: "Advisor Agent",   titleKey: "agent3Title" as const, descKey: "agent3Desc" as const, icon: "智", color: "var(--accent)" },
  { tag: "Rebalance Agent", titleKey: "agent4Title" as const, descKey: "agent4Desc" as const, icon: "衡", color: "var(--orange)" },
];

const PROTOCOLS = [
  "Jupiter", "Marinade", "Jito", "Kamino",
  "GoPlus Security", "Helius RPC", "Solana Agent Kit", "Claude AI", "Stripe MPP",
];

const STATS = [
  { numValue: 5,   suffix: "",  labelKey: "statLabel1" as const },
  { numValue: 4,   suffix: "",  labelKey: "statLabel2" as const },
  { numValue: 8.2, suffix: "%", labelKey: "statLabel3" as const },
  { numValue: 100, suffix: "%", labelKey: "statLabel4" as const },
];

interface Props {
  walletAddress?: string | null;
  onEnterApp?: () => void;
}

export default function WalletConnect({ walletAddress, onEnterApp }: Props = {}) {
  const { t, lang } = useLang();
  const { connect, phantomAvailable, okxAvailable, walletLoading } = useWallet();

  return (
    <div style={{ maxWidth: 760, margin: "0 auto" }}>

      {/* ── 題字 Hero ── */}
      <div style={{ textAlign: "center", marginBottom: 56 }}>

        {/* 勲章 Badge */}
        <div className="fade-in-up fade-in-up-1" style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          background: "var(--accent-soft)", border: "1px solid var(--accent-mid)",
          borderRadius: 20, padding: "5px 14px", marginBottom: 28,
        }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--accent)", display: "inline-block" }} />
          <span style={{ fontSize: 11, color: "var(--accent)", fontWeight: 500, letterSpacing: 1.5, fontFamily: "var(--font-mono)" }}>
            {t("hackathonBadge")}
          </span>
        </div>

        {/* 和美人 Wa-bijin Logo — traditional Japanese beauty portrait */}
        <div className="hero-logo" style={{
          width: 150, height: 200, margin: "0 auto 8px",
        }}>
          <WaBijinSVG size={150} height={200} />
        </div>

        {/* 題字 Title — Mincho heading */}
        <h1 className="jp-heading fade-in-up fade-in-up-1 hero-title" style={{
          fontSize: 46, fontWeight: 300, color: "var(--text-primary)",
          lineHeight: 1.15, marginBottom: 8, letterSpacing: "0.08em",
        }}>
          Sakura
        </h1>

        <div className="fade-in-up fade-in-up-1" style={{
          fontSize: 13, fontWeight: 400, color: "var(--accent)", marginBottom: 14,
          letterSpacing: "0.25em", fontFamily: "var(--font-heading)",
        }}>
          {t("heroTagline")}
        </div>

        <p className="fade-in-up fade-in-up-2" style={{
          fontSize: 13, color: "var(--text-secondary)", maxWidth: 480,
          margin: "0 auto 28px", lineHeight: 2.0, letterSpacing: "0.02em",
        }}>
          {t("heroSubtitle")}
        </p>

        {/* 信頼の証 Trust signals */}
        <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginBottom: 32 }}>
          {(["trust1", "trust2", "trust3", "trust4"] as const).map(k => (
            <span key={k} style={{
              fontSize: 11, color: "var(--text-secondary)",
              background: "var(--bg-card)", border: "1px solid var(--border)",
              borderRadius: 20, padding: "4px 12px", letterSpacing: "0.03em",
            }}>{t(k)}</span>
          ))}
        </div>

        {/* ── 無料体験 Free CTA ── */}
        <div style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          borderTop: "2px solid var(--accent)",
          borderRadius: 12, padding: "24px 28px",
          marginBottom: 52, maxWidth: 460, margin: "0 auto 52px",
        }}>
          {walletAddress ? (
            /* ── Already connected state ── */
            <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 10 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--green)", display: "inline-block" }} />
                <span className="jp-heading" style={{ fontSize: 14, color: "var(--text-primary)", letterSpacing: "0.06em" }}>
                  {t("connectedWallet")}
                </span>
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)", marginBottom: 20, letterSpacing: "0.05em" }}>
                {walletAddress.slice(0, 6)}...{walletAddress.slice(-6)}
              </div>
              <button
                onClick={onEnterApp}
                style={{
                  width: "100%", background: "var(--accent)",
                  borderRadius: 8, padding: "11px 24px", border: "none",
                  fontSize: 13, fontWeight: 500, color: "#fff",
                  cursor: "pointer", letterSpacing: "0.06em",
                  fontFamily: "var(--font-body)",
                }}
              >
                {t("enterApp")}
              </button>
            </>
          ) : (
            /* ── Not connected state ── */
            <>
              <div className="jp-heading" style={{ fontSize: 14, fontWeight: 400, color: "var(--text-primary)", marginBottom: 6, letterSpacing: "0.06em" }}>
                {t("ctaFreeLabel")}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.8, marginBottom: 18, letterSpacing: "0.02em" }}>
                {t("ctaFreeDesc")}
              </div>
              <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap", marginBottom: 18 }}>
                {(["ctaFreeBadge1", "ctaFreeBadge2", "ctaFreeBadge3"] as const).map(key => (
                  <span key={key} style={{
                    fontSize: 11, fontWeight: 400,
                    color: "var(--text-secondary)",
                    background: "transparent",
                    border: "1px solid var(--border-light)",
                    borderRadius: 4, padding: "4px 10px",
                    letterSpacing: "0.04em",
                  }}>✓ {t(key)}</span>
                ))}
              </div>
              {/* Phantom connect button */}
              <button
                onClick={() => connect("phantom")}
                disabled={walletLoading}
                style={{
                  width: "100%",
                  background: phantomAvailable ? "var(--accent)" : "var(--border)",
                  borderRadius: 8, padding: "11px 24px", border: "none",
                  fontSize: 13, fontWeight: 500, color: "#fff",
                  cursor: walletLoading ? "not-allowed" : "pointer",
                  letterSpacing: "0.06em",
                  fontFamily: "var(--font-body)",
                  opacity: walletLoading ? 0.7 : 1,
                  marginBottom: 8,
                }}
              >
                {walletLoading ? "…" : !phantomAvailable ? "Install Phantom →" : "🔮 " + t("ctaFreeBtn")}
              </button>

              {/* OKX connect button */}
              <button
                onClick={() => connect("okx")}
                disabled={walletLoading}
                style={{
                  width: "100%",
                  background: okxAvailable ? "#1a1a2e" : "var(--border)",
                  border: "1px solid " + (okxAvailable ? "#4a4aff" : "var(--border)"),
                  borderRadius: 8, padding: "10px 24px",
                  fontSize: 13, fontWeight: 500, color: okxAvailable ? "#fff" : "var(--text-muted)",
                  cursor: walletLoading ? "not-allowed" : "pointer",
                  letterSpacing: "0.06em",
                  fontFamily: "var(--font-body)",
                  opacity: walletLoading ? 0.7 : 1,
                }}
              >
                {!okxAvailable ? "Install OKX Wallet →" : "◈ Connect OKX Wallet"}
              </button>

              <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 10, letterSpacing: "0.03em" }}>
                {t("ctaSubNote")}
              </div>
            </>
          )}
        </div>
      </div>


      {/* ── 四大守護 4 Agent Cards ── */}
      <div style={{ marginBottom: 12 }}>
        <div className="jp-heading" style={{
          fontSize: 10, color: "var(--text-muted)", fontWeight: 400,
          letterSpacing: "0.2em", marginBottom: 16, textTransform: "uppercase",
        }}>
          {t("agentsTitle")}
        </div>
        <div className="jp-divider" style={{ margin: "0 0 16px 0" }} />
        <div className="feature-grid" style={{
          display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 1,
          background: "var(--border)", borderRadius: 8, overflow: "hidden",
        }}>
          {AGENT_KEYS.map(a => (
            <div key={a.tag} style={{
              background: "var(--bg-card)", padding: "20px 22px",
              borderTop: `2px solid ${a.color}`,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                {/* 漢字アイコン Kanji icon */}
                <div style={{
                  width: 32, height: 32, borderRadius: 6,
                  background: `${a.color}14`,
                  border: `1px solid ${a.color}30`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, fontFamily: "var(--font-heading)",
                  color: a.color, flexShrink: 0,
                }}>{a.icon}</div>
                <span style={{
                  fontSize: 9, fontWeight: 400, letterSpacing: "0.15em",
                  color: "var(--text-muted)",
                  fontFamily: "var(--font-mono)",
                }}>{a.tag}</span>
              </div>
              <div className="jp-heading" style={{ fontSize: 13, fontWeight: 400, color: "var(--text-primary)", marginBottom: 6, letterSpacing: "0.04em" }}>{t(a.titleKey)}</div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.85 }}>{t(a.descKey)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── 区切り線 ── */}
      <div className="jp-divider" style={{ margin: "24px 0" }} />

      {/* ── 差別化 Differentiator ── */}
      <div style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderLeft: "2px solid var(--accent)",
        borderRadius: 8, padding: "16px 20px", marginBottom: 12,
        display: "flex", alignItems: "flex-start", gap: 14,
      }}>
        <div style={{
          width: 28, height: 28, borderRadius: 4, flexShrink: 0,
          background: "var(--accent-soft)", border: "1px solid var(--accent-mid)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 13, fontFamily: "var(--font-heading)", color: "var(--accent)",
        }}>証</div>
        <div>
          <div className="jp-heading" style={{ fontSize: 13, fontWeight: 400, color: "var(--text-primary)", marginBottom: 4, letterSpacing: "0.04em" }}>
            {t("diffTitle")}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.85, letterSpacing: "0.02em" }}>
            {t("diffDesc")}
          </div>
        </div>
      </div>

      {/* ── Stripe MPP ── */}
      <div style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderLeft: "2px solid #635BFF",
        borderRadius: 8, padding: "16px 20px", marginBottom: 12,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 4, flexShrink: 0,
            background: "#635BFF20", border: "1px solid #635BFF40",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, fontWeight: 700, color: "#8B87FF",
          }}>S</div>
          <div className="jp-heading" style={{ fontSize: 13, fontWeight: 400, color: "var(--text-primary)", letterSpacing: "0.04em" }}>
            {t("stripeSectionTitle")}
          </div>
        </div>
        <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.85, marginBottom: 10, letterSpacing: "0.02em" }}>
          {t("stripeSectionDesc")}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {(["stripeFeature1", "stripeFeature2", "stripeFeature3"] as const).map(k => (
            <div key={k} style={{
              fontSize: 11, color: "var(--text-secondary)",
              background: "transparent",
              border: "1px solid var(--border)",
              borderRadius: 4, padding: "4px 10px", letterSpacing: "0.03em",
            }}>{t(k)}</div>
          ))}
        </div>
        <div style={{
          marginTop: 10, fontSize: 10, fontFamily: "var(--font-mono)",
          color: "var(--text-muted)", background: "var(--bg-base)",
          border: "1px solid var(--border)", borderRadius: 4, padding: "6px 10px",
          letterSpacing: "0.05em",
        }}>
          POST /api/mcp · HTTP 402 · x402-payment: USDC · Solana Mainnet
        </div>
      </div>

      {/* ── 区切り線 ── */}
      <div className="jp-divider" style={{ margin: "24px 0" }} />

      {/* ── 数値 Stats ── */}
      <div className="stats-grid" style={{
        display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
        gap: 1, background: "var(--border)", borderRadius: 8,
        overflow: "hidden", marginBottom: 12,
      }}>
        {STATS.map(s => (
          <div key={s.labelKey} style={{ background: "var(--bg-card)", padding: "18px 0", textAlign: "center" }}>
            <div className="jp-mono" style={{ fontSize: 20, fontWeight: 700 }}>
              <AnimatedNumber
                value={s.numValue}
                suffix={s.suffix}
                decimals={s.numValue % 1 !== 0 ? 1 : 0}
                duration={1400}
                style={{ color: "var(--gold)", fontFamily: "var(--font-mono)" }}
              />
            </div>
            <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4, letterSpacing: "0.06em" }}>{t(s.labelKey)}</div>
          </div>
        ))}
      </div>

      {/* ── 連携 Protocol ecosystem ── */}
      <div style={{
        background: "var(--bg-card)", border: "1px solid var(--border)",
        borderRadius: 8, padding: "14px 18px", marginBottom: 16,
      }}>
        <div style={{ fontSize: 9, color: "var(--text-muted)", fontWeight: 400, letterSpacing: "0.18em", marginBottom: 10, textTransform: "uppercase", fontFamily: "var(--font-mono)" }}>
          {t("integratedProtocols")}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {PROTOCOLS.map(name => (
            <span key={name} style={{
              fontSize: 11, fontWeight: 400, color: "var(--text-secondary)",
              background: "var(--bg-base)", border: "1px solid var(--border)",
              borderRadius: 4, padding: "3px 10px", letterSpacing: "0.03em",
            }}>{name}</span>
          ))}
        </div>
      </div>

      <div style={{ textAlign: "center", fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.08em" }}>
        {t("footerText")}
      </div>
    </div>
  );
}
