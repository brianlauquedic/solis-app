"use client";

import { useRouter } from "next/navigation";
import WaBijinSVG from "@/components/WaBijinSVG";
import PriceTicker from "@/components/PriceTicker";
import SubscriptionBanner from "@/components/SubscriptionBanner";
import { useLang } from "@/contexts/LanguageContext";
import { useWallet } from "@/contexts/WalletContext";
import { useTheme } from "@/contexts/ThemeContext";
import type { Lang } from "@/lib/i18n";

const LANG_OPTIONS: { code: Lang; flag: string; label: string }[] = [
  { code: "en", flag: "🇺🇸", label: "EN" },
  { code: "ja", flag: "🇯🇵", label: "日本語" },
  { code: "zh", flag: "🇨🇳", label: "中文" },
];

export default function AppNav() {
  const router = useRouter();
  const { lang, setLang, t } = useLang();
  const { walletAddress, shortAddr, phantomLoading, phantomAvailable, connect, disconnect, setShowLanding } = useWallet();
  const { isDayMode, toggleDayMode, timeBg } = useTheme();

  return (
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
        <button
          onClick={() => { setShowLanding(true); router.push("/"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
          style={{
            display: "flex", alignItems: "center", gap: 10,
            background: "none", border: "none", padding: 0, cursor: "pointer",
          }}
        >
          <div style={{ width: 32, height: 32, borderRadius: 6, overflow: "hidden", flexShrink: 0 }}>
            <WaBijinSVG size={32} />
          </div>
          <span className="jp-heading" style={{ fontSize: 18, fontWeight: 500, color: "var(--text-primary)", letterSpacing: "0.08em" }}>Sakura</span>
        </button>
        <span style={{
          fontSize: 9, color: "var(--accent)", border: "1px solid var(--accent-mid)",
          borderRadius: 3, padding: "1px 5px", letterSpacing: 1.5, fontFamily: "var(--font-mono)",
        }}>BETA</span>
        <span style={{
          fontSize: 10, color: "var(--text-muted)",
          borderLeft: "1px solid var(--border)", paddingLeft: 10,
          fontFamily: "var(--font-heading)", letterSpacing: "0.1em",
        }} title={timeBg.label}>
          {timeBg.name}
        </span>
        <button
          onClick={toggleDayMode}
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
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.color = "var(--accent)";
            (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--accent)";
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.color = "var(--text-secondary)";
            (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--border)";
          }}
        >
          🌸 {t("pricing") ?? "定價"}
        </button>

        {walletAddress && (
          <SubscriptionBanner
            walletAddress={walletAddress}
            onSubscriptionChange={() => {}}
          />
        )}

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
            onClick={connect}
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
  );
}
