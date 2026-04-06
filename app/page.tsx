"use client";

import { useState } from "react";
import WalletConnect from "@/components/WalletConnect";
import HealthReport from "@/components/HealthReport";
import TokenAnalysis from "@/components/TokenAnalysis";
import DefiAssistant from "@/components/DefiAssistant";
import AgentPanel from "@/components/AgentPanel";
import ErrorBoundary from "@/components/ErrorBoundary";
import { useLang } from "@/contexts/LanguageContext";
import { useWallet } from "@/contexts/WalletContext";
import { useTheme } from "@/contexts/ThemeContext";
import Footer from "@/components/Footer";

type Tab = "health" | "token" | "defi" | "agent";

interface WalletSnapshot {
  solBalance: number;
  totalUSD: number;
  idleUSDC: number;
}

function AppContent() {
  const { t } = useLang();
  const { walletAddress, disconnect, showLanding, setShowLanding } = useWallet();
  const { isDayMode, timeBg } = useTheme();
  const [activeTab, setActiveTab] = useState<Tab>("health");
  const [walletSnapshot, setWalletSnapshot] = useState<WalletSnapshot | undefined>();

  return (
    <main className="min-h-screen" style={{
      background: isDayMode ? "var(--bg-base)" : timeBg.bg,
      transition: "background 1.5s ease, color 1.5s ease",
    }}>
      {/* Main Content */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 24px" }}>
        {!walletAddress || showLanding ? (
          <WalletConnect
            walletAddress={walletAddress}
            onEnterApp={() => setShowLanding(false)}
          />
        ) : (
          <>
            {/* ── 索引 Tab Navigation (日系底線スタイル) ── */}
            <div style={{
              display: "flex", gap: 0, marginBottom: 32,
              borderBottom: "1px solid var(--border)",
            }}>
              <TabButton label={t("tabHealth")} active={activeTab === "health"} onClick={() => setActiveTab("health")} />
              <TabButton label={t("tabToken")} active={activeTab === "token"} onClick={() => setActiveTab("token")} />
              <TabButton label={t("tabDefi")} active={activeTab === "defi"} onClick={() => setActiveTab("defi")} />
              <TabButton label={t("tabAgent")} active={activeTab === "agent"} onClick={() => setActiveTab("agent")} />
            </div>

            {/* Tab Content — always mounted, hidden when inactive to preserve state */}
            <div style={{ display: activeTab === "health" ? "block" : "none" }}>
              <ErrorBoundary fallbackLabel={t("tabHealth")}>
                <HealthReport
                  walletAddress={walletAddress}
                  onDisconnect={() => { disconnect(); setWalletSnapshot(undefined); }}
                  onDataLoaded={setWalletSnapshot}
                />
              </ErrorBoundary>
            </div>
            <div style={{ display: activeTab === "token" ? "block" : "none" }}>
              <ErrorBoundary fallbackLabel={t("tabToken")}>
                <TokenAnalysis walletAddress={walletAddress} isDayMode={isDayMode} />
              </ErrorBoundary>
            </div>
            <div style={{ display: activeTab === "defi" ? "block" : "none" }}>
              <ErrorBoundary fallbackLabel={t("tabDefi")}>
                <DefiAssistant
                  walletAddress={walletAddress}
                  walletSnapshot={walletSnapshot}
                />
              </ErrorBoundary>
            </div>
            <div style={{ display: activeTab === "agent" ? "block" : "none" }}>
              <ErrorBoundary fallbackLabel={t("tabAgent")}>
                <AgentPanel
                  walletAddress={walletAddress}
                  walletSnapshot={walletSnapshot}
                  isDayMode={isDayMode}
                />
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

function TabButton({ label, active, onClick }: {
  label: string; active: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick} className="tab-btn" style={{
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
    }}>
      {label}
    </button>
  );
}
