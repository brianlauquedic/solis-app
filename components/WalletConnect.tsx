"use client";

/**
 * WalletConnect.tsx — Sakura landing page.
 *
 * Rebuilt as a Kiyomizu-dera / Kinkaku-ji temple-style layout:
 *   • Full-width top nav with hairline rule (清水寺 style horizontal menu)
 *   • Asymmetric hero: 「美人觀印」 — bijin ukiyo-e gazing toward the 朱印
 *     seal, connected by a fine gold 視線 gaze-line
 *   • Sections keyed by classical 壱・弐・参・肆・伍・陸 numerals over
 *     mincho headings and full-width hairline rules
 *   • Desktop uses the full ~1200px canvas; mobile stacks cleanly
 *   • All i18n keys preserved from prior version.
 */

import { useState, useEffect } from "react";
import {
  Sparkles,
  Wallet,
  ExternalLink,
  PlayCircle,
  ArrowRight,
  Fingerprint,
  Lock,
  ShieldCheck,
  Zap,
  FileBadge,
  CheckCircle2,
} from "lucide-react";
import AnimatedNumber from "@/components/AnimatedNumber";
import { useLang } from "@/contexts/LanguageContext";
import WaBijinSVG from "@/components/WaBijinSVG";
import SakuraSeal from "@/components/SakuraSeal";
import { useWallet } from "@/contexts/WalletContext";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Seigaiha,
  Shippo,
  Asanoha,
} from "@/components/WaPattern";
import { cn } from "@/lib/utils";

const SITE_URL = "https://www.sakuraaai.com";
const PHANTOM_DEEPLINK = `https://phantom.app/ul/browse/${encodeURIComponent(SITE_URL)}`;
const OKX_DEEPLINK = `https://www.okx.com/download?deeplink=${encodeURIComponent(
  `okx://wallet/dapp/details?dappUrl=${encodeURIComponent(SITE_URL)}`
)}`;

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () =>
      setIsMobile(
        /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) &&
          window.innerWidth < 768
      );
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return isMobile;
}

const AGENT_KEYS = [
  {
    tag: "Intent Commitment",
    kanji: "意",
    Icon: Fingerprint,
    color: "var(--accent)",
    titleKey: "agent1Title" as const,
    descKey: "agent1Desc" as const,
  },
  {
    tag: "ZK Pairing Gate",
    kanji: "証",
    Icon: ShieldCheck,
    color: "var(--gold)",
    titleKey: "agent2Title" as const,
    descKey: "agent2Desc" as const,
  },
  {
    tag: "Atomic + Audit",
    kanji: "鎖",
    Icon: Lock,
    color: "#C9312A",
    titleKey: "agent3Title" as const,
    descKey: "agent3Desc" as const,
  },
  {
    tag: "Oracle Binding",
    kanji: "価",
    Icon: Zap,
    color: "var(--green)",
    titleKey: "agent4Title" as const,
    descKey: "agent4Desc" as const,
  },
];

const PROTOCOLS = [
  "Jupiter",
  "Marinade",
  "Jito",
  "Kamino",
  "GoPlus Security",
  "Helius RPC",
  "Solana Agent Kit",
  "Claude AI",
  "Stripe MPP",
];

const STATS = [
  { numValue: 4, suffix: "+", labelKey: "statLabel1" as const },
  { numValue: 116, suffix: "", labelKey: "statLabel2" as const },
  { numValue: 4, suffix: "B", labelKey: "statLabel3" as const },
  { numValue: 100, suffix: "%", labelKey: "statLabel4" as const },
];

interface Props {
  walletAddress?: string | null;
  onEnterApp?: () => void;
  onTryDemo?: () => void;
}

// ═══════════════════════════════════════════════════════════════════
// Main
// ═══════════════════════════════════════════════════════════════════

export default function WalletConnect({
  walletAddress,
  onEnterApp,
  onTryDemo,
}: Props = {}) {
  const { t, lang } = useLang();
  const { connect, phantomAvailable, okxAvailable, walletLoading } = useWallet();
  const isMobile = useIsMobile();
  const showMobileDeepLinks = isMobile && !phantomAvailable && !okxAvailable;

  return (
    <div className="landing-root">
      {/* ── Secondary section nav — 清水寺 style horizontal serif links,
          sits below the site-wide AppNav. Three classical menu items. ── */}
      <nav className="landing-subnav">
        <div className="landing-subnav-inner">
          <NavLink href="/docs" label={t("navDocs")} />
          <span className="landing-subnav-dot" aria-hidden />
          <NavLink href="/use-cases" label={t("navUseCases")} />
          <span className="landing-subnav-dot" aria-hidden />
          <NavLink href="/mcp" label="MCP API" accent />
        </div>
      </nav>

      <div className="landing-container">
        {/* ═══════════════════════════════════════════════════════════════
            Hero — 「美人觀印」 asymmetric 2-column composition
            Left: bijin + seal with fine gold 視線 gaze-line
            Right: title, tagline, body, CTA
            ═══════════════════════════════════════════════════════════════ */}
        <section className="landing-hero">
          <div className="landing-hero-bijin">
            <BijinSealComposition />
          </div>

          <div className="landing-hero-copy">
            {/* 勲章 Hackathon badge */}
            <Badge
              variant="outline"
              className="fade-in-up fade-in-up-1 mb-5 border-[var(--accent-mid)] bg-[var(--accent-soft)] font-mono text-[11px] tracking-[0.14em] text-[var(--accent)]"
            >
              <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
              {t("hackathonBadge")}
            </Badge>

            <h1
              className="jp-heading fade-in-up fade-in-up-1 hero-title mb-3"
              style={{
                color: "var(--text-primary)",
                fontWeight: 400,
                fontSize: "clamp(44px, 6vw, 72px)",
                lineHeight: 1.05,
                letterSpacing: "0.05em",
              }}
            >
              Sakura
            </h1>

            <div
              className="fade-in-up fade-in-up-1 hero-tagline mb-5"
              style={{
                color: "var(--accent)",
                fontFamily: "var(--font-heading)",
                fontSize: "14px",
                fontWeight: 500,
                letterSpacing: "0.32em",
              }}
            >
              {t("heroTagline")}
            </div>

            {/* 朱印 gold hairline divider */}
            <HairlineDivider className="mb-5" width={180} />

            <p
              className="fade-in-up fade-in-up-2 mb-7 mx-auto"
              style={{
                color: "var(--text-secondary)",
                fontSize: "15px",
                lineHeight: 2.0,
                letterSpacing: "0.02em",
                maxWidth: 560,
              }}
            >
              {t("heroSubtitle")}
            </p>

            {/* 信頼の証 Trust row — single centered 清水寺 caption line
                with gold · separators, replacing pill chips. */}
            <div className="trust-row text-[11px]">
              {(["trust1", "trust2", "trust3", "trust4"] as const).map((k, i) => (
                <span key={k} className="inline-flex items-center gap-3">
                  {i > 0 && <span className="trust-row-sep">·</span>}
                  <span>{t(k)}</span>
                </span>
              ))}
            </div>

            {/* 和式科技感 CTA panel — 鉤括弧 corner brackets, gold
                hairline dividers, generous padding. */}
            <div className="cta-panel">
              <span className="cta-panel-dot tr" aria-hidden />
              <span className="cta-panel-dot bl" aria-hidden />

              {walletAddress ? (
                <>
                  <div className="cta-label">
                    <span className="inline-block h-[7px] w-[7px] rounded-full bg-[var(--green)]" aria-hidden />
                    <span className="cta-label-text text-[14px]">
                      {t("connectedWallet")}
                    </span>
                  </div>
                  <div
                    className="cta-subnote mb-6 text-[12px]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {walletAddress.slice(0, 6)}…{walletAddress.slice(-6)}
                  </div>
                  <Button
                    onClick={onEnterApp}
                    size="lg"
                    className="w-full font-serif tracking-[0.06em]"
                    style={{ background: "var(--accent)", color: "#fff" }}
                  >
                    {t("enterApp")}
                    <ArrowRight className="ml-1.5 h-4 w-4" />
                  </Button>
                </>
              ) : (
                <>
                  <div className="cta-label">
                    <span className="cta-label-mark" aria-hidden>◈</span>
                    <span className="cta-label-text text-[14px]">
                      {t("ctaFreeLabel")}
                    </span>
                  </div>

                  <p className="cta-desc text-[12px] leading-[1.95]">
                    {t("ctaFreeDesc")}
                  </p>

                  <div className="cta-rule" aria-hidden>
                    <span className="cta-rule-dot" />
                  </div>

                  <div className="cta-specs text-[11px]">
                    {(["ctaFreeBadge1", "ctaFreeBadge2", "ctaFreeBadge3"] as const).map(
                      (key) => (
                        <span key={key} className="cta-spec">
                          <CheckCircle2 className="cta-spec-check" />
                          {t(key)}
                        </span>
                      )
                    )}
                  </div>

                  <div className="cta-rule" aria-hidden>
                    <span className="cta-rule-dot" />
                  </div>

                  <div className="cta-buttons">
                    {showMobileDeepLinks ? (
                      <MobileDeepLinks lang={lang} />
                    ) : (
                      <DesktopConnectButtons
                        connect={connect}
                        walletLoading={walletLoading}
                        phantomAvailable={phantomAvailable}
                        okxAvailable={okxAvailable}
                        phantomLabel={t("ctaFreeBtn")}
                      />
                    )}
                  </div>

                  <p className="cta-subnote text-[10px]">
                    {t("ctaSubNote")}
                  </p>

                  {onTryDemo && (
                    <>
                      <div className="cta-rule" aria-hidden>
                        <span className="cta-rule-dot" />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={onTryDemo}
                        className="w-full border-dashed border-[var(--border)] bg-transparent text-[12px] font-normal tracking-[0.06em]"
                        style={{ color: "var(--text-muted)" }}
                      >
                        <PlayCircle className="mr-1.5 h-3.5 w-3.5" />
                        {lang === "zh"
                          ? "無需錢包，體驗 Demo"
                          : lang === "ja"
                            ? "ウォレット不要でデモを体験"
                            : "Try Demo (no wallet needed)"}
                      </Button>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════
            壱 · Four Guardians — 意 証 鎖 価  (4-col on desktop)
            ═══════════════════════════════════════════════════════════════ */}
        <SectionHeading numeral="壱" title={t("agentsTitle")} />

        <div className="temple-card no-pad">
          <span className="temple-dot tr" aria-hidden />
          <span className="temple-dot bl" aria-hidden />
          <Shippo
            className="pointer-events-none absolute inset-0 z-0"
            opacity={0.04}
            size={40}
          />
          <div className="landing-agents relative z-[1] grid">
            {AGENT_KEYS.map((a) => (
              <div
                key={a.tag}
                className="landing-agent-cell relative z-[2] transition-colors hover:bg-[var(--bg-card-2)]/60"
              >
                <div className="mb-4 flex items-center gap-2.5">
                  <div
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md font-serif text-[15px]"
                    style={{
                      background: `${a.color}14`,
                      border: `1px solid ${a.color}30`,
                      color: a.color,
                    }}
                  >
                    {a.kanji}
                  </div>
                  <span
                    className="inline-flex items-center gap-1.5 font-mono text-[10px] tracking-[0.18em]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    <a.Icon className="h-3 w-3" style={{ color: a.color }} />
                    {a.tag}
                  </span>
                </div>
                <h3
                  className="jp-heading mb-2 text-[14px] font-normal tracking-[0.04em]"
                  style={{ color: "var(--text-primary)" }}
                >
                  {t(a.titleKey)}
                </h3>
                <p
                  className="text-[12px] leading-[1.95]"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {t(a.descKey)}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            弐 · 桜の物語 Origin — narrative (left) + tech primitives (right)
            ═══════════════════════════════════════════════════════════════ */}
        <SectionHeading numeral="弐" title={t("sakuraOriginBadge")} />

        <div className="landing-origin grid gap-6">
          <div className="temple-card">
            <span className="temple-dot tr" aria-hidden />
            <span className="temple-dot bl" aria-hidden />
            <Seigaiha
              className="pointer-events-none absolute inset-0"
              opacity={0.035}
              size={44}
            />
            <div className="relative z-[1] flex items-start gap-6">
              <div
                className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-[10px] font-serif text-[26px]"
                style={{
                  background: "var(--accent-soft)",
                  border: "1px solid var(--accent-mid)",
                  color: "var(--accent)",
                  boxShadow: "0 2px 12px rgba(201,49,42,0.1)",
                }}
              >
                桜
              </div>
              <div className="min-w-0 flex-1">
                <h2
                  className="jp-heading mb-4 text-[16px] font-normal tracking-[0.07em]"
                  style={{ color: "var(--text-primary)" }}
                >
                  {t("sakuraWho")}
                </h2>
                <p
                  className="mb-5 whitespace-pre-line text-[13px] leading-[2.0] tracking-[0.015em]"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {t("sakuraCharacterDesc")}
                </p>
                <div
                  className="mb-5 rounded-md border px-5 py-3 font-serif text-[13px] tracking-[0.05em]"
                  style={{
                    background: "var(--accent-soft)",
                    borderColor: "var(--accent-mid)",
                    color: "var(--accent)",
                  }}
                >
                  ◈ {t("sakuraMission")}
                </div>
                <div className="flex flex-wrap gap-2">
                  {(["sakuraJapanValue1", "sakuraJapanValue2", "sakuraJapanValue3"] as const).map(
                    (k) => (
                      <Badge
                        key={k}
                        variant="outline"
                        className="border-[var(--border)] bg-[var(--bg-base)] px-3 py-1.5 font-sans text-[11px] font-normal tracking-[0.03em]"
                        style={{ color: "var(--text-secondary)" }}
                      >
                        {t(k)}
                      </Badge>
                    )
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="temple-card">
            <span className="temple-dot tr" aria-hidden />
            <span className="temple-dot bl" aria-hidden />
            <div className="temple-caption text-[10.5px]">
              {lang === "zh"
                ? "Technical Primitives · 技術根幹"
                : lang === "ja"
                  ? "Technical Primitives · 技術の根幹"
                  : "Technical Primitives"}
            </div>
            <div className="flex flex-col gap-2.5">
              {(["sakuraTech1", "sakuraTech2", "sakuraTech3", "sakuraTech4"] as const).map(
                (k) => (
                  <div
                    key={k}
                    className="flex items-center gap-3 rounded border border-[var(--border)] bg-[var(--bg-base)] px-4 py-3 font-mono text-[11.5px] leading-[1.7] tracking-[0.015em]"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    <ArrowRight
                      className="h-3.5 w-3.5 flex-shrink-0"
                      style={{ color: "var(--accent)", opacity: 0.7 }}
                    />
                    <span>{t(k)}</span>
                  </div>
                )
              )}
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            参 · 差別化 Distinction
            ═══════════════════════════════════════════════════════════════ */}
        <SectionHeading numeral="参" title={t("diffTitle")} />

        <div className="temple-card">
          <span className="temple-dot tr" aria-hidden />
          <span className="temple-dot bl" aria-hidden />
          <div className="flex items-start gap-6">
            <div
              className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-md font-serif text-[18px]"
              style={{
                background: "var(--accent-soft)",
                border: "1px solid var(--accent-mid)",
                color: "var(--accent)",
              }}
            >
              証
            </div>
            <div className="min-w-0 flex-1">
              <p
                className="whitespace-pre-line text-[13px] leading-[2.0] tracking-[0.02em]"
                style={{ color: "var(--text-secondary)" }}
              >
                {t("diffDesc")}
              </p>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            肆 · x402 — Stripe MPP
            ═══════════════════════════════════════════════════════════════ */}
        <SectionHeading numeral="肆" title={t("stripeSectionTitle")} />

        <div className="temple-card">
          <span className="temple-dot tr" aria-hidden />
          <span className="temple-dot bl" aria-hidden />
          <Asanoha
            className="pointer-events-none absolute inset-0 z-0"
            opacity={0.025}
            size={52}
          />
          <div className="relative z-[1]">
            <div className="mb-5 flex items-center gap-3">
              <div
                className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md"
                style={{
                  background: "#635BFF20",
                  border: "1px solid #635BFF40",
                  color: "#8B87FF",
                }}
              >
                <FileBadge className="h-4 w-4" />
              </div>
              <span
                className="font-mono text-[11px] tracking-[0.22em]"
                style={{ color: "#8B87FF" }}
              >
                HTTP 402 · STRIPE MPP
              </span>
            </div>
            <p
              className="mb-6 text-[13px] leading-[2.0] tracking-[0.02em]"
              style={{ color: "var(--text-secondary)", maxWidth: 720 }}
            >
              {t("stripeSectionDesc")}
            </p>
            <div className="mb-5 grid gap-3 sm:grid-cols-3">
              {(["stripeFeature1", "stripeFeature2", "stripeFeature3"] as const).map((k) => (
                <div
                  key={k}
                  className="rounded border border-[var(--border)] bg-transparent px-4 py-3 text-[11.5px] leading-[1.7] tracking-[0.03em]"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {t(k)}
                </div>
              ))}
            </div>
            <div
              className="rounded border border-[var(--border)] bg-[var(--bg-base)] px-4 py-3 font-mono text-[11px] tracking-[0.05em]"
              style={{ color: "var(--text-muted)" }}
            >
              POST /api/mcp · HTTP 402 · x402-payment: 1.00 USDC · Solana Mainnet
            </div>
            <div className="mt-5 flex justify-end">
              <a
                href="/mcp"
                className="inline-flex items-center gap-1.5 font-mono text-[11.5px] tracking-[0.08em] transition-opacity hover:opacity-80"
                style={{ color: "#8B87FF" }}
              >
                MCP API 文檔 / Docs / ドキュメント
                <ArrowRight className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════
            伍 · Stats + 陸 · Protocols — two columns on desktop
            ═══════════════════════════════════════════════════════════════ */}
        <SectionHeading numeral="伍" title={
          lang === "zh" ? "数字で見る · 實力的證明"
          : lang === "ja" ? "数字で見る"
          : "By the Numbers"
        } />

        <div className="temple-card no-pad">
          <span className="temple-dot tr" aria-hidden />
          <span className="temple-dot bl" aria-hidden />
          <div className="landing-stats grid grid-cols-2 gap-px bg-[var(--border)] sm:grid-cols-4">
            {STATS.map((s) => (
              <div
                key={s.labelKey}
                className="bg-[var(--bg-card)] px-6 py-9 text-center transition-colors hover:bg-[var(--bg-card-2)]/60"
              >
                <div className="jp-mono text-[28px] font-bold">
                  <AnimatedNumber
                    value={s.numValue}
                    suffix={s.suffix}
                    decimals={s.numValue % 1 !== 0 ? 1 : 0}
                    duration={1400}
                    style={{ color: "var(--gold)", fontFamily: "var(--font-mono)" }}
                  />
                </div>
                <div
                  className="mt-3 text-[11px] leading-[1.6] tracking-[0.1em]"
                  style={{ color: "var(--text-muted)" }}
                >
                  {t(s.labelKey)}
                </div>
              </div>
            ))}
          </div>
        </div>

        <SectionHeading numeral="陸" title={t("integratedProtocols")} />

        <div className="temple-card">
          <span className="temple-dot tr" aria-hidden />
          <span className="temple-dot bl" aria-hidden />
          <div className="flex flex-wrap gap-2.5">
            {PROTOCOLS.map((name) => (
              <Badge
                key={name}
                variant="outline"
                className="border-[var(--border)] bg-[var(--bg-base)] px-4 py-2 font-sans text-[12px] font-normal tracking-[0.04em]"
                style={{ color: "var(--text-secondary)" }}
              >
                {name}
              </Badge>
            ))}
          </div>
        </div>

        {/* Closing mark */}
        <div
          className="landing-closing text-center"
          style={{ color: "var(--text-muted)" }}
        >
          <HairlineDivider width={260} className="mx-auto mb-3" />
          <div className="text-[11px] tracking-[0.2em]">
            {t("footerText")}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// 「美人觀印」Composition — bijin gazes toward the 朱印 seal,
// connected by a fine gold gaze-line with a tiny seal-dot midpoint.
// Responsive: side-by-side on ≥sm, stacked on mobile.
// ═══════════════════════════════════════════════════════════════════
function BijinSealComposition() {
  return (
    <div className="bijin-seal-composition" aria-hidden={false}>
      {/* 和美人 ukiyo-e — facing right, toward the seal */}
      <div className="bijin-frame">
        <WaBijinSVG size={280} height={360} />
      </div>

      {/* 視線 gaze-line connecting bijin → seal */}
      <div className="bijin-gazeline" aria-hidden>
        <span className="bijin-gazeline-rule" />
        <span className="bijin-gazeline-dot" />
        <span className="bijin-gazeline-rule" />
      </div>

      {/* 朱印 seal — the anchor she gazes toward */}
      <div className="bijin-seal">
        <SakuraSeal size={300} />
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Section Heading — 壱/弐/参 numeral + mincho title + full-width
// hairline rule beneath. Kiyomizu-style section opener.
// ═══════════════════════════════════════════════════════════════════
function SectionHeading({
  numeral,
  title,
}: {
  numeral: string;
  title: string;
}) {
  return (
    <div className="landing-section-heading">
      <div className="landing-section-heading-row">
        <span
          className="landing-section-numeral jp-heading"
          aria-hidden
        >
          {numeral}
        </span>
        <span
          className="landing-section-numeral-rule"
          aria-hidden
        />
        <h2 className="landing-section-title jp-heading">{title}</h2>
      </div>
      <div className="landing-section-fullrule" aria-hidden />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Hairline divider — gold fade with centered seal dot.
// ═══════════════════════════════════════════════════════════════════
function HairlineDivider({
  width = 220,
  className = "",
}: {
  width?: number;
  className?: string;
}) {
  return (
    <div
      className={cn("flex items-center gap-2", className)}
      style={{ width, maxWidth: "100%" }}
    >
      <span
        className="h-px flex-1"
        style={{
          background:
            "linear-gradient(to right, transparent, var(--gold) 40%, var(--gold) 60%, transparent)",
          opacity: 0.55,
        }}
      />
      <span
        className="inline-block h-1.5 w-1.5 rounded-full"
        style={{ background: "var(--accent)" }}
      />
      <span
        className="h-px flex-1"
        style={{
          background:
            "linear-gradient(to right, transparent, var(--gold) 40%, var(--gold) 60%, transparent)",
          opacity: 0.55,
        }}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════════

function NavLink({
  href,
  label,
  accent,
}: {
  href: string;
  label: string;
  accent?: boolean;
}) {
  return (
    <a
      href={href}
      className={cn(
        "jp-heading text-[13px] tracking-[0.2em] transition-colors",
        accent
          ? "text-[var(--accent)] hover:opacity-75"
          : "text-[var(--text-primary)] hover:text-[var(--accent)]"
      )}
    >
      {label}
    </a>
  );
}

function MobileDeepLinks({ lang }: { lang: string }) {
  return (
    <div className="space-y-2.5">
      <p
        className="mb-3.5 text-[11px] leading-[1.7] tracking-[0.02em]"
        style={{ color: "var(--text-secondary)" }}
      >
        {lang === "zh"
          ? "在錢包 App 的內置瀏覽器中打開 Sakura，即可連接錢包："
          : lang === "ja"
            ? "ウォレットアプリの内蔵ブラウザで Sakura を開いて接続："
            : "Open Sakura inside your wallet app's browser to connect:"}
      </p>
      <a
        href={PHANTOM_DEEPLINK}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md px-8 font-serif text-[14px] font-medium tracking-[0.05em] transition-opacity hover:opacity-90"
        style={{ background: "var(--accent)", color: "#fff" }}
      >
        <Wallet className="h-4 w-4" />
        {lang === "zh"
          ? "在 Phantom App 中打開"
          : lang === "ja"
            ? "Phantom App で開く"
            : "Open in Phantom App"}
      </a>
      <a
        href={OKX_DEEPLINK}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-md px-8 text-[14px] font-medium tracking-[0.05em] transition-opacity hover:opacity-90"
        style={{ background: "#1a1a2e", border: "1px solid #4a4aff", color: "#fff" }}
      >
        <Wallet className="h-4 w-4" />
        {lang === "zh"
          ? "在 OKX App 中打開"
          : lang === "ja"
            ? "OKX App で開く"
            : "Open in OKX App"}
      </a>
      <p
        className="mt-2 text-[10px] leading-[1.7] tracking-[0.02em]"
        style={{ color: "var(--text-muted)" }}
      >
        {lang === "zh"
          ? "點擊後將跳轉至對應錢包 App，在 App 內置瀏覽器中繼續操作"
          : lang === "ja"
            ? "タップするとウォレットアプリに移動し、内蔵ブラウザで続けてください"
            : "Tap to open your wallet app — continue in its built-in browser"}
      </p>
    </div>
  );
}

function DesktopConnectButtons({
  connect,
  walletLoading,
  phantomAvailable,
  okxAvailable,
  phantomLabel,
}: {
  connect: (provider?: "phantom" | "okx") => Promise<void>;
  walletLoading: boolean;
  phantomAvailable: boolean;
  okxAvailable: boolean;
  phantomLabel: string;
}) {
  return (
    <div className="space-y-2">
      <Button
        onClick={() => connect("phantom")}
        disabled={walletLoading}
        size="lg"
        className="w-full font-serif tracking-[0.06em]"
        style={{
          background: phantomAvailable ? "var(--accent)" : "var(--border)",
          color: "#fff",
        }}
      >
        <Wallet className="mr-2 h-4 w-4" />
        {walletLoading
          ? "…"
          : !phantomAvailable
            ? "Install Phantom"
            : phantomLabel}
        {!phantomAvailable && !walletLoading && (
          <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
        )}
      </Button>
      <Button
        onClick={() => connect("okx")}
        disabled={walletLoading}
        size="lg"
        variant="outline"
        className="w-full tracking-[0.06em]"
        style={{
          background: okxAvailable ? "#1a1a2e" : "var(--border)",
          borderColor: okxAvailable ? "#4a4aff" : "var(--border)",
          color: okxAvailable ? "#fff" : "var(--text-muted)",
        }}
      >
        <Sparkles className="mr-2 h-4 w-4" />
        {!okxAvailable ? "Install OKX Wallet" : "Connect OKX Wallet"}
        {!okxAvailable && !walletLoading && (
          <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
        )}
      </Button>
    </div>
  );
}
