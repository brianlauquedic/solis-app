"use client";

import { useState } from "react";
import WalletConnect from "@/components/WalletConnect";
import NonceGuardian from "@/components/NonceGuardian";
import GhostRun from "@/components/GhostRun";
import LiquidationShield from "@/components/LiquidationShield";
import ErrorBoundary from "@/components/ErrorBoundary";
import { useWallet } from "@/contexts/WalletContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useLang } from "@/contexts/LanguageContext";
import Footer from "@/components/Footer";

type Tab = "nonce" | "ghost" | "shield";

const TABS: { id: Tab; icon: string; label: string }[] = [
  { id: "nonce",  icon: "🛡️", label: "Nonce Guardian" },
  { id: "ghost",  icon: "👻", label: "Ghost Run" },
  { id: "shield", icon: "⚡", label: "Liquidation Shield" },
];

function AppContent() {
  const { walletAddress, shortAddr, disconnect, showLanding, setShowLanding, activeProvider } = useWallet();
  const { isDayMode, timeBg } = useTheme();
  const { t } = useLang();
  const [activeTab, setActiveTab] = useState<Tab>("nonce");

  return (
    <main className="min-h-screen" style={{
      background: isDayMode ? "var(--bg-base)" : timeBg.bg,
      transition: "background 1.5s ease, color 1.5s ease",
    }}>
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "40px 24px" }}>
        {!walletAddress || showLanding ? (
          <WalletConnect
            walletAddress={walletAddress}
            onEnterApp={() => setShowLanding(false)}
          />
        ) : (
          <>
            {/* ── Header bar ── */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              marginBottom: 28,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{
                  fontSize: 18, fontWeight: 300, letterSpacing: "0.1em",
                  fontFamily: "var(--font-heading)", color: "var(--text-primary)",
                }}>
                  Sakura
                </span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{
                  display: "flex", alignItems: "center", gap: 6,
                  background: "var(--bg-card)", border: "1px solid var(--border)",
                  borderRadius: 8, padding: "6px 12px",
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--green)", display: "inline-block" }} />
                  <span style={{ fontSize: 12, color: "var(--text-primary)", fontFamily: "var(--font-mono)", letterSpacing: "0.04em" }}>
                    {shortAddr}
                  </span>
                  {activeProvider && (
                    <span style={{
                      fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.06em",
                    }}>
                      {activeProvider === "phantom" ? "Phantom" : "OKX"}
                    </span>
                  )}
                </div>
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
                <button
                  onClick={() => setShowLanding(true)}
                  style={{
                    fontSize: 12, color: "var(--text-muted)",
                    background: "none", border: "none",
                    cursor: "pointer", padding: "6px 4px",
                    letterSpacing: "0.04em",
                  }}
                >
                  {t("appHome")}
                </button>
              </div>
            </div>

            {/* ── 3-Tab Navigation ── */}
            <div style={{
              display: "flex", gap: 0, marginBottom: 28,
              borderBottom: "1px solid var(--border)",
            }}>
              {TABS.map(tab => (
                <TabButton
                  key={tab.id}
                  icon={tab.icon}
                  label={tab.label}
                  active={activeTab === tab.id}
                  onClick={() => setActiveTab(tab.id)}
                />
              ))}
            </div>

            {/* ── Tab Content ── */}
            <div style={{ display: activeTab === "nonce" ? "block" : "none" }}>
              <ErrorBoundary fallbackLabel="Nonce Guardian">
                <NonceGuardian />
              </ErrorBoundary>
            </div>
            <div style={{ display: activeTab === "ghost" ? "block" : "none" }}>
              <ErrorBoundary fallbackLabel="Ghost Run">
                <GhostRun />
              </ErrorBoundary>
            </div>
            <div style={{ display: activeTab === "shield" ? "block" : "none" }}>
              <ErrorBoundary fallbackLabel="Liquidation Shield">
                <LiquidationShield />
              </ErrorBoundary>
            </div>
          </>
        )}
      </div>
      <Footer />
    </main>
  );
}

export default function Home() {
  return <AppContent />;
}

function TabButton({ icon, label, active, onClick }: {
  icon: string; label: string; active: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: "10px 16px", border: "none",
      fontSize: 13, fontWeight: active ? 500 : 400,
      cursor: "pointer",
      background: "transparent",
      color: active ? "var(--text-primary)" : "var(--text-muted)",
      borderBottom: active ? "2px solid var(--accent)" : "2px solid transparent",
      transition: "all 0.25s",
      fontFamily: "var(--font-body)",
      letterSpacing: "0.04em",
      marginBottom: -1,
      display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
    }}>
      <span>{icon}</span>
      <span>{label}</span>
    </button>
  );
}
