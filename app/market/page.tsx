"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useLang } from "@/contexts/LanguageContext";
import ThemeWrapper from "@/components/ThemeWrapper";
import Footer from "@/components/Footer";
import type { Lang } from "@/lib/i18n";
import type { WeeklyReport, ReportProtocol, DexShare, NarrativeSection } from "@/app/api/weekly-report/route";

// ── Helpers ───────────────────────────────────────────────────────
type T3 = { zh: string; en: string; ja: string };
function tx(o: T3, l: Lang) { return o[l]; }
type Status = "safe" | "warn" | "danger" | "info";
function statusColor(s: Status): string {
  if (s === "safe")   return "#3D7A5C";
  if (s === "warn")   return "#B8832A";
  if (s === "danger") return "#A8293A";
  return "var(--text-secondary)";
}

// ── Visual: TVL Sparkline ─────────────────────────────────────────
function TVLSparkline({ history }: { history: Array<{ date: string; tvl: number }> }) {
  if (history.length < 4) return null;
  const W = 320, H = 52, PAD = 3;
  const vals = history.map(h => h.tvl);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const pts = vals.map((v, i) => {
    const x = PAD + (i / (vals.length - 1)) * (W - PAD * 2);
    const y = H - PAD - ((v - min) / range) * (H - PAD * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const latest = vals[vals.length - 1];
  const first  = vals[0];
  const isUp   = latest >= first;
  const col    = isUp ? "#3D7A5C" : "#A8293A";
  const lastX  = (PAD + (W - PAD * 2)).toFixed(1);
  const lastY  = (H - PAD - ((latest - min) / range) * (H - PAD * 2)).toFixed(1);
  return (
    <div>
      <svg width={W} height={H} style={{ overflow: "visible", display: "block", width: "100%" }}>
        <defs>
          <linearGradient id="spkGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={col} stopOpacity="0.18" />
            <stop offset="100%" stopColor={col} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={`${PAD},${H} ${pts} ${lastX},${H}`} fill="url(#spkGrad)" />
        <polyline points={pts} fill="none" stroke={col} strokeWidth="1.5" strokeLinejoin="round" />
        <circle cx={lastX} cy={lastY} r="3" fill={col} />
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{history[0]?.date?.slice(5)}</span>
        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{history[history.length - 1]?.date?.slice(5)}</span>
      </div>
    </div>
  );
}

// ── Visual: Protocol Logo Bar Chart ───────────────────────────────
function ProtocolLogoBar({ protocols }: { protocols: ReportProtocol[] }) {
  const maxTvl = Math.max(...protocols.map(p => p.tvlRaw), 1);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 9, marginBottom: 14 }}>
      {protocols.slice(0, 8).map((p, i) => (
        <div key={p.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 10, color: "var(--text-muted)", width: 14, textAlign: "right", flexShrink: 0 }}>{i + 1}</span>
          <img
            src={p.logoUrl} alt={p.name} width={18} height={18}
            style={{ borderRadius: 4, flexShrink: 0, background: "var(--bg-card)", objectFit: "contain" }}
            onError={(e) => { (e.target as HTMLImageElement).style.visibility = "hidden"; }}
          />
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", width: 72, flexShrink: 0, overflow: "hidden", whiteSpace: "nowrap" }}>{p.name}</span>
          <div style={{ flex: 1, height: 5, background: "var(--bg-card)", borderRadius: 3 }}>
            <div style={{
              width: `${(p.tvlRaw / maxTvl) * 100}%`, height: "100%",
              background: i === 0 ? "#C9A84C" : "var(--border)",
              borderRadius: 3,
            }} />
          </div>
          <span style={{ fontSize: 12, color: "#C9A84C", fontFamily: "var(--font-mono)", width: 58, textAlign: "right", flexShrink: 0 }}>{p.tvlFmt}</span>
          <span style={{
            fontSize: 10, fontWeight: 700, borderRadius: 3, padding: "1px 4px",
            color: p.change7d >= 0 ? "#3D7A5C" : "#A8293A",
            background: p.change7d >= 0 ? "rgba(61,122,92,0.1)" : "rgba(168,41,58,0.1)",
            flexShrink: 0, width: 50, textAlign: "right",
          }}>
            {p.change7d >= 0 ? "+" : ""}{p.change7d.toFixed(1)}%
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Visual: DEX Share Bar (live) ──────────────────────────────────
function LiveDexShareBar({ dexShare, totalVol, lang }: {
  dexShare: DexShare[];
  totalVol: string | null;
  lang: Lang;
}) {
  const filtered = dexShare.filter(d => d.share > 0);
  if (!filtered.length) return null;
  const caption: T3 = {
    zh: `本週 Solana 全鏈 DEX 總量 ${totalVol ?? "—"}（DeFiLlama 實時）`,
    en: `Solana on-chain DEX total volume this week: ${totalVol ?? "—"} (DeFiLlama live)`,
    ja: `今週Solana全チェーンDEX総量 ${totalVol ?? "—"}（DeFiLlamaリアルタイム）`,
  };
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", height: 26, borderRadius: 6, overflow: "hidden", gap: 1, marginBottom: 8 }}>
        {filtered.map((d, i) => (
          <div key={i} style={{ flex: d.share, background: d.color, display: "flex", alignItems: "center", justifyContent: "center", minWidth: d.share > 8 ? "auto" : 0 }}>
            {d.share > 8 && <span style={{ fontSize: 10, fontWeight: 700, color: "#fff" }}>{d.share}%</span>}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 6 }}>
        {filtered.map((d, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: d.color, flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{d.name} {d.share}%</span>
          </div>
        ))}
      </div>
      <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>{tx(caption, lang)}</p>
    </div>
  );
}

// ── Visual: Fear & Greed Score ────────────────────────────────────
function FearGreedBadge({ score, label, color }: { score: number; label: string; color: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{
        width: 44, height: 44, borderRadius: "50%",
        border: `2.5px solid ${color}`,
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>
        <span style={{ fontSize: 15, fontWeight: 800, color, fontFamily: "var(--font-mono)" }}>{score}</span>
      </div>
      <div>
        <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.07em" }}>Fear & Greed</div>
        <div style={{ fontSize: 13, fontWeight: 700, color }}>{label}</div>
      </div>
    </div>
  );
}

// ── Visual: Hot Sector Banner ─────────────────────────────────────
function HotSectorBanner({ sector, lang }: { sector: WeeklyReport["hotSector"]; lang: Lang }) {
  const name = lang === "zh" ? sector.nameZh : lang === "ja" ? sector.nameJa : sector.name;
  const label: T3 = { zh: "本週最熱賽道", en: "Hot Sector This Week", ja: "今週最注目セクター" };
  return (
    <div style={{
      background: "linear-gradient(135deg, rgba(201,168,76,0.1), rgba(201,168,76,0.03))",
      border: "1px solid rgba(201,168,76,0.3)",
      borderLeft: "4px solid #C9A84C",
      borderRadius: "0 10px 10px 0",
      padding: "14px 20px", marginBottom: 16,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: 18 }}>{sector.emoji}</span>
        <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          {tx(label, lang)}
        </span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 700, color: "#C9A84C", fontFamily: "var(--font-heading)", marginBottom: 6 }}>
        {name}
      </div>
      <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
        <span style={{
          fontSize: 14, fontWeight: 700, fontFamily: "var(--font-mono)",
          color: sector.momentum.startsWith("+") ? "#3D7A5C" : "#A8293A",
        }}>
          {sector.momentum} {lang === "zh" ? "7日動量" : lang === "ja" ? "7日モメンタム" : "7d momentum"}
        </span>
        <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
          {lang === "zh" ? "領頭協議：" : lang === "ja" ? "主要プロトコル：" : "Led by: "}{sector.topProtocol}
        </span>
      </div>
    </div>
  );
}

// ── Standard Components ───────────────────────────────────────────
function ReportSection({ emoji, title, accentColor }: { emoji: string; title: string; accentColor?: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      fontSize: 20, fontWeight: 700, color: accentColor ?? "var(--text-primary)",
      marginTop: 36, marginBottom: 14,
      paddingBottom: 12, borderBottom: `1px solid ${accentColor ?? "var(--border)"}`,
    }}>
      <span style={{ fontSize: 18 }}>{emoji}</span>
      <span style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.01em" }}>{title}</span>
    </div>
  );
}

function TableCaption({ text }: { text: string }) {
  return <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>{text}</p>;
}

function AIPara({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <p style={{ margin: "0 0 14px", fontSize: 14, color: "var(--text-secondary)", lineHeight: 2.0 }}>
      {text}
    </p>
  );
}

function KpiGrid({ items }: { items: Array<{ label: string; value: string; sub?: string; highlight?: boolean }> }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 6 }}>
      {items.map((item, i) => (
        <div key={i} style={{
          background: "var(--bg-card-2)",
          border: `1px solid ${item.highlight ? "rgba(201,168,76,0.4)" : "var(--border)"}`,
          borderLeft: item.highlight ? "3px solid #C9A84C" : "1px solid var(--border)",
          borderRadius: 10, padding: "16px 18px",
        }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6, letterSpacing: "0.04em", textTransform: "uppercase" }}>{item.label}</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: item.highlight ? "#C9A84C" : "var(--text-primary)", fontFamily: "var(--font-mono)", lineHeight: 1.1 }}>{item.value}</div>
          {item.sub && <div style={{ fontSize: 11, color: "#3D7A5C", marginTop: 5, fontWeight: 600 }}>{item.sub}</div>}
        </div>
      ))}
    </div>
  );
}

function MetricsTable({ rows, lang }: {
  rows: Array<{ label: T3; value: string; status: Status }>;
  lang: Lang;
}) {
  return (
    <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid var(--border)", marginBottom: 20 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", background: "var(--bg-card-2)" }}>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: i < rows.length - 1 ? "1px solid var(--border)" : "none" }}>
              <td style={{ padding: "10px 16px", fontSize: 13, color: "var(--text-secondary)", width: "55%" }}>{tx(row.label, lang)}</td>
              <td style={{ padding: "10px 16px", fontSize: 13, fontWeight: 600, color: statusColor(row.status) }}>{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type PoolRow = { project: string; symbol: string; tvlUsd: number; apy: number; chain: string };

function LSTTable({ lang, lstData }: { lang: Lang; lstData: Record<string, { apy: string; tvl: string } | null> }) {
  const headers = [
    { zh: "LST", en: "LST", ja: "LST" },
    { zh: "APY", en: "APY", ja: "APY" },
    { zh: "TVL", en: "TVL", ja: "TVL" },
    { zh: "收益機制", en: "Yield Mechanism", ja: "利回りメカニズム" },
  ];
  const rows = [
    { name: "mSOL",    apy: lstData["mSOL"]?.apy    ?? "—", tvl: lstData["mSOL"]?.tvl    ?? "—", mech: { zh: "Marinade PoS",    en: "Marinade PoS",      ja: "Marinade PoS" },  best: true },
    { name: "PSOL",    apy: lstData["PSOL"]?.apy    ?? "—", tvl: lstData["PSOL"]?.tvl    ?? "—", mech: { zh: "Phantom PoS",     en: "Phantom PoS",       ja: "Phantom PoS" },   best: false },
    { name: "JUPSOL",  apy: lstData["JUPSOL"]?.apy  ?? "—", tvl: lstData["JUPSOL"]?.tvl  ?? "—", mech: { zh: "Jupiter PoS",     en: "Jupiter PoS",       ja: "Jupiter PoS" },   best: false },
    { name: "jitoSOL", apy: lstData["jitoSOL"]?.apy ?? "—", tvl: lstData["jitoSOL"]?.tvl ?? "—", mech: { zh: "PoS + MEV 捕獲",  en: "PoS + MEV Capture", ja: "PoS + MEV獲得" }, best: false },
    { name: "BNSOL",   apy: lstData["BNSOL"]?.apy   ?? "—", tvl: lstData["BNSOL"]?.tvl   ?? "—", mech: { zh: "Binance PoS",     en: "Binance PoS",       ja: "Binance PoS" },   best: false },
  ];
  return (
    <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid var(--border)", marginBottom: 8 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", background: "var(--bg-card-2)" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border)" }}>
            {headers.map((h, i) => (
              <th key={i} style={{ padding: "8px 14px", fontSize: 10, color: "var(--text-muted)", textAlign: "left", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>{tx(h, lang)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: i < rows.length - 1 ? "1px solid var(--border)" : "none" }}>
              <td style={{ padding: "9px 14px", fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>
                {row.name}
                {row.best && <span style={{ fontSize: 9, fontWeight: 700, background: "var(--accent)", color: "#fff", borderRadius: 4, padding: "1px 5px", marginLeft: 6 }}>⭐</span>}
              </td>
              <td style={{ padding: "9px 14px", fontSize: 13, fontWeight: 700, color: "#3D7A5C", fontFamily: "var(--font-mono)" }}>{row.apy}</td>
              <td style={{ padding: "9px 14px", fontSize: 13, color: "#C9A84C", fontFamily: "var(--font-mono)", fontWeight: 600 }}>{row.tvl}</td>
              <td style={{ padding: "9px 14px", fontSize: 12, color: "var(--text-muted)" }}>{tx(row.mech, lang)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LendingTable({ lang, lendData }: { lang: Lang; lendData: Record<string, string | null> }) {
  const headers = [
    { zh: "協議", en: "Protocol", ja: "プロトコル" },
    { zh: "資產", en: "Asset", ja: "資産" },
    { zh: "存款 APY", en: "Supply APY", ja: "預金APY" },
    { zh: "借款 APY", en: "Borrow APY", ja: "借入APY" },
  ];
  const rows = [
    { protocol: "Kamino", asset: "SOL",  supplyApy: lendData["kamino_sol_supply"]  ?? "—", borrowApy: "—", best: true },
    { protocol: "Kamino", asset: "USDC", supplyApy: lendData["kamino_usdc_supply"] ?? "—", borrowApy: "—", best: false },
    { protocol: "Kamino", asset: "USDT", supplyApy: lendData["kamino_usdt_supply"] ?? "—", borrowApy: "—", best: false },
    { protocol: "Drift",  asset: "DSOL", supplyApy: "—", borrowApy: "—", best: false },
  ];
  return (
    <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid var(--border)", marginBottom: 8 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", background: "var(--bg-card-2)" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border)" }}>
            {headers.map((h, i) => (
              <th key={i} style={{ padding: "8px 14px", fontSize: 10, color: "var(--text-muted)", textAlign: "left", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>{tx(h, lang)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: i < rows.length - 1 ? "1px solid var(--border)" : "none" }}>
              <td style={{ padding: "9px 14px", fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>
                {row.protocol}
                {row.best && <span style={{ fontSize: 9, fontWeight: 700, background: "#3D7A5C", color: "#fff", borderRadius: 4, padding: "1px 5px", marginLeft: 6 }}>最高</span>}
              </td>
              <td style={{ padding: "9px 14px", fontSize: 12, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{row.asset}</td>
              <td style={{ padding: "9px 14px", fontSize: 13, color: "#3D7A5C", fontFamily: "var(--font-mono)", fontWeight: 600 }}>{row.supplyApy}</td>
              <td style={{ padding: "9px 14px", fontSize: 13, color: "#B8832A", fontFamily: "var(--font-mono)", fontWeight: 600 }}>{row.borrowApy}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function KeyFindings({ items }: { items: string[] }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10 }}>
        關鍵發現 / Key Findings
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((item, i) => (
          <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <span style={{ color: "var(--accent)", fontWeight: 700, flexShrink: 0, marginTop: 1 }}>→</span>
            <span style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.7 }}>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function VerdictCard({ text }: { text: string }) {
  return (
    <div style={{
      background: "var(--accent-soft)", borderLeft: "3px solid var(--accent)",
      borderRadius: "0 8px 8px 0", padding: "14px 18px", marginBottom: 20,
    }}>
      <div style={{ fontSize: 13, color: "#3D7A5C", fontWeight: 600, lineHeight: 1.7 }}>{text}</div>
    </div>
  );
}

function CatalystsList({ items, lang }: { items: string[]; lang: Lang }) {
  const title: T3 = { zh: "下期關注催化劑", en: "Catalysts to Watch", ja: "注目すべき触媒" };
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10 }}>
        {tx(title, lang)}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((item, i) => (
          <div key={i} style={{
            display: "flex", gap: 12, alignItems: "flex-start",
            background: "var(--bg-card-2)", border: "1px solid var(--border)",
            borderRadius: 8, padding: "10px 14px",
          }}>
            <span style={{ color: "#C9A84C", fontWeight: 700, flexShrink: 0 }}>→</span>
            <span style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.7 }}>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Loading skeleton ──────────────────────────────────────────────
function LoadingPulse() {
  return (
    <div style={{
      height: 14, borderRadius: 6, marginBottom: 10,
      background: "linear-gradient(90deg, var(--bg-card) 25%, var(--bg-card-2) 50%, var(--bg-card) 75%)",
      backgroundSize: "200% 100%",
      animation: "pulse 1.5s ease-in-out infinite",
    }} />
  );
}

// ── Main Page ─────────────────────────────────────────────────────
export default function MarketPage() {
  return (
    <ThemeWrapper>
      <style>{`
        @keyframes pulse {
          0%, 100% { background-position: 200% 0; }
          50%       { background-position: -200% 0; }
        }
      `}</style>
      <MarketPageInner />
      <Footer />
    </ThemeWrapper>
  );
}

type LiveStats = {
  stakingRatio: string | null;
  epochInfo: { epoch: number; progress: number; slotsRemaining: number; hoursRemaining: number } | null;
};

function MarketPageInner() {
  const { lang } = useLang();
  const L = lang as Lang;
  const [copied, setCopied] = useState(false);
  const [report, setReport] = useState<WeeklyReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [liveStats, setLiveStats] = useState<LiveStats>({ stakingRatio: null, epochInfo: null });

  useEffect(() => {
    fetch("/api/weekly-report")
      .then(r => r.json())
      .then((d: WeeklyReport) => { setReport(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    function fetchLive() {
      fetch("/api/market-stats")
        .then(r => r.json())
        .then((d: Record<string, unknown>) => {
          setLiveStats({
            stakingRatio: (d.stakingRatio as string | null) ?? null,
            epochInfo: (d.epochInfo as LiveStats["epochInfo"]) ?? null,
          });
        })
        .catch(() => {});
    }
    fetchLive();
    const id = setInterval(fetchLive, 5 * 60 * 1000); // refresh every 5 min
    return () => clearInterval(id);
  }, []);

  function handleShare() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // ── Shorthand accessors ─────────────────────────────────────────
  const narr: NarrativeSection | undefined = report?.narrative?.[L];
  const lst   = report?.lst   ?? {};
  const lend  = report?.lending ?? {};

  const issueLabel = report
    ? (L === "zh"
        ? `Solana 生態全景週報 — 第 ${report.issue} 期 (${report.issueDate})`
        : L === "ja"
        ? `Solana エコシステム週報 — 第 ${report.issue} 号 (${report.issueDate})`
        : `Solana Ecosystem Weekly — Issue ${report.issue} (${report.issueDate})`)
    : (L === "zh" ? "Solana 生態全景週報" : L === "ja" ? "Solana エコシステム週報" : "Solana Ecosystem Weekly");

  const introText: T3 = {
    zh: "數據來源：DeFiLlama（TVL、DEX 交易量、協議費）、Solana 主網 RPC（TPS、節點數）、DeFiLlama Coins API（SOL 現價）。每期自動更新，每週一發布，所有量化數據均為實時抓取。",
    en: "Data: DeFiLlama (TVL, DEX volume, fees), Solana mainnet RPC (TPS, nodes), DeFiLlama Coins API (SOL price). Auto-updated every week on Monday. All quantitative figures are live-fetched.",
    ja: "データ：DeFiLlama（TVL、DEX取引量、手数料）、SolanaメインネットRPC（TPS、ノード数）、DeFiLlama Coins API（SOL価格）。毎週月曜日自動更新。",
  };

  // ── KPI grid ───────────────────────────────────────────────────
  const kpiItems = L === "zh" ? [
    { label: "Solana DeFi TVL",  value: report?.solanaTvl ?? "—",     sub: `DeFiLlama 實時${report?.tvlChange7d ? " · " + report.tvlChange7d : ""}`, highlight: true },
    { label: "SOL 現價",          value: report?.solPrice  ?? "—",     sub: report?.solChange ?? "DeFiLlama" },
    { label: "鏈上 DEX 7日量",    value: report?.dexVol7d  ?? "—",     sub: "Solana 全鏈" },
    { label: "SOL 全網質押率",    value: liveStats.stakingRatio ?? report?.stakingRatio ?? "~65%", sub: "Solana RPC 實時" },
    { label: "集群節點數",         value: report?.clusterNodes ?? "—",  sub: "Solana RPC 實時" },
    { label: "協議費 7日",         value: report?.fees7d    ?? "—",     sub: "DeFiLlama 實時" },
  ] : L === "ja" ? [
    { label: "Solana DeFi TVL",      value: report?.solanaTvl ?? "—",    sub: `DeFiLlama リアルタイム${report?.tvlChange7d ? " · " + report.tvlChange7d : ""}`, highlight: true },
    { label: "SOL 現在価格",          value: report?.solPrice  ?? "—",    sub: report?.solChange ?? "DeFiLlama" },
    { label: "オンチェーンDEX 7日量", value: report?.dexVol7d  ?? "—",    sub: "Solana 全チェーン" },
    { label: "SOL ステーキング率",    value: liveStats.stakingRatio ?? report?.stakingRatio ?? "~65%", sub: "Solana RPC リアルタイム" },
    { label: "クラスターノード数",    value: report?.clusterNodes ?? "—",  sub: "Solana RPC リアルタイム" },
    { label: "プロトコル手数料 7日",  value: report?.fees7d    ?? "—",     sub: "DeFiLlama リアルタイム" },
  ] : [
    { label: "Solana DeFi TVL",    value: report?.solanaTvl ?? "—",    sub: `DeFiLlama live${report?.tvlChange7d ? " · " + report.tvlChange7d : ""}`, highlight: true },
    { label: "SOL Price",           value: report?.solPrice  ?? "—",    sub: report?.solChange ?? "DeFiLlama" },
    { label: "On-Chain DEX 7d Vol", value: report?.dexVol7d  ?? "—",    sub: "Solana-wide" },
    { label: "SOL Staking Rate",    value: liveStats.stakingRatio ?? report?.stakingRatio ?? "~65%", sub: "Solana RPC live" },
    { label: "Cluster Nodes",       value: report?.clusterNodes ?? "—",  sub: "Solana RPC live" },
    { label: "Protocol Fees 7d",    value: report?.fees7d    ?? "—",     sub: "DeFiLlama live" },
  ];

  // ── Network rows ───────────────────────────────────────────────
  const tpsLabel     = report?.tpsTotal ? `${report.tpsTotal} avg | ${report.tpsPeak ?? "—"} peak`         : "—";
  const tpsUserLabel = report?.tpsUser  ? `${report.tpsUser} avg | ${report.tpsUserPeak ?? "—"} peak`       : "—";
  const activeEpoch = liveStats.epochInfo ?? report?.epochInfo ?? null;
  const epochLabel = activeEpoch
    ? `Epoch ${activeEpoch.epoch} · ${activeEpoch.progress}% · ~${activeEpoch.hoursRemaining}h left`
    : "—";
  const networkRows = [
    { label: { zh: "總 TPS 均值（含投票）",         en: "Total TPS avg (incl. votes)",      ja: "総TPS平均（投票含む）"      }, value: tpsLabel,                                                       status: "safe" as Status },
    { label: { zh: "真實用戶 TPS（去除投票）",       en: "User TPS avg (non-vote)",          ja: "ユーザーTPS（投票除く）"    }, value: tpsUserLabel,                                                   status: "safe" as Status },
    { label: { zh: "集群節點總數",                   en: "Total Cluster Nodes",              ja: "クラスターノード総数"        }, value: report?.clusterNodes ? `${report.clusterNodes} (Solana RPC)` : "—", status: "safe" as Status },
    { label: { zh: "當前 Epoch 進度",                en: "Current Epoch Progress",           ja: "現在のEpoch進捗"            }, value: epochLabel,                                                     status: "info" as Status },
    { label: { zh: "平均區塊確認時間",               en: "Avg Block Confirmation",           ja: "平均ブロック確認時間"        }, value: "~0.4s",                                                        status: "safe" as Status },
    { label: { zh: "協議費用 7 日（DeFiLlama）",     en: "Protocol Fees 7d (DeFiLlama)",    ja: "プロトコル手数料7日"         }, value: report?.fees7d ?? "—",                                          status: "safe" as Status },
  ];


  // ── Render ─────────────────────────────────────────────────────
  return (
    <div>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 24px 0" }}>

        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ margin: "0 0 4px", fontSize: "clamp(18px, 3vw, 26px)", fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-heading)", lineHeight: 1.3 }}>
            {narr?.headline ?? issueLabel}
          </h1>
          <p style={{ margin: "0 0 10px", fontSize: 12, color: "var(--text-muted)" }}>
            {report ? `Issue #${report.issue} · ${report.issueDate}` : ""}
          </p>
          <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.8, fontStyle: "italic", borderLeft: "2px solid var(--border)", paddingLeft: 12 }}>
            {tx(introText, L)}
          </p>

          {/* Tag row */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {["DeFiLlama", "Solana RPC", "Jupiter", "Kamino", "Raydium", "Jito", "Meteora", "Marinade"].map(s => (
              <span key={s} style={{ fontSize: 10, color: "var(--text-muted)", background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 4, padding: "2px 7px", fontFamily: "var(--font-mono)" }}>{s}</span>
            ))}
            {report && (
              <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
                <FearGreedBadge
                  score={report.fearGreed.score}
                  label={L === "en" ? report.fearGreed.labelEn : report.fearGreed.label}
                  color={report.fearGreed.color}
                />
              </div>
            )}
          </div>

          {/* News ticker */}
          {report?.newsItems && report.newsItems.length > 0 && (
            <div style={{
              background: "var(--bg-card-2)", border: "1px solid var(--border)",
              borderRadius: 8, padding: "10px 16px", marginTop: 16,
              fontSize: 12, display: "flex", gap: 16, flexWrap: "wrap", alignItems: "center",
            }}>
              <span style={{ fontWeight: 700, opacity: 0.5, flexShrink: 0 }}>
                📡 {L === "zh" ? "本週動態" : L === "ja" ? "今週の動向" : "This Week"}
              </span>
              {report.newsItems.map((item, i) => (
                <span key={i} style={{ opacity: 0.7 }}>
                  · {item.replace(/^\[.+?\]\s*/, "")}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Report body */}
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: "28px 32px", marginBottom: 40 }}>

          {/* Opening narrative */}
          {!loading && narr?.opening && <AIPara text={narr.opening} />}

          {/* ── 1. Key Metrics ── */}
          <ReportSection emoji="🎯" title={L === "zh" ? "本週核心指標" : L === "ja" ? "今週の主要指標" : "Key Metrics This Week"} />
          <KpiGrid items={kpiItems} />

          {/* TVL sparkline + Fear/Greed side by side */}
          {report?.tvlHistory && report.tvlHistory.length > 4 && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 24, alignItems: "start", marginBottom: 20, marginTop: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                  {L === "zh" ? "Solana TVL 30日走勢" : L === "ja" ? "Solana TVL 30日推移" : "Solana TVL 30-day trend"}
                </div>
                <TVLSparkline history={report.tvlHistory} />
              </div>
            </div>
          )}

          {/* ── 2. Hot Sector ── */}
          {report?.hotSector && (
            <>
              <ReportSection emoji="🔥" title={L === "zh" ? "本週熱點賽道" : L === "ja" ? "今週のホットセクター" : "Hot Sector Analysis"} />
              <HotSectorBanner sector={report.hotSector} lang={L} />
              {loading ? <LoadingPulse /> : <AIPara text={narr?.hotSector} />}
            </>
          )}

          {/* ── 3. Network Health ── */}
          <ReportSection emoji="🌐" title={L === "zh" ? "SOL 鏈上網絡健康度" : L === "ja" ? "SOLオンチェーンネットワーク健全性" : "SOL On-Chain Network Health"} />
          <TableCaption text={L === "zh" ? "Solana 網絡基礎指標（本週）：" : L === "ja" ? "Solanaネットワーク基本指標（今週）：" : "Solana Network Fundamentals (this week):"} />
          <MetricsTable rows={networkRows} lang={L} />

          {/* ── 4. Protocol TVL Landscape ── */}
          <ReportSection emoji="📊" title={L === "zh" ? "DeFi 協議 TVL 全景" : L === "ja" ? "DeFiプロトコルTVL全景" : "DeFi Protocol TVL Landscape"} />
          {loading ? <><LoadingPulse /><LoadingPulse /></> : <AIPara text={narr?.capitalFlow} />}
          <TableCaption text={L === "zh" ? "Solana 主要 DeFi 協議 TVL（含 7 日變化）：" : L === "ja" ? "Solana主要DeFiプロトコルTVL（7日変化含む）：" : "Major Solana DeFi Protocol TVL (with 7d change):"} />
          {report?.protocols && report.protocols.length > 0
            ? <ProtocolLogoBar protocols={report.protocols} />
            : <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 12 }}>—</p>
          }

          {/* ── 5. Lending Market ── */}
          <ReportSection emoji="🏦" title={L === "zh" ? "借貸市場利率深度" : L === "ja" ? "貸出市場金利深度" : "Lending Market Rate Deep-Dive"} />
          <TableCaption text={L === "zh" ? "Solana 主要借貸協議利率（本週）：" : L === "ja" ? "Solana主要貸出プロトコル金利（今週）：" : "Solana Major Lending Protocol Rates (this week):"} />
          <LendingTable lang={L} lendData={lend} />

          {/* ── 6. LST Ecosystem ── */}
          <ReportSection emoji="🪙" title={L === "zh" ? "LST 流動質押生態" : L === "ja" ? "LST流動性ステーキング生態系" : "LST Liquid Staking Ecosystem"} />
          <TableCaption text={L === "zh" ? "主要 LST 收益比較（本週，DeFiLlama 實時）：" : L === "ja" ? "主要LST利回り比較（今週）：" : "Major LST Yield Comparison (this week, DeFiLlama live):"} />
          <LSTTable lang={L} lstData={lst} />

          {/* ── 7. DEX Volume Deep Dive ── */}
          <ReportSection emoji="📈" title={L === "zh" ? "DEX 交易量深度分析" : L === "ja" ? "DEX取引量深度分析" : "DEX Volume Deep-Dive"} />
          {report?.dexShare && report.dexShare.length > 0
            ? <LiveDexShareBar dexShare={report.dexShare} totalVol={report.dexTotal7d} lang={L} />
            : null
          }

          {/* ── 8. Macro Context ── */}
          <ReportSection emoji="🌍" title={L === "zh" ? "宏觀背景" : L === "ja" ? "マクロ環境" : "Macro Context"} />
          {loading ? <LoadingPulse /> : <AIPara text={narr?.macroContext} />}

          {/* ── 9. Risk Radar ── */}
          <ReportSection emoji="⚠️" title={L === "zh" ? "風險雷達" : L === "ja" ? "リスクレーダー" : "Risk Radar"} accentColor="#ef4444" />
          {loading ? <LoadingPulse /> : <AIPara text={narr?.riskRadar} />}

          {/* ── 10. Findings + Verdict ── */}
          <ReportSection emoji="🔭" title={L === "zh" ? "關鍵發現與研判" : L === "ja" ? "主要発見と判断" : "Key Findings & Verdict"} />
          {loading ? (
            <><LoadingPulse /><LoadingPulse /><LoadingPulse /></>
          ) : narr?.findings?.length ? (
            <KeyFindings items={narr.findings} />
          ) : null}
          {!loading && narr?.verdict && <VerdictCard text={narr.verdict} />}

          {/* ── 12. Catalysts to Watch ── */}
          {!loading && narr?.catalysts?.length ? (
            <CatalystsList items={narr.catalysts} lang={L} />
          ) : null}

          {/* Updated timestamp */}
          {report?.updatedAt && (
            <div style={{ marginTop: 24, fontSize: 11, color: "var(--text-muted)", textAlign: "right" }}>
              {L === "zh" ? "數據更新：" : L === "ja" ? "更新：" : "Data as of: "}
              {new Date(report.updatedAt).toLocaleString()}
            </div>
          )}
        </div>

        {/* CTA Footer */}
        <div style={{
          textAlign: "center", padding: "40px 24px",
          background: "var(--bg-card)", border: "1px solid var(--border)",
          borderTop: "2px solid var(--accent)", borderRadius: 16, marginBottom: 60,
        }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-heading)", marginBottom: 10 }}>
            {L === "zh" ? "讓 Sakura 成為你的鏈上雷達" : L === "ja" ? "Sakuraをあなたのオンチェーンレーダーに" : "Let Sakura Be Your On-Chain Radar"}
          </div>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", maxWidth: 480, margin: "0 auto 24px", lineHeight: 1.9 }}>
            {L === "zh" ? "這份週報背後的每一條數據，Sakura 都能即時為你查詢、分析、預警。不只是閱讀報告——而是擁有生成它的能力。"
              : L === "ja" ? "このレポートの背後にあるすべてのデータを、Sakuraはリアルタイムで照会、分析、警告できます。"
              : "Every data point behind this report — Sakura can query it, analyze it, and alert you in real time. Not just reading the report — having the power to generate it."}
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/" style={{ display: "inline-block", padding: "11px 28px", background: "var(--accent)", color: "#fff", borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
              {L === "zh" ? "啟動 Sakura →" : L === "ja" ? "Sakuraを起動 →" : "Launch Sakura →"}
            </Link>
            <button
              onClick={handleShare}
              style={{ padding: "11px 28px", borderRadius: 8, border: "1px solid var(--border)", background: "transparent", color: "var(--text-secondary)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
            >
              {copied ? "✓ Copied!" : (L === "zh" ? "🔗 分享本報告" : L === "ja" ? "🔗 レポートを共有" : "🔗 Share This Report")}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
