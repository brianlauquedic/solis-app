"use client";

import Link from "next/link";
import { LanguageProvider, useLang } from "@/contexts/LanguageContext";
import Footer from "@/components/Footer";

function UseCasesContent() {
  const { lang } = useLang();

  type UseCase = {
    icon: string;
    title: string;
    subtitle: string;
    steps: string[];
    tag: string;
  };

  const cases: UseCase[] = lang === "ja" ? [
    {
      icon: "🔍",
      tag: "セキュリティ",
      title: "購入前にトークンを安全確認",
      subtitle: "新しいトークンを購入する前に、GoPlus セキュリティ分析でリスクを事前チェックする",
      steps: [
        "「セキュリティ分析」タブにトークンのミントアドレスを入力",
        "発行権限・凍結権限・ハニーポットリスクをワンクリックで確認",
        "安全スコアと AI の判定結果（購入推奨・要注意・回避推奨）を確認",
        "保有者分布・開発者保有率など詳細データを参照",
        "安全と判断したら「AI アドバイザー」に適切なポジションサイズを相談",
      ],
    },
    {
      icon: "🌿",
      tag: "利回り最適化",
      title: "最高の利回りを見つける",
      subtitle: "Marinade・Jito・Kamino など複数プロトコルの APY を比較し、最適な運用先を選択する",
      steps: [
        "「AI アドバイザー」に「SOL をどこにステーキングするのが最善ですか？」と質問",
        "AI がリアルタイムの APY データを取得し、各プロトコルを比較",
        "ウォレット残高に基づく具体的な配分提案を受け取る",
        "提案に同意したら「自律エージェント」で実行",
        "Guardian で APY 変動を監視し、より良い機会があれば通知を受け取る",
      ],
    },
    {
      icon: "🐋",
      tag: "スマートマネー",
      title: "プロの動きをリアルタイム追跡",
      subtitle: "KOL・クジラ・カバルなど実績のある 30+ ウォレットの 24h オンチェーン行動を監視する",
      steps: [
        "「AI アドバイザー」の「スマートマネー追跡」パネルを開く",
        "過去 24h に複数の有名ウォレットが購入した共通トークンを確認",
        "買い手の組み合わせ（KOL×2 + Whale×1 など）と信頼スコアを評価",
        "気になるトークンを「セキュリティ分析」で安全性を検証",
        "安全性が確認されたら「コピートレード」で追随するか判断",
      ],
    },
    {
      icon: "⚙️",
      tag: "自動化",
      title: "ポートフォリオを自動リバランス",
      subtitle: "AI エージェントがウォレットを分析し、最適な資産配分への再調整プランを自動生成する",
      steps: [
        "「自律エージェント」タブでリバランス分析を実行",
        "AI が現在の配分と最適配分のギャップを特定",
        "推奨される取引リスト（どのトークンを売って何に変換するか）を確認",
        "各ステップの詳細理由を確認し、納得したら承認",
        "Jupiter/Marinade/Kamino 経由でトランザクションを実行（要 Phantom 署名）",
      ],
    },
    {
      icon: "🔔",
      tag: "Guardian アラート",
      title: "カスタム条件で自動通知",
      subtitle: "価格・APY・健康係数の変化を自動監視し、設定した条件に達したらアラートを受け取る",
      steps: [
        "「自律エージェント」→「Guardian 監視」でアラート条件を作成",
        "例：「SOL 価格が $130 を下回ったら通知」「Kamino USDC APY が 8% を超えたら通知」",
        "条件がトリガーされると AI アドバイザーにアラートメッセージが表示される",
        "「リバランスしますか？」の提案に従って対応アクションを実行",
        "1 ウォレットあたり最大 10 件の条件を同時設定可能",
      ],
    },
    {
      icon: "📊",
      tag: "ポートフォリオ管理",
      title: "資産の健康状態を継続的に管理",
      subtitle: "スナップショット履歴・健康スコア・リスク集中度を継続的に追跡する",
      steps: [
        "「持倉健全チェック」タブで総合健康スコアを確認",
        "資産配分グラフでリスクトークンの比率を把握",
        "「資産分布」の履歴チャートでポートフォリオの推移を確認",
        "「ウォレットレポートを共有」で証明可能な記録をブロックチェーンに保存",
        "AI アドバイザーに健康スコアの改善方法を相談",
      ],
    },
  ] : lang === "zh" ? [
    {
      icon: "🔍",
      tag: "安全",
      title: "購買前先做安全檢查",
      subtitle: "在購買新代幣前，用 GoPlus 安全分析預先評估風險",
      steps: [
        "在「安全分析」頁籤輸入代幣的 Mint 地址",
        "一鍵查看增發權限、凍結權限與蜜罐風險",
        "確認安全分數與 AI 判定結果（建議買入/謹慎/迴避）",
        "查看持有者分布、開發者持倉比例等詳細數據",
        "確認安全後，向「AI 顧問」諮詢合適的倉位大小",
      ],
    },
    {
      icon: "🌿",
      tag: "收益優化",
      title: "找到最高利率的存款管道",
      subtitle: "比較 Marinade、Jito、Kamino 等多個協議的 APY，選擇最優運用方向",
      steps: [
        "向「AI 顧問」提問「我的 SOL 存哪裡利息最高？」",
        "AI 即時抓取各協議 APY 數據並進行比較",
        "根據您的錢包餘額獲得具體的配置建議",
        "同意方案後，使用「自主 Agent」執行",
        "透過 Guardian 監控 APY 變動，有更好機會時接收通知",
      ],
    },
    {
      icon: "🐋",
      tag: "聰明錢",
      title: "即時追蹤頂級交易者的動向",
      subtitle: "監控 KOL、鯨魚、Cabal 等 30+ 個知名錢包的 24h 鏈上操作",
      steps: [
        "開啟「AI 顧問」中的「聰明錢追蹤」面板",
        "查看過去 24h 內多個知名錢包共同買入的代幣",
        "評估買家組合（2 KOL + 1 Whale 等）與信心評分",
        "對感興趣的代幣，到「安全分析」驗證安全性",
        "安全確認後，決定是否透過「複製交易」跟單",
      ],
    },
    {
      icon: "⚙️",
      tag: "自動化",
      title: "自動再平衡投資組合",
      subtitle: "AI Agent 分析錢包狀況，自動生成最佳資產配置調整方案",
      steps: [
        "在「自主 Agent」頁籤啟動再平衡分析",
        "AI 識別當前配置與最優配置的差距",
        "查看推薦的交易清單（賣出什麼、換成什麼）",
        "確認每個步驟的詳細理由，同意後授權執行",
        "透過 Jupiter/Marinade/Kamino 完成交易（需 Phantom 簽名）",
      ],
    },
    {
      icon: "🔔",
      tag: "Guardian 警報",
      title: "自訂條件自動通知",
      subtitle: "自動監控價格、APY、健康係數變化，條件觸發時接收警報",
      steps: [
        "在「自主 Agent」→「Guardian 監控」建立警報條件",
        "例：「SOL 價格跌破 $130 時通知我」「Kamino USDC APY 超過 8% 時通知我」",
        "條件觸發後，AI 顧問會顯示警報訊息",
        "依據「是否要再平衡？」的提示採取對應行動",
        "每個錢包最多可同時設定 10 個條件",
      ],
    },
    {
      icon: "📊",
      tag: "投資組合管理",
      title: "持續管理資產健康狀態",
      subtitle: "追蹤快照歷史、健康分數與風險集中度",
      steps: [
        "在「持倉體檢」頁籤查看整體健康分數",
        "透過資產配置圖掌握風險代幣比例",
        "查看「資產分布」歷史記錄了解投資組合走勢",
        "使用「分享我的錢包報告」將可驗證的記錄存到鏈上",
        "向 AI 顧問諮詢如何提升健康分數",
      ],
    },
  ] : [
    {
      icon: "🔍",
      tag: "Security",
      title: "Check Token Safety Before Buying",
      subtitle: "Run GoPlus security analysis on any token before committing capital",
      steps: [
        "Paste the token mint address into the Security Analysis tab",
        "Instantly check mint authority, freeze authority, and honeypot risk",
        "Review the safety score and AI verdict (Consider Buying / Caution / Avoid)",
        "Examine holder distribution, developer holdings, and top-10 concentration",
        "If safe, ask the AI Advisor for the right position size for your portfolio",
      ],
    },
    {
      icon: "🌿",
      tag: "Yield",
      title: "Find the Highest Yield for Your Assets",
      subtitle: "Compare real-time APY across Marinade, Jito, Kamino, and more",
      steps: [
        "Ask the AI Advisor: \"Where should I stake my SOL for the best yield?\"",
        "The AI fetches live APY data and compares protocols side by side",
        "Receive a specific allocation recommendation based on your actual balances",
        "Approve the plan and execute it via the Autonomous Rebalance Agent",
        "Set a Guardian alert to be notified when a better opportunity appears",
      ],
    },
    {
      icon: "🐋",
      tag: "Smart Money",
      title: "Track Top Traders in Real-Time",
      subtitle: "Monitor 30+ labeled wallets (KOL, Whale, Cabal) for 24h on-chain consensus",
      steps: [
        "Open the Smart Money Tracker panel in the AI Advisor tab",
        "View tokens that multiple notable wallets bought in the last 24h",
        "Evaluate buyer combinations (2 KOL + 1 Whale, etc.) and confidence scores",
        "Run a security check on interesting tokens before acting",
        "Use Copy Trade to follow the signal — with GoPlus safety gate enforced",
      ],
    },
    {
      icon: "⚙️",
      tag: "Automation",
      title: "Automatically Rebalance Your Portfolio",
      subtitle: "Let the AI agent analyze your wallet and generate an optimal reallocation plan",
      steps: [
        "Run the rebalance analysis in the Autonomous Agent tab",
        "The AI identifies gaps between your current and optimal allocation",
        "Review the recommended trade list (what to sell, what to buy)",
        "Inspect the reasoning behind each step, then approve the plan",
        "Transactions are executed via Jupiter/Marinade/Kamino (Phantom signature required)",
      ],
    },
    {
      icon: "🔔",
      tag: "Guardian Alerts",
      title: "Get Notified on Custom Conditions",
      subtitle: "Auto-monitor price, APY, or health factor changes with configurable thresholds",
      steps: [
        "Create alert conditions in Autonomous Agent → Guardian Monitor",
        "Examples: \"Notify me when SOL drops below $130\" or \"Kamino USDC APY exceeds 8%\"",
        "When triggered, an alert message appears in the AI Advisor",
        "Follow the \"Want to rebalance?\" prompt to take action",
        "Up to 10 conditions per wallet can be active simultaneously",
      ],
    },
    {
      icon: "📊",
      tag: "Portfolio",
      title: "Monitor Your Portfolio Health Continuously",
      subtitle: "Track snapshot history, health score, and risk concentration over time",
      steps: [
        "Check your overall health score in the Portfolio Health Check tab",
        "Use the asset distribution chart to understand risky token exposure",
        "Review the history snapshots to see portfolio trajectory",
        "Use Share My Wallet Report to save verifiable records on-chain",
        "Ask the AI Advisor how to improve your health score",
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
          <Link href="/docs" style={{ fontSize: 13, color: "var(--text-secondary)", textDecoration: "none" }}>
            {lang === "ja" ? "ドキュメント" : lang === "zh" ? "使用手冊" : "Docs"}
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
      <div style={{ padding: "60px 40px 0", maxWidth: 960, margin: "0 auto" }}>
        <div style={{
          display: "inline-block", fontSize: 11, padding: "4px 12px",
          borderRadius: 20, border: "1px solid var(--border)",
          color: "var(--text-muted)", marginBottom: 20,
          letterSpacing: "0.06em", textTransform: "uppercase",
        }}>
          {lang === "ja" ? "使用事例" : lang === "zh" ? "使用案例" : "Use Cases"}
        </div>
        <h1 style={{
          fontSize: 40, fontWeight: 300, lineHeight: 1.2,
          fontFamily: "var(--font-heading)", color: "var(--text-primary)", margin: "0 0 16px",
          letterSpacing: "0.02em",
        }}>
          {lang === "ja" ? "Sakura で何ができるか" : lang === "zh" ? "Sakura 可以做什麼" : "What You Can Do With Sakura"}
        </h1>
        <p style={{ fontSize: 16, color: "var(--text-secondary)", lineHeight: 1.8, margin: "0 0 56px" }}>
          {lang === "ja"
            ? "安全確認からリバランス自動化まで — Sakura の実際の使い方を 6 つのシナリオで解説します。"
            : lang === "zh"
            ? "從安全檢查到自動再平衡——6 個真實場景帶您了解 Sakura 的實際使用方式。"
            : "From security checks to automated rebalancing — 6 real-world scenarios showing exactly how Sakura helps you navigate Solana DeFi."}
        </p>

        {/* Use case cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: 32, paddingBottom: 80 }}>
          {cases.map((uc, i) => (
            <div key={i} style={{
              background: "var(--bg-card)", border: "1px solid var(--border)",
              borderRadius: 16, padding: "28px 32px",
              borderLeft: "3px solid var(--accent)",
            }}>
              <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 20 }}>
                <div style={{ fontSize: 28, lineHeight: 1 }}>{uc.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 4,
                      background: "var(--accent-soft)", color: "var(--accent)",
                      border: "1px solid rgba(192,57,43,0.2)",
                      letterSpacing: "0.05em", textTransform: "uppercase",
                    }}>{uc.tag}</span>
                  </div>
                  <h2 style={{ margin: "0 0 6px", fontSize: 20, fontWeight: 600, color: "var(--text-primary)" }}>
                    {uc.title}
                  </h2>
                  <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.7 }}>
                    {uc.subtitle}
                  </p>
                </div>
              </div>

              <div style={{
                borderTop: "1px solid var(--border)", paddingTop: 20,
                display: "flex", flexDirection: "column", gap: 10,
              }}>
                {uc.steps.map((step, idx) => (
                  <div key={idx} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <div style={{
                      width: 20, height: 20, borderRadius: "50%",
                      border: "1px solid var(--border)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 10, fontWeight: 700, color: "var(--text-muted)", flexShrink: 0, marginTop: 2,
                    }}>
                      {idx + 1}
                    </div>
                    <p style={{ margin: 0, fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.7 }}>
                      {step}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div style={{
          background: "var(--accent-soft)", border: "1px solid rgba(192,57,43,0.25)",
          borderRadius: 16, padding: "36px 40px", textAlign: "center", marginBottom: 60,
        }}>
          <h3 style={{ margin: "0 0 12px", fontSize: 22, fontWeight: 400, fontFamily: "var(--font-heading)", color: "var(--text-primary)" }}>
            {lang === "ja" ? "今すぐ始める" : lang === "zh" ? "立即開始" : "Ready to Get Started?"}
          </h3>
          <p style={{ margin: "0 0 24px", fontSize: 14, color: "var(--text-secondary)" }}>
            {lang === "ja"
              ? "Phantom ウォレットを接続するだけ。3 回まで無料でお試しいただけます。"
              : lang === "zh"
              ? "只需連接 Phantom 錢包。每項功能可免費試用 3 次。"
              : "Connect your Phantom wallet and get 3 free uses of every feature."}
          </p>
          <Link href="/" style={{
            display: "inline-block", padding: "12px 32px", borderRadius: 10,
            background: "var(--accent)", color: "#fff", textDecoration: "none",
            fontSize: 14, fontWeight: 600,
          }}>
            {lang === "ja" ? "アプリを起動" : lang === "zh" ? "啟動 Sakura" : "Launch Sakura"}
          </Link>
        </div>
      </div>

      <Footer />
    </div>
  );
}

export default function UseCasesPage() {
  return (
    <LanguageProvider>
      <UseCasesContent />
    </LanguageProvider>
  );
}
