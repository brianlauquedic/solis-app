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
    badge: "🌸 DOCUMENTATION · COLOSSEUM 2026 FRONTIER",
    title: "Sakura 使用手冊",
    subtitle: "2026 年 4 月，$2.85 億在一個幾乎無人審計的 Solana 原語上消失——Nonce Guardian 就是對這次攻擊的技術反制。同年，多步 DeFi 執行的隱性滑點損失每日高達數百萬美元——Ghost Run 以 simulateTransaction 在零資本風險下精確預演整個策略。而 $40 億借貸 TVL 的清算損失，正被一個 400ms AI 救援協議守護。三道 Solana 原生防線，每個 AI 決策 SHA-256 永久上鏈，無需信任任何服務器——這是完整的工程文檔。",
    sections: [
      {
        id: "nonce-guardian", badge: "PROTOCOL I · DURABLE NONCE GUARDIAN", badgeColor: "#FF4444",
        title: "🛡️ Nonce Guardian", subtitle: "全球首個主動式 Durable Nonce 攻擊向量防禦協議",
        intro: "2026 年 4 月 1 日，一次精心策劃的攻擊讓 Drift 協議損失 $2.85 億。攻擊者利用的不是閃貸，不是預言機操控——而是 Solana Durable Nonce 的「永久有效簽名」特性：一旦 nonce 賬戶的 authority 被劫持，攻擊者可在任意時間——數週後、數月後——提交早已預先簽名的惡意交易，等待最佳時機一擊致命。絕大多數用戶對此毫不知情。Nonce Guardian 的誕生正是為了打破這個信息不對稱：用攻擊者自己所用的 RPC 原語 getProgramAccounts，在他們行動之前，將所有潛在炸彈一一排查。這是 Sakura 匠人精神的第一道防線——靜默、精準、永不下線。",
        steps: [
          { step: "1", title: "零帳號接入 · 唯讀掃描授權", desc: "無需創建任何帳號、無需 KYC、無需訂閱。輸入任意 Solana 公鑰地址（或連接 Phantom / OKX 錢包），立即進入掃描流程。Sakura 僅讀取鏈上公開數據，不請求任何簽名授權或資產轉移權限——這是底層設計原則，而非承諾。" },
          { step: "2", title: "getProgramAccounts 精密掃描 · 80 位元組結構體解析", desc: "後端以 getProgramAccounts(SystemProgram.programId, { filters: [{ dataSize: 80 }, { memcmp: { offset: 8, bytes: walletAddress } }] }) 掃描所有關聯 Durable Nonce 賬戶。每個 nonce 賬戶佔 80 bytes，offset 8 處存儲 authority pubkey。Sakura 逐一解析，與您的錢包地址比對，識別所有 authority 異常信號——這與 Drift 攻擊者使用的是完全相同的 RPC 調用，只是目的相反：保護而非攻擊。" },
          { step: "3", title: "x402 微支付 · $1.00 USDC 解鎖完整 AI 風險報告", desc: "免費掃描結果立即呈現所有 nonce 賬戶與 authority 關係。如需 Claude Sonnet 深度 AI 風險分析報告（含具體攻擊路徑模擬、緊急建議、風險優先級排序），透過 x402 協議（HTTP 402 Payment Required）支付 $1.00 USDC。支付在您的 Phantom 或 OKX 錢包內完成——Sakura 永不持有您的資產，這是鏈上原生設計的硬性保證。" },
          { step: "4", title: "SHA-256 鏈上存證 · 不可篡改的安全審計記錄", desc: "Claude Sonnet 生成完整風險報告後，報告全文的 SHA-256 加密哈希透過 Solana Memo Program 永久寫入主網。tx signature 公開可查。任何人——包括您的律師、審計師、或投資機構——持有 tx signature 即可在 Solscan 獨立核驗 AI 報告的真實性與完整性，無需信任 Sakura 的服務器。這是去中心化語境下唯一真正可信的 AI 透明度機制。" },
        ],
        risks: [
          { level: "🚨 極高風險 · 立即行動", color: "#FF4444", desc: "Authority 不由您控制——nonce 賬戶已被劫持。攻擊者持有永久有效的預簽名交易，可在任意時刻提交。立即將資產轉移至安全地址，並撤銷所有相關授權。" },
          { level: "⚠️ 高風險 · 建議審查", color: "#FF8C00", desc: "發現多個高權限 nonce 賬戶，authority 一致但攻擊面廣——任何一個賬戶被劫持均可觸發鏈式風險。建議立即清點並關閉不必要的 nonce 賬戶。" },
          { level: "⚡ 中風險 · 持續監控", color: "#FFD700", desc: "Nonce 賬戶存在且 authority 由您控制，但缺乏主動監控機制。建議定期以 Nonce Guardian 掃描，任何 authority 變更將即時告警。" },
          { level: "✓ 低風險 · 健康狀態", color: "#34C759", desc: "未發現 Durable Nonce 賬戶，或所有 nonce 賬戶的 authority 完全在您掌控之內。鏈上安全狀態良好。" },
        ],
      },
      {
        id: "ghost-run", badge: "PROTOCOL II · GHOST RUN — STRATEGY SIMULATOR", badgeColor: "#7C6FFF",
        title: "👻 Ghost Run", subtitle: "全球首個多步跨協議 DeFi 策略幽靈執行引擎",
        intro: "在 DeFi 世界，每一次執行都是一次「真金白銀的實驗」——滑點、流動性深度變化、多步策略間的合約衝突，任何一個變量都可能讓預期收益化為損失。機構交易者在執行大額倉位前，會在沙盒環境中反覆模擬；普通用戶沒有這個條件。Ghost Run 改變了這一切。它是全球首個利用 Solana 原生 simulateTransaction RPC 對多步跨協議 DeFi 策略進行完整鏈上預執行的消費級產品。在您授權任何一筆交易、承擔任何資本風險之前，Ghost Run 已在真實主網狀態下——使用真實流動性數據、真實合約邏輯——完整演練整個策略，返回精確 token delta、gas 消耗與衝突檢測。所見即所得，不再是口號，而是技術保證。",
        steps: [
          { step: "1", title: "自然語言策略輸入 · 三語支持", desc: "以中文、英文或日文自然描述您的 DeFi 策略意圖。例：「質押 3 SOL 到 Marinade 換取 mSOL 流動性質押收益，同時將 100 USDC 存入 Kamino 賺取借貸利息」。無需了解任何智能合約地址、ABI 格式或協議參數——Sakura 理解您的意圖。" },
          { step: "2", title: "Claude AI 意圖解析 · @solana/web3.js 交易構建", desc: "Claude Sonnet 解析策略意圖，精確識別涉及的協議（Marinade / Kamino / Jito / Jupiter）、操作類型（stake / lend / swap）及具體金額。系統以 @solana/web3.js 直接構建對應的未簽名 Solana 交易——不使用 SAK，因為幽靈執行需要未簽名交易的完整控制權。" },
          { step: "3", title: "simulateTransaction 幽靈執行 · 零資本風險", desc: "每一筆構建好的交易以 connection.simulateTransaction(tx, { sigVerify: false }) 在真實主網狀態下幽靈執行。返回精確 token delta（例：您將收到 2.994 mSOL，APY 7.2% = 年化收益 +$21.3）、lamport 消耗、完整執行日誌與任何潛在的合約衝突或滑點警告。所有數字基於真實鏈上狀態，不是估算，而是精確預測。" },
          { step: "4", title: "一鍵確認 · SAK 執行 · Memo 鏈上存證", desc: "對預覽結果滿意後，點擊「確認執行」。Solana Agent Kit（SAK）的 stakeWithJup() / lendAsset() 真正執行交易並廣播至主網。執行憑證（含策略摘要、token delta、tx signature）透過 Solana Memo Program 永久上鏈作為不可篡改的執行記錄。執行費 0.3%，透過 Jupiter Platform Fee 機制收取，僅在實際執行時產生，模擬永遠免費。" },
        ],
        risks: [],
      },
      {
        id: "liquidation-shield", badge: "PROTOCOL III · LIQUIDATION SHIELD — ACTIVE RESCUE", badgeColor: "#FF9F0A",
        title: "⚡ Liquidation Shield", subtitle: "全球首個跨協議 AI 預授權清算救援協議",
        intro: "Solana 借貸市場總鎖倉量（TVL）超過 $40 億，涵蓋 Kamino、MarginFi、Solend 三大主流借貸協議。這 $40 億背後是數以萬計的普通用戶——他們用 SOL 或 LST 作為抵押品借入 USDC，以 2–3 倍槓桿參與 DeFi 收益。但當市場在 10 分鐘內暴跌 15%，健康因子從 1.3 跌至 0.95，清算人機器人已在毫秒內完成清算——損失通常高達抵押品的 5–10%。用戶在手機上看到通知的那一刻，一切已經太晚。Liquidation Shield 是業界首個真正解決這一問題的協議：跨協議（Kamino / MarginFi / Solend）、有預授權 SPL Token Approve 硬性資金上限、simulateTransaction 精確預演救援效果，SAK 在 400ms 內完成自動還款執行，Memo Program 留存完整審計鏈。這不是軟件承諾——每一個約束都在 Solana 區塊鏈層面強制執行。",
        steps: [
          { step: "1", title: "SPL Token Approve · 設定不可逾越的硬性救援授權上限", desc: "在 Phantom / OKX 錢包中執行 SPL Token createApproveInstruction，設定「最大授權救援金額（USDC）」與「觸發健康因子閾值（建議 1.05–1.15）」。這個授權上限由 Solana Token Program 在鏈上強制執行——不是 Sakura 的承諾，不是智能合約的 if 條件，而是 token program 的原生硬性約束。AI 在任何情況下都無法轉移超出授權上限的 USDC，這是去中心化語境下唯一真正可信的資金安全機制。" },
          { step: "2", title: "getProgramAccounts 跨協議健康因子監控 · 完全免費", desc: "Sakura 以 getProgramAccounts 持續掃描 Kamino / MarginFi / Solend 的借貸倉位健康因子。監控完全免費，無需付費訂閱。當健康因子觸及您設定的閾值（默認 < 1.05），系統立即進入救援模式——在清算發生之前，而非之後。" },
          { step: "3", title: "simulateTransaction 精確預演 · 確認救援效果再執行", desc: "@solana/web3.js 構建針對您倉位的還款交易，simulateTransaction 在真實主網狀態下精確計算：還款後健康因子恢復至多少（例：從 1.02 恢復至 1.45）、所需 USDC 金額、gas 消耗、是否在預授權範圍內。所有數字基於真實鏈上狀態，不是估算。您可在執行前完整確認救援方案的效果。" },
          { step: "4", title: "SAK 400ms 自動執行救援 · Memo 審計鏈", desc: "在預授權 SPL Token 上限範圍內，SAK lendAsset() 自動執行 USDC 還款，將健康因子恢復至安全區間，避免清算觸發。Solana Memo Program 寫入完整審計鏈——含 rescue mandate tx signature、觸發健康因子、執行金額、執行後健康因子。救援成功後收取 1% 服務費（透過 SPL Token transfer 收取）——相較清算損失的 5–10%，用戶淨節省 4–9%。這是 Sakura 承諾的具體數字，而非模糊的「幫您省錢」。" },
        ],
        risks: [],
      },
    ],
    feeTitle: "透明費用結構 · 按使用付費，無隱藏收費",
    fees: [
      { feature: "🛡️ Nonce Guardian", free: "✓ 鏈上掃描永久免費", paid: "AI 深度風險報告 $1.00 USDC（x402 鏈上支付）" },
      { feature: "👻 Ghost Run", free: "✓ 幽靈模擬永久免費", paid: "執行費 0.3%（Jupiter Platform Fee 機制，嵌入交易，完全透明）" },
      { feature: "⚡ Liquidation Shield", free: "✓ 健康因子監控永久免費", paid: "救援成功費 1%（SPL Token Transfer，僅成功時收取，失敗不收費）" },
    ],
    contact: "技術問題、合作諮詢、媒體採訪：", contactHandle: "𝕏 @sakuraaijp",
  },
  en: {
    back: "← Back to Home",
    badge: "🌸 DOCUMENTATION · COLOSSEUM 2026 FRONTIER",
    title: "Sakura Documentation",
    subtitle: "In April 2026, $285 million disappeared through a Solana primitive that almost nobody had audited — Nonce Guardian is the direct technical counter to that attack. Every day, multi-step DeFi execution bleeds millions in hidden slippage — Ghost Run pre-executes entire strategies with simulateTransaction at zero capital risk. And $4B in lending TVL is defended by a 400ms AI rescue protocol. Three Solana-native defense lines. Every AI decision SHA-256 inscribed on-chain, verifiable without trusting any server. This is the complete engineering documentation.",
    sections: [
      {
        id: "nonce-guardian", badge: "PROTOCOL I · DURABLE NONCE GUARDIAN", badgeColor: "#FF4444",
        title: "🛡️ Nonce Guardian", subtitle: "The World's First Proactive Durable Nonce Attack Vector Defense Protocol",
        intro: "On April 1, 2026, a precisely engineered attack drained $285 million from Drift Protocol. The weapon was not a flash loan. It was not an oracle manipulation. It was a Solana Durable Nonce — a legitimate cryptographic primitive designed for offline transaction signing — whose 'permanently valid signature' property was turned against its users. Once a nonce account's authority is hijacked, an attacker can hold a pre-signed transaction for weeks or months, waiting for the optimal moment to strike. Most users have no idea such accounts exist in their wallet's attack surface. Nonce Guardian was built to close this information gap. Using the exact same RPC primitive — getProgramAccounts — that attackers use to map their targets, Nonce Guardian scans and flags every risk signal before any adversary can act. This is Sakura's first line of defense: silent, precise, and always online.",
        steps: [
          { step: "1", title: "Zero-account access · Read-only by design", desc: "No account creation, no KYC, no subscription required. Enter any Solana public key — or connect your Phantom / OKX wallet — to begin immediately. Sakura reads only publicly visible on-chain data and requests zero signing or transfer permissions. This is an architectural guarantee, not a policy statement." },
          { step: "2", title: "getProgramAccounts precision scan · 80-byte struct parsing", desc: "The backend executes getProgramAccounts(SystemProgram.programId, { filters: [{ dataSize: 80 }, { memcmp: { offset: 8, bytes: walletAddress } }] }) against Solana mainnet. Every nonce account is exactly 80 bytes; offset 8 stores the authority pubkey. Sakura parses each struct and flags any authority mismatch — the identical RPC call attackers use, repurposed as your shield." },
          { step: "3", title: "x402 micro-payment · $1.00 USDC unlocks full AI risk report", desc: "The free scan immediately surfaces all nonce accounts and their authority relationships. For a full Claude Sonnet AI risk analysis — including simulated attack path modeling, prioritized remediation recommendations, and risk severity scoring — pay $1.00 USDC via x402 (HTTP 402 Payment Required). Payment settles in your Phantom or OKX wallet. Sakura never holds your assets. This is a hard guarantee enforced by on-chain architecture, not user agreement." },
          { step: "4", title: "SHA-256 on-chain proof · Immutable security audit record", desc: "Once Claude Sonnet generates the complete risk report, the SHA-256 cryptographic hash of the full report is permanently inscribed on Solana mainnet via the Memo Program. The tx signature is publicly visible. Any party — your legal counsel, institutional auditor, or compliance team — holding the tx signature can independently verify the report's authenticity and integrity on Solscan, with zero reliance on Sakura's servers. This is the highest standard of AI accountability available today." },
        ],
        risks: [
          { level: "🚨 Critical · Act Immediately", color: "#FF4444", desc: "Authority not controlled by you — nonce account compromised. Attacker holds a permanently valid pre-signed transaction executable at any moment. Transfer assets to a clean address and revoke all related permissions immediately." },
          { level: "⚠️ High · Review Required", color: "#FF8C00", desc: "Multiple high-privilege nonce accounts with consistent authority — wide attack surface. Compromise of any single account creates chain-level risk. Audit and close unnecessary nonce accounts." },
          { level: "⚡ Medium", color: "#FFD700", desc: "Nonce accounts exist but are not actively monitored" },
          { level: "✓ Low", color: "#34C759", desc: "No Durable Nonce accounts found, or authority is fully under your control" },
        ],
      },
      {
        id: "ghost-run", badge: "PROTOCOL II · GHOST RUN — STRATEGY SIMULATOR", badgeColor: "#7C6FFF",
        title: "👻 Ghost Run", subtitle: "The World's First Multi-Step Cross-Protocol DeFi Strategy Ghost Execution Engine",
        intro: "In DeFi, every execution has historically been a live experiment with real capital. Slippage, liquidity depth fluctuations, inter-protocol transaction ordering conflicts — any variable can turn an expected yield into an unexpected loss. Institutional traders run sandbox simulations before executing large positions. Individual users never had that option. Until now. Ghost Run is the world's first consumer-grade product to leverage Solana's native simulateTransaction RPC for complete, multi-step cross-protocol DeFi strategy pre-execution. Before you authorize a single transaction or commit a single dollar, Ghost Run has already fully rehearsed your entire strategy against live mainnet state — using real liquidity data, real contract logic, real fee structures. The result is not an estimate. It is the exact outcome you will receive, displayed before you decide. What you see is what you get. Not as a marketing promise — as a technical guarantee.",
        steps: [
          { step: "1", title: "Natural language strategy input · Trilingual", desc: "Describe your DeFi strategy intent in English, Chinese, or Japanese. Example: 'Stake 3 SOL with Marinade for liquid staking yield and deposit 100 USDC into Kamino for lending interest.' No knowledge of smart contract addresses, ABIs, or protocol parameters required. Sakura understands your intent." },
          { step: "2", title: "Claude AI intent parsing · @solana/web3.js transaction building", desc: "Claude Sonnet parses the strategy intent, precisely identifies the protocols involved (Marinade / Kamino / Jito / Jupiter), operation types (stake / lend / swap), and specific amounts. The system builds corresponding unsigned Solana transactions directly with @solana/web3.js — not SAK, because ghost execution requires full control of unsigned transactions." },
          { step: "3", title: "simulateTransaction ghost execution · Zero capital at risk", desc: "Each constructed transaction is ghost-executed with connection.simulateTransaction(tx, { sigVerify: false }) against real mainnet state. Returns exact token deltas (e.g. you will receive 2.994 mSOL, APY 7.2% = +$21.3/year), lamport costs, complete execution logs, and any contract conflicts or slippage warnings. All figures are based on real on-chain state — not estimates, but precise predictions." },
          { step: "4", title: "One-click SAK execution · Memo on-chain proof", desc: "When satisfied with the preview, click Confirm Execute. Solana Agent Kit (SAK) stakeWithJup() / lendAsset() executes the real transactions and broadcasts to mainnet. An immutable execution record (strategy summary, token deltas, tx signatures) is inscribed on-chain via Solana Memo Program. 0.3% platform fee collected via Jupiter Platform Fee mechanism — fully transparent, only charged on actual execution. Simulation is always free." },
        ],
        risks: [],
      },
      {
        id: "liquidation-shield", badge: "PROTOCOL III · LIQUIDATION SHIELD — ACTIVE RESCUE", badgeColor: "#FF9F0A",
        title: "⚡ Liquidation Shield", subtitle: "The World's First Cross-Protocol AI Pre-Authorized Liquidation Rescue Protocol",
        intro: "Solana's lending market has exceeded $4 billion in Total Value Locked, spread across Kamino, MarginFi, and Solend. Behind that $4B are tens of thousands of ordinary users — collateralizing SOL or liquid staking tokens to borrow USDC, operating at 2–3x leverage to capture DeFi yields. When markets fall 15% in ten minutes, health factors drop from 1.3 to 0.95. Liquidator bots — running on co-located infrastructure with microsecond reaction times — complete the liquidation before most users receive a push notification. The loss: 5–10% of total collateral, in seconds. Liquidation Shield is the first protocol that genuinely solves this problem for ordinary users. Cross-protocol coverage (Kamino / MarginFi / Solend), pre-authorized SPL Token Approve hard spending cap, simulateTransaction rescue preview, SAK automated execution within 400 milliseconds, and Memo Program audit chain. Not a software promise. Every constraint enforced at the Solana blockchain layer.",
        steps: [
          { step: "1", title: "SPL Token Approve · Set a non-negotiable hard rescue spending cap", desc: "Execute SPL Token createApproveInstruction in your Phantom / OKX wallet to authorize a maximum rescue amount in USDC and set a trigger health factor threshold (recommended 1.05–1.15). This spending cap is enforced by the Solana Token Program at the blockchain layer — not by Sakura's promise, not by a smart contract if-statement, but by the token program's native constraint. The AI cannot transfer more USDC than you have authorized under any circumstances." },
          { step: "2", title: "Cross-protocol health factor monitoring · Completely free", desc: "Sakura uses getProgramAccounts to continuously scan lending position health factors across Kamino / MarginFi / Solend. Monitoring is permanently free, no subscription required. When your health factor touches your configured threshold (default < 1.05), rescue mode activates — before liquidation, not after." },
          { step: "3", title: "simulateTransaction rescue preview · Verify outcomes before execution", desc: "@solana/web3.js constructs the repayment transaction for your specific position. simulateTransaction calculates against live mainnet state: exact post-repayment health factor recovery (e.g. from 1.02 to 1.45), required USDC amount, gas costs, and confirmation that the rescue is within the pre-authorized cap. You see the precise outcome before committing." },
          { step: "4", title: "SAK 400ms auto-rescue · Complete on-chain audit chain", desc: "Within the pre-authorized SPL Token limit, SAK lendAsset() executes the USDC repayment, restoring your health factor to safety before liquidation triggers. Solana Memo Program inscribes the full audit chain — rescue mandate tx signature, trigger health factor, executed amount, post-rescue health factor. 1% success-only service fee charged via SPL Token transfer. Net user savings vs. liquidation: 4–9%. These are concrete numbers, not vague assurances." },
        ],
        risks: [],
      },
    ],
    feeTitle: "Transparent Fee Structure · Pay-per-use, zero hidden charges",
    fees: [
      { feature: "🛡️ Nonce Guardian", free: "✓ On-chain scan forever free", paid: "AI risk report $1.00 USDC (x402 on-chain payment)" },
      { feature: "👻 Ghost Run", free: "✓ Ghost simulation forever free", paid: "0.3% execution fee (Jupiter Platform Fee, embedded in tx, fully transparent)" },
      { feature: "⚡ Liquidation Shield", free: "✓ Health factor monitoring forever free", paid: "1% rescue fee on success only (SPL Token Transfer, zero charge on failure)" },
    ],
    contact: "Technical questions, partnerships, media:", contactHandle: "𝕏 @sakuraaijp",
  },
  ja: {
    back: "← ホームへ戻る",
    badge: "🌸 ドキュメント · COLOSSEUM 2026 FRONTIER",
    title: "Sakura 使用マニュアル",
    subtitle: "3つのSolanaネイティブAI防衛プロトコルの完全エンジニアリング文書。備えあれば憂いなし。匠の精神で磨き上げられたSakuraは、機関投資家級のオンチェーンセキュリティをすべてのユーザーへ届けます。getProgramAccounts脅威スキャン、simulateTransactionゴースト実行、SPL Token Approveによる超えられない強制上限。すべて透明。すべてオンチェーンで検証可能。信頼不要。",
    sections: [
      {
        id: "nonce-guardian", badge: "プロトコル I · DURABLE NONCE GUARDIAN", badgeColor: "#FF4444",
        title: "🛡️ Nonce Guardian", subtitle: "世界初の能動的Durable Nonce攻撃ベクター防衛プロトコル",
        intro: "2026年4月1日、綿密に計画された攻撃がDriftプロトコルから2億8500万ドルを奪いました。武器はフラッシュローンでも、オラクル操作でもありませんでした。SolanaのDurable Nonce——オフライン署名のために設計された正当な暗号プリミティブ——の「永続的に有効な署名」特性が悪用されたのです。nonceアカウントのauthorityが乗っ取られると、攻撃者は事前署名済みのトランザクションを何週間も保持し、最適なタイミングを待って実行できます。ほとんどのユーザーはこのような攻撃面が存在することすら知りません。Nonce Guardianはこの情報格差を解消します——攻撃者が使うのと全く同じRPC原語で、あなたを守ります。これがSakuraの匠の精神による第一の防衛線。",
        steps: [
          { step: "1", title: "ゼロアカウント接続 · 読み取り専用設計", desc: "アカウント作成不要、KYC不要、サブスクリプション不要。任意のSolana公開鍵を入力するか、Phantom / OKXウォレットを接続するだけで即座に開始。Sakuraは公開オンチェーンデータのみを読み取り、署名や転送権限は一切要求しません。これはポリシーではなく、アーキテクチャレベルの保証です。" },
          { step: "2", title: "getProgramAccounts精密スキャン · 80バイト構造体解析", desc: "バックエンドがgetProgramAccounts(SystemProgram.programId, { filters: [{ dataSize: 80 }, { memcmp: { offset: 8, bytes: walletAddress } }] })をSolanaメインネットに対して実行。各nonceアカウントは80バイト、offset 8にauthority pubkeyを格納。Sakuraは各構造体を解析してauthorityの不一致をフラグします——攻撃者が標的マッピングに使う完全に同一のRPC呼び出しを、盾として転用します。" },
          { step: "3", title: "x402マイクロ決済 · $1.00 USDCで完全AIリスクレポートをアンロック", desc: "無料スキャンで全nonceアカウントとauthority関係を即座に表示。完全なClaude Sonnet AIリスク分析——攻撃経路シミュレーション、優先度別修復推奨、リスク深刻度スコアリングを含む——には、x402（HTTP 402 Payment Required）経由で$1.00 USDCを支払います。支払いはPhantomまたはOKXウォレット内で完了。Sakuraはあなたの資産を保管しません。" },
          { step: "4", title: "SHA-256オンチェーン証明 · 改ざん不可能なセキュリティ監査記録", desc: "Claude Sonnetが完全なリスクレポートを生成後、レポート全文のSHA-256暗号ハッシュがSolana Memo Programを通じてメインネットに永久刻印。tx signatureは公開。弁護士、機関監査人、コンプライアンスチームなど、tx signatureを持つ誰でもSolscanでレポートの真正性を独立検証可能——Sakuraのサーバーへの依存ゼロ。" },
        ],
        risks: [
          { level: "🚨 最高リスク · 即座に行動", color: "#FF4444", desc: "Authorityが自分の管理外——nonceアカウント乗っ取り済み。攻撃者は永続的に有効な事前署名済みトランザクションを任意の瞬間に実行可能。直ちに資産を安全なアドレスへ移動し、関連する全ての権限を取り消してください。" },
          { level: "⚠️ 高リスク · 審査を推奨", color: "#FF8C00", desc: "複数の高権限nonceアカウントを検出。authorityは一致しているが攻撃面が広い。いずれか1つのアカウントが侵害されるとチェーンレベルのリスクが発生。不要なnonceアカウントを監査・閉鎖することを推奨。" },
          { level: "⚡ 中リスク · 継続監視を推奨", color: "#FFD700", desc: "Nonceアカウントは存在し、authorityは自分の管理下にあるが、積極的な監視機構がない。定期的にNonce Guardianでスキャンし、authorityの変更を即座に検出することを推奨。" },
          { level: "✓ 低リスク · 健全な状態", color: "#34C759", desc: "Durable Nonceアカウントが見つからないか、全nonceアカウントのauthorityが完全に自分の管理下にある。オンチェーンセキュリティ状態は良好。" },
        ],
      },
      {
        id: "ghost-run", badge: "プロトコル II · GHOST RUN — STRATEGY SIMULATOR", badgeColor: "#7C6FFF",
        title: "👻 Ghost Run", subtitle: "世界初のマルチステップ・クロスプロトコルDeFi戦略ゴースト実行エンジン",
        intro: "DeFiにおいて、これまでのすべての実行はリアルな資本を使った「実験」でした。スリッページ、流動性の深度変動、プロトコル間のトランザクション順序の競合——どの変数も期待した利回りを損失に変える可能性があります。機関投資家は大口ポジションを実行する前にサンドボックス環境でシミュレーションを行います。個人ユーザーにはその選択肢がありませんでした——Ghost Runが登場するまでは。Ghost Runは、SolanaネイティブのsimulateTransaction RPCを使用してマルチステップ・クロスプロトコルDeFi戦略を完全に事前実行する世界初の消費者向けプロダクトです。1つのトランザクションも承認せず、1ドルも資本リスクにさらす前に、Ghost Runはすでにリアルなメインネット状態——リアルな流動性データ、リアルなコントラクトロジック——で戦略全体をリハーサルし、正確なtoken delta、ガスコスト、競合検出を返します。見たものがそのまま得られる——マーケティングの約束としてではなく、技術的保証として。",
        steps: [
          { step: "1", title: "自然言語戦略入力 · 三言語対応", desc: "日本語、英語、中国語でDeFi戦略の意図を自然に記述。例：「3 SOLをMarinadeにステークして流動性ステーキング収益を得ながら、100 USDCをKaminoに預けて貸付利息を得る」。スマートコントラクトアドレス、ABI形式、プロトコルパラメータの知識は不要。Sakuraがあなたの意図を理解します。" },
          { step: "2", title: "Claude AI意図解析 · @solana/web3.jsトランザクション構築", desc: "Claude Sonnetが戦略の意図を解析し、関係するプロトコル（Marinade / Kamino / Jito / Jupiter）、操作タイプ（stake / lend / swap）、具体的な金額を正確に特定。対応する未署名Solanaトランザクションを@solana/web3.jsで直接構築します——ゴースト実行には未署名トランザクションの完全な制御が必要なため、SAKは使用しません。" },
          { step: "3", title: "simulateTransactionゴースト実行 · 資本リスクゼロ", desc: "構築された各トランザクションをconnection.simulateTransaction(tx, { sigVerify: false })でリアルメインネット状態に対してゴースト実行。正確なtoken delta（例：2.994 mSOLを受け取ります、APY 7.2% = 年間+$21.3）、lamportコスト、完全な実行ログ、コントラクト競合やスリッページ警告を返します。すべての数値はリアルなオンチェーン状態に基づく——推定ではなく、正確な予測。" },
          { step: "4", title: "ワンクリックSAK実行 · Memoオンチェーン証明", desc: "プレビューに満足したら「実行を確認」をクリック。Solana Agent Kit（SAK）のstakeWithJup() / lendAsset()が実際のトランザクションを実行してメインネットにブロードキャスト。不変の実行記録（戦略サマリー、token delta、tx signature）がSolana Memo Programを通じてオンチェーンに刻印。0.3%プラットフォーム料金はJupiter Platform Feeメカニズムで収集——完全透明、実際の実行時のみ課金。シミュレーションは常に無料。" },
        ],
        risks: [],
      },
      {
        id: "liquidation-shield", badge: "プロトコル III · LIQUIDATION SHIELD — ACTIVE RESCUE", badgeColor: "#FF9F0A",
        title: "⚡ Liquidation Shield", subtitle: "世界初のクロスプロトコルAI事前承認清算救済プロトコル",
        intro: "SolanaのレンディングTVLは40億ドルを超え、Kamino、MarginFi、Solendの3大プロトコルに分散しています。この40億ドルの背後には数万人の普通のユーザーがいます——SOLやLSTを担保にUSDCを借り入れ、2〜3倍のレバレッジでDeFi利回りを得ようとしています。市場が10分間で15%下落すると、健康係数は1.3から0.95に急落します。共同設置インフラでマイクロ秒の反応時間を持つ清算ボットが、ほとんどのユーザーがプッシュ通知を受け取る前に清算を完了させます。損失は担保の5〜10%、秒単位で。Liquidation Shieldは普通のユーザーのためにこの問題を真に解決する初のプロトコルです。クロスプロトコル対応（Kamino / MarginFi / Solend）、SPL Token Approve事前承認ハード支出上限、simulateTransaction救済プレビュー、SAK自動実行400ミリ秒以内、Memo Programによる監査チェーン。ソフトウェアの約束ではありません——すべての制約がSolanaブロックチェーン層で強制実行されます。",
        steps: [
          { step: "1", title: "SPL Token Approve · 越えられないハード救済支出上限の設定", desc: "Phantom / OKXウォレットでSPL Token createApproveInstructionを実行し、最大救済額（USDC）とトリガー健康係数閾値（推奨1.05〜1.15）を設定。この支出上限はSolana Token Programによってブロックチェーン層で強制実行——Sakuraの約束でも、スマートコントラクトのif文でもなく、token programのネイティブ制約です。AIはいかなる状況でも承認上限を超えてUSDCを転送できません。" },
          { step: "2", title: "クロスプロトコル健康係数モニタリング · 完全無料", desc: "SakuraはgetProgramAccountsを使用してKamino / MarginFi / Solendの貸出ポジション健康係数を継続的にスキャン。モニタリングは永続的に無料、サブスクリプション不要。健康係数が設定した閾値（デフォルト< 1.05）に達すると救済モードが起動——清算後ではなく、清算前に。" },
          { step: "3", title: "simulateTransaction救済プレビュー · 実行前に結果を確認", desc: "@solana/web3.jsがあなたの特定ポジションの返済トランザクションを構築。simulateTransactionがリアルなメインネット状態に対して正確に計算：返済後の健康係数回復値（例：1.02から1.45へ）、必要USDC額、ガスコスト、救済が事前承認上限内かの確認。コミット前に正確な結果を確認できます。" },
          { step: "4", title: "SAK 400ms自動救済 · 完全なオンチェーン監査チェーン", desc: "SPL Token事前承認上限内で、SAK lendAsset()がUSDC返済を実行し、清算トリガー前に健康係数を安全域に回復。Solana Memo Programが完全な監査チェーンを刻印——rescue mandate tx signature、トリガー健康係数、実行額、救済後健康係数。成功時のみ1%サービス料をSPL Token transferで徴収。清算との比較でのユーザー純節約：4〜9%。曖昧な「お金を節約します」ではなく、具体的な数字です。" },
        ],
        risks: [],
      },
    ],
    feeTitle: "透明な料金体系 · 使用量課金、隠れた料金なし",
    fees: [
      { feature: "🛡️ Nonce Guardian", free: "✓ オンチェーンスキャン永続無料", paid: "AIリスクレポート $1.00 USDC（x402オンチェーン決済）" },
      { feature: "👻 Ghost Run", free: "✓ ゴーストシミュレーション永続無料", paid: "0.3%実行手数料（Jupiter Platform Fee、txに組み込み済み、完全透明）" },
      { feature: "⚡ Liquidation Shield", free: "✓ 健康係数モニタリング永続無料", paid: "成功時のみ1%救済手数料（SPL Token Transfer、失敗時は無料）" },
    ],
    contact: "技術的な質問、提携、メディア取材：", contactHandle: "𝕏 @sakuraaijp",
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

        {/* Sakura intro block */}
        <div style={{
          background: "var(--bg-card)", border: "1px solid var(--border)",
          borderLeft: "3px solid var(--accent)", borderRadius: 10,
          padding: "20px 24px", marginBottom: 48,
          display: "flex", gap: 16, alignItems: "flex-start",
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8, flexShrink: 0,
            background: "var(--accent-soft)", border: "1px solid var(--accent-mid)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, fontFamily: "var(--font-heading)", color: "var(--accent)",
          }}>桜</div>
          <div>
            <div style={{ fontSize: 9, letterSpacing: "0.2em", color: "var(--accent)", fontFamily: "var(--font-mono)", marginBottom: 6, textTransform: "uppercase" }}>
              🌸 Sakura AI Guardian · 備えあれば憂いなし · 匠の精神
            </div>
            <div style={{ fontSize: 13, fontWeight: 400, color: "var(--text-primary)", marginBottom: 8, fontFamily: "var(--font-heading)", letterSpacing: "0.04em" }}>
              {lang === "zh" ? "三道 Solana 原生防線 · 以匠人精神應對三個真實威脅 · 每項 AI 決策鏈上可驗證" :
               lang === "ja" ? "3つのSolanaネイティブ防衛ライン · 匠の精神で3つの現実の脅威に対応 · すべてのAI判断がオンチェーン検証可能" :
               "Three Solana-native defenses against three real threats · Every AI decision independently verifiable on-chain"}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.9 }}>
              {lang === "zh"
                ? "對沖基金用 24 小時監控室守護倉位；普通用戶只能在手機通知響起的那一刻才知道已經太晚。Sakura 正是為了改變這個不平等而生。三個 Solana 原生 RPC 原語，三道不對稱防線：getProgramAccounts 以攻擊者的武器反守為攻，在 Nonce authority 被劫持的那一刻之前掃清威脅；simulateTransaction 是全球首個消費者級多步 DeFi 策略完整幽靈執行——在您承擔任何資本風險之前，精確返回每步 token delta、APY 與衝突檢測；SPL Token Approve 不是代碼承諾，是 Solana token program 在合約層面的硬性強制約束，AI 在任何情況下都無法超出您設定的上限。每條 AI 推理路徑 SHA-256 永久上鏈，tx signature 公開可查，無需信任 Sakura 的任何服務器。備えあれば憂いなし——匠人精神：表面優雅，底層嚴苛。"
                : lang === "ja"
                ? "ヘッジファンドは24時間の監視室でポジションを守ります。普通のユーザーは、スマートフォンの通知が鳴った瞬間に既に手遅れであることを知るだけです。Sakuraはこの不平等を変えるために生まれました。3つのSolanaネイティブRPCプリミティブ、3つの非対称防衛ライン：getProgramAccountsは攻撃者の武器を盾に変え、Nonce authorityが乗っ取られる前に脅威を一掃；simulateTransactionは世界初の消費者向けマルチステップDeFi戦略完全ゴースト実行——資本リスクを負う前に各ステップのtoken delta、APY、競合検出を正確に返す；SPL Token Approveはコードの約束ではなく、Solana token programがコントラクトレベルで強制するハード制約、AIはいかなる状況でも設定した上限を超えられない。すべてのAI推論経路はSHA-256で永続オンチェーン刻印、tx signatureは公開、Sakuraのサーバーを信頼する必要なし。備えあれば憂いなし——匠の精神：表面は優雅、底層は厳格。"
                : "Hedge funds have 24-hour monitoring rooms guarding their positions. Ordinary users only discover what happened when the push notification arrives — and by then it is already too late. Sakura was built to end that inequality. Three Solana-native RPC primitives, three asymmetric defense lines: getProgramAccounts turns the attacker's own weapon into your shield, clearing Nonce authority threats before hijacking can occur; simulateTransaction is the world's first consumer-grade multi-step DeFi strategy full ghost pre-execution — returning exact token deltas, APY projections, and conflict detection for every step before you risk a single dollar of capital; SPL Token Approve is not a code promise but a hard constraint enforced at the Solana token-program contract layer — the AI cannot exceed your set limit under any circumstances. Every AI reasoning path SHA-256 permanently inscribed on-chain, tx signature publicly auditable, no trust in Sakura's servers required. 備えあれば憂いなし — Takumi spirit: elegant on the surface, ruthlessly precise underneath."}
            </div>
          </div>
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
