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
    pageDesc: "每一個 DeFi 決策都值得被認真對待。本手冊帶您深入了解 Sakura 如何用安全、數據與 AI 推理，保護並增長您在 Solana 上的每一分資產。",
    statsLabel: "平台核心數據",
    stats: [
      { v: "30+", l: "聰明錢標籤地址" },
      { v: "5", l: "GoPlus 安全維度" },
      { v: "11", l: "SAK AI 工具" },
      { v: "SHA-256", l: "AI 推理鏈上存證" },
      { v: "3", l: "免費體驗次數" },
    ],
    introTitle: "Sakura 是什麼",
    introDesc: "Solana 是世界上移動最快的區塊鏈——而速度，從來都是一把雙刃劍。機會與騙局以同樣的速度出現。大多數用戶依賴直覺、朋友的推薦、或 Twitter 上匿名帳號的喊單——而這些，遠遠不夠。Sakura 是一位真正懂 Solana 的 AI 顧問，在您點擊「確認交易」的那一秒之前，已完成人類無法手動完成的安全審查、聰明錢比對與收益計算。",
    introPara2: "但 Sakura 與所有 AI 工具最根本的差異不是功能——是可信度。我們的每一個 AI 推理結果都以 SHA-256 雜湊值的形式，透過 Solana Memo Program 永久寫入鏈上。這意味著：AI 說了什麼、何時說的、基於哪些數據推理的，全部有憑有據，任何人都可以獨立驗證。不是承諾，是證明。",
    diffLabel: "差異化比較",
    whyTitle: "為什麼要打造 Sakura",
    whyDesc: "DeFi 市場每年因詐騙代幣、蜜罐陷阱和信息不對稱造成的損失難以估計——而這些損失中，有相當一部分本可以被一個工具在五秒鐘內阻止。我們在使用各種 DeFi 工具的過程中反覆發現：要麼工具夠安全但功能太弱，要麼功能夠強但讓普通用戶完全看不懂。更糟的是，當你問 ChatGPT「這個代幣安全嗎」，它根本沒有能力回答——因為它沒有接入鏈上的真實數據。",
    whyPara2: "Sakura 的答案是：把機構投資者才能獲得的信息能力，交給每一個持有 Phantom 錢包的人。不是訂閱制的月費平台，不是需要信任第三方保管資產的服務——而是一個真正屬於您的 Web3 原生工具。您的私鑰從不離開您的設備，您的每次 AI 諮詢都有鏈上記錄，您用多少付多少，沒有任何隱性成本。",
    whoTitle: "Sakura 為誰而生",
    whoItems: [
      { icon: "👤", title: "剛進入 DeFi 的新人", desc: "您看到一個代幣飛速上漲，群組裡所有人都說「趕緊上車」。但您不確定它是不是蜜罐。這正是 Sakura 誕生的原因——在您行動前，先告訴您真相。" },
      { icon: "📊", title: "深度 DeFi 研究者", desc: "您需要的不是泛泛的 AI 回答，而是 MACD/RSI/Fibonacci/Elliott Wave 六指標共振分析，以及真實鏈上數據支撐的聰明錢動向。Sakura 用機構級工具回應專業需求。" },
      { icon: "🐋", title: "跟單與聰明錢追蹤者", desc: "跟隨頂級 KOL 和 Whale 本身不是問題——盲目跟隨才是。Sakura 先跑 GoPlus 安全評分，評分 ≥ 70 才允許執行，把您從被惡意代幣設局的風險中拉出來。" },
      { icon: "⚙️", title: "重視收益效率的持有者", desc: "您的 USDC 躺在錢包裡一分錢收益都沒有，而 Kamino 的穩定幣池正在跑超過 8% APY。Sakura 的自主 Agent 會主動發現這個差距，並告訴您具體能多賺多少。" },
    ],
    diffTitle: "與眾不同在哪裡",
    diffSub: "下表是 Sakura 與一般 DeFi 工具或 AI 聊天機器人的功能對比。差距不在於介面，而在於底層數據與安全機制：",
    healthTitle: "持倉體檢",
    healthDesc: "大多數人從不知道自己的 DeFi 持倉有多脆弱。持倉體檢在 30 秒內給您的整個 Solana 錢包生成一份「健康報告」——不只是列出資產，而是診斷出您看不見的風險集中點，並直接告訴您怎麼優化。",
    healthBullets: [
      "資產配置評分（0-100）：識別單一代幣佔比過高等隱性風險",
      "閒置 USDC 偵測：計算錯過的年化收益，以 USDC 金額呈現",
      "多協議 APY 即時對比：Marinade、Jito、Kamino、Drift 並排比較",
      "健康分數歷史軌跡：每次體檢後留下時間戳記錄，清楚看到改善進展",
      "AI 優化建議：基於您的實際持倉，生成可直接執行的調整方案",
    ],
    securityTitle: "安全分析",
    securityDesc: "Solana 鏈上每天都有新代幣誕生，其中許多的唯一目的就是讓您的資金有去無回。在您花任何一分錢之前，Sakura 的安全分析會用 GoPlus 對目標代幣做 5 維度深度掃描——這正是一般 AI 聊天機器人永遠做不到的事，因為它們根本沒有接入真實鏈上數據。",
    securityBullets: [
      "增發權限（Mint Authority）：創辦人是否可以隨時增發、稀釋您的持倉？",
      "凍結權限（Freeze Authority）：合約是否有能力封鎖您的資金，讓您無法轉出？",
      "蜜罐偵測（Honeypot）：是否存在「只能買入、無法賣出」的陷阱機制？",
      "持幣集中度：前 10 大持有者的比例是否高到足以人為操控價格？",
      "流動性深度：滑點風險與池子深度分析，評估大額交易的實際成本",
    ],
    advisorTitle: "AI 顧問",
    advisorDesc: "問一個 AI「現在 Solana 的最佳 LST 是哪個？」大多數答案是過時的、缺乏數據的、或直接說「我不知道」。Sakura 的 AI 顧問在回答您的問題時，會實時調用鏈上數據、APY 比較、聰明錢動向——不是知識庫的靜態答案，而是此刻、針對您的持倉量身定制的建議。",
    advisorBullets: [
      "多輪對話記憶：持續追蹤對話脈絡，讓每一條建議都基於完整的背景",
      "實時工具調用：自動查詢代幣價格、各協議 APY、聰明錢共識買入信號",
      "快速操作面板：一鍵觸發持倉體檢、聰明錢追蹤、收益對比、安全掃描",
      "自然語言執行：直接說「把 50 SOL 換成 USDC」，自動觸發 Jupiter 最優報價",
      "三語無縫切換：繁體中文、English、日本語——您說哪種語言，它就用哪種回應",
    ],
    agentTitle: "自主再平衡 Agent",
    agentDesc: "您不需要知道該問什麼問題。自主 Agent 會主動掃描您整個錢包，找出每一個收益效率低下的持倉，量化「如果現在調整」能多賺多少年化 USDC，並給出一份可以直接一鍵執行的方案——全程不需要您的任何指示。",
    agentBullets: [
      "無提示自主掃描：沒有任何問題，Agent 自行完成全局分析",
      "年化增益量化：以具體 USDC 金額呈現切換協議後的預期收益差距",
      "Before / After 對比表：調整前後的年化收益清晰並排，讓決策有依據",
      "一鍵跨協議執行：Jupiter Swap → Marinade / Jito 質押 → Kamino 借貸，全部打通",
      "每次決策 SHA-256 上鏈：AI 的每一個推理步驟都有鏈上記錄，可獨立審計",
    ],
    smartTitle: "聰明錢追蹤",
    smartDesc: "市場上最有信息優勢的地址，往往在普通用戶看到任何跡象之前就已經完成佈局。Sakura 追蹤 30+ 個有公開標籤的 Solana 知名地址——KOL、大戶、Cabal 內部人——當多個頂級地址在 24 小時內同時買入同一代幣，我們稱之為「共識信號」。這不是預測，這是數據。",
    smartBullets: [
      "30+ 標籤地址庫：KOL 影響力 × Whale 體量 × Cabal 信息優勢，四類標籤全覆蓋",
      "24h 共識偵測算法：多個頂級地址同時買入 → 按標籤權重計算共識強度（1-5 星）",
      "評分邏輯透明：Cabal +2 分、Whale +2 分、KOL +1.5 分——分數如何算的一目瞭然",
      "Twitter 身份關聯：顯示每個地址對應的公開 Twitter（@handle），讓你知道跟的是誰",
      "安全閉環：共識代幣自動觸發 GoPlus 安全評分，好信號也要先過安全關",
    ],
    guardianTitle: "Guardian 自動監控",
    guardianDesc: "DeFi 市場 24 小時不停歇，但人不可能一直盯盤。Guardian 讓您設定一次規則，然後放心去做其他事情——無論是 SOL 跌破止損線、APY 突然暴跌、還是借貸倉位的健康係數告急，Guardian 都會在條件觸發的那一秒，替您執行您事先定義好的動作。",
    guardianBullets: [
      "價格觸發：SOL / 任何代幣跌破或突破指定價位時，通知或自動執行對衝",
      "APY 閾值：Kamino / Marinade APY 低於設定值，自動觸發再平衡",
      "借貸健康係數：Drift 倉位健康係數逼近清算線時，第一時間發出警報",
      "自動 Jupiter Swap：條件觸發後直接調用 Jupiter 完成換幣，無需您手動操作",
      "配置永久保存：Agent 設定寫入 localStorage，刷新頁面、重開瀏覽器都不會丟失",
    ],
    gmgnTitle: "GMGN 實時 K 線圖",
    gmgnDesc: "做任何交易決策前，K 線圖是不可缺少的。過去，Solana 用戶必須在不同網站之間反覆切換——GMGN 看聰明錢、DexScreener 看圖表、再回來執行交易。Sakura 把 GMGN 的真實 K 線數據直接嵌入應用，您的整個研究與執行流程，在同一個介面完成。",
    gmgnBullets: [
      "5 個時間框架：5m / 15m / 1h / 4h / 1d，快速切換捕捉不同週期的趨勢",
      "本地渲染引擎：基於 TradingView 開源 lightweight-charts，流暢無延遲",
      "服務端代理架構：繞過瀏覽器 CSP / CORS 限制，確保 GMGN 數據穩定可達",
      "選幣即更新：切換代幣分析目標，圖表立即重新加載對應 K 線數據",
      "零跳轉體驗：不再需要離開 Sakura，所有研究在同一個視窗完成",
    ],
    copyTitle: "複製交易",
    copyDesc: "跟隨聰明錢是合理的策略——前提是你跟的「聰明」，而不是跟進了一個惡意設局的代幣。Sakura 是業界唯一在複製交易執行前強制執行安全評分閘口的工具：GoPlus 評分低於 70 的代幣，無論哪個頂級地址在買，Sakura 都不允許您複製。",
    copyBullets: [
      "強制安全閘口：GoPlus 評分 ≥ 70 才解鎖複製按鈕，低分代幣直接攔截",
      "智能倉位比例：根據您的總持倉自動計算合理的跟單金額，防止過度集中",
      "透明確認卡片：執行前展示代幣名稱、安全評分、預計費用、滑點——沒有任何隱藏信息",
      "Phantom 自簽名：私鑰從不離開您的設備，Sakura 只生成交易指令，不代您執行",
    ],
    goplusTitle: "GoPlus Security — 鏈上安全的行業標準",
    goplusDesc: "GoPlus Security 是目前 Web3 安全領域覆蓋最廣的 API 提供商，支持超過 30 條鏈，每天處理數百萬次安全查詢請求。Sakura 深度整合 GoPlus Security API v2，在每次代幣分析中自動執行 5 維度評估，並將 0-100 的安全評分轉化為 AI 可讀的結構化數據，為倉位建議提供可量化的安全依據——而不是模糊的「看起來沒問題」。",
    heliusTitle: "Helius — Solana 最快的鏈上數據層",
    heliusDesc: "普通 Solana RPC 節點的交易數據是原始的、未解析的。Helius 的增強型 API 將每一筆鏈上交易分類解析——哪些是 SWAP？哪些是 NFT 鑄造？哪些是質押存入？Sakura 依賴 Helius 來識別聰明錢錢包的 24h 真實行為：不是看帳戶餘額，而是看他們在鏈上究竟做了什麼操作、買了哪些代幣、賣出了多少 SOL。",
    claudeTitle: "Claude Sonnet 4.6 — 業界最先進的 AI 推理引擎",
    claudeDesc: "Sakura 的 AI 能力由 Anthropic Claude Sonnet 4.6 驅動——這是目前在複雜指令跟隨、多步驟推理、工具調用方面綜合表現最強的 AI 模型之一。結合 Solana Agent Kit 的 11 個原生工具，Sakura 的 AI 不只是「聊天」，而是能主動調用鏈上 API、分析實時數據、生成可執行交易指令的行動主體。更重要的是：每次推理都有 SHA-256 哈希值記錄在 Solana 鏈上，讓 AI 的判斷過程對所有人透明可查。",
    ncTitle: "非託管設計 — 您的資產永遠屬於您",
    ncDesc: "「把資產交給平台」這件事，在 DeFi 歷史上已經造成過太多損失。Sakura 從設計的第一天就拒絕了這條路：我們不保管您的私鑰，不保管您的助記詞，不持有任何用戶資產。所有交易的最終簽名權，永遠在您的 Phantom 錢包裡。Sakura 的角色是分析師與規劃師——而不是保管人。這不是一個承諾，是我們在架構上的硬性約束。",
    x402Title: "x402 微支付 — 用多少付多少，沒有月費陷阱",
    x402Desc: "大多數 AI 工具要求您每月付費訂閱——無論您用了多少次，錢都扣了。Sakura 採用 HTTP 402 x402 標準微支付協議，真正按使用量計費。每項功能提供 3 次免費體驗，超出後每次僅需 $0.05–$0.10 USDC，通過 Phantom 在 Solana 上直接支付。沒有訂閱綁架，沒有自動續費，沒有任何隱藏費用。這才是 Web3 原生的付費方式。",
    startTitle: "五分鐘上手 Sakura",
    startSteps: [
      { n: "1", t: "安裝並準備 Phantom 錢包", d: "前往 phantom.app 安裝瀏覽器擴展。如果您已有錢包，直接導入助記詞即可。Phantom 是 Solana 生態使用最廣泛的非託管錢包。" },
      { n: "2", t: "一鍵連接，無需註冊", d: "點擊首頁的「連接 Phantom」。Sakura 只申請只讀權限——您的私鑰從不暴露，沒有任何資產被授權轉移。" },
      { n: "3", t: "先做一次持倉體檢", d: "在「持倉體檢」頁籤中，30 秒內獲得您整個 Solana 錢包的健康評分、風險預警與年化收益改善空間。這是最快了解自己 DeFi 現狀的方式。" },
      { n: "4", t: "買任何代幣前先做安全掃描", d: "在「安全分析」輸入代幣名稱或合約地址。GoPlus 5 維度掃描結果在幾秒內返回，清楚告訴您這個代幣有哪些具體風險。" },
      { n: "5", t: "用自然語言問 AI 顧問", d: "「現在最適合質押 SOL 的協議是哪個？」「BONK 最近聰明錢在買嗎？」用中文直接問，AI 顧問實時調用鏈上數據回答。" },
      { n: "6", t: "讓 Agent 替您找到被浪費的收益", d: "點擊「自主 Agent」，不需要問任何問題。等 30 秒，Agent 會告訴您現在的配置每年少賺了多少，並給出一鍵執行的優化方案。" },
    ],
  } : lang === "ja" ? {
    pageLabel: "ドキュメント",
    pageTitle: "Sakura ドキュメント",
    pageDesc: "すべてのDeFi判断は、正確な情報に基づくべきです。このドキュメントは、SakuraがどのようにAI、セキュリティ、オンチェーンデータを組み合わせてあなたのSolana資産を守り、増やすのかを完全に説明します。",
    statsLabel: "プラットフォームデータ",
    stats: [
      { v: "30+", l: "ラベル付きウォレット" },
      { v: "5", l: "GoPlusセキュリティ次元" },
      { v: "11", l: "SAK AIツール" },
      { v: "SHA-256", l: "AI推論オンチェーン記録" },
      { v: "3", l: "無料体験回数" },
    ],
    introTitle: "Sakuraとは何か",
    introDesc: "Solanaは世界で最も高速なブロックチェーンです。しかし速度は常に両刃の剣です。機会と詐欺は同じ速さで現れます。多くのユーザーは直感、友人の推薦、またはTwitterの匿名アカウントのシグナルに頼っています——それだけでは全く不十分です。Sakuraは、あなたが「トランザクションを確認」をクリックする前の一瞬に、人間が手動では到底できないセキュリティ審査、スマートマネー分析、収益計算を完了する、真のSolana AIアドバイザーです。",
    introPara2: "しかし、Sakuraが他のすべてのAIツールと根本的に異なるのは機能ではありません——信頼性です。すべてのAI推論結果はSHA-256ハッシュとして、Solana Memo Programを通じてオンチェーンに永久記録されます。AIが何を言ったか、いつ言ったか、どのデータに基づいて推論したかが、すべて証明可能です。約束ではなく、証明です。",
    diffLabel: "機能比較",
    whyTitle: "なぜSakuraを作ったのか",
    whyDesc: "DeFi市場では毎年、詐欺トークン、ハニーポット、情報の非対称性によって多くの資産が失われています。そしてこれらの損失の多くは、適切なツールがあれば5秒以内に防げたはずです。私たちは様々なDeFiツールを使い続ける中で繰り返し発見しました：ツールが安全すぎて機能が弱い、または機能が強すぎて普通のユーザーには理解できない。さらに悪いことに、ChatGPTに「このトークンは安全ですか」と聞いても、リアルタイムのオンチェーンデータにアクセスできないため、まともな答えは返ってきません。",
    whyPara2: "Sakuraの答えはシンプルです：機関投資家だけが持てた情報力を、Phantomウォレットを持つすべての人に届けること。月額課金のSaaSではなく、資産を第三者に預ける必要もない——真にあなたのものであるWeb3ネイティブツールを作りました。秘密鍵はデバイスから離れず、AI相談はオンチェーン記録され、使った分だけ支払う。隠れたコストは一切ありません。",
    whoTitle: "誰のためのツールか",
    whoItems: [
      { icon: "👤", title: "DeFiを始めたばかりの方", desc: "急騰するトークンを見て、みんなが「今すぐ買え」と言っている。でもそれがハニーポットかもしれない。Sakuraはあなたが行動する前に真実を教えます。" },
      { icon: "📊", title: "深度のあるDeFiリサーチャー", desc: "漠然としたAIの回答ではなく、MACD/RSI/Fibonacci/Elliott Waveの6指標共鳴分析と、リアルなオンチェーンデータに裏付けられたスマートマネーの動向が必要な方。" },
      { icon: "🐋", title: "コピートレーダー", desc: "トップKOLやWhaleをフォローすること自体は合理的な戦略です。問題は盲目的なフォローです。SakuraはGoPlus安全スコア ≥ 70のトークンのみコピーを許可し、悪意のある設局からあなたを守ります。" },
      { icon: "⚙️", title: "収益効率を重視するホルダー", desc: "あなたのUSDCは財布に眠ったまま何も生んでいないのに、Kaminoのステーブルコインプールは8%以上のAPYを走っています。SakuraのAutonomous Agentがそのギャップを見つけ、具体的にいくら多く稼げるかを教えます。" },
    ],
    diffTitle: "何が違うのか",
    diffSub: "以下の表は、Sakuraと一般的なDeFiツールまたはAIチャットボットの機能比較です。差は表面ではなく、基盤となるデータとセキュリティメカニズムにあります：",
    healthTitle: "ポートフォリオ診断",
    healthDesc: "ほとんどの人は、自分のDeFiポジションがどれほど脆弱かを知りません。ポートフォリオ診断は30秒以内に、あなたのSolanaウォレット全体の「健康レポート」を生成します——資産を列挙するだけでなく、見えないリスク集中を診断し、具体的な最適化方法を直接提示します。",
    healthBullets: [
      "資産配分スコア（0-100）：単一トークンの過剰集中などの潜在リスクを特定",
      "遊休USDC検出：機会損失を年間USDC金額で換算して表示",
      "マルチプロトコルAPYリアルタイム比較：Marinade、Jito、Kamino、Driftを並列比較",
      "健康スコア履歴トラッキング：診断ごとにタイムスタンプ付きで記録し、改善経緯を可視化",
      "AI最適化提案：実際の保有状況に基づき、直接実行可能な調整プランを生成",
    ],
    securityTitle: "セキュリティ分析",
    securityDesc: "Solanaチェーンでは毎日新しいトークンが生まれ、その多くの唯一の目的はあなたの資産を奪うことです。一円も使う前に、SakuraのセキュリティアナリシスがGoPlus APIで対象トークンに5次元の深度スキャンを実行します——これは一般的なAIチャットボットには絶対にできないことです。なぜなら、彼らはリアルタイムのオンチェーンデータにアクセスできないからです。",
    securityBullets: [
      "発行権限（Mint Authority）：開発者がいつでも無制限に増発してあなたの持分を希薄化できるか？",
      "凍結権限（Freeze Authority）：コントラクトがあなたのトークンを封鎖して転出不能にできるか？",
      "ハニーポット検出：「購入のみで売却不可」という罠メカニズムが存在するか？",
      "保有集中度：上位10保有者の比率は価格操作を可能にするほど高いか？",
      "流動性深度：スリッページリスクとプール深度分析で大口取引の実際のコストを評価",
    ],
    advisorTitle: "AIアドバイザー",
    advisorDesc: "「今のSolanaで最も良いLSTは何ですか？」と一般的なAIに聞くと、古い情報か、「わかりません」という答えが返ってきます。SakuraのAIアドバイザーはあなたの質問に答える際、オンチェーンデータ、APY比較、スマートマネー動向をリアルタイムで呼び出します——知識ベースの静的な答えではなく、今この瞬間、あなたの保有状況に合わせた具体的なアドバイスを提供します。",
    advisorBullets: [
      "マルチターン会話記憶：会話の文脈を継続追跡し、一貫性のある深いアドバイスを実現",
      "リアルタイムツール呼び出し：トークン価格、各プロトコルAPY、スマートマネーコンセンサスシグナルを自動照会",
      "クイックアクションパネル：ポートフォリオ診断、スマートマネー追跡、収益比較、セキュリティスキャンをワンクリック起動",
      "自然言語実行：「50 SOLをUSDCに換える」と言うだけでJupiter最適見積もりを即時起動",
      "3言語シームレス切替：繁体字中国語、English、日本語——どの言語で話しかけても自然に応答",
    ],
    agentTitle: "自律リバランスエージェント",
    agentDesc: "何を聞けばいいかを知っている必要はありません。自律エージェントはあなたのウォレット全体を能動的にスキャンし、収益効率の低いポジションをすべて特定し、「今調整したら年間でいくら多く稼げるか」を定量化し、ワンクリックで実行できるプランを提示します——すべてあなたの指示なしに。",
    agentBullets: [
      "プロンプト不要の自律スキャン：質問ゼロでグローバル分析を自動完了",
      "年間増益の定量化：プロトコル切替後の期待収益差をUSDB具体金額で提示",
      "Before / After比較表：調整前後の年間収益を並べて表示し、意思決定に根拠を",
      "クロスプロトコルワンクリック実行：Jupiter Swap → Marinade/Jitoステーキング → Kaminoレンディングを完全接続",
      "全判断SHA-256オンチェーン記録：AIの各推論ステップがチェーンに記録され、独立監査が可能",
    ],
    smartTitle: "スマートマネー追跡",
    smartDesc: "市場で最も情報優位を持つアドレスは、普通のユーザーが何かに気付く前にすでにポジションを取っています。Sakuraは公開ラベルのある30以上の著名Solanaアドレスを追跡します——KOL、大口ホルダー、Cabalインサイダー。24時間以内に複数のトップアドレスが同じトークンを同時購入すると、私たちはそれを「コンセンサスシグナル」と呼びます。予測ではなく、データです。",
    smartBullets: [
      "30以上のラベル付きアドレスDB：KOLの影響力 × Whaleの資金力 × Cabalの情報優位、4カテゴリ完全網羅",
      "24hコンセンサス検出アルゴリズム：複数トップアドレスが同時購入 → ラベル重み付けでコンセンサス強度を算出（1-5星）",
      "スコアリングロジックの透明性：Cabal +2点、Whale +2点、KOL +1.5点——計算根拠を完全公開",
      "Twitter身元連携：各アドレスに対応する公開Twitter（@ハンドル）を表示、誰をフォローしているかを明確に",
      "セキュリティ閉ループ：コンセンサストークンが自動的にGoPlus安全スコアをトリガー——良いシグナルも安全審査を通過させる",
    ],
    guardianTitle: "Guardian 自動監視",
    guardianDesc: "DeFi市場は24時間止まりません。しかし人間はずっとチャートを見続けることができません。Guardianは一度ルールを設定すれば、後は安心して他のことができます。SOLがストップロスラインを下回ったとき、APYが急落したとき、レンディングポジションの健康係数が危険水域に入ったとき——Guardianは条件がトリガーされたその秒に、あなたが事前に定義したアクションを実行します。",
    guardianBullets: [
      "価格トリガー：SOL/任意トークンが指定価格を下回るか上回った際、通知または自動ヘッジ実行",
      "APY閾値：Kamino/Marinade APYが設定値を下回った場合、自動リバランスをトリガー",
      "借入健康係数：Driftポジションが清算ラインに近づいた際、即座にアラート発報",
      "自動Jupiterスワップ：条件トリガー後にJupiterを直接呼び出してスワップを完了、手動操作不要",
      "設定の永続保存：エージェント設定はlocalStorageに書き込まれ、ページ更新・ブラウザ再起動後も消えない",
    ],
    gmgnTitle: "GMGNリアルタイムKラインチャート",
    gmgnDesc: "取引判断を行う前に、チャートは欠かせません。以前はSolanaユーザーは複数のサイトを行き来しなければなりませんでした——GMGNでスマートマネーを確認し、DexScreenerでチャートを見て、戻ってきてトレード実行。SakuraはGMGNのリアルKラインデータをアプリに直接埋め込み、リサーチから実行までの全フローを同一画面で完結させます。",
    gmgnBullets: [
      "5時間軸：5m / 15m / 1h / 4h / 1d、異なる時間軸のトレンドをすばやく切替で捕捉",
      "ローカルレンダリングエンジン：TradingViewオープンソースlightweight-chartsで、スムーズなラグなし表示",
      "サーバーサイドプロキシアーキテクチャ：ブラウザのCSP/CORS制限を回避し、GMGNデータへの安定アクセスを確保",
      "トークン選択即更新：分析対象トークンを切り替えると、チャートが即座に対応するKラインデータをリロード",
      "ゼロ切替体験：Sakuraを離れる必要なし、すべてのリサーチを同一ウィンドウで完了",
    ],
    copyTitle: "コピートレード",
    copyDesc: "スマートマネーをフォローすることは合理的な戦略です——前提は、悪意ある設局のトークンにフォローで巻き込まれないことです。Sakuraは業界唯一、コピートレード実行前に安全スコアゲートを強制するツールです：GoPlus スコアが70を下回るトークンは、どのトップアドレスが買っていても、Sakuraはコピーを許可しません。",
    copyBullets: [
      "強制安全ゲート：GoPlus スコア ≥ 70のみコピーボタンを解除、低スコアトークンは直接ブロック",
      "スマートポジションサイジング：総保有量に基づいて適切なフォロー金額を自動計算、過剰集中を防止",
      "透明な確認カード：実行前にトークン名、安全スコア、推定手数料、スリッページを表示——隠し情報ゼロ",
      "Phantom自己署名：秘密鍵はデバイスから離れず、Sakuraはトランザクション命令を生成するのみ",
    ],
    goplusTitle: "GoPlus Security — オンチェーンセキュリティの業界標準",
    goplusDesc: "GoPlus Securityは現在Web3セキュリティ分野で最も幅広いカバレッジを持つAPIプロバイダーで、30以上のチェーンをサポートし、毎日数百万回のセキュリティクエリを処理しています。SakuraはGoPlus Security API v2を深く統合し、各トークン分析で5次元評価を自動実行、0-100の安全スコアをAI可読の構造化データに変換して、ポジション提案に定量的なセキュリティ根拠を提供します——漠然とした「問題なさそう」ではなく。",
    heliusTitle: "Helius — Solana最速のオンチェーンデータ層",
    heliusDesc: "通常のSolana RPCノードのトランザクションデータは生のまま解析されていません。HeliusのEnhanced APIはすべてのオンチェーントランザクションを分類解析します——どれがSWAPで、どれがNFTミントで、どれがステーキング入金か。Sakuraはスマートマネーウォレットの24h実際の行動を識別するためにHeliusを使用します：アカウント残高を見るのではなく、彼らがオンチェーンで実際に何をしたか、どのトークンを買ったか、どれだけのSOLを売ったかを追います。",
    claudeTitle: "Claude Sonnet 4.6 — 業界最先端のAI推論エンジン",
    claudeDesc: "SakuraのAI能力はAnthropic Claude Sonnet 4.6によって駆動されています——現在、複雑な指示フォロー、多段階推論、ツール呼び出しにおいて総合的に最高パフォーマンスを誇るAIモデルの一つです。Solana Agent Kitの11のネイティブツールと組み合わせることで、SakuraのAIは単なる「チャット」ではなく、オンチェーンAPIを能動的に呼び出し、リアルタイムデータを分析し、実行可能なトランザクション命令を生成するアクションエージェントとして機能します。さらに重要なことに：すべての推論はSHA-256ハッシュ値としてSolanaチェーンに記録され、AIの判断プロセスが誰にでも透明に確認できます。",
    ncTitle: "非カストディアル設計 — あなたの資産は永遠にあなたのもの",
    ncDesc: "「資産をプラットフォームに預ける」という行為は、DeFiの歴史において何度も甚大な損失を生んできました。Sakuraは設計の初日からその道を拒否しました：秘密鍵を保管しない、シードフレーズを保管しない、ユーザー資産を一切保有しない。すべてのトランザクションの最終署名権は、常にあなたのPhantomウォレットにあります。Sakuraの役割はアナリストとプランナーであり、保管者ではありません。これは約束ではなく、アーキテクチャ上のハード制約です。",
    x402Title: "x402マイクロペイメント — 使った分だけ支払い、月額の罠なし",
    x402Desc: "ほとんどのAIツールは月額サブスクリプションを要求します——どれだけ使っても、使わなくても料金は引き落とされます。SakuraはHTTP 402 x402標準マイクロペイメントプロトコルを採用し、真の使用量課金を実現します。各機能は3回の無料体験を提供し、超過後は$0.05–$0.10 USDCのみ必要で、Phantom経由でSolana上で直接支払います。サブスクリプションの束縛なし、自動更新なし、隠れた手数料なし。これが真のWeb3ネイティブな支払い方法です。",
    startTitle: "5分でSakuraを使い始める",
    startSteps: [
      { n: "1", t: "Phantomウォレットをインストール", d: "phantom.appにアクセスしてブラウザ拡張機能をインストール。既存のウォレットがあればシードフレーズをインポートするだけです。PhantomはSolanaエコシステムで最も広く使われている非カストディアルウォレットです。" },
      { n: "2", t: "ワンクリック接続、登録不要", d: "ホームページの「Phantomを接続」をクリック。Sakuraは読み取り専用権限のみ要求します——秘密鍵は公開されず、資産移転の認証も不要です。" },
      { n: "3", t: "まずポートフォリオ診断を実行", d: "「ポートフォリオ診断」タブで30秒以内に、Solanaウォレット全体の健康スコア、リスク警告、年間収益改善余地を確認。自分のDeFi現状を最速で把握する方法です。" },
      { n: "4", t: "トークンを買う前に必ずセキュリティスキャン", d: "「セキュリティ分析」にトークン名またはコントラクトアドレスを入力。GoPlus 5次元スキャン結果が数秒で返り、具体的なリスクを明確に告知します。" },
      { n: "5", t: "AIアドバイザーに自然言語で質問", d: "「今SOLをステーキングするなら最適なプロトコルはどこですか？」「BONKに最近スマートマネーが入っていますか？」日本語でそのまま質問できます。AIアドバイザーはオンチェーンデータをリアルタイムで参照して回答します。" },
      { n: "6", t: "Agentに見落とした収益を見つけてもらう", d: "「自律エージェント」をクリック、質問は何もしなくていいです。30秒待つとAgentが今の配分で年間いくら損失しているかを教え、ワンクリックで実行できる最適化プランを提示します。" },
    ],
  } : {
    pageLabel: "Documentation",
    pageTitle: "Sakura Documentation",
    pageDesc: "Every DeFi decision deserves more than a gut feeling. This guide explains precisely how Sakura uses AI, security data, and on-chain proof to protect and grow every dollar you hold on Solana.",
    statsLabel: "Platform At a Glance",
    stats: [
      { v: "30+", l: "Labeled Smart Wallets" },
      { v: "5", l: "GoPlus Security Dims" },
      { v: "11", l: "SAK AI Tools" },
      { v: "SHA-256", l: "AI Reasoning On-Chain" },
      { v: "3", l: "Free Uses / Feature" },
    ],
    introTitle: "What Sakura Is",
    introDesc: "Solana is the world's fastest blockchain. Speed, however, is always a double-edged sword. Opportunities and scams arrive at the same velocity. Most users rely on intuition, friends' recommendations, or anonymous accounts shouting on Twitter — none of which is nearly enough. Sakura is an AI advisor that genuinely understands Solana. In the fraction of a second before you click \"Confirm Transaction,\" it has already completed the security audit, smart money cross-check, and yield calculation that no human could do manually.",
    introPara2: "But Sakura's most fundamental difference from every other AI tool isn't features — it's accountability. Every AI reasoning result is written on-chain as a SHA-256 hash via Solana Memo Program. That means what the AI said, when it said it, and what data it reasoned from are all permanently provable. Anyone can independently verify the complete reasoning process. Not a promise. Proof.",
    diffLabel: "Capability Comparison",
    whyTitle: "Why We Built Sakura",
    whyDesc: "DeFi markets lose enormous sums each year to scam tokens, honeypot traps, and information asymmetry — and a significant share of those losses could have been stopped in under five seconds by the right tool. Working across DeFi products, we kept finding the same frustrating pattern: tools that are safe enough but too weak, or powerful enough but completely incomprehensible to most users. Worse, when you ask ChatGPT \"Is this token safe?\" it simply can't answer — because it has no access to real-time on-chain data.",
    whyPara2: "Sakura's answer is straightforward: give every person holding a Phantom wallet the information power that used to belong only to institutional investors. Not a subscription SaaS platform. Not a service that requires trusting a third party with your assets. A tool that is truly yours — your keys never leave your device, your AI consultations are recorded on-chain, and you pay only for what you use. No hidden costs. No lock-in.",
    whoTitle: "Who Sakura Is For",
    whoItems: [
      { icon: "👤", title: "New to DeFi", desc: "You see a token mooning, everyone in the group is saying \"get in now\" — but you're not sure if it's a honeypot. Sakura was built for exactly this moment: to tell you the truth before you act." },
      { icon: "📊", title: "Serious DeFi Researchers", desc: "You don't want vague AI opinions. You need 6-indicator confluence analysis (MACD / RSI / Bollinger / OBV / Fibonacci / Elliott Wave) and smart money signals backed by real on-chain data. Sakura responds to professional demand with institutional-grade tools." },
      { icon: "🐋", title: "Copy Traders", desc: "Following top KOLs and Whales is a legitimate strategy — until you blindly follow one into a malicious token. Sakura is the only copy trading tool that requires GoPlus score ≥ 70 before any copy executes, pulling you back from the edge of loss." },
      { icon: "⚙️", title: "Yield Efficiency Seekers", desc: "Your USDC is sitting in your wallet earning nothing, while Kamino's stablecoin pool is running above 8% APY. Sakura's Autonomous Agent finds that gap proactively — and tells you exactly, in dollar terms, how much more you could be earning right now." },
    ],
    diffTitle: "What Makes Sakura Different",
    diffSub: "The table below compares Sakura against generic DeFi tools or AI chatbots. The gap isn't in the interface — it's in the underlying data pipeline and security architecture:",
    healthTitle: "Portfolio Health Check",
    healthDesc: "Most people have no idea how fragile their DeFi positions actually are. The Portfolio Health Check generates a full \"health report\" for your entire Solana wallet in 30 seconds — not just a list of assets, but a diagnosis of invisible risk concentrations, with specific optimization actions that you can act on immediately.",
    healthBullets: [
      "Asset allocation score (0–100): flags dangerous over-concentration in a single token",
      "Idle USDC detection: calculates the annual yield you're leaving on the table, in USDC terms",
      "Multi-protocol APY live comparison: Marinade, Jito, Kamino, and Drift side-by-side",
      "Health score history: timestamp-logged across check-ups so you can track improvement over time",
      "AI optimization plan: generates a directly actionable rebalancing recommendation based on your real holdings",
    ],
    securityTitle: "Security Analysis",
    securityDesc: "New tokens launch on Solana every day. Many of them have one purpose: to make your funds disappear permanently. Before you spend a single cent, Sakura's Security Analysis runs a 5-dimension deep scan via GoPlus API — something a generic AI chatbot is simply incapable of, because it has no access to real-time on-chain data.",
    securityBullets: [
      "Mint Authority: can the developer inflate supply at will, diluting your position to near-zero?",
      "Freeze Authority: can the contract lock your tokens, making it impossible to transfer or sell?",
      "Honeypot Detection: is there a \"buy-only, no-sell\" trap mechanism built into the contract?",
      "Holder Concentration: is the top-10 holder percentage high enough to enable price manipulation?",
      "Liquidity Depth: slippage risk and pool depth analysis to calculate the true cost of large trades",
    ],
    advisorTitle: "AI Advisor",
    advisorDesc: "Ask a generic AI \"What's the best LST on Solana right now?\" and you'll get a stale answer, a hallucination, or a polite \"I'm not sure.\" Sakura's AI Advisor calls live on-chain data, real-time APY feeds, and smart money consensus signals while forming its response — not a static knowledge base, but a real-time, portfolio-aware recommendation engine built for exactly your situation.",
    advisorBullets: [
      "Multi-turn memory: continuously tracks conversation context for coherent, contextual advice across sessions",
      "Live tool invocations: automatically queries token prices, protocol APYs, on-chain data, and smart money consensus",
      "Quick action panel: one-click triggers for health check, smart money tracking, yield comparison, and security scan",
      "Natural language execution: say \"swap 50 SOL to USDC\" — Sakura surfaces the optimal Jupiter quote immediately",
      "Trilingual switching: Traditional Chinese, English, Japanese — respond in whichever language you prefer",
    ],
    agentTitle: "Autonomous Rebalance Agent",
    agentDesc: "You don't need to know what questions to ask. The Autonomous Agent proactively scans your entire wallet, identifies every yield-inefficient position, quantifies how much more you'd earn annually if you optimized right now, and delivers a one-click execution plan — all without a single prompt from you.",
    agentBullets: [
      "Zero-prompt autonomous scan: no questions required — the Agent completes full global analysis on its own",
      "Annual yield delta quantified: shows the expected income difference in USDC if you switch to optimal protocols",
      "Before / After comparison table: pre- and post-rebalance annual yield shown side-by-side for evidence-based decisions",
      "Cross-protocol one-click execution: Jupiter Swap → Marinade/Jito staking → Kamino lending, fully connected",
      "Every decision SHA-256 on-chain: each Agent reasoning step recorded on Solana for independent audit",
    ],
    smartTitle: "Smart Money Tracker",
    smartDesc: "The addresses with the greatest information advantage in the market have already taken their positions before ordinary users see any signal. Sakura tracks 30+ publicly labeled Solana addresses — KOLs, large holders, Cabal insiders. When multiple top addresses buy the same token within 24 hours, we call that a consensus signal. Not a prediction. Data.",
    smartBullets: [
      "30+ labeled address database: KOL influence × Whale capital × Cabal information edge — 4 categories fully covered",
      "24h consensus detection algorithm: multiple top addresses buying simultaneously → consensus strength scored by label weight (1–5 stars)",
      "Transparent scoring logic: Cabal +2, Whale +2, KOL +1.5 — every calculation is visible, nothing hidden",
      "Twitter identity linked: each address shows its associated public Twitter (@handle) so you know exactly who you're following",
      "Security closed loop: consensus tokens automatically trigger GoPlus safety scoring — good signals still go through the gate",
    ],
    guardianTitle: "Guardian Auto-Monitor",
    guardianDesc: "DeFi markets run 24/7. Humans can't stare at charts forever. Set Guardian rules once and go live your life. Whether SOL breaks your stop-loss, your APY collapses, or your lending health factor enters the danger zone — Guardian fires the moment the condition triggers and executes exactly what you pre-defined.",
    guardianBullets: [
      "Price triggers: notify or auto-execute a hedge when SOL / any token breaks above or below your target",
      "APY threshold: auto-rebalance when Kamino or Marinade APY dips below your floor",
      "Lending health factor: instant alert when your Drift position approaches the liquidation boundary",
      "Automated Jupiter swap: execute the trade directly via Jupiter when conditions fire — no manual step needed",
      "Config lives forever: Agent settings written to localStorage — survives page refreshes, browser restarts, everything",
    ],
    gmgnTitle: "GMGN Live K-Line Chart",
    gmgnDesc: "No trade decision should happen without a chart. Previously, Solana users had to jump between tabs — GMGN for smart money, DexScreener for charts, back to execute the trade. Sakura embeds real GMGN K-line data directly inside the app. Your entire research and execution workflow completes in one window, without ever leaving.",
    gmgnBullets: [
      "5 timeframes: 5m / 15m / 1h / 4h / 1d — quickly switch to capture trends across different cycles",
      "Local rendering engine: TradingView open-source lightweight-charts, smooth and lag-free",
      "Server-side proxy architecture: bypasses browser CSP/CORS restrictions to ensure stable GMGN data access",
      "Select token, chart updates: switch your analysis target and the K-line data reloads instantly",
      "Zero-tab workflow: no need to leave Sakura — every part of your research happens in the same window",
    ],
    copyTitle: "Copy Trade",
    copyDesc: "Following smart money is a legitimate strategy — until you blindly follow one into a malicious token. Sakura is the only copy trading tool in the industry that enforces a mandatory security gate before any copy executes: GoPlus score below 70 means the trade doesn't happen, regardless of which top wallet is buying.",
    copyBullets: [
      "Mandatory security gate: GoPlus score ≥ 70 unlocks the copy button; low-score tokens are blocked at the source",
      "Smart position sizing: auto-calculates an appropriate copy amount based on your total portfolio, preventing over-concentration",
      "Transparent confirmation card: shows token name, safety score, estimated fees, and slippage before execution — nothing hidden",
      "Phantom self-signature: your keys never leave your device; Sakura generates the instruction only, never executes for you",
    ],
    goplusTitle: "GoPlus Security — The Industry Standard for On-Chain Safety",
    goplusDesc: "GoPlus Security is currently the most widely covered API provider in the Web3 security space, supporting 30+ chains and processing millions of security queries daily. Sakura deeply integrates GoPlus Security API v2, automatically running 5-dimension assessments on every token analysis and converting the 0–100 safety score into AI-readable structured data — enabling quantifiable security reasoning for position recommendations, not a vague \"looks okay.\"",
    heliusTitle: "Helius — Solana's Fastest On-Chain Data Layer",
    heliusDesc: "Standard Solana RPC nodes return raw, unparsed transaction data. Helius Enhanced API categorizes and parses every on-chain transaction — which are SWAPs, which are NFT mints, which are staking deposits. Sakura relies on Helius to identify the 24h real behavior of smart money wallets: not looking at account balances, but tracking what they actually did on-chain — which tokens they bought and how much SOL they moved.",
    claudeTitle: "Claude Sonnet 4.6 — The Most Advanced AI Reasoning Engine Available",
    claudeDesc: "Sakura's AI capability is driven by Anthropic's Claude Sonnet 4.6 — currently one of the top-performing models in complex instruction following, multi-step reasoning, and tool invocation. Combined with 11 native Solana Agent Kit tools, Sakura's AI isn't just \"chat\" — it's an action agent that proactively calls on-chain APIs, analyzes real-time data, and generates executable transaction instructions. Most critically: every reasoning step generates a SHA-256 hash recorded on Solana, making the AI's decision process fully transparent and auditable by anyone.",
    ncTitle: "Non-Custodial Architecture — Your Assets Are Always Yours",
    ncDesc: "\"Handing assets to a platform\" has caused catastrophic losses across DeFi history. Sakura rejected that path from day one: we don't hold your private keys, your seed phrase, or any user assets. The final signing authority for every transaction lives permanently in your Phantom wallet. Sakura's role is analyst and planner — never custodian. This isn't a promise. It's a hard architectural constraint.",
    x402Title: "x402 Micropayments — Pay for What You Use, No Subscription Traps",
    x402Desc: "Most AI tools demand a monthly subscription — whether you use it once or a hundred times, the charge comes through. Sakura adopts the HTTP 402 x402 standard micropayment protocol for true usage-based billing. Every feature offers 3 free uses. After that, just $0.05–$0.10 USDC per use, paid directly via Phantom on Solana. No subscription lock-in. No auto-renewal. No hidden fees. This is what Web3-native payment actually looks like.",
    startTitle: "Up and Running in Five Minutes",
    startSteps: [
      { n: "1", t: "Install and Set Up Phantom", d: "Go to phantom.app and install the browser extension. If you already have a wallet, just import your seed phrase. Phantom is the most widely used non-custodial wallet in the Solana ecosystem." },
      { n: "2", t: "Connect in One Click — No Sign-Up", d: "Click \"Connect Phantom\" on the homepage. Sakura requests read-only permission only — your private key is never exposed, and no asset transfer authorization is needed." },
      { n: "3", t: "Start with a Portfolio Health Check", d: "In the Portfolio Health tab, get your entire Solana wallet's health score, risk flags, and annual yield improvement potential in 30 seconds. The fastest way to understand your DeFi situation right now." },
      { n: "4", t: "Scan Every Token Before You Buy", d: "In Security Analysis, type any token name or contract address. GoPlus 5-dimension results return in seconds, clearly identifying every specific risk the token carries." },
      { n: "5", t: "Ask the AI Advisor in Plain Language", d: "\"What's the best protocol for staking SOL right now?\" \"Has smart money been buying BONK recently?\" Just ask in English. The AI Advisor calls live on-chain data to answer." },
      { n: "6", t: "Let the Agent Find Your Lost Yield", d: "Click Autonomous Agent. No questions needed. In 30 seconds, the Agent tells you how much annual yield your current allocation is costing you — then gives you a one-click plan to fix it." },
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
            borderLeft: "3px solid var(--accent)", padding: "16px 24px",
            background: "var(--accent-soft)", borderRadius: "0 10px 10px 0",
            marginBottom: 48,
          }}>
            <p style={{
              margin: 0, fontSize: 16, fontStyle: "italic",
              color: "var(--text-primary)", lineHeight: 1.8, fontFamily: "var(--font-heading)",
              fontWeight: 300, letterSpacing: "0.01em",
            }}>
              {lang === "zh"
                ? "「AI 說了什麼，應該要可以被證明。Sakura 是第一個把這件事做到的 Solana DeFi 顧問。」"
                : lang === "ja"
                ? "「AIが何を言ったかは、証明できるべきです。SakuraはそれをSolana DeFiアドバイザーとして初めて実現しました。」"
                : "\"What an AI says should be provable. Sakura is the first Solana DeFi advisor to make that a reality.\""}
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
