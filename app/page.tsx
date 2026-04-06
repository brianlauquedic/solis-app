"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import WalletConnect from "@/components/WalletConnect";
import HealthReport from "@/components/HealthReport";
import TokenAnalysis from "@/components/TokenAnalysis";
import DefiAssistant from "@/components/DefiAssistant";
import AgentPanel from "@/components/AgentPanel";
import PriceTicker from "@/components/PriceTicker";
import ErrorBoundary from "@/components/ErrorBoundary";
import SubscriptionBanner from "@/components/SubscriptionBanner";
import { LanguageProvider, useLang } from "@/contexts/LanguageContext";
import WaBijinSVG from "@/components/WaBijinSVG";
import Footer from "@/components/Footer";
import type { Lang } from "@/lib/i18n";

type Tab = "health" | "token" | "defi" | "agent";

interface WalletSnapshot {
  solBalance: number;
  totalUSD: number;
  idleUSDC: number;
}

const LANG_OPTIONS: { code: Lang; flag: string; label: string }[] = [
  { code: "en", flag: "🇺🇸", label: "EN" },
  { code: "ja", flag: "🇯🇵", label: "日本語" },
  { code: "zh", flag: "🇨🇳", label: "中文" },
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
  const router = useRouter();
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [showLanding, setShowLanding] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("health");
  const [walletSnapshot, setWalletSnapshot] = useState<WalletSnapshot | undefined>();
  const [phantomLoading, setPhantomLoading] = useState(false);
  const [phantomAvailable, setPhantomAvailable] = useState(false);
  const [timeBg, setTimeBg] = useState(getTimeColor());
  const [isDayMode, setIsDayMode] = useState(false);

  // Restore persisted day/night preference
  useEffect(() => {
    const saved = localStorage.getItem("sakura_day_mode");
    if (saved === "1") setIsDayMode(true);
  }, []);

  // Restore persisted wallet connection
  useEffect(() => {
    const saved = localStorage.getItem("sakura_wallet");
    if (saved) setWalletAddress(saved);
  }, []);

  // Update background every minute
  useEffect(() => {
    const tick = () => setTimeBg(getTimeColor());
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  // 昼夜 Day/Night CSS variable override
  const dayVars = isDayMode ? {
    "--bg-base":      "#F2EBE0",
    "--bg-card":      "#EAE0D0",
    "--bg-card-2":    "#E0D4C0",
    "--bg-header":    "rgba(242,235,224,0.95)",
    "--border":       "#C8B89A",
    "--border-light": "#B8A880",
    "--text-primary": "#2A1A10",
    "--text-secondary":"#6B5540",
    "--text-muted":   "#9B8570",
    "--accent-soft":  "rgba(192,57,43,0.08)",
    "--accent-mid":   "rgba(192,57,43,0.18)",
    "--gold":         "#8B6520",
    "--gold-soft":    "rgba(139,101,32,0.10)",
    "--green":        "#2D6040",
    "--green-soft":   "rgba(45,96,64,0.12)",
  } as React.CSSProperties : {} as React.CSSProperties;

  useEffect(() => {
    const t = setTimeout(() => setPhantomAvailable(!!window.solana?.isPhantom), 300);
    return () => clearTimeout(t);
  }, []);

  async function connectPhantom() {
    if (!window.solana) return;
    setPhantomLoading(true);
    try {
      const resp = await window.solana.connect();
      const addr = resp.publicKey.toString();
      setWalletAddress(addr);
      localStorage.setItem("sakura_wallet", addr);
    } catch {
      // user rejected
    } finally {
      setPhantomLoading(false);
    }
  }

  function disconnect() {
    setWalletAddress(null);
    setWalletSnapshot(undefined);
    localStorage.removeItem("sakura_wallet");
    window.solana?.disconnect?.();
  }

  const shortAddr = walletAddress
    ? `${walletAddress.slice(0, 4)}...${walletAddress.slice(-4)}`
    : null;

  const isDay = new Date().getHours() >= 6 && new Date().getHours() < 18;

  return (
    <main className="min-h-screen" style={{
      background: isDayMode ? "var(--bg-base)" : timeBg.bg,
      transition: "background 1.5s ease, color 1.5s ease",
      ...dayVars,
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
          {/* 和美人 Wa-bijin logo — click to go home */}
          <button
            onClick={walletAddress ? () => setShowLanding(true) : undefined}
            title={walletAddress ? "Home" : undefined}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              background: "none", border: "none", padding: 0,
              cursor: walletAddress ? "pointer" : "default",
            }}
          >
            <div style={{
              width: 32, height: 32, borderRadius: 6,
              overflow: "hidden",
              flexShrink: 0,
            }}>
              <WaBijinSVG size={32} />
            </div>
            <span className="jp-heading" style={{ fontSize: 18, fontWeight: 500, color: "var(--text-primary)", letterSpacing: "0.08em" }}>Sakura</span>
          </button>
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
          {/* 昼夜切替 Day/Night toggle */}
          <button
            onClick={() => setIsDayMode(v => {
            localStorage.setItem("sakura_day_mode", v ? "0" : "1");
            return !v;
          })}
            title={isDayMode ? t("switchToNight") : t("switchToDay")}
            style={{
              display: "flex", alignItems: "center", gap: 5,
              padding: "4px 10px", borderRadius: 6, cursor: "pointer",
              border: "1px solid var(--border)",
              background: isDayMode ? "#F2EBE0" : "var(--bg-card)",
              color: isDayMode ? "#2A1A10" : "var(--text-secondary)",
              fontSize: 12, transition: "all 0.3s ease",
              fontFamily: "var(--font-body)",
            }}
          >
            <span style={{ fontSize: 14 }}>{isDayMode ? "☀️" : "🌙"}</span>
            <span style={{ fontSize: 10, letterSpacing: "0.05em" }}>
              {isDayMode ? t("dayMode") : t("nightMode")}
            </span>
          </button>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <PriceTicker />

          {/* 定價入口 — 不需要連錢包 */}
          <button
            onClick={() => router.push("/pricing")}
            style={{
              padding: "5px 14px", borderRadius: 6, cursor: "pointer",
              border: "1px solid var(--border)",
              background: "var(--bg-card)",
              color: "var(--text-secondary)",
              fontSize: 12, fontWeight: 600,
              fontFamily: "var(--font-body)",
              transition: "all 0.15s",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--accent)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent)"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)"; (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)"; }}
          >
            🌸 {t("pricing") ?? "定價"}
          </button>

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
            href="https://x.com/sakuraaijp"
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
                  onDisconnect={() => { setWalletAddress(null); setWalletSnapshot(undefined); }}
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
