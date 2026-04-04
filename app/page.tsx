"use client";

import { useState, useEffect } from "react";
import WalletConnect from "@/components/WalletConnect";
import HealthReport from "@/components/HealthReport";
import TokenAnalysis from "@/components/TokenAnalysis";
import DefiAssistant from "@/components/DefiAssistant";
import AgentPanel from "@/components/AgentPanel";
import PriceTicker from "@/components/PriceTicker";
import ErrorBoundary from "@/components/ErrorBoundary";
import SubscriptionBanner from "@/components/SubscriptionBanner";
import { LanguageProvider, useLang } from "@/contexts/LanguageContext";
import type { Lang } from "@/lib/i18n";

type Tab = "health" | "token" | "defi" | "agent";

interface WalletSnapshot {
  solBalance: number;
  totalUSD: number;
  idleUSDC: number;
}

const LANG_OPTIONS: { code: Lang; flag: string; label: string }[] = [
  { code: "en", flag: "🇺🇸", label: "EN" },
  { code: "zh", flag: "🇨🇳", label: "中文" },
  { code: "ja", flag: "🇯🇵", label: "日本語" },
];

function AppContent() {
  const { lang, setLang, t } = useLang();
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("health");
  const [walletSnapshot, setWalletSnapshot] = useState<WalletSnapshot | undefined>();
  const [phantomLoading, setPhantomLoading] = useState(false);
  const [phantomAvailable, setPhantomAvailable] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setPhantomAvailable(!!window.solana?.isPhantom), 300);
    return () => clearTimeout(t);
  }, []);

  async function connectPhantom() {
    if (!window.solana) return;
    setPhantomLoading(true);
    try {
      const resp = await window.solana.connect();
      setWalletAddress(resp.publicKey.toString());
    } catch {
      // user rejected
    } finally {
      setPhantomLoading(false);
    }
  }

  function disconnect() {
    setWalletAddress(null);
    setWalletSnapshot(undefined);
    window.solana?.disconnect?.();
  }

  const shortAddr = walletAddress
    ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`
    : null;

  return (
    <main className="min-h-screen" style={{ background: "#0A0A0F" }}>
      {/* Header */}
      <header style={{
        borderBottom: "1px solid #1E1E2E",
        padding: "14px 32px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 50,
        background: "rgba(10,10,15,0.92)",
        backdropFilter: "blur(12px)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: "linear-gradient(135deg, #8B5CF6, #06B6D4)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, fontWeight: 900, color: "#fff",
          }}>S</div>
          <span style={{ fontSize: 20, fontWeight: 800, color: "#fff" }}>Solis</span>
          <span style={{
            fontSize: 10, color: "#8B5CF6", border: "1px solid #8B5CF660",
            borderRadius: 4, padding: "2px 6px", letterSpacing: 1,
          }}>BETA</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <PriceTicker />

          {/* Subscription badge (only when wallet connected) */}
          {walletAddress && (
            <SubscriptionBanner
              walletAddress={walletAddress}
              onSubscriptionChange={() => {}}
            />
          )}

          {/* Language switcher */}
          <div style={{ display: "flex", gap: 3, background: "#13131A", border: "1px solid #1E1E2E", borderRadius: 8, padding: 3 }}>
            {LANG_OPTIONS.map(opt => (
              <button
                key={opt.code}
                onClick={() => setLang(opt.code)}
                style={{
                  padding: "3px 8px", borderRadius: 5, border: "none",
                  fontSize: 11, fontWeight: 700, cursor: "pointer",
                  background: lang === opt.code ? "linear-gradient(135deg, #8B5CF630, #06B6D430)" : "transparent",
                  color: lang === opt.code ? "#E2E8F0" : "#475569",
                  transition: "all 0.15s",
                  whiteSpace: "nowrap",
                }}
              >
                {opt.flag} {opt.label}
              </button>
            ))}
          </div>

          {/* Wallet connect / connected state */}
          {walletAddress ? (
            <button
              onClick={disconnect}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "5px 12px", borderRadius: 8,
                background: "#13131A", border: "1px solid #1E1E2E",
                fontSize: 12, fontWeight: 700, color: "#10B981", cursor: "pointer",
              }}
            >
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#10B981", display: "inline-block" }} />
              {shortAddr}
            </button>
          ) : (
            <button
              onClick={connectPhantom}
              disabled={phantomLoading || !phantomAvailable}
              style={{
                padding: "6px 14px", borderRadius: 8, border: "none",
                background: phantomAvailable
                  ? "linear-gradient(135deg, #8B5CF6, #06B6D4)"
                  : "#1E1E2E",
                fontSize: 12, fontWeight: 700, color: phantomAvailable ? "#fff" : "#475569",
                cursor: phantomAvailable ? "pointer" : "not-allowed",
                whiteSpace: "nowrap",
              }}
            >
              {phantomLoading ? "..." : phantomAvailable ? `👻 ${t("connectBtn")}` : "Install Phantom"}
            </button>
          )}

          <a
            href="https://x.com/thatbrianlau"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 28, height: 28,
              background: "#000", border: "1px solid #333",
              borderRadius: 6,
              textDecoration: "none", flexShrink: 0,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 1200 1227" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M714.163 519.284L1160.89 0H1055.03L667.137 450.887L357.328 0H0L468.492 681.821L0 1226.37H105.866L515.491 750.218L842.672 1226.37H1200L714.163 519.284ZM569.165 687.828L521.697 619.934L144.011 79.6944H306.615L611.412 515.685L658.88 583.579L1055.08 1150.3H892.476L569.165 687.828Z" fill="white"/>
            </svg>
          </a>
        </div>
      </header>

      {/* Main Content */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 24px" }}>
        {!walletAddress ? (
          <WalletConnect />
        ) : (
          <>
            {/* Tab Navigation */}
            <div style={{
              display: "flex", gap: 6, marginBottom: 28,
              background: "#0D0D14", border: "1px solid #1E1E2E",
              borderRadius: 14, padding: 5,
            }}>
              <TabButton label={t("tabHealth")} active={activeTab === "health"} onClick={() => setActiveTab("health")} />
              <TabButton label={t("tabToken")} active={activeTab === "token"} onClick={() => setActiveTab("token")} />
              <TabButton label={t("tabDefi")} active={activeTab === "defi"} onClick={() => setActiveTab("defi")} />
              <TabButton label={t("tabAgent")} active={activeTab === "agent"} onClick={() => setActiveTab("agent")} />
            </div>

            {/* Tab Content */}
            {activeTab === "health" && (
              <ErrorBoundary fallbackLabel={t("tabHealth")}>
                <HealthReport
                  walletAddress={walletAddress}
                  onDisconnect={() => { setWalletAddress(null); setWalletSnapshot(undefined); }}
                  onDataLoaded={setWalletSnapshot}
                />
              </ErrorBoundary>
            )}
            {activeTab === "token" && (
              <ErrorBoundary fallbackLabel={t("tabToken")}>
                <TokenAnalysis walletAddress={walletAddress} />
              </ErrorBoundary>
            )}
            {activeTab === "defi" && (
              <ErrorBoundary fallbackLabel={t("tabDefi")}>
                <DefiAssistant
                  walletAddress={walletAddress}
                  walletSnapshot={walletSnapshot}
                />
              </ErrorBoundary>
            )}
            {activeTab === "agent" && (
              <ErrorBoundary fallbackLabel={t("tabAgent")}>
                <AgentPanel
                  walletAddress={walletAddress}
                  walletSnapshot={walletSnapshot}
                />
              </ErrorBoundary>
            )}
          </>
        )}
      </div>
    </main>
  );
}

export default function Home() {
  return (
    <LanguageProvider>
      <AppContent />
    </LanguageProvider>
  );
}

function TabButton({ label, active, onClick }: {
  label: string; active: boolean; onClick: () => void;
}) {
  return (
    <button onClick={onClick} style={{
      flex: 1, padding: "9px 16px", borderRadius: 10, border: "none",
      fontSize: 13, fontWeight: 600, cursor: "pointer",
      background: active
        ? "linear-gradient(135deg, #8B5CF615, #06B6D415)"
        : "transparent",
      color: active ? "#E2E8F0" : "#475569",
      borderBottom: active ? "2px solid #8B5CF6" : "2px solid transparent",
      transition: "all 0.2s",
    }}>
      {label}
    </button>
  );
}
