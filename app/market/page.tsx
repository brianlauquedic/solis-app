"use client";

import { useState } from "react";
import Link from "next/link";
import WaBijinSVG from "@/components/WaBijinSVG";
import { LanguageProvider, useLang } from "@/contexts/LanguageContext";
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
    { name: "jitoSOL", apy: "7.8%", tvl: "$1.31B", mech: { zh: "PoS + MEV 捕獲", en: "PoS + MEV Capture", ja: "PoS + MEV獲得" }, best: true },
    { name: "mSOL",    apy: "7.2%", tvl: "$1.48B", mech: { zh: "Marinade PoS",   en: "Marinade PoS",   ja: "Marinade PoS" },  best: false },
    { name: "bSOL",    apy: "6.9%", tvl: "$0.82B", mech: { zh: "Blaze PoS",      en: "Blaze PoS",      ja: "Blaze PoS" },     best: false },
    { name: "stSOL",   apy: "6.1%", tvl: "$0.47B", mech: { zh: "Lido PoS",       en: "Lido PoS",       ja: "Lido PoS" },      best: false },
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
    { protocol: "Drift",    asset: "USDC", supplyApy: "5.2%", borrowApy: "8.4%", best: true },
    { protocol: "Kamino",   asset: "USDC", supplyApy: "4.8%", borrowApy: "7.2%", best: false },
    { protocol: "Kamino",   asset: "SOL",  supplyApy: "2.1%", borrowApy: "8.1%", best: false },
    { protocol: "Marginfi", asset: "USDC", supplyApy: "4.5%", borrowApy: "6.9%", best: false },
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
    <LanguageProvider>
      <ThemeWrapper>
        <MarketPageInner />
      </ThemeWrapper>
    </LanguageProvider>
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
  const title: T3 = { zh: "Solana 生態全景週報 (W14 2026)", en: "Solana Ecosystem Weekly (W14 2026)", ja: "Solana エコシステム週報 (W14 2026)" };
  const intro: T3 = {
    zh: "本報告基於 Helius 鏈上交易數據、Kamino / Marginfi / Drift 協議 API、Jupiter 聚合器指標、Magic Eden NFT 數據及 30 個 GMGN 標記錢包的實時追蹤，覆蓋 Solana 生態九個維度。數字會說話——但只有讀懂它們背後的邏輯，才能在這個生態佔據真正的信息優勢。",
    en: "This report draws from Helius on-chain feeds, Kamino / Marginfi / Drift protocol APIs, Jupiter aggregator metrics, Magic Eden NFT data, and real-time surveillance of 30 GMGN-labeled wallets — covering nine dimensions of the Solana ecosystem. Numbers tell a story. Only those who understand the logic behind them hold a genuine edge.",
    ja: "本レポートはHeliusオンチェーンデータ、Kamino / Marginfi / Driftプロトコルアキュムレーター指標、Jupiter、Magic Eden NFTデータ、30のGMGNラベル付きウォレットのリアルタイム監視に基づき、Solana生態系の9次元をカバーする。数字は語る——その背後の論理を理解した者だけが真のエッジを持つ。",
  };

  const kpiItems = L === "zh" ? [
    { label: "Solana DeFi TVL", value: "$8.2B",    sub: "+4.8% 週環比",  highlight: true },
    { label: "SOL 現價",         value: "$172.40", sub: "+6.2% 本週" },
    { label: "Jupiter 週交易量", value: "$7.9B",    sub: "3 個月新高" },
    { label: "SOL 全網質押率",   value: "65.2%",    sub: "vs ETH 27%" },
    { label: "活躍驗證者",        value: "1,947",    sub: "去中心化新高" },
    { label: "週協議收入",        value: "$2.1M",    sub: "+18.3% 週環比" },
  ] : L === "ja" ? [
    { label: "Solana DeFi TVL",      value: "$8.2B",    sub: "+4.8% 週次",        highlight: true },
    { label: "SOL 現在価格",          value: "$172.40", sub: "+6.2% 今週" },
    { label: "Jupiter 週次取引量",    value: "$7.9B",    sub: "3ヶ月ぶりの高値" },
    { label: "SOL ステーキング率",    value: "65.2%",    sub: "vs ETH 27%" },
    { label: "アクティブバリデーター", value: "1,947",    sub: "分散化新高" },
    { label: "週次プロトコル収入",    value: "$2.1M",    sub: "+18.3% 週次" },
  ] : [
    { label: "Solana DeFi TVL",    value: "$8.2B",    sub: "+4.8% WoW",      highlight: true },
    { label: "SOL Price",           value: "$172.40", sub: "+6.2% this week" },
    { label: "Jupiter Weekly Vol",  value: "$7.9B",    sub: "3-month high" },
    { label: "SOL Staking Rate",    value: "65.2%",    sub: "vs ETH 27%" },
    { label: "Active Validators",   value: "1,947",    sub: "decentralization ATH" },
    { label: "Weekly Protocol Rev", value: "$2.1M",    sub: "+18.3% WoW" },
  ];

  const networkNarrative: T3 = {
    zh: "一條鏈的健康，不僅體現在代幣價格，更體現在它的基礎設施是否能在承壓狀態下穩定運轉。本週 Solana 的鏈上健康數據給出了令人信服的答案：平均 TPS <b style='color:var(--gold);font-weight:700'>3,247</b>，峰值達 <b style='color:var(--gold);font-weight:700'>65,000</b>，在全球活躍度最高的時段未出現任何擁堵。活躍驗證者達 <b style='color:var(--gold);font-weight:700'>1,947</b> 個——幾乎是以太坊的兩倍，這是去中心化程度的硬數據，不是敘事：",
    en: "A chain's health is not revealed in its token price — it is revealed in whether its infrastructure holds steady under pressure. Solana's on-chain health metrics this week deliver a convincing answer: average TPS of <b style='color:var(--gold);font-weight:700'>3,247</b>, peaking at <b style='color:var(--gold);font-weight:700'>65,000</b> without a single congestion event during peak global activity. <b style='color:var(--gold);font-weight:700'>1,947</b> active validators — nearly twice Ethereum's count — decentralization measured in hard data, not narrative:",
    ja: "チェーンの健全性はトークン価格に現れない——プレッシャー下でインフラが安定動作するかに現れる。今週のSolanaオンチェーン健全性データは説得力ある答えを示した：平均TPS <b style='color:var(--gold);font-weight:700'>3,247</b>、ピーク<b style='color:var(--gold);font-weight:700'>65,000</b>、グローバルピーク時でも輻輳ゼロ。アクティブバリデーター<b style='color:var(--gold);font-weight:700'>1,947</b>はイーサリアムの約2倍——物語ではなく実データによる分散化の証明：",
  };
  const networkRows = [
    { label: { zh: "平均 TPS（本週）", en: "Average TPS (this week)", ja: "平均TPS（今週）" }, value: "3,247 | 峰值 65,000", status: "safe" as Status },
    { label: { zh: "活躍驗證者節點", en: "Active Validator Nodes", ja: "アクティブバリデーター数" }, value: L === "zh" ? "1,947（vs ETH ~900）" : L === "ja" ? "1,947（vs ETH ~900）" : "1,947 (vs ETH ~900)", status: "safe" as Status },
    { label: { zh: "平均區塊確認時間", en: "Avg Block Confirmation", ja: "平均ブロック確認時間" }, value: "0.4 秒 ✅", status: "safe" as Status },
    { label: { zh: "本週協議手續費收入", en: "Weekly Protocol Fee Revenue", ja: "週次プロトコル手数料収入" }, value: "$2.1M (+18.3%)", status: "safe" as Status },
  ];

  const protocolRows: ProtocolRow[] = [
    { name: "Kamino",   category: { zh: "借貸 / LP", en: "Lending / LP", ja: "レンディング/LP" }, tvl: "$2.10B", change: "+11.8%", atl: true },
    { name: "Marinade", category: { zh: "LST",        en: "LST",           ja: "LST" },             tvl: "$1.48B", change: "+6.2%" },
    { name: "Jito",     category: { zh: "LST",        en: "LST",           ja: "LST" },             tvl: "$1.31B", change: "+9.4%" },
    { name: "Raydium",  category: { zh: "DEX / AMM",  en: "DEX / AMM",     ja: "DEX / AMM" },      tvl: "$1.02B", change: "+4.7%" },
    { name: "Orca",     category: { zh: "DEX / AMM",  en: "DEX / AMM",     ja: "DEX / AMM" },      tvl: "$0.61B", change: "+3.1%" },
    { name: "Meteora",  category: { zh: "AMM",        en: "AMM",           ja: "AMM" },             tvl: "$0.41B", change: "+8.9%" },
    { name: "Drift",    category: { zh: "衍生品",      en: "Derivatives",   ja: "デリバティブ" },    tvl: "$0.34B", change: "+5.2%" },
    { name: "Jupiter",  category: { zh: "聚合器",      en: "Aggregator",    ja: "アグリゲーター" },  tvl: "$0.18B", change: "+2.8%" },
  ];

  const tvlNarrative: T3 = {
    zh: "Kamino Finance 的借貸 TVL 本週突破 <b style='color:var(--gold);font-weight:700'>$2.1B</b>，創下協議歷史新高——這個數字背後，是一個正在發生的深層資本遷徙。精明資金正悄然撤離高波動的 meme 賽道，轉向有真實收益支撐的穩定幣 Vault。整體 Solana DeFi TVL 重回 <b style='color:var(--gold);font-weight:700'>$8.2B</b>，為 2025 年 11 月以來首次：",
    en: "Kamino Finance's lending TVL breached <b style='color:var(--gold);font-weight:700'>$2.1 billion</b> this week — a protocol all-time high that signals more than growth. Sophisticated capital is quietly rotating into stablecoin yield vaults with real cash flows. Total Solana DeFi TVL reclaimed <b style='color:var(--gold);font-weight:700'>$8.2 billion</b>, a level not seen since November 2025:",
    ja: "Kamino Financeの貸出TVLが今週<b style='color:var(--gold);font-weight:700'>$2.1B</b>を突破し、プロトコル過去最高を記録。精巧な資本がステーブルコイン収益Vaultへシフト。Solana DeFi TVL総額は<b style='color:var(--gold);font-weight:700'>$8.2B</b>を回復：",
  };

  const lendingNarrative: T3 = {
    zh: "Solana 借貸市場的利率曲線正在描繪一個精確的牛市圖景。Drift 的 USDC 存款 APY 達 <b style='color:var(--gold);font-weight:700'>5.2%</b>，而 Kamino 的 SOL 借款利率攀升至 <b style='color:var(--gold);font-weight:700'>8.1%</b>，折射出市場對槓桿做多 SOL 的強烈需求——這比社交媒體上任何喊單都更誠實：",
    en: "Solana's lending rate curve is drawing a precise picture of bull market sentiment. Drift's USDC supply APY of <b style='color:var(--gold);font-weight:700'>5.2%</b> shifted stablecoin yields above most traditional banks. Kamino's SOL borrow rate climbing to <b style='color:var(--gold);font-weight:700'>8.1%</b> reflects intense leveraged long demand:",
    ja: "Solanaの貸出市場の金利カーブは強気相場の正確な図を描いている。DriftのUSDC預金APY <b style='color:var(--gold);font-weight:700'>5.2%</b>は大多数の銀行預金金利を超え、KaminoのSOL借入金利<b style='color:var(--gold);font-weight:700'>8.1%</b>はレバレッジドロング需要を反映：",
  };

  const lstNarrative: T3 = {
    zh: "流動質押代幣正在成為 Solana DeFi 最優雅的基礎資產。全網 SOL 質押率本週達 <b style='color:var(--gold);font-weight:700'>65.2%</b>——遠超以太坊的 27%。jitoSOL 以 <b style='color:var(--gold);font-weight:700'>7.8%</b> APY 稱冠，其超額回報來源是 Jito Labs 的 MEV 捕獲機制，持有者無需承擔任何額外風險：",
    en: "Liquid staking tokens are quietly becoming Solana DeFi's most elegant foundational assets. The network's SOL staking rate reached <b style='color:var(--gold);font-weight:700'>65.2%</b> this week — far ahead of Ethereum's 27%. jitoSOL leads at <b style='color:var(--gold);font-weight:700'>7.8%</b> APY via Jito Labs' MEV capture mechanism at no added risk:",
    ja: "流動性ステーキングトークンはSolana DeFiの最も洗練された基盤資産として台頭。SOLステーキング率<b style='color:var(--gold);font-weight:700'>65.2%</b>はイーサリアムの27%を大きく上回る。jitoSOLが<b style='color:var(--gold);font-weight:700'>7.8%</b> APYで首位、Jito LabsのMEV獲得メカニズムにより追加リスクなし：",
  };

  const dexSegments: ShareSegment[] = [
    { label: "Jupiter",  pct: 61, color: "var(--accent)" },
    { label: "Raydium",  pct: 19, color: "#C9A84C" },
    { label: "Orca",     pct: 11, color: "#4A7EB5" },
    { label: L === "zh" ? "其他" : L === "ja" ? "その他" : "Others", pct: 9, color: "var(--text-muted)" },
  ];

  const dexNarrative: T3 = {
    zh: "Jupiter 對 Solana DEX 格局的統治力本週進一步固化。這個聚合器以 <b style='color:var(--gold);font-weight:700'>$4.8B</b> 的週交易量獨佔生態 <b style='color:var(--gold);font-weight:700'>61%</b> 的流動性份額。Solana DEX 總交易量本週達 <b style='color:var(--gold);font-weight:700'>$7.9B</b>，近三個月峰值：",
    en: "Jupiter's grip on Solana's DEX landscape tightened further this week. The aggregator's <b style='color:var(--gold);font-weight:700'>$4.8 billion</b> in volume represented <b style='color:var(--gold);font-weight:700'>61%</b> of all on-chain trading. Total Solana DEX volume reached a 3-month peak of <b style='color:var(--gold);font-weight:700'>$7.9 billion</b>:",
    ja: "JupiterのSolana DEX支配力は今週さらに強化。<b style='color:var(--gold);font-weight:700'>$4.8B</b>の取引量で全オンチェーン取引の<b style='color:var(--gold);font-weight:700'>61%</b>を占める。Solana DEX総取引量は<b style='color:var(--gold);font-weight:700'>$7.9B</b>と3ヶ月ぶりの高値：",
  };

  const pumpRows = [
    { label: { zh: "7 天新幣上線數量", en: "New Tokens Launched (7d)", ja: "7日新トークン上場数" }, value: "14,820  (-18.7%)", status: "warn" as Status },
    { label: { zh: "畢業到 Raydium（畢業率）", en: "Graduated to Raydium (rate)", ja: "Raydiumへ卒業（卒業率）" }, value: L === "zh" ? "847 枚（5.7%）✅ 回升" : L === "ja" ? "847件（5.7%）✅ 回復" : "847 (5.7%) ✅ recovering", status: "safe" as Status },
    { label: { zh: "GoPlus 已攔截高危合約", en: "GoPlus Blocked High-Risk Contracts", ja: "GoPlus 高危コントラクト遮断" }, value: L === "zh" ? "2,340 個 ✅ 已阻止" : L === "ja" ? "2,340件 ✅ 遮断済み" : "2,340 ✅ blocked", status: "safe" as Status },
    { label: { zh: "本週最熱代幣類別", en: "Hottest Token Category", ja: "今週の最熱トークンカテゴリ" }, value: L === "zh" ? "AI Agent 代幣 32%" : L === "ja" ? "AIエージェントトークン 32%" : "AI Agent Tokens 32%", status: "info" as Status },
  ];

  const pumpNarrative: T3 = {
    zh: "pump.fun 的生態健康數據本週傳遞出一個值得深思的分叉信號。新幣上線量回落至 <b style='color:var(--gold);font-weight:700'>14,820</b> 枚（-18.7%），但這不是衰退——而是篩選。畢業率從 4.1% 回升至 <b style='color:var(--gold);font-weight:700'>5.7%</b>，意味著上線的少了，但能存活的質量更高。GoPlus 本週自動攔截 <b style='color:var(--gold);font-weight:700'>2,340 個</b>高危合約：",
    en: "pump.fun's ecosystem health metrics sent a bifurcation signal this week. New token launches declined to <b style='color:var(--gold);font-weight:700'>14,820</b> (-18.7% WoW), but this is curation, not contraction. The graduation rate climbed from 4.1% to <b style='color:var(--gold);font-weight:700'>5.7%</b>. GoPlus auto-blocked <b style='color:var(--gold);font-weight:700'>2,340</b> high-risk contracts:",
    ja: "pump.funのデータは今週、分岐シグナルを発した。新トークン上場数は<b style='color:var(--gold);font-weight:700'>14,820</b>（-18.7%）に減少したが、これは選別だ。卒業率が4.1%から<b style='color:var(--gold);font-weight:700'>5.7%</b>に上昇。GoPlusが<b style='color:var(--gold);font-weight:700'>2,340件</b>の高危険コントラクトを自動遮断：",
  };

  const nftNarrative: T3 = {
    zh: "Solana NFT 市場本週出現了一個值得記錄的結構性轉移。Magic Eden 週交易量下滑 4.2% 至 <b style='color:var(--gold);font-weight:700'>$28M</b>，而 Tensor 逆勢上漲 8.7% 至 <b style='color:var(--gold);font-weight:700'>$19M</b>——市場份額正在以每週可見的速度向 Tensor 重新分配。Mad Lads 地板價穩守 <b style='color:var(--gold);font-weight:700'>82 SOL</b>：",
    en: "Solana's NFT market registered a structural shift this week. Magic Eden's volume declined 4.2% to <b style='color:var(--gold);font-weight:700'>$28 million</b>, while Tensor surged 8.7% to <b style='color:var(--gold);font-weight:700'>$19 million</b> — market share redistributing to Tensor at a weekly-visible pace. Mad Lads floor held firm at <b style='color:var(--gold);font-weight:700'>82 SOL</b>:",
    ja: "Solana NFT市場は今週、構造的移行を示した。Magic Edenの週次取引量が4.2%減の<b style='color:var(--gold);font-weight:700'>$28M</b>、Tensorが8.7%増の<b style='color:var(--gold);font-weight:700'>$19M</b>。Mad Ladsのフロアは<b style='color:var(--gold);font-weight:700'>82 SOL</b>を維持：",
  };
  const nftRows = [
    { label: { zh: "Magic Eden 週交易量", en: "Magic Eden Weekly Volume", ja: "Magic Eden週次取引量" }, value: "$28M (-4.2%) ⚠️", status: "warn" as Status },
    { label: { zh: "Tensor 週交易量", en: "Tensor Weekly Volume", ja: "Tensor週次取引量" }, value: "$19M (+8.7%) ✅", status: "safe" as Status },
    { label: { zh: "Mad Lads 地板價", en: "Mad Lads Floor Price", ja: "Mad Ladsフロア価格" }, value: L === "zh" ? "82 SOL ✅ 藍籌穩守" : L === "ja" ? "82 SOL ✅ ブルーチップ" : "82 SOL ✅ blue-chip", status: "safe" as Status },
    { label: { zh: "DeGods 地板價", en: "DeGods Floor Price", ja: "DeGodsフロア価格" }, value: L === "zh" ? "12.4 SOL（以太坊回流）" : L === "ja" ? "12.4 SOL（ETH回流）" : "12.4 SOL (ETH returnees)", status: "info" as Status },
  ];

  const flowRows = [
    { label: { zh: "本週 30 個標記錢包淨買入", en: "30 Labeled Wallets Net Buy (week)", ja: "30ラベルウォレット週次純買入" }, value: "+$2.4M SOL  ✅", status: "safe" as Status },
    { label: { zh: "主要增持標的", en: "Primary Accumulation Targets", ja: "主要買い増し対象" }, value: "JUP · BONK · jitoSOL", status: "safe" as Status },
    { label: { zh: "主要減持標的", en: "Primary Distribution Targets", ja: "主要売り対象" }, value: L === "zh" ? "新發 meme 代幣 ⚠️" : L === "ja" ? "新規ミームトークン ⚠️" : "Newly launched meme tokens ⚠️", status: "warn" as Status },
  ];

  const flowNarrative: T3 = {
    zh: "數字不說謊。Sakura 持續追蹤的 30 個 GMGN 標記地址，在本週的頭寸調整中透露出一個無可辯駁的方向判斷。這批地址本週淨買入 SOL <b style='color:var(--gold);font-weight:700'>$2.4M</b>。更重要的是他們的選擇邏輯：系統性增持 Solana 生態基礎設施代幣，同步清倉新發 meme：",
    en: "The numbers don't equivocate. The 30 GMGN-labeled addresses tracked by Sakura net-purchased <b style='color:var(--gold);font-weight:700'>$2.4 million</b> in SOL this week. What matters more is the selection logic: systematically accumulating Solana infrastructure tokens while distributing newly launched memes:",
    ja: "数字は嘘をつかない。Sakuraが追跡する30のGMGNラベル付きアドレスは今週<b style='color:var(--gold);font-weight:700'>$2.4M</b>のSOLを純購入。重要なのはその選択ロジック：Solanaインフラトークンを系統的に買い増し、新発ミームを売却：",
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
    { zh: "Kamino TVL ATH $2.1B + Drift USDC 借款利率 8.4% 雙重確認：機構資金入場 + 槓桿牛市需求同步爆發——這兩個信號在過去兩輪牛市中從未同時出現在熊市環境", en: "Kamino TVL ATH $2.1B + Drift USDC borrow rate 8.4% — dual confirmation: institutional capital entering + leveraged bull demand surging simultaneously. These two signals have never co-occurred in a bear market across the past two cycles", ja: "Kamino TVL ATH $2.1B + Drift USDC借入金利8.4%が二重確認：機関資金流入とレバレッジ強気需要が同時爆発——過去2サイクルで弱気相場で同時発生したことがない" },
    { zh: "jitoSOL 7.8% APY + 全網質押率 65.2%（歷史最高）= Solana 網絡安全性達歷史峰值，長期持有者可在不放棄流動性的前提下獲得接近 8% 的真實年化", en: "jitoSOL 7.8% APY + 65.2% network staking rate (all-time high) = Solana network security at historical peak. Long-term holders can capture close to 8% real annualized yield without sacrificing liquidity", ja: "jitoSOL 7.8% APY + ネットワークステーキング率65.2%（過去最高）= Solanaネットワークセキュリティが歴史的ピーク。長期保有者は流動性を犠牲にせず約8%の実質年利を獲得可能" },
    { zh: "Tensor 週交易量 +8.7% vs Magic Eden -4.2%：NFT 平台遷移已在鏈上發生，數據早於任何公告——這正是鏈上分析相對市場情緒的核心優勢所在", en: "Tensor +8.7% vs Magic Eden -4.2% week-over-week: NFT platform migration has already occurred on-chain, data preceding any official announcement — this is precisely where on-chain analysis holds a structural edge over market sentiment", ja: "Tensor +8.7% vs Magic Eden -4.2%：NFTプラットフォーム移行はすでにオンチェーンで発生し、どの公式発表よりも先にデータが示した" },
    { zh: "30 個標記錢包增持 JUP/BONK/jitoSOL 同步清倉新發 meme：聰明錢用真實資本完成了投票，Solana 的未來在協議基礎設施，不在下一個 24 小時歸零的 meme", en: "30 labeled wallets accumulating JUP/BONK/jitoSOL while liquidating new meme launches: smart money has cast its vote with real capital — Solana's future lies in protocol infrastructure, not in the next meme that goes to zero within 24 hours", ja: "30ウォレットがJUP/BONK/jitoSOLを積み上げ新発ミームを清算：スマートマネーがリアル資本で投票完了——Solanaの未来はプロトコルインフラにある" },
  ];

  const verdict: T3 = {
    zh: "✅ 本週 Solana 生態呈現機構化加速的五重確認：TVL 新高、借貸利率映射槓桿需求、LST 質押率達歷史最高、NFT 平台格局重塑、聰明錢系統性建倉基礎設施代幣。Firedancer 下週壓測是下一個催化劑。Sakura GoPlus 本週已為每一位用戶自動攔截 2,340 個潛在 rug 合約。",
    en: "✅ This week's Solana ecosystem presents five-fold confirmation of accelerating institutionalization: TVL at new highs, lending rates mapping leveraged demand, LST staking rate at all-time high, NFT platform landscape reshaping, smart money systematically building infrastructure positions. Firedancer's load test next week is the next catalyst. Sakura GoPlus blocked 2,340 potential rug contracts for every user this week, automatically.",
    ja: "✅ 今週のSolana生態系は機関化加速の5重確認を示す：TVL新高値、貸出金利がレバレッジ需要を反映、LSTステーキング率が過去最高、NFTプラットフォーム格局再編、スマートマネーがインフラポジションを系統的に構築。来週のFiredancer負荷テストが次の触媒。Sakura GoPlusは今週すべてのユーザーに対して2,340のrugコントラクトを自動遮断。",
  };

  function NarrativePara({ t3 }: { t3: T3 }) {
    return (
      <p
        style={{ margin: "0 0 14px", fontSize: 14, color: "var(--text-secondary)", lineHeight: 2.0 }}
        dangerouslySetInnerHTML={{ __html: tx(t3, L) }}
      />
    );
  }

  const LANG_BTNS: { lang: "zh" | "en" | "ja"; flag: string; label: string }[] = [
    { lang: "zh", flag: "🇹🇼", label: "中文" },
    { lang: "en", flag: "🇺🇸", label: "EN" },
    { lang: "ja", flag: "🇯🇵", label: "日本語" },
  ];

  return (
    <div>
      {/* ── Nav ── */}
      <nav style={{
        borderBottom: "1px solid var(--border)", background: "var(--bg-card)",
        padding: "14px 40px", display: "flex", alignItems: "center", justifyContent: "space-between",
        position: "sticky", top: 0, zIndex: 50,
      }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
          <div style={{ width: 28, height: 28, borderRadius: 6, overflow: "hidden", flexShrink: 0 }}>
            <WaBijinSVG size={28} />
          </div>
          <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-heading)" }}>Sakura</span>
        </Link>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Week badge */}
          <span style={{
            fontSize: 11, fontWeight: 700, color: "#C9A84C",
            background: "rgba(201,168,76,0.1)", border: "1px solid rgba(201,168,76,0.3)",
            borderRadius: 6, padding: "3px 10px", fontFamily: "var(--font-mono)",
          }}>W14 2026 · {L === "zh" ? "每週一 00:00 更新" : L === "ja" ? "毎週月曜 00:00 更新" : "Updated Mon 00:00"}</span>

          {/* Share button */}
          <button
            onClick={handleShare}
            style={{
              padding: "5px 14px", borderRadius: 6, border: "1px solid var(--border)",
              background: copied ? "rgba(61,122,92,0.15)" : "var(--bg-card-2)",
              color: copied ? "#3D7A5C" : "var(--text-secondary)",
              fontSize: 12, fontWeight: 600, cursor: "pointer", transition: "all 0.15s",
            }}
          >
            {copied ? "✅ " + (L === "zh" ? "已複製" : L === "ja" ? "コピー済" : "Copied") : "🔗 " + (L === "zh" ? "分享報告" : L === "ja" ? "レポートを共有" : "Share Report")}
          </button>

          {/* Lang switcher */}
          <div style={{ display: "flex", gap: 3 }}>
            {LANG_BTNS.map(item => (
              <button
                key={item.lang}
                onClick={() => setLang(item.lang)}
                style={{
                  padding: "4px 9px", borderRadius: 5, border: "none",
                  fontSize: 11, fontWeight: 600, cursor: "pointer",
                  background: lang === item.lang ? "var(--accent)" : "var(--bg-card-2)",
                  color: lang === item.lang ? "#fff" : "var(--text-secondary)",
                  transition: "all 0.15s",
                }}
              >{item.flag} {item.label}</button>
            ))}
          </div>

          <Link href="/use-cases" style={{ fontSize: 13, color: "var(--text-secondary)", textDecoration: "none" }}>
            {L === "zh" ? "← 使用案例" : L === "ja" ? "← 使用例" : "← Use Cases"}
          </Link>
        </div>
      </nav>

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
          <DexShareBar segments={dexSegments} totalVol="$7.9B" lang={L} />

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
          <TableCaption text={L === "zh" ? "30 個標記錢包本週動向：" : L === "ja" ? "30ラベルウォレット今週の動き：" : "30 Labeled Wallet Activity This Week:"} />
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
