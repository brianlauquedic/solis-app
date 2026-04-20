"use client";

/**
 * WalletConnect.tsx — Sakura landing page (pre-login hero + full
 * narrative stack). Completely rewritten with Shadcn UI, Lucide icons,
 * and 和柄 Wa-gara SVG pattern backgrounds. All i18n keys and wallet
 * connection logic preserved from the prior inline-styled version.
 */

import { useState, useEffect } from "react";
import {
  Sparkles,
  BookText,
  Layers,
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
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Seigaiha,
  Shippo,
  Asanoha,
  KyokaiDivider,
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

// 4 agent cards — each = one circuit guarantee.
// Icons = Lucide for technical clarity; kanji label sits above each.
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
    <div className="mx-auto max-w-[760px]">
      {/* ── Top nav ── */}
      <nav className="mb-10 flex items-center justify-end gap-2">
        <NavLink href="/docs" icon={<BookText className="h-3 w-3" />} label="Docs" />
        <NavLink href="/use-cases" icon={<Layers className="h-3 w-3" />} label="Use Cases" />
        <NavLink
          href="/mcp"
          icon={<Zap className="h-3 w-3" />}
          label="MCP API"
          accent
        />
      </nav>

      {/* ═══════════════════════════════════════════════════════════════
          Hero
          ═══════════════════════════════════════════════════════════════ */}
      <div className="relative mb-14 text-center">
        {/* 勲章 Hackathon badge */}
        <Badge
          variant="outline"
          className="fade-in-up fade-in-up-1 mb-7 border-[var(--accent-mid)] bg-[var(--accent-soft)] font-mono text-[11px] tracking-[0.14em] text-[var(--accent)]"
        >
          <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
          {t("hackathonBadge")}
        </Badge>

        {/* 朱印 + 和美人 — dramatic seal moment + ukiyo-e bijin */}
        <div className="mx-auto mb-5 flex items-center justify-center gap-8">
          {/* 和美人 ukiyo-e portrait */}
          <div style={{ width: 140, height: 186 }} className="hero-logo flex-shrink-0">
            <WaBijinSVG size={140} height={186} />
          </div>

          {/* 朱印 seal — the brand's defining anchor */}
          <SakuraSeal size={190} />
        </div>

        {/* 題字 Title — serif on cream, deep 墨 ink */}
        <h1
          className="jp-heading fade-in-up fade-in-up-1 hero-title mb-2 text-[52px] leading-[1.1] tracking-[0.06em]"
          style={{ color: "var(--text-primary)", fontWeight: 400 }}
        >
          Sakura
        </h1>

        <div
          className="fade-in-up fade-in-up-1 hero-tagline mb-4 text-[13px] tracking-[0.32em]"
          style={{
            color: "var(--accent)",
            fontFamily: "var(--font-heading)",
            fontWeight: 500,
          }}
        >
          {t("heroTagline")}
        </div>

        {/* 朱印 divider — fine gold hairline with seal dot */}
        <div className="mx-auto mb-5 flex max-w-[240px] items-center gap-2">
          <div
            className="h-px flex-1"
            style={{
              background:
                "linear-gradient(to right, transparent, var(--gold) 40%, var(--gold) 60%, transparent)",
              opacity: 0.5,
            }}
          />
          <span
            className="inline-block h-1.5 w-1.5 rounded-full"
            style={{ background: "var(--accent)" }}
          />
          <div
            className="h-px flex-1"
            style={{
              background:
                "linear-gradient(to right, transparent, var(--gold) 40%, var(--gold) 60%, transparent)",
              opacity: 0.5,
            }}
          />
        </div>

        <p
          className="fade-in-up fade-in-up-2 mx-auto mb-7 max-w-[480px] text-[13px] leading-[2.0] tracking-[0.02em]"
          style={{ color: "var(--text-secondary)" }}
        >
          {t("heroSubtitle")}
        </p>

        {/* 信頼の証 Trust badges */}
        <div className="mb-8 flex flex-wrap justify-center gap-2">
          {(["trust1", "trust2", "trust3", "trust4"] as const).map((k) => (
            <Badge
              key={k}
              variant="outline"
              className="border-[var(--border)] bg-[var(--bg-card)]/60 px-3 py-1 font-sans text-[11px] font-normal tracking-[0.03em] text-[var(--text-secondary)]"
            >
              {t(k)}
            </Badge>
          ))}
        </div>

        {/* ─── CTA Card ─── */}
        <Card className="relative mx-auto mb-14 max-w-[460px] overflow-hidden border-[var(--border)] bg-[var(--bg-card)]">
          <div
            className="absolute left-0 right-0 top-0 h-[2px]"
            style={{ background: "var(--accent)" }}
          />
          <CardContent className="p-6 text-center sm:p-7">
            {walletAddress ? (
              <>
                <div className="mb-2.5 flex items-center justify-center gap-2">
                  <span className="inline-block h-[7px] w-[7px] rounded-full bg-[var(--green)]" />
                  <span className="jp-heading text-[14px] tracking-[0.06em] text-[var(--text-primary)]">
                    {t("connectedWallet")}
                  </span>
                </div>
                <div
                  className="mb-5 font-mono text-[12px] tracking-[0.05em]"
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
                <div className="jp-heading mb-1.5 text-[14px] tracking-[0.06em] text-[var(--text-primary)]">
                  {t("ctaFreeLabel")}
                </div>
                <p
                  className="mb-4 text-[12px] leading-[1.8] tracking-[0.02em]"
                  style={{ color: "var(--text-secondary)" }}
                >
                  {t("ctaFreeDesc")}
                </p>
                <div className="mb-4 flex flex-wrap justify-center gap-2">
                  {(["ctaFreeBadge1", "ctaFreeBadge2", "ctaFreeBadge3"] as const).map(
                    (key) => (
                      <Badge
                        key={key}
                        variant="outline"
                        className="gap-1 border-[var(--border-light)] bg-transparent px-2.5 py-1 font-sans text-[11px] font-normal tracking-[0.04em] text-[var(--text-secondary)]"
                      >
                        <CheckCircle2 className="h-3 w-3" style={{ color: "var(--green)" }} />
                        {t(key)}
                      </Badge>
                    )
                  )}
                </div>

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

                <p
                  className="mt-2.5 text-[10px] tracking-[0.03em]"
                  style={{ color: "var(--text-muted)" }}
                >
                  {t("ctaSubNote")}
                </p>

                {onTryDemo && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onTryDemo}
                    className="mt-3.5 w-full border-dashed border-[var(--border)] bg-transparent text-[12px] font-normal tracking-[0.06em]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    <PlayCircle className="mr-1.5 h-3.5 w-3.5" />
                    {lang === "zh"
                      ? "無需錢包，體驗 Demo"
                      : lang === "ja"
                        ? "ウォレット不要でデモを体験"
                        : "Try Demo (no wallet needed)"}
                  </Button>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          桜 Sakura Character Narrative
          ═══════════════════════════════════════════════════════════════ */}
      <Card className="relative mb-7 overflow-hidden border-[var(--border)] bg-[var(--bg-card)]">
        <div
          className="absolute left-0 right-0 top-0 h-[2px]"
          style={{ background: "var(--accent)" }}
        />
        <Seigaiha
          className="pointer-events-none absolute inset-0"
          opacity={0.035}
          size={44}
        />

        <CardContent className="relative z-10 p-7">
          <Badge
            variant="outline"
            className="mb-5 border-[rgba(255,75,75,0.2)] bg-[rgba(255,75,75,0.06)] font-mono text-[10px] tracking-[0.15em]"
            style={{ color: "var(--accent)" }}
          >
            {t("sakuraOriginBadge")}
          </Badge>

          <div className="flex items-start gap-5">
            {/* 桜 Kanji crest */}
            <div
              className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[10px] font-serif text-[22px]"
              style={{
                background: "var(--accent-soft)",
                border: "1px solid var(--accent-mid)",
                color: "var(--accent)",
                boxShadow: "0 2px 12px rgba(255,75,75,0.1)",
              }}
            >
              桜
            </div>

            <div className="min-w-0 flex-1">
              <h2
                className="jp-heading mb-3 text-[15px] font-normal tracking-[0.07em]"
                style={{ color: "var(--text-primary)" }}
              >
                {t("sakuraWho")}
              </h2>

              <p
                className="mb-4 whitespace-pre-line text-[13px] leading-[2.0] tracking-[0.015em]"
                style={{ color: "var(--text-secondary)" }}
              >
                {t("sakuraCharacterDesc")}
              </p>

              {/* Mission callout */}
              <div
                className="mb-4 rounded-md border px-4 py-2.5 font-serif text-[12.5px] tracking-[0.05em]"
                style={{
                  background: "var(--accent-soft)",
                  borderColor: "var(--accent-mid)",
                  color: "var(--accent)",
                }}
              >
                ◈ {t("sakuraMission")}
              </div>

              {/* 3 cultural pills */}
              <div className="mb-4 flex flex-wrap gap-2">
                {(["sakuraJapanValue1", "sakuraJapanValue2", "sakuraJapanValue3"] as const).map(
                  (k) => (
                    <Badge
                      key={k}
                      variant="outline"
                      className="border-[var(--border)] bg-[var(--bg-base)] px-2.5 py-1 font-sans text-[10.5px] font-normal tracking-[0.03em]"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {t(k)}
                    </Badge>
                  )
                )}
              </div>

              {/* 4 tech primitive bullets */}
              <div className="flex flex-col gap-1.5">
                {(["sakuraTech1", "sakuraTech2", "sakuraTech3", "sakuraTech4"] as const).map(
                  (k) => (
                    <div
                      key={k}
                      className="flex items-center gap-2 rounded border border-[var(--border)] bg-[var(--bg-base)] px-3 py-1.5 font-mono text-[11px] leading-[1.6] tracking-[0.015em]"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      <ArrowRight
                        className="h-3 w-3 flex-shrink-0"
                        style={{ color: "var(--accent)", opacity: 0.7 }}
                      />
                      <span>{t(k)}</span>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════════════════════════
          Four Agent Cards — 意 証 鎖 価
          ═══════════════════════════════════════════════════════════════ */}
      <div className="mb-4">
        <div
          className="jp-heading mb-4 text-[10.5px] font-normal uppercase tracking-[0.2em]"
          style={{ color: "var(--text-muted)" }}
        >
          {t("agentsTitle")}
        </div>
        <KyokaiDivider className="mb-4" />

        <div
          className="feature-grid relative grid grid-cols-1 overflow-hidden rounded-lg border sm:grid-cols-2"
          style={{ borderColor: "var(--border)", background: "var(--bg-card)" }}
        >
          <Shippo
            className="pointer-events-none absolute inset-0 z-0"
            opacity={0.04}
            size={40}
          />
          {AGENT_KEYS.map((a, idx) => (
            <div
              key={a.tag}
              className="relative z-10 p-6 transition-colors hover:bg-[var(--bg-card-2)]/60"
              style={{
                // Hairline dividers between cards — bottom border on top
                // row, right border on left column. No top-border color
                // bar (that was creating the red horizontal slice).
                borderRight:
                  idx % 2 === 0 ? "1px solid var(--border)" : "none",
                borderBottom:
                  idx < 2 ? "1px solid var(--border)" : "none",
              }}
            >
              <div className="mb-3 flex items-center gap-2.5">
                <div
                  className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md font-serif text-[14px]"
                  style={{
                    background: `${a.color}14`,
                    border: `1px solid ${a.color}30`,
                    color: a.color,
                  }}
                >
                  {a.kanji}
                </div>
                <span
                  className="inline-flex items-center gap-1.5 font-mono text-[9.5px] tracking-[0.15em]"
                  style={{ color: "var(--text-muted)" }}
                >
                  <a.Icon className="h-3 w-3" style={{ color: a.color }} />
                  {a.tag}
                </span>
              </div>
              <h3
                className="jp-heading mb-1.5 text-[13.5px] font-normal tracking-[0.04em]"
                style={{ color: "var(--text-primary)" }}
              >
                {t(a.titleKey)}
              </h3>
              <p
                className="text-[11.5px] leading-[1.9]"
                style={{ color: "var(--text-secondary)" }}
              >
                {t(a.descKey)}
              </p>
            </div>
          ))}
        </div>
      </div>

      <Separator className="my-6 bg-[var(--border)]" />

      {/* ═══════════════════════════════════════════════════════════════
          Differentiator — 証
          ═══════════════════════════════════════════════════════════════ */}
      <Card className="mb-3 border-[var(--border)] bg-[var(--bg-card)]">
        <div
          className="absolute left-0 top-0 h-full w-[2px]"
          style={{ background: "var(--accent)" }}
        />
        <CardContent className="relative flex items-start gap-4 p-5">
          <div
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md font-serif text-[13px]"
            style={{
              background: "var(--accent-soft)",
              border: "1px solid var(--accent-mid)",
              color: "var(--accent)",
            }}
          >
            証
          </div>
          <div className="min-w-0 flex-1">
            <h3
              className="jp-heading mb-1.5 text-[13.5px] font-normal tracking-[0.04em]"
              style={{ color: "var(--text-primary)" }}
            >
              {t("diffTitle")}
            </h3>
            <p
              className="whitespace-pre-line text-[12px] leading-[1.95] tracking-[0.02em]"
              style={{ color: "var(--text-secondary)" }}
            >
              {t("diffDesc")}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ═══════════════════════════════════════════════════════════════
          x402 — Stripe MPP
          ═══════════════════════════════════════════════════════════════ */}
      <Card className="relative mb-3 overflow-hidden border-[var(--border)] bg-[var(--bg-card)]">
        <div
          className="absolute left-0 top-0 h-full w-[2px]"
          style={{ background: "#635BFF" }}
        />
        <Asanoha
          className="pointer-events-none absolute inset-0 z-0"
          opacity={0.025}
          size={52}
        />
        <CardContent className="relative z-10 p-5">
          <div className="mb-2.5 flex items-center gap-2.5">
            <div
              className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md"
              style={{
                background: "#635BFF20",
                border: "1px solid #635BFF40",
                color: "#8B87FF",
              }}
            >
              <FileBadge className="h-4 w-4" />
            </div>
            <h3
              className="jp-heading text-[13.5px] font-normal tracking-[0.04em]"
              style={{ color: "var(--text-primary)" }}
            >
              {t("stripeSectionTitle")}
            </h3>
          </div>
          <p
            className="mb-3 text-[12px] leading-[1.95] tracking-[0.02em]"
            style={{ color: "var(--text-secondary)" }}
          >
            {t("stripeSectionDesc")}
          </p>
          <div className="mb-2.5 flex flex-col gap-1.5">
            {(["stripeFeature1", "stripeFeature2", "stripeFeature3"] as const).map((k) => (
              <div
                key={k}
                className="rounded border border-[var(--border)] bg-transparent px-3 py-1.5 text-[11px] tracking-[0.03em]"
                style={{ color: "var(--text-secondary)" }}
              >
                {t(k)}
              </div>
            ))}
          </div>
          <div
            className="mt-3 rounded border border-[var(--border)] bg-[var(--bg-base)] px-3 py-2 font-mono text-[10.5px] tracking-[0.05em]"
            style={{ color: "var(--text-muted)" }}
          >
            POST /api/mcp · HTTP 402 · x402-payment: 1.00 USDC · Solana Mainnet
          </div>
          <div className="mt-3 flex justify-end">
            <a
              href="/mcp"
              className="inline-flex items-center gap-1 font-mono text-[11px] tracking-[0.06em] transition-opacity hover:opacity-80"
              style={{ color: "#8B87FF" }}
            >
              <ArrowRight className="h-3 w-3" />
              MCP API 文檔 / Docs / ドキュメント
            </a>
          </div>
        </CardContent>
      </Card>

      <Separator className="my-6 bg-[var(--border)]" />

      {/* ═══════════════════════════════════════════════════════════════
          Stats strip — 4 tiles
          ═══════════════════════════════════════════════════════════════ */}
      <div className="stats-grid mb-3 grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-[var(--border)] sm:grid-cols-4">
        {STATS.map((s) => (
          <div
            key={s.labelKey}
            className="bg-[var(--bg-card)] px-4 py-5 text-center transition-colors hover:bg-[var(--bg-card-2)]/60"
          >
            <div className="jp-mono text-[22px] font-bold">
              <AnimatedNumber
                value={s.numValue}
                suffix={s.suffix}
                decimals={s.numValue % 1 !== 0 ? 1 : 0}
                duration={1400}
                style={{ color: "var(--gold)", fontFamily: "var(--font-mono)" }}
              />
            </div>
            <div
              className="mt-1 text-[10.5px] leading-[1.5] tracking-[0.06em]"
              style={{ color: "var(--text-muted)" }}
            >
              {t(s.labelKey)}
            </div>
          </div>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          Protocol ecosystem
          ═══════════════════════════════════════════════════════════════ */}
      <Card className="mb-4 border-[var(--border)] bg-[var(--bg-card)]">
        <CardContent className="p-4">
          <div
            className="mb-2.5 font-mono text-[9.5px] uppercase tracking-[0.18em]"
            style={{ color: "var(--text-muted)" }}
          >
            {t("integratedProtocols")}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {PROTOCOLS.map((name) => (
              <Badge
                key={name}
                variant="outline"
                className="border-[var(--border)] bg-[var(--bg-base)] px-2.5 py-0.5 font-sans text-[11px] font-normal tracking-[0.03em]"
                style={{ color: "var(--text-secondary)" }}
              >
                {name}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      <div
        className="text-center text-[10px] tracking-[0.08em]"
        style={{ color: "var(--text-muted)" }}
      >
        {t("footerText")}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════════

function NavLink({
  href,
  icon,
  label,
  accent,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  accent?: boolean;
}) {
  return (
    <a
      href={href}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1",
        "font-mono text-[11px] tracking-[0.06em] transition-colors",
        accent
          ? "border-[var(--accent-mid)] bg-[var(--accent-soft)] text-[var(--accent)] hover:bg-[var(--accent-soft)]/70"
          : "border-[var(--border)] bg-[var(--bg-card)] text-[var(--text-muted)] hover:text-[var(--text-primary)]"
      )}
    >
      {icon}
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
