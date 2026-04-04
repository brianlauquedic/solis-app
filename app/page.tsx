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

// ── 時の色 Toki-no-Iro — Color of Time ──────────────────────────
// Japanese traditional color philosophy: each hour has its own hue
const TIME_COLORS = [
  { from: 4,  to: 6,  bg: "#120A0D", accent: "#8B3040", name: "暁", label: "Dawn"      }, // 暁色 Akebono
  { from: 6,  to: 9,  bg: "#0A0B12", accent: "#3A5C8B", name: "朝", label: "Morning"   }, // 朝焼け Asayake
  { from: 9,  to: 12, bg: "#0C0D0A", accent: "#4A7A55", name: "昼", label: "Noon"      }, // 常磐色 Tokiwa
  { from: 12, to: 15, bg: "#0E0C09", accent: "#8B7020", name: "午", label: "Afternoon" }, // 金色 Kin
  { from: 15, to: 18, bg: "#130A08", accent: "#9B3520", name: "夕", label: "Dusk"      }, // 夕焼け Yūyake
  { from: 18, to: 21, bg: "#09090F", accent: "#4A3A8B", name: "宵", label: "Evening"   }, // 藍色 Ai
  { from: 21, to: 24, bg: "#080810", accent: "#2A2050", name: "夜", label: "Night"     }, // 夜色 Yoru
  { from: 0,  to: 4,  bg: "#0A0808", accent: "#3A1A20", name: "深夜", label: "Midnight"}, // 漆黒 Shikkoku
];

function getTimeColor() {
  const h = new Date().getHours();
  return TIME_COLORS.find(c => h >= c.from && h < c.to) ?? TIME_COLORS[6];
}

function AppContent() {
  const { lang, setLang, t } = useLang();
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("health");
  const [walletSnapshot, setWalletSnapshot] = useState<WalletSnapshot | undefined>();
  const [phantomLoading, setPhantomLoading] = useState(false);
  const [phantomAvailable, setPhantomAvailable] = useState(false);
  const [timeBg, setTimeBg] = useState(getTimeColor());

  // Update background every minute
  useEffect(() => {
    const tick = () => setTimeBg(getTimeColor());
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

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
    <main className="min-h-screen" style={{
      background: timeBg.bg,
      transition: "background 3s ease",
    }}>
      {/* ── 頭部 Header ── */}
      <header style={{
        borderBottom: "1px solid var(--border)",
        padding: "12px 32px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 50,
        background: "var(--bg-header)",
        backdropFilter: "blur(16px)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* 印章 Hanko-style logo */}
          <div style={{
            width: 32, height: 32, borderRadius: 6,
            background: "var(--accent)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            {/* Cute Japanese girl SVG avatar */}
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Hair */}
              <ellipse cx="11" cy="8" rx="7" ry="5.5" fill="#1a0a0a"/>
              <rect x="4" y="7" width="2" height="7" rx="1" fill="#1a0a0a"/>
              <rect x="16" y="7" width="2" height="7" rx="1" fill="#1a0a0a"/>
              {/* Face */}
              <ellipse cx="11" cy="11" rx="5" ry="5.5" fill="#FDDBB4"/>
              {/* Eyes */}
              <ellipse cx="8.8" cy="10.5" rx="1.1" ry="1.3" fill="#2d1a0e"/>
              <ellipse cx="13.2" cy="10.5" rx="1.1" ry="1.3" fill="#2d1a0e"/>
              {/* Eye shine */}
              <circle cx="9.2" cy="10" r="0.35" fill="white"/>
              <circle cx="13.6" cy="10" r="0.35" fill="white"/>
              {/* Blush */}
              <ellipse cx="7.5" cy="12" rx="1.2" ry="0.6" fill="#F4A0A0" opacity="0.6"/>
              <ellipse cx="14.5" cy="12" rx="1.2" ry="0.6" fill="#F4A0A0" opacity="0.6"/>
              {/* Smile */}
              <path d="M9 13 Q11 14.5 13 13" stroke="#c07060" strokeWidth="0.8" strokeLinecap="round" fill="none"/>
              {/* Hair highlight */}
              <ellipse cx="9" cy="6.5" rx="2" ry="1" fill="#3d1a1a" opacity="0.4"/>
            </svg>
          </div>
          <span className="jp-heading" style={{ fontSize: 18, fontWeight: 500, color: "var(--text-primary)", letterSpacing: "0.08em" }}>Solis</span>
          <span style={{
            fontSize: 9, color: "var(--accent)", border: "1px solid var(--accent-mid)",
            borderRadius: 3, padding: "1px 5px", letterSpacing: 1.5, fontFamily: "var(--font-mono)",
          }}>BETA</span>
          {/* 時の色 Time indicator */}
          <span style={{
            fontSize: 10, color: "var(--text-muted)",
            borderLeft: "1px solid var(--border)", paddingLeft: 10,
            fontFamily: "var(--font-heading)", letterSpacing: "0.1em",
          }} title={timeBg.label}>
            {timeBg.name}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <PriceTicker />

          {walletAddress && (
            <SubscriptionBanner
              walletAddress={walletAddress}
              onSubscriptionChange={() => {}}
            />
          )}

          {/* Language switcher */}
          <div style={{ display: "flex", gap: 2, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 6, padding: 3 }}>
            {LANG_OPTIONS.map(opt => (
              <button
                key={opt.code}
                onClick={() => setLang(opt.code)}
                style={{
                  padding: "3px 8px", borderRadius: 4, border: "none",
                  fontSize: 11, fontWeight: 500, cursor: "pointer",
                  background: lang === opt.code ? "var(--accent-soft)" : "transparent",
                  color: lang === opt.code ? "var(--text-primary)" : "var(--text-muted)",
                  transition: "all 0.2s",
                  whiteSpace: "nowrap",
                  borderBottom: lang === opt.code ? "1px solid var(--accent)" : "1px solid transparent",
                }}
              >
                {opt.flag} {opt.label}
              </button>
            ))}
          </div>

          {/* Wallet */}
          {walletAddress ? (
            <button
              onClick={disconnect}
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "5px 12px", borderRadius: 6,
                background: "var(--bg-card)", border: "1px solid var(--border)",
                fontSize: 12, fontWeight: 500, color: "var(--green)", cursor: "pointer",
                fontFamily: "var(--font-mono)",
              }}
            >
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--green)", display: "inline-block" }} />
              {shortAddr}
            </button>
          ) : (
            <button
              onClick={connectPhantom}
              disabled={phantomLoading || !phantomAvailable}
              style={{
                padding: "6px 16px", borderRadius: 6, border: "1px solid var(--accent)",
                background: phantomAvailable ? "var(--accent)" : "var(--bg-card)",
                fontSize: 12, fontWeight: 500,
                color: phantomAvailable ? "#fff" : "var(--text-muted)",
                cursor: phantomAvailable ? "pointer" : "not-allowed",
                whiteSpace: "nowrap",
                letterSpacing: "0.03em",
              }}
            >
              {phantomLoading ? "…" : phantomAvailable ? `👻 ${t("connectBtn")}` : "Install Phantom"}
            </button>
          )}

          <a
            href="https://x.com/thatbrianlau"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: 28, height: 28,
              background: "var(--bg-card)", border: "1px solid var(--border)",
              borderRadius: 5, textDecoration: "none", flexShrink: 0,
            }}
          >
            <svg width="13" height="13" viewBox="0 0 1200 1227" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M714.163 519.284L1160.89 0H1055.03L667.137 450.887L357.328 0H0L468.492 681.821L0 1226.37H105.866L515.491 750.218L842.672 1226.37H1200L714.163 519.284ZM569.165 687.828L521.697 619.934L144.011 79.6944H306.615L611.412 515.685L658.88 583.579L1055.08 1150.3H892.476L569.165 687.828Z" fill="var(--text-secondary)"/>
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
