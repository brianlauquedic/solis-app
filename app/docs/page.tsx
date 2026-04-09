"use client";

import Link from "next/link";
import Footer from "@/components/Footer";
import { useLang } from "@/contexts/LanguageContext";

type Lang = "zh" | "en" | "ja";

const CONTENT: Record<Lang, {
  back: string; badge: string; title: string; subtitle: string;
  sections: Array<{
    id: string; badge: string; badgeColor: string; title: string; subtitle: string; intro: string;
    steps: Array<{ step: string; title: string; desc: string }>;
    risks: Array<{ level: string; color: string; desc: string }>;
  }>;
  feeTitle: string;
  fees: Array<{ feature: string; free: string; paid: string }>;
  contact: string; contactHandle: string;
}> = {
  zh: {
    back: "← 返回首頁",
    badge: "DOCUMENTATION",
    title: "Sakura 使用手冊",
    subtitle: "三項 Solana 原生 AI 協議的完整技術文檔——工作原理、使用步驟與費用說明。",
    sections: [
      {
        id: "nonce-guardian", badge: "DURABLE NONCE GUARDIAN", badgeColor: "#FF4444",
        title: "🛡️ Nonce Guardian", subtitle: "主動式 Durable Nonce 安全審計",
        intro: "Nonce Guardian 是業界首個專為 Solana Durable Nonce 攻擊向量設計的主動安全協議。2026 年 4 月 1 日 $2.85 億 Drift 攻擊利用的正是 Durable Nonce 的永久有效性，使攻擊者可在任意時間提交預先簽名的交易。Nonce Guardian 以攻擊者所用的相同 RPC 原語反守為攻。",
        steps: [
          { step: "1", title: "連接錢包或輸入地址", desc: "無需創建帳號。輸入任意 Solana 公鑰地址即可立即開始掃描——唯讀存取，不請求任何簽名或轉帳授權。" },
          { step: "2", title: "免費鏈上掃描", desc: "後端以 getProgramAccounts(SystemProgram, { filters: [{ dataSize: 80 }, { memcmp: { offset: 8, bytes: walletAddress } }] }) 掃描所有關聯 Durable Nonce 賬戶。每個 80-byte nonce 結構體的 offset 8 解析出 authority pubkey，與您的地址比對。" },
          { step: "3", title: "支付 $1.00 USDC 解鎖 AI 報告", desc: "基礎掃描結果立即展示。如需完整 AI 風險分析，透過 x402 協議（HTTP 402 Payment Required）支付 $1.00 USDC。支付在 Phantom 或 OKX 錢包內完成，Sakura 不持有您的資產。" },
          { step: "4", title: "SHA-256 鏈上存證", desc: "Claude Sonnet 生成完整風險報告後，報告內容的 SHA-256 哈希透過 Solana Memo Program 永久上鏈。任何人持 tx signature 可在 Solscan 獨立驗證 AI 報告的真實性與完整性。" },
        ],
        risks: [
          { level: "🚨 極高風險", color: "#FF4444", desc: "Authority 非本人控制——nonce 賬戶已被劫持，存在永久有效簽名交易可被提交的風險" },
          { level: "⚠️ 高風險", color: "#FF8C00", desc: "發現多個高權限 nonce 賬戶但 authority 一致——攻擊面廣" },
          { level: "⚡ 中風險", color: "#FFD700", desc: "Nonce 賬戶存在但未被積極監控" },
          { level: "✓ 低風險", color: "#34C759", desc: "未發現 Durable Nonce 賬戶或 authority 完全由本人控制" },
        ],
      },
      {
        id: "ghost-run", badge: "GHOST RUN — STRATEGY SIMULATOR", badgeColor: "#7C6FFF",
        title: "👻 Ghost Run", subtitle: "多步 DeFi 策略幽靈執行引擎",
        intro: "Ghost Run 是全球首個利用 Solana 原生 simulateTransaction 對多步跨協議 DeFi 策略進行完整預執行的產品。在您授權任何一筆交易前，Ghost Run 已在真實鏈上狀態下完整演練整個策略，返回精確 token delta、gas 消耗、衝突檢測，讓「所見即所得」成為 DeFi 執行的新標準。",
        steps: [
          { step: "1", title: "自然語言輸入策略", desc: "以中文、英文或日文描述您的 DeFi 計劃。例：「質押 3 SOL 到 Marinade，同時把 50 USDC 存入 Kamino 賺取利息」。無需了解任何合約地址或 ABI。" },
          { step: "2", title: "Claude AI 解析與交易構建", desc: "Claude Sonnet 解析自然語言，識別協議（Marinade / Kamino / Jito / Jupiter）、操作類型與金額。系統以 @solana/web3.js 直接構建未簽名交易。" },
          { step: "3", title: "simulateTransaction 幽靈執行", desc: "每筆構建好的交易以 connection.simulateTransaction(tx, { sigVerify: false }) 在真實主網狀態下執行。返回精確 token delta（例：您將收到 2.994 mSOL）、lamport 消耗、執行日誌及任何潛在錯誤。" },
          { step: "4", title: "確認後 SAK 一鍵上鏈", desc: "預覽結果滿意後點擊「確認執行」。SAK stakeWithJup() / lendAsset() 真正執行交易並廣播至主網。執行憑證透過 Solana Memo Program 永久上鏈。執行費 0.3%，僅在執行時收取。" },
        ],
        risks: [],
      },
      {
        id: "liquidation-shield", badge: "LIQUIDATION SHIELD — ACTIVE MONITORING", badgeColor: "#FF9F0A",
        title: "⚡ Liquidation Shield", subtitle: "跨協議 AI 清算救援協議",
        intro: "Solana 借貸市場 TVL 超過 $40 億。劇烈行情下，Kamino / MarginFi / Solend 倉位健康因子可在數秒內從安全區間跌破 1.0，觸發全額清算——損失通常達抵押品的 5–10%。Liquidation Shield 是業界首個跨協議、有預授權硬性上限的 AI 主動救援協議。",
        steps: [
          { step: "1", title: "設定救援參數", desc: "輸入「最大救援金額（USDC）」與「觸發健康因子閾值」。系統以 SPL Token Approve 指令在 token program 層面硬性鎖定授權上限——AI 絕無可能超出您設定的金額，這是 token program 強制執行的硬約束。" },
          { step: "2", title: "掃描借貸倉位", desc: "getProgramAccounts 掃描 Kamino / MarginFi / Solend 的借貸倉位健康因子。掃描完全免費。健康因子 < 1.05（可自定義）時進入救援模式。" },
          { step: "3", title: "simulateTransaction 精確預演", desc: "@solana/web3.js 構建還款交易，simulateTransaction 精確計算還款後健康因子恢復值、所需 USDC 金額、gas 消耗。所有數字基於真實鏈上狀態。" },
          { step: "4", title: "SAK 自動執行救援", desc: "在預授權範圍內，SAK lendAsset() 執行還款，將健康因子恢復至安全區間。Solana Memo Program 寫入完整審計鏈。救援成功後收取 1% 服務費——遠低於清算損失的 5–10%。" },
        ],
        risks: [],
      },
    ],
    feeTitle: "費用總覽",
    fees: [
      { feature: "🛡️ Nonce Guardian", free: "掃描免費", paid: "AI 報告 $1.00 USDC（x402）" },
      { feature: "👻 Ghost Run", free: "模擬免費", paid: "執行費 0.3%（Jupiter Platform Fee）" },
      { feature: "⚡ Liquidation Shield", free: "監控免費", paid: "救援成功費 1%（SPL Transfer）" },
    ],
    contact: "有問題？聯繫我們：", contactHandle: "𝕏 @sakuraaijp",
  },
  en: {
    back: "← Back to Home",
    badge: "DOCUMENTATION",
    title: "Sakura Documentation",
    subtitle: "Complete technical documentation for three Solana-native AI protocols — how they work, step-by-step usage, and fee structure.",
    sections: [
      {
        id: "nonce-guardian", badge: "DURABLE NONCE GUARDIAN", badgeColor: "#FF4444",
        title: "🛡️ Nonce Guardian", subtitle: "Proactive Durable Nonce Security Audit",
        intro: "Nonce Guardian is the industry's first proactive security protocol designed specifically for Solana Durable Nonce attack vectors. The April 1, 2026 $285M Drift hack exploited the permanent validity of Durable Nonces, allowing attackers to submit pre-signed transactions at any time after hijacking a nonce account authority. Nonce Guardian turns the attacker's own RPC primitives into a defense.",
        steps: [
          { step: "1", title: "Connect wallet or enter address", desc: "No account required. Enter any Solana public key to start scanning immediately — read-only access, no signing or transfer permissions requested." },
          { step: "2", title: "Free onchain scan", desc: "Backend calls getProgramAccounts(SystemProgram, { filters: [{ dataSize: 80 }, { memcmp: { offset: 8, bytes: walletAddress } }] }) to scan all associated Durable Nonce accounts. Each 80-byte nonce struct's authority pubkey at offset 8 is compared against your address." },
          { step: "3", title: "Pay $1.00 USDC to unlock AI report", desc: "Basic scan results are shown immediately. For the full AI risk analysis, pay $1.00 USDC via x402 protocol (HTTP 402 Payment Required). Payment is completed in your Phantom or OKX wallet — Sakura never holds your assets." },
          { step: "4", title: "SHA-256 onchain proof", desc: "After Claude Sonnet generates the complete risk report, the SHA-256 hash of the report content is permanently anchored via Solana Memo Program. Anyone with the tx signature can independently verify the authenticity and integrity of the AI report on Solscan." },
        ],
        risks: [
          { level: "🚨 Critical", color: "#FF4444", desc: "Authority not controlled by you — nonce account hijacked, permanently valid pre-signed transactions may be submitted at any time" },
          { level: "⚠️ High", color: "#FF8C00", desc: "Multiple high-privilege nonce accounts found with consistent authority — wide attack surface" },
          { level: "⚡ Medium", color: "#FFD700", desc: "Nonce accounts exist but are not actively monitored" },
          { level: "✓ Low", color: "#34C759", desc: "No Durable Nonce accounts found, or authority is fully under your control" },
        ],
      },
      {
        id: "ghost-run", badge: "GHOST RUN — STRATEGY SIMULATOR", badgeColor: "#7C6FFF",
        title: "👻 Ghost Run", subtitle: "Multi-Step DeFi Strategy Pre-Execution Engine",
        intro: "Ghost Run is the world's first product to use Solana-native simulateTransaction for complete pre-execution of multi-step cross-protocol DeFi strategies. Before you authorize a single transaction, Ghost Run has already fully rehearsed the entire strategy against live chain state — returning exact token deltas, gas costs, and conflict detection, making 'what you see is what you get' the new standard for DeFi execution.",
        steps: [
          { step: "1", title: "Input strategy in natural language", desc: "Describe your DeFi plan in English, Chinese, or Japanese. Example: 'Stake 3 SOL to Marinade and deposit 50 USDC into Kamino for yield.' No knowledge of contract addresses or ABIs required." },
          { step: "2", title: "Claude AI parsing and transaction building", desc: "Claude Sonnet parses the natural language, identifies protocols (Marinade / Kamino / Jito / Jupiter), operation types and amounts. The system builds unsigned transactions directly with @solana/web3.js." },
          { step: "3", title: "simulateTransaction ghost execution", desc: "Each built transaction is ghost-executed with connection.simulateTransaction(tx, { sigVerify: false }) against real mainnet state. Returns exact token deltas (e.g. you will receive 2.994 mSOL), lamport costs, execution logs, and any potential errors." },
          { step: "4", title: "One-click SAK execution on confirmation", desc: "Click 'Confirm Execute' when satisfied with the preview. SAK stakeWithJup() / lendAsset() executes the real transactions and broadcasts to mainnet. Execution proof is permanently recorded via Solana Memo Program. 0.3% fee, charged only on execution." },
        ],
        risks: [],
      },
      {
        id: "liquidation-shield", badge: "LIQUIDATION SHIELD — ACTIVE MONITORING", badgeColor: "#FF9F0A",
        title: "⚡ Liquidation Shield", subtitle: "Cross-Protocol AI Liquidation Rescue Protocol",
        intro: "Solana lending TVL exceeds $4 billion. In volatile markets, Kamino / MarginFi / Solend position health factors can drop below 1.0 within seconds, triggering full liquidation — typically a 5–10% loss on collateral. Liquidation Shield is the industry's first cross-protocol AI rescue protocol with a hard pre-authorized spending cap.",
        steps: [
          { step: "1", title: "Set rescue parameters", desc: "Enter 'maximum rescue amount (USDC)' and 'trigger health factor threshold.' The system uses SPL Token Approve to hard-lock the spending cap at the token program level — the AI cannot exceed your authorized amount under any circumstances, enforced by the token program, not a soft promise." },
          { step: "2", title: "Scan lending positions", desc: "getProgramAccounts scans Kamino / MarginFi / Solend lending position health factors. Scanning is completely free. Health factor < 1.05 (customizable) triggers rescue mode." },
          { step: "3", title: "simulateTransaction precise rehearsal", desc: "@solana/web3.js builds the repayment transaction; simulateTransaction precisely calculates post-repayment health factor recovery, required USDC amount, and gas costs — all based on real chain state." },
          { step: "4", title: "SAK auto-executes rescue", desc: "Within the pre-authorized limit, SAK lendAsset() executes repayment, restoring the health factor to safety. Solana Memo Program writes a complete audit chain. 1% service fee charged on successful rescue — far below the 5–10% liquidation penalty." },
        ],
        risks: [],
      },
    ],
    feeTitle: "Fee Summary",
    fees: [
      { feature: "🛡️ Nonce Guardian", free: "Scan free", paid: "AI report $1.00 USDC (x402)" },
      { feature: "👻 Ghost Run", free: "Simulation free", paid: "0.3% execution fee (Jupiter Platform Fee)" },
      { feature: "⚡ Liquidation Shield", free: "Monitoring free", paid: "1% rescue fee on success (SPL Transfer)" },
    ],
    contact: "Questions? Contact us:", contactHandle: "𝕏 @sakuraaijp",
  },
  ja: {
    back: "← ホームへ戻る",
    badge: "DOCUMENTATION",
    title: "Sakura ドキュメント",
    subtitle: "3つのSolanaネイティブAIプロトコルの完全技術ドキュメント——仕組み、使用手順、料金体系。",
    sections: [
      {
        id: "nonce-guardian", badge: "DURABLE NONCE GUARDIAN", badgeColor: "#FF4444",
        title: "🛡️ Nonce Guardian", subtitle: "プロアクティブDurable Nonceセキュリティ監査",
        intro: "Nonce GuardianはSolana Durable Nonce攻撃ベクター専用に設計された業界初のプロアクティブセキュリティプロトコルです。2026年4月1日の2.85億ドルDriftハックはDurable Nonceの永続的有効性を悪用し、nonceアカウントのauthorityを乗っ取った後、任意のタイミングで事前署名済みトランザクションを送信できるようにしました。Nonce Guardianは攻撃者が使用した同一のRPCプリミティブを防御に転用します。",
        steps: [
          { step: "1", title: "ウォレット接続またはアドレス入力", desc: "アカウント不要。任意のSolana公開鍵アドレスを入力するだけでスキャンを開始できます——読み取り専用アクセス、署名や転送権限は一切要求しません。" },
          { step: "2", title: "無料オンチェーンスキャン", desc: "バックエンドがgetProgramAccounts(SystemProgram, { filters: [{ dataSize: 80 }, { memcmp: { offset: 8, bytes: walletAddress } }] })で関連する全Durable Nonceアカウントをスキャン。各80バイトのnonce構造体のoffset 8からauthority pubkeyを解析し、あなたのアドレスと照合します。" },
          { step: "3", title: "$1.00 USDCを支払いAIレポートをアンロック", desc: "基本スキャン結果は即時表示されます。完全なAIリスク分析には、x402プロトコル（HTTP 402 Payment Required）経由で$1.00 USDCを支払います。支払いはPhantomまたはOKXウォレット内で完了——Sakuraはあなたの資産を保管しません。" },
          { step: "4", title: "SHA-256オンチェーン証明", desc: "Claude Sonnetが完全なリスクレポートを生成後、レポート内容のSHA-256ハッシュがSolana Memo Programを通じて永久記録されます。tx signatureを持つ誰でもSolscanでAIレポートの真正性と完全性を独立検証できます。" },
        ],
        risks: [
          { level: "🚨 最高リスク", color: "#FF4444", desc: "Authorityが自分の管理外——nonceアカウントが乗っ取られ、永続的に有効な事前署名済みトランザクションがいつでも送信される可能性あり" },
          { level: "⚠️ 高リスク", color: "#FF8C00", desc: "複数の高権限nonceアカウントが検出されたが、authorityは一致——攻撃面が広い" },
          { level: "⚡ 中リスク", color: "#FFD700", desc: "Nonceアカウントは存在するが積極的に監視されていない" },
          { level: "✓ 低リスク", color: "#34C759", desc: "Durable Nonceアカウントが見つからないか、authorityが完全に自分の管理下にある" },
        ],
      },
      {
        id: "ghost-run", badge: "GHOST RUN — STRATEGY SIMULATOR", badgeColor: "#7C6FFF",
        title: "👻 Ghost Run", subtitle: "マルチステップDeFi戦略ゴースト実行エンジン",
        intro: "Ghost RunはSolanaネイティブsimulateTransactionを使用してマルチステップのクロスプロトコルDeFi戦略を完全に事前実行する世界初のプロダクトです。1つのトランザクションも承認する前に、Ghost Runはライブチェーン状態で戦略全体をリハーサル——正確なトークンデルタ、ガスコスト、競合検出を返し、「見たものがそのまま得られる」をDeFi実行の新標準とします。",
        steps: [
          { step: "1", title: "自然言語で戦略を入力", desc: "日本語、英語、中国語でDeFiプランを記述してください。例：「3 SOLをMarinadeにステークし、50 USDCをKaminoに預けて利息を得る」。コントラクトアドレスやABIの知識は不要です。" },
          { step: "2", title: "Claude AIの解析とトランザクション構築", desc: "Claude Sonnetが自然言語を解析し、プロトコル（Marinade / Kamino / Jito / Jupiter）、操作タイプ、金額を特定。@solana/web3.jsで未署名トランザクションを直接構築します。" },
          { step: "3", title: "simulateTransactionゴースト実行", desc: "構築された各トランザクションをconnection.simulateTransaction(tx, { sigVerify: false })でリアルメインネット状態に対してゴースト実行。正確なトークンデルタ（例：2.994 mSOLを受け取ります）、lamportコスト、実行ログ、潜在的エラーを返します。" },
          { step: "4", title: "確認後SAKワンクリック実行", desc: "プレビューに満足したら「実行を確認」をクリック。SAK stakeWithJup() / lendAsset()が実際にトランザクションを実行してメインネットにブロードキャスト。実行証明はSolana Memo Programを通じて永久記録。0.3%手数料、実行時のみ課金。" },
        ],
        risks: [],
      },
      {
        id: "liquidation-shield", badge: "LIQUIDATION SHIELD — ACTIVE MONITORING", badgeColor: "#FF9F0A",
        title: "⚡ Liquidation Shield", subtitle: "クロスプロトコルAI清算救済プロトコル",
        intro: "SolanaレンディングTVLは40億ドルを超えます。ボラティリティの高い市場では、Kamino / MarginFi / Solendのポジション健康係数が数秒で1.0を下回り、全額清算をトリガーします——担保の5–10%の損失が典型的です。Liquidation Shieldは事前承認されたハード支出上限を持つ業界初のクロスプロトコルAI積極的救済プロトコルです。",
        steps: [
          { step: "1", title: "救済パラメータの設定", desc: "「最大救済額（USDC）」と「トリガー健康係数閾値」を入力。システムはSPL Token ApproveでToken Programレベルで支出上限をハードロック——AIはいかなる状況でもあなたが設定した金額を超えることができません。これはToken Programが強制する硬的制約です。" },
          { step: "2", title: "貸出ポジションのスキャン", desc: "getProgramAccountsがKamino / MarginFi / Solendの貸出ポジション健康係数をスキャン。スキャンは完全無料。健康係数< 1.05（カスタマイズ可能）で救済モードに入ります。" },
          { step: "3", title: "simulateTransactionによる精確なリハーサル", desc: "@solana/web3.jsが返済トランザクションを構築し、simulateTransactionが返済後の健康係数回復値、必要USDC額、ガスコストを正確に計算——すべてリアルチェーン状態に基づきます。" },
          { step: "4", title: "SAKによる自動救済実行", desc: "事前承認範囲内でSAK lendAsset()が返済を実行し、健康係数を安全域に回復。Solana Memo Programが完全な監査チェーンを記録。救済成功時に1%サービス料を徴収——清算ペナルティ5–10%をはるかに下回ります。" },
        ],
        risks: [],
      },
    ],
    feeTitle: "料金概要",
    fees: [
      { feature: "🛡️ Nonce Guardian", free: "スキャン無料", paid: "AIレポート $1.00 USDC（x402）" },
      { feature: "👻 Ghost Run", free: "シミュレーション無料", paid: "実行手数料 0.3%（Jupiter Platform Fee）" },
      { feature: "⚡ Liquidation Shield", free: "監視無料", paid: "救済成功手数料 1%（SPL Transfer）" },
    ],
    contact: "ご質問は：", contactHandle: "𝕏 @sakuraaijp",
  },
};

export default function DocsPage() {
  const { lang } = useLang();
  const c = CONTENT[lang as Lang] ?? CONTENT.zh;

  return (
    <main style={{ minHeight: "100vh", background: "var(--bg-base)", color: "var(--text-primary)" }}>
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "60px 24px 40px" }}>

        {/* Header */}
        <div style={{ marginBottom: 56 }}>
          <Link href="/" style={{
            fontSize: 12, color: "var(--text-muted)", textDecoration: "none",
            letterSpacing: "0.08em", display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 24,
          }}>
            {c.back}
          </Link>
          <div style={{
            background: "var(--accent-soft)", border: "1px solid var(--accent-mid)",
            borderRadius: 20, padding: "4px 14px", marginBottom: 20, display: "inline-block",
          }}>
            <span style={{ fontSize: 11, color: "var(--accent)", letterSpacing: "0.15em", fontFamily: "var(--font-mono)" }}>
              {c.badge}
            </span>
          </div>
          <h1 style={{ fontSize: 32, fontWeight: 300, letterSpacing: "0.06em", fontFamily: "var(--font-heading)", marginBottom: 12 }}>
            {c.title}
          </h1>
          <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.9, maxWidth: 580 }}>
            {c.subtitle}
          </p>
        </div>

        {/* Sections */}
        {c.sections.map((section, si) => (
          <section key={section.id} id={section.id} style={{ marginBottom: 64 }}>
            {/* Section header */}
            <div style={{ marginBottom: 24 }}>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                background: `${section.badgeColor}12`, border: `1px solid ${section.badgeColor}30`,
                borderRadius: 20, padding: "4px 12px", marginBottom: 12,
              }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: section.badgeColor, display: "inline-block" }} />
                <span style={{ fontSize: 11, color: section.badgeColor, fontWeight: 500, letterSpacing: 1.2, fontFamily: "var(--font-mono)" }}>
                  {section.badge}
                </span>
              </div>
              <h2 style={{ fontSize: 22, fontWeight: 300, fontFamily: "var(--font-heading)", letterSpacing: "0.05em", marginBottom: 4 }}>
                {section.title}
              </h2>
              <div style={{ fontSize: 13, color: "var(--text-muted)", letterSpacing: "0.04em", marginBottom: 12 }}>
                {section.subtitle}
              </div>
              <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.85, maxWidth: 640 }}>
                {section.intro}
              </p>
            </div>

            {/* Steps */}
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: section.risks.length > 0 ? 24 : 0 }}>
              {section.steps.map((s) => (
                <div key={s.step} style={{
                  background: "var(--bg-card)", border: "1px solid var(--border)",
                  borderLeft: `3px solid ${section.badgeColor}`,
                  borderRadius: 10, padding: "18px 20px",
                  display: "flex", gap: 16, alignItems: "flex-start",
                }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                    background: `${section.badgeColor}18`, border: `1px solid ${section.badgeColor}40`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, fontWeight: 700, color: section.badgeColor,
                    fontFamily: "var(--font-mono)",
                  }}>{s.step}</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-primary)", marginBottom: 6, letterSpacing: "0.03em" }}>
                      {s.title}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.85 }}>
                      {s.desc}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Risk levels */}
            {section.risks.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
                {section.risks.map((r, ri) => (
                  <div key={ri} style={{
                    background: "var(--bg-card)", border: `1px solid ${r.color}25`,
                    borderLeft: `3px solid ${r.color}`, borderRadius: 8, padding: "12px 16px",
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: r.color, marginBottom: 4 }}>{r.level}</div>
                    <div style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.7 }}>{r.desc}</div>
                  </div>
                ))}
              </div>
            )}

            {si < c.sections.length - 1 && (
              <div style={{ borderBottom: "1px solid var(--border)", marginTop: 48 }} />
            )}
          </section>
        ))}

        {/* Fee summary */}
        <div style={{
          background: "var(--bg-card)", border: "1px solid var(--border)",
          borderTop: "2px solid var(--gold)", borderRadius: 10, padding: "24px 28px", marginBottom: 48,
        }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)", letterSpacing: "0.12em", marginBottom: 16, fontFamily: "var(--font-mono)" }}>
            {c.feeTitle}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 1, background: "var(--border)", borderRadius: 8, overflow: "hidden" }}>
            {c.fees.map(f => (
              <div key={f.feature} style={{ background: "var(--bg-base)", padding: "16px 18px" }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: "var(--text-primary)", marginBottom: 8 }}>{f.feature}</div>
                <div style={{ fontSize: 11, color: "var(--green)", marginBottom: 4 }}>✓ {f.free}</div>
                <div style={{ fontSize: 11, color: "var(--gold)" }}>★ {f.paid}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ textAlign: "center", fontSize: 12, color: "var(--text-muted)", letterSpacing: "0.06em" }}>
          {c.contact}
          <a href="https://x.com/sakuraaijp" target="_blank" rel="noopener noreferrer"
            style={{ color: "var(--accent)", marginLeft: 6, textDecoration: "none" }}>
            {c.contactHandle}
          </a>
        </div>
      </div>
      <Footer />
    </main>
  );
}
