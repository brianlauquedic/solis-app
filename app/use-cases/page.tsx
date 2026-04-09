"use client";

import Link from "next/link";
import Footer from "@/components/Footer";
import { useLang } from "@/contexts/LanguageContext";
import type { Lang } from "@/lib/i18n";

type L = Lang;

const PAGE_TEXT: Record<L, {
  back: string;
  badge: string;
  title: string;
  subtitle: string;
  contextLabel: string;
  outcomeLabel: string;
  ctaTitle: string;
  ctaSubtitle: string;
  ctaPhantom: string;
  ctaOkx: string;
}> = {
  zh: {
    back: "← 返回首頁",
    badge: "USE CASES · REAL SOLANA SCENARIOS",
    title: "Sakura 真實場景案例",
    subtitle: "七個源自 Solana 主網真實事件的場景：$2.85 億 Drift 攻擊如何讓毫不知情的用戶在數月後瞬間損失全部資產、多步 DeFi 策略如何在執行前毫無預警地遭遇衝突與滑點、Kamino 借貸倉位如何在 10 分鐘暴跌中被清算人機器人搶先一步——以及 Sakura 的三道 Solana 原生防線如何在每個關鍵時刻精準介入。每個場景附帶精確數字：健康因子、token delta、救援費用、節省金額——不是模糊承諾，而是可驗證的結果。",
    contextLabel: "真實場景",
    outcomeLabel: "Sakura 的解決方案",
    ctaTitle: "立即體驗三道防線",
    ctaSubtitle: "掃描、幽靈模擬、健康因子監控完全免費——機構級保護，普通用戶可及",
    ctaPhantom: "👻 連接 Phantom →",
    ctaOkx: "◈ Connect OKX →",
  },
  en: {
    back: "← Back to Home",
    badge: "USE CASES · REAL SOLANA SCENARIOS",
    title: "Sakura Real-World Scenarios",
    subtitle: "Seven scenarios grounded in actual Solana mainnet events: how the $285M Drift attack quietly eroded users' assets months before anyone knew a nonce account had been compromised; how multi-step DeFi strategies silently absorb slippage and contract conflicts before execution; how Kamino lending positions tip into liquidation in the seconds before a push notification arrives. And how Sakura's three Solana-native defense protocols intervene at each critical moment — with exact numbers: health factors, token deltas, rescue costs, net savings — verifiable outcomes, not marketing claims.",
    contextLabel: "Scenario",
    outcomeLabel: "Sakura's Response",
    ctaTitle: "Activate All Three Defense Protocols",
    ctaSubtitle: "Scanning, ghost simulation, and health factor monitoring are completely free — institutional protection, democratized",
    ctaPhantom: "👻 Connect Phantom →",
    ctaOkx: "◈ Connect OKX →",
  },
  ja: {
    back: "← ホームへ戻る",
    badge: "USE CASES · REAL SOLANA SCENARIOS",
    title: "Sakura リアルワールドシナリオ",
    subtitle: "Solanaメインネットで実際に起きた出来事に基づく7つのシナリオ——2.85億ドルのDriftエクスプロイト、マルチステップDeFi戦略のスリッページ、Kaminoレンディングの清算——Nonce Guardian・Ghost Run・Liquidation Shieldが、いかにして全オンチェーンユーザーをミリ秒単位・機関投資家水準の精度で守るかを示します。",
    contextLabel: "シナリオ",
    outcomeLabel: "Sakuraの対応",
    ctaTitle: "3つの防衛プロトコルを今すぐ起動",
    ctaSubtitle: "スキャン・ゴーストシミュレーション・ヘルスファクター監視は完全無料——機関投資家レベルの保護を民主化",
    ctaPhantom: "👻 Phantomを接続 →",
    ctaOkx: "◈ OKXを接続 →",
  },
};

interface CaseEntry {
  title: Record<L, string>;
  persona: Record<L, string>;
  context: Record<L, string>;
  outcome: Record<L, string>;
  tag: Record<L, string>;
}

interface SectionEntry {
  id: string;
  feature: string;
  featureColor: string;
  badge: string;
  cases: CaseEntry[];
}

const USE_CASES: SectionEntry[] = [
  {
    id: "uc-nonce",
    feature: "🛡️ Nonce Guardian",
    featureColor: "#FF4444",
    badge: "DURABLE NONCE GUARDIAN",
    cases: [
      {
        title: {
          zh: "我的錢包有被 Durable Nonce 攻擊的風險嗎？",
          en: "Is My Wallet at Risk from a Durable Nonce Attack?",
          ja: "私のウォレットはDurable Nonce攻撃のリスクにさらされていますか？",
        },
        persona: {
          zh: "DeFi 重度用戶",
          en: "Active DeFi User",
          ja: "アクティブDeFiユーザー",
        },
        context: {
          zh: "2026 年 4 月 1 日，Drift 協議遭受 $2.85 億美元攻擊，攻擊者利用 Durable Nonce 的「永久有效簽名」特性，在 nonce 賬戶 authority 被劫持後的數月後才提交已預先簽名的惡意交易。許多用戶不知道自己錢包中存在高風險 nonce 賬戶。",
          en: "On April 1, 2026, the Drift Protocol suffered a $285M attack. Exploiting Durable Nonce's 'permanently valid signature' property, attackers submitted pre-signed malicious transactions months after hijacking nonce account authority. Most users had no idea high-risk nonce accounts were linked to their wallets.",
          ja: "2026年4月1日、DriftプロトコルがDurable Nonceの「永続的に有効な署名」特性を悪用した2.85億ドルの攻撃を受けました。攻撃者はnonceアカウントのauthorityを乗っ取ってから数ヶ月後に事前署名済みの悪意あるトランザクションを送信。多くのユーザーは自分のウォレットに高リスクなnonceアカウントが紐づいていることを知りませんでした。",
        },
        outcome: {
          zh: "用戶輸入錢包地址，Nonce Guardian 在 3 秒內掃描所有關聯 nonce 賬戶，發現 1 個 authority 非本人控制的高風險帳戶。Claude AI 生成中文報告，精確指出風險來源。SHA-256 報告哈希永久記錄在 Solana 鏈上——用戶有不可篡改的安全審計記錄。",
          en: "Enter a wallet address. Nonce Guardian scans all associated nonce accounts in under 3 seconds and flags 1 high-risk account whose authority is not controlled by the user. Claude AI generates a full risk report. The SHA-256 report hash is permanently anchored on Solana — an immutable security audit record the user owns forever.",
          ja: "ウォレットアドレスを入力すると、Nonce Guardianが3秒以内にすべての関連nonceアカウントをスキャンし、authorityが自分でコントロールしていない高リスクアカウントを1件検出。Claude AIが詳細なリスクレポートを生成。SHA-256レポートハッシュがSolanaに永久記録され、改ざん不可能なセキュリティ監査記録が残ります。",
        },
        tag: {
          zh: "安全審計",
          en: "Security Audit",
          ja: "セキュリティ監査",
        },
      },
      {
        title: {
          zh: "機構資產安全合規：定期 Nonce 風險審計",
          en: "Institutional Compliance: Periodic Nonce Risk Audits",
          ja: "機関資産のセキュリティコンプライアンス：定期的なNonceリスク監査",
        },
        persona: {
          zh: "加密資產機構 / DAO 財庫管理",
          en: "Crypto Fund / DAO Treasury Manager",
          ja: "暗号資産機関 / DAO財務管理者",
        },
        context: {
          zh: "機構帳戶通常持有多個 Durable Nonce 賬戶用於離線批量交易簽名。合規要求定期進行安全審計並保存可驗證的審計記錄。",
          en: "Institutional accounts commonly hold multiple Durable Nonce accounts for offline batch transaction signing. Compliance mandates regular security audits with verifiable, independently auditable records.",
          ja: "機関アカウントはオフラインのバッチトランザクション署名のために複数のDurable Nonceアカウントを保有することが多い。コンプライアンス要件として、独立して検証可能な監査記録を伴う定期的なセキュリティ監査が求められます。",
        },
        outcome: {
          zh: "每週掃描一次，支付 $1 USDC 生成 AI 安全報告，報告的 SHA-256 哈希上鏈存證。累積的鏈上 tx signatures 構成完整的合規審計鏈，可供外部審計師在 Solscan 獨立驗證。",
          en: "A weekly scan costs $1 USDC for an AI security report whose SHA-256 hash is anchored on-chain. The accumulated chain of tx signatures forms a complete compliance audit trail that external auditors can verify independently on Solscan — no need to trust Sakura.",
          ja: "毎週スキャンして$1 USDCのAIセキュリティレポートを生成し、SHA-256ハッシュをオンチェーンに記録。蓄積されたオンチェーンtx署名のチェーンが完全なコンプライアンス監査証跡を形成し、外部監査人がSolscanで独立して検証可能——Sakuraを信頼する必要はありません。",
        },
        tag: {
          zh: "合規存證",
          en: "Compliance Record",
          ja: "コンプライアンス記録",
        },
      },
    ],
  },
  {
    id: "uc-ghost",
    feature: "👻 Ghost Run",
    featureColor: "#7C6FFF",
    badge: "GHOST RUN",
    cases: [
      {
        title: {
          zh: "在不損失資金的前提下，了解複雜 DeFi 策略的精確結果",
          en: "Know the Exact Outcome of a Complex DeFi Strategy Before Risking a Single Dollar",
          ja: "1ドルもリスクにさらす前に、複雑なDeFi戦略の正確な結果を把握する",
        },
        persona: {
          zh: "中階 DeFi 用戶",
          en: "Intermediate DeFi User",
          ja: "中級DeFiユーザー",
        },
        context: {
          zh: "用戶想同時完成：將 5 SOL 質押到 Marinade 賺取 mSOL，並將 100 USDC 存入 Kamino 賺取借貸利息。但不確定精確能收到多少 mSOL、gas 費用是多少、兩步之間是否有衝突。",
          en: "The user wants to stake 5 SOL with Marinade for mSOL and deposit 100 USDC into Kamino for lending yield — simultaneously. But they're unsure exactly how much mSOL they'll receive, what gas will cost, and whether the two steps conflict.",
          ja: "ユーザーはMarinadeに5 SOLをステークしてmSOLを得ながら、100 USDCをKaminoに預けて借入利回りを得たいと考えています。しかし、正確にいくらのmSOLが得られるか、ガス代はいくらか、2つのステップが衝突しないかわかりません。",
        },
        outcome: {
          zh: "輸入自然語言描述後，Ghost Run 在 2 秒內完成幽靈執行：「您將收到 4.992 mSOL（APY 7.2% = 年化 +$21.3）；Kamino 存款將獲 kUSDC 收益憑證（APY 8.1% = 年化 +$8.1）；總 gas：0.000048 SOL；兩步無衝突，可安全執行。」確認後 SAK 一鍵執行，執行費 0.3%。",
          en: "Ghost Run ghost-executes the full strategy in under 2 seconds: 'You will receive 4.992 mSOL (APY 7.2% = +$21.3/year); Kamino deposit yields kUSDC receipt (APY 8.1% = +$8.1/year); total gas: 0.000048 SOL; no conflicts — safe to execute.' Confirm once and SAK executes both on-chain. 0.3% execution fee.",
          ja: "自然言語で入力すると、Ghost Runが2秒以内でゴースト実行：「4.992 mSOLを受け取ります（APY 7.2% = 年間+$21.3）；Kamino預金はkUSDC収益証書を生成（APY 8.1% = 年間+$8.1）；総ガス：0.000048 SOL；競合なし——安全に実行可能」。確認後、SAKが両方をオンチェーンで実行。実行手数料0.3%。",
        },
        tag: {
          zh: "收益優化",
          en: "Yield Optimization",
          ja: "利回り最適化",
        },
      },
      {
        title: {
          zh: "跨協議套利策略預驗——避免因 slippage 或路由失敗損失資金",
          en: "Pre-Validate a Cross-Protocol Arbitrage Strategy Before Slippage Costs You",
          ja: "スリッページで損失が出る前に、クロスプロトコル裁定戦略を事前検証する",
        },
        persona: {
          zh: "進階 DeFi 交易員",
          en: "Advanced DeFi Trader",
          ja: "上級DeFiトレーダー",
        },
        context: {
          zh: "交易員設計了複雜的多步套利路徑：Jupiter 換倉 → Jito 質押 → Kamino 借貸循環。每步操作都有 slippage 風險與時序依賴，真實執行前無從得知精確盈利。",
          en: "A trader has designed a complex multi-step arbitrage path: Jupiter swap → Jito staking → Kamino lending loop. Each step carries slippage risk and timing dependencies — there's no way to know the exact profit before executing for real.",
          ja: "トレーダーが複雑な多段階裁定戦略を設計：Jupiterスワップ → Jitoステーキング → Kaminoレンディングループ。各ステップにはスリッページリスクとタイミング依存性があり、実際に実行するまで正確な利益を知る方法がありません。",
        },
        outcome: {
          zh: "Ghost Run 依序幽靈執行三步策略，返回每步精確 token delta 與累計 gas 消耗，並標記步驟 2→3 存在 slippage 衝突（kUSDC 收益憑證不可直接用於步驟 3 的借貸抵押）。用戶在不損失一分錢的情況下發現策略缺陷並調整。",
          en: "Ghost Run executes all three strategy steps in ghost mode, returning exact token deltas and cumulative gas per step — and flags a conflict between steps 2 and 3 (the kUSDC receipt token cannot be used as lending collateral in step 3). The trader finds the flaw and adjusts without losing a cent.",
          ja: "Ghost Runが3ステップ戦略を順番にゴースト実行し、各ステップの正確なトークンデルタと累積ガスを返し、ステップ2→3間の競合を検出（kUSDC収益証書はステップ3の貸し出し担保として直接使用不可）。トレーダーは1セントも失うことなく戦略の欠陥を発見して修正します。",
        },
        tag: {
          zh: "風險前置",
          en: "Risk Pre-Flight",
          ja: "リスク事前確認",
        },
      },
    ],
  },
  {
    id: "uc-shield",
    feature: "⚡ Liquidation Shield",
    featureColor: "#FF9F0A",
    badge: "LIQUIDATION SHIELD",
    cases: [
      {
        title: {
          zh: "行情急跌時，AI 在清算前自動救援 Kamino 倉位",
          en: "When the Market Dumps, AI Auto-Rescues Your Kamino Position Before Liquidation",
          ja: "市場暴落時、AIが清算前にKaminoポジションを自動救済",
        },
        persona: {
          zh: "Kamino 借貸用戶",
          en: "Kamino Lending User",
          ja: "Kaminoレンディングユーザー",
        },
        context: {
          zh: "用戶在 Kamino 以 10 SOL 作抵押借出 $800 USDC，健康因子維持在 1.35。某個週末 SOL 突然下跌 20%，健康因子在 2 小時內從 1.35 跌至 1.03，逼近清算線（HF < 1.0），若被清算將損失約 $80–$160（5–10% 清算罰款）。",
          en: "A user has borrowed $800 USDC against 10 SOL collateral on Kamino, health factor 1.35. One weekend, SOL drops 20%. The health factor falls from 1.35 to 1.03 within two hours, approaching the liquidation line (HF < 1.0). A liquidation would cost $80–$160 (5–10% liquidation penalty).",
          ja: "ユーザーはKaminoで10 SOLを担保に$800 USDCを借り入れ、健康係数は1.35。ある週末、SOLが突然20%下落。健康係数が2時間以内に1.35から1.03に低下し、清算ライン（HF < 1.0）に迫ります。清算されると$80〜$160の損失（5〜10%の清算ペナルティ）が発生します。",
        },
        outcome: {
          zh: "Liquidation Shield 觸發預設閾值（HF < 1.05）。simulateTransaction 預演：還款 $600 USDC 可將 HF 恢復至 1.42。SPL Token Approve 確認授權範圍內（用戶預授權最多 $1000 USDC）。SAK lendAsset() 在 400ms 內完成還款。收取 1% 服務費（$6 USDC），相較 $80–$160 清算損失節省 92%。",
          en: "Liquidation Shield triggers at the preset threshold (HF < 1.05). simulateTransaction pre-computes: repaying $600 USDC restores HF to 1.42. SPL Token Approve confirms within the authorized cap (user pre-authorized up to $1,000 USDC). SAK lendAsset() completes repayment within 400ms. Service fee: 1% ($6 USDC) vs. $80–$160 in liquidation losses — 92% saved.",
          ja: "Liquidation Shieldがプリセット閾値（HF < 1.05）でトリガー。simulateTransactionが事前計算：$600 USDC返済でHFを1.42に回復。SPL Token Approveが承認範囲内を確認（最大$1,000 USDC事前承認）。SAK lendAsset()が400ms以内に返済完了。サービス料1%（$6 USDC）——$80〜$160の清算損失と比較して92%の節約。",
        },
        tag: {
          zh: "清算防護",
          en: "Liquidation Defense",
          ja: "清算防護",
        },
      },
      {
        title: {
          zh: "跨協議倉位統一監控——Kamino + MarginFi 同時保護",
          en: "Unified Cross-Protocol Monitoring — Kamino and MarginFi Protected Simultaneously",
          ja: "クロスプロトコル統合モニタリング——KaminoとMarginFiを同時に保護",
        },
        persona: {
          zh: "多協議 DeFi 用戶",
          en: "Multi-Protocol DeFi User",
          ja: "マルチプロトコルDeFiユーザー",
        },
        context: {
          zh: "進階用戶同時在 Kamino 和 MarginFi 持有借貸倉位，分散風險。但管理兩個協議的健康因子需要不斷切換介面，且兩者沒有統一的警報機制。",
          en: "A power user holds lending positions on both Kamino and MarginFi for risk diversification. Managing health factors across two protocols requires constant context-switching, and neither protocol offers a unified alert mechanism.",
          ja: "上級ユーザーがリスク分散のためにKaminoとMarginFiの両方で借入ポジションを保有。2つのプロトコル間での健康係数管理には常にコンテキスト切り替えが必要で、どちらも統合されたアラート機能を提供していません。",
        },
        outcome: {
          zh: "Liquidation Shield 同時監控兩個協議的所有倉位，統一顯示健康因子儀表板。用戶一次設定預授權上限，AI 根據優先級（健康因子最低者優先）自動分配救援資源。Memo Program 為每個協議的救援操作分別寫入審計記錄，可逐筆追溯。",
          en: "Liquidation Shield monitors all positions across both protocols in a unified health factor dashboard. One pre-authorization cap covers both. AI allocates rescue resources by priority (lowest health factor first). Memo Program writes a separate audit record per protocol per rescue — fully traceable.",
          ja: "Liquidation Shieldが両プロトコルのすべてのポジションを統合ダッシュボードで監視。事前承認上限は一度設定するだけで両プロトコルをカバー。AIが優先度順（健康係数最低を優先）に自動救済リソースを割り当て。Memo Programがプロトコルごとに各救済操作の監査記録を書き込み——完全追跡可能。",
        },
        tag: {
          zh: "跨協議管理",
          en: "Cross-Protocol Mgmt",
          ja: "クロスプロトコル管理",
        },
      },
      {
        title: {
          zh: "預授權上限保護：確保 AI 絕不超出您的授權範圍",
          en: "Pre-Authorization Hard Cap: AI Can Never Exceed Your Authorized Limit",
          ja: "事前承認ハードキャップ：AIが承認範囲を絶対に超えない",
        },
        persona: {
          zh: "謹慎型 DeFi 用戶",
          en: "Risk-Cautious DeFi User",
          ja: "リスク慎重型DeFiユーザー",
        },
        context: {
          zh: "用戶擔心授權 AI 自動執行交易會失控——如果 AI 判斷錯誤，可能動用超出預期的資金執行不必要的操作。",
          en: "The user is concerned that authorizing AI to execute transactions autonomously could spiral out of control — if the AI misjudges, it might spend more funds than intended.",
          ja: "ユーザーはAIによるトランザクションの自律実行の承認が制御不能になることを懸念——AIが誤判断した場合、意図した以上の資金が不要な操作に使われる可能性があります。",
        },
        outcome: {
          zh: "SPL Token Approve 在 token program 層面設定硬性上限（例：最多 $500 USDC）。這是 Solana token program 強制執行的合約級約束，而非 Sakura 的軟性承諾——即使 Sakura 服務端出現任何問題，超出授權的轉帳在鏈上層面就會被拒絕。用戶在 Solscan 可查看授權記錄與所有執行記錄的完整鏈上審計鏈。",
          en: "SPL Token Approve sets a hard ceiling at the token program level (e.g., maximum $500 USDC). This is a contract-level constraint enforced by Solana's token program — not a soft promise from Sakura. Even if something goes wrong server-side, any transfer exceeding the authorization is rejected at the chain level. Full onchain audit trail visible on Solscan.",
          ja: "SPL Token ApproveがToken Programレベルでハード上限を設定（例：最大$500 USDC）。SolanaのToken Programが強制するコントラクトレベルの制約であり、Sakuraのソフトな約束ではありません——サーバー側で何か問題が発生しても、承認を超える転送はチェーンレベルで拒否。完全なオンチェーン監査証跡がSolscanで確認可能。",
        },
        tag: {
          zh: "安全授權",
          en: "Safe Authorization",
          ja: "安全な承認",
        },
      },
    ],
  },
];

export default function UseCasesPage() {
  const { lang } = useLang();
  const l = (lang as L) in PAGE_TEXT ? (lang as L) : "zh";
  const p = PAGE_TEXT[l];

  return (
    <main style={{ minHeight: "100vh", background: "var(--bg-base)", color: "var(--text-primary)" }}>
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "60px 24px 40px" }}>

        {/* Header */}
        <div style={{ marginBottom: 56 }}>
          <Link href="/" style={{
            fontSize: 12, color: "var(--text-muted)", textDecoration: "none",
            letterSpacing: "0.08em", display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 24,
          }}>
            {p.back}
          </Link>
          <div style={{ marginBottom: 20 }}>
            <span style={{ fontSize: 11, color: "var(--accent)", letterSpacing: "0.15em", fontFamily: "var(--font-mono)" }}>
              {p.badge}
            </span>
          </div>
          <h1 style={{
            fontSize: 32, fontWeight: 300, letterSpacing: "0.06em",
            fontFamily: "var(--font-heading)", marginBottom: 12,
          }}>
            {p.title}
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.9, maxWidth: 580 }}>
            {p.subtitle}
          </p>
        </div>

        {/* Sakura intro */}
        <div style={{
          background: "var(--bg-card)", border: "1px solid var(--border)",
          borderLeft: "3px solid var(--accent)", borderRadius: 10,
          padding: "18px 22px", marginBottom: 40,
          display: "flex", gap: 14, alignItems: "flex-start",
        }}>
          <div style={{
            width: 34, height: 34, borderRadius: 8, flexShrink: 0,
            background: "var(--accent-soft)", border: "1px solid var(--accent-mid)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 15, fontFamily: "var(--font-heading)", color: "var(--accent)",
          }}>桜</div>
          <div>
            <div style={{ fontSize: 9, letterSpacing: "0.2em", color: "var(--accent)", fontFamily: "var(--font-mono)", marginBottom: 5, textTransform: "uppercase" }}>
              🌸 Sakura AI Guardian · 備えあれば憂いなし — Real Threats, Real Defense
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.9 }}>
              {lang === "zh"
                ? "每一個場景都源自 Solana 主網真實發生的事件。Sakura 以匠人精神打造三道防線應對這些真實威脅：Nonce Guardian 以攻擊者自己的 RPC 武器反守為攻——2026 年 4 月 1 日，Drift $2.85 億攻擊用的是 getProgramAccounts，Sakura 用的也是它，只是方向相反；Ghost Run 讓普通用戶第一次擁有機構級策略預演能力，在投入任何資本之前看到精確結果；Liquidation Shield 以 SPL Token Approve 硬性約束守住借貸倉位，400ms 閃電救援在清算發生前還原健康因子。所有 AI 決策 SHA-256 永久上鏈，任何人可在 Solscan 獨立核驗——無需信任 Sakura，無需信任任何人。"
                : lang === "ja"
                ? "すべてのシナリオはSolanaメインネットで実際に起きた出来事に基づいています。Sakuraは匠の精神でこれらの実際の脅威に対応する3つの防衛ラインを構築：Nonce Guardianは攻撃者自身のRPC武器を逆用——2026年4月1日のDrift 2.85億ドル攻撃はgetProgramAccountsを使用、SakuraもそれをあなたのためのシールドとしてgetProgramAccountsを使用；Ghost Runは普通のユーザーが初めて機関投資家レベルの戦略事前演習能力を持つことを可能にし、資本を投入する前に正確な結果を確認；Liquidation ShieldはSPL Token Approveの強制制約で貸出ポジションを守り、400msで清算発生前にヘルスファクターを回復。すべてのAI判断はSHA-256で永続オンチェーン刻印、誰でもSolscanで独立検証可能——Sakuraを信頼する必要なし。"
                : "Each scenario shows Sakura's three defense protocols operating against real threats: Nonce Guardian counter-attacking with the same RPC primitives attackers use; Ghost Run making zero-capital-at-risk the new standard for multi-step DeFi execution; Liquidation Shield completing rescue within 400ms before liquidation triggers, constrained by SPL Token Approve at the token-program level. All AI decisions SHA-256 inscribed on-chain — independently verifiable by anyone, anywhere."}
            </div>
          </div>
        </div>

        {/* Use case sections */}
        {USE_CASES.map((section, si) => (
          <section key={section.id} id={section.id} style={{ marginBottom: 64 }}>
            {/* Feature header */}
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 8,
                background: `${section.featureColor}18`,
                border: `1px solid ${section.featureColor}40`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 18,
              }}>
                {section.feature.slice(0, 2)}
              </div>
              <div>
                <div style={{ fontSize: 11, color: section.featureColor, letterSpacing: "0.12em", fontFamily: "var(--font-mono)", marginBottom: 2 }}>
                  {section.badge}
                </div>
                <div style={{ fontSize: 18, fontWeight: 300, fontFamily: "var(--font-heading)", letterSpacing: "0.05em" }}>
                  {section.feature}
                </div>
              </div>
            </div>

            {/* Cases */}
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {section.cases.map((c, ci) => (
                <div key={ci} style={{
                  background: "var(--bg-card)", border: "1px solid var(--border)",
                  borderLeft: `3px solid ${section.featureColor}`,
                  borderRadius: 10, padding: "22px 24px",
                }}>
                  {/* Tag + Title */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                    <span style={{
                      fontSize: 10, color: section.featureColor,
                      background: `${section.featureColor}14`,
                      border: `1px solid ${section.featureColor}30`,
                      borderRadius: 4, padding: "2px 8px",
                      letterSpacing: "0.08em", fontFamily: "var(--font-mono)",
                    }}>
                      {c.tag[l]}
                    </span>
                    <span style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.06em" }}>
                      {c.persona[l]}
                    </span>
                  </div>
                  <h3 style={{
                    fontSize: 15, fontWeight: 500, color: "var(--text-primary)",
                    letterSpacing: "0.03em", marginBottom: 14, lineHeight: 1.5,
                  }}>
                    {c.title[l]}
                  </h3>

                  {/* Context + Outcome */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                    <div style={{
                      background: "var(--bg-base)", borderRadius: 8, padding: "14px 16px",
                    }}>
                      <div style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.1em", marginBottom: 8, fontFamily: "var(--font-mono)" }}>
                        {p.contextLabel}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.85 }}>
                        {c.context[l]}
                      </div>
                    </div>
                    <div style={{
                      background: `${section.featureColor}08`,
                      border: `1px solid ${section.featureColor}20`,
                      borderRadius: 8, padding: "14px 16px",
                    }}>
                      <div style={{ fontSize: 10, color: section.featureColor, letterSpacing: "0.1em", marginBottom: 8, fontFamily: "var(--font-mono)" }}>
                        {p.outcomeLabel}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.85 }}>
                        {c.outcome[l]}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {si < USE_CASES.length - 1 && (
              <div style={{ borderBottom: "1px solid var(--border)", marginTop: 48 }} />
            )}
          </section>
        ))}

        {/* CTA */}
        <div style={{
          background: "var(--bg-card)", border: "1px solid var(--border)",
          borderTop: "2px solid var(--accent)", borderRadius: 10,
          padding: "28px 32px", textAlign: "center",
        }}>
          <div style={{ fontSize: 15, fontWeight: 400, color: "var(--text-primary)", marginBottom: 8, fontFamily: "var(--font-heading)", letterSpacing: "0.05em" }}>
            {p.ctaTitle}
          </div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20, lineHeight: 1.7 }}>
            {p.ctaSubtitle}
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/" style={{
              display: "inline-block",
              background: "var(--accent)", color: "#fff",
              borderRadius: 8, padding: "10px 24px",
              fontSize: 13, fontWeight: 500, textDecoration: "none",
              letterSpacing: "0.06em",
            }}>
              {p.ctaPhantom}
            </Link>
            <Link href="/" style={{
              display: "inline-block",
              background: "#1a1a2e", color: "#fff",
              border: "1px solid #4a4aff",
              borderRadius: 8, padding: "10px 24px",
              fontSize: 13, fontWeight: 500, textDecoration: "none",
              letterSpacing: "0.06em",
            }}>
              {p.ctaOkx}
            </Link>
          </div>
        </div>
      </div>
      <Footer />
    </main>
  );
}
