"use client";

import Link from "next/link";
import WaBijinSVG from "@/components/WaBijinSVG";
import { useLang } from "@/contexts/LanguageContext";
import { useWallet } from "@/contexts/WalletContext";

const X_URL = "https://x.com/sakuraaijp";
const YOUTUBE_URL = "https://www.youtube.com/@Sakuraaaijp";

export default function Footer() {
  const { t, lang } = useLang();
  const { setShowLanding } = useWallet();

  const resources: Array<{ label: string; href: string; external?: boolean }> = [
    { label: t("footerTestingGuide"), href: "/testing"   },
    { label: t("footerUserGuide"),    href: "/guide"     },
    { label: t("footerDocs"),         href: "/docs"      },
    { label: t("footerUseCases"),     href: "/use-cases" },
    { label: "MCP API",               href: "/mcp"       },
  ];

  const social = [
    { label: "𝕏  @sakuraaijp", href: X_URL },
    { label: "▶  YouTube · @Sakuraaaijp", href: YOUTUBE_URL },
  ];

  const policy = [
    { label: t("footerTerms"),   href: "/terms"   },
    { label: t("footerPrivacy"), href: "/privacy" },
  ];

  const linkStyle: React.CSSProperties = {
    fontSize: 13,
    color: "var(--text-primary)",
    textDecoration: "none",
    opacity: 0.65,
    transition: "opacity 0.15s",
  };

  return (
    <footer className="footer-root" style={{
      borderTop: "1px solid var(--border)",
      background: "var(--bg-card)",
      padding: "48px 40px 28px",
      marginTop: 40,
    }}>
      {/* Top row */}
      <div className="footer-top-row" style={{
        display: "flex", flexWrap: "wrap", gap: 48,
        marginBottom: 40,
        justifyContent: "space-between",
      }}>
        {/* Brand */}
        <div className="footer-brand" style={{ minWidth: 200, maxWidth: 260 }}>
          <Link href="/" onClick={() => { setShowLanding(true); window.scrollTo({ top: 0, behavior: "smooth" }); }} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12, textDecoration: "none" }}>
            <div style={{ width: 28, height: 28, borderRadius: 6, overflow: "hidden", flexShrink: 0 }}>
              <WaBijinSVG size={28} />
            </div>
            <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-heading)" }}>
              Sakura
            </span>
          </Link>
          <p style={{ fontSize: 12, color: "var(--text-primary)", lineHeight: 1.9, margin: 0, opacity: 0.6 }}>
            {t("footerTagline")}
          </p>
        </div>

        {/* Resources */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-primary)", opacity: 0.45, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14 }}>
            {t("footerResourcesSection")}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {resources.map(item => item.external ? (
              <a key={item.href} href={item.href} target="_blank" rel="noopener noreferrer"
                style={linkStyle}
                onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = "1"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = "0.65"; }}
              >
                {item.label} ↗
              </a>
            ) : (
              <Link key={item.href} href={item.href}
                style={linkStyle}
                onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = "1"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = "0.65"; }}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Social Media */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-primary)", opacity: 0.45, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14 }}>
            {t("footerCommunitySection")}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {social.map(item => (
              <a key={item.href} href={item.href} target="_blank" rel="noopener noreferrer"
                style={linkStyle}
                onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = "1"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = "0.65"; }}
              >
                {item.label}
              </a>
            ))}
          </div>
        </div>

        {/* Policy */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-primary)", opacity: 0.45, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14 }}>
            {t("footerPolicySection")}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {policy.map(item => (
              <Link key={item.href} href={item.href}
                style={linkStyle}
                onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = "1"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = "0.65"; }}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div style={{
        borderTop: "1px solid var(--border)",
        paddingTop: 20,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: 12,
      }}>
        <span style={{ fontSize: 11, color: "var(--text-primary)", opacity: 0.4 }}>
          © 2026 Sakura AI · {t("footerBuiltOn")}
        </span>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <a href={X_URL} target="_blank" rel="noopener noreferrer"
            style={{ color: "var(--text-primary)", opacity: 0.5, textDecoration: "none", fontSize: 13 }}
            onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = "1"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = "0.5"; }}
          >𝕏 @sakuraaijp</a>
          <a href={YOUTUBE_URL} target="_blank" rel="noopener noreferrer"
            style={{ color: "var(--text-primary)", opacity: 0.5, textDecoration: "none", fontSize: 13 }}
            onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = "1"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.opacity = "0.5"; }}
          >▶ @Sakuraaaijp</a>
        </div>
      </div>
    </footer>
  );
}
