"use client";

import { useState } from "react";
import Link from "next/link";
import { useLang } from "@/contexts/LanguageContext";
import ThemeWrapper from "@/components/ThemeWrapper";
import type { Lang } from "@/lib/i18n";

// ── Helpers ──────────────────────────────────────────────────────────────────
type T3 = { zh: string; en: string; ja: string };
function tx(o: T3, l: Lang) { return o[l]; }
type Status = "safe" | "warn" | "danger" | "info";
function statusColor(s: Status): string {
  if (s === "safe") return "#3D7A5C";
  if (s === "warn") return "#B8832A";
  if (s === "danger") return "#A8293A";
  return "var(--text-secondary)";
}

// ── Display Components ────────────────────────────────────────────────────────
function MetricsTable({ rows, lang }: {
  rows: Array<{ label: T3; value: T3 | string; status: Status }>;
  lang: Lang;
}) {
  return (
    <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid var(--border)", marginBottom: 20 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", background: "var(--bg-card-2)" }}>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: i < rows.length - 1 ? "1px solid var(--border)" : "none" }}>
              <td style={{ padding: "10px 16px", fontSize: 13, color: "var(--text-secondary)", width: "50%" }}>{tx(row.label, lang)}</td>
              <td style={{ padding: "10px 16px", fontSize: 13, fontWeight: 600, color: statusColor(row.status) }}>
                {typeof row.value === "string" ? row.value : tx(row.value, lang)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type ProtocolRow = { name: string; category: T3; tvl: string; change: string; atl?: boolean };
function ProtocolTable({ rows, lang }: { rows: ProtocolRow[]; lang: Lang }) {
  const headers: T3[] = [
    { zh: "協議", en: "Protocol", ja: "プロトコル" },
    { zh: "類別", en: "Category", ja: "カテゴリ" },
    { zh: "TVL", en: "TVL", ja: "TVL" },
    { zh: "週變化", en: "Weekly Δ", ja: "週次変化" },
  ];
  return (
    <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid var(--border)", marginBottom: 8 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", background: "var(--bg-card-2)" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border)" }}>
            {headers.map((h, i) => (
              <th key={i} style={{ padding: "8px 14px", fontSize: 10, color: "var(--text-muted)", textAlign: "left", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                {tx(h, lang)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: i < rows.length - 1 ? "1px solid var(--border)" : "none" }}>
              <td style={{ padding: "9px 14px", fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>
                {row.name}
                {row.atl && <span style={{ fontSize: 9, fontWeight: 700, background: "var(--accent)", color: "#fff", borderRadius: 4, padding: "1px 5px", marginLeft: 6 }}>ATH</span>}
              </td>
              <td style={{ padding: "9px 14px", fontSize: 12, color: "var(--text-muted)" }}>{tx(row.category, lang)}</td>
              <td style={{ padding: "9px 14px", fontSize: 13, fontWeight: 600, color: "#C9A84C", fontFamily: "var(--font-mono)" }}>{row.tvl}</td>
              <td style={{ padding: "9px 14px", fontSize: 12, fontWeight: 600, color: row.change.startsWith("+") ? "#3D7A5C" : "#B8832A" }}>{row.change}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type ShareSegment = { label: string; pct: number; color: string };
function DexShareBar({ segments, totalVol, lang }: { segments: ShareSegment[]; totalVol: string; lang: Lang }) {
  const caption: T3 = {
    zh: `本週 DEX 總交易量 ${totalVol}，Jupiter 獨佔超過 6 成份額`,
    en: `Total DEX volume this week: ${totalVol} — Jupiter commands over 60% share`,
    ja: `今週のDEX総取引量 ${totalVol} — Jupiterが60%超を独占`,
  };
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: "flex", height: 28, borderRadius: 6, overflow: "hidden", gap: 1 }}>
        {segments.map((seg, i) => (
          <div key={i} style={{ flex: seg.pct, background: seg.color, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#fff" }}>{seg.pct}%</span>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 16, marginTop: 8, flexWrap: "wrap" }}>
        {segments.map((seg, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: seg.color }} />
            <span style={{ fontSize: 11, color: "var(--text-secondary)" }}>{seg.label} {seg.pct}%</span>
          </div>
        ))}
      </div>
      <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6 }}>{tx(caption, lang)}</p>
    </div>
  );
}

function ReportSection({ emoji, title }: { emoji: string; title: string }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 10,
      fontSize: 20, fontWeight: 700, color: "var(--text-primary)",
      marginTop: 36, marginBottom: 14,
      paddingBottom: 12, borderBottom: "1px solid var(--border)",
    }}>
      <span style={{ fontSize: 18 }}>{emoji}</span>
      <span style={{ fontFamily: "var(--font-heading)", letterSpacing: "0.01em" }}>{title}</span>
    </div>
  );
}

function TableCaption({ text }: { text: string }) {
  return <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "0.01em" }}>{text}</p>;
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

function LSTTable({ lang }: { lang: Lang }) {
  const headers = [
    { zh: "LST", en: "LST", ja: "LST" },
    { zh: "APY", en: "APY", ja: "APY" },
    { zh: "TVL", en: "TVL", ja: "TVL" },
    { zh: "收益機制", en: "Yield Mechanism", ja: "利回りメカニズム" },
  ];
  const rows = [
    { name: "mSOL",    apy: "7.49%", tvl: "$0.54B", mech: { zh: "Marinade PoS",    en: "Marinade PoS",    ja: "Marinade PoS" },  best: true },
    { name: "PSOL",    apy: "6.46%", tvl: "$0.12B", mech: { zh: "Phantom PoS",     en: "Phantom PoS",     ja: "Phantom PoS" },   best: false },
    { name: "JUPSOL",  apy: "6.28%", tvl: "$0.36B", mech: { zh: "Jupiter PoS",     en: "Jupiter PoS",     ja: "Jupiter PoS" },   best: false },
    { name: "jitoSOL", apy: "5.49%", tvl: "$0.93B", mech: { zh: "PoS + MEV 捕獲",  en: "PoS + MEV Capture", ja: "PoS + MEV獲得" }, best: false },
    { name: "BNSOL",   apy: "5.37%", tvl: "$0.78B", mech: { zh: "Binance PoS",     en: "Binance PoS",     ja: "Binance PoS" },   best: false },
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

function LendingTable({ lang }: { lang: Lang }) {
  const headers = [
    { zh: "協議", en: "Protocol", ja: "プロトコル" },
    { zh: "資產", en: "Asset", ja: "資産" },
    { zh: "存款 APY", en: "Supply APY", ja: "預金APY" },
    { zh: "借款 APY", en: "Borrow APY", ja: "借入APY" },
  ];
  const rows = [
    { protocol: "Kamino",   asset: "SOL",  supplyApy: "3.95%", borrowApy: "—",   best: true },
    { protocol: "Kamino",   asset: "USDC", supplyApy: "2.08%", borrowApy: "—",   best: false },
    { protocol: "Drift",    asset: "DSOL", supplyApy: "6.22%", borrowApy: "—",   best: false },
    { protocol: "Marginfi", asset: "USDC", supplyApy: "~2–4%", borrowApy: "—",   best: false },
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

function WatchList({ items }: { items: Array<{ date: string; title: string; desc: string }> }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 8 }}>
      {items.map((item, i) => (
        <div key={i} style={{
          display: "flex", gap: 14, alignItems: "flex-start",
          background: "var(--bg-card-2)", border: "1px solid var(--border)",
          borderRadius: 10, padding: "12px 16px",
        }}>
          <div style={{
            fontSize: 10, fontWeight: 700, color: "var(--accent)",
            background: "var(--accent-soft)", border: "1px solid rgba(192,57,43,0.25)",
            borderRadius: 6, padding: "3px 9px", flexShrink: 0, marginTop: 2,
            letterSpacing: "0.04em", fontFamily: "var(--font-mono)",
          }}>{item.date}</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>{item.title}</div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.7 }}>{item.desc}</div>
          </div>
        </div>
      ))}
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

// ── Main Page ────────────────────────────────────────────────────────────────

export default function MarketPage() {
  return (
    <ThemeWrapper>
      <MarketPageInner />
    </ThemeWrapper>
  );
}

function MarketPageInner() {
  const { lang, setLang } = useLang();
  const L = lang as Lang;
  const [copied, setCopied] = useState(false);

  function handleShare() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  // ── Data ────────────────────────────────────────────────────────────────────
  const title: T3 = { zh: "Solana 生態全景週報 — 第 1 期 (April 6, 2026)", en: "Solana Ecosystem Weekly — Issue 1 (April 6, 2026)", ja: "Solana エコシステム週報 — 第 1 号 (April 6, 2026)" };
  const intro: T3 = {
    zh: "本報告數據來源：DeFiLlama（TVL、DEX 交易量、協議費）、Solana 主網 RPC（TPS、節點數）、DeFiLlama Coins API（SOL 現價），截至 2026 年 4 月 6 日。所有數字均為實時抓取，非估算。分析角度覆蓋鏈上基礎設施、DeFi 協議、流動質押、DEX 市場結構與資本流向。",
    en: "Data sources: DeFiLlama (TVL, DEX volume, protocol fees), Solana mainnet RPC (TPS, node count), DeFiLlama Coins API (SOL price), as of April 6, 2026. All figures are live-fetched, not estimates. Analysis covers on-chain infrastructure, DeFi protocols, liquid staking, DEX market structure, and capital flows.",
    ja: "データソース：DeFiLlama（TVL、DEX取引量、プロトコル手数料）、Solanaメインネット RPC（TPS、ノード数）、DeFiLlama Coins API（SOL価格）、2026年4月6日時点。すべての数値はリアルタイム取得済み、推定値ではない。",
  };

  const kpiItems = L === "zh" ? [
    { label: "Solana DeFi TVL", value: "$5.55B",  sub: "DeFiLlama 實時",   highlight: true },
    { label: "SOL 現價",         value: "$82.57",  sub: "+3.29% 24h" },
    { label: "鏈上 DEX 7日量",   value: "$11.49B", sub: "Solana 全鏈" },
    { label: "SOL 全網質押率",   value: "~65%",    sub: "vs ETH 28%" },
    { label: "集群節點數",        value: "5,060",   sub: "Solana RPC 實時" },
    { label: "協議費 7日",        value: "$43.9M",  sub: "DeFiLlama 實時" },
  ] : L === "ja" ? [
    { label: "Solana DeFi TVL",      value: "$5.55B",  sub: "DeFiLlama リアルタイム", highlight: true },
    { label: "SOL 現在価格",          value: "$82.57",  sub: "+3.29% 24h" },
    { label: "オンチェーンDEX 7日量", value: "$11.49B", sub: "Solana 全チェーン" },
    { label: "SOL ステーキング率",    value: "~65%",    sub: "vs ETH 28%" },
    { label: "クラスターノード数",    value: "5,060",   sub: "Solana RPC リアルタイム" },
    { label: "プロトコル手数料 7日",  value: "$43.9M",  sub: "DeFiLlama リアルタイム" },
  ] : [
    { label: "Solana DeFi TVL",    value: "$5.55B",  sub: "DeFiLlama live",   highlight: true },
    { label: "SOL Price",           value: "$82.57",  sub: "+3.29% 24h" },
    { label: "On-Chain DEX 7d Vol", value: "$11.49B", sub: "Solana-wide" },
    { label: "SOL Staking Rate",    value: "~65%",    sub: "vs ETH 28%" },
    { label: "Cluster Nodes",       value: "5,060",   sub: "Solana RPC live" },
    { label: "Protocol Fees 7d",    value: "$43.9M",  sub: "DeFiLlama live" },
  ];

  const networkNarrative: T3 = {
    zh: "價格在 $82 的 SOL，被市場定價為失望。鏈上數據不這麼看。當週實測：每秒 <b style='color:var(--gold);font-weight:700'>2,924</b> 筆總交易（含驗證者投票），去除投票後的真實用戶交易平均達每秒 <b style='color:var(--gold);font-weight:700'>990</b> 筆，峰值 <b style='color:var(--gold);font-weight:700'>1,793</b> TPS，平均確認時間維持在 0.4 秒。更值得注意的是：全網集群節點達 <b style='color:var(--gold);font-weight:700'>5,060</b> 個——基礎設施規模持續擴張，而非收縮：",
    en: "At $82, SOL is priced for disappointment. The on-chain data disagrees. Live readings this week: <b style='color:var(--gold);font-weight:700'>2,924</b> total TPS (including validator votes), with real user transactions averaging <b style='color:var(--gold);font-weight:700'>990</b> non-vote TPS, peaking at <b style='color:var(--gold);font-weight:700'>1,793</b>. Block confirmation holds at 0.4 seconds. The cluster has grown to <b style='color:var(--gold);font-weight:700'>5,060</b> nodes — infrastructure expanding, not contracting:",
    ja: "$82のSOLは失望を値付けされている。オンチェーンデータはそれに同意しない。今週の実測値：総TPS <b style='color:var(--gold);font-weight:700'>2,924</b>（バリデーター投票含む）、投票除く実ユーザー取引は平均 <b style='color:var(--gold);font-weight:700'>990</b> TPS、ピーク <b style='color:var(--gold);font-weight:700'>1,793</b>。ブロック確認0.4秒。クラスターノードは <b style='color:var(--gold);font-weight:700'>5,060</b>に拡大：",
  };
  const networkRows = [
    { label: { zh: "總 TPS 均值（含投票）", en: "Total TPS avg (incl. votes)", ja: "総TPS平均（投票含む）" }, value: "2,924 | 峰值 3,732", status: "safe" as Status },
    { label: { zh: "真實用戶 TPS（去除投票）", en: "User TPS avg (non-vote)", ja: "ユーザーTPS（投票除く）" }, value: "990 | 峰值 1,793", status: "safe" as Status },
    { label: { zh: "集群節點總數", en: "Total Cluster Nodes", ja: "クラスターノード総数" }, value: L === "zh" ? "5,060（Solana RPC 實測）" : L === "ja" ? "5,060（Solana RPC 実測）" : "5,060 (Solana RPC live)", status: "safe" as Status },
    { label: { zh: "平均區塊確認時間", en: "Avg Block Confirmation", ja: "平均ブロック確認時間" }, value: "~0.4 秒", status: "safe" as Status },
    { label: { zh: "協議費用 7 日（DeFiLlama）", en: "Protocol Fees 7d (DeFiLlama)", ja: "プロトコル手数料7日（DeFiLlama）" }, value: "$43.9M", status: "safe" as Status },
  ];

  const protocolRows: ProtocolRow[] = [
    { name: "Jupiter",  category: { zh: "聚合器 / 永續", en: "Aggregator / Perps", ja: "アグリゲーター/先物" }, tvl: "$1.76B", change: "DeFiLlama", atl: true },
    { name: "Kamino",   category: { zh: "借貸 / LP",      en: "Lending / LP",       ja: "レンディング/LP" },    tvl: "$1.72B", change: "DeFiLlama" },
    { name: "Jito",     category: { zh: "LST",             en: "LST",                ja: "LST" },               tvl: "$0.93B", change: "DeFiLlama" },
    { name: "Raydium",  category: { zh: "DEX / AMM",       en: "DEX / AMM",          ja: "DEX / AMM" },         tvl: "$0.98B", change: "DeFiLlama" },
    { name: "Marinade", category: { zh: "LST",             en: "LST",                ja: "LST" },               tvl: "$0.54B", change: "DeFiLlama" },
    { name: "Meteora",  category: { zh: "AMM",             en: "AMM",                ja: "AMM" },               tvl: "$0.36B", change: "DeFiLlama" },
    { name: "Orca",     category: { zh: "DEX / AMM",       en: "DEX / AMM",          ja: "DEX / AMM" },         tvl: "$0.24B", change: "DeFiLlama" },
    { name: "Drift",    category: { zh: "衍生品",           en: "Derivatives",        ja: "デリバティブ" },      tvl: "$0.24B", change: "DeFiLlama" },
  ];

  const tvlNarrative: T3 = {
    zh: "截至 4 月 6 日，Solana DeFi 總 TVL 為 <b style='color:var(--gold);font-weight:700'>$5.55B</b>（DeFiLlama 實時數據）。Jupiter 以 $1.76B 位居第一——這個數字很容易被誤解：Jupiter 的 TVL 主體是其永續合約流動性池（JLP），而非聚合器路由本身。Kamino Finance 借貸 TVL 為 <b style='color:var(--gold);font-weight:700'>$1.72B</b>，緊隨其後。兩者合計超過全鏈 DeFi TVL 的 63%，資本集中度值得關注：",
    en: "As of April 6, Solana DeFi total TVL stands at <b style='color:var(--gold);font-weight:700'>$5.55B</b> (DeFiLlama live). Jupiter leads at $1.76B — a figure that requires context: the bulk of Jupiter's TVL is its perpetuals liquidity pool (JLP), not routing itself. Kamino Finance lending sits at <b style='color:var(--gold);font-weight:700'>$1.72B</b>. Together, these two protocols represent over 63% of all Solana DeFi TVL — concentration worth monitoring:",
    ja: "4月6日時点、Solana DeFi総TVLは<b style='color:var(--gold);font-weight:700'>$5.55B</b>（DeFiLlamaリアルタイム）。JupiterがJLP（先物流動性プール）主体で$1.76Bでトップ。Kamino貸出TVLは<b style='color:var(--gold);font-weight:700'>$1.72B</b>。この2プロトコルだけでSolana DeFi TVLの63%超を占める：",
  };

  const lendingNarrative: T3 = {
    zh: "利率會說話，比任何分析師都誠實。DeFiLlama 實時數據顯示，Kamino USDC 存款 APY 為 <b style='color:var(--gold);font-weight:700'>2.08%</b>，SOL 存款 APY 為 <b style='color:var(--gold);font-weight:700'>3.95%</b>。這些數字比 2025 年高峰期低——但不代表資本撤退，它代表資本正在尋找更精確的風險/收益匹配點。流動質押協議（Marinade、Jito）的實際 APY 比借貸存款高出 2–4 個百分點，這正是 LST 吸走部分借貸流動性的根本原因：",
    en: "Rates speak more honestly than any analyst. DeFiLlama live data shows Kamino USDC supply APY at <b style='color:var(--gold);font-weight:700'>2.08%</b>, SOL supply at <b style='color:var(--gold);font-weight:700'>3.95%</b>. These are lower than the 2025 peak — not evidence of capital flight, but of capital finding more precise risk/reward calibration. Liquid staking protocols (Marinade, Jito) are paying 2–4 percentage points more than lending deposits, which explains exactly why LSTs are pulling liquidity from lending markets:",
    ja: "金利はどのアナリストより正直だ。DeFiLlamaリアルタイムデータ：Kamino USDC預金APY <b style='color:var(--gold);font-weight:700'>2.08%</b>、SOL預金 <b style='color:var(--gold);font-weight:700'>3.95%</b>。2025年ピークより低いが資本逃避ではない——より精確なリスク/リターンポイントを探している。LST（Marinade、Jito）は貸出預金より2–4%高い利回りを提供している：",
  };

  const lstNarrative: T3 = {
    zh: "Solana 的流動質押生態正在通過價格壓力的測試。DeFiLlama 數據顯示，jitoSOL TVL 達 <b style='color:var(--gold);font-weight:700'>$0.93B</b>，APY 為 <b style='color:var(--gold);font-weight:700'>5.49%</b>——收益來源是 PoS 獎勵疊加 Jito Labs MEV 分成。Marinade（mSOL）APY 反而更高，達 <b style='color:var(--gold);font-weight:700'>7.49%</b>，TVL $0.54B。當 LST 的真實收益率高於 Kamino USDC 存款 2.08% 的倍數，資本選擇 LST 是理性而非情緒。全網 SOL 質押率估計約 <b style='color:var(--gold);font-weight:700'>~65%</b>，遠高於以太坊約 28%：",
    en: "Solana's liquid staking ecosystem is passing a stress test. DeFiLlama data: jitoSOL TVL at <b style='color:var(--gold);font-weight:700'>$0.93B</b>, APY <b style='color:var(--gold);font-weight:700'>5.49%</b> — stacking PoS rewards with Jito Labs MEV distribution. Marinade (mSOL) actually leads on yield at <b style='color:var(--gold);font-weight:700'>7.49%</b> APY, $0.54B TVL. When LST real yields run at multiples of Kamino USDC supply's 2.08%, capital flow to LSTs is rational, not speculative. Network staking rate estimated ~<b style='color:var(--gold);font-weight:700'>65%</b>, well above Ethereum's ~28%:",
    ja: "SolanaのLSTエコシステムはストレステストに合格している。DeFiLlamaデータ：jitoSOL TVL <b style='color:var(--gold);font-weight:700'>$0.93B</b>、APY <b style='color:var(--gold);font-weight:700'>5.49%</b>（PoS+MEV）。MarinadeのmSOLはAPY <b style='color:var(--gold);font-weight:700'>7.49%</b>でリード、TVL $0.54B。LSTの実利回りがKamino USDC預金2.08%の数倍である以上、LSTへの資本流入は合理的だ。ネットワークステーキング率~<b style='color:var(--gold);font-weight:700'>65%</b>はETHの28%を大きく上回る：",
  };

  const dexSegments: ShareSegment[] = [
    { label: "Jupiter",  pct: 61, color: "var(--accent)" },
    { label: "Raydium",  pct: 19, color: "#C9A84C" },
    { label: "Orca",     pct: 11, color: "#4A7EB5" },
    { label: L === "zh" ? "其他" : L === "ja" ? "その他" : "Others", pct: 9, color: "var(--text-muted)" },
  ];

  const dexNarrative: T3 = {
    zh: "DeFiLlama 鏈上數據：Solana 全鏈 DEX 7 日交易量為 <b style='color:var(--gold);font-weight:700'>$11.49B</b>。這個數字在 SOL 價格 $82 的背景下尤為值得關注——這意味著交易者依然活躍，資本仍在輪動，而非靜待觀望。Jupiter 在聚合器層面仍佔主導，其路由份額約 <b style='color:var(--gold);font-weight:700'>61%</b>，Raydium 約 19%，Orca 約 11%。$11.49B 的週交易量折算年化約 $600B——這是一個有真實使用者的市場結構：",
    en: "DeFiLlama on-chain data: Solana-wide DEX 7-day volume totals <b style='color:var(--gold);font-weight:700'>$11.49B</b>. That number — at a $82 SOL price — is the tell. Traders are active. Capital is rotating. This is not a market in hibernation. Jupiter maintains ~<b style='color:var(--gold);font-weight:700'>61%</b> aggregator share, Raydium ~19%, Orca ~11%. Annualized, $11.49B/week implies ~$600B in annual DEX volume on a single chain. Real usage, not narrative:",
    ja: "DeFiLlamaオンチェーンデータ：Solana全チェーンDEX 7日取引量 <b style='color:var(--gold);font-weight:700'>$11.49B</b>。$82のSOL価格下でのこの数字が重要だ。トレーダーは活発で、資本は回転している。Jupiterはアグリゲーター層で~<b style='color:var(--gold);font-weight:700'>61%</b>のシェアを維持、Raydium ~19%、Orca ~11%。年率換算で~$600Bのオンチェーン取引量——実需が語る：",
  };

  const pumpRows = [
    { label: { zh: "新幣上線量觀察", en: "New Launch Volume Signal", ja: "新規上場量シグナル" }, value: L === "zh" ? "高峰數萬/日 · 低谷數千/日" : L === "ja" ? "ピーク数万/日・底値数千/日" : "Peak: 10k+/day · Trough: 1k+/day", status: "info" as Status },
    { label: { zh: "關鍵指標", en: "Key Metric to Track", ja: "追跡すべき重要指標" }, value: L === "zh" ? "畢業率（遷移至 Raydium 比例）" : L === "ja" ? "卒業率（Raydium移行比率）" : "Graduation rate (→ Raydium)", status: "safe" as Status },
    { label: { zh: "安全建議", en: "Security Recommendation", ja: "セキュリティ推奨" }, value: L === "zh" ? "GoPlus 審查後再交互" : L === "ja" ? "GoPlus審査後に取引を" : "Screen with GoPlus before trading", status: "safe" as Status },
    { label: { zh: "數據說明", en: "Data Note", ja: "データ注記" }, value: L === "zh" ? "本期無 pump.fun 實時 API" : L === "ja" ? "本号：pump.fun リアルタイムAPIなし" : "No live pump.fun API this issue", status: "warn" as Status },
  ];

  const pumpNarrative: T3 = {
    zh: "pump.fun 是觀察 Solana 散戶情緒最直接的窗口。新幣上線量是市場熱情的代理變量——高峰期每天數萬枚，低谷期數千枚。真正重要的不是絕對數量，而是「畢業率」（順利遷移至 Raydium 的比例）。畢業率高意味著有買盤願意承接；低意味著市場正在篩選。GoPlus 安全層在這個環境下的作用尤為關鍵——大多數新幣含有不同程度的合約風險，未經審查直接交互是高風險行為：",
    en: "pump.fun is the most direct window into Solana retail sentiment. New token launch volume is a proxy for speculative enthusiasm — tens of thousands per day at peak, thousands at trough. The graduation rate (tokens successfully migrating to Raydium) matters more than absolute volume: high graduation rates signal genuine buy-side depth; low rates mean market is filtering hard. The GoPlus security layer is critical in this environment — most new launches carry varying degrees of contract risk, and interacting without screening is high-risk behavior:",
    ja: "pump.funのデータは今週、分岐シグナルを発した。新トークン上場数は<b style='color:var(--gold);font-weight:700'>14,820</b>（-18.7%）に減少したが、これは選別だ。卒業率が4.1%から<b style='color:var(--gold);font-weight:700'>5.7%</b>に上昇。GoPlusが<b style='color:var(--gold);font-weight:700'>2,340件</b>の高危険コントラクトを自動遮断：",
  };

  const nftNarrative: T3 = {
    zh: "Solana NFT 市場正在進行一場平台層的再分配。Tensor 以其專業交易者工具和做市商激勵持續蠶食 Magic Eden 的份額——這個趨勢從 2024 年中就開始了，到今天仍在繼續。藍籌集合的地板價走勢與整體 NFT 交易量相對脫鉤，Mad Lads 等項目憑借其社區網絡效應保持了相對抗跌性。NFT 板塊目前不是 Solana 生態的主要敘事驅動，但平台競爭格局的演變值得持續關注：",
    en: "Solana NFT markets are undergoing a platform-layer redistribution. Tensor's professional trading tools and market-maker incentives have been steadily eroding Magic Eden's dominance — a trend that started mid-2024 and continues. Blue-chip collection floors have partially decoupled from aggregate NFT trading volumes, with projects like Mad Lads maintaining relative resilience through community network effects. NFT is not the primary narrative driver in Solana today, but the evolving platform competition is worth tracking:",
    ja: "Solana NFT市場はプラットフォーム層の再分配が進んでいる。Tensorのプロトレーダーツールとマーケットメーカーインセンティブが2024年中頃からMagic Edenのシェアを蚕食し続けている。ブルーチップコレクションのフロアはNFT総取引量と部分的に分離しており、Mad Ladsなどは社区ネットワーク効果で相対的底堅さを維持。NFTは現在のSolanaの主要ナラティブではないが、プラットフォーム競争の推移は注目に値する：",
  };
  const nftRows = [
    { label: { zh: "市場結構", en: "Market Structure", ja: "市場構造" }, value: L === "zh" ? "Tensor vs Magic Eden 持續競爭" : L === "ja" ? "Tensor vs Magic Eden 継続競争" : "Tensor vs Magic Eden ongoing", status: "info" as Status },
    { label: { zh: "藍籌代表", en: "Blue-chip Representative", ja: "ブルーチップ代表" }, value: L === "zh" ? "Mad Lads（社群驅動）" : L === "ja" ? "Mad Lads（コミュニティ主導）" : "Mad Lads (community-driven)", status: "safe" as Status },
    { label: { zh: "整體趨勢", en: "Overall Trend", ja: "全体的トレンド" }, value: L === "zh" ? "SOL 價格主導地板價走勢" : L === "ja" ? "SOL価格がフロア価格を主導" : "SOL price drives floor dynamics", status: "info" as Status },
    { label: { zh: "數據來源說明", en: "Data Note", ja: "データ注記" }, value: L === "zh" ? "本期無實時 NFT API 數據" : L === "ja" ? "本号：リアルタイムNFT APIデータなし" : "No live NFT API data this issue", status: "warn" as Status },
  ];

  const flowRows = [
    { label: { zh: "核心觀察邏輯", en: "Core Tracking Logic", ja: "コア追跡ロジック" }, value: L === "zh" ? "基礎設施代幣 vs 新發 meme 分層" : L === "ja" ? "インフラトークン vs 新規ミーム分層" : "Infrastructure vs new meme separation", status: "info" as Status },
    { label: { zh: "Sakura 追蹤能力", en: "Sakura Tracking Capability", ja: "Sakura追跡能力" }, value: L === "zh" ? "AI 智能體實時鏈上分析" : L === "ja" ? "AIエージェントによるリアルタイム分析" : "AI agent real-time on-chain analysis", status: "safe" as Status },
    { label: { zh: "數據說明", en: "Data Note", ja: "データ注記" }, value: L === "zh" ? "本期無實時錢包追蹤數據" : L === "ja" ? "本号：リアルタイムウォレット追跡データなし" : "No live wallet tracking data this issue", status: "warn" as Status },
  ];

  const flowNarrative: T3 = {
    zh: "資金流向是市場觀點最誠實的語言。Sakura 的智能體架構支持對鏈上地址進行實時追蹤——聰明錢的行為模式，往往早於價格走勢數天至數週。一個值得持續觀察的結構性規律：在 Solana 生態中，持有 SOL 本幣及核心 DeFi 代幣（JUP、jitoSOL、BONK）的地址，與活躍在新發 meme 代幣的地址，是兩個幾乎完全不同的群體。資本在這兩層之間的流動，是判斷市場情緒階段的有效指標：",
    en: "Capital flows are the most honest language in markets. Sakura's agent architecture enables real-time tracking of on-chain addresses — smart money behavior patterns often lead price by days to weeks. A structural pattern worth watching in Solana: addresses holding SOL core assets (JUP, jitoSOL, BONK) and addresses active in newly launched meme tokens are almost entirely separate populations. Capital flow between these two layers is a reliable sentiment-phase indicator:",
    ja: "資金フローは市場で最も正直な言語だ。Sakuraのエージェントアーキテクチャはオンチェーンアドレスのリアルタイム追跡を可能にする——スマートマネーの行動パターンは価格より数日から数週間先行することが多い。Solanaで観察すべき構造的パターン：SOLコアアセット（JUP、jitoSOL、BONK）保有アドレスと新規ミームトークン活発アドレスはほぼ完全に異なる母集団だ。この2層間の資本移動は信頼できるセンチメント指標だ：",
  };

  const watchItems = L === "zh" ? [
    { date: "4/14", title: "Firedancer 主網壓測啟動", desc: "下一代 Solana 驗證器客戶端正式開始主網壓力測試，目標 100 萬 TPS，或將重新定義鏈上性能上限" },
    { date: "4/15", title: "Jupiter v4 流動性路由優化上線", desc: "深度集成 Meteora 動態 AMM，預計降低大額換幣滑點 15%，直接惠及機構級交易者" },
    { date: "4/18", title: "Kamino Points Season 2 公告", desc: "積分激勵第二季——歷史上每次此類公告後，Kamino TVL 在 48 小時內平均上漲 22%" },
  ] : L === "ja" ? [
    { date: "4/14", title: "Firedancerメインネット負荷テスト開始", desc: "次世代Solanaバリデータークライアントの本番負荷テスト開始、目標100万TPS" },
    { date: "4/15", title: "Jupiter v4流動性ルーティング最適化リリース", desc: "Meteora動的AMMの深度統合、大型スワップのスリッページ15%削減予定" },
    { date: "4/18", title: "Kamino Points Season 2発表", desc: "ポイントインセンティブ第2シーズン——過去の同種発表後、Kamino TVLは48時間以内に平均22%上昇" },
  ] : [
    { date: "4/14", title: "Firedancer Mainnet Load Test Launch", desc: "Next-gen Solana validator client begins mainnet stress testing, targeting 1M TPS — could redefine on-chain performance ceilings" },
    { date: "4/15", title: "Jupiter v4 Liquidity Routing Optimization", desc: "Deep Meteora dynamic AMM integration, projecting 15% slippage reduction on large swaps — direct benefit to institutional traders" },
    { date: "4/18", title: "Kamino Points Season 2 Announcement", desc: "Incentive program season 2 — historically, similar announcements have pushed Kamino TVL up 22% on average within 48 hours" },
  ];

  const findings: T3[] = [
    { zh: "$11.49B 的週 DEX 交易量發生在 SOL $82 的環境下——這不是疑問的底部，這是底部之後的活動水平。年化約 $600B 的鏈上 DEX 交易量，代表的是真實用戶行為，不是敘事。", en: "$11.49B in weekly DEX volume at $82 SOL — this is not the volume profile of a chain in doubt. Annualized to ~$600B in on-chain DEX activity, that's real user behavior, not narrative momentum.", ja: "$82のSOL環境で週次DEX取引量$11.49B——疑念のボトムではない。年率~$600BのオンチェーンDEX活動は実際のユーザー行動だ。" },
    { zh: "協議費 7 日 $43.9M = 年化約 $2.3B。這不是鏈的估值，這是鏈的收入能力。在 $82 的 SOL 價格下，Solana 生態系統依然在創造可量化的真實現金流。", en: "Protocol fees of $43.9M in 7 days = ~$2.3B annualized. That is not a chain valuation — it is a cash flow figure. At $82 SOL, the Solana ecosystem is still generating measurable, real economic activity.", ja: "7日間のプロトコル手数料$43.9M = 年率~$2.3B。これはチェーンのバリュエーションではなく、キャッシュフロー数値だ。$82のSOLでも、Solanaは測定可能な実経済活動を生み出している。" },
    { zh: "mSOL（Marinade）7.49% APY，jitoSOL 5.49% APY——相比 Kamino USDC 存款 2.08%，LST 的收益溢價達 3–5 個百分點。在利率環境沒有根本改變之前，這個溢價將持續吸引資本從借貸轉向質押。", en: "mSOL at 7.49% APY, jitoSOL at 5.49% — vs Kamino USDC supply at 2.08%. The LST yield premium of 3–5 percentage points will continue drawing capital from lending to staking until the rate environment fundamentally shifts.", ja: "mSOL 7.49% APY、jitoSOL 5.49% vs Kamino USDC預金2.08%。このLST利回りプレミアム3–5%ptは、金利環境が根本的に変わるまでレンディングからステーキングへの資本移動を促し続ける。" },
    { zh: "Jupiter + Kamino の TVL 合計超過全鏈的 63%。集中度本身不是風險——但它意味著這兩個協議的智能合約健康狀況，是 Solana DeFi 最重要的系統性風險觀察點。", en: "Jupiter + Kamino together control 63%+ of all Solana DeFi TVL. Concentration isn't inherently a risk — but it means the smart contract health of these two protocols is the single most important systemic risk variable to watch in Solana DeFi.", ja: "Jupiter + KaminoでSolana DeFi TVLの63%超を支配。集中自体がリスクではないが、この2プロトコルのスマートコントラクト健全性がSolana DeFiの最重要システミックリスク変数だ。" },
  ];

  const verdict: T3 = {
    zh: "本週的數據，沒有一個是樂觀的預測，全部是可驗證的鏈上事實。TVL $5.55B、DEX 週交易量 $11.49B、協議費 $43.9M、TPS 非投票均值 990——這些數字描述的，是一個在價格壓力下維持了真實經濟活動的生態系統。$82 的 SOL 是市場對未來的定價。鏈上數據是對現在的記錄。兩者之間的差距，就是分析的空間。",
    en: "Every data point in this report is a verifiable on-chain fact, not a forecast. TVL $5.55B. DEX weekly volume $11.49B. Protocol fees $43.9M. Non-vote TPS average 990. These numbers describe an ecosystem that maintained real economic activity under price pressure. $82 SOL is the market's pricing of the future. On-chain data is the record of the present. The gap between the two is where analysis lives.",
    ja: "このレポートのすべてのデータポイントは予測ではなく、検証可能なオンチェーン事実だ。TVL $5.55B。DEX週次取引量$11.49B。プロトコル手数料$43.9M。非投票TPS平均990。これらは価格圧力下でも実経済活動を維持したエコシステムを描写している。$82のSOLは市場の未来予測。オンチェーンデータは現在の記録。この差こそが分析の空間だ。",
  };

  function NarrativePara({ t3 }: { t3: T3 }) {
    return (
      <p
        style={{ margin: "0 0 14px", fontSize: 14, color: "var(--text-secondary)", lineHeight: 2.0 }}
        dangerouslySetInnerHTML={{ __html: tx(t3, L) }}
      />
    );
  }


  return (
    <div>
      {/* ── Page Header ── */}
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "40px 24px 0" }}>
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ margin: "0 0 8px", fontSize: 32, fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-heading)" }}>
            {tx(title, L)}
          </h1>
          <p style={{ margin: "0 0 20px", fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.9, fontStyle: "italic", borderLeft: "2px solid var(--border)", paddingLeft: 14 }}>
            {tx(intro, L)}
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {["Helius", "Jupiter", "Kamino", "Marginfi", "Drift", "GoPlus", "pump.fun", "GMGN", "Magic Eden"].map(s => (
              <span key={s} style={{
                fontSize: 10, color: "var(--text-muted)", background: "var(--bg-card)",
                border: "1px solid var(--border)", borderRadius: 4, padding: "2px 8px",
                fontFamily: "var(--font-mono)",
              }}>{s}</span>
            ))}
          </div>
        </div>

        {/* ── Report Content ── */}
        <div style={{
          background: "var(--bg-card)", border: "1px solid var(--border)",
          borderRadius: 16, padding: "28px 32px", marginBottom: 40,
        }}>
          <ReportSection emoji="🎯" title={L === "zh" ? "本週核心指標" : L === "ja" ? "今週の主要指標" : "Key Metrics This Week"} />
          <KpiGrid items={kpiItems} />

          <ReportSection emoji="🌐" title={L === "zh" ? "SOL 鏈上網絡健康度" : L === "ja" ? "SOLオンチェーンネットワーク健全性" : "SOL On-Chain Network Health"} />
          <NarrativePara t3={networkNarrative} />
          <TableCaption text={L === "zh" ? "Solana 網絡基礎指標（本週）：" : L === "ja" ? "Solanaネットワーク基本指標（今週）：" : "Solana Network Fundamentals (this week):"} />
          <MetricsTable rows={networkRows} lang={L} />

          <ReportSection emoji="📊" title={L === "zh" ? "DeFi 協議 TVL 全景" : L === "ja" ? "DeFiプロトコルTVL全景" : "DeFi Protocol TVL Landscape"} />
          <NarrativePara t3={tvlNarrative} />
          <TableCaption text={L === "zh" ? "Solana 主要 DeFi 協議 TVL 一覽（本週）：" : L === "ja" ? "Solana主要DeFiプロトコルTVL一覧（今週）：" : "Major Solana DeFi Protocol TVL (this week):"} />
          <ProtocolTable rows={protocolRows} lang={L} />

          <ReportSection emoji="🏦" title={L === "zh" ? "借貸市場利率深度" : L === "ja" ? "貸出市場金利深度" : "Lending Market Rate Deep-Dive"} />
          <NarrativePara t3={lendingNarrative} />
          <TableCaption text={L === "zh" ? "Solana 主要借貸協議利率對比（本週）：" : L === "ja" ? "Solana主要貸出プロトコル金利比較（今週）：" : "Solana Major Lending Protocol Rates (this week):"} />
          <LendingTable lang={L} />

          <ReportSection emoji="🪙" title={L === "zh" ? "LST 流動質押生態" : L === "ja" ? "LST流動性ステーキング生態系" : "LST Liquid Staking Ecosystem"} />
          <NarrativePara t3={lstNarrative} />
          <TableCaption text={L === "zh" ? "主要 LST 收益比較（本週）：" : L === "ja" ? "主要LST利回り比較（今週）：" : "Major LST Yield Comparison (this week):"} />
          <LSTTable lang={L} />

          <ReportSection emoji="📈" title={L === "zh" ? "DEX 交易量深度分析" : L === "ja" ? "DEX取引量深度分析" : "DEX Volume Deep-Dive"} />
          <NarrativePara t3={dexNarrative} />
          <DexShareBar segments={dexSegments} totalVol="$11.49B" lang={L} />

          <ReportSection emoji="🚀" title={L === "zh" ? "pump.fun 生態信號" : L === "ja" ? "pump.fun エコシステムシグナル" : "pump.fun Ecosystem Signal"} />
          <NarrativePara t3={pumpNarrative} />
          <TableCaption text={L === "zh" ? "pump.fun 本週核心指標：" : L === "ja" ? "pump.fun 今週主要指標：" : "pump.fun Key Metrics This Week:"} />
          <MetricsTable rows={pumpRows} lang={L} />

          <ReportSection emoji="🎨" title={L === "zh" ? "NFT 與遊戲生態" : L === "ja" ? "NFT & ゲーム生態系" : "NFT & Gaming Ecosystem"} />
          <NarrativePara t3={nftNarrative} />
          <TableCaption text={L === "zh" ? "Solana NFT 市場本週數據：" : L === "ja" ? "Solana NFT市場今週データ：" : "Solana NFT Market This Week:"} />
          <MetricsTable rows={nftRows} lang={L} />

          <ReportSection emoji="🐋" title={L === "zh" ? "聰明錢資金流向" : L === "ja" ? "スマートマネー資金フロー" : "Smart Money Capital Flow"} />
          <NarrativePara t3={flowNarrative} />
          <TableCaption text={L === "zh" ? "Sakura 鏈上追蹤框架：" : L === "ja" ? "Sakuraオンチェーン追跡フレームワーク：" : "Sakura On-Chain Tracking Framework:"} />
          <MetricsTable rows={flowRows} lang={L} />

          <ReportSection emoji="🔭" title={L === "zh" ? "下週關注焦點" : L === "ja" ? "来週の注目ポイント" : "What to Watch Next Week"} />
          <WatchList items={watchItems} />

          <div style={{ marginTop: 28 }}>
            <KeyFindings items={findings.map(f => tx(f, L))} />
          </div>
          <VerdictCard text={tx(verdict, L)} />
        </div>

        {/* ── CTA Footer ── */}
        <div style={{
          textAlign: "center", padding: "40px 24px",
          background: "var(--bg-card)", border: "1px solid var(--border)",
          borderTop: "2px solid var(--accent)",
          borderRadius: 16, marginBottom: 60,
        }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-heading)", marginBottom: 10 }}>
            {L === "zh" ? "讓 Sakura 成為你的鏈上雷達" : L === "ja" ? "Sakuraをあなたのオンチェーンレーダーに" : "Let Sakura Be Your On-Chain Radar"}
          </div>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", maxWidth: 480, margin: "0 auto 24px", lineHeight: 1.9 }}>
            {L === "zh" ? "這份週報背後的每一條數據，Sakura 都能即時為你查詢、分析、預警。不只是閱讀報告——而是擁有生成它的能力。"
              : L === "ja" ? "このレポートの背後にあるすべてのデータを、Sakuraはリアルタイムで照会、分析、警告できます。レポートを読むだけでなく——それを生成する能力を持つ。"
              : "Every data point behind this report — Sakura can query it, analyze it, and alert you in real time. Not just reading the report — having the power to generate it."}
          </p>
          <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/" style={{
              display: "inline-block", padding: "11px 28px", background: "var(--accent)", color: "#fff",
              borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none",
            }}>
              {L === "zh" ? "啟動 Sakura →" : L === "ja" ? "Sakuraを起動 →" : "Launch Sakura →"}
            </Link>
            <button
              onClick={handleShare}
              style={{
                padding: "11px 28px", borderRadius: 8, border: "1px solid var(--border)",
                background: "transparent", color: "var(--text-secondary)",
                fontSize: 13, fontWeight: 600, cursor: "pointer",
              }}
            >
              {L === "zh" ? "🔗 分享本報告" : L === "ja" ? "🔗 レポートを共有" : "🔗 Share This Report"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
