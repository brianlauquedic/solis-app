"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useLang } from "@/contexts/LanguageContext";
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
      "單一代幣超過持倉 40%——系統自動標記，並告訴你這個集中度在真實行情下意味著什麼",
      "閒置 USDC 的機會損失以具體金額呈現——不是百分比，是你每天少賺的那幾塊錢",
      "Marinade、Jito、Kamino、Drift 的當前 APY 並排顯示，最優選擇一目瞭然",
      "每次體檢的健康分數帶時間戳留存——六個月後你能清楚看到自己的改善軌跡",
      "AI 根據你的真實持倉生成可直接操作的調整清單，不是「建議分散投資」這種廢話",
    ],
    securityTitle: "安全分析",
    securityDesc: "蜜罐代幣不會在合約裡寫「這是騙局」。它外觀正常，有流動性，有交易量——直到你想賣的那一刻，你才發現賣出函數被鎖死了。GoPlus 的掃描在代幣上線的第一秒就能識別這些機制。Sakura 把這個能力放在你每一次交易之前——不需要你懂合約，只需要你點一下「分析」。",
    securityBullets: [
      "增發權限：創辦人可以在你買入後印更多代幣稀釋你的份額嗎？這一項直接決定代幣有沒有持有價值",
      "凍結權限：你的資金能被項目方一鍵鎖死、讓你永遠無法轉出嗎？這一項通常最致命",
      "蜜罐機制：有些代幣只能買入、永遠無法賣出——GoPlus 在你花一分錢之前識別它",
      "前 10 持有者佔比過高意味著少數人可以人為控盤，你的資金成為他們的退出流動性",
      "你準備買入的數量，真實滑點成本是多少——池子夠深嗎？系統直接給你答案",
    ],
    advisorTitle: "AI 顧問",
    advisorDesc: "你問一個問題，希望得到一個真實的答案，而不是 AI 背出來的段落。Sakura 的 AI 顧問在回答之前，會先去查：Kamino 現在的實際 APY 是多少？今天有哪些聰明錢地址在動 SOL？你說的那個代幣，鏈上最近 24 小時發生了什麼？你得到的答案，是基於此刻數據的判斷——不是六個月前訓練集裡的結論。",
    advisorBullets: [
      "記住你說過什麼——下一個問題不需要重新解釋背景，AI 始終知道你在問什麼的前後脈絡",
      "回答問題之前先查數據——你得到的是此刻的 APY、此刻的聰明錢動向，不是六個月前的記憶",
      "持倉體檢、聰明錢、收益對比、安全掃描——一鍵觸發，不需要在功能頁面之間來回切換",
      "直接說「把 50 SOL 換成 USDC」——Jupiter 的最優報價立刻出現，不需要學任何指令語法",
      "你用哪種語言說話，它就用哪種語言回答——繁體中文、英文、日文，無需切換任何設定",
    ],
    agentTitle: "自主再平衡 Agent",
    agentDesc: "再平衡這件事，大多數人知道應該做，但一直沒做。不是懶，是卡在一個合理的問題裡：從哪裡開始？換哪個協議？手續費划不划算？自主 Agent 的設計就是把這個問題連根拔起：不需要你問任何問題，它掃描你的整個錢包，找出效率低下的持倉，用 USDC 金額告訴你「現在優化，每年多賺多少」，再給你一鍵執行的方案。你要做的，只是確認。",
    agentBullets: [
      "什麼問題都不需要問——點擊啟動，Agent 自己完成對你整個錢包的全局分析",
      "「現在優化，每年多賺 $X USDC」——以具體金額呈現，不是百分比，讓你清楚知道機會成本",
      "調整前後的年化預期並排顯示——要不要動，讓數字說話，不讓感覺說話",
      "從 Jupiter Swap 到 Marinade 質押到 Kamino 借貸——整條執行鏈一鍵打通，你不需要跳轉任何地方",
      "Agent 每一步推理都有 SHA-256 記錄在 Solana 鏈上——決策做完之後，你仍然可以獨立審計它的依據",
    ],
    smartTitle: "聰明錢追蹤",
    smartDesc: "聰明錢地址在任何公告之前，就已經開始買了。這不是陰謀論，這是鏈上數據的事實：那 30+ 個有標籤的地址——KOL、Whale、Cabal——他們的每一筆交易都是公開的，只是沒有人在系統性地追蹤。Sakura 替你追蹤。當多個頂級地址在 24 小時內同時買入同一代幣，那個信號出現在你面前——不是謠言，是鏈上記錄。",
    smartBullets: [
      "30 個以上有公開標籤的頂級地址——KOL 的影響力、Whale 的資金量、Cabal 的信息優勢，一個都不漏",
      "多個頂級地址 24 小時內同時買入同一代幣——共識強度自動加權計算，以 1-5 星清楚呈現",
      "評分不是黑箱：Cabal +2、Whale +2、KOL +1.5——你知道那顆星究竟是怎麼來的",
      "每個地址對應的 Twitter（@handle）直接顯示——你跟的不是一串匿名地址，是一個有公開身份的人",
      "共識信號再強，也要先通過安全閘口——系統自動對每個共識代幣觸發 GoPlus 評分",
    ],
    guardianTitle: "Guardian 自動監控",
    guardianDesc: "你不可能 24 小時盯盤。但市場不知道你什麼時候睡覺。Guardian 的設計前提很簡單：你比任何人都清楚自己的風險邊界——SOL 跌到多少你要動，APY 降到多少你要換，借貸健康係數低到多少你要補倉。你只需要說一次，Guardian 記住它，在那一刻到來的時候，替你執行你本來要做的事。",
    guardianBullets: [
      "SOL 跌破你設的止損線——通知立刻到，或直接執行你預設的對衝動作，不等你醒來",
      "Kamino / Marinade 的 APY 跌到你不能接受的水位——自動再平衡啟動，你不需要盯著看",
      "Drift 借貸倉位健康係數逼近清算線——在清算發生之前，警報第一時間送到你手上",
      "條件觸發後 Jupiter Swap 直接執行——從條件成立到操作完成，全程不需要你動一下",
      "設定一次，永久有效——刷新頁面、重開瀏覽器、關機重啟，Guardian 的規則一條都不丟",
    ],
    gmgnTitle: "GMGN 實時 K 線圖",
    gmgnDesc: "好的交易決策需要圖表。但切換網站這件事每天都在打斷你的思路——看完 GMGN 的聰明錢數據，再去 DexScreener 看圖，再回來執行。Sakura 把這個流程縮短到零：GMGN 的真實 K 線數據直接在應用裡渲染，你的分析、判斷、執行，在同一個窗口完成。不是 iframe 嵌入，是服務端代理後的本地渲染——穩定，沒有封鎖問題。",
    gmgnBullets: [
      "5m 看入場點，1d 看大趨勢——5 個時間框架一鍵切換，同一個代幣的不同故事都能看到",
      "TradingView 開源引擎在本地渲染——數據流暢不卡，不依賴第三方嵌入，不會莫名掉線",
      "服務端代理繞過瀏覽器的 CSP / CORS 封鎖——GMGN 的數據穩定到達，不因網絡限制中斷",
      "換一個代幣，圖表立刻切換——不需要重新操作，選擇即得，思路不中斷",
      "研究、判斷、執行——在同一個窗口完成，告別在四個網站之間來回跳轉的碎片化流程",
    ],
    copyTitle: "複製交易",
    copyDesc: "跟單本身是合理的策略，前提是你跟的那個代幣值得被跟。問題是：聰明錢地址有時候在做出場，而你在做入場，而你不知道。Sakura 的安全閘口是第一道防線：無論那個 Whale 有多大、那個 KOL 有多少粉絲，GoPlus 評分低於 70 的代幣，複製按鈕不解鎖。因為最終受損的不是他們，是你。",
    copyBullets: [
      "GoPlus 評分低於 70——複製按鈕不解鎖，無論那個 Whale 名氣多大、KOL 粉絲多少",
      "系統根據你的總持倉算出合理跟單金額——不讓單筆操作把你的倉位集中度推到危險水位",
      "執行前確認卡片清楚展示：代幣名稱、安全評分、費用、滑點——每一項都可見，沒有隱藏",
      "最終簽名永遠在你的 Phantom 裡——Sakura 生成指令，你按確認，這是唯一正確的順序",
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
      "単一トークンが保有の40%超え——自動フラグが立ち、その集中度が現実の相場でどんな意味を持つかを教えます",
      "遊休USDCは毎日収益を損失しています——コストは具体的な金額で表示、パーセントではありません",
      "Marinade、Jito、Kamino、Driftの現在APYを並列表示——最良の選択肢が一目でわかります",
      "診断ごとの健康スコアにはタイムスタンプが残ります——6ヶ月後、自分の改善軌跡が明確に見えます",
      "実際の保有状況に基づいて直接実行可能な調整リストを生成——「分散投資を検討してください」のような無意味な言葉ではありません",
    ],
    securityTitle: "セキュリティ分析",
    securityDesc: "ハニーポットトークンは「これは詐欺です」とは書きません。正常に見えます——アクティブな取引、本物の流動性——売ろうとした瞬間、出口がロックされていることがわかります。GoPlusスキャンはトークンが存在した最初の秒からこれらのメカニズムを識別できます。Sakuraはその能力をあなたのすべての取引判断の前に置きます——コントラクトを理解する必要はありません。「分析」をクリックするだけです。",
    securityBullets: [
      "発行権限：チームがあなたの買い入れ後に無制限でトークンを印刷してあなたの持分をゼロ近くに希薄化できますか？これが代幣に保有価値があるかを直接決定します",
      "凍結権限：コントラクトがあなたのトークンを永久にロックして転送も売却も不可能にできますか？この項目が最も致命的なことが多いです",
      "ハニーポット：購入のみで永遠に売却できないトークンがあります——GoPlusはあなたが一円使う前にそれを識別します",
      "上位10保有者の集中度が高すぎると少数の人間が価格を操作できます——あなたの資金が彼らの出口流動性になります",
      "あなたが買おうとしている量での実際のスリッページコストはいくらか——プールは十分に深いか？システムが直接答えます",
    ],
    advisorTitle: "AIアドバイザー",
    advisorDesc: "質問をして、本物の答えを求めている——記憶から引用した段落ではなく。SakuraのAIアドバイザーは回答する前にまず確認します：今のKaminoの実際のAPYはいくらか？今日スマートマネーアドレスはSOLを動かしたか？あのトークンの過去24時間のオンチェーン活動はどうだったか？あなたが受け取る答えは、今この瞬間のデータに基づく判断——6ヶ月前のトレーニングセットの結論ではありません。",
    advisorBullets: [
      "あなたが言ったことを記憶します——次の質問で背景を再説明する必要なし、AIは常にあなたが何を聞いているかの文脈を把握しています",
      "回答する前にデータを確認します——今この瞬間のAPYとスマートマネーの動向、数ヶ月前のトレーニングセットの結論ではありません",
      "ポートフォリオ診断、スマートマネー、収益比較、セキュリティスキャン——ワンクリック起動、ページ間の移動は不要",
      "「50 SOLをUSDCに換える」と言うだけ——Jupiterの最適見積もりが即座に表示、コマンド構文を学ぶ必要なし",
      "どの言語で話しかけても同じ言語で返答——中国語、英語、日本語、設定を切り替える必要なし",
    ],
    agentTitle: "自律リバランスエージェント",
    agentDesc: "リバランスはすべきだとわかっている。でも、まだやっていない。不注意ではなく、合理的な行き詰まりがあるからです：どこから始めるか、どのプロトコルが本当に最適か、手数料は見合うか。Autonomous Agentはその行き詰まりを完全に取り除くために設計されています。質問は何も必要ありません：ウォレット全体をスキャンし、非効率を特定し、今最適化したら年間でいくらUSDCを多く稼げるかを示し、ワンクリックのプランを提示します。あなたがすることは確認だけです。",
    agentBullets: [
      "何も聞かなくていい——起動をクリックするだけで、エージェントがあなたのウォレット全体のグローバル分析を独力で完了します",
      "「今最適化すれば年間$X USDC多く稼げる」——パーセントではなくドル金額で表示、機会コストがリアルに伝わります",
      "調整前後の年間収益を並べて表示——感覚ではなく数字に意思決定させましょう",
      "Jupiterスワップ→Marinade/Jitoステーキング→Kaminoレンディング——実行チェーン全体がワンクリックで接続、どこにも移動不要",
      "エージェントの各推論ステップはSolanaにSHA-256記録されます——決定後もその論拠を独立して監査できます",
    ],
    smartTitle: "スマートマネー追跡",
    smartDesc: "スマートマネーアドレスはどんな公式発表より前にポジションを取っています。これは陰謀論ではなく、オンチェーンデータの事実です：それらの30以上のラベル付きアドレスの取引はすべて公開されています。誰も体系的に追跡していなかっただけです。Sakuraが追跡します。複数のトップアドレスが24時間以内に同じトークンを買い入れると、そのシグナルがあなたの前に現れます——噂ではなく、オンチェーンの記録です。",
    smartBullets: [
      "30以上の公開ラベル付きトップアドレス——KOLの影響力、Whaleの資金力、Cabalの情報優位、4カテゴリすべてカバー",
      "複数のトップアドレスが24時間以内に同じトークンを購入——ラベル重み付きでコンセンサス強度を自動計算、1-5星で明示",
      "スコアはブラックボックスではありません：Cabal +2、Whale +2、KOL +1.5——その星がどこから来たかを正確に知れます",
      "各アドレスに対応する公開Twitter（@ハンドル）を表示——匿名の文字列ではなく、公開された身元のある人物をフォローしています",
      "シグナルがどれほど強くても、安全ゲートを通過させます——GoPlus スコアがすべてのコンセンサストークンに自動トリガー",
    ],
    guardianTitle: "Guardian 自動監視",
    guardianDesc: "チャートをずっと見続けることはできません。でも市場はあなたがいつ眠るかを知りません。Guardianはシンプルな前提で動きます：あなたは自分のリスク境界を誰よりもよく知っています。ヘッジが必要な価格。リバランスが必要なAPYのフロア。追加担保が必要な健康係数。一度言えばいい。Guardianがそれを覚えて、その瞬間が来たときに、あなたが行うべきことを代わりに実行します。",
    guardianBullets: [
      "SOLがあなたのストップロスに達したとき——アラートが即座に届くか、あなたが設定したヘッジが自動実行、あなたが寝ていても",
      "KaminoやMarinadeのAPYがフロアを下回ったとき——自動リバランスが起動、自分で監視する必要なし",
      "DriftポジションのHealth Factorが清算ラインに近づいたとき——清算が起きる前にアラートがあなたの手元に届きます",
      "条件が発火したらJupiterスワップが直接実行——トリガーから完了まで、あなたは何もしなくていいです",
      "一度設定すれば永久有効——ページ更新、ブラウザ再起動、電源オフ：Guardianのルールは一つも消えません",
    ],
    gmgnTitle: "GMGNリアルタイムKラインチャート",
    gmgnDesc: "良いトレード判断にはチャートが必要です。でもタブを切り替えることが毎回思考の流れを断ち切ります——GMGNでスマートマネーデータを確認し、DexScreenerでチャートを見て、戻ってきてトレード実行。Sakuraはそのループをゼロにします：リアルなGMGN Kラインデータがアプリ内で直接レンダリングされます。分析、判断、実行が一つのウィンドウで完結します。iframeの埋め込みではなく、サーバーサイドプロキシによるローカルレンダリング——安定していて、ブロックの問題もありません。",
    gmgnBullets: [
      "5mでエントリーポイントを、1dで大トレンドを——5つの時間軸でワンクリック切替、同じトークンの5つの異なるストーリーが見えます",
      "TradingViewオープンソースエンジンがローカルでレンダリング——スムーズでラグなし、壊れる可能性のある外部埋め込みに依存しません",
      "サーバーサイドプロキシがCSP/CORSブロックを回避——GMGNデータは安定して届き、どんなネットワーク制限でも遮断されません",
      "トークンを切り替えると、チャートが即座に更新——分析の流れは途切れず、選択は即時反映",
      "リサーチ、判断、実行——すべてが同一ウィンドウで完結、4つのサイトを行き来する断片化した作業はもう終わりです",
    ],
    copyTitle: "コピートレード",
    copyDesc: "コピートレードは正当な戦略です——コピーしようとしているトークンがコピーに値する場合に限り。問題はスマートマネーアドレスが出場しているときにあなたが入場していることがある、それがわからないことです。Sakuraのセキュリティゲートが最初の防衛線です：Whaleがどれほど大きくても、KOLのフォロワーがどれほど多くても、GoPlus スコアが70を下回ればコピーボタンは解放されません。取引がうまくいかなかったとき、損失を被るのは彼らではなくあなただからです。",
    copyBullets: [
      "GoPlus スコアが70未満——そのWhaleがどれほど有名でもKOLのフォロワーがどれほど多くても、コピーボタンは解放されません",
      "総保有量に対して安全なコピー金額を自動計算——一回の取引があなたのポジションを危険な集中度に押し込まないようにします",
      "実行前確認カードにはすべてが表示されます：トークン名、安全スコア、手数料、スリッページ——何も隠れていません",
      "最終署名はあなたのPhantomウォレットの中にあります——Sakuraが命令を生成し、あなたが確認する。これが唯一の正しい順番です",
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
      "Single token above 40% of your portfolio — automatically flagged, with real concentration risk calculated in plain terms",
      "Idle USDC is losing yield every day — the cost is shown in actual dollar amounts, not percentages",
      "Marinade, Jito, Kamino, and Drift current APYs displayed side by side — the best option is obvious at a glance",
      "Every check-up's health score is timestamped — six months from now you'll see exactly how far you've come",
      "AI generates a directly actionable adjustment list based on your actual holdings — not generic advice",
    ],
    securityTitle: "Security Analysis",
    securityDesc: "Honeypot tokens don't announce themselves. They look normal — active trading, real liquidity — until the moment you try to sell and find the exit is locked. GoPlus scanning can identify these mechanisms from the token's first second on-chain. Sakura puts that capability in front of every trade you consider. You don't need to understand the contract. You just need to click \"Analyze.\"",
    securityBullets: [
      "Mint Authority: can the team print unlimited new tokens after you buy in, diluting your position to near-zero?",
      "Freeze Authority: can the contract lock your tokens permanently so you can never transfer or sell? This one is usually the most deadly",
      "Honeypot: some tokens can only be bought, never sold — GoPlus identifies this before you spend a single cent",
      "Top-10 holder concentration above a critical threshold means a handful of people can manipulate the price — your capital becomes their exit liquidity",
      "How much will your buy actually cost in slippage? Is the pool deep enough? The system tells you directly",
    ],
    advisorTitle: "AI Advisor",
    advisorDesc: "You ask a question. You want a real answer — not a paragraph the AI recited from memory. Before Sakura's AI Advisor responds, it checks: what's Kamino's actual APY right now? Which smart money addresses moved SOL today? What happened on-chain with that token in the last 24 hours? What you get is a judgment based on this moment's data — not a conclusion from a training set that's six months old.",
    advisorBullets: [
      "Remembers what you said — your next question needs no context recap; the AI always knows the thread you're on",
      "Checks live data before answering — you get this moment's APY and smart money movements, not a training set from months ago",
      "Health check, smart money, yield comparison, security scan — one-click triggers, no navigation between pages required",
      "Say \"swap 50 SOL to USDC\" — the optimal Jupiter quote surfaces immediately, no command syntax to learn",
      "Whatever language you speak, it responds in kind — Chinese, English, Japanese, no settings to toggle",
    ],
    agentTitle: "Autonomous Rebalance Agent",
    agentDesc: "Most people know they should rebalance. Most people haven't done it. Not from carelessness — from a reasonable sticking point: where to start, which protocol is actually optimal, whether the fees are worth it. The Autonomous Agent is designed to eliminate that sticking point entirely. No questions needed: it scans your entire wallet, identifies every inefficiency, tells you exactly how much more you'd earn per year in USDC if you optimized today, and gives you a one-click plan to do it. All you need to do is confirm.",
    agentBullets: [
      "Ask nothing — click start, and the Agent runs a full global scan of your wallet entirely on its own",
      "\"Optimize now and earn $X more USDC per year\" — shown in dollar terms, not percentages, so the opportunity cost is real",
      "Pre- and post-rebalance annual yield displayed side by side — let the numbers make the decision, not gut feeling",
      "Jupiter Swap through to Marinade staking through to Kamino lending — the entire execution chain connects in one click",
      "Every Agent reasoning step is SHA-256 recorded on Solana — after the decision is made, you can still audit every step of its logic",
    ],
    smartTitle: "Smart Money Tracker",
    smartDesc: "Smart money addresses take their positions before any public signal. This isn't conspiracy — it's on-chain fact. Every transaction those 30+ labeled addresses make is public. Nobody was tracking them systematically. Sakura does. When multiple top addresses buy the same token within 24 hours, that signal surfaces in front of you — not a rumor, an on-chain record.",
    smartBullets: [
      "30+ publicly labeled top-tier addresses — KOL influence, Whale capital, Cabal information edge, all four categories covered",
      "Multiple top addresses buying the same token within 24 hours — consensus strength auto-calculated with label weighting, shown as 1–5 stars",
      "The scoring isn't a black box: Cabal +2, Whale +2, KOL +1.5 — you know exactly where every star comes from",
      "Each address shows its linked public Twitter (@handle) — you're following a public identity, not an anonymous string of characters",
      "No matter how strong the consensus signal, it still goes through the security gate — GoPlus scoring auto-triggered for every consensus token",
    ],
    guardianTitle: "Guardian Auto-Monitor",
    guardianDesc: "You can't watch charts forever. But the market doesn't know when you sleep. Guardian works on a simple premise: you know your own risk thresholds better than anyone. The price where you'd hedge. The APY floor where you'd rebalance. The health factor where you'd add collateral. Say it once. Guardian remembers it. When that moment arrives, it does what you would have done — without you needing to be there.",
    guardianBullets: [
      "SOL hits your stop-loss — alert fires immediately, or your preset hedge executes automatically, whether you're awake or not",
      "Kamino or Marinade APY drops below your floor — auto-rebalance triggers, no need to monitor it yourself",
      "Your Drift lending health factor approaches liquidation — the alert reaches you before the liquidation does",
      "When conditions fire, Jupiter swap executes directly — from trigger to completion, you don't have to do a thing",
      "Set it once, it lives forever — page refresh, browser restart, power cycle: Guardian's rules stay exactly as you set them",
    ],
    gmgnTitle: "GMGN Live K-Line Chart",
    gmgnDesc: "Every good trade starts with a chart. But switching between tabs breaks your thinking — GMGN for smart money data, DexScreener for the chart, back to execute. Sakura cuts that loop to zero: real GMGN K-line data renders directly inside the app. Your research, your judgment, your execution — all in one window. Not an iframe embed. Server-side proxy, local rendering — stable and fast.",
    gmgnBullets: [
      "5m for entry timing, 1d for macro trend — five timeframes in one click, one token telling five different stories",
      "TradingView open-source engine renders locally — smooth, lag-free, not dependent on any third-party embed that can break",
      "Server-side proxy bypasses browser CSP/CORS blocks — GMGN data arrives reliably, no network restriction can cut it off",
      "Switch tokens, chart updates instantly — your analytical flow never breaks, selection is immediate",
      "Research, decide, execute — all in one window. The four-tab shuffle is over",
    ],
    copyTitle: "Copy Trade",
    copyDesc: "Copy trading is a legitimate strategy — as long as the token you're copying is worth copying. The problem: smart money addresses sometimes exit while you're entering, and you don't know. Sakura's security gate is the first line of defense: regardless of how big the Whale is or how many followers the KOL has, if GoPlus score is below 70, the copy button doesn't unlock. Because when the trade goes wrong, it's not their money at risk. It's yours.",
    copyBullets: [
      "GoPlus score below 70 — the copy button doesn't unlock, regardless of how famous the Whale is or how many followers the KOL has",
      "System auto-calculates a safe copy size relative to your total portfolio — no single trade pushes your concentration into dangerous territory",
      "Pre-execution confirmation card shows everything: token name, safety score, fees, slippage — every number visible, nothing buried",
      "The final signature lives in your Phantom wallet — Sakura generates the instruction, you press confirm. That is the only correct order of operations",
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


      </div>

      <Footer />
    </ThemeWrapper>
  );
}

// ─── Page ───────────────────────────────────────────────────────────────────

export default function DocsPage() {
  return <DocsContent />;
}
