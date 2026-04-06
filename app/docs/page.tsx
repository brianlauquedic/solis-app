"use client";

import Link from "next/link";
import { LanguageProvider, useLang } from "@/contexts/LanguageContext";
import Footer from "@/components/Footer";

function DocsContent() {
  const { t, lang } = useLang();

  const sections = lang === "ja" ? [
    {
      id: "intro",
      title: "Sakura とは？",
      content: `Sakura は、Solana エコシステム向けに特化した AI 駆動の DeFi アドバイザーです。GoPlus セキュリティ分析、リアルタイムのオンチェーンデータ、機関レベルのテクニカル分析を組み合わせ、安全に DeFi に参加できる環境を提供します。`,
    },
    {
      id: "why",
      title: "なぜ Sakura を作ったのか",
      content: `DeFi は機会に満ちていますが、詐欺トークン、複雑なプロトコル、情報過多といったリスクも伴います。Sakura の使命は、セキュリティを最優先にしながら、誰もが Solana DeFi を安全かつ賢く活用できるツールを提供することです。`,
    },
    {
      id: "features",
      title: "主要機能",
      items: [
        { icon: "🌸", title: "ポートフォリオ健全チェック", desc: "ウォレット全体の健康スコアを算出。資産配分、リスク集中度、過去の推移を一覧で確認できます。" },
        { icon: "🛡️", title: "セキュリティ分析", desc: "GoPlus API を使用してトークンの発行権限、凍結権限、ハニーポットリスクをリアルタイムで検出します。" },
        { icon: "🌿", title: "AI アドバイザー", desc: "Claude Sonnet 4.6 搭載の DeFi 専門 AI。リアルタイムデータを参照しながら、ポートフォリオの最適化戦略を提案します。" },
        { icon: "⚙️", title: "自律リバランスエージェント", desc: "ウォレット状況を分析し、最適な利回り配分プランを自動生成。Jupiter/Marinade/Kamino との連携で一括実行が可能です。" },
        { icon: "🐋", title: "スマートマネー追跡", desc: "30 以上のラベル付きウォレット（KOL・Whale・Cabal）の 24h オンチェーン行動を追跡し、共同買い入れシグナルを検出します。" },
        { icon: "🔔", title: "Guardian 自動監視", desc: "価格・APY・健康係数などのカスタム条件を設定し、条件達成時にアラートまたは自動取引を実行します。" },
      ],
    },
    {
      id: "diff",
      title: "Sakura の差別化ポイント",
      items: [
        { label: "セキュリティファースト", desc: "GoPlus スコア ≥ 70 のトークンのみコピートレードを許可。悪意のあるトークンを自動ブロックします。" },
        { label: "Solana 特化の深度", desc: "Jupiter・Helius・pump.fun・GMGN の完全統合。Solana エコシステムの深部まで対応。" },
        { label: "非カストディアル", desc: "秘密鍵は一切保管しません。すべての取引は Phantom ウォレットで自分自身が署名します。" },
        { label: "x402 マイクロペイメント", desc: "サブスクリプション不要。使った分だけ USDC で支払う Web3 ネイティブな課金モデル。" },
      ],
    },
    {
      id: "start",
      title: "はじめ方",
      steps: [
        "Phantom ウォレットをインストール・接続する",
        "「ポートフォリオ健全チェック」タブでウォレット全体を確認する",
        "「セキュリティ分析」でトークンのリスクを調べる",
        "「AI アドバイザー」に最適化戦略を相談する",
        "「自律エージェント」でリバランスプランを実行する",
      ],
    },
  ] : lang === "zh" ? [
    {
      id: "intro",
      title: "什麼是 Sakura？",
      content: `Sakura 是專為 Solana 生態系打造的 AI 驅動 DeFi 顧問。整合 GoPlus 安全分析、即時鏈上數據與機構級技術分析，讓您安全、智慧地參與 DeFi。`,
    },
    {
      id: "why",
      title: "為什麼打造 Sakura",
      content: `DeFi 充滿機會，但也伴隨詐騙代幣、複雜協議與資訊過載等風險。Sakura 的使命是以安全為首要原則，讓每個人都能以智慧、安全的方式使用 Solana DeFi。`,
    },
    {
      id: "features",
      title: "核心功能",
      items: [
        { icon: "🌸", title: "持倉體檢", desc: "計算錢包整體健康分數。一覽資產配置、風險集中度與歷史走勢。" },
        { icon: "🛡️", title: "安全分析", desc: "使用 GoPlus API 即時偵測代幣的增發權限、凍結權限與蜜罐風險。" },
        { icon: "🌿", title: "AI 顧問", desc: "搭載 Claude Sonnet 4.6 的 DeFi 專業 AI，參照即時數據提供投資組合最佳化建議。" },
        { icon: "⚙️", title: "自主 Agent 再平衡", desc: "自動分析錢包狀況，生成最佳收益分配方案，整合 Jupiter/Marinade/Kamino 一鍵執行。" },
        { icon: "🐋", title: "聰明錢追蹤", desc: "追蹤 30+ 個有標籤的錢包（KOL、Whale、Cabal）的 24h 鏈上行為，偵測共識買入信號。" },
        { icon: "🔔", title: "Guardian 自動監控", desc: "設定價格、APY、健康係數等自訂條件，觸發時自動發送警報或執行交易。" },
      ],
    },
    {
      id: "diff",
      title: "Sakura 的差異化優勢",
      items: [
        { label: "安全優先", desc: "GoPlus 評分 ≥ 70 才允許複製交易，自動攔截惡意代幣。" },
        { label: "Solana 垂直深度", desc: "完整整合 Jupiter、Helius、pump.fun、GMGN，深入 Solana 生態每個角落。" },
        { label: "非託管", desc: "不保管任何私鑰。所有交易均由您透過 Phantom 自行簽署。" },
        { label: "x402 微支付", desc: "無需訂閱。用多少付多少，USDC 原生計費，真正的 Web3 模式。" },
      ],
    },
    {
      id: "start",
      title: "如何開始",
      steps: [
        "安裝並連接 Phantom 錢包",
        "在「持倉體檢」頁籤查看整體資產狀況",
        "在「安全分析」檢查代幣風險",
        "向「AI 顧問」諮詢最佳化策略",
        "使用「自主 Agent」執行再平衡方案",
      ],
    },
  ] : [
    {
      id: "intro",
      title: "What is Sakura?",
      content: `Sakura is an AI-powered DeFi advisor built specifically for the Solana ecosystem. It combines GoPlus security analysis, real-time on-chain data, and institutional-grade technical analysis to help you participate in DeFi safely and intelligently.`,
    },
    {
      id: "why",
      title: "Why We Built Sakura",
      content: `DeFi is full of opportunity — but also risks: scam tokens, complex protocols, and information overload. Sakura's mission is to put security first and give everyone the tools to navigate Solana DeFi wisely and safely.`,
    },
    {
      id: "features",
      title: "Core Features",
      items: [
        { icon: "🌸", title: "Portfolio Health Check", desc: "Calculates an overall health score for your wallet. View asset distribution, risk concentration, and historical performance at a glance." },
        { icon: "🛡️", title: "Security Analysis", desc: "Uses GoPlus API to detect mint authority, freeze authority, and honeypot risks in real-time before you buy." },
        { icon: "🌿", title: "AI Advisor", desc: "DeFi-specialized AI powered by Claude Sonnet 4.6. References live data to suggest portfolio optimization strategies tailored to your holdings." },
        { icon: "⚙️", title: "Autonomous Rebalance Agent", desc: "Analyzes your wallet and generates an optimal yield allocation plan. Integrates Jupiter/Marinade/Kamino for one-click execution." },
        { icon: "🐋", title: "Smart Money Tracker", desc: "Tracks 30+ labeled wallets (KOL, Whale, Cabal) for 24h on-chain activity and detects consensus buy signals." },
        { icon: "🔔", title: "Guardian Auto-Monitor", desc: "Set custom conditions on price, APY, or health factor. Get alerts or trigger automated transactions when conditions are met." },
      ],
    },
    {
      id: "diff",
      title: "What Makes Sakura Different",
      items: [
        { label: "Security First", desc: "Only tokens with GoPlus score ≥ 70 are eligible for copy trading. Malicious tokens are blocked automatically." },
        { label: "Solana-Native Depth", desc: "Full integration with Jupiter, Helius, pump.fun, and GMGN. Deep coverage of every corner of the Solana ecosystem." },
        { label: "Non-Custodial", desc: "We never hold your private keys. Every transaction is signed by you via Phantom." },
        { label: "x402 Micropayments", desc: "No subscriptions required. Pay per use in USDC — a true Web3-native billing model." },
      ],
    },
    {
      id: "start",
      title: "Getting Started",
      steps: [
        "Install and connect your Phantom wallet",
        "Check your overall portfolio in the Portfolio Health Check tab",
        "Analyze token risk in the Security Analysis tab",
        "Ask the AI Advisor for optimization strategies",
        "Run a rebalance plan with the Autonomous Agent",
      ],
    },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-base)", color: "var(--text-primary)" }}>
      {/* Nav */}
      <nav style={{
        borderBottom: "1px solid var(--border)", background: "var(--bg-card)",
        padding: "14px 40px", display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <Link href="/" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
          <div style={{
            width: 28, height: 28, background: "var(--accent)",
            borderRadius: 6, display: "flex", alignItems: "center",
            justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#fff",
          }}>S</div>
          <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font-heading)" }}>Sakura</span>
        </Link>
        <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
          <Link href="/use-cases" style={{ fontSize: 13, color: "var(--text-secondary)", textDecoration: "none" }}>
            {lang === "ja" ? "使用事例" : lang === "zh" ? "使用案例" : "Use Cases"}
          </Link>
          <Link href="/pricing" style={{ fontSize: 13, color: "var(--text-secondary)", textDecoration: "none" }}>
            {lang === "ja" ? "料金" : lang === "zh" ? "定價" : "Pricing"}
          </Link>
          <Link href="/" style={{
            fontSize: 13, padding: "7px 18px", borderRadius: 8,
            background: "var(--accent)", color: "#fff", textDecoration: "none", fontWeight: 600,
          }}>
            {lang === "ja" ? "アプリを起動" : lang === "zh" ? "啟動應用" : "Launch App"}
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <div style={{ padding: "60px 40px 0", maxWidth: 880, margin: "0 auto" }}>
        <div style={{
          display: "inline-block", fontSize: 11, padding: "4px 12px",
          borderRadius: 20, border: "1px solid var(--border)",
          color: "var(--text-muted)", marginBottom: 20,
          letterSpacing: "0.06em", textTransform: "uppercase",
        }}>
          {lang === "ja" ? "ドキュメント" : lang === "zh" ? "使用手冊" : "Documentation"}
        </div>
        <h1 style={{
          fontSize: 40, fontWeight: 300, lineHeight: 1.2,
          fontFamily: "var(--font-heading)", color: "var(--text-primary)", margin: "0 0 16px",
          letterSpacing: "0.02em",
        }}>
          {lang === "ja" ? "Sakura ドキュメント" : lang === "zh" ? "Sakura 使用手冊" : "Sakura Documentation"}
        </h1>
        <p style={{ fontSize: 16, color: "var(--text-secondary)", lineHeight: 1.8, margin: "0 0 48px" }}>
          {lang === "ja"
            ? "Sakura の全機能を理解し、Solana DeFi を安全かつ賢く活用するためのガイドです。"
            : lang === "zh"
            ? "了解 Sakura 的所有功能，安全、智慧地使用 Solana DeFi 的完整指南。"
            : "Your complete guide to understanding every feature of Sakura and navigating Solana DeFi safely and intelligently."}
        </p>

        {/* TOC */}
        <div style={{
          background: "var(--bg-card)", border: "1px solid var(--border)",
          borderRadius: 12, padding: "20px 24px", marginBottom: 48,
        }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 12, letterSpacing: "0.06em", textTransform: "uppercase" }}>
            {lang === "ja" ? "目次" : lang === "zh" ? "目錄" : "Table of Contents"}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {sections.map((s, i) => (
              <a key={s.id} href={`#${s.id}`} style={{
                fontSize: 13, color: "var(--text-secondary)", textDecoration: "none",
              }}
                onMouseEnter={e => (e.currentTarget.style.color = "var(--accent)")}
                onMouseLeave={e => (e.currentTarget.style.color = "var(--text-secondary)")}
              >
                {i + 1}. {s.title}
              </a>
            ))}
          </div>
        </div>

        {/* Sections */}
        <div style={{ display: "flex", flexDirection: "column", gap: 56, paddingBottom: 80 }}>
          {sections.map((section, i) => (
            <div key={section.id} id={section.id}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8, background: "var(--accent-soft)",
                  border: "1px solid rgba(192,57,43,0.3)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 700, color: "var(--accent)",
                }}>
                  {i + 1}
                </div>
                <h2 style={{
                  margin: 0, fontSize: 22, fontWeight: 400,
                  fontFamily: "var(--font-heading)", color: "var(--text-primary)",
                }}>
                  {section.title}
                </h2>
              </div>

              {"content" in section && (
                <p style={{ fontSize: 15, color: "var(--text-secondary)", lineHeight: 1.9, margin: 0 }}>
                  {section.content}
                </p>
              )}

              {"items" in section && Array.isArray(section.items) && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
                  {(section.items as Array<{ icon?: string; title?: string; label?: string; desc: string }>).map((item, idx) => (
                    <div key={idx} style={{
                      background: "var(--bg-card)", border: "1px solid var(--border)",
                      borderRadius: 12, padding: 20,
                      borderTop: "2px solid var(--accent)",
                    }}>
                      {item.icon && (
                        <div style={{ fontSize: 20, marginBottom: 10 }}>{item.icon}</div>
                      )}
                      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)", marginBottom: 8 }}>
                        {item.title ?? item.label}
                      </div>
                      <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.7 }}>
                        {item.desc}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {"steps" in section && Array.isArray(section.steps) && (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {(section.steps as string[]).map((step, idx) => (
                    <div key={idx} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
                      <div style={{
                        width: 24, height: 24, borderRadius: "50%",
                        background: "var(--accent)", color: "#fff",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 11, fontWeight: 700, flexShrink: 0, marginTop: 2,
                      }}>
                        {idx + 1}
                      </div>
                      <p style={{ margin: 0, fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.7 }}>
                        {step}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <Footer />
    </div>
  );
}

export default function DocsPage() {
  return (
    <LanguageProvider>
      <DocsContent />
    </LanguageProvider>
  );
}
