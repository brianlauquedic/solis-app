"use client";

import { useEffect } from "react";
import WalletConnect from "@/components/WalletConnect";
import IntentSigner from "@/components/IntentSigner";
import ActionHistory from "@/components/ActionHistory";
import ErrorBoundary from "@/components/ErrorBoundary";
import { useWallet } from "@/contexts/WalletContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useLang } from "@/contexts/LanguageContext";
import Footer from "@/components/Footer";

function AppContent() {
  const { walletAddress, shortAddr, disconnect, showLanding, setShowLanding, activeProvider, isDemo, setIsDemo } = useWallet();
  // Dark-only design (v0.3). timeBg was used to tint background by time-of-day
  // but was overriding the Shadcn --background variable and causing contrast
  // regressions. Now we always use --bg-base (墨色).
  const { t } = useLang();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    // Bug 5 fix: case-insensitive demo param (?demo=TRUE, ?demo=True, etc.)
    setIsDemo(params.get("demo")?.toLowerCase() === "true");
  }, [setIsDemo]);

  const showApp = (!!walletAddress && !showLanding) || isDemo;

  return (
    <main className="min-h-screen" style={{
      background: "var(--bg-base)",
    }}>
      <div
        className="main-container"
        style={{
          maxWidth: showApp ? 1080 : 1280,
          margin: "0 auto",
          padding: showApp ? "40px 24px" : "0",
        }}
      >
        {!showApp ? (
          <WalletConnect
            walletAddress={walletAddress}
            onEnterApp={() => setShowLanding(false)}
            onTryDemo={() => { setIsDemo(true); window.history.pushState({}, "", "/?demo=true"); }}
          />
        ) : (
          <div style={{ padding: "40px 0" }}>
            {/* ── Demo mode banner · 清水寺-style hairline + kanji ── */}
            {isDemo && (
              <div style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 18,
                marginBottom: 36,
                padding: "6px 0",
              }}>
                <span style={{
                  flex: 1,
                  height: 1,
                  background: "linear-gradient(to right, transparent, var(--gold) 60%, var(--gold))",
                  opacity: 0.45,
                }} />
                <span style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "4px 14px",
                  border: "1px solid var(--accent-mid)",
                  background: "var(--accent-soft)",
                  borderRadius: 2,
                  fontFamily: "var(--font-heading)",
                  fontSize: 11,
                  letterSpacing: "0.28em",
                  color: "var(--accent)",
                  whiteSpace: "nowrap",
                }}>
                  <span style={{
                    display: "inline-block",
                    width: 5,
                    height: 5,
                    borderRadius: "50%",
                    background: "var(--accent)",
                  }} />
                  DEMO · 體驗用 · 無需錢包
                </span>
                <span style={{
                  flex: 1,
                  height: 1,
                  background: "linear-gradient(to left, transparent, var(--gold) 60%, var(--gold))",
                  opacity: 0.45,
                }} />
              </div>
            )}

            {/* ── Header bar ── */}
            <div className="app-header" style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              marginBottom: 28,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span
                  onClick={() => { setIsDemo(false); setShowLanding(true); window.history.pushState({}, "", "/"); }}
                  style={{
                    fontSize: 18, fontWeight: 300, letterSpacing: "0.1em",
                    fontFamily: "var(--font-heading)", color: "var(--text-primary)",
                    cursor: "pointer",
                  }}
                >
                  Sakura
                </span>
              </div>
              <div className="app-header-right" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 6,
                  background: "var(--bg-card)", border: "1px solid var(--border)",
                  borderRadius: 8, padding: "6px 12px",
                }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: "50%",
                    background: isDemo ? "#FF6A00" : "var(--green)",
                    display: "inline-block",
                  }} />
                  <span style={{ fontSize: 12, color: "var(--text-primary)", fontFamily: "var(--font-mono)", letterSpacing: "0.04em" }}>
                    {isDemo ? "demo...mode" : shortAddr}
                  </span>
                  {!isDemo && activeProvider && (
                    <span style={{
                      fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.06em",
                    }}>
                      {activeProvider === "phantom" ? "Phantom" : "OKX"}
                    </span>
                  )}
                </div>
                {isDemo ? (
                  <button
                    onClick={() => { setIsDemo(false); setShowLanding(true); window.history.pushState({}, "", "/"); }}
                    style={{
                      fontSize: 12, color: "#FF9F0A",
                      background: "rgba(255,159,10,0.1)", border: "1px solid rgba(255,159,10,0.4)",
                      borderRadius: 6, padding: "6px 12px", cursor: "pointer",
                      letterSpacing: "0.04em", fontWeight: 600,
                    }}
                  >
                    🔗 連接錢包
                  </button>
                ) : (
                  <button
                    onClick={() => disconnect()}
                    style={{
                      fontSize: 12, color: "var(--text-muted)",
                      background: "var(--bg-card)", border: "1px solid var(--border)",
                      borderRadius: 6, padding: "6px 12px", cursor: "pointer",
                      letterSpacing: "0.04em",
                    }}
                  >
                    {t("appDisconnect")}
                  </button>
                )}
                <a
                  href="/mcp"
                  className="app-header-secondary"
                  style={{
                    fontSize: 11, fontWeight: 600, color: "var(--accent)",
                    textDecoration: "none", padding: "6px 10px",
                    border: "1px solid var(--accent-mid)",
                    background: "var(--accent-soft)",
                    borderRadius: 6, letterSpacing: "0.06em",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  MCP API
                </a>
                {true && (
                  <button
                    onClick={() => { setIsDemo(false); setShowLanding(true); window.history.pushState({}, "", "/"); }}
                    className="app-header-secondary"
                    style={{
                      fontSize: 12, color: "var(--text-muted)",
                      background: "none", border: "none",
                      cursor: "pointer", padding: "6px 4px",
                      letterSpacing: "0.04em",
                    }}
                  >
                    {t("appHome")}
                  </button>
                )}
              </div>
            </div>

            {/* ── Agentic Consumer Protocol — Intent Execution ── */}
            <div className={isDemo ? "demo-frame" : undefined} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              <ErrorBoundary fallbackLabel="Intent Signer">
                <IntentSigner />
              </ErrorBoundary>
              <ErrorBoundary fallbackLabel="Action History">
                <ActionHistory />
              </ErrorBoundary>
            </div>
          </div>
        )}
      </div>
      <Footer />
    </main>
  );
}

export default function Home() {
  return <AppContent />;
}
