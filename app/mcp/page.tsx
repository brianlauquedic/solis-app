"use client";

import Link from "next/link";
import Footer from "@/components/Footer";
import { useLang } from "@/contexts/LanguageContext";

type Lang = "zh" | "en" | "ja";

const CONTENT: Record<Lang, {
  back: string;
  badge: string;
  title: string;
  tagline: string;
  subtitle: string;
  introTitle: string;
  introBody: string;
  toolsTitle: string;
  tools: Array<{ name: string; badge: string; badgeColor: string; desc: string; endpoint: string }>;
  quickstartTitle: string;
  steps: Array<{ step: string; title: string; desc: string }>;
  codeTitle: string;
  feeTitle: string;
  fees: Array<{ label: string; value: string }>;
  whyTitle: string;
  whyBody: string;
  contact: string;
  contactHandle: string;
}> = {
  zh: {
    back: "← 返回首頁",
    badge: "🤖 MCP API · AGENTIC BOUNDS · SOLANA",
    title: "Sakura MCP API",
    tagline: "HTTP 定義信息交換。x402 定義價值交換。",
    subtitle: "任何 MCP 客戶端——Claude Desktop、Cursor、VS Code、或任意自主 AI 代理——皆可直接呼叫 Sakura 的三個代理執行邊界工具：意圖簽署、附證明執行、鏈上動作驗證。每次呼叫透過 HTTP 402 協議以鏈上 \\$1 USDC 原子結算。無帳號、無訂閱、無 OAuth——認證即支付。",
    introTitle: "為什麼是 x402？",
    introBody: "互聯網誕生時，HTTP 定義了機器如何交換「信息」。代理經濟（Agentic Economy）時代，AI 代理需要在沒有人類介入的情況下，自主呼叫服務並自主完成支付。傳統的訂閱制、OAuth 授權、人工審批門控，是為人類設計的，不是為機器設計的。x402（HTTP 402 Payment Required）是 Stripe 於 2025 年重提的 Machine Payments Protocol 的鏈上原生實現：一個 API 呼叫、一筆鏈上 USDC 支付、一次原子確認。無中間方、無帳號系統、無等待。Sakura 是代理執行邊界層領域第一個在生產環境落地 x402 的項目。",
    toolsTitle: "三個可呼叫工具",
    tools: [
      {
        name: "sign_intent",
        badge: "TOOL I · INTENT SIGNING",
        badgeColor: "#C9312A",
        desc: "代理或錢包代表用戶發起意圖簽署流程：接收七項私有策略值（意圖文字、錢包、nonce、金額上限、USD 上限、協議位圖、動作位圖），經 2 層 Poseidon 樹壓縮為 32 位元組承諾，提交 sign_intent 指令至 Solana，承諾寫入以用戶錢包為種子的 PDA。返回：承諾 hash、PDA 位址、sign_intent tx signature。收取名義金額 0.1% 一次性費用（前 $10M 整合量免收）。",
        endpoint: "tool: sign_intent · params: bounds, wallet, amount_cap, usd_cap, protocols, actions, expiry",
      },
      {
        name: "execute_with_proof",
        badge: "TOOL II · AGENT EXECUTION",
        badgeColor: "#B8932A",
        desc: "代理提交一個已綁定 Groth16 證明的 DeFi 動作：客戶端於瀏覽器（或後端 snarkjs）本地生成證明，透過此工具提交至 Sakura MCP 伺服器。伺服器將 execute_with_intent_proof 驗證指令與代理提供的 DeFi 指令打包至同一筆 Solana v0 原子交易，提交至主網。鏈上 alt_bn128 配對驗證於 ~116k CU 完成；通過後 DeFi 指令才落地。返回：tx signature、action_nonce、keccak256 指紋。",
        endpoint: "tool: execute_with_proof · params: intent_commitment, proof, public_inputs, defi_instruction",
      },
      {
        name: "verify_action",
        badge: "TOOL III · AUDIT VERIFICATION",
        badgeColor: "#5A7A4A",
        desc: "審計師、律師、合規機構，可獨立查詢任意過去代理動作的驗證狀態。輸入 (intent_commitment, action_nonce) 或 tx signature，返回該動作的 ActionRecord PDA 內容：32 位元組意圖承諾、action_type、target、amount、landed slot、keccak256 指紋、Groth16 公開輸入、Pyth 參考 slot。附帶公開 verifying key 的下載連結，供 snarkjs 獨立重驗。整個審計路徑不依賴 Sakura 任何伺服器。",
        endpoint: "tool: verify_action · params: { intent_commitment, action_nonce } OR { tx_signature }",
      },
    ],
    quickstartTitle: "四步接入",
    steps: [
      { step: "1", title: "準備 Solana 錢包並持有 USDC", desc: "確保您的呼叫錢包持有足夠 USDC（每次 x402 付費工具呼叫 $1.00；sign_intent 另收 0.1% 名義金額一次性費用）。Phantom、OKX、任意 Solana 錢包皆可——無需註冊帳號、無需 KYC。" },
      { step: "2", title: "發送 $1.00 USDC 至 Sakura Fee Wallet", desc: "每次工具呼叫前，從您的錢包向 Sakura Fee Wallet 發送 $1.00 USDC（SPL Token Transfer）。保留 tx signature——這是您的 x402 支付憑證。sign_intent 一次性 0.1% 費用自動在簽署指令中鏈上扣除。" },
      { step: "3", title: "請求 Header 附上支付憑證", desc: "在 MCP JSON-RPC 請求中附上 header：x-payment: <tx_signature> · x-wallet: <your_wallet>。Sakura 後端即時核驗鏈上支付紀錄，確認金額、收款方、付款方皆正確。防重放保護：每個 tx signature 僅可使用一次。" },
      { step: "4", title: "接收結果 · 鏈上指紋 · 獨立可驗證", desc: "工具呼叫返回完整結果：sign_intent 返回承諾 PDA、execute_with_proof 返回 tx + keccak256 指紋、verify_action 返回 ActionRecord 完整欄位。每一項結果皆對應鏈上一筆交易或一個 PDA——任何人可在 Solscan 獨立核驗，無需信任 Sakura 伺服器。這是 Verifiable Compute 的直接實現。" },
    ],
    codeTitle: "示例代碼",
    feeTitle: "費用結構",
    fees: [
      { label: "sign_intent 呼叫", value: "名義金額 0.1% 一次性（前 $10M 整合量免收，鏈上扣除）" },
      { label: "execute_with_proof 呼叫", value: "$0.01 per action（鏈上驗證成本覆蓋，嵌入 Solana priority fee）" },
      { label: "verify_action 呼叫", value: "$1.00 USDC（x402 原子結算，含伺服器 Solana RPC 成本）" },
      { label: "支付方式", value: "SPL Token Transfer → Sakura Fee Wallet（鏈上可查）" },
      { label: "計費時機", value: "付費後驗證、驗證後執行；鏈上支付不可逆，請確認參數後再支付" },
      { label: "適用客戶端", value: "Claude Desktop · Cursor · VS Code · 任意 MCP 客戶端 · 自主 AI 代理" },
    ],
    whyTitle: "為什麼這對代理經濟至關重要",
    whyBody: "傳統 API 經濟依賴人類完成帳號註冊、訂閱繳費、OAuth 授權——每一步都需要人類介入。當 AI 代理成為主要 API 消費者，這個模型失效。x402 讓 AI 代理像人類刷卡一樣自主完成支付：一個 HTTP header、一筆鏈上轉帳、一次即時確認。Sakura 的每一個工具呼叫結果都附帶 Verifiable Compute 憑證——keccak256 指紋或 Groth16 證明永久留存 Solana 主網，任何人可在 Solscan 獨立核驗代理的完整執行路徑。這是 AI 透明度在技術層面能達到的最高標準。",
    contact: "開發者支援、接入諮詢：",
    contactHandle: "𝕏 @sakuraaijp",
  },
  en: {
    back: "← Back to Home",
    badge: "🤖 MCP API · AGENTIC BOUNDS · SOLANA",
    title: "Sakura MCP API",
    tagline: "HTTP defined information exchange. x402 defines value exchange.",
    subtitle: "Any MCP client — Claude Desktop, Cursor, VS Code, or any autonomous AI agent — can call Sakura's three agent-execution-bounds tools directly: intent signing, proof-gated execution, and on-chain action verification. Every call settles atomically in on-chain USDC via HTTP 402 at \\$1.00. No account, no subscription, no OAuth — authentication is payment.",
    introTitle: "Why x402?",
    introBody: "When the internet was born, HTTP defined how machines exchange information. In the Agentic Economy, AI agents must call services and complete payments autonomously — without human intervention at each step. Traditional subscriptions, OAuth flows, and manual approval gates were designed for humans, not machines. x402 (HTTP 402 Payment Required), re-proposed by Stripe in 2025 as the Machine Payments Protocol, is the on-chain native answer: one API call, one on-chain USDC payment, one atomic confirmation. No intermediary. No account system. No waiting. Sakura is the first project in the agentic-execution-bounds domain to ship x402 in production.",
    toolsTitle: "Three Callable Tools",
    tools: [
      {
        name: "sign_intent",
        badge: "TOOL I · INTENT SIGNING",
        badgeColor: "#C9312A",
        desc: "The agent or wallet, acting on behalf of the user, initiates intent signing: seven private policy values (intent text, wallet, nonce, amount cap, USD cap, protocol bitmap, action bitmap) are folded through a two-layer Poseidon tree into a 32-byte commitment. The sign_intent instruction is submitted to Solana; the commitment is written to a PDA seeded by the user's wallet. Returns: commitment hash, PDA address, sign_intent tx signature. A one-time 0.1% fee on notional applies (rebated for the first $10M of integrator volume).",
        endpoint: "tool: sign_intent · params: bounds, wallet, amount_cap, usd_cap, protocols, actions, expiry",
      },
      {
        name: "execute_with_proof",
        badge: "TOOL II · AGENT EXECUTION",
        badgeColor: "#B8932A",
        desc: "The agent submits a DeFi action bundled with a Groth16 proof: the client generates the proof locally (browser snarkjs or backend) and submits to the Sakura MCP server. The server bundles the execute_with_intent_proof verification instruction and the DeFi instruction into a single Solana v0 atomic transaction and submits to mainnet. The alt_bn128 pairing check completes in ~116k CU on-chain; the DeFi instruction only lands after the proof passes. Returns: tx signature, action_nonce, keccak256 fingerprint.",
        endpoint: "tool: execute_with_proof · params: intent_commitment, proof, public_inputs, defi_instruction",
      },
      {
        name: "verify_action",
        badge: "TOOL III · AUDIT VERIFICATION",
        badgeColor: "#5A7A4A",
        desc: "An auditor, legal counsel, or compliance body can independently query the verification status of any past agent action. Given (intent_commitment, action_nonce) or a tx signature, returns the action's ActionRecord PDA contents: 32-byte intent commitment, action_type, target, amount, landed slot, keccak256 fingerprint, Groth16 public inputs, referenced Pyth slot. Includes a download link to the public verifying key for independent snarkjs re-verification. The entire audit path is independent of any Sakura server.",
        endpoint: "tool: verify_action · params: { intent_commitment, action_nonce } OR { tx_signature }",
      },
    ],
    quickstartTitle: "Four Steps to Integrate",
    steps: [
      { step: "1", title: "Prepare a Solana wallet holding USDC", desc: "Ensure your calling wallet holds sufficient USDC ($1.00 per x402 tool call; sign_intent additionally charges a one-time 0.1% fee on notional). Phantom, OKX, or any Solana wallet works — no account creation or KYC." },
      { step: "2", title: "Send $1.00 USDC to the Sakura Fee Wallet", desc: "Before each tool call, transfer $1.00 USDC (SPL Token Transfer) from your wallet to the Sakura Fee Wallet. Save the tx signature — this is your x402 payment proof. The sign_intent one-time 0.1% fee is deducted on-chain inside the sign instruction automatically." },
      { step: "3", title: "Attach the payment proof as a header", desc: "Include the headers in your MCP JSON-RPC request: x-payment: <tx_signature> · x-wallet: <your_wallet>. The Sakura backend verifies the on-chain payment in real time — amount, recipient, sender all checked. Replay protection: each tx signature may be used only once." },
      { step: "4", title: "Receive the result · On-chain fingerprint · Independently verifiable", desc: "The tool call returns its full result: sign_intent returns the commitment PDA; execute_with_proof returns the tx signature + keccak256 fingerprint; verify_action returns the complete ActionRecord fields. Every result corresponds to an on-chain transaction or PDA — anyone can verify it independently on Solscan, without trusting the Sakura server. This is Verifiable Compute, implemented." },
    ],
    codeTitle: "Example Code",
    feeTitle: "Fee Structure",
    fees: [
      { label: "sign_intent call", value: "0.1% of notional, one-time (rebated up to first $10M integrator volume; deducted on-chain)" },
      { label: "execute_with_proof call", value: "$0.01 per action (covers on-chain verification cost, embedded in Solana priority fee)" },
      { label: "verify_action call", value: "$1.00 USDC (atomic via x402; covers server RPC cost)" },
      { label: "Payment method", value: "SPL Token Transfer → Sakura Fee Wallet (publicly verifiable on Solscan)" },
      { label: "Billing trigger", value: "Pay first, verify, then execute. On-chain payments are irreversible — verify parameters before paying." },
      { label: "Compatible clients", value: "Claude Desktop · Cursor · VS Code · Any MCP client · Autonomous AI agents" },
    ],
    whyTitle: "Why This Matters for the Agentic Economy",
    whyBody: "The traditional API economy depends on humans completing account registration, subscription payments, and OAuth flows — every step requires human intervention. When AI agents become the dominant API consumers, that model breaks. x402 lets an AI agent pay autonomously, the way a human swipes a card: one HTTP header, one on-chain transfer, one instant confirmation. Every Sakura tool call result carries a Verifiable Compute credential — a keccak256 fingerprint or a Groth16 proof, permanently anchored on Solana mainnet, independently verifiable by anyone on Solscan. This is the highest standard of AI accountability achievable at the technical layer.",
    contact: "Developer support, integration inquiries:",
    contactHandle: "𝕏 @sakuraaijp",
  },
  ja: {
    back: "← ホームへ戻る",
    badge: "🤖 MCP API · エージェント境界層 · SOLANA",
    title: "Sakura MCP API",
    tagline: "HTTP は情報交換を定義した。x402 は価値交換を定義する。",
    subtitle: "任意の MCP クライアント——Claude Desktop、Cursor、VS Code、あるいはあらゆる自律 AI エージェント——が、Sakura の 3 つのエージェント実行境界ツールを直接呼び出せる：意図署名、証明付き実行、オンチェーン動作検証。各呼び出しは、HTTP 402 により、オンチェーンの \\$1 USDC で原子的に決済される。アカウント不要、サブスクリプション不要、OAuth 不要——認証そのものが決済である。",
    introTitle: "なぜ x402 なのか？",
    introBody: "インターネットが誕生したとき、HTTP はマシン間の「情報」の交換を定義した。エージェント経済（Agentic Economy）の時代、AI エージェントは、人間の介入なしに、自律的にサービスを呼び出し、自律的に支払いを完了せねばならない。従来のサブスクリプション、OAuth 認可フロー、人間による承認ゲート——これらは人間のために設計されており、マシンのためではない。x402（HTTP 402 Payment Required）は、Stripe が 2025 年に Machine Payments Protocol として再提案したものの、オンチェーン・ネイティブな実装である——1 つの API 呼び出し、1 つのオンチェーン USDC 支払い、1 つの原子確認。中間者なし、アカウントシステムなし、待機なし。Sakura は、エージェント実行境界層の領域において、x402 を本番環境で最初に実装したプロジェクトである。",
    toolsTitle: "3 つの呼び出し可能ツール",
    tools: [
      {
        name: "sign_intent",
        badge: "ツール I · 意図署名",
        badgeColor: "#C9312A",
        desc: "エージェントまたはウォレットが、ユーザーに代わって意図署名フローを開始する——7 つのプライベートなポリシー値（意図テキスト、ウォレット、ノンス、金額上限、USD 上限、プロトコルビットマップ、アクションビットマップ）が、2 層の Poseidon ツリーを経て 32 バイトのコミットメントに畳み込まれる。sign_intent 命令が Solana に提出され、コミットメントはユーザーのウォレットをシードとする PDA に書き込まれる。戻り値：コミットメントハッシュ、PDA アドレス、sign_intent の tx signature。名目額の 0.1% の一回限り手数料が適用される（統合者の最初の $10M 分はリベート）。",
        endpoint: "tool: sign_intent · params: bounds, wallet, amount_cap, usd_cap, protocols, actions, expiry",
      },
      {
        name: "execute_with_proof",
        badge: "ツール II · エージェント実行",
        badgeColor: "#B8932A",
        desc: "エージェントが、Groth16 証明と束ねた DeFi 動作を提出する——クライアントはローカル（ブラウザの snarkjs、またはバックエンド）で証明を生成し、Sakura MCP サーバーに提出する。サーバーは、execute_with_intent_proof の検証命令と DeFi 命令を、単一の Solana v0 アトミックトランザクションに束ね、メインネットに提出する。オンチェーンの alt_bn128 ペアリング検証は約 116k CU で完了する——証明が通過してはじめて、DeFi 命令は着地する。戻り値：tx signature、action_nonce、keccak256 指紋。",
        endpoint: "tool: execute_with_proof · params: intent_commitment, proof, public_inputs, defi_instruction",
      },
      {
        name: "verify_action",
        badge: "ツール III · 監査検証",
        badgeColor: "#5A7A4A",
        desc: "監査人、法律顧問、コンプライアンス機関は、過去の任意のエージェント動作の検証状態を独立に問い合わせることができる。(intent_commitment, action_nonce) あるいは tx signature を与えると、当該動作の ActionRecord PDA の内容——32 バイト意図コミットメント、action_type、target、amount、着地 slot、keccak256 指紋、Groth16 の public inputs、参照した Pyth slot——が返ってくる。公開 verifying key のダウンロードリンクも含まれる（snarkjs による独立な再検証のため）。監査の経路全体が、Sakura の任意のサーバーから独立している。",
        endpoint: "tool: verify_action · params: { intent_commitment, action_nonce } OR { tx_signature }",
      },
    ],
    quickstartTitle: "4 ステップで統合",
    steps: [
      { step: "1", title: "USDC を保有する Solana ウォレットを準備", desc: "呼び出し側のウォレットに十分な USDC があることを確認する（x402 付費ツール呼び出し 1 回あたり $1.00、sign_intent には別途名目額の 0.1% の一回限り手数料）。Phantom、OKX、その他任意の Solana ウォレットが使える——アカウント作成不要、KYC 不要。" },
      { step: "2", title: "Sakura Fee Wallet に $1.00 USDC を送金", desc: "各ツール呼び出しの前に、ウォレットから Sakura Fee Wallet へ $1.00 USDC を SPL Token Transfer として送金する。tx signature を保存すること——これが x402 の支払い証明である。sign_intent の一回限り 0.1% 手数料は、sign 命令の内部で自動的にオンチェーン控除される。" },
      { step: "3", title: "リクエストヘッダーに支払い証明を付す", desc: "MCP JSON-RPC リクエストに、次のヘッダーを付す：x-payment: <tx_signature> · x-wallet: <your_wallet>。Sakura バックエンドは、オンチェーンの支払い記録を即時に検証する——金額、受取人、送金人がすべて確認される。再生防止：各 tx signature は 1 度限り使用可能。" },
      { step: "4", title: "結果を受け取る · オンチェーン指紋 · 独立検証可能", desc: "ツール呼び出しは、完全な結果を返す——sign_intent はコミットメント PDA を、execute_with_proof は tx signature と keccak256 指紋を、verify_action は ActionRecord の全フィールドを返す。各結果は、オンチェーンの 1 トランザクションまたは 1 PDA に対応する——誰もが Solscan で独立に検証でき、Sakura のサーバーを信頼する必要はない。これが Verifiable Compute の実装である。" },
    ],
    codeTitle: "サンプルコード",
    feeTitle: "料金体系",
    fees: [
      { label: "sign_intent 呼び出し", value: "名目額の 0.1% を 1 回限り（統合者の最初の $10M 分はリベート、オンチェーン控除）" },
      { label: "execute_with_proof 呼び出し", value: "動作 1 回あたり $0.01（オンチェーン検証コスト補填、Solana priority fee に埋め込み）" },
      { label: "verify_action 呼び出し", value: "$1.00 USDC（x402 による原子決済、サーバーの RPC コストを含む）" },
      { label: "支払い方法", value: "SPL Token Transfer → Sakura Fee Wallet（Solscan で公開検証可能）" },
      { label: "課金タイミング", value: "先払い、検証、実行。オンチェーン支払いは不可逆——パラメータを確認してから支払うこと。" },
      { label: "対応クライアント", value: "Claude Desktop · Cursor · VS Code · 任意 MCP クライアント · 自律 AI エージェント" },
    ],
    whyTitle: "なぜこれがエージェント経済にとって重要なのか",
    whyBody: "従来の API 経済は、人間がアカウント登録、サブスクリプション支払い、OAuth 認可を完了することに依存している——どの段階にも人間の介入が要る。AI エージェントが主要な API 消費者となった瞬間に、このモデルは機能しなくなる。x402 は、AI エージェントが、人間がカードをスワイプするのと同じように、自律的に支払いを完了できるようにする——1 つの HTTP ヘッダー、1 回のオンチェーン送金、1 つの即時確認。Sakura の各ツール呼び出しの結果には、Verifiable Compute のクレデンシャルが付されている——keccak256 指紋、あるいは Groth16 証明が、Solana メインネットに永久に定錨される。誰もが Solscan で、エージェントの完全な実行経路を独立に検証できる。これが、技術レイヤーで達成可能な、AI 説明責任の最高水準である。",
    contact: "開発者サポート、統合のお問い合わせ：",
    contactHandle: "𝕏 @sakuraaijp",
  },
};

const CURL_EXAMPLE = `# Step 1: Send $1.00 USDC payment (save the tx signature)
# Step 2: Call the MCP tool with your payment proof

curl -X POST https://sakura-app.vercel.app/api/mcp \\
  -H "Content-Type: application/json" \\
  -H "x-payment: <YOUR_TX_SIGNATURE>" \\
  -H "x-wallet: <YOUR_WALLET_ADDRESS>" \\
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "verify_action",
      "arguments": {
        "intent_commitment": "<HEX_32_BYTE_COMMITMENT>",
        "action_nonce": 3
      }
    }
  }'`;

const TS_EXAMPLE = `import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import {
  createTransferCheckedInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";

// Step 1: Pay $1.00 USDC to the Sakura Fee Wallet
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SAKURA_FEE_WALLET = "<SAKURA_FEE_WALLET_ADDRESS>";

async function callSakuraTool(
  toolName: "sign_intent" | "execute_with_proof" | "verify_action",
  params: Record<string, unknown>
) {
  // Build and send the $1.00 USDC x402 payment transaction
  const paymentTx = new Transaction().add(
    createTransferCheckedInstruction(
      senderAta,           // your USDC ATA
      new PublicKey(USDC_MINT),
      sakuraAta,           // Sakura fee wallet USDC ATA
      senderPublicKey,
      1_000_000,           // $1.00 USDC (6 decimals)
      6,
    ),
  );
  const txSig = await connection.sendTransaction(paymentTx, [wallet]);
  await connection.confirmTransaction(txSig);

  // Call the Sakura MCP tool with the payment proof
  const response = await fetch("https://sakura-app.vercel.app/api/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-payment": txSig,
      "x-wallet": senderPublicKey.toString(),
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: toolName, arguments: params },
    }),
  });

  return response.json();
}

// Example: independently verify a past agent action on-chain
const result = await callSakuraTool("verify_action", {
  intent_commitment: "0x...",
  action_nonce: 3,
});`;

export default function McpPage() {
  const { lang } = useLang();
  const c = CONTENT[lang];

  const sectionStyle: React.CSSProperties = {
    background: "var(--bg-card)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    padding: "28px 28px 24px",
    marginBottom: 20,
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg-base)" }}>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "48px 24px 80px" }}>

        {/* Back */}
        <div style={{ marginBottom: 32 }}>
          <Link href="/" style={{ fontSize: 13, color: "var(--text-secondary)", textDecoration: "none", letterSpacing: "0.03em" }}>
            {c.back}
          </Link>
        </div>

        {/* Badge */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          background: "rgba(99,91,255,0.08)", border: "1px solid rgba(99,91,255,0.25)",
          borderRadius: 20, padding: "5px 14px", marginBottom: 24,
        }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#635BFF", display: "inline-block" }} />
          <span style={{ fontSize: 11, color: "#8B87FF", fontWeight: 500, letterSpacing: 1.5, fontFamily: "var(--font-mono)" }}>
            {c.badge}
          </span>
        </div>

        {/* Title */}
        <h1 className="jp-heading" style={{ fontSize: 32, fontWeight: 300, color: "var(--text-primary)", marginBottom: 10, letterSpacing: "0.06em" }}>
          {c.title}
        </h1>
        <div style={{ fontSize: 14, color: "#8B87FF", marginBottom: 16, letterSpacing: "0.04em", fontFamily: "var(--font-heading)" }}>
          {c.tagline}
        </div>
        <p style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 2.0, marginBottom: 40, maxWidth: 640 }}>
          {c.subtitle}
        </p>

        {/* Intro: Why x402 */}
        <div style={{ ...sectionStyle, borderTop: "2px solid #635BFF" }}>
          <div style={{ fontSize: 10, color: "#8B87FF", letterSpacing: "0.18em", fontFamily: "var(--font-mono)", marginBottom: 12 }}>
            WHY x402
          </div>
          <h2 className="jp-heading" style={{ fontSize: 16, fontWeight: 400, color: "var(--text-primary)", marginBottom: 14, letterSpacing: "0.05em" }}>
            {c.introTitle}
          </h2>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 2.1, margin: 0 }}>
            {c.introBody}
          </p>
        </div>

        {/* Tools */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.18em", fontFamily: "var(--font-mono)", marginBottom: 16, textTransform: "uppercase" }}>
            {c.toolsTitle}
          </div>
          <div className="jp-divider" style={{ margin: "0 0 16px" }} />
          {c.tools.map((tool) => (
            <div key={tool.name} style={{
              ...sectionStyle,
              borderTop: `2px solid ${tool.badgeColor}`,
              marginBottom: 12,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <div style={{
                  background: `${tool.badgeColor}18`, border: `1px solid ${tool.badgeColor}35`,
                  borderRadius: 6, padding: "3px 10px",
                  fontSize: 9, color: tool.badgeColor, letterSpacing: "0.14em", fontFamily: "var(--font-mono)",
                }}>{tool.badge}</div>
              </div>
              <div className="jp-heading" style={{ fontSize: 15, fontWeight: 400, color: "var(--text-primary)", marginBottom: 10, letterSpacing: "0.05em" }}>
                {tool.name}
              </div>
              <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 2.0, marginBottom: 12 }}>
                {tool.desc}
              </p>
              <div style={{
                fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-muted)",
                background: "var(--bg-base)", border: "1px solid var(--border)",
                borderRadius: 4, padding: "6px 10px", letterSpacing: "0.05em",
                wordBreak: "break-all",
              }}>
                {tool.endpoint}
              </div>
            </div>
          ))}
        </div>

        {/* Quick Start */}
        <div style={{ ...sectionStyle, borderTop: "2px solid var(--accent)" }}>
          <div style={{ fontSize: 10, color: "var(--accent)", letterSpacing: "0.18em", fontFamily: "var(--font-mono)", marginBottom: 12 }}>
            QUICK START
          </div>
          <h2 className="jp-heading" style={{ fontSize: 16, fontWeight: 400, color: "var(--text-primary)", marginBottom: 20, letterSpacing: "0.05em" }}>
            {c.quickstartTitle}
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {c.steps.map((s) => (
              <div key={s.step} style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 6, flexShrink: 0,
                  background: "var(--accent-soft)", border: "1px solid var(--accent-mid)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 12, fontWeight: 700, color: "var(--accent)", fontFamily: "var(--font-mono)",
                }}>{s.step}</div>
                <div>
                  <div className="jp-heading" style={{ fontSize: 13, fontWeight: 400, color: "var(--text-primary)", marginBottom: 4, letterSpacing: "0.04em" }}>
                    {s.title}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.9 }}>
                    {s.desc}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Code Examples */}
        <div style={{ ...sectionStyle }}>
          <div style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.18em", fontFamily: "var(--font-mono)", marginBottom: 12, textTransform: "uppercase" }}>
            {c.codeTitle}
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 10, color: "#8B87FF", letterSpacing: "0.1em", fontFamily: "var(--font-mono)", marginBottom: 8 }}>
              CURL
            </div>
            <pre style={{
              fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-secondary)",
              background: "var(--bg-base)", border: "1px solid var(--border)",
              borderRadius: 6, padding: "14px 16px", overflowX: "auto",
              lineHeight: 1.7, margin: 0,
            }}>{CURL_EXAMPLE}</pre>
          </div>
          <div>
            <div style={{ fontSize: 10, color: "#8B87FF", letterSpacing: "0.1em", fontFamily: "var(--font-mono)", marginBottom: 8 }}>
              TYPESCRIPT
            </div>
            <pre style={{
              fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-secondary)",
              background: "var(--bg-base)", border: "1px solid var(--border)",
              borderRadius: 6, padding: "14px 16px", overflowX: "auto",
              lineHeight: 1.7, margin: 0,
            }}>{TS_EXAMPLE}</pre>
          </div>
        </div>

        {/* Fee Structure */}
        <div style={{ ...sectionStyle }}>
          <div style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.18em", fontFamily: "var(--font-mono)", marginBottom: 16, textTransform: "uppercase" }}>
            {c.feeTitle}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 0, border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
            {c.fees.map((fee, i) => (
              <div key={i} style={{
                display: "flex", gap: 16, alignItems: "flex-start",
                padding: "12px 16px",
                borderBottom: i < c.fees.length - 1 ? "1px solid var(--border)" : "none",
                background: i % 2 === 0 ? "var(--bg-base)" : "var(--bg-card)",
              }}>
                <div style={{ fontSize: 11, color: "var(--text-muted)", minWidth: 160, letterSpacing: "0.03em" }}>{fee.label}</div>
                <div style={{ fontSize: 11, color: "var(--text-primary)", letterSpacing: "0.03em" }}>{fee.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Why it matters */}
        <div style={{ ...sectionStyle, borderTop: "2px solid var(--gold)" }}>
          <div style={{ fontSize: 10, color: "var(--gold)", letterSpacing: "0.18em", fontFamily: "var(--font-mono)", marginBottom: 12 }}>
            VERIFIABLE COMPUTE · SOLANA
          </div>
          <h2 className="jp-heading" style={{ fontSize: 16, fontWeight: 400, color: "var(--text-primary)", marginBottom: 14, letterSpacing: "0.05em" }}>
            {c.whyTitle}
          </h2>
          <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 2.1, margin: 0 }}>
            {c.whyBody}
          </p>
        </div>

        {/* API Endpoint Reference */}
        <div style={{
          background: "var(--bg-base)", border: "1px solid var(--border)",
          borderRadius: 8, padding: "14px 18px", marginBottom: 20,
        }}>
          <div style={{ fontSize: 9, color: "var(--text-muted)", letterSpacing: "0.18em", fontFamily: "var(--font-mono)", marginBottom: 10, textTransform: "uppercase" }}>
            API REFERENCE
          </div>
          {[
            { method: "POST", path: "/api/mcp", desc: "MCP JSON-RPC endpoint (x402 gated)" },
            { method: "GET",  path: "/api/mcp", desc: "List available tools (free)" },
          ].map((r, i) => (
            <div key={i} style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: i === 0 ? 6 : 0 }}>
              <span style={{
                fontSize: 9, fontFamily: "var(--font-mono)", color: "#8B87FF",
                background: "rgba(99,91,255,0.1)", border: "1px solid rgba(99,91,255,0.2)",
                borderRadius: 3, padding: "2px 7px", letterSpacing: "0.08em", flexShrink: 0,
              }}>{r.method}</span>
              <span style={{ fontSize: 10, fontFamily: "var(--font-mono)", color: "var(--text-secondary)", letterSpacing: "0.05em" }}>
                {r.path}
              </span>
              <span style={{ fontSize: 10, color: "var(--text-muted)" }}>— {r.desc}</span>
            </div>
          ))}
        </div>

        {/* Contact */}
        <div style={{ textAlign: "center", paddingTop: 20 }}>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 6 }}>{c.contact}</div>
          <a href="https://x.com/sakuraaijp" target="_blank" rel="noopener noreferrer"
            style={{ fontSize: 13, color: "var(--accent)", textDecoration: "none", letterSpacing: "0.04em" }}>
            {c.contactHandle}
          </a>
        </div>

      </div>
      <Footer />
    </div>
  );
}
