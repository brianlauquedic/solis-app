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
    pageDesc: "在 Solana 上，一個正確的決策和一個代價慘重的錯誤之間，往往只差五秒鐘的數據。這本手冊解釋 Sakura 如何把這五秒鐘交還給你。",
    statsLabel: "平台核心數據",
    stats: [
      { v: "30+", l: "聰明錢標籤地址" },
      { v: "5", l: "GoPlus 安全維度" },
      { v: "11", l: "SAK AI 工具" },
      { v: "SHA-256", l: "AI 推理鏈上存證" },
      { v: "3", l: "免費體驗次數" },
    ],
    introTitle: "在點擊確認之前",
    introDesc: "某個週五晚上，一個擁有 8 萬粉絲的 Twitter KOL 發出一條推文：「這個代幣要動了，準備好了嗎？」四分鐘內，超過兩百個錢包完成了買入。第六分鐘，那個代幣的流動性池被創辦人一鍵抽走。所有買入者的資金歸零。這些人沒有做錯任何事——他們只是沒有一個工具，能在點擊確認之前告訴他們真相。",
    introPara2: "Sakura 是為了讓你成為沒有買的那個人而存在的。不是靠運氣，不是靠直覺——靠的是一個在你確認之前就已經完成所有工作的系統。安全評分出來了，聰明錢比對完了，收益效率算好了。你拿到的不是 AI 的猜測，而是有根據的判斷。你不需要相信 Sakura——AI 說的每一句話，背後都有 Solana 鏈上的 SHA-256 哈希值作為依據。你可以自己驗證它。",
    diffLabel: "差異化比較",
    whyTitle: "這個行業有一個沒人說出口的事實",
    whyDesc: "做 DeFi 的散戶和機構，用的根本不是同一個層級的工具。機構在建倉任何代幣之前，有完整的鏈上安全審計、有聰明錢數據庫、有多協議收益橫向對比——散戶有的，是 Twitter 和直覺。這個信息差，每天都在以真實的資金損失被填補。而最讓人沮喪的是：大多數損失，在發生之前就已經可以被預防。",
    whyPara2: "Sakura 從一個問題出發，也從一個選擇出發：如果這些工具能讓機構避開損失，為什麼持有 Phantom 錢包的普通人不能用？答案不是技術上做不到。是沒有人去做。我們選擇去做——不是做月費 SaaS，不是讓你把資產交給任何人保管，而是一個真正屬於你的工具：私鑰不離設備，AI 判斷上鏈存證，用多少付多少，沒有任何隱性成本。",
    whoTitle: "Sakura 為誰而生",
    whoItems: [
      { icon: "👤", title: "剛進入 DeFi 的新人", desc: "群組裡 200 個人都說買了。你打開錢包，手停在確認按鈕上——你不確定。這種不確定不是懦弱，是本能在保護你。Sakura 的安全分析就是給這個本能一個答案：五秒鐘，告訴你這個代幣有沒有資格讓你點下去。" },
      { icon: "📊", title: "深度 DeFi 研究者", desc: "你打開一個 AI 聊天框，貼上合約地址，它回覆：「這個代幣有一定潛力，但建議您做好自己的研究。」這句話一分錢信息都沒有。你要的是 MACD/RSI/Fibonacci 六指標共振分析，加上 30 個聰明錢地址今天在鏈上真正做了什麼——判斷需要原材料，不需要觀點。" },
      { icon: "🐋", title: "跟單與聰明錢追蹤者", desc: "你跟了一個 Whale，買了同一個代幣。三天後你發現那個合約有凍結權限，而那個 Whale 一小時前就跑了。這不是假設場景。Sakura 的安全閘口在這一刻之前介入：GoPlus 評分低於 70，複製按鈕不解鎖。" },
      { icon: "⚙️", title: "重視收益效率的持有者", desc: "你持有 USDC，它在錢包裡躺著。你知道應該拿去賺收益，但不知道哪個協議最安全、哪個 APY 最真實。這是合理的困境。Sakura 的自主 Agent 替你把這個問題解決完：掃描持倉，計算最優配置，告訴你每年能多賺多少，再給你一鍵執行的方案。" },
    ],
    diffTitle: "與眾不同在哪裡",
    diffSub: "下表是 Sakura 與一般 DeFi 工具或 AI 聊天機器人的功能對比。差距不在於介面，而在於底層數據與安全機制：",
    healthTitle: "持倉體檢",
    healthDesc: "你打開錢包看到一堆代幣，但你不知道整體是健康還是危險。持倉體檢在 30 秒內給出答案——不只是列資產，而是告訴你哪個代幣風險集中度過高、哪筆 USDC 在白白損失收益、以及按照你的真實持倉計算出來的具體優化方案。不是泛泛的「建議分散投資」，是針對你的帳戶說話。",
    healthBullets: [
      "資產配置評分（0-100）：識別單一代幣佔比過高等隱性風險",
      "閒置 USDC 偵測：計算錯過的年化收益，以 USDC 金額呈現",
      "多協議 APY 即時對比：Marinade、Jito、Kamino、Drift 並排比較",
      "健康分數歷史軌跡：每次體檢後留下時間戳記錄，清楚看到改善進展",
      "AI 優化建議：基於您的實際持倉，生成可直接執行的調整方案",
    ],
    securityTitle: "安全分析",
    securityDesc: "蜜罐代幣不會在合約裡寫「這是騙局」。它外觀正常，有流動性，有交易量——直到你想賣的那一刻，你才發現賣出函數被鎖死了。GoPlus 的掃描在代幣上線的第一秒就能識別這些機制。Sakura 把這個能力放在你每一次交易之前——不需要你懂合約，只需要你點一下「分析」。",
    securityBullets: [
      "增發權限（Mint Authority）：創辦人是否可以隨時增發、稀釋您的持倉？",
      "凍結權限（Freeze Authority）：合約是否有能力封鎖您的資金，讓您無法轉出？",
      "蜜罐偵測（Honeypot）：是否存在「只能買入、無法賣出」的陷阱機制？",
      "持幣集中度：前 10 大持有者的比例是否高到足以人為操控價格？",
      "流動性深度：滑點風險與池子深度分析，評估大額交易的實際成本",
    ],
    advisorTitle: "AI 顧問",
    advisorDesc: "你問一個問題，希望得到一個真實的答案，而不是 AI 背出來的段落。Sakura 的 AI 顧問在回答之前，會先去查：Kamino 現在的實際 APY 是多少？今天有哪些聰明錢地址在動 SOL？你說的那個代幣，鏈上最近 24 小時發生了什麼？你得到的答案，是基於此刻數據的判斷——不是六個月前訓練集裡的結論。",
    advisorBullets: [
      "多輪對話記憶：持續追蹤對話脈絡，讓每一條建議都基於完整的背景",
      "實時工具調用：自動查詢代幣價格、各協議 APY、聰明錢共識買入信號",
      "快速操作面板：一鍵觸發持倉體檢、聰明錢追蹤、收益對比、安全掃描",
      "自然語言執行：直接說「把 50 SOL 換成 USDC」，自動觸發 Jupiter 最優報價",
      "三語無縫切換：繁體中文、English、日本語——您說哪種語言，它就用哪種回應",
    ],
    agentTitle: "自主再平衡 Agent",
    agentDesc: "再平衡這件事，大多數人知道應該做，但一直沒做——因為不知道該從哪裡開始，不知道換到哪個協議，不知道手續費划不划算。自主 Agent 的設計就是把這個「不知道」完全消除：不需要你問任何問題，它掃描你的整個錢包，找出效率低下的持倉，用 USDC 金額告訴你「現在優化，每年多賺多少」，再給你一鍵執行的方案。你要做的，只是確認。",
    agentBullets: [
      "無提示自主掃描：沒有任何問題，Agent 自行完成全局分析",
      "年化增益量化：以具體 USDC 金額呈現切換協議後的預期收益差距",
      "Before / After 對比表：調整前後的年化收益清晰並排，讓決策有依據",
      "一鍵跨協議執行：Jupiter Swap → Marinade / Jito 質押 → Kamino 借貸，全部打通",
      "每次決策 SHA-256 上鏈：AI 的每一個推理步驟都有鏈上記錄，可獨立審計",
    ],
    smartTitle: "聰明錢追蹤",
    smartDesc: "聰明錢地址在任何公告之前，就已經開始買了。這不是陰謀論，這是鏈上數據的事實：那 30+ 個有標籤的地址——KOL、Whale、Cabal——他們的每一筆交易都是公開的，只是沒有人在系統性地追蹤。Sakura 替你追蹤。當多個頂級地址在 24 小時內同時買入同一代幣，那個信號出現在你面前——不是謠言，是鏈上記錄。",
    smartBullets: [
      "30+ 標籤地址庫：KOL 影響力 × Whale 體量 × Cabal 信息優勢，四類標籤全覆蓋",
      "24h 共識偵測算法：多個頂級地址同時買入 → 按標籤權重計算共識強度（1-5 星）",
      "評分邏輯透明：Cabal +2 分、Whale +2 分、KOL +1.5 分——分數如何算的一目瞭然",
      "Twitter 身份關聯：顯示每個地址對應的公開 Twitter（@handle），讓你知道跟的是誰",
      "安全閉環：共識代幣自動觸發 GoPlus 安全評分，好信號也要先過安全關",
    ],
    guardianTitle: "Guardian 自動監控",
    guardianDesc: "你不可能 24 小時盯盤。但市場不知道你什麼時候睡覺。Guardian 的設計前提很簡單：你比任何人都清楚自己的風險邊界——SOL 跌到多少你要動，APY 降到多少你要換，借貸健康係數低到多少你要補倉。你只需要說一次，Guardian 記住它，在那一刻到來的時候，替你執行你本來要做的事。",
    guardianBullets: [
      "價格觸發：SOL / 任何代幣跌破或突破指定價位時，通知或自動執行對衝",
      "APY 閾值：Kamino / Marinade APY 低於設定值，自動觸發再平衡",
      "借貸健康係數：Drift 倉位健康係數逼近清算線時，第一時間發出警報",
      "自動 Jupiter Swap：條件觸發後直接調用 Jupiter 完成換幣，無需您手動操作",
      "配置永久保存：Agent 設定寫入 localStorage，刷新頁面、重開瀏覽器都不會丟失",
    ],
    gmgnTitle: "GMGN 實時 K 線圖",
    gmgnDesc: "好的交易決策需要圖表。但切換網站這件事每天都在打斷你的思路——看完 GMGN 的聰明錢數據，再去 DexScreener 看圖，再回來執行。Sakura 把這個流程縮短到零：GMGN 的真實 K 線數據直接在應用裡渲染，你的分析、判斷、執行，在同一個窗口完成。不是 iframe 嵌入，是服務端代理後的本地渲染——穩定，沒有封鎖問題。",
    gmgnBullets: [
      "5 個時間框架：5m / 15m / 1h / 4h / 1d，快速切換捕捉不同週期的趨勢",
      "本地渲染引擎：基於 TradingView 開源 lightweight-charts，流暢無延遲",
      "服務端代理架構：繞過瀏覽器 CSP / CORS 限制，確保 GMGN 數據穩定可達",
      "選幣即更新：切換代幣分析目標，圖表立即重新加載對應 K 線數據",
      "零跳轉體驗：不再需要離開 Sakura，所有研究在同一個視窗完成",
    ],
    copyTitle: "複製交易",
    copyDesc: "跟單本身是合理的策略，前提是你跟的那個代幣值得被跟。問題是：聰明錢地址有時候在做出場，而你在做入場，而你不知道。Sakura 的安全閘口是第一道防線：無論那個 Whale 有多大、那個 KOL 有多少粉絲，GoPlus 評分低於 70 的代幣，複製按鈕不解鎖。因為最終受損的不是他們，是你。",
    copyBullets: [
      "強制安全閘口：GoPlus 評分 ≥ 70 才解鎖複製按鈕，低分代幣直接攔截",
      "智能倉位比例：根據您的總持倉自動計算合理的跟單金額，防止過度集中",
      "透明確認卡片：執行前展示代幣名稱、安全評分、預計費用、滑點——沒有任何隱藏信息",
      "Phantom 自簽名：私鑰從不離開您的設備，Sakura 只生成交易指令，不代您執行",
    ],
    goplusTitle: "GoPlus Security — 鏈上安全的行業標準",
    goplusDesc: "GoPlus Security 每天處理來自全球的數百萬次安全查詢，覆蓋 30 多條鏈。它不是一個新創公司做的小工具，而是目前 Web3 安全基礎設施裡數據覆蓋最廣的系統之一。Sakura 把 GoPlus 的完整評估能力整合進每一次代幣分析——5 個維度的結果被轉換成結構化數據，讓 AI 能給出具體的倉位建議，而不是「謹慎操作」這種沒用的話。",
    heliusTitle: "Helius — Solana 最快的鏈上數據層",
    heliusDesc: "原始的 Solana 鏈上數據是混亂的、未分類的——你看到一筆交易，但不知道它是 SWAP、NFT 鑄造、還是質押。Helius 的增強型 API 替你做了這個解析。Sakura 用這個能力識別聰明錢地址的真實行為：不是看他們的餘額，而是看他們在過去 24 小時裡，到底用鏈上行為說了什麼話、買了什麼、賣了什麼。",
    claudeTitle: "Claude Sonnet 4.6 — 業界最先進的 AI 推理引擎",
    claudeDesc: "當你向 Sakura 問了一個問題，得到了一個讓你覺得「這個 AI 真的在幫我」的答案——這種感覺不是偶然。它來自 Anthropic 的 Claude Sonnet 4.6，目前在複雜指令理解和多步驟工具調用上公認表現最強的 AI 模型之一。結合 Solana Agent Kit 的 11 個原生工具，Sakura 的 AI 不只是回答問題，而是能主動查數據、生成交易指令、做多步驟推理。每一個推理步驟都有 SHA-256 記錄在鏈上——這是一個可以被追責的 AI，不是說完就忘的聊天框。",
    ncTitle: "非託管設計 — 您的資產永遠屬於您",
    ncDesc: "「非託管」這個詞在 DeFi 被用濫了。我們說的非託管，是指 Sakura 的代碼裡不存在任何存儲你私鑰的機制——在架構上，這條路就不存在。所有鏈上交易的最終簽名，發生在你的 Phantom 錢包裡，在你的設備上，需要你的明確確認。Sakura 生成交易指令，你決定要不要簽。這條線從設計上就不能被越過。",
    x402Title: "x402 微支付 — 用多少付多少，沒有月費陷阱",
    x402Desc: "月費訂閱有一個本質問題：它讓你為沒用到的功能付錢。你一個月只用三次，費用一分不少扣。x402 的邏輯是相反的：用一次，付一次；不用，不付。每個功能有 3 次免費配額，超出後每次 $0.05–$0.10 USDC，通過 Phantom 在鏈上直接支付。這不只是付費模式的差異，這是對用戶時間和資金的一種尊重。",
    closingTitle: "每一個決策，都有憑有據",
    closingDesc: "那個週五晚上買了代幣的兩百個人，他們不是不夠謹慎。他們只是沒有 Sakura。DeFi 從來都是一場信息博弈——擁有完整數據的人做決策，沒有數據的人靠運氣。Sakura 的目的只有一個：讓每一個打開 Phantom 錢包的人，都能用上曾經只屬於機構的信息工具。連接錢包，免費開始。前三次分析，Sakura 請客。",
    startTitle: "五分鐘上手 Sakura",
    startSteps: [
      { n: "1", t: "安裝 Phantom", d: "去 phantom.app，安裝瀏覽器擴展，如果你已有助記詞就直接導入。整個過程不超過兩分鐘。這是你在 Solana 上的身份——Sakura 需要讀它，但永遠不會碰它。" },
      { n: "2", t: "連接，只讀，無需任何授權", d: "點「連接 Phantom」，授權讀取持倉數據。就這樣，沒有其他權限，沒有任何資產被授權轉移。如果你不放心，斷開連接的按鈕也在同一個地方。" },
      { n: "3", t: "連接後第一件事：持倉體檢", d: "不需要你輸入任何東西。30 秒，你會看到自己的 DeFi 現狀可能比你想象的更值得關注——健康分數、風險警告、以及具體可以怎麼改。" },
      { n: "4", t: "買任何代幣之前，先掃描一次", d: "輸入代幣名稱或合約地址，GoPlus 的結果就出來了。如果評分低，你會看到具體是哪一項有問題——不是「謹慎操作」，是具體的問題。" },
      { n: "5", t: "用你說話的方式問 AI 顧問", d: "不需要學習任何特殊語法。「現在 SOL 質押哪裡最划算？」「聰明錢最近在買什麼？」直接問，它去查數據再回答你。" },
      { n: "6", t: "最後，試一次自主 Agent", d: "點擊啟動，什麼都不用問。等 30 秒，你會看到一份關於你的持倉具體能怎麼優化的報告——帶金額，帶方案，帶執行按鈕。這是大多數人第一次真正看清楚自己的收益效率。" },
    ],
  } : lang === "ja" ? {
    pageLabel: "ドキュメント",
    pageTitle: "Sakura ドキュメント",
    pageDesc: "Solanaでは、正しい判断と壊滅的な誤りの差は、多くの場合5秒分のデータです。このハンドブックは、SakuraがどのようにそのX秒をあなたの側に置くかを説明します。",
    statsLabel: "プラットフォームデータ",
    stats: [
      { v: "30+", l: "ラベル付きウォレット" },
      { v: "5", l: "GoPlusセキュリティ次元" },
      { v: "11", l: "SAK AIツール" },
      { v: "SHA-256", l: "AI推論オンチェーン記録" },
      { v: "3", l: "無料体験回数" },
    ],
    introTitle: "確認を押す前に",
    introDesc: "ある金曜の夜、フォロワー8万人のKOLが一言投稿しました：「このトークン、動くよ。準備できてる？」4分以内に200以上のウォレットが買い入れました。6分後、デプロイヤーが流動性プールを引き抜きました。買い入れたすべての人の資金がゼロになりました。彼らは不注意だったわけでも、初心者だったわけでもありません。ただ、確認ボタンを押す前に真実を教えてくれるツールが、誰にもなかっただけです。",
    introPara2: "Sakuraは、あなたがその200人の中に入らないために存在します。運でも直感でもなく——確認ボタンを押す前にすべての作業が終わっているシステムがあるからです。安全スコアは出ています。スマートマネーの照合は完了しています。収益計算も済んでいます。あなたが受け取るのはAIの推測ではなく、根拠のある判断です。Sakuraを信頼する必要はありません——すべてのAI判断の背後には、何を、いつ、なぜ言ったかを証明するSolana上のSHA-256ハッシュがあります。あなた自身で検証できます。",
    diffLabel: "機能比較",
    whyTitle: "業界が口に出さない事実",
    whyDesc: "リテール投資家と機関投資家は、まったく同じ情報環境で戦っていません。機関投資家がポジションを取る前には、オンチェーンセキュリティ監査、スマートマネーデータフロー、マルチプロトコル収益比較があります。リテールにあるのは、TwitterとGut feelingです。この情報格差は毎日、リアルマネーの損失として埋められています——そしてその損失のほとんどは、すでに存在していたデータがあれば防げたはずです。",
    whyPara2: "Sakuraは一つの問いと、一つの意図的な選択から始まりました：これらのツールが機関投資家の損失回避に役立つなら、Phantomウォレットを持つ普通の人がそれを使えない理由はあるのか？答えは技術的な限界ではありません——誰も作っていなかっただけです。私たちはそれを作りました。月額課金のSaaSとしてではなく、資産を第三者に預けるサービスとしてでもなく——本当にあなたのものとして：秘密鍵はデバイスから離れず、AI判断はオンチェーンに記録され、使った分だけ支払います。隠れたコストは一切ありません。",
    whoTitle: "誰のためのツールか",
    whoItems: [
      { icon: "👤", title: "DeFiを始めたばかりの方", desc: "グループで200人が「買った」と言っている。あなたはウォレットを開いて、確認ボタンの前で手が止まります。その迷いは弱さではなく、本能があなたを守ろうとしているサインです。Sakuraのセキュリティ分析はその本能に答えを出します：5秒で、このトークンがあなたのお金に値するかどうかを教えます。" },
      { icon: "📊", title: "深度のあるDeFiリサーチャー", desc: "AIチャットウィンドウを開き、コントラクトアドレスを貼り付けると「このトークンには可能性がありますが、ご自身でリサーチしてください」という返答が来ます。その文には使える情報がゼロです。必要なのはMACD/RSI/Fibonacci 6指標の共鳴分析と、30以上のラベル付きウォレットが今日オンチェーンで実際に何をしたか——判断には原材料が必要であり、意見は不要です。" },
      { icon: "🐋", title: "コピートレーダー", desc: "あるWhaleと同じトークンを買いました。3日後、そのコントラクトに凍結権限があったことが判明します。そのWhaleは1時間前にすでに退場していました。これは仮定のシナリオではありません。SakuraのセキュリティゲートはGoPlus スコアが70を下回ればコピーボタンを解放しません。" },
      { icon: "⚙️", title: "収益効率を重視するホルダー", desc: "USDCを持っています。財布に眠っています。運用すべきだとわかっている。でも、どのプロトコルが本当に安全で、どのAPYが本物で、どれがロックアップを要求するかがわからない。それは合理的な問題です。SakuraのAutonomous Agentがそれを完全に解決します：保有状況をスキャンし、最適配分を計算し、年間でいくら多く稼げるかを示し、ワンクリックのプランを提示します。" },
    ],
    diffTitle: "何が違うのか",
    diffSub: "以下の表は、Sakuraと一般的なDeFiツールまたはAIチャットボットの機能比較です。差は表面ではなく、基盤となるデータとセキュリティメカニズムにあります：",
    healthTitle: "ポートフォリオ診断",
    healthDesc: "ウォレットを開いてトークンのリストが見える——でも全体が健全なのか静かに危険なのかがわからない。ポートフォリオ診断は30秒以内にその答えを出します。資産を列挙するだけでなく：どのトークンがリスク集中しすぎているか、どのUSDCが毎日収益を損失しているか、そしてあなたの実際の保有状況に基づいて計算された具体的な改善プランを提示します。",
    healthBullets: [
      "資産配分スコア（0-100）：単一トークンの過剰集中などの潜在リスクを特定",
      "遊休USDC検出：機会損失を年間USDC金額で換算して表示",
      "マルチプロトコルAPYリアルタイム比較：Marinade、Jito、Kamino、Driftを並列比較",
      "健康スコア履歴トラッキング：診断ごとにタイムスタンプ付きで記録し、改善経緯を可視化",
      "AI最適化提案：実際の保有状況に基づき、直接実行可能な調整プランを生成",
    ],
    securityTitle: "セキュリティ分析",
    securityDesc: "ハニーポットトークンは「これは詐欺です」とは書きません。正常に見えます——アクティブな取引、本物の流動性——売ろうとした瞬間、出口がロックされていることがわかります。GoPlusスキャンはトークンが存在した最初の秒からこれらのメカニズムを識別できます。Sakuraはその能力をあなたのすべての取引判断の前に置きます——コントラクトを理解する必要はありません。「分析」をクリックするだけです。",
    securityBullets: [
      "発行権限（Mint Authority）：開発者がいつでも無制限に増発してあなたの持分を希薄化できるか？",
      "凍結権限（Freeze Authority）：コントラクトがあなたのトークンを封鎖して転出不能にできるか？",
      "ハニーポット検出：「購入のみで売却不可」という罠メカニズムが存在するか？",
      "保有集中度：上位10保有者の比率は価格操作を可能にするほど高いか？",
      "流動性深度：スリッページリスクとプール深度分析で大口取引の実際のコストを評価",
    ],
    advisorTitle: "AIアドバイザー",
    advisorDesc: "質問をして、本物の答えを求めている——記憶から引用した段落ではなく。SakuraのAIアドバイザーは回答する前にまず確認します：今のKaminoの実際のAPYはいくらか？今日スマートマネーアドレスはSOLを動かしたか？あのトークンの過去24時間のオンチェーン活動はどうだったか？あなたが受け取る答えは、今この瞬間のデータに基づく判断——6ヶ月前のトレーニングセットの結論ではありません。",
    advisorBullets: [
      "マルチターン会話記憶：会話の文脈を継続追跡し、一貫性のある深いアドバイスを実現",
      "リアルタイムツール呼び出し：トークン価格、各プロトコルAPY、スマートマネーコンセンサスシグナルを自動照会",
      "クイックアクションパネル：ポートフォリオ診断、スマートマネー追跡、収益比較、セキュリティスキャンをワンクリック起動",
      "自然言語実行：「50 SOLをUSDCに換える」と言うだけでJupiter最適見積もりを即時起動",
      "3言語シームレス切替：繁体字中国語、English、日本語——どの言語で話しかけても自然に応答",
    ],
    agentTitle: "自律リバランスエージェント",
    agentDesc: "リバランスはほとんどの人がすべきだとわかっているのに、ずっとしていないことです——どこから始めればいいかわからない、どのプロトコルが本当に最適か、ガス代が見合うかがわからないからです。Autonomous Agentはそのすべての「わからない」を消去するために設計されています。質問は何も必要ありません：ウォレット全体をスキャンし、非効率を特定し、今最適化したら年間でいくら多く稼げるかを数字で示し、ワンクリックのプランを提示します。あなたがすることは確認だけです。",
    agentBullets: [
      "プロンプト不要の自律スキャン：質問ゼロでグローバル分析を自動完了",
      "年間増益の定量化：プロトコル切替後の期待収益差をUSDB具体金額で提示",
      "Before / After比較表：調整前後の年間収益を並べて表示し、意思決定に根拠を",
      "クロスプロトコルワンクリック実行：Jupiter Swap → Marinade/Jitoステーキング → Kaminoレンディングを完全接続",
      "全判断SHA-256オンチェーン記録：AIの各推論ステップがチェーンに記録され、独立監査が可能",
    ],
    smartTitle: "スマートマネー追跡",
    smartDesc: "スマートマネーアドレスはどんな公式発表より前にポジションを取っています。これは陰謀論ではなく、オンチェーンデータの事実です：それらの30以上のラベル付きアドレスの取引はすべて公開されています。誰も体系的に追跡していなかっただけです。Sakuraが追跡します。複数のトップアドレスが24時間以内に同じトークンを買い入れると、そのシグナルがあなたの前に現れます——噂ではなく、オンチェーンの記録です。",
    smartBullets: [
      "30以上のラベル付きアドレスDB：KOLの影響力 × Whaleの資金力 × Cabalの情報優位、4カテゴリ完全網羅",
      "24hコンセンサス検出アルゴリズム：複数トップアドレスが同時購入 → ラベル重み付けでコンセンサス強度を算出（1-5星）",
      "スコアリングロジックの透明性：Cabal +2点、Whale +2点、KOL +1.5点——計算根拠を完全公開",
      "Twitter身元連携：各アドレスに対応する公開Twitter（@ハンドル）を表示、誰をフォローしているかを明確に",
      "セキュリティ閉ループ：コンセンサストークンが自動的にGoPlus安全スコアをトリガー——良いシグナルも安全審査を通過させる",
    ],
    guardianTitle: "Guardian 自動監視",
    guardianDesc: "チャートをずっと見続けることはできません。でも市場はあなたがいつ眠るかを知りません。Guardianはシンプルな前提で動きます：あなたは自分のリスク境界を誰よりもよく知っています。ヘッジが必要な価格。リバランスが必要なAPYのフロア。追加担保が必要な健康係数。一度言えばいい。Guardianがそれを覚えて、その瞬間が来たときに、あなたが行うべきことを代わりに実行します。",
    guardianBullets: [
      "価格トリガー：SOL/任意トークンが指定価格を下回るか上回った際、通知または自動ヘッジ実行",
      "APY閾値：Kamino/Marinade APYが設定値を下回った場合、自動リバランスをトリガー",
      "借入健康係数：Driftポジションが清算ラインに近づいた際、即座にアラート発報",
      "自動Jupiterスワップ：条件トリガー後にJupiterを直接呼び出してスワップを完了、手動操作不要",
      "設定の永続保存：エージェント設定はlocalStorageに書き込まれ、ページ更新・ブラウザ再起動後も消えない",
    ],
    gmgnTitle: "GMGNリアルタイムKラインチャート",
    gmgnDesc: "良いトレード判断にはチャートが必要です。でもタブを切り替えることが毎回思考の流れを断ち切ります——GMGNでスマートマネーデータを確認し、DexScreenerでチャートを見て、戻ってきてトレード実行。Sakuraはそのループをゼロにします：リアルなGMGN Kラインデータがアプリ内で直接レンダリングされます。分析、判断、実行が一つのウィンドウで完結します。iframeの埋め込みではなく、サーバーサイドプロキシによるローカルレンダリング——安定していて、ブロックの問題もありません。",
    gmgnBullets: [
      "5時間軸：5m / 15m / 1h / 4h / 1d、異なる時間軸のトレンドをすばやく切替で捕捉",
      "ローカルレンダリングエンジン：TradingViewオープンソースlightweight-chartsで、スムーズなラグなし表示",
      "サーバーサイドプロキシアーキテクチャ：ブラウザのCSP/CORS制限を回避し、GMGNデータへの安定アクセスを確保",
      "トークン選択即更新：分析対象トークンを切り替えると、チャートが即座に対応するKラインデータをリロード",
      "ゼロ切替体験：Sakuraを離れる必要なし、すべてのリサーチを同一ウィンドウで完了",
    ],
    copyTitle: "コピートレード",
    copyDesc: "コピートレードは正当な戦略です——コピーしようとしているトークンがコピーに値する場合に限り。問題はスマートマネーアドレスが出場しているときにあなたが入場していることがある、それがわからないことです。Sakuraのセキュリティゲートが最初の防衛線です：Whaleがどれほど大きくても、KOLのフォロワーがどれほど多くても、GoPlus スコアが70を下回ればコピーボタンは解放されません。取引がうまくいかなかったとき、損失を被るのは彼らではなくあなただからです。",
    copyBullets: [
      "強制安全ゲート：GoPlus スコア ≥ 70のみコピーボタンを解除、低スコアトークンは直接ブロック",
      "スマートポジションサイジング：総保有量に基づいて適切なフォロー金額を自動計算、過剰集中を防止",
      "透明な確認カード：実行前にトークン名、安全スコア、推定手数料、スリッページを表示——隠し情報ゼロ",
      "Phantom自己署名：秘密鍵はデバイスから離れず、Sakuraはトランザクション命令を生成するのみ",
    ],
    goplusTitle: "GoPlus Security — オンチェーンセキュリティの業界標準",
    goplusDesc: "GoPlus Securityは毎日世界中から数百万件のセキュリティクエリを処理し、30以上のチェーンをカバーしています。スタートアップのツールではなく、Web3セキュリティインフラでデータカバレッジが最も広いシステムの一つです。SakuraはGoPlusの完全な評価能力をすべてのトークン分析に統合します：5次元の結果を構造化データに変換し、「慎重に操作してください」という役に立たない言葉ではなく、定量的なセキュリティ根拠に基づいたポジション提案をAIが出せるようにします。",
    heliusTitle: "Helius — Solana最速のオンチェーンデータ層",
    heliusDesc: "生のSolanaオンチェーンデータはノイズが多く、未解析です。取引が見えますが、それがSWAPなのか、NFTミントなのか、ステーキング入金なのかがわかりません。HeliusのEnhanced APIがその解析を行います。Sakuraはこれを使ってスマートマネーアドレスが実際に何をしているかを追跡します：残高ではなく行動——何を買い、何を売り、いつそれをしたか。",
    claudeTitle: "Claude Sonnet 4.6 — 業界最先端のAI推論エンジン",
    claudeDesc: "Sakuraに質問して「このAIは本当に自分を助けている」と感じる——その感覚は偶然ではありません。AnthropicのClaude Sonnet 4.6から来ています。複雑な指示理解とマルチステップのツール呼び出しにおいて、現在公認で最も高いパフォーマンスを持つAIモデルの一つです。11のSolana Agent Kitネイティブツールと組み合わせることで、SakuraのAIは単に質問に答えるだけでなく、ライブデータを能動的に照会し、トランザクション命令を生成し、複数ステップで推論します。すべてのステップはSolanaにSHA-256ハッシュとして記録されます——説明責任を問えるAIであり、言ったことを忘れるチャットウィンドウではありません。",
    ncTitle: "非カストディアル設計 — あなたの資産は永遠にあなたのもの",
    ncDesc: "「非カストディアル」はDeFiで使い古された言葉です。Sakuraにおける実際の意味：あなたの秘密鍵を保存するメカニズムがコードベースに存在しません——アーキテクチャ上、そのパスは存在しません。すべてのオンチェーントランザクションの最終署名は、あなたのPhantomウォレット内で、あなたのデバイス上で、あなたの明示的な確認を必要として行われます。Sakuraは命令を生成します。署名するかどうかはあなたが決めます。その境界線は設計上、越えることができません。",
    x402Title: "x402マイクロペイメント — 使った分だけ支払い、月額の罠なし",
    x402Desc: "サブスクリプションモデルには本質的な問題があります：使っていない機能に対して支払いをさせられます。月に3回しか使わなくても、全額引き落とされます。x402はその論理を完全に逆転させます：1回使えば1回分支払う；使わなければ何も支払わない。各機能には3回の無料クォータがあります。それを超えると$0.05–$0.10 USDCで、Phantom経由でオンチェーンに直接支払います。これは単に価格モデルの違いではありません。誰の時間とお金が尊重されるべきかという哲学の違いです。",
    closingTitle: "すべての判断に、根拠がある",
    closingDesc: "あの金曜の夜にトークンを買い入れた200以上のウォレットは、不注意だったわけではありません。ただSakuraがなかっただけです。DeFiは本質的に情報戦です——完全なデータを持つ人が決断し、データを持たない人は運に頼ります。Sakuraの目的はシンプルです：Phantomウォレットを開くすべての人が、かつては機関投資家だけが持てた情報ツールを使えるようにすること。ウォレットを接続してください。最初の3回の分析は無料です。今持っている情報から、始めましょう。",
    startTitle: "5分でSakuraを使い始める",
    startSteps: [
      { n: "1", t: "Phantomをインストール", d: "phantom.appへ行き、ブラウザ拡張機能をインストールし、既存のウォレットがあればシードフレーズをインポートします。2分以内に完了します。これはSolanaでのあなたのアイデンティティです——Sakuraはそれを読む必要がありますが、決して触れません。" },
      { n: "2", t: "接続——読み取り専用、それだけ", d: "「Phantomを接続」をクリックして読み取りアクセスを許可します。それだけです。他の権限なし、隠れた認証なし。切断したければ、ボタンは同じ場所にあります。" },
      { n: "3", t: "最初にすること：ヘルスチェック", d: "入力は何も必要ありません。30秒で、あなたのDeFiの現実が見えます——健康スコア、具体的なリスクフラグ、改善プラン。ほとんどの人が予想していなかったものを見つけます。" },
      { n: "4", t: "買う前に必ずスキャン", d: "トークン名またはコントラクトアドレスを入力します。GoPlus の結果が数秒で返ります——「慎重に操作してください」ではなく、具体的な問題：どの次元が失敗したか、それがなぜ重要かを。" },
      { n: "5", t: "AIアドバイザーに普通に話しかける", d: "「今SOLをステーキングするならどこが最適ですか？」「今日スマートマネーは何か面白いものを買っていますか？」知識のある友人に聞くように質問してください。回答する前にライブデータを確認します。" },
      { n: "6", t: "一度Autonomous Agentを実行する", d: "起動をクリックします。何も聞かなくていいです。30秒で、実際の保有状況に関するレポートが見えます：何が非効率で、年間でいくら損失しているか、そしてそれを修正するワンクリックプランが。ほとんどの人にとって、これが初めて自分の収益効率を明確に見る瞬間です。" },
    ],
  } : {
    pageLabel: "Documentation",
    pageTitle: "Sakura Documentation",
    pageDesc: "On Solana, the difference between a sound decision and a catastrophic one is often five seconds of data. This handbook explains how Sakura puts those five seconds on your side.",
    statsLabel: "Platform At a Glance",
    stats: [
      { v: "30+", l: "Labeled Smart Wallets" },
      { v: "5", l: "GoPlus Security Dims" },
      { v: "11", l: "SAK AI Tools" },
      { v: "SHA-256", l: "AI Reasoning On-Chain" },
      { v: "3", l: "Free Uses / Feature" },
    ],
    introTitle: "Before You Click Confirm",
    introDesc: "On a Friday evening, a KOL with 80,000 followers posted one sentence: \"This token is about to run. Are you ready?\" Over two hundred wallets bought in within four minutes. By minute six, the deployer had drained the liquidity pool. Every wallet that bought in lost everything. These weren't careless people. They weren't new to crypto. They simply had no tool that could tell them the truth before they clicked confirm.",
    introPara2: "Sakura exists so that you're the one who didn't buy — not through luck, but because you knew. In the moment before you confirm a transaction, the security scan is done, the smart money cross-check is complete, the yield calculation is ready. You're not relying on the AI's opinion. You're looking at evidence. You don't have to trust Sakura — behind every AI judgment is a SHA-256 hash on Solana that proves exactly what was said, when, and why. You can verify it yourself.",
    diffLabel: "Capability Comparison",
    whyTitle: "A Fact the Industry Rarely Says Out Loud",
    whyDesc: "Retail traders and institutional investors are not operating in the same information environment. Before any institution takes a position, it has on-chain security audits, smart money data feeds, and multi-protocol yield comparisons. Retail has Twitter and gut instinct. This information gap is filled every single day with real money lost — and most of those losses were preventable with data that already existed.",
    whyPara2: "Sakura begins with a question, and a deliberate choice: if these tools help institutions avoid losses, why can't someone holding a Phantom wallet use them? The answer was never technical limitation — no one had built it yet. We built it. Not as a subscription SaaS. Not as a service requiring you to hand your assets to a third party. A tool that is genuinely yours: keys never leave your device, AI reasoning is recorded on-chain, you pay per use. Nothing is hidden.",
    whoTitle: "Who Sakura Is For",
    whoItems: [
      { icon: "👤", title: "New to DeFi", desc: "Two hundred people in the group already bought. You open your wallet, hand hovering over confirm — and you hesitate. That hesitation isn't weakness. It's your instinct doing its job. Sakura gives that instinct an answer: five seconds, and you know whether this token deserves your money." },
      { icon: "📊", title: "Serious DeFi Researchers", desc: "You've opened an AI chat window, pasted in a contract address, and received: \"This token shows some potential — but please do your own research.\" That sentence contains zero usable information. What you need is MACD/RSI/Fibonacci 6-indicator confluence analysis, and what 30+ labeled wallets actually did on-chain today. Decisions need raw material. Not opinions." },
      { icon: "🐋", title: "Copy Traders", desc: "You followed a Whale into a token. Three days later you discover the contract had freeze authority — and that Whale had already exited an hour before you realized. That's not a hypothetical. Sakura's security gate exists for exactly this: GoPlus score below 70 means the copy button doesn't unlock." },
      { icon: "⚙️", title: "Yield Efficiency Seekers", desc: "You have USDC sitting idle. You know it should be working. But you don't know which protocol is actually safe, which APY is real, which one requires lock-up. That's a reasonable problem, not carelessness. Sakura's Autonomous Agent solves it completely: scans your holdings, finds the optimal allocation, tells you how much more per year, gives you a one-click plan." },
    ],
    diffTitle: "What Makes Sakura Different",
    diffSub: "The table below compares Sakura against generic DeFi tools or AI chatbots. The gap isn't in the interface — it's in the underlying data pipeline and security architecture:",
    healthTitle: "Portfolio Health Check",
    healthDesc: "You open your wallet and see a list of tokens — but you don't know if the overall picture is healthy or quietly dangerous. Portfolio Health Check gives you that answer in 30 seconds. Not just a list of assets: a diagnosis. Which token is dangerously over-concentrated. Which USDC is losing yield every day it sits there. And exactly what to do about it — calculated against your actual holdings, not a generic template.",
    healthBullets: [
      "Asset allocation score (0–100): flags dangerous over-concentration in a single token",
      "Idle USDC detection: calculates the annual yield you're leaving on the table, in USDC terms",
      "Multi-protocol APY live comparison: Marinade, Jito, Kamino, and Drift side-by-side",
      "Health score history: timestamp-logged across check-ups so you can track improvement over time",
      "AI optimization plan: generates a directly actionable rebalancing recommendation based on your real holdings",
    ],
    securityTitle: "Security Analysis",
    securityDesc: "Honeypot tokens don't announce themselves. They look normal — active trading, real liquidity — until the moment you try to sell and find the exit is locked. GoPlus scanning can identify these mechanisms from the token's first second on-chain. Sakura puts that capability in front of every trade you consider. You don't need to understand the contract. You just need to click \"Analyze.\"",
    securityBullets: [
      "Mint Authority: can the developer inflate supply at will, diluting your position to near-zero?",
      "Freeze Authority: can the contract lock your tokens, making it impossible to transfer or sell?",
      "Honeypot Detection: is there a \"buy-only, no-sell\" trap mechanism built into the contract?",
      "Holder Concentration: is the top-10 holder percentage high enough to enable price manipulation?",
      "Liquidity Depth: slippage risk and pool depth analysis to calculate the true cost of large trades",
    ],
    advisorTitle: "AI Advisor",
    advisorDesc: "You ask a question. You want a real answer — not a paragraph the AI recited from memory. Before Sakura's AI Advisor responds, it checks: what's Kamino's actual APY right now? Which smart money addresses moved SOL today? What happened on-chain with that token in the last 24 hours? What you get is a judgment based on this moment's data — not a conclusion from a training set that's six months old.",
    advisorBullets: [
      "Multi-turn memory: continuously tracks conversation context for coherent, contextual advice across sessions",
      "Live tool invocations: automatically queries token prices, protocol APYs, on-chain data, and smart money consensus",
      "Quick action panel: one-click triggers for health check, smart money tracking, yield comparison, and security scan",
      "Natural language execution: say \"swap 50 SOL to USDC\" — Sakura surfaces the optimal Jupiter quote immediately",
      "Trilingual switching: Traditional Chinese, English, Japanese — respond in whichever language you prefer",
    ],
    agentTitle: "Autonomous Rebalance Agent",
    agentDesc: "Rebalancing is something most people know they should do — and keep not doing. Because they don't know where to start, which protocol is actually best, whether the gas is worth it. The Autonomous Agent is designed to eliminate every one of those unknowns. No questions needed: it scans your entire wallet, identifies every inefficiency, quantifies how much more you'd earn per year if you optimized today, and gives you a one-click plan. All you need to do is confirm.",
    agentBullets: [
      "Zero-prompt autonomous scan: no questions required — the Agent completes full global analysis on its own",
      "Annual yield delta quantified: shows the expected income difference in USDC if you switch to optimal protocols",
      "Before / After comparison table: pre- and post-rebalance annual yield shown side-by-side for evidence-based decisions",
      "Cross-protocol one-click execution: Jupiter Swap → Marinade/Jito staking → Kamino lending, fully connected",
      "Every decision SHA-256 on-chain: each Agent reasoning step recorded on Solana for independent audit",
    ],
    smartTitle: "Smart Money Tracker",
    smartDesc: "Smart money addresses take their positions before any public signal. This isn't conspiracy — it's on-chain fact. Every transaction those 30+ labeled addresses make is public. Nobody was tracking them systematically. Sakura does. When multiple top addresses buy the same token within 24 hours, that signal surfaces in front of you — not a rumor, an on-chain record.",
    smartBullets: [
      "30+ labeled address database: KOL influence × Whale capital × Cabal information edge — 4 categories fully covered",
      "24h consensus detection algorithm: multiple top addresses buying simultaneously → consensus strength scored by label weight (1–5 stars)",
      "Transparent scoring logic: Cabal +2, Whale +2, KOL +1.5 — every calculation is visible, nothing hidden",
      "Twitter identity linked: each address shows its associated public Twitter (@handle) so you know exactly who you're following",
      "Security closed loop: consensus tokens automatically trigger GoPlus safety scoring — good signals still go through the gate",
    ],
    guardianTitle: "Guardian Auto-Monitor",
    guardianDesc: "You can't watch charts forever. But the market doesn't know when you sleep. Guardian works on a simple premise: you know your own risk thresholds better than anyone. The price where you'd hedge. The APY floor where you'd rebalance. The health factor where you'd add collateral. Say it once. Guardian remembers it. When that moment arrives, it does what you would have done — without you needing to be there.",
    guardianBullets: [
      "Price triggers: notify or auto-execute a hedge when SOL / any token breaks above or below your target",
      "APY threshold: auto-rebalance when Kamino or Marinade APY dips below your floor",
      "Lending health factor: instant alert when your Drift position approaches the liquidation boundary",
      "Automated Jupiter swap: execute the trade directly via Jupiter when conditions fire — no manual step needed",
      "Config lives forever: Agent settings written to localStorage — survives page refreshes, browser restarts, everything",
    ],
    gmgnTitle: "GMGN Live K-Line Chart",
    gmgnDesc: "Every good trade starts with a chart. But switching between tabs breaks your thinking — GMGN for smart money data, DexScreener for the chart, back to execute. Sakura cuts that loop to zero: real GMGN K-line data renders directly inside the app. Your research, your judgment, your execution — all in one window. Not an iframe embed. Server-side proxy, local rendering — stable and fast.",
    gmgnBullets: [
      "5 timeframes: 5m / 15m / 1h / 4h / 1d — quickly switch to capture trends across different cycles",
      "Local rendering engine: TradingView open-source lightweight-charts, smooth and lag-free",
      "Server-side proxy architecture: bypasses browser CSP/CORS restrictions to ensure stable GMGN data access",
      "Select token, chart updates: switch your analysis target and the K-line data reloads instantly",
      "Zero-tab workflow: no need to leave Sakura — every part of your research happens in the same window",
    ],
    copyTitle: "Copy Trade",
    copyDesc: "Copy trading is a legitimate strategy — as long as the token you're copying is worth copying. The problem: smart money addresses sometimes exit while you're entering, and you don't know. Sakura's security gate is the first line of defense: regardless of how big the Whale is or how many followers the KOL has, if GoPlus score is below 70, the copy button doesn't unlock. Because when the trade goes wrong, it's not their money at risk. It's yours.",
    copyBullets: [
      "Mandatory security gate: GoPlus score ≥ 70 unlocks the copy button; low-score tokens are blocked at the source",
      "Smart position sizing: auto-calculates an appropriate copy amount based on your total portfolio, preventing over-concentration",
      "Transparent confirmation card: shows token name, safety score, estimated fees, and slippage before execution — nothing hidden",
      "Phantom self-signature: your keys never leave your device; Sakura generates the instruction only, never executes for you",
    ],
    goplusTitle: "GoPlus Security — The Industry Standard for On-Chain Safety",
    goplusDesc: "GoPlus Security processes millions of security queries from around the world every day, covering 30+ chains. It's not a startup tool — it's one of the most data-complete security infrastructure systems in Web3. Sakura integrates GoPlus's full assessment capability into every token analysis: 5-dimension results converted to structured data, giving the AI a quantifiable security basis for position recommendations rather than the useless \"exercise caution.\"",
    heliusTitle: "Helius — Solana's Fastest On-Chain Data Layer",
    heliusDesc: "Raw Solana on-chain data is noisy and unparsed. You see a transaction, but not what kind — is it a SWAP, an NFT mint, a staking deposit? Helius Enhanced API makes that distinction. Sakura uses this to track what smart money addresses are actually doing on-chain: not their balance, but their behavior — what they bought, what they sold, and when.",
    claudeTitle: "Claude Sonnet 4.6 — The Most Advanced AI Reasoning Engine Available",
    claudeDesc: "When you ask Sakura a question and get an answer that makes you think \"this AI is actually helping me\" — that feeling isn't accidental. It comes from Anthropic's Claude Sonnet 4.6, one of the strongest-performing models available for complex instruction following and multi-step tool invocation. Paired with 11 native Solana Agent Kit tools, Sakura's AI doesn't just answer questions — it actively queries live data, generates transaction instructions, and reasons across multiple steps. Every step is SHA-256 hashed on Solana — an AI that can be held accountable, not a chat window that forgets what it said.",
    ncTitle: "Non-Custodial Architecture — Your Assets Are Always Yours",
    ncDesc: "\"Non-custodial\" gets used loosely in DeFi. Here's what it actually means in Sakura: there is no mechanism in our codebase that stores your private key. Architecturally, the path doesn't exist. Every on-chain transaction is signed inside your Phantom wallet, on your device, requiring your explicit confirmation. Sakura generates the instruction. You decide whether to sign. That line cannot be crossed by design.",
    x402Title: "x402 Micropayments — Pay for What You Use, No Subscription Traps",
    x402Desc: "Subscription models have a fundamental problem: you pay for features you don't use. Use it three times in a month, you still pay full price. x402 inverts that logic entirely: one use, one payment; no use, nothing charged. Every feature comes with 3 free uses. After that, $0.05–$0.10 USDC per use, paid on-chain via Phantom. It's not just a different pricing model. It's a different philosophy about whose time and money deserves respect.",
    closingTitle: "Every Decision. On the Record.",
    closingDesc: "The two hundred wallets that bought in that Friday evening weren't careless. They just didn't have Sakura. DeFi has always been an information game — people with complete data make decisions; people without data make guesses. Sakura's purpose is straightforward: give everyone who opens a Phantom wallet access to the same quality of information that used to belong only to institutions. Connect your wallet. Your first three analyses are free. Start with what you know right now.",
    startTitle: "Up and Running in Five Minutes",
    startSteps: [
      { n: "1", t: "Install Phantom", d: "Go to phantom.app, install the browser extension, import your existing wallet or create one. Under two minutes. This is your identity on Solana — Sakura needs to read it, but will never touch it." },
      { n: "2", t: "Connect — Read-Only, Nothing Else", d: "Click \"Connect Phantom\" and authorize read access. That's all. No asset permissions, no hidden authorizations. If you want to disconnect, the button is right there." },
      { n: "3", t: "First Thing: Run a Health Check", d: "No input required. In 30 seconds you'll see your DeFi reality — a health score, specific risk flags, and a concrete plan to improve. Most people find something they didn't expect." },
      { n: "4", t: "Before Any Buy: Security Scan", d: "Type a token name or contract address. GoPlus results come back in seconds — not \"exercise caution,\" but specific: which dimension failed, and why that matters." },
      { n: "5", t: "Talk to the AI Advisor Normally", d: "\"What's the best place to stake SOL right now?\" \"Is smart money buying anything interesting today?\" Ask it like you'd ask a knowledgeable friend. It checks live data before answering." },
      { n: "6", t: "Run the Autonomous Agent Once", d: "Click to start. Ask nothing. In 30 seconds, see a report on your actual holdings: what's inefficient, how much you're leaving on the table per year, and a one-click plan to fix it. For most people, this is the first time they've actually seen their yield efficiency clearly." },
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

          {/* ── Pull Quote ── */}
          <div style={{
            borderLeft: "3px solid var(--accent)", padding: "20px 28px",
            background: "var(--accent-soft)", borderRadius: "0 10px 10px 0",
            marginBottom: 48,
          }}>
            <p style={{
              margin: "0 0 10px", fontSize: 17, fontStyle: "italic",
              color: "var(--text-primary)", lineHeight: 1.75, fontFamily: "var(--font-heading)",
              fontWeight: 300, letterSpacing: "0.01em",
            }}>
              {lang === "zh"
                ? "「在 Solana 上，一個代幣從上線到流動性被抽空，最快只需要四分鐘。大多數散戶是在資金歸零之後，才發現那個合約有增發權限。」"
                : lang === "ja"
                ? "「Solanaでは、トークンが上場してから流動性が引き抜かれるまで、最短4分しかかからない。ほとんどのリテールトレーダーは、そのコントラクトに発行権限があることを、損失が出てから初めて知る。」"
                : "\"On Solana, a token can go from launch to drained liquidity in under four minutes. Most retail traders find out a contract had mint authority only after the loss has already happened.\""}
            </p>
            <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)", letterSpacing: "0.04em" }}>
              {lang === "zh" ? "—— 這正是 Sakura 安全分析存在的理由"
                : lang === "ja" ? "—— これがSakuraセキュリティ分析が存在する理由です"
                : "—— This is why Sakura Security Analysis exists"}
            </p>
          </div>

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

          {/* ── CLOSING ── */}
          <div id="closing" style={{
            marginTop: 64, padding: "36px 40px",
            background: "var(--accent-soft)",
            borderRadius: 16,
            border: "1px solid rgba(192,57,43,0.2)",
            borderLeft: "4px solid var(--accent)",
          }}>
            <h2 style={{
              margin: "0 0 16px", fontSize: 22, fontWeight: 400,
              fontFamily: "var(--font-heading)", color: "var(--text-primary)",
              letterSpacing: "0.01em",
            }}>{content.closingTitle}</h2>
            <p style={{
              margin: "0 0 24px", fontSize: 15, color: "var(--text-secondary)",
              lineHeight: 2, maxWidth: 560,
            }}>{content.closingDesc}</p>
            <a href="/" style={{
              display: "inline-block", padding: "10px 24px",
              background: "var(--accent)", color: "#fff",
              borderRadius: 8, textDecoration: "none",
              fontSize: 13, fontWeight: 600,
            }}>
              {lang === "zh" ? "連接 Phantom — 免費開始"
                : lang === "ja" ? "Phantomを接続 — 無料で始める"
                : "Connect Phantom — Start Free"}
            </a>
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
