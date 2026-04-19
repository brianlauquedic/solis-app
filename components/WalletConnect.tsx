"use client";

import { useState, useEffect } from "react";
import AnimatedNumber from "@/components/AnimatedNumber";
import { useLang } from "@/contexts/LanguageContext";
import WaBijinSVG from "@/components/WaBijinSVG";
import { useWallet } from "@/contexts/WalletContext";

const SITE_URL = "https://www.sakuraaai.com";
const PHANTOM_DEEPLINK = `https://phantom.app/ul/browse/${encodeURIComponent(SITE_URL)}`;
const OKX_DEEPLINK = `https://www.okx.com/download?deeplink=${encodeURIComponent(`okx://wallet/dapp/details?dappUrl=${encodeURIComponent(SITE_URL)}`)}`;

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(
      /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) && window.innerWidth < 768
    );
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return isMobile;
}

const AGENT_KEYS = [
  // Single-product architecture (v0.3): Shielded Lending replaces the prior
  // 3-tab layout. The four cards now describe four LAYERS of the unified
  // product (cross-protocol routing, ZK pairing verification, on-chain
  // audit, agent-mediated rescue) rather than separate features.
  { tag: "Cross-Protocol Routing", titleKey: "agent1Title" as const, descKey: "agent1Desc" as const, icon: "路", color: "var(--accent)" },
  { tag: "ZK Pairing Verifier",    titleKey: "agent2Title" as const, descKey: "agent2Desc" as const, icon: "証", color: "var(--gold)" },
  { tag: "On-chain Audit",         titleKey: "agent3Title" as const, descKey: "agent3Desc" as const, icon: "鑑", color: "#FF4444" },
  { tag: "Agent-Mediated Rescue",  titleKey: "agent4Title" as const, descKey: "agent4Desc" as const, icon: "救", color: "var(--green)" },
];

const PROTOCOLS = [
  "Jupiter", "Marinade", "Jito", "Kamino",
  "GoPlus Security", "Helius RPC", "Solana Agent Kit", "Claude AI", "Stripe MPP",
];

const STATS = [
  { numValue: 3,   suffix: "",   labelKey: "statLabel1" as const },
  { numValue: 285, suffix: "M",  labelKey: "statLabel2" as const },
  { numValue: 4,   suffix: "B+", labelKey: "statLabel3" as const },
  { numValue: 100, suffix: "%",  labelKey: "statLabel4" as const },
];

interface Props {
  walletAddress?: string | null;
  onEnterApp?: () => void;
  onTryDemo?: () => void;
}

export default function WalletConnect({ walletAddress, onEnterApp, onTryDemo }: Props = {}) {
  const { t, lang } = useLang();
  const { connect, phantomAvailable, okxAvailable, walletLoading } = useWallet();
  const isMobile = useIsMobile();
  // On mobile, neither wallet is injected unless already inside the wallet browser
  const showMobileDeepLinks = isMobile && !phantomAvailable && !okxAvailable;

  return (
    <div style={{ maxWidth: 760, margin: "0 auto" }}>

      {/* ── Top nav ── */}
      <div style={{
        display: "flex", justifyContent: "flex-end", alignItems: "center",
        gap: 8, marginBottom: 32,
      }}>
        <a href="/docs" style={{
          fontSize: 11, color: "var(--text-muted)", textDecoration: "none",
          padding: "3px 9px", borderRadius: 5,
          border: "1px solid var(--border)", background: "var(--bg-card)",
          fontFamily: "var(--font-mono)", letterSpacing: "0.06em",
        }}>Docs</a>
        <a href="/use-cases" style={{
          fontSize: 11, color: "var(--text-muted)", textDecoration: "none",
          padding: "3px 9px", borderRadius: 5,
          border: "1px solid var(--border)", background: "var(--bg-card)",
          fontFamily: "var(--font-mono)", letterSpacing: "0.06em",
        }}>Use Cases</a>
        <a href="/mcp" style={{
          fontSize: 11, fontWeight: 700, color: "var(--accent)", textDecoration: "none",
          padding: "3px 9px", borderRadius: 5,
          border: "1px solid var(--accent-mid)", background: "var(--accent-soft)",
          fontFamily: "var(--font-mono)", letterSpacing: "0.08em",
        }}>MCP API</a>
      </div>

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

        <div className="fade-in-up fade-in-up-1 hero-tagline" style={{
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
        <div className="cta-box" style={{
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
              {showMobileDeepLinks ? (
                /* ── Mobile: deep link into wallet browser ── */
                <>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 14, lineHeight: 1.7, letterSpacing: "0.02em" }}>
                    {lang === "zh" ? "在錢包 App 的內置瀏覽器中打開 Sakura，即可連接錢包：" :
                     lang === "ja" ? "ウォレットアプリの内蔵ブラウザでSakuraを開いて接続：" :
                     "Open Sakura inside your wallet app's browser to connect:"}
                  </div>
                  <a
                    href={PHANTOM_DEEPLINK}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      width: "100%", background: "var(--accent)",
                      borderRadius: 10, padding: "13px 24px",
                      fontSize: 14, fontWeight: 500, color: "#fff",
                      textDecoration: "none", letterSpacing: "0.05em",
                      fontFamily: "var(--font-body)", marginBottom: 10,
                      boxSizing: "border-box",
                    }}
                  >
                    <span>🔮</span>
                    <span>{lang === "zh" ? "在 Phantom App 中打開" : lang === "ja" ? "Phantom Appで開く" : "Open in Phantom App"}</span>
                  </a>
                  <a
                    href={OKX_DEEPLINK}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      width: "100%", background: "#1a1a2e",
                      border: "1px solid #4a4aff",
                      borderRadius: 10, padding: "12px 24px",
                      fontSize: 14, fontWeight: 500, color: "#fff",
                      textDecoration: "none", letterSpacing: "0.05em",
                      fontFamily: "var(--font-body)", marginBottom: 10,
                      boxSizing: "border-box",
                    }}
                  >
                    <span>◈</span>
                    <span>{lang === "zh" ? "在 OKX App 中打開" : lang === "ja" ? "OKX Appで開く" : "Open in OKX App"}</span>
                  </a>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 6, letterSpacing: "0.02em", lineHeight: 1.7 }}>
                    {lang === "zh" ? "💡 點擊後將跳轉至對應錢包 App，在 App 內置瀏覽器中繼續操作" :
                     lang === "ja" ? "💡 タップするとウォレットアプリに移動し、内蔵ブラウザで続けてください" :
                     "💡 Tap to open your wallet app — continue in its built-in browser"}
                  </div>
                </>
              ) : (
                /* ── Desktop / wallet browser: standard connect ── */
                <>
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
                </>
              )}

              <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 10, letterSpacing: "0.03em" }}>
                {t("ctaSubNote")}
              </div>

              {onTryDemo && (
                <button
                  onClick={onTryDemo}
                  style={{
                    width: "100%", marginTop: 14,
                    background: "transparent",
                    border: "1px dashed var(--border)",
                    borderRadius: 8, padding: "9px 24px",
                    fontSize: 12, color: "var(--text-muted)",
                    cursor: "pointer", letterSpacing: "0.06em",
                    fontFamily: "var(--font-body)",
                  }}
                >
                  🎬 {lang === "zh" ? "無需錢包，體驗 Demo" : lang === "ja" ? "ウォレット不要でデモを体験" : "Try Demo (no wallet needed)"}
                </button>
              )}
            </>
          )}
        </div>
      </div>


      {/* ── 桜の守護者 Sakura Character Narrative ── */}
      <div className="sakura-card" style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderTop: "2px solid var(--accent)",
        borderRadius: 12, padding: "28px 28px 24px",
        marginBottom: 28, position: "relative", overflow: "hidden",
      }}>
        {/* Decorative petal watermark */}
        <div style={{
          position: "absolute", top: -10, right: 10, fontSize: 100,
          opacity: 0.03, userSelect: "none", pointerEvents: "none", lineHeight: 1,
        }}>🌸</div>
        <div style={{
          position: "absolute", bottom: -20, left: 5, fontSize: 60,
          opacity: 0.025, userSelect: "none", pointerEvents: "none", lineHeight: 1,
        }}>桜</div>

        {/* Aesthetic badge */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: "rgba(255,75,75,0.06)", border: "1px solid rgba(255,75,75,0.2)",
          borderRadius: 20, padding: "3px 12px", marginBottom: 18,
        }}>
          <span style={{ fontSize: 10, color: "var(--accent)", letterSpacing: "0.15em", fontFamily: "var(--font-mono)" }}>
            {t("sakuraOriginBadge")}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "flex-start", gap: 18 }}>
          {/* Kanji crest */}
          <div style={{
            width: 48, height: 48, borderRadius: 10, flexShrink: 0,
            background: "var(--accent-soft)", border: "1px solid var(--accent-mid)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 22, fontFamily: "var(--font-heading)", color: "var(--accent)",
            boxShadow: "0 2px 12px rgba(255,75,75,0.1)",
          }}>桜</div>

          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: 9, fontWeight: 400, letterSpacing: "0.22em",
              color: "var(--accent)", fontFamily: "var(--font-mono)",
              marginBottom: 6, textTransform: "uppercase",
            }}>Sakura Mutual · 🌸 ZK-Settled Insurance · Groth16 on Solana</div>

            <div className="jp-heading" style={{
              fontSize: 15, fontWeight: 400, color: "var(--text-primary)",
              letterSpacing: "0.07em", marginBottom: 12,
            }}>{t("sakuraWho")}</div>

            <div style={{
              fontSize: 12, color: "var(--text-secondary)", lineHeight: 2.1,
              letterSpacing: "0.02em", marginBottom: 18,
            }}>{t("sakuraCharacterDesc")}</div>

            {/* Mission statement */}
            <div style={{
              background: "var(--accent-soft)", border: "1px solid var(--accent-mid)",
              borderRadius: 6, padding: "10px 14px", marginBottom: 16,
              fontSize: 12, color: "var(--accent)",
              fontFamily: "var(--font-heading)", letterSpacing: "0.06em",
            }}>
              ◈ {t("sakuraMission")}
            </div>

            {/* Japanese values */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
              {(["sakuraJapanValue1", "sakuraJapanValue2", "sakuraJapanValue3"] as const).map(k => (
                <span key={k} style={{
                  fontSize: 10, color: "var(--text-secondary)",
                  background: "var(--bg-base)", border: "1px solid var(--border)",
                  borderRadius: 20, padding: "3px 10px", letterSpacing: "0.03em",
                }}>{t(k)}</span>
              ))}
            </div>

            {/* Tech primitives */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {(["sakuraTech1", "sakuraTech2", "sakuraTech3", "sakuraTech4"] as const).map(k => (
                <div key={k} style={{
                  fontSize: 11, color: "var(--text-secondary)",
                  background: "var(--bg-base)",
                  border: "1px solid var(--border)",
                  borderRadius: 4, padding: "5px 10px",
                  letterSpacing: "0.02em", fontFamily: "var(--font-mono)",
                  display: "flex", alignItems: "center", gap: 6,
                }}>
                  <span style={{ color: "var(--accent)", fontSize: 8, opacity: 0.7 }}>▸</span>
                  {t(k)}
                </div>
              ))}
            </div>
          </div>
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
          POST /api/mcp · HTTP 402 · x402-payment: 1.00 USDC · Solana Mainnet
        </div>
        <div style={{ marginTop: 10, textAlign: "right" }}>
          <a href="/mcp" style={{
            fontSize: 11, color: "#8B87FF", textDecoration: "none",
            letterSpacing: "0.06em", fontFamily: "var(--font-mono)",
          }}>
            → MCP API 文檔 / Docs / ドキュメント
          </a>
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
