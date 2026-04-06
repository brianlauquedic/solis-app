"use client";

import Link from "next/link";
import { useLang } from "@/contexts/LanguageContext";

export default function Footer() {
  const { t, lang } = useLang();

  const product = [
    { label: t("footerFeatureSecurity"),   href: "/#security"    },
    { label: t("footerFeatureSmartMoney"), href: "/#smart-money" },
    { label: t("footerFeatureGuardian"),   href: "/#guardian"    },
    { label: t("footerFeatureCopyTrade"),  href: "/#copy-trade"  },
    { label: t("footerFeatureKline"),      href: "/#kline"       },
    { label: t("footerFeatureX402"),       href: "/#x402"        },
  ];

  const resources = [
    { label: t("footerDocs"),      href: "/docs"       },
    { label: t("footerUseCases"),  href: "/use-cases"  },
    { label: t("footerPricing"),   href: "/pricing"    },
  ];

  const community = [
    { label: "X (Twitter)", href: "https://x.com/" },
  ];

  const policy = [
    { label: t("footerTerms"),   href: "/terms"   },
    { label: t("footerPrivacy"), href: "/privacy" },
  ];

  return (
    <footer style={{
      borderTop: "1px solid var(--border)",
      background: "var(--bg-card)",
      padding: "48px 40px 28px",
      marginTop: 40,
    }}>
      {/* Top row */}
      <div style={{
        display: "flex", flexWrap: "wrap", gap: 40,
        marginBottom: 40,
        justifyContent: "space-between",
      }}>
        {/* Brand */}
        <div style={{ minWidth: 200, maxWidth: 280 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <div style={{
              width: 28, height: 28, background: "var(--accent)",
              borderRadius: 6, display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#fff",
            }}>S</div>
            <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-heading)" }}>
              Sakura
            </span>
          </div>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.8, margin: 0 }}>
            {t("footerTagline")}
          </p>
        </div>

        {/* Product */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14 }}>
            {t("footerProductSection")}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {product.map(item => (
              <Link key={item.href} href={item.href} style={{
                fontSize: 13, color: "var(--text-secondary)", textDecoration: "none",
                transition: "color 0.15s",
              }}
                onMouseEnter={e => (e.currentTarget.style.color = "var(--text-primary)")}
                onMouseLeave={e => (e.currentTarget.style.color = "var(--text-secondary)")}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Resources */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14 }}>
            {t("footerResourcesSection")}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {resources.map(item => (
              <Link key={item.href} href={item.href} style={{
                fontSize: 13, color: "var(--text-secondary)", textDecoration: "none",
                transition: "color 0.15s",
              }}
                onMouseEnter={e => (e.currentTarget.style.color = "var(--text-primary)")}
                onMouseLeave={e => (e.currentTarget.style.color = "var(--text-secondary)")}
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>

        {/* Community */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14 }}>
            {t("footerCommunitySection")}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {community.map(item => (
              <a key={item.href} href={item.href} target="_blank" rel="noopener noreferrer" style={{
                fontSize: 13, color: "var(--text-secondary)", textDecoration: "none",
                transition: "color 0.15s",
              }}
                onMouseEnter={e => (e.currentTarget.style.color = "var(--text-primary)")}
                onMouseLeave={e => (e.currentTarget.style.color = "var(--text-secondary)")}
              >
                {item.label}
              </a>
            ))}
          </div>
        </div>

        {/* Policy */}
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 14 }}>
            {t("footerPolicySection")}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {policy.map(item => (
              <Link key={item.href} href={item.href} style={{
                fontSize: 13, color: "var(--text-secondary)", textDecoration: "none",
                transition: "color 0.15s",
              }}
                onMouseEnter={e => (e.currentTarget.style.color = "var(--text-primary)")}
                onMouseLeave={e => (e.currentTarget.style.color = "var(--text-secondary)")}
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
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
          © 2026 Sakura AI · {t("footerBuiltOn")}
        </span>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <a href="https://x.com/" target="_blank" rel="noopener noreferrer"
            style={{ color: "var(--text-muted)", textDecoration: "none", fontSize: 12 }}
            onMouseEnter={e => (e.currentTarget.style.color = "var(--text-primary)")}
            onMouseLeave={e => (e.currentTarget.style.color = "var(--text-muted)")}
          >𝕏</a>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
            {lang === "zh" ? "非投資建議" : lang === "ja" ? "投資助言ではありません" : "Not financial advice"}
          </span>
        </div>
      </div>
    </footer>
  );
}
