"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import WaBijinSVG from "@/components/WaBijinSVG";
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
  const { lang, setLang } = useLang();
  const {
    walletAddress, shortAddr, walletLoading,
    phantomAvailable, okxAvailable,
    connect, disconnect, setShowLanding, setIsDemo,
  } = useWallet();
  const { timeBg } = useTheme();

  return (
    <header style={{
      borderBottom: "1px solid var(--border)",
      padding: "10px 24px",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      position: "sticky", top: 0, zIndex: 50,
      background: "var(--bg-header)",
      backdropFilter: "blur(16px)",
    }}>
      {/* Left: Logo */}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button
          onClick={() => { setIsDemo(false); setShowLanding(true); window.history.pushState({}, "", "/"); window.scrollTo({ top: 0, behavior: "smooth" }); }}
          style={{
            display: "flex", alignItems: "center", gap: 10,
            background: "none", border: "none", padding: 0, cursor: "pointer",
          }}
        >
          <div style={{ width: 28, height: 28, borderRadius: 6, overflow: "hidden", flexShrink: 0 }}>
            <WaBijinSVG size={28} />
          </div>
          <span className="jp-heading" style={{ fontSize: 16, fontWeight: 500, color: "var(--text-primary)", letterSpacing: "0.08em" }}>Sakura</span>
        </button>
        <span style={{
          fontSize: 10, color: "var(--text-muted)",
          borderLeft: "1px solid var(--border)", paddingLeft: 10,
          fontFamily: "var(--font-heading)", letterSpacing: "0.1em",
        }} title={timeBg.label}>
          {timeBg.name}
        </span>

        {/* Theme toggle removed — dark-only per v0.3 design decision */}
      </div>

      {/* Right: Lang + Wallet */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {/* Note: MCP API button removed from top nav — the landing
            subnav already carries 文檔 / 用例 / MCP API, so repeating
            it here was redundant. */}
        {/* Language switcher */}
        <div style={{ display: "flex", gap: 2, background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 6, padding: 3 }}>
          {LANG_OPTIONS.map(opt => (
            <button
              key={opt.code}
              onClick={() => setLang(opt.code)}
              style={{
                padding: "2px 7px", borderRadius: 4, border: "none",
                fontSize: 10, fontWeight: 500, cursor: "pointer",
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

        {/* Wallet button — only shown when connected */}
        {walletAddress && (
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
        )}

        {/* X/Twitter link */}
        <a
          href="https://x.com/sakuraaijp"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="X (Twitter)"
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 26, height: 26,
            background: "var(--bg-card)", border: "1px solid var(--border)",
            borderRadius: 5, textDecoration: "none", flexShrink: 0,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 1200 1227" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M714.163 519.284L1160.89 0H1055.03L667.137 450.887L357.328 0H0L468.492 681.821L0 1226.37H105.866L515.491 750.218L842.672 1226.37H1200L714.163 519.284ZM569.165 687.828L521.697 619.934L144.011 79.6944H306.615L611.412 515.685L658.88 583.579L1055.08 1150.3H892.476L569.165 687.828Z" fill="var(--text-secondary)"/>
          </svg>
        </a>

        {/* YouTube link */}
        <a
          href="https://www.youtube.com/@Sakuraaaijp"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="YouTube"
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: 26, height: 26,
            background: "var(--bg-card)", border: "1px solid var(--border)",
            borderRadius: 5, textDecoration: "none", flexShrink: 0,
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" fill="var(--text-secondary)"/>
          </svg>
        </a>
      </div>
    </header>
  );
}
