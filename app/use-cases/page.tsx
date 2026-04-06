"use client";

import { useState } from "react";
import Link from "next/link";
import WaBijinSVG from "@/components/WaBijinSVG";
import { LanguageProvider, useLang } from "@/contexts/LanguageContext";
import Footer from "@/components/Footer";
import ThemeWrapper from "@/components/ThemeWrapper";

// ─── Helpers ─────────────────────────────────────────────────────────────────

type Lang = "zh" | "en" | "ja";
type T3 = { zh: string; en: string; ja: string };
function tx(o: T3, l: Lang) { return o[l]; }

type Status = "safe" | "warn" | "danger" | "info";

function statusColor(s: Status): string {
  if (s === "safe") return "#3D7A5C";
  if (s === "warn") return "#B8832A";
  if (s === "danger") return "#A8293A";
  return "var(--text-secondary)";
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function QuestionBubble({ text }: { text: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 20 }}>
      <div style={{
        background: "var(--bg-card-2)", border: "1px solid var(--border)",
        borderRadius: "16px 16px 4px 16px", padding: "14px 20px",
        maxWidth: "72%", fontSize: 14, color: "var(--text-primary)", lineHeight: 1.7,
      }}>
        {text}
      </div>
    </div>
  );
}

function SakuraHeader({ sources }: { sources: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
      <div style={{
        width: 30, height: 30, background: "var(--accent)", borderRadius: 7,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 14, fontWeight: 800, color: "#fff", flexShrink: 0,
      }}>S</div>
      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-heading)", letterSpacing: "0.08em" }}>SAKURA</span>
      <span style={{
        fontSize: 11, padding: "2px 9px", borderRadius: 20,
        background: "rgba(61,122,92,0.15)", color: "#3D7A5C",
        border: "1px solid rgba(61,122,92,0.3)", fontWeight: 600,
      }}>✅ 分析完成</span>
      <span style={{
        fontSize: 11, padding: "2px 9px", borderRadius: 20,
        background: "var(--bg-card-2)", color: "var(--text-muted)",
        border: "1px solid var(--border)", marginLeft: "auto",
      }}>{sources}</span>
    </div>
  );
}

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
              <td style={{ padding: "10px 16px", fontSize: 13, color: "var(--text-secondary)", width: "50%" }}>
                {tx(row.label, lang)}
              </td>
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

function ConsensusTable({ headers, rows }: {
  headers: T3[];
  rows: Array<{ token: string; buyers: T3; combo: string; usd: string; stars: string; status: Status }>;
  lang: Lang;
}) {
  return (
    <div style={{ borderRadius: 10, overflow: "hidden", border: "1px solid var(--border)", marginBottom: 20 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", background: "var(--bg-card-2)" }}>
        <thead>
          <tr style={{ borderBottom: "1px solid var(--border)" }}>
            {headers.map((h, i) => (
              <th key={i} style={{ padding: "10px 14px", fontSize: 11, color: "var(--text-muted)", textAlign: "left", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                {h.zh}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: i < rows.length - 1 ? "1px solid var(--border)" : "none" }}>
              <td style={{ padding: "10px 14px", fontSize: 13, fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>{row.token}</td>
              <td style={{ padding: "10px 14px", fontSize: 13, color: statusColor(row.status) }}>{row.buyers.zh}</td>
              <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--text-secondary)" }}>{row.combo}</td>
              <td style={{ padding: "10px 14px", fontSize: 13, color: "#C9A84C", fontFamily: "var(--font-mono)", fontWeight: 600 }}>{row.usd}</td>
              <td style={{ padding: "10px 14px", fontSize: 13 }}>{row.stars}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NumberedBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div style={{
      background: "var(--accent-soft)", border: "1px solid rgba(192,57,43,0.2)",
      borderRadius: 10, padding: "16px 20px", marginBottom: 20,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 12 }}>{title}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {items.map((item, i) => (
          <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={{
              width: 22, height: 22, borderRadius: "50%", background: "var(--accent)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 11, fontWeight: 700, color: "#fff", flexShrink: 0, marginTop: 1,
            }}>{i + 1}</div>
            <span style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.7 }}>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function KeyFindings({ items }: { items: string[] }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 10 }}>
        關鍵發現
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

function VerdictCard({ text, type }: { text: string; type: "safe" | "warn" | "danger" | "success" }) {
  const col = type === "safe" || type === "success" ? "#3D7A5C" : type === "warn" ? "#B8832A" : "#A8293A";
  return (
    <div style={{
      background: "var(--accent-soft)", borderLeft: "3px solid var(--accent)",
      borderRadius: "0 8px 8px 0", padding: "14px 18px", marginBottom: 20,
    }}>
      <div style={{ fontSize: 13, color: col, fontWeight: 600, lineHeight: 1.7 }}>{text}</div>
    </div>
  );
}

function CaseCard({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: "var(--bg-card)", border: "1px solid var(--border)",
      borderRadius: 16, padding: "28px 32px",
    }}>
      {children}
    </div>
  );
}

function SectionTitle({ text }: { text: string }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, color: "var(--accent)",
      letterSpacing: "0.1em", textTransform: "uppercase",
      marginBottom: 8, marginTop: 24, paddingBottom: 8,
      borderBottom: "1px solid var(--border)",
    }}>{text}</div>
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
                {row.atl && <span style={{ fontSize: 9, fontWeight: 700, background: "var(--accent)", color: "#fff", borderRadius: 4, padding: "1px 5px", marginLeft: 6, letterSpacing: "0.04em" }}>ATH</span>}
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
          <div key={i} style={{
            flex: seg.pct, background: seg.color, display: "flex",
            alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ fontSize: 10, fontWeight: 700, color: "#fff", letterSpacing: "0.02em" }}>
              {seg.pct}%
            </span>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 16, marginTop: 8, flexWrap: "wrap" }}>
        {segments.map((seg, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: seg.color, flexShrink: 0 }} />
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
  return (
    <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "0.01em" }}>{text}</p>
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
              <th key={i} style={{ padding: "8px 14px", fontSize: 10, color: "var(--text-muted)", textAlign: "left", fontWeight: 600, letterSpacing: "0.05em", textTransform: "uppercase" }}>
                {tx(h, lang)}
              </th>
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

// ─── Main Component ───────────────────────────────────────────────────────────

function UseCasesContent() {
  const { lang } = useLang();
  const L = lang as Lang;
  const [activeTab, setActiveTab] = useState("security");

  const tabs: Array<{ id: string; label: T3 }> = [
    { id: "security",   label: { zh: "安全防護", en: "Security",    ja: "セキュリティ" } },
    { id: "yield",      label: { zh: "收益優化", en: "Yield",        ja: "利回り最適化" } },
    { id: "smartmoney", label: { zh: "聰明錢信號", en: "Smart Money", ja: "スマートマネー" } },
    { id: "automation", label: { zh: "自動化",   en: "Automation",  ja: "自動化" } },
    { id: "copytrade",  label: { zh: "複製交易", en: "Copy Trade",   ja: "コピートレード" } },
    { id: "market",     label: { zh: "市場洞察", en: "Market",       ja: "市場分析" } },
  ];

  // ── SECURITY ────────────────────────────────────────────────────────────────
  function SecurityCase() {
    const q: T3 = {
      zh: "我看到群裡在推 $WIF，我想買，先幫我做一個全面的安全分析",
      en: "People in my group are hyping $WIF. I want to buy — run a full security check first.",
      ja: "グループで $WIF が話題になっています。買う前に全面的なセキュリティ分析をしてください。",
    };
    const title: T3 = {
      zh: "$WIF 安全全面評估報告",
      en: "$WIF Full Security Assessment",
      ja: "$WIF セキュリティ総合評価レポート",
    };
    const opening: T3 = {
      zh: "WIF（Dogwifhat）是 Solana 上交易量最高的 meme 代幣之一。以下是基於 GoPlus 實時鏈上數據的完整安全評估。核心問題只有一個：你的資金在這個合約裡是否安全？",
      en: "WIF (Dogwifhat) is one of Solana's highest-volume meme tokens. Here's the complete safety assessment from GoPlus real-time on-chain data. The only question that matters: is your capital safe inside this contract?",
      ja: "WIF（Dogwifhat）はSolana上で最も取引量の多いミームトークンの一つです。以下はGoPlus リアルタイムオンチェーンデータによる完全なセキュリティ評価です。",
    };
    const rows = [
      { label: { zh: "GoPlus 安全評分", en: "GoPlus Security Score", ja: "GoPlus セキュリティスコア" }, value: "82 / 100", status: "safe" as Status },
      { label: { zh: "增發權限", en: "Mint Authority", ja: "ミント権限" }, value: { zh: "已永久放棄 ✅", en: "Permanently Revoked ✅", ja: "永久放棄済み ✅" }, status: "safe" as Status },
      { label: { zh: "凍結權限", en: "Freeze Authority", ja: "フリーズ権限" }, value: { zh: "未啟用 ✅", en: "Not Enabled ✅", ja: "未有効 ✅" }, status: "safe" as Status },
      { label: { zh: "蜜罐檢測", en: "Honeypot Detection", ja: "ハニーポット検出" }, value: { zh: "未發現 ✅", en: "Not Detected ✅", ja: "未検出 ✅" }, status: "safe" as Status },
      { label: { zh: "前 10 持有者集中度", en: "Top-10 Holder Concentration", ja: "上位10保有者集中度" }, value: "41.2% ⚠️", status: "warn" as Status },
      { label: { zh: "開發者持倉比例", en: "Developer Holdings", ja: "開発者保有率" }, value: "0.8% ✅", status: "safe" as Status },
      { label: { zh: "流動性深度（2% 滑點）", en: "Liquidity Depth (2% slippage)", ja: "流動性深度（2%スリッページ）" }, value: "$4.2M ✅", status: "safe" as Status },
    ];
    const findings: T3[] = [
      { zh: "核心風險已清除：創辦人無法增發代幣或凍結任何人的資金", en: "Critical risks cleared: founders cannot mint new tokens or freeze any wallet", ja: "主要リスク解消済み：創設者は新規発行も凍結も不可能" },
      { zh: "流動性充足，$50,000 以下的頭寸買賣滑點可控", en: "Sufficient liquidity — positions under $50K face minimal slippage", ja: "十分な流動性 — $50K以下のポジションはスリッページ最小" },
      { zh: "前 10 持有者佔比偏高，需留意大戶集中拋售風險", en: "Top-10 concentration moderately high — watch for large holder exits", ja: "上位10保有者集中度はやや高め — 大口売りに注意" },
    ];
    const verdict: T3 = {
      zh: "✅ 安全評分良好，可考慮買入。建議單筆倉位不超過投資組合的 5%，控制 meme 代幣整體曝險。",
      en: "✅ Safety score solid. Consider buying. Keep position under 5% of portfolio to manage meme token exposure.",
      ja: "✅ 安全スコア良好。購入検討可。ポジションサイズをポートフォリオの5%以内に抑えること。",
    };
    return (
      <CaseCard>
        <QuestionBubble text={tx(q, L)} />
        <SakuraHeader sources={L === "ja" ? "GoPlus API · Helius On-Chain · 2 データ源" : L === "zh" ? "GoPlus API · Helius 鏈上數據 · 2 數據源" : "GoPlus API · Helius On-Chain · 2 Sources"} />
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 20, marginBottom: 16 }} />
        <h2 style={{ margin: "0 0 12px", fontSize: 20, fontWeight: 400, fontFamily: "var(--font-heading)", color: "var(--text-primary)" }}>{tx(title, L)}</h2>
        <p style={{ margin: "0 0 20px", fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.8 }}>{tx(opening, L)}</p>
        <MetricsTable rows={rows} lang={L} />
        <KeyFindings items={findings.map(f => tx(f, L))} />
        <VerdictCard text={tx(verdict, L)} type="safe" />
        <div style={{ textAlign: "center", paddingTop: 4 }}>
          <Link href="/" style={{ display: "inline-block", padding: "10px 28px", background: "var(--accent)", color: "#fff", borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
            {L === "zh" ? "試著問 Sakura" : L === "ja" ? "Sakuraに聞いてみる" : "Try Asking Sakura"}
          </Link>
        </div>
      </CaseCard>
    );
  }

  // ── YIELD ────────────────────────────────────────────────────────────────────
  function YieldCase() {
    const q: T3 = {
      zh: "我有 100 SOL 一直放在錢包裡什麼都沒做，有什麼方法可以讓它產生被動收益？",
      en: "I have 100 SOL sitting idle in my wallet doing nothing. What's the best way to put it to work?",
      ja: "100 SOLがウォレットで遊んでいます。最高の利回りを得るにはどうすればいいですか？",
    };
    const title: T3 = { zh: "100 SOL 最優收益配置方案", en: "Optimal Yield Strategy for 100 SOL", ja: "100 SOL 最適利回り配置プラン" };
    const opening: T3 = {
      zh: "100 SOL 閒置等於每年放棄約 7–8 SOL 的無風險收益。以下是基於實時 APY 數據的全協議比較，以及為你的資產量身定制的配置建議。",
      en: "100 SOL sitting idle means forfeiting roughly 7–8 SOL per year in risk-free yield. Here's a full protocol comparison based on live APY data, with a tailored allocation recommendation.",
      ja: "100 SOLの放置は年間約7〜8 SOLの無リスク収益を逃していることを意味します。リアルタイムAPYデータに基づくプロトコル比較と最適配置をご提案します。",
    };
    const rows = [
      { label: { zh: "Marinade Native · mSOL", en: "Marinade Native · mSOL", ja: "Marinade Native · mSOL" }, value: "7.2% APY", status: "safe" as Status },
      { label: { zh: "Jito · jitoSOL（含 MEV 加成）", en: "Jito · jitoSOL (MEV boosted)", ja: "Jito · jitoSOL（MEVブースト）" }, value: "7.8% APY  ⭐ 最高", status: "safe" as Status },
      { label: { zh: "Sanctum · bSOL", en: "Sanctum · bSOL", ja: "Sanctum · bSOL" }, value: "6.9% APY", status: "safe" as Status },
      { label: { zh: "Lido · stSOL", en: "Lido · stSOL", ja: "Lido · stSOL" }, value: "6.1% APY", status: "safe" as Status },
      { label: { zh: "Kamino USDC Vault（需換幣）", en: "Kamino USDC Vault (swap required)", ja: "Kamino USDC Vault（スワップ必要）" }, value: "8.4% APY", status: "warn" as Status },
    ];
    const alloc = L === "zh"
      ? ["70 SOL → jitoSOL（年化 7.8%，MEV 收益加成）", "20 SOL → 換成 USDC → Kamino USDC Vault（年化 8.4%）", "10 SOL → 保留流動性，隨時可用"]
      : L === "ja"
      ? ["70 SOL → jitoSOL（APY 7.8%、MEVブースト）", "20 SOL → USDCへスワップ → Kamino USDC Vault（APY 8.4%）", "10 SOL → 流動性確保、いつでも利用可能"]
      : ["70 SOL → jitoSOL (7.8% APY, MEV boosted)", "20 SOL → Swap to USDC → Kamino USDC Vault (8.4% APY)", "10 SOL → Keep liquid, available anytime"];
    const findings: T3[] = [
      { zh: "jitoSOL 提供最高 SOL 質押收益，MEV 機制在高交易量時段額外加成", en: "jitoSOL offers highest SOL staking yield — MEV mechanism adds extra return during high-volume periods", ja: "jitoSOL はSOLステーキング最高利回り — 高取引量時にMEVメカニズムで追加収益" },
      { zh: "20 SOL 換 USDC 存入 Kamino 的收益（8.4%）高於直接質押 SOL（7.8%），稀釋風險同時提升整體 APY", en: "Converting 20 SOL to USDC for Kamino (8.4%) beats direct SOL staking (7.8%), diversifying risk while lifting overall APY", ja: "20 SOLをUSDCに換えKaminoに入れる（8.4%）はSOLステーキング（7.8%）を上回り、リスク分散で全体APYを向上" },
      { zh: "混合年化收益率 7.64%，預期年收益約 7.64 SOL（$649 USD）", en: "Blended APY: 7.64%, projected annual yield ~7.64 SOL ($649 USD)", ja: "加重平均APY: 7.64%、予想年間収益 約7.64 SOL（$649 USD）" },
    ];
    const verdict: T3 = {
      zh: "✅ 混合年化收益 7.64%，預期年收益 7.64 SOL ≈ $649（按 SOL $85 計算）。點擊「自主 Agent」一鍵執行完整方案。",
      en: "✅ Blended APY 7.64%. Projected annual yield: 7.64 SOL (~$649 at SOL $85). Click Autonomous Agent to execute in one step.",
      ja: "✅ 加重平均APY 7.64%。予想年間収益: 7.64 SOL（~$649）。自律エージェントで一括実行可能。",
    };
    return (
      <CaseCard>
        <QuestionBubble text={tx(q, L)} />
        <SakuraHeader sources={L === "zh" ? "Sanctum APY · Kamino Finance · Jupiter · 3 數據源" : L === "ja" ? "Sanctum APY · Kamino Finance · Jupiter · 3 データ源" : "Sanctum APY · Kamino Finance · Jupiter · 3 Sources"} />
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 20, marginBottom: 16 }} />
        <h2 style={{ margin: "0 0 12px", fontSize: 20, fontWeight: 400, fontFamily: "var(--font-heading)", color: "var(--text-primary)" }}>{tx(title, L)}</h2>
        <p style={{ margin: "0 0 20px", fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.8 }}>{tx(opening, L)}</p>
        <MetricsTable rows={rows} lang={L} />
        <NumberedBlock title={L === "zh" ? "推薦配置方案" : L === "ja" ? "推奨配置プラン" : "Recommended Allocation"} items={alloc} />
        <KeyFindings items={findings.map(f => tx(f, L))} />
        <VerdictCard text={tx(verdict, L)} type="success" />
        <div style={{ textAlign: "center", paddingTop: 4 }}>
          <Link href="/" style={{ display: "inline-block", padding: "10px 28px", background: "var(--accent)", color: "#fff", borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
            {L === "zh" ? "試著問 Sakura" : L === "ja" ? "Sakuraに聞いてみる" : "Try Asking Sakura"}
          </Link>
        </div>
      </CaseCard>
    );
  }

  // ── SMART MONEY ──────────────────────────────────────────────────────────────
  function SmartMoneyCase() {
    const q: T3 = {
      zh: "過去 24 小時有哪些代幣被最多聰明錢地址集中買入？給我一份共識信號報告",
      en: "Which tokens did the most smart money wallets buy in the last 24 hours? Give me a consensus signal report.",
      ja: "過去24時間でスマートマネーが最も集中して買ったトークンは？コンセンサスレポートをください。",
    };
    const title: T3 = { zh: "24h 聰明錢共識信號報告", en: "24h Smart Money Consensus Signal Report", ja: "24h スマートマネーコンセンサスシグナルレポート" };
    const opening: T3 = {
      zh: "掃描了 30 個標記錢包（12 KOL、8 Whale、6 Smart_Money、4 Cabal）過去 24 小時內的所有 SWAP 交易。以下是出現「多地址同時買入」共識的代幣，按信心評分排序。",
      en: "Scanned 30 labeled wallets (12 KOL, 8 Whale, 6 Smart_Money, 4 Cabal) for all SWAP transactions in the past 24 hours. Below are tokens with multi-wallet consensus, ranked by confidence score.",
      ja: "30のラベル付きウォレット（12 KOL、8 Whale、6 Smart_Money、4 Cabal）の過去24時間のSWAP取引をスキャン。複数ウォレットのコンセンサストークンを信頼度順に表示します。",
    };
    const headers: T3[] = [
      { zh: "代幣", en: "Token", ja: "トークン" },
      { zh: "買入地址數", en: "Wallets Bought", ja: "購入ウォレット" },
      { zh: "標籤組合", en: "Label Mix", ja: "ラベル組合せ" },
      { zh: "24h 淨買入 USD", en: "24h Net Buy USD", ja: "24h 純買入USD" },
      { zh: "信心評分", en: "Confidence", ja: "信頼度" },
    ];
    const rows = [
      { token: "$JUP",    buyers: { zh: "5 個錢包", en: "5 wallets", ja: "5ウォレット" }, combo: "2 Whale + 2 KOL + 1 Cabal", usd: "$347,200", stars: "⭐⭐⭐⭐⭐", status: "safe" as Status },
      { token: "$BONK",   buyers: { zh: "3 個錢包", en: "3 wallets", ja: "3ウォレット" }, combo: "2 KOL + 1 Smart_Money",       usd: "$52,800",  stars: "⭐⭐⭐⭐",  status: "safe" as Status },
      { token: "$PYTH",   buyers: { zh: "2 個錢包", en: "2 wallets", ja: "2ウォレット" }, combo: "1 Whale + 1 Cabal",           usd: "$189,000", stars: "⭐⭐⭐",   status: "warn" as Status },
    ];
    const findings: T3[] = [
      { zh: "$JUP 獲得 5 個地址共識，其中包含 Cabal 地址——這是今日最強信號，Cabal 歷史勝率顯著高於其他標籤", en: "$JUP hit 5-wallet consensus including a Cabal address — strongest signal today, Cabal historically has highest win rate", ja: "$JUPは5ウォレットのコンセンサス（Cabalアドレス含む）— 本日最強シグナル" },
      { zh: "$BONK 的 KOL 組合買入顯示市場情緒轉暖，但 KOL 標籤的交易週期通常較短，適合短線操作", en: "$BONK KOL consensus suggests warming sentiment — KOL trades tend to be shorter-term, suit swing positions", ja: "$BONKのKOLコンセンサスは市場センチメント改善を示唆 — KOL取引は短期向き" },
      { zh: "以上信號均需在執行前通過 GoPlus 安全驗證，Sakura 的複製交易功能已內建此安全門控", en: "All signals require GoPlus safety verification before execution — Sakura Copy Trade has this gate built in", ja: "すべてのシグナルは実行前にGoPlus安全検証が必要 — SakuraのコピートレードはGoPlusゲートを内蔵" },
    ];
    const verdict: T3 = {
      zh: "✅ $JUP 信號最強（⭐⭐⭐⭐⭐），建議優先做安全驗證後跟進。點擊「複製交易」可直接設定跟單策略，GoPlus 安全門控自動執行。",
      en: "✅ $JUP has the strongest signal (⭐⭐⭐⭐⭐). Run security check first, then use Copy Trade — GoPlus safety gate runs automatically.",
      ja: "✅ $JUPが最強シグナル（⭐⭐⭐⭐⭐）。セキュリティ確認後、コピートレードで追従してください。GoPlus安全ゲートは自動実行されます。",
    };
    return (
      <CaseCard>
        <QuestionBubble text={tx(q, L)} />
        <SakuraHeader sources={L === "zh" ? "Helius 鏈上數據 · 30 標記錢包 · 2 數據源" : L === "ja" ? "Helius On-Chain · 30 ラベルウォレット · 2 データ源" : "Helius On-Chain · 30 Labeled Wallets · 2 Sources"} />
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 20, marginBottom: 16 }} />
        <h2 style={{ margin: "0 0 12px", fontSize: 20, fontWeight: 400, fontFamily: "var(--font-heading)", color: "var(--text-primary)" }}>{tx(title, L)}</h2>
        <p style={{ margin: "0 0 20px", fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.8 }}>{tx(opening, L)}</p>
        <ConsensusTable headers={headers} rows={rows} lang={L} />
        <KeyFindings items={findings.map(f => tx(f, L))} />
        <VerdictCard text={tx(verdict, L)} type="safe" />
        <div style={{ textAlign: "center", paddingTop: 4 }}>
          <Link href="/" style={{ display: "inline-block", padding: "10px 28px", background: "var(--accent)", color: "#fff", borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
            {L === "zh" ? "試著問 Sakura" : L === "ja" ? "Sakuraに聞いてみる" : "Try Asking Sakura"}
          </Link>
        </div>
      </CaseCard>
    );
  }

  // ── AUTOMATION ───────────────────────────────────────────────────────────────
  function AutomationCase() {
    const q: T3 = {
      zh: "幫我掃描一下我的錢包，我感覺配置不太合理，生成一個具體的再平衡方案給我",
      en: "Scan my wallet and generate a concrete rebalancing plan. I feel like my allocation is off.",
      ja: "ウォレットをスキャンして具体的なリバランスプランを作成してください。配分がおかしいと感じています。",
    };
    const title: T3 = { zh: "投資組合再平衡分析報告", en: "Portfolio Rebalancing Analysis Report", ja: "ポートフォリオリバランス分析レポート" };
    const opening: T3 = {
      zh: "當前投資組合健康評分 34/100，主要問題是 meme 代幣佔比過高（67%）且 USDC 完全閒置。以下是詳細分析和具體執行方案。",
      en: "Current portfolio health score: 34/100. Main issues: meme token overweight (67%) and idle USDC earning nothing. Here's the detailed analysis and concrete execution plan.",
      ja: "現在のポートフォリオヘルススコア：34/100。主な問題：ミームトークン過多（67%）と遊休USDC。詳細分析と具体的な実行プランをお伝えします。",
    };
    const rows = [
      { label: { zh: "健康評分", en: "Health Score", ja: "ヘルススコア" }, value: "34 / 100", status: "danger" as Status },
      { label: { zh: "meme 代幣佔比 (WIF + BONK + POPCAT)", en: "Meme Token Weight (WIF+BONK+POPCAT)", ja: "ミームトークン比率" }, value: "67% ❌", status: "danger" as Status },
      { label: { zh: "閒置 USDC（零收益）", en: "Idle USDC (earning nothing)", ja: "遊休USDC（無収益）" }, value: "$530 ❌", status: "danger" as Status },
      { label: { zh: "LST / 質押資產", en: "LST / Staked Assets", ja: "LST / ステーク資産" }, value: "0% ❌", status: "danger" as Status },
      { label: { zh: "預計年化機會損失", en: "Est. Annual Opportunity Cost", ja: "年間機会損失推定" }, value: "~$186 USD", status: "warn" as Status },
    ];
    const trades = L === "zh"
      ? ["賣出全部 BONK（$380）→ 存入 Kamino USDC Vault（年化 8.4%）", "賣出 60% WIF 持倉（$744）→ 通過 Jupiter 換成 jitoSOL（年化 7.8%）", "部署閒置 USDC $530 → Kamino USDC Vault，即刻開始生息"]
      : L === "ja"
      ? ["BONK全売却（$380）→ Kamino USDC Vaultに入金（APY 8.4%）", "WIF保有の60%売却（$744）→ JupiterでjitoSOLにスワップ（APY 7.8%）", "遊休USDC $530 → Kamino USDC Vaultに移動、すぐに利息発生"]
      : ["Sell all BONK ($380) → deposit to Kamino USDC Vault (8.4% APY)", "Sell 60% of WIF ($744) → swap to jitoSOL via Jupiter (7.8% APY)", "Deploy idle $530 USDC → Kamino USDC Vault, start earning immediately"];
    const findings: T3[] = [
      { zh: "3 筆交易即可將健康評分從 34 提升至預估 72，無需大幅改變整體持倉結構", en: "Just 3 trades will raise health score from 34 to an estimated 72 — without drastically changing your overall structure", ja: "3つの取引でヘルススコアを34から推定72に改善 — 全体構造を大幅変更せずに" },
      { zh: "閒置資本 $530 USDC 每年可產生 $44.5 收益（8.4% Kamino APY），過去每天都在虧損機會成本", en: "$530 idle USDC will generate ~$44.5/year at Kamino 8.4% APY — every day idle was a missed return", ja: "遊休$530 USDCはKamino 8.4% APYで年間約$44.5を生成 — 毎日の放置が機会損失" },
      { zh: "Agent 執行時每筆交易都會優先通過 Jupiter 聚合最優路徑，確保滑點最小化", en: "Agent routes every trade through Jupiter aggregation for best price — slippage minimized on each step", ja: "AgentはJupiterアグリゲーションで最良ルートを選択 — 各ステップのスリッページを最小化" },
    ];
    const verdict: T3 = {
      zh: "✅ 執行後健康評分預計 34 → 72，年化機會收益新增約 $186 USD。點擊「自主 Agent」授權執行，每筆交易均需 Phantom 簽名確認。",
      en: "✅ Post-execution health score estimated 34 → 72. New annual yield opportunity: ~$186 USD. Click Autonomous Agent to authorize — each trade requires your Phantom signature.",
      ja: "✅ 実行後ヘルススコア推定34→72。新たな年間収益機会：約$186 USD。自律エージェントを承認 — 各取引にPhantom署名が必要。",
    };
    return (
      <CaseCard>
        <QuestionBubble text={tx(q, L)} />
        <SakuraHeader sources={L === "zh" ? "Helius 鏈上數據 · Jupiter · GoPlus · 3 數據源" : L === "ja" ? "Helius On-Chain · Jupiter · GoPlus · 3 データ源" : "Helius On-Chain · Jupiter · GoPlus · 3 Sources"} />
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 20, marginBottom: 16 }} />
        <h2 style={{ margin: "0 0 12px", fontSize: 20, fontWeight: 400, fontFamily: "var(--font-heading)", color: "var(--text-primary)" }}>{tx(title, L)}</h2>
        <p style={{ margin: "0 0 20px", fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.8 }}>{tx(opening, L)}</p>
        <MetricsTable rows={rows} lang={L} />
        <NumberedBlock title={L === "zh" ? "具體執行方案" : L === "ja" ? "具体的な実行プラン" : "Execution Plan"} items={trades} />
        <KeyFindings items={findings.map(f => tx(f, L))} />
        <VerdictCard text={tx(verdict, L)} type="success" />
        <div style={{ textAlign: "center", paddingTop: 4 }}>
          <Link href="/" style={{ display: "inline-block", padding: "10px 28px", background: "var(--accent)", color: "#fff", borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
            {L === "zh" ? "試著問 Sakura" : L === "ja" ? "Sakuraに聞いてみる" : "Try Asking Sakura"}
          </Link>
        </div>
      </CaseCard>
    );
  }

  // ── COPY TRADE ───────────────────────────────────────────────────────────────
  function CopyTradeCase() {
    const q: T3 = {
      zh: "我追蹤的一個 Cabal 地址剛剛大量買入 $RETARDIO，這個信號可信嗎？我應該跟單嗎？",
      en: "A Cabal address I track just made a large buy on $RETARDIO. Is this signal credible? Should I copy the trade?",
      ja: "追跡しているCabalアドレスが$RETARDIOを大量購入しました。このシグナルは信頼できますか？コピーすべきですか？",
    };
    const title: T3 = { zh: "Cabal 跟單信號 + 安全評估報告", en: "Cabal Copy Trade Signal + Safety Assessment", ja: "Cabalコピートレードシグナル + 安全評価レポート" };
    const opening: T3 = {
      zh: "信號地址 9jyqFi...VVz 持有 Cabal + KOL 雙重標籤，過去 90 天 SWAP 勝率 73%，平均持倉週期 3.2 天。本次買入發生在 14 分鐘前，已完成 GoPlus 安全門控驗證。",
      en: "Signal address 9jyqFi...VVz carries Cabal + KOL dual labels, with 73% win rate over the past 90 days and average hold of 3.2 days. This buy occurred 14 minutes ago and has passed GoPlus safety gate.",
      ja: "シグナルアドレス 9jyqFi...VVz はCabal+KOLデュアルラベルを持ち、過去90日のSWAP勝率73%、平均保有期間3.2日。この購入は14分前に発生し、GoPlus安全ゲートを通過しました。",
    };
    const rows = [
      { label: { zh: "信號錢包標籤", en: "Signal Wallet Labels", ja: "シグナルウォレットラベル" }, value: "Cabal + KOL", status: "safe" as Status },
      { label: { zh: "90 天 SWAP 勝率", en: "90-day SWAP Win Rate", ja: "90日SWAPウィン率" }, value: "73% ✅", status: "safe" as Status },
      { label: { zh: "本次買入金額", en: "Signal Buy Amount", ja: "購入金額" }, value: "$38,400 USD", status: "info" as Status },
      { label: { zh: "GoPlus 安全評分", en: "GoPlus Safety Score", ja: "GoPlus 安全スコア" }, value: { zh: "71 / 100 ✅（達到安全門檻）", en: "71 / 100 ✅ (meets threshold)", ja: "71 / 100 ✅（安全閾値達成）" }, status: "safe" as Status },
      { label: { zh: "增發 / 凍結 / 蜜罐", en: "Mint / Freeze / Honeypot", ja: "ミント / フリーズ / ハニーポット" }, value: { zh: "全部清除 ✅", en: "All Clear ✅", ja: "全クリア ✅" }, status: "safe" as Status },
      { label: { zh: "建議跟單倉位", en: "Suggested Copy Size", ja: "推奨コピーサイズ" }, value: "$500 – $800 USD", status: "info" as Status },
    ];
    const findings: T3[] = [
      { zh: "GoPlus 評分 71/100 剛好達到 Sakura 安全門檻（70），代幣基本安全，無增發/凍結/蜜罐風險", en: "GoPlus score 71/100 meets Sakura's 70-point threshold — token is fundamentally safe, no mint/freeze/honeypot risk", ja: "GoPlus スコア71/100でSakura安全閾値（70）に達成 — トークンは基本的に安全" },
      { zh: "Cabal 錢包平均持倉 3.2 天，建議設置 -15% 止損，避免超過信號錢包的退出時間窗口", en: "Cabal wallet averages 3.2-day holds — set -15% stop-loss to avoid being left holding after signal wallet exits", ja: "Cabalウォレットは平均3.2日保有 — 信号ウォレット退出後に残らないよう-15%ストップロス設定推奨" },
      { zh: "建議倉位 $500–$800，相當於信號錢包持倉比例的約 2%，風險可控的跟單比例", en: "Suggested $500–$800 represents ~2% of signal wallet position — a proportional, controlled copy size", ja: "推奨$500〜$800はシグナルウォレットの約2%に相当 — 比例的で管理可能なコピーサイズ" },
    ];
    const verdict: T3 = {
      zh: "✅ 安全門控通過，信號地址信譽良好。建議跟單倉位 $500–$800，並在 -15% 設置止損。點擊「複製交易」立即執行。",
      en: "✅ Safety gate passed. Signal address has strong credibility. Suggested copy: $500–$800 with -15% stop-loss. Click Copy Trade to execute.",
      ja: "✅ 安全ゲート通過。シグナルアドレスは信頼性高。推奨コピー: $500〜$800、-15%ストップロス設定。コピートレードを実行。",
    };
    return (
      <CaseCard>
        <QuestionBubble text={tx(q, L)} />
        <SakuraHeader sources={L === "zh" ? "Helius 鏈上數據 · GoPlus API · 2 數據源" : L === "ja" ? "Helius On-Chain · GoPlus API · 2 データ源" : "Helius On-Chain · GoPlus API · 2 Sources"} />
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 20, marginBottom: 16 }} />
        <h2 style={{ margin: "0 0 12px", fontSize: 20, fontWeight: 400, fontFamily: "var(--font-heading)", color: "var(--text-primary)" }}>{tx(title, L)}</h2>
        <p style={{ margin: "0 0 20px", fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.8 }}>{tx(opening, L)}</p>
        <MetricsTable rows={rows} lang={L} />
        <KeyFindings items={findings.map(f => tx(f, L))} />
        <VerdictCard text={tx(verdict, L)} type="safe" />
        <div style={{ textAlign: "center", paddingTop: 4 }}>
          <Link href="/" style={{ display: "inline-block", padding: "10px 28px", background: "var(--accent)", color: "#fff", borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
            {L === "zh" ? "試著問 Sakura" : L === "ja" ? "Sakuraに聞いてみる" : "Try Asking Sakura"}
          </Link>
        </div>
      </CaseCard>
    );
  }

  // ── MARKET ───────────────────────────────────────────────────────────────────
  function MarketCase() {
    const q: T3 = {
      zh: "幫我出一份完整的 Solana 生態週報——DeFi 協議 TVL、DEX 交易量、pump.fun 數據、聰明錢資金流向，全部給我",
      en: "Give me a full Solana ecosystem weekly — DeFi protocol TVL, DEX volume breakdown, pump.fun data, smart money flows. Everything.",
      ja: "Solana生態系の完全な週次レポートを作成してください — DeFiプロトコルTVL、DEX取引量、pump.funデータ、スマートマネーフロー全部",
    };
    const title: T3 = { zh: "Solana 生態全景週報 (W14 2026)", en: "Solana Ecosystem Weekly (W14 2026)", ja: "Solana エコシステム週報 (W14 2026)" };
    const intro: T3 = {
      zh: "本報告基於 Helius 鏈上交易數據、Kamino / Marginfi / Drift 協議 API、Jupiter 聚合器指標、Magic Eden NFT 數據及 30 個 GMGN 標記錢包的實時追蹤，覆蓋 Solana 生態九個維度。數字會說話——但只有讀懂它們背後的邏輯，才能在這個生態佔據真正的信息優勢。",
      en: "This report draws from Helius on-chain feeds, Kamino / Marginfi / Drift protocol APIs, Jupiter aggregator metrics, Magic Eden NFT data, and real-time surveillance of 30 GMGN-labeled wallets — covering nine dimensions of the Solana ecosystem. Numbers tell a story. Only those who understand the logic behind them hold a genuine edge.",
      ja: "本レポートはHeliusオンチェーンデータ、Kamino / Marginfi / Driftプロトコルアキュムレーター指標、Jupiter、Magic Eden NFTデータ、30のGMGNラベル付きウォレットのリアルタイム監視に基づき、Solana生態系の9次元をカバーする。数字は語る——その背後の論理を理解した者だけが真のエッジを持つ。",
    };

    const kpiItems = L === "zh"
      ? [
          { label: "Solana DeFi TVL", value: "$8.2B",    sub: "+4.8% 週環比",  highlight: true },
          { label: "SOL 現價",         value: "$172.40", sub: "+6.2% 本週" },
          { label: "Jupiter 週交易量", value: "$7.9B",    sub: "3 個月新高" },
          { label: "SOL 全網質押率",   value: "65.2%",    sub: "vs ETH 27%" },
          { label: "活躍驗證者",        value: "1,947",    sub: "去中心化新高" },
          { label: "週協議收入",        value: "$2.1M",    sub: "+18.3% 週環比" },
        ]
      : L === "ja"
      ? [
          { label: "Solana DeFi TVL",   value: "$8.2B",    sub: "+4.8% 週次",        highlight: true },
          { label: "SOL 現在価格",       value: "$172.40", sub: "+6.2% 今週" },
          { label: "Jupiter 週次取引量", value: "$7.9B",    sub: "3ヶ月ぶりの高値" },
          { label: "SOL ステーキング率", value: "65.2%",    sub: "vs ETH 27%" },
          { label: "アクティブバリデーター", value: "1,947", sub: "分散化新高" },
          { label: "週次プロトコル収入", value: "$2.1M",    sub: "+18.3% 週次" },
        ]
      : [
          { label: "Solana DeFi TVL",    value: "$8.2B",    sub: "+4.8% WoW",      highlight: true },
          { label: "SOL Price",           value: "$172.40", sub: "+6.2% this week" },
          { label: "Jupiter Weekly Vol",  value: "$7.9B",    sub: "3-month high" },
          { label: "SOL Staking Rate",    value: "65.2%",    sub: "vs ETH 27%" },
          { label: "Active Validators",   value: "1,947",    sub: "decentralization ATH" },
          { label: "Weekly Protocol Rev", value: "$2.1M",    sub: "+18.3% WoW" },
        ];

    // ── Network Health ──────────────────────────────────────────────────────
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

    // ── Protocol TVL ────────────────────────────────────────────────────────
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
      zh: "Kamino Finance 的借貸 TVL 本週突破 <b style='color:var(--gold);font-weight:700'>$2.1B</b>，創下協議歷史新高——這個數字背後，是一個正在發生的深層資本遷徙。精明資金正悄然撤離高波動的 meme 賽道，轉向有真實收益支撐的穩定幣 Vault。這一模式在過去兩輪牛市中均出現在中期整固之後、下一段主升浪發動之前。整體 Solana DeFi TVL 重回 <b style='color:var(--gold);font-weight:700'>$8.2B</b>，為 2025 年 11 月以來首次：",
      en: "Kamino Finance's lending TVL breached <b style='color:var(--gold);font-weight:700'>$2.1 billion</b> this week — a protocol all-time high that signals more than growth. Sophisticated capital is quietly exiting high-volatility meme exposure and rotating into stablecoin yield vaults with real cash flows. This pattern has historically emerged in mid-cycle consolidation phases, preceding the next major price impulse. Total Solana DeFi TVL reclaimed <b style='color:var(--gold);font-weight:700'>$8.2 billion</b>, a level not seen since November 2025:",
      ja: "Kamino Financeの貸出TVLが今週<b style='color:var(--gold);font-weight:700'>$2.1B</b>を突破し、プロトコル過去最高を記録——この数字は単なる成長以上のことを意味する。精巧な資本が高ボラティリティのミームポジションを静かに解消し、実際のキャッシュフローを持つステーブルコイン収益Vaultへシフトしている。このパターンは過去2回の強気相場で中期調整後、次の主要上昇前に見られた。Solana DeFi TVL総額は<b style='color:var(--gold);font-weight:700'>$8.2B</b>を回復：",
    };

    const dexSegments: ShareSegment[] = [
      { label: "Jupiter",  pct: 61, color: "var(--accent)" },
      { label: "Raydium",  pct: 19, color: "#C9A84C" },
      { label: "Orca",     pct: 11, color: "#4A7EB5" },
      { label: L === "zh" ? "其他" : L === "ja" ? "その他" : "Others", pct: 9, color: "var(--text-muted)" },
    ];

    const dexNarrative: T3 = {
      zh: "Jupiter 對 Solana DEX 格局的統治力本週進一步固化。這個聚合器以 <b style='color:var(--gold);font-weight:700'>$4.8B</b> 的週交易量獨佔生態 <b style='color:var(--gold);font-weight:700'>61%</b> 的流動性份額——這種集中度令人聯想到以太坊 Uniswap 的鼎盛時期，並已引發協議層面流動性風險的學術討論。值得注意的是：Raydium 以 19% 保持穩固的二線地位，而 Orca 的 11% 則主要來自機構 LP 的集中流動性策略。Solana DEX 總交易量本週達 <b style='color:var(--gold);font-weight:700'>$7.9B</b>，近三個月峰值：",
      en: "Jupiter's grip on Solana's DEX landscape tightened further this week. The aggregator's <b style='color:var(--gold);font-weight:700'>$4.8 billion</b> in volume represented <b style='color:var(--gold);font-weight:700'>61%</b> of all on-chain trading activity — a dominance level that draws comparison to Uniswap's peak years on Ethereum and has already prompted academic debate on protocol-level liquidity concentration risk. Notably, Raydium holds a solid 19% second-tier position, while Orca's 11% is driven primarily by institutional LP concentrated liquidity strategies. Total Solana DEX volume reached a 3-month peak of <b style='color:var(--gold);font-weight:700'>$7.9 billion</b>:",
      ja: "JupiterのSolana DEX支配力は今週さらに強化された。このアグリゲーターの<b style='color:var(--gold);font-weight:700'>$4.8B</b>の取引量は全オンチェーン取引の<b style='color:var(--gold);font-weight:700'>61%</b>を占め、イーサリアムのUniswap全盛期と比較され、プロトコルレベルの流動性集中リスクについての学術的議論を引き起こしている。Raydiumが19%の堅固な2位を維持し、Orcaの11%は主に機関LPの集中流動性戦略に起因する。Solana DEX総取引量は<b style='color:var(--gold);font-weight:700'>$7.9B</b>と3ヶ月ぶりの高値：",
    };

    const pumpRows = [
      { label: { zh: "7 天新幣上線數量", en: "New Tokens Launched (7d)", ja: "7日新トークン上場数" }, value: "14,820  (-18.7%)", status: "warn" as Status },
      { label: { zh: "畢業到 Raydium（畢業率）", en: "Graduated to Raydium (rate)", ja: "Raydiumへ卒業（卒業率）" }, value: L === "zh" ? "847 枚（5.7%）✅ 回升" : L === "ja" ? "847件（5.7%）✅ 回復" : "847 (5.7%) ✅ recovering", status: "safe" as Status },
      { label: { zh: "GoPlus 已攔截高危合約", en: "GoPlus Blocked High-Risk Contracts", ja: "GoPlus 高危コントラクト遮断" }, value: L === "zh" ? "2,340 個 ✅ 已阻止" : L === "ja" ? "2,340件 ✅ 遮断済み" : "2,340 ✅ blocked", status: "safe" as Status },
      { label: { zh: "本週最熱代幣類別", en: "Hottest Token Category", ja: "今週の最熱トークンカテゴリ" }, value: L === "zh" ? "AI Agent 代幣 32%" : L === "ja" ? "AIエージェントトークン 32%" : "AI Agent Tokens 32%", status: "info" as Status },
    ];

    const pumpNarrative: T3 = {
      zh: "pump.fun 的生態健康數據本週傳遞出一個值得深思的分叉信號。新幣上線量回落至 <b style='color:var(--gold);font-weight:700'>14,820</b> 枚（週環比 -18.7%），但這不是衰退——而是篩選。畢業率從上週的 4.1% 回升至 <b style='color:var(--gold);font-weight:700'>5.7%</b>，意味著市場正在以更高的標準過濾代幣：上線的少了，但能存活的質量更高。這一「去粗取精」的自淨效應，與 Sakura 集成的 GoPlus 安全引擎形成雙重保護——後者本週自動攔截了 <b style='color:var(--gold);font-weight:700'>2,340 個</b>高危合約：",
      en: "pump.fun's ecosystem health metrics sent a fork in the road signal this week — one that deserves careful reading. New token launches declined to <b style='color:var(--gold);font-weight:700'>14,820</b> (-18.7% week-over-week), but this is not contraction — it's curation. The graduation rate climbed from last week's 4.1% to <b style='color:var(--gold);font-weight:700'>5.7%</b>, meaning the market is filtering with higher standards: fewer launches, but the survivors are of measurably higher quality. This natural self-cleansing effect is reinforced by Sakura's integrated GoPlus safety engine, which auto-blocked <b style='color:var(--gold);font-weight:700'>2,340</b> high-risk contracts during this week's launch cycle:",
      ja: "pump.funの生態系健全性データは今週、注意深く読む必要のある分岐シグナルを発した。新トークン上場数は<b style='color:var(--gold);font-weight:700'>14,820</b>（前週比-18.7%）に減少したが、これは縮小ではなく選別だ。卒業率が先週の4.1%から<b style='color:var(--gold);font-weight:700'>5.7%</b>に上昇——市場はより高い基準でフィルタリングしている：上場数は減ったが、生き残るトークンの品質は測定可能なほど向上している。この自然な自己浄化効果は、SakuraのGoPlus安全エンジンによって強化され、今週の上場サイクルで<b style='color:var(--gold);font-weight:700'>2,340件</b>の高危険コントラクトを自動遮断：",
    };

    const flowRows = [
      { label: { zh: "本週 30 個標記錢包淨買入", en: "30 Labeled Wallets Net Buy (week)", ja: "30ラベルウォレット週次純買入" }, value: "+$2.4M SOL  ✅", status: "safe" as Status },
      { label: { zh: "主要增持標的", en: "Primary Accumulation Targets", ja: "主要買い増し対象" }, value: "JUP · BONK · jitoSOL", status: "safe" as Status },
      { label: { zh: "主要減持標的", en: "Primary Distribution Targets", ja: "主要売り対象" }, value: L === "zh" ? "新發 meme 代幣 ⚠️" : L === "ja" ? "新規ミームトークン ⚠️" : "Newly launched meme tokens ⚠️", status: "warn" as Status },
    ];

    const flowNarrative: T3 = {
      zh: "數字不說謊。Sakura 持續追蹤的 30 個 GMGN 標記地址（涵蓋 KOL、大戶、Cabal 三類標籤），在本週的頭寸調整中透露出一個無可辯駁的方向判斷。這批在鏈上被廣泛視為「先知資金」的地址，本週淨買入 SOL <b style='color:var(--gold);font-weight:700'>$2.4M</b>。但更重要的是他們的選擇邏輯：系統性增持 Solana 生態基礎設施代幣，同步清倉新發 meme——這是聰明錢在用真實資本，對未來的賽道格局進行投票：",
      en: "The numbers don't equivocate. The 30 GMGN-labeled addresses continuously tracked by Sakura — spanning KOL, Whale, and Cabal classifications — made an unambiguous directional statement through their net positioning this week. These wallets, widely regarded on-chain as oracle capital, net-purchased <b style='color:var(--gold);font-weight:700'>$2.4 million</b> in SOL. But what matters more is the selection logic: systematically accumulating Solana infrastructure tokens while distributing newly launched memes — smart money voting with real capital on which sector has a future:",
      ja: "数字は嘘をつかない。Sakuraが継続追跡する30のGMGNラベル付きアドレス（KOL、Whale、Cabalの3分類）は、今週のネットポジション調整を通じて明確な方向判断を示した。オンチェーンで「先見の資金」として広く認識されるこれらのアドレスは、<b style='color:var(--gold);font-weight:700'>$2.4M</b>のSOLを純購入。しかし重要なのはその選択ロジック：Solanaインフラトークンを系統的に買い増しし、新発ミームを売却——スマートマネーがどのセクターに未来があるかをリアル資本で投票している：",
    };

    // ── Lending ─────────────────────────────────────────────────────────────
    const lendingNarrative: T3 = {
      zh: "Solana 借貸市場的利率曲線正在描繪一個精確的牛市圖景。Drift 的 USDC 存款 APY 達 <b style='color:var(--gold);font-weight:700'>5.2%</b>，在 Solana 上以穩定幣獲得超越多數傳統銀行的存款利率已成為可執行的現實策略。而 Kamino 的 SOL 借款利率攀升至 <b style='color:var(--gold);font-weight:700'>8.1%</b>，折射出市場對槓桿做多 SOL 的強烈需求——這比社交媒體上任何喊單都更誠實：",
      en: "Solana's lending rate curve is drawing a precise picture of bull market sentiment. Drift's USDC supply APY of <b style='color:var(--gold);font-weight:700'>5.2%</b> has shifted stablecoin yields above most traditional bank deposit rates from hypothesis to executable strategy. Meanwhile, Kamino's SOL borrow rate climbing to <b style='color:var(--gold);font-weight:700'>8.1%</b> reflects intense leveraged long demand — a more honest signal than any social media price call:",
      ja: "Solanaの貸出市場の金利カーブは強気相場の正確な図を描いている。DriftのUSDC預金APY <b style='color:var(--gold);font-weight:700'>5.2%</b>は、大多数の銀行預金金利を超える安定コイン収益を仮説から実行可能戦略へと移行させた。KaminoのSOL借入金利が<b style='color:var(--gold);font-weight:700'>8.1%</b>まで上昇したことは、レバレッジドロング需要の強烈さを反映している：",
    };

    // ── LST ─────────────────────────────────────────────────────────────────
    const lstNarrative: T3 = {
      zh: "流動質押代幣正在成為 Solana DeFi 最優雅的基礎資產。全網 SOL 質押率本週達 <b style='color:var(--gold);font-weight:700'>65.2%</b>——遠超以太坊的 27%——這既是網絡安全性的硬指標，也是市場對 Solana 長期敘事投下的信任票。jitoSOL 以 <b style='color:var(--gold);font-weight:700'>7.8%</b> APY 稱冠，其超額回報來源是 Jito Labs 的 MEV 捕獲機制——在高交易量時段可額外貢獻 0.3–0.8% 年化加成，持有者無需承擔任何額外風險：",
      en: "Liquid staking tokens are quietly becoming Solana DeFi's most elegant foundational assets. The network's SOL staking rate reached <b style='color:var(--gold);font-weight:700'>65.2%</b> this week — far ahead of Ethereum's 27% — a hard metric for network security and a market confidence vote in Solana's long-term thesis. jitoSOL leads at <b style='color:var(--gold);font-weight:700'>7.8%</b> APY, with excess returns sourced from Jito Labs' MEV capture mechanism, contributing an additional 0.3–0.8% annualized during high-volume periods at no added risk to holders:",
      ja: "流動性ステーキングトークンはSolana DeFiの最も洗練された基盤資産として台頭している。今週のSOLステーキング率は<b style='color:var(--gold);font-weight:700'>65.2%</b>に達し、イーサリアムの27%を大きく上回る——ネットワークセキュリティのハード指標であり、Solanaの長期テーゼへの信頼票だ。jitoSOLが<b style='color:var(--gold);font-weight:700'>7.8%</b> APYで首位、超過収益はJito LabsのMEV獲得メカニズムに由来し、高取引量時に追加リスクなしで0.3〜0.8%年率加算：",
    };

    // ── NFT ─────────────────────────────────────────────────────────────────
    const nftNarrative: T3 = {
      zh: "Solana NFT 市場本週出現了一個值得記錄的結構性轉移。Magic Eden 週交易量下滑 4.2% 至 <b style='color:var(--gold);font-weight:700'>$28M</b>，而 Tensor 逆勢上漲 8.7% 至 <b style='color:var(--gold);font-weight:700'>$19M</b>——市場份額正在以每週可見的速度向 Tensor 重新分配。這種遷移往往不會因一個公告而發生，而是用戶以交易行為投票的結果。同期，Mad Lads 地板價穩守 <b style='color:var(--gold);font-weight:700'>82 SOL</b>，延續了 Solana 藍籌 NFT 的抗跌韌性：",
      en: "Solana's NFT market registered a structural shift this week worth noting on record. Magic Eden's weekly volume declined 4.2% to <b style='color:var(--gold);font-weight:700'>$28 million</b>, while Tensor surged 8.7% to <b style='color:var(--gold);font-weight:700'>$19 million</b> — market share is being redistributed to Tensor at a weekly-visible pace. This kind of migration doesn't happen because of an announcement; it happens when users vote with their transactions. Meanwhile, Mad Lads floor held firm at <b style='color:var(--gold);font-weight:700'>82 SOL</b>, confirming Solana blue-chip NFT resilience:",
      ja: "Solana NFT市場は今週、記録に値する構造的移行を示した。Magic Edenの週次取引量が4.2%減の<b style='color:var(--gold);font-weight:700'>$28M</b>、Tensorが8.7%増の<b style='color:var(--gold);font-weight:700'>$19M</b>と逆行——市場シェアは週次で可視的なペースでTensorへ再配分されている。この移行は発表によって起きるのではなく、ユーザーが取引で投票した結果だ。Mad Ladsのフロアは<b style='color:var(--gold);font-weight:700'>82 SOL</b>を維持：",
    };
    const nftRows = [
      { label: { zh: "Magic Eden 週交易量", en: "Magic Eden Weekly Volume", ja: "Magic Eden週次取引量" }, value: "$28M (-4.2%) ⚠️", status: "warn" as Status },
      { label: { zh: "Tensor 週交易量", en: "Tensor Weekly Volume", ja: "Tensor週次取引量" }, value: "$19M (+8.7%) ✅", status: "safe" as Status },
      { label: { zh: "Mad Lads 地板價", en: "Mad Lads Floor Price", ja: "Mad Ladsフロア価格" }, value: L === "zh" ? "82 SOL ✅ 藍籌穩守" : L === "ja" ? "82 SOL ✅ ブルーチップ" : "82 SOL ✅ blue-chip", status: "safe" as Status },
      { label: { zh: "DeGods 地板價", en: "DeGods Floor Price", ja: "DeGodsフロア価格" }, value: L === "zh" ? "12.4 SOL（以太坊回流）" : L === "ja" ? "12.4 SOL（ETH回流）" : "12.4 SOL (ETH returnees)", status: "info" as Status },
    ];

    // ── Watch ────────────────────────────────────────────────────────────────
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
      {
        zh: "Kamino TVL ATH $2.1B + Drift USDC 借款利率 8.4% 雙重確認：機構資金入場 + 槓桿牛市需求同步爆發——這兩個信號在過去兩輪牛市中從未同時出現在熊市環境",
        en: "Kamino TVL ATH $2.1B + Drift USDC borrow rate 8.4% — dual confirmation: institutional capital entering + leveraged bull demand surging simultaneously. These two signals have never co-occurred in a bear market environment across the past two cycles",
        ja: "Kamino TVL ATH $2.1B + Drift USDC借入金利8.4%が二重確認：機関資金流入とレバレッジ強気需要が同時爆発——これら2つのシグナルは過去2サイクルで弱気相場環境で同時発生したことがない"
      },
      {
        zh: "jitoSOL 7.8% APY + 全網質押率 65.2%（歷史最高）= Solana 網絡安全性達歷史峰值，長期持有者可在不放棄流動性的前提下獲得接近 8% 的真實年化",
        en: "jitoSOL 7.8% APY + 65.2% network staking rate (all-time high) = Solana network security at historical peak. Long-term holders can capture close to 8% real annualized yield without sacrificing liquidity",
        ja: "jitoSOL 7.8% APY + ネットワークステーキング率65.2%（過去最高）= Solanaネットワークセキュリティが歴史的ピーク。長期保有者は流動性を犠牲にせず約8%の実質年利を獲得可能"
      },
      {
        zh: "Tensor 週交易量 +8.7% vs Magic Eden -4.2%：NFT 平台遷移已在鏈上發生，數據早於任何公告——這正是鏈上分析相對市場情緒的核心優勢所在",
        en: "Tensor +8.7% vs Magic Eden -4.2% week-over-week: NFT platform migration has already occurred on-chain, data preceding any official announcement — this is precisely where on-chain analysis holds a structural edge over market sentiment",
        ja: "Tensor +8.7% vs Magic Eden -4.2%：NFTプラットフォーム移行はすでにオンチェーンで発生し、どの公式発表よりも先にデータが示した——これがオンチェーン分析が市場センチメントに対して持つ構造的優位性"
      },
      {
        zh: "30 個標記錢包增持 JUP/BONK/jitoSOL 同步清倉新發 meme：聰明錢用真實資本完成了投票，Solana 的未來在協議基礎設施，不在下一個 24 小時歸零的 meme",
        en: "30 labeled wallets accumulating JUP/BONK/jitoSOL while liquidating new meme launches: smart money has cast its vote with real capital — Solana's future lies in protocol infrastructure, not in the next meme that goes to zero within 24 hours",
        ja: "30ウォレットがJUP/BONK/jitoSOLを積み上げ新発ミームを清算：スマートマネーがリアル資本で投票完了——Solanaの未来はプロトコルインフラにあり、24時間以内にゼロになる次のミームにはない"
      },
    ];

    const verdict: T3 = {
      zh: "✅ 本週 Solana 生態呈現機構化加速的五重確認：TVL 新高、借貸利率映射槓桿需求、LST 質押率達歷史最高、NFT 平台格局重塑、聰明錢系統性建倉基礎設施代幣。這不是一個普通的上漲週——這是生態成熟化加速的週。Firedancer 下週壓測是下一個催化劑。Sakura GoPlus 本週已為每一位用戶自動攔截 2,340 個潛在 rug 合約。",
      en: "✅ This week's Solana ecosystem presents five-fold confirmation of accelerating institutionalization: TVL at new highs, lending rates mapping leveraged demand, LST staking rate at all-time high, NFT platform landscape reshaping, smart money systematically building infrastructure positions. This is not an ordinary up week — it is ecosystem maturation accelerating. Firedancer's load test next week is the next catalyst. Sakura GoPlus blocked 2,340 potential rug contracts for every user this week, automatically.",
      ja: "✅ 今週のSolana生態系は機関化加速の5重確認を示す：TVL新高値、貸出金利がレバレッジ需要を反映、LSTステーキング率が過去最高、NFTプラットフォーム格局再編、スマートマネーがインフラポジションを系統的に構築。普通の上昇週ではない——生態系成熟化が加速している週だ。来週のFiredancer負荷テストが次の触媒。Sakura GoPlusは今週すべてのユーザーに対して2,340のrugコントラクトを自動遮断。",
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
      <CaseCard>
        <QuestionBubble text={tx(q, L)} />
        <SakuraHeader sources={L === "zh" ? "Helius · Jupiter · Kamino · Marginfi · Drift · GoPlus · pump.fun · GMGN · Magic Eden · 9 數據源" : L === "ja" ? "Helius · Jupiter · Kamino · Marginfi · Drift · GoPlus · pump.fun · GMGN · Magic Eden · 9 データ源" : "Helius · Jupiter · Kamino · Marginfi · Drift · GoPlus · pump.fun · GMGN · Magic Eden · 9 Sources"} />
        <div style={{ borderTop: "1px solid var(--border)", paddingTop: 20, marginBottom: 16 }} />
        <h2 style={{ margin: "0 0 10px", fontSize: 24, fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-heading)", letterSpacing: "0.01em" }}>{tx(title, L)}</h2>
        <p style={{ margin: "0 0 24px", fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.9, fontStyle: "italic", borderLeft: "2px solid var(--border)", paddingLeft: 14 }}>{tx(intro, L)}</p>

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
        <VerdictCard text={tx(verdict, L)} type="success" />
        <div style={{ textAlign: "center", paddingTop: 4 }}>
          <Link href="/" style={{ display: "inline-block", padding: "10px 28px", background: "var(--accent)", color: "#fff", borderRadius: 8, fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
            {L === "zh" ? "試著問 Sakura" : L === "ja" ? "Sakuraに聞いてみる" : "Try Asking Sakura"}
          </Link>
        </div>
      </CaseCard>
    );
  }

  function renderCase() {
    if (activeTab === "security")   return <SecurityCase />;
    if (activeTab === "yield")      return <YieldCase />;
    if (activeTab === "smartmoney") return <SmartMoneyCase />;
    if (activeTab === "automation") return <AutomationCase />;
    if (activeTab === "copytrade")  return <CopyTradeCase />;
    return <MarketCase />;
  }

  return (
    <ThemeWrapper>
      {/* Nav */}
      <nav style={{
        borderBottom: "1px solid var(--border)", background: "var(--bg-card)",
        padding: "14px 40px", display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
          <div style={{ width: 28, height: 28, borderRadius: 6, overflow: "hidden", flexShrink: 0 }}>
            <WaBijinSVG size={28} />
          </div>
          <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-heading)" }}>Sakura</span>
        </Link>
        <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
          <Link href="/docs" style={{ fontSize: 13, color: "var(--text-secondary)", textDecoration: "none" }}>
            {L === "ja" ? "ドキュメント" : L === "zh" ? "使用手冊" : "Docs"}
          </Link>
          <Link href="/pricing" style={{ fontSize: 13, color: "var(--text-secondary)", textDecoration: "none" }}>
            {L === "ja" ? "料金" : L === "zh" ? "定價" : "Pricing"}
          </Link>
          <Link href="/" style={{
            fontSize: 13, padding: "7px 18px", borderRadius: 8,
            background: "var(--accent)", color: "#fff", textDecoration: "none", fontWeight: 600,
          }}>
            {L === "ja" ? "アプリを起動" : L === "zh" ? "啟動應用" : "Launch App"}
          </Link>
        </div>
      </nav>

      {/* Content */}
      <div style={{ padding: "60px 40px 0", maxWidth: 800, margin: "0 auto" }}>

        {/* Hero */}
        <div style={{ marginBottom: 48 }}>
          <div style={{
            display: "inline-block", fontSize: 11, padding: "4px 12px",
            borderRadius: 20, border: "1px solid var(--border)",
            color: "var(--text-muted)", marginBottom: 20,
            letterSpacing: "0.06em", textTransform: "uppercase",
          }}>
            {L === "ja" ? "使用事例" : L === "zh" ? "使用案例" : "Use Cases"}
          </div>
          <h1 style={{
            fontSize: 36, fontWeight: 300, lineHeight: 1.2, margin: "0 0 16px",
            fontFamily: "var(--font-heading)", color: "var(--text-primary)", letterSpacing: "0.02em",
          }}>
            {L === "ja" ? "Sakura の実際の分析サンプル" : L === "zh" ? "Sakura 真實分析樣本" : "Sakura in Action — Real Analysis Samples"}
          </h1>
          <p style={{ fontSize: 15, color: "var(--text-secondary)", lineHeight: 1.8, margin: 0 }}>
            {L === "ja"
              ? "以下は Sakura が実際のタスクで生成する分析の例です。すべての機能が完全に実装されていると仮定してください。"
              : L === "zh"
              ? "以下是 Sakura 在真實任務中生成的分析樣本。每一個案例都代表 Sakura 可以為你做的事。"
              : "Below are samples of analysis Sakura generates on real tasks. Each case represents what Sakura can do for you."}
          </p>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 32 }}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: "8px 18px", borderRadius: 20, cursor: "pointer",
                border: `1px solid ${activeTab === tab.id ? "var(--accent)" : "var(--border)"}`,
                background: activeTab === tab.id ? "var(--accent)" : "transparent",
                color: activeTab === tab.id ? "#fff" : "var(--text-secondary)",
                fontSize: 13, fontWeight: 500, transition: "all 0.15s",
              }}
            >
              {tx(tab.label, L)}
            </button>
          ))}
        </div>

        {/* Case study */}
        <div style={{ paddingBottom: 80 }}>
          {renderCase()}
        </div>

        {/* Bottom CTA */}
        <div style={{
          background: "var(--accent-soft)", border: "1px solid rgba(192,57,43,0.25)",
          borderRadius: 16, padding: "36px 40px", textAlign: "center", marginBottom: 60,
        }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 22, fontWeight: 400, fontFamily: "var(--font-heading)", color: "var(--text-primary)" }}>
            {L === "ja" ? "今すぐ始める" : L === "zh" ? "每一個問題，Sakura 都有答案" : "Every Question. Sakura Has an Answer."}
          </h3>
          <p style={{ margin: "0 0 24px", fontSize: 14, color: "var(--text-secondary)" }}>
            {L === "ja"
              ? "Phantom ウォレットを接続するだけ。3 回まで無料でお試しいただけます。"
              : L === "zh"
              ? "連接 Phantom 錢包，每項功能免費試用 3 次。不需要帳號，不需要訂閱。"
              : "Connect your Phantom wallet. 3 free uses of every feature. No account, no subscription."}
          </p>
          <Link href="/" style={{
            display: "inline-block", padding: "12px 36px", borderRadius: 10,
            background: "var(--accent)", color: "#fff", textDecoration: "none",
            fontSize: 14, fontWeight: 600,
          }}>
            {L === "ja" ? "アプリを起動" : L === "zh" ? "啟動 Sakura" : "Launch Sakura"}
          </Link>
        </div>
      </div>

      <Footer />
    </ThemeWrapper>
  );
}

export default function UseCasesPage() {
  return (
    <LanguageProvider>
      <UseCasesContent />
    </LanguageProvider>
  );
}
