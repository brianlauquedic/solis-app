"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { LanguageProvider, useLang } from "@/contexts/LanguageContext";
import Footer from "@/components/Footer";
import ThemeWrapper from "@/components/ThemeWrapper";

// ─── Data ──────────────────────────────────────────────────────────────────

const SIDEBAR_EN = {
  handbook: "Handbook",
  intro: "Introduction",
  why: "Why We Built Sakura",
  who: "Who Is It For?",
  diff: "What Makes It Different?",
  featuresLabel: "FEATURES",
  health: "Portfolio Health Check",
  security: "Security Analysis",
  advisor: "AI Advisor",
  agent: "Autonomous Rebalance Agent",
  smartmoney: "Smart Money Tracker",
  guardian: "Guardian Auto-Monitor",
  gmgn: "GMGN Live Chart",
  copytrade: "Copy Trade",
  techLabel: "TECHNOLOGY",
  goplus: "GoPlus Integration",
  helius: "Helius On-Chain Data",
  claude: "Claude AI Engine",
  noncustodial: "Non-Custodial Architecture",
  x402: "x402 Micropayments",
  start: "Getting Started",
};

const SIDEBAR_ZH = {
  handbook: "使用手冊",
  intro: "簡介",
  why: "為什麼打造 Sakura",
  who: "適合誰使用？",
  diff: "差異化優勢",
  featuresLabel: "功能",
  health: "持倉體檢",
  security: "安全分析",
  advisor: "AI 顧問",
  agent: "自主再平衡 Agent",
  smartmoney: "聰明錢追蹤",
  guardian: "Guardian 自動監控",
  gmgn: "GMGN 實時 K 線",
  copytrade: "複製交易",
  techLabel: "技術架構",
  goplus: "GoPlus 整合",
  helius: "Helius 鏈上數據",
  claude: "Claude AI 引擎",
  noncustodial: "非託管架構",
  x402: "x402 微支付",
  start: "如何開始",
};

const SIDEBAR_JA = {
  handbook: "ハンドブック",
  intro: "はじめに",
  why: "なぜ作ったのか",
  who: "誰のためのツールか",
  diff: "差別化ポイント",
  featuresLabel: "機能",
  health: "ポートフォリオ診断",
  security: "セキュリティ分析",
  advisor: "AIアドバイザー",
  agent: "自律リバランスエージェント",
  smartmoney: "スマートマネー追跡",
  guardian: "Guardian 自動監視",
  gmgn: "GMGNリアルタイムチャート",
  copytrade: "コピートレード",
  techLabel: "テクノロジー",
  goplus: "GoPlus統合",
  helius: "Heliusオンチェーンデータ",
  claude: "Claude AIエンジン",
  noncustodial: "非カストディアル設計",
  x402: "x402マイクロペイメント",
  start: "はじめ方",
};

const SECTIONS = [
  "intro","why","who","diff",
  "health","security","advisor","agent","smartmoney","guardian","gmgn","copytrade",
  "goplus","helius","claude","noncustodial","x402",
  "start",
];

// ─── Components ─────────────────────────────────────────────────────────────

function SectionHeading({ id, label, sub }: { id: string; label: string; sub?: string }) {
  return (
    <div id={id} style={{ scrollMarginTop: 80 }}>
      <h2 style={{
        fontSize: 26, fontWeight: 400, color: "var(--text-primary)",
        fontFamily: "var(--font-heading)", margin: "0 0 8px", letterSpacing: "0.01em",
      }}>{label}</h2>
      {sub && <p style={{ fontSize: 15, color: "var(--text-secondary)", lineHeight: 1.8, margin: "0 0 24px" }}>{sub}</p>}
      <div style={{ height: 1, background: "var(--border)", marginBottom: 28 }} />
    </div>
  );
}

function ComparisonTable({ lang }: { lang: string }) {
  const rows_en = [
    ["Real-time security scan before swap", "❌", "✅ GoPlus 5-dim gate"],
    ["Smart money consensus signals (24h)", "❌", "✅ 30+ labeled wallets"],
    ["On-chain verifiable AI reasoning", "❌", "✅ SHA-256 + Solana Memo"],
    ["Non-custodial execution", "⚠️ Mixed", "✅ Always via Phantom"],
    ["Autonomous rebalance without prompts", "❌", "✅ SAK Agent loop"],
    ["GMGN live K-line chart (in-app)", "❌", "✅ Proxy + lightweight-charts"],
    ["pump.fun bonding curve support", "❌", "✅ Native support"],
    ["x402 pay-per-use micropayments", "❌", "✅ USDC on Solana"],
    ["Copy trade with safety gate", "❌", "✅ Score ≥ 70 only"],
    ["Guardian conditional automation", "❌", "✅ Price/APY/health triggers"],
    ["Solana-native depth (Jupiter, Helius, Jito)", "Partial", "✅ Full integration"],
  ];
  const rows_zh = [
    ["交易前即時安全掃描", "❌", "✅ GoPlus 5維度把關"],
    ["聰明錢共識信號（24h）", "❌", "✅ 30+ 標籤錢包"],
    ["鏈上可驗證 AI 推理", "❌", "✅ SHA-256 + Solana Memo"],
    ["非託管執行", "⚠️ 不一致", "✅ 始終透過 Phantom"],
    ["無需提示的自主再平衡", "❌", "✅ SAK Agent 循環"],
    ["GMGN 即時 K 線（應用內）", "❌", "✅ 代理 + lightweight-charts"],
    ["pump.fun Bonding Curve 支持", "❌", "✅ 原生支持"],
    ["x402 按使用付費", "❌", "✅ Solana USDC"],
    ["帶安全閘口的複製交易", "❌", "✅ 僅評分 ≥ 70"],
    ["Guardian 條件式自動化", "❌", "✅ 價格/APY/健康係數觸發"],
    ["Solana 原生深度整合", "部分", "✅ 完整整合"],
  ];
  const rows_ja = [
    ["スワップ前のリアルタイムセキュリティスキャン", "❌", "✅ GoPlus 5次元ゲート"],
    ["スマートマネー共識シグナル（24h）", "❌", "✅ 30以上のラベル付きウォレット"],
    ["オンチェーン検証可能なAI推論", "❌", "✅ SHA-256 + Solana Memo"],
    ["非カストディアル実行", "⚠️ 不統一", "✅ 常にPhantom経由"],
    ["自律リバランス（プロンプト不要）", "❌", "✅ SAK Agentループ"],
    ["GMGNリアルタイムKライン（アプリ内）", "❌", "✅ プロキシ + lightweight-charts"],
    ["pump.fun ボンディングカーブ対応", "❌", "✅ ネイティブ対応"],
    ["x402 使用量課金", "❌", "✅ Solana USDC"],
    ["安全ゲート付きコピートレード", "❌", "✅ スコア ≥ 70のみ"],
    ["Guardian条件付きオートメーション", "❌", "✅ 価格/APY/健康係数トリガー"],
    ["Solanaネイティブ深度統合", "部分的", "✅ 完全統合"],
  ];

  const rows = lang === "zh" ? rows_zh : lang === "ja" ? rows_ja : rows_en;
  const headers = lang === "zh"
    ? ["功能", "一般 DeFi 工具 / AI 聊天機器人", "Sakura AI"]
    : lang === "ja"
    ? ["機能", "一般的なDeFiツール / AIチャットボット", "Sakura AI"]
    : ["Capability", "Generic DeFi Tools / AI Chatbots", "Sakura AI"];

  return (
    <div style={{ overflowX: "auto", marginBottom: 40 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <thead>
          <tr>
            {headers.map((h, i) => (
              <th key={i} style={{
                padding: "10px 14px", textAlign: i === 0 ? "left" : "center",
                background: "var(--bg-card-2)", border: "1px solid var(--border)",
                color: i === 2 ? "var(--accent)" : "var(--text-primary)",
                fontWeight: 600, fontSize: 12, letterSpacing: "0.04em",
                textTransform: "uppercase",
              }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} style={{ background: ri % 2 === 0 ? "var(--bg-card)" : "var(--bg-base)" }}>
              {row.map((cell, ci) => (
                <td key={ci} style={{
                  padding: "10px 14px", border: "1px solid var(--border)",
                  textAlign: ci === 0 ? "left" : "center",
                  color: ci === 2 && cell.startsWith("✅") ? "var(--green)" : "var(--text-secondary)",
                  fontSize: 13,
                }}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StatPill({ value, label }: { value: string; label: string }) {
  return (
    <div style={{
      background: "var(--bg-card)", border: "1px solid var(--border)",
      borderRadius: 10, padding: "14px 20px", textAlign: "center", minWidth: 100,
    }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: "var(--gold)", fontFamily: "var(--font-mono)", marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: 11, color: "var(--text-muted)", letterSpacing: "0.04em" }}>{label}</div>
    </div>
  );
}

function FeatureBlock({
  id, icon, title, desc, bullets, badge,
}: {
  id?: string; icon: string; title: string; desc: string; bullets?: string[]; badge?: string;
}) {
  return (
    <div id={id} style={{
      scrollMarginTop: 80,
      background: "var(--bg-card)", border: "1px solid var(--border)",
      borderRadius: 12, padding: "24px 28px", marginBottom: 24,
      borderLeft: "3px solid var(--accent)",
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <span style={{ fontSize: 22 }}>{icon}</span>
        <span style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>{title}</span>
        {badge && (
          <span style={{
            fontSize: 10, padding: "2px 8px", borderRadius: 10,
            border: "1px solid var(--accent)", color: "var(--accent)",
            letterSpacing: "0.06em", textTransform: "uppercase",
          }}>{badge}</span>
        )}
      </div>
      <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.8, margin: "0 0 12px" }}>{desc}</p>
      {bullets && bullets.length > 0 && (
        <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 6 }}>
          {bullets.map((b, i) => (
            <li key={i} style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.6 }}>{b}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

function TechBlock({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div style={{
      background: "var(--bg-card)", border: "1px solid var(--border)",
      borderRadius: 10, padding: "20px 22px", marginBottom: 16,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 14 }}>
        <div style={{
          width: 36, height: 36, background: "var(--accent-soft)",
          borderRadius: 8, display: "flex", alignItems: "center",
          justifyContent: "center", fontSize: 18, flexShrink: 0,
        }}>{icon}</div>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>{title}</div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.7 }}>{desc}</div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Content ────────────────────────────────────────────────────────────

function DocsContent() {
  const { lang } = useLang();
  const [activeSection, setActiveSection] = useState("intro");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const S = lang === "zh" ? SIDEBAR_ZH : lang === "ja" ? SIDEBAR_JA : SIDEBAR_EN;

  useEffect(() => {
    const handleScroll = () => {
      for (const id of [...SECTIONS].reverse()) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= 120) {
          setActiveSection(id);
          break;
        }
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
    setMobileMenuOpen(false);
  };

  const sidebarLink = (id: string, label: string) => (
    <button
      key={id}
      onClick={() => scrollTo(id)}
      style={{
        display: "block", width: "100%", textAlign: "left",
        padding: "5px 10px", border: "none", borderRadius: 5,
        background: activeSection === id ? "var(--accent-soft)" : "transparent",
        color: activeSection === id ? "var(--accent)" : "var(--text-secondary)",
        fontSize: 13, cursor: "pointer",
        borderLeft: activeSection === id ? "2px solid var(--accent)" : "2px solid transparent",
        marginBottom: 2,
      }}
    >{label}</button>
  );

  const sidebarLabel = (label: string) => (
    <div style={{
      fontSize: 10, fontWeight: 700, color: "var(--text-muted)",
      letterSpacing: "0.1em", textTransform: "uppercase",
      padding: "14px 10px 6px", marginTop: 4,
    }}>{label}</div>
  );

  // ── Content by language ──────────────────────────────────────────────────

  const content = lang === "zh" ? {
    pageLabel: "使用手冊",
    pageTitle: "Sakura 使用手冊",
    pageDesc: "深入了解 Sakura 的每項功能、技術架構與安全理念——助您在 Solana DeFi 中安全、智慧地行動。",
    statsLabel: "平台指標",
    stats: [
      { v: "30+", l: "標籤錢包" },
      { v: "5", l: "GoPlus 安全維度" },
      { v: "11", l: "SAK 工具" },
      { v: "SHA-256", l: "AI 推理驗證" },
      { v: "3", l: "免費使用次數" },
    ],
    introTitle: "什麼是 Sakura？",
    introDesc: "Sakura 是一款專為 Solana 生態系打造的 AI 驅動 DeFi 顧問，由 Claude Sonnet 4.6 提供語言理解與推理能力，結合 GoPlus 安全分析、Helius 鏈上數據、GMGN 聰明錢信號，打造全方位、安全優先的 DeFi 工具。",
    introPara2: "與一般 AI 聊天機器人不同，Sakura 的每一個 AI 決策都會生成 SHA-256 雜湊值，透過 Solana Memo Program 永久記錄在區塊鏈上。您可以獨立驗證 AI 的完整推理過程——不是黑箱，而是透明可信的 AI。",
    diffLabel: "差異化比較",
    whyTitle: "為什麼打造 Sakura",
    whyDesc: "DeFi 充滿機會，但也伴隨著真實的風險：詐騙代幣隨時可能讓您損失一切，複雜的協議讓新手無從下手，而市面上的工具要麼不夠安全、要麼過於技術化。",
    whyPara2: "Sakura 的核心使命是：以安全為首要原則，讓每個人——無論是 DeFi 新手還是資深用戶——都能以智慧、安全的方式參與 Solana 生態。我們不做訂閱制 SaaS，而是真正的 Web3 原生工具：按用計費，非託管，鏈上可驗證。",
    whoTitle: "適合誰使用？",
    whoItems: [
      { icon: "👤", title: "DeFi 新手", desc: "想了解代幣安全性，避免踩坑詐騙。Sakura 讓您在交易前就知道代幣的風險等級。" },
      { icon: "📊", title: "資深 DeFi 用戶", desc: "需要機構級技術分析（MACD/RSI/BB/Fibonacci/Elliott Wave）和聰明錢信號的深度用戶。" },
      { icon: "🐋", title: "跟單交易者", desc: "希望跟隨 KOL、Whale、Cabal 等聰明錢地址，但又不想盲目跟單——Sakura 的安全閘口為您把關。" },
      { icon: "⚙️", title: "收益優化者", desc: "希望自動化地在 Marinade、Jito、Kamino 等協議間尋找最優收益分配的用戶。" },
    ],
    diffTitle: "差異化優勢",
    diffSub: "Sakura 與一般 DeFi 工具或 AI 聊天機器人的核心差異：",
    healthTitle: "持倉體檢",
    healthDesc: "全面分析您的 Solana 錢包，生成整體健康分數（0-100），並提供優化建議。",
    healthBullets: [
      "資產配置評分：識別過度集中的高風險代幣",
      "閒置 USDC 識別：發現未參與任何收益協議的閒置資金",
      "實時 APY 對比：比較 Marinade、Jito、Kamino、Drift 的當前利率",
      "歷史表現追蹤：記錄每次體檢的健康分數變化",
      "AI 建議：基於分析結果自動生成優化方案",
    ],
    securityTitle: "安全分析",
    securityDesc: "在您執行任何交易之前，Sakura 使用 GoPlus API 對代幣進行 5 維度安全掃描。這是 Sakura 最核心的護城河——也是其他 AI 工具所缺乏的能力。",
    securityBullets: [
      "增發權限（Mint Authority）：是否可被無限增發？",
      "凍結權限（Freeze Authority）：是否可被凍結您的資金？",
      "蜜罐風險（Honeypot Detection）：是否存在只能買不能賣的陷阱？",
      "持幣集中度：前 10 持有者是否佔比過高？",
      "流動性深度：交易滑點與池深度分析",
    ],
    advisorTitle: "AI 顧問",
    advisorDesc: "由 Claude Sonnet 4.6 驅動的 DeFi 專業顧問，支持多輪對話記憶，並能主動調用實時數據工具回答您的問題。",
    advisorBullets: [
      "多輪對話：記住對話歷史，提供前後連貫的建議",
      "實時數據調用：查詢代幣價格、APY、鏈上數據、聰明錢動向",
      "快速操作按鈕：持倉體檢、聰明錢追蹤、收益比較、安全掃描一鍵觸發",
      "自然語言執行：直接說「把 50 SOL 換成 USDC」即可觸發 Jupiter 報價",
      "三語支持：繁體中文、英文、日文無縫切換",
    ],
    agentTitle: "自主再平衡 Agent",
    agentDesc: "不需要您提任何問題——Agent 自動掃描您的錢包，制定最優收益分配方案，並提供 Before/After 年化收益對比。",
    agentBullets: [
      "自主掃描：無需提示，自動識別可優化的持倉",
      "量化方案：計算切換到最優協議後的年化增益（以 USDC 計）",
      "Before/After 對比：清楚展示調整前後的預期年化收益差異",
      "一鍵執行：透過 Jupiter/Marinade/Kamino 直接執行再平衡",
      "SHA-256 驗證：每次 Agent 決策都上鏈存證，可獨立審計",
    ],
    smartTitle: "聰明錢追蹤",
    smartDesc: "追蹤 30+ 個有標籤的 Solana 知名地址（KOL、Whale、Cabal、Smart_Money）的 24h 鏈上行為，偵測多個地址同時買入同一代幣的「共識信號」。",
    smartBullets: [
      "30+ 標籤地址庫：涵蓋 KOL、Whale、Cabal、Smart_Money 四類",
      "24h 共識偵測：多個聰明錢地址同時買入 = 強烈買入信號",
      "評分系統：Cabal +2、Whale +2、KOL +1.5，轉換為 1-5 星評級",
      "Twitter 關聯：顯示關聯的 Twitter 帳號（@handle）",
      "安全聯動：共識代幣自動觸發 GoPlus 安全評分",
    ],
    guardianTitle: "Guardian 自動監控",
    guardianDesc: "設定自訂條件，當市場觸發特定事件時，Guardian 自動執行您預設的動作——無需盯盤。",
    guardianBullets: [
      "價格警報：SOL 跌破 $X 時通知，或自動執行對衝交易",
      "APY 變化：當 Kamino USDC APY 低於閾值時自動再平衡",
      "健康係數：Drift 借貸倉位健康係數過低時自動警報",
      "自動交易：條件觸發時直接調用 Jupiter 執行 Swap",
      "持久化存儲：Agent 配置儲存在 localStorage，頁面刷新後仍然有效",
    ],
    gmgnTitle: "GMGN 實時 K 線",
    gmgnDesc: "應用內嵌入真實的 GMGN K 線圖表，支持多個時間框架，無需跳轉外部網站。",
    gmgnBullets: [
      "5m / 15m / 1h / 4h / 1d 多時間框架切換",
      "基於 lightweight-charts（TradingView 開源庫）的本地渲染",
      "服務端代理：繞過 CSP/CORS 限制，直接顯示 GMGN 數據",
      "自動填充：選擇代幣後圖表即時更新",
      "備用外鏈：數據不可用時顯示 DexScreener/GMGN 外部連結",
    ],
    copyTitle: "複製交易",
    copyDesc: "複製聰明錢地址的交易策略，但 Sakura 在執行前必須通過安全閘口——這是業界獨有的安全保障。",
    copyBullets: [
      "安全閘口：GoPlus 評分 ≥ 70 才允許複製，自動拒絕惡意代幣",
      "智能倉位：根據您的持倉比例自動計算跟單金額",
      "一鍵確認：確認模態框清晰展示費用、滑點、安全評分",
      "非託管：所有交易均由您的 Phantom 錢包簽署",
    ],
    goplusTitle: "GoPlus 整合",
    goplusDesc: "Sakura 深度整合 GoPlus Security API v2，對每個代幣執行 5 維度安全評估，生成 0-100 安全分數，並提供 AI 解讀與倉位建議。GoPlus 是目前最全面的 Web3 安全 API 提供商，覆蓋超過 30 條鏈。",
    heliusTitle: "Helius 鏈上數據",
    heliusDesc: "Helius 是 Solana 最快的 RPC 與增強型交易 API 提供商。Sakura 使用 Helius 獲取實時代幣持倉、增強型交易解析（SWAP 類型識別）、以及標籤錢包的鏈上行為分析。",
    claudeTitle: "Claude AI 引擎",
    claudeDesc: "Sakura 使用 Anthropic 的 Claude Sonnet 4.6 作為核心 AI 推理引擎，結合 Solana Agent Kit（SAK）的 11 個工具，實現真正的 AI 主導 DeFi 決策。每個 AI 輸出都會生成 SHA-256 雜湊值，透過 Solana Memo Program 永久記錄在鏈上，保證 AI 決策的可審計性。",
    ncTitle: "非託管架構",
    ncDesc: "Sakura 的設計原則是零信任、非託管。我們永遠不保管您的私鑰、助記詞或任何資產。所有的鏈上交易（Swap、質押、借貸）都由您的 Phantom 錢包自行簽署，Sakura 只生成交易指令，從不代您執行。",
    x402Title: "x402 微支付",
    x402Desc: "Sakura 採用 HTTP 402 x402 標準微支付協議，讓您按使用付費，無需訂閱。每項功能有 3 次免費使用配額，超出後需支付少量 USDC（$0.05-$0.10）。支付透過 Phantom 在 Solana 上完成，全程非託管。",
    startTitle: "如何開始",
    startSteps: [
      { n: "1", t: "安裝 Phantom 錢包", d: "前往 phantom.app 安裝瀏覽器擴展，創建或導入您的 Solana 錢包。" },
      { n: "2", t: "連接到 Sakura", d: "點擊首頁的「連接 Phantom」按鈕，授權只讀訪問（無需任何資產授權）。" },
      { n: "3", t: "執行持倉體檢", d: "在「持倉體檢」頁籤中，系統自動分析您的錢包並生成健康分數與建議。" },
      { n: "4", t: "分析代幣安全性", d: "在「安全分析」中輸入代幣名稱或合約地址，獲取即時 GoPlus 安全報告。" },
      { n: "5", t: "諮詢 AI 顧問", d: "在「AI 顧問」中用自然語言提問，或點擊快速操作按鈕獲取即時分析。" },
      { n: "6", t: "運行再平衡 Agent", d: "點擊「自主 Agent」，等待 Agent 自動掃描並給出優化方案，確認後一鍵執行。" },
    ],
  } : lang === "ja" ? {
    pageLabel: "ドキュメント",
    pageTitle: "Sakura ドキュメント",
    pageDesc: "Sakuraのすべての機能、技術アーキテクチャ、セキュリティ思想を深く理解するための完全ガイドです。",
    statsLabel: "プラットフォーム指標",
    stats: [
      { v: "30+", l: "ラベル付きウォレット" },
      { v: "5", l: "GoPlusセキュリティ次元" },
      { v: "11", l: "SAKツール" },
      { v: "SHA-256", l: "AI推論検証" },
      { v: "3", l: "無料使用回数" },
    ],
    introTitle: "Sakuraとは？",
    introDesc: "SakuraはSolanaエコシステム向けに特化したAI駆動のDeFiアドバイザーです。Claude Sonnet 4.6による言語理解と推論、GoPlus セキュリティ分析、Heliusオンチェーンデータ、GMGNスマートマネーシグナルを組み合わせた、包括的かつセキュリティファーストのDeFiツールです。",
    introPara2: "一般的なAIチャットボットとは異なり、SakuraのすべてのAI判断はSHA-256ハッシュを生成し、Solana Memo Programを通じてブロックチェーンに永久記録されます。AIの完全な推論プロセスを独立して検証できます——ブラックボックスではなく、透明で信頼できるAIです。",
    diffLabel: "機能比較",
    whyTitle: "なぜSakuraを作ったのか",
    whyDesc: "DeFiは機会に満ちていますが、本物のリスクも伴います：詐欺トークンが一瞬で資金を奪い、複雑なプロトコルが初心者を混乱させ、既存のツールはセキュリティが不十分か、技術的すぎます。",
    whyPara2: "Sakuraのコアミッションはセキュリティを最優先にし、DeFi初心者からベテランまで、誰もがSolana DeFiを賢く安全に活用できるツールを提供することです。サブスクリプション型SaaSではなく、真のWeb3ネイティブツール：使った分だけ支払い、非カストディアル、オンチェーン検証可能。",
    whoTitle: "誰のためのツールか",
    whoItems: [
      { icon: "👤", title: "DeFi初心者", desc: "トークンの安全性を確認し、詐欺を避けたい方。取引前にリスクレベルを把握できます。" },
      { icon: "📊", title: "ベテランDeFiユーザー", desc: "機関レベルのテクニカル分析（MACD/RSI/BB/Fibonacci/Elliott Wave）とスマートマネーシグナルが必要な方。" },
      { icon: "🐋", title: "コピートレーダー", desc: "KOL、Whale、Cabalなどのスマートマネーをフォローしたいが、盲目的にフォローしたくない方——Sakuraの安全ゲートが守ります。" },
      { icon: "⚙️", title: "利回り最適化者", desc: "Marinade、Jito、Kaminoなどのプロトコル間で最適な利回り配分を自動化したい方。" },
    ],
    diffTitle: "差別化ポイント",
    diffSub: "Sakuraと一般的なDeFiツールまたはAIチャットボットとの主な違い：",
    healthTitle: "ポートフォリオ診断",
    healthDesc: "Solanaウォレットを包括的に分析し、全体的な健康スコア（0-100）と最適化提案を生成します。",
    healthBullets: [
      "資産配分スコア：過度に集中した高リスクトークンを特定",
      "遊休USDC検出：収益プロトコルに参加していない資金を発見",
      "リアルタイムAPY比較：Marinade、Jito、Kamino、Driftの現在のレートを比較",
      "履歴追跡：各診断の健康スコアの変化を記録",
      "AI提案：分析結果に基づいて最適化プランを自動生成",
    ],
    securityTitle: "セキュリティ分析",
    securityDesc: "取引を実行する前に、SakuraはGoPlus APIを使用してトークンに5次元のセキュリティスキャンを実行します。これはSakuraの最も重要な差別化要因であり、他のAIツールにはない能力です。",
    securityBullets: [
      "発行権限（Mint Authority）：無制限に増発できるか？",
      "凍結権限（Freeze Authority）：資金を凍結できるか？",
      "ハニーポットリスク：購入のみで売却できない罠はあるか？",
      "保有集中度：上位10保有者の割合は高すぎないか？",
      "流動性深度：取引スリッページとプール深度の分析",
    ],
    advisorTitle: "AIアドバイザー",
    advisorDesc: "Claude Sonnet 4.6搭載のDeFi専門アドバイザー。複数ターンの会話記憶をサポートし、リアルタイムデータツールを積極的に呼び出して質問に答えます。",
    advisorBullets: [
      "複数ターン会話：会話履歴を記憶し、一貫したアドバイスを提供",
      "リアルタイムデータ：トークン価格、APY、オンチェーンデータ、スマートマネーの動向を照会",
      "クイックアクションボタン：ポートフォリオ診断、スマートマネー追跡、利回り比較、セキュリティスキャンをワンクリック",
      "自然言語実行：「50 SOLをUSDCに換える」と言うだけでJupiter見積もりを起動",
      "三言語対応：繁体字中国語、英語、日本語をシームレスに切り替え",
    ],
    agentTitle: "自律リバランスエージェント",
    agentDesc: "質問する必要はありません——エージェントが自動的にウォレットをスキャンし、最適な利回り配分計画を作成し、Before/Afterの年間利回り比較を提供します。",
    agentBullets: [
      "自律スキャン：プロンプト不要で最適化可能なポジションを自動識別",
      "定量化計画：最適プロトコルへの切り替え後の年間増益を計算（USDC建て）",
      "Before/After比較：調整前後の予想年間利回りの差を明確に表示",
      "ワンクリック実行：Jupiter/Marinade/Kaminoを通じて直接リバランスを実行",
      "SHA-256検証：各エージェント判断をオンチェーンに記録し、独立した監査が可能",
    ],
    smartTitle: "スマートマネー追跡",
    smartDesc: "30以上のラベル付きSolana著名アドレス（KOL、Whale、Cabal、Smart_Money）の24hオンチェーン行動を追跡し、複数アドレスが同じトークンを同時に購入する「コンセンサスシグナル」を検出します。",
    smartBullets: [
      "30以上のラベル付きアドレス：KOL、Whale、Cabal、Smart_Moneyの4カテゴリ",
      "24hコンセンサス検出：複数のスマートマネーが同時購入 = 強い買いシグナル",
      "スコアリングシステム：Cabal +2、Whale +2、KOL +1.5、1-5星評価に変換",
      "Twitter連携：関連するTwitterアカウント（@ハンドル）を表示",
      "セキュリティ連動：コンセンサストークンが自動的にGoPlus安全スコアをトリガー",
    ],
    guardianTitle: "Guardian自動監視",
    guardianDesc: "カスタム条件を設定し、市場が特定のイベントをトリガーした際、Guardianが事前設定したアクションを自動実行します——常にチャートを見る必要はありません。",
    guardianBullets: [
      "価格アラート：SOLが$Xを下回ったときに通知、または自動ヘッジ取引を実行",
      "APY変化：Kamino USDC APYが閾値を下回ったときに自動リバランス",
      "健康係数：Driftレンディングポジションの健康係数が低すぎる場合に自動アラート",
      "自動取引：条件トリガー時にJupiterを直接呼び出してスワップを実行",
      "永続ストレージ：エージェント設定はlocalStorageに保存され、ページ更新後も有効",
    ],
    gmgnTitle: "GMGNリアルタイムKラインチャート",
    gmgnDesc: "アプリ内に本物のGMGN Kラインチャートを埋め込み、複数の時間軸をサポート。外部サイトに移動する必要はありません。",
    gmgnBullets: [
      "5m / 15m / 1h / 4h / 1d 複数時間軸の切り替え",
      "lightweight-charts（TradingViewオープンソース）によるローカルレンダリング",
      "サーバーサイドプロキシ：CSP/CORS制限を回避し、GaMGNデータを直接表示",
      "自動更新：トークン選択後にチャートが即座に更新",
      "バックアップ外部リンク：データが利用できない場合はDexScreener/GMGNの外部リンクを表示",
    ],
    copyTitle: "コピートレード",
    copyDesc: "スマートマネーアドレスのトレード戦略をコピーしますが、Sakuraは実行前に安全ゲートを通過する必要があります——業界独自のセキュリティ保証です。",
    copyBullets: [
      "安全ゲート：GoPlus スコア ≥ 70のみコピーを許可、悪意のあるトークンを自動拒否",
      "スマートポジション：保有比率に基づいてフォロー金額を自動計算",
      "ワンクリック確認：確認モーダルに手数料、スリッページ、安全スコアを明確に表示",
      "非カストディアル：すべての取引はPhantomウォレットで署名",
    ],
    goplusTitle: "GoPlus統合",
    goplusDesc: "SakuraはGoPlus Security API v2を深く統合し、各トークンに5次元のセキュリティ評価を実行し、0-100の安全スコアを生成し、AIによる解釈とポジションの推奨を提供します。GoPlus は現在最も包括的なWeb3セキュリティAPIプロバイダーで、30以上のチェーンをカバーしています。",
    heliusTitle: "Heliusオンチェーンデータ",
    heliusDesc: "HeliusはSolanaで最も高速なRPCと拡張トランザクションAPIプロバイダーです。Sakuraはリアルタイムのトークン保有、拡張トランザクション解析（SWAPタイプの識別）、ラベル付きウォレットのオンチェーン行動分析にHeliusを使用します。",
    claudeTitle: "Claude AIエンジン",
    claudeDesc: "SakuraはAnthropicのClaude Sonnet 4.6をコアAI推論エンジンとして使用し、Solana Agent Kit（SAK）の11のツールと組み合わせて、真のAI主導のDeFi意思決定を実現します。各AI出力はSHA-256ハッシュを生成し、Solana Memo Programを通じてオンチェーンに永久記録され、AI判断の監査可能性を保証します。",
    ncTitle: "非カストディアル設計",
    ncDesc: "Sakuraの設計原則はゼロトラスト、非カストディアルです。秘密鍵、シードフレーズ、または資産を一切保管しません。すべてのオンチェーントランザクション（スワップ、ステーキング、レンディング）はPhantomウォレットで自己署名され、Sakuraはトランザクション命令を生成するだけで、代わりに実行することは決してありません。",
    x402Title: "x402マイクロペイメント",
    x402Desc: "SakuraはHTTP 402 x402標準マイクロペイメントプロトコルを採用し、サブスクリプション不要で使った分だけ支払えます。各機能には3回の無料使用クォータがあり、超過後は少量のUSDC（$0.05-$0.10）が必要です。支払いはPhantom経由でSolana上で完了し、完全に非カストディアルです。",
    startTitle: "はじめ方",
    startSteps: [
      { n: "1", t: "Phantomウォレットをインストール", d: "phantom.appにアクセスしてブラウザ拡張機能をインストールし、Solanaウォレットを作成またはインポートします。" },
      { n: "2", t: "Sakuraに接続", d: "ホームページの「Phantomを接続」ボタンをクリックし、読み取り専用アクセスを承認します（資産承認は不要）。" },
      { n: "3", t: "ポートフォリオ診断を実行", d: "「ポートフォリオ診断」タブで、システムが自動的にウォレットを分析し、健康スコアと推奨事項を生成します。" },
      { n: "4", t: "トークンのセキュリティを分析", d: "「セキュリティ分析」でトークン名またはコントラクトアドレスを入力し、リアルタイムのGoPlus セキュリティレポートを取得します。" },
      { n: "5", t: "AIアドバイザーに相談", d: "「AIアドバイザー」で自然言語で質問するか、クイックアクションボタンをクリックしてリアルタイム分析を取得します。" },
      { n: "6", t: "リバランスエージェントを実行", d: "「自律エージェント」をクリックし、エージェントが自動スキャンして最適化計画を提示するのを待ち、確認後ワンクリックで実行します。" },
    ],
  } : {
    pageLabel: "Documentation",
    pageTitle: "Sakura Documentation",
    pageDesc: "Your complete guide to understanding every feature, technical architecture, and security philosophy behind Sakura — your AI-powered DeFi advisor for Solana.",
    statsLabel: "Platform At a Glance",
    stats: [
      { v: "30+", l: "Labeled Wallets" },
      { v: "5", l: "GoPlus Security Dims" },
      { v: "11", l: "SAK Tools" },
      { v: "SHA-256", l: "AI Reasoning Verified" },
      { v: "3", l: "Free Uses/Feature" },
    ],
    introTitle: "What is Sakura?",
    introDesc: "Sakura is an AI-powered DeFi advisor built specifically for the Solana ecosystem. It combines Claude Sonnet 4.6 for language understanding and reasoning with GoPlus security analysis, Helius on-chain data, and GMGN smart money signals — creating a comprehensive, security-first DeFi tool.",
    introPara2: "Unlike generic AI chatbots, every AI decision Sakura makes generates a SHA-256 hash recorded permanently on-chain via Solana Memo Program. You can independently verify the AI's complete reasoning process — not a black box, but transparent, trustworthy AI.",
    diffLabel: "Capability Comparison",
    whyTitle: "Why We Built Sakura",
    whyDesc: "DeFi is full of opportunity — but also real risks. Scam tokens can drain a wallet in seconds. Complex protocols leave new users lost. Existing tools are either dangerously insecure or far too technical for most people.",
    whyPara2: "Sakura's core mission is to put security first and give everyone — from DeFi newcomers to seasoned traders — the tools to navigate Solana DeFi wisely and safely. We're not building a subscription SaaS. We're building a true Web3-native tool: pay per use, non-custodial, onchain-verifiable.",
    whoTitle: "Who Is Sakura For?",
    whoItems: [
      { icon: "👤", title: "DeFi Newcomers", desc: "Want to understand token safety before buying? Sakura surfaces the risk level of any token before you execute a trade." },
      { icon: "📊", title: "Experienced DeFi Users", desc: "Need institutional-grade technical analysis (MACD/RSI/BB/Fibonacci/Elliott Wave) with real-time smart money signals." },
      { icon: "🐋", title: "Copy Traders", desc: "Want to follow KOL, Whale, and Cabal wallets — but not blindly. Sakura's security gate protects you before any copy trade executes." },
      { icon: "⚙️", title: "Yield Optimizers", desc: "Want to automatically find and execute the best yield allocation across Marinade, Jito, Kamino, and Drift." },
    ],
    diffTitle: "What Makes Sakura Different",
    diffSub: "A direct comparison between Sakura and generic DeFi tools or AI chatbots:",
    healthTitle: "Portfolio Health Check",
    healthDesc: "A comprehensive analysis of your entire Solana wallet, generating an overall health score (0–100) along with actionable optimization recommendations.",
    healthBullets: [
      "Asset allocation scoring: identifies overly concentrated high-risk token positions",
      "Idle USDC detection: surfaces uninvested funds not participating in any yield protocol",
      "Live APY comparison: benchmarks Marinade, Jito, Kamino, and Drift side by side",
      "Historical tracking: records health score changes across successive check-ups",
      "AI recommendations: automatically generates an optimization plan based on findings",
    ],
    securityTitle: "Security Analysis",
    securityDesc: "Before you execute any trade, Sakura runs a 5-dimension security scan on the token using GoPlus API. This is Sakura's most critical moat — a capability that generic AI tools simply don't have.",
    securityBullets: [
      "Mint Authority: can the supply be inflated without limit?",
      "Freeze Authority: can the issuer freeze your tokens at will?",
      "Honeypot Detection: is there a buy-only trap that prevents selling?",
      "Holder Concentration: do the top 10 holders own a dangerous majority?",
      "Liquidity Depth: trade slippage and pool depth analysis",
    ],
    advisorTitle: "AI Advisor",
    advisorDesc: "A DeFi-specialized AI powered by Claude Sonnet 4.6, with multi-turn conversation memory and the ability to proactively call real-time data tools to answer your questions.",
    advisorBullets: [
      "Multi-turn memory: retains conversation history for coherent, contextual advice",
      "Live data calls: queries token prices, APY, on-chain data, and smart money movements",
      "Quick action buttons: one-click triggers for health check, smart money, yield comparison, and security scan",
      "Natural language execution: say \"swap 50 SOL to USDC\" to trigger a Jupiter quote",
      "Trilingual support: Traditional Chinese, English, and Japanese — seamless switching",
    ],
    agentTitle: "Autonomous Rebalance Agent",
    agentDesc: "No prompting required — the Agent automatically scans your wallet, formulates an optimal yield allocation plan, and provides a quantified Before/After annual yield comparison.",
    agentBullets: [
      "Autonomous scan: identifies optimizable positions without any user prompt",
      "Quantified plan: calculates the annual yield gain (in USDC) from switching to optimal protocols",
      "Before/After comparison: clearly shows the delta in expected annual yield pre- and post-rebalance",
      "One-click execution: executes the rebalance directly via Jupiter / Marinade / Kamino",
      "SHA-256 verification: every Agent decision is recorded on-chain for independent audit",
    ],
    smartTitle: "Smart Money Tracker",
    smartDesc: "Tracks 30+ labeled Solana addresses (KOL, Whale, Cabal, Smart_Money) for 24h on-chain activity and detects \"consensus signals\" where multiple wallets buy the same token simultaneously.",
    smartBullets: [
      "30+ labeled address library: covers KOL, Whale, Cabal, and Smart_Money categories",
      "24h consensus detection: multiple smart money addresses buying simultaneously = strong signal",
      "Scoring system: Cabal +2, Whale +2, KOL +1.5 — converted to 1–5 star ratings",
      "Twitter linkage: displays associated Twitter handles (@handle) for each wallet",
      "Security integration: consensus tokens automatically trigger GoPlus safety score check",
    ],
    guardianTitle: "Guardian Auto-Monitor",
    guardianDesc: "Set custom conditions. When the market triggers a specified event, Guardian automatically executes your preset action — no manual monitoring required.",
    guardianBullets: [
      "Price alerts: notify when SOL drops below $X, or auto-execute a hedge trade",
      "APY changes: auto-rebalance when Kamino USDC APY falls below a threshold",
      "Health factor: auto-alert when Drift lending position health drops dangerously low",
      "Automated trades: call Jupiter directly when conditions trigger a Swap",
      "Persistent storage: Agent configs stored in localStorage — survive page refreshes",
    ],
    gmgnTitle: "GMGN Live K-Line Chart",
    gmgnDesc: "Real GMGN K-line charts embedded directly in the app, supporting multiple timeframes — no need to navigate to an external site.",
    gmgnBullets: [
      "5m / 15m / 1h / 4h / 1d multi-timeframe switching",
      "Local rendering powered by lightweight-charts (TradingView open-source)",
      "Server-side proxy: bypasses CSP/CORS limitations, renders GMGN data directly",
      "Auto-refresh: chart updates instantly upon token selection",
      "Fallback external links: shows DexScreener/GMGN links if data is unavailable",
    ],
    copyTitle: "Copy Trade",
    copyDesc: "Copy the trading strategies of smart money addresses — but Sakura requires every copy trade to pass through a security gate before execution. An industry-first safety guarantee.",
    copyBullets: [
      "Security gate: GoPlus score ≥ 70 required; malicious tokens are automatically rejected",
      "Smart sizing: auto-calculates copy amount based on your portfolio proportion",
      "One-click confirmation: modal clearly shows fee, slippage, and safety score",
      "Non-custodial: all trades signed by your Phantom wallet",
    ],
    goplusTitle: "GoPlus Integration",
    goplusDesc: "Sakura deeply integrates GoPlus Security API v2, running 5-dimension security assessments on every token, generating a 0–100 safety score with AI interpretation and position sizing recommendations. GoPlus is the most comprehensive Web3 security API provider, covering 30+ chains.",
    heliusTitle: "Helius On-Chain Data",
    heliusDesc: "Helius is Solana's fastest RPC and enhanced transaction API provider. Sakura uses Helius to retrieve real-time token holdings, enhanced transaction parsing (SWAP type identification), and on-chain behavior analysis for labeled wallets.",
    claudeTitle: "Claude AI Engine",
    claudeDesc: "Sakura uses Anthropic's Claude Sonnet 4.6 as its core AI reasoning engine, paired with 11 Solana Agent Kit (SAK) tools for genuinely AI-led DeFi decision-making. Every AI output generates a SHA-256 hash recorded on-chain via Solana Memo Program, guaranteeing the auditability of every AI decision.",
    ncTitle: "Non-Custodial Architecture",
    ncDesc: "Sakura's design principle is zero-trust, non-custodial. We never hold your private keys, seed phrases, or any assets. All on-chain transactions (Swap, staking, lending) are self-signed by your Phantom wallet. Sakura only generates transaction instructions — it never executes on your behalf.",
    x402Title: "x402 Micropayments",
    x402Desc: "Sakura adopts the HTTP 402 x402 standard micropayment protocol, enabling pay-per-use without subscriptions. Each feature comes with 3 free-use quota. Beyond that, a small USDC amount ($0.05–$0.10) is required. Payment is completed via Phantom on Solana — fully non-custodial.",
    startTitle: "Getting Started",
    startSteps: [
      { n: "1", t: "Install Phantom Wallet", d: "Visit phantom.app to install the browser extension. Create or import your Solana wallet." },
      { n: "2", t: "Connect to Sakura", d: "Click \"Connect Phantom\" on the homepage. Authorize read-only access — no asset permissions required." },
      { n: "3", t: "Run Portfolio Health Check", d: "In the Portfolio Health tab, the system automatically analyzes your wallet and generates a health score with recommendations." },
      { n: "4", t: "Analyze Token Security", d: "In Security Analysis, enter a token name or contract address to get an instant GoPlus security report." },
      { n: "5", t: "Consult the AI Advisor", d: "Ask questions in natural language in the AI Advisor tab, or click quick action buttons for instant analysis." },
      { n: "6", t: "Run Rebalance Agent", d: "Click Autonomous Agent and wait for the Agent to auto-scan and present an optimization plan. Confirm to execute with one click." },
    ],
  };

  return (
    <ThemeWrapper>
      {/* ── Nav ── */}
      <nav style={{
        position: "sticky", top: 0, zIndex: 100,
        borderBottom: "1px solid var(--border)", background: "var(--bg-card)",
        padding: "13px 32px", display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
            <div style={{
              width: 26, height: 26, background: "var(--accent)",
              borderRadius: 6, display: "flex", alignItems: "center",
              justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#fff",
            }}>S</div>
            <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-heading)" }}>Sakura</span>
          </Link>
          <div style={{ height: 16, width: 1, background: "var(--border)" }} />
          <span style={{ fontSize: 12, color: "var(--text-muted)", letterSpacing: "0.06em" }}>
            {content.pageLabel}
          </span>
        </div>
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <Link href="/use-cases" style={{ fontSize: 13, color: "var(--text-secondary)", textDecoration: "none" }}>
            {lang === "ja" ? "使用事例" : lang === "zh" ? "使用案例" : "Use Cases"}
          </Link>
          <Link href="/pricing" style={{ fontSize: 13, color: "var(--text-secondary)", textDecoration: "none" }}>
            {lang === "ja" ? "料金" : lang === "zh" ? "定價" : "Pricing"}
          </Link>
          <Link href="/" style={{
            fontSize: 12, padding: "6px 16px", borderRadius: 7,
            background: "var(--accent)", color: "#fff", textDecoration: "none", fontWeight: 600,
          }}>
            {lang === "ja" ? "アプリへ" : lang === "zh" ? "啟動應用" : "Launch App"}
          </Link>
        </div>
      </nav>

      {/* ── 3-column layout ── */}
      <div style={{ display: "flex", maxWidth: 1280, margin: "0 auto", minHeight: "calc(100vh - 56px)" }}>

        {/* ── Left Sidebar ── */}
        <aside style={{
          width: 220, flexShrink: 0,
          borderRight: "1px solid var(--border)",
          padding: "28px 16px",
          position: "sticky", top: 56, height: "calc(100vh - 56px)",
          overflowY: "auto",
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.1em", textTransform: "uppercase", padding: "0 10px 10px" }}>
            {S.handbook}
          </div>
          {sidebarLink("intro", S.intro)}
          {sidebarLink("why", S.why)}
          {sidebarLink("who", S.who)}
          {sidebarLink("diff", S.diff)}

          {sidebarLabel(S.featuresLabel)}
          {sidebarLink("health", S.health)}
          {sidebarLink("security", S.security)}
          {sidebarLink("advisor", S.advisor)}
          {sidebarLink("agent", S.agent)}
          {sidebarLink("smartmoney", S.smartmoney)}
          {sidebarLink("guardian", S.guardian)}
          {sidebarLink("gmgn", S.gmgn)}
          {sidebarLink("copytrade", S.copytrade)}

          {sidebarLabel(S.techLabel)}
          {sidebarLink("goplus", S.goplus)}
          {sidebarLink("helius", S.helius)}
          {sidebarLink("claude", S.claude)}
          {sidebarLink("noncustodial", S.noncustodial)}
          {sidebarLink("x402", S.x402)}

          {sidebarLabel("")}
          {sidebarLink("start", S.start)}
        </aside>

        {/* ── Main Content ── */}
        <main style={{ flex: 1, padding: "40px 48px", maxWidth: 760, overflowY: "auto" }}>

          {/* Hero */}
          <div style={{ marginBottom: 48 }}>
            <div style={{
              display: "inline-block", fontSize: 10, padding: "3px 10px",
              borderRadius: 20, border: "1px solid var(--border)",
              color: "var(--text-muted)", marginBottom: 16,
              letterSpacing: "0.08em", textTransform: "uppercase",
            }}>{content.pageLabel}</div>
            <h1 style={{
              fontSize: 36, fontWeight: 300, lineHeight: 1.2,
              fontFamily: "var(--font-heading)", color: "var(--text-primary)",
              margin: "0 0 14px", letterSpacing: "0.02em",
            }}>{content.pageTitle}</h1>
            <p style={{ fontSize: 15, color: "var(--text-secondary)", lineHeight: 1.8, margin: "0 0 32px" }}>
              {content.pageDesc}
            </p>

            {/* Stats row */}
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 12, letterSpacing: "0.06em", textTransform: "uppercase" }}>
              {content.statsLabel}
            </div>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {content.stats.map((s) => <StatPill key={s.l} value={s.v} label={s.l} />)}
            </div>
          </div>

          {/* ── INTRO ── */}
          <SectionHeading id="intro" label={content.introTitle} />
          <p style={{ fontSize: 15, color: "var(--text-secondary)", lineHeight: 1.9, marginBottom: 16 }}>{content.introDesc}</p>
          <p style={{ fontSize: 15, color: "var(--text-secondary)", lineHeight: 1.9, marginBottom: 48 }}>{content.introPara2}</p>

          {/* ── WHY ── */}
          <SectionHeading id="why" label={content.whyTitle} />
          <p style={{ fontSize: 15, color: "var(--text-secondary)", lineHeight: 1.9, marginBottom: 16 }}>{content.whyDesc}</p>
          <p style={{ fontSize: 15, color: "var(--text-secondary)", lineHeight: 1.9, marginBottom: 48 }}>{content.whyPara2}</p>

          {/* ── WHO ── */}
          <SectionHeading id="who" label={content.whoTitle} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 48 }}>
            {content.whoItems.map((item) => (
              <div key={item.title} style={{
                background: "var(--bg-card)", border: "1px solid var(--border)",
                borderRadius: 10, padding: "18px 20px",
              }}>
                <div style={{ fontSize: 20, marginBottom: 8 }}>{item.icon}</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>{item.title}</div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.7 }}>{item.desc}</div>
              </div>
            ))}
          </div>

          {/* ── DIFF / comparison ── */}
          <SectionHeading id="diff" label={content.diffTitle} sub={content.diffSub} />
          <ComparisonTable lang={lang} />
          <div style={{ marginBottom: 48 }} />

          {/* ── FEATURES ── */}
          <div style={{ height: 1, background: "var(--border)", marginBottom: 32 }} />
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 20 }}>
            {S.featuresLabel}
          </div>

          <FeatureBlock id="health" icon="🌸" title={content.healthTitle} desc={content.healthDesc} bullets={content.healthBullets} />
          <FeatureBlock id="security" icon="🛡️" title={content.securityTitle} desc={content.securityDesc} bullets={content.securityBullets} badge={lang === "zh" ? "核心護城河" : lang === "ja" ? "コアモート" : "Core Moat"} />
          <FeatureBlock id="advisor" icon="🌿" title={content.advisorTitle} desc={content.advisorDesc} bullets={content.advisorBullets} />
          <FeatureBlock id="agent" icon="⚙️" title={content.agentTitle} desc={content.agentDesc} bullets={content.agentBullets} />
          <FeatureBlock id="smartmoney" icon="🐋" title={content.smartTitle} desc={content.smartDesc} bullets={content.smartBullets} />
          <FeatureBlock id="guardian" icon="🔔" title={content.guardianTitle} desc={content.guardianDesc} bullets={content.guardianBullets} />
          <FeatureBlock id="gmgn" icon="📈" title={content.gmgnTitle} desc={content.gmgnDesc} bullets={content.gmgnBullets} />
          <FeatureBlock id="copytrade" icon="🔁" title={content.copyTitle} desc={content.copyDesc} bullets={content.copyBullets} />

          {/* ── TECHNOLOGY ── */}
          <div style={{ height: 1, background: "var(--border)", margin: "32px 0 32px" }} />
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 20 }}>
            {S.techLabel}
          </div>

          <div id="goplus" style={{ scrollMarginTop: 80 }}>
            <TechBlock icon="🔰" title={content.goplusTitle} desc={content.goplusDesc} />
          </div>
          <div id="helius" style={{ scrollMarginTop: 80 }}>
            <TechBlock icon="⚡" title={content.heliusTitle} desc={content.heliusDesc} />
          </div>
          <div id="claude" style={{ scrollMarginTop: 80 }}>
            <TechBlock icon="🧠" title={content.claudeTitle} desc={content.claudeDesc} />
          </div>
          <div id="noncustodial" style={{ scrollMarginTop: 80 }}>
            <TechBlock icon="🔑" title={content.ncTitle} desc={content.ncDesc} />
          </div>
          <div id="x402" style={{ scrollMarginTop: 80, marginBottom: 48 }}>
            <TechBlock icon="💳" title={content.x402Title} desc={content.x402Desc} />
          </div>

          {/* ── GETTING STARTED ── */}
          <SectionHeading id="start" label={content.startTitle} />
          <div style={{ display: "flex", flexDirection: "column", gap: 16, marginBottom: 64 }}>
            {content.startSteps.map((step) => (
              <div key={step.n} style={{
                display: "flex", gap: 16, alignItems: "flex-start",
                background: "var(--bg-card)", border: "1px solid var(--border)",
                borderRadius: 10, padding: "16px 20px",
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: "50%",
                  background: "var(--accent)", color: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 700, flexShrink: 0,
                }}>{step.n}</div>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>{step.t}</div>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.7 }}>{step.d}</div>
                </div>
              </div>
            ))}
          </div>

        </main>

        {/* ── Right Anchor Nav ── */}
        <aside style={{
          width: 180, flexShrink: 0,
          padding: "40px 20px",
          position: "sticky", top: 56, height: "calc(100vh - 56px)",
          overflowY: "auto",
          display: "flex", flexDirection: "column",
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>
            {lang === "zh" ? "本頁目錄" : lang === "ja" ? "このページ" : "On This Page"}
          </div>
          {[
            { id: "intro", label: lang === "zh" ? "簡介" : lang === "ja" ? "はじめに" : "Introduction" },
            { id: "why", label: lang === "zh" ? "為何打造" : lang === "ja" ? "なぜ作ったか" : "Why We Built It" },
            { id: "who", label: lang === "zh" ? "適合誰" : lang === "ja" ? "誰のため" : "Who Is It For" },
            { id: "diff", label: lang === "zh" ? "差異化比較" : lang === "ja" ? "機能比較" : "Comparison" },
            { id: "health", label: lang === "zh" ? "持倉體檢" : lang === "ja" ? "ポートフォリオ" : "Health Check" },
            { id: "security", label: lang === "zh" ? "安全分析" : lang === "ja" ? "セキュリティ" : "Security" },
            { id: "advisor", label: lang === "zh" ? "AI 顧問" : lang === "ja" ? "AIアドバイザー" : "AI Advisor" },
            { id: "agent", label: lang === "zh" ? "再平衡 Agent" : lang === "ja" ? "リバランス" : "Rebalance Agent" },
            { id: "smartmoney", label: lang === "zh" ? "聰明錢" : lang === "ja" ? "スマートマネー" : "Smart Money" },
            { id: "guardian", label: "Guardian" },
            { id: "gmgn", label: lang === "zh" ? "K 線圖" : lang === "ja" ? "Kラインチャート" : "GMGN Chart" },
            { id: "copytrade", label: lang === "zh" ? "複製交易" : lang === "ja" ? "コピートレード" : "Copy Trade" },
            { id: "goplus", label: "GoPlus" },
            { id: "helius", label: "Helius" },
            { id: "claude", label: "Claude AI" },
            { id: "noncustodial", label: lang === "zh" ? "非託管" : lang === "ja" ? "非カストディアル" : "Non-Custodial" },
            { id: "x402", label: "x402" },
            { id: "start", label: lang === "zh" ? "如何開始" : lang === "ja" ? "はじめ方" : "Getting Started" },
          ].map(({ id, label }) => (
            <button
              key={id}
              onClick={() => scrollTo(id)}
              style={{
                display: "block", width: "100%", textAlign: "left",
                padding: "4px 8px", border: "none", borderRadius: 4,
                background: "transparent",
                color: activeSection === id ? "var(--accent)" : "var(--text-muted)",
                fontSize: 12, cursor: "pointer", marginBottom: 2,
                fontWeight: activeSection === id ? 600 : 400,
                borderLeft: activeSection === id ? "2px solid var(--accent)" : "2px solid transparent",
              }}
            >{label}</button>
          ))}
        </aside>

      </div>

      <Footer />
    </ThemeWrapper>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function DocsPage() {
  return (
    <LanguageProvider>
      <DocsContent />
    </LanguageProvider>
  );
}
