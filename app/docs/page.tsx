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
    badge: "🌸 INTEGRATION DOCS · SOLANA AGENTIC BOUNDS LAYER",
    title: "Sakura 整合文檔",
    subtitle: "2026 年上半，Phantom、Backpack、Abstract、Infinex 四家錢包將同時上線代理模式。每家獨立蓋這一層驗證——簽名檢查、Pyth 價格整合、150 塊新鮮度、nonce 防重放——成本以工程師季度計。Sakura 做一次，給所有人。一份文檔，三條整合路徑；源碼 MIT 授權，整合無需許可。",
    sections: [
      {
        id: "wallet-integrator",
        badge: "PATH I · WALLET INTEGRATOR",
        badgeColor: "#C9312A",
        title: "🪪 錢包整合者",
        subtitle: "Phantom / Backpack / Abstract / Infinex 如何接入 Sakura",
        intro: "錢包接入 Sakura 的商業動機只有一條：省下自己蓋這一層的工程成本。這一層該解一次，不該解四次。前 $10M 整合量免收路由費，之後 0.1% 名義金額自動路由至協議金庫；接入流程完全許可免除——沒有商務談判、沒有 BD 流程、沒有配額審批。四個步驟，從安裝 SDK 到用戶第一次簽署意圖，工程日曆上是一週，不是一個季度。",
        steps: [
          { step: "1", title: "安裝 SDK · 串接錢包 provider", desc: "yarn add @sakura/solana-sdk。引入 IntentSigner React 元件，將您的錢包 provider（Phantom、Backpack、OKX 皆可）傳入。SDK 預設連線 Solana mainnet-beta；devnet 切換只需一個 prop。無需任何 API key，無需 OAuth，無需在 Sakura 註冊任何帳號。" },
          { step: "2", title: "渲染意圖簽署介面", desc: "在您的代理模式設定頁面渲染 <IntentSigner />。用戶以自然語言寫下代理的動作邊界——例如「代理可在 Kamino 借貸，單次 $500 USDC，為期一週」。SDK 解析為七項策略值（意圖文字、錢包、nonce、金額上限、USD 上限、協議位圖、動作位圖）。原始值始終留在瀏覽器，不經過 Sakura 的任何伺服器。" },
          { step: "3", title: "簽署 · 承諾上鏈", desc: "用戶確認後，SDK 透過 2 層 Poseidon 樹將七項值壓縮為 32 位元組承諾；發起 sign_intent 指令，承諾寫入以用戶錢包為種子的 Program Derived Address (PDA)。一次性 0.1% 費用自動從 SPL Token approve 的 USDC 扣除，路由至協議金庫——前 $10M 整合量免收。用戶看到的，只是一次錢包簽名。" },
          { step: "4", title: "審計整合 · 收取 rebate", desc: "整合後，您的錢包位址登記在 Sakura 白名單中，首 $10M 整合量自動 rebate 至您預先聲明的 USDC 錢包。之後 0.1% 繼續流入協議金庫（85% 營運、15% 平台）。Solscan 上每一筆意圖簽署的 tx 都留有 keccak256 指紋——您、您的審計師、您的監管方，都可以獨立核驗任何一筆，無需透過 Sakura。" },
        ],
        risks: [],
      },
      {
        id: "agent-developer",
        badge: "PATH II · AGENT DEVELOPER",
        badgeColor: "#B8932A",
        title: "🤖 代理開發者",
        subtitle: "AI 代理如何生成 Groth16 證明、提交動作",
        intro: "代理執行任何動作之前，都必須先證明該動作落在用戶已簽的邊界之內。Sakura 的客戶端在用戶瀏覽器內於 600ms 以內生成 Groth16 證明，鏈上驗證器於 ~116k CU 完成配對驗證——每次動作約 \$0.0001 鏈上成本。不揭露任何私有策略值，只論證「這個動作，合規」。",
        steps: [
          { step: "1", title: "從 lib/adapters 組裝未簽名 DeFi 指令", desc: "Sakura 內建 4 個 Solana 龍頭協議的 mainnet adapter（lib/adapters/{jito,raydium,kamino,jupiter-lend}.ts）共 13 個動作格子全部產生真 CPI 指令——Jupiter（Swap + Lend × 4）、Raydium（Swap）、Kamino（Lend / Borrow / Repay / Withdraw）、Jito（Stake / Unstake）。任何人皆可執行 npx tsx scripts/verify-{jito,raydium,kamino,jupiter-lend}-adapter.ts 一鍵獨立復現驗證。Sakura SDK 提供 buildActionWitness() 函式，接受 adapter 返回的 TransactionInstruction，自動抽取 action_type、action_target、action_amount 三個核心欄位，作為 Groth16 電路的 public inputs。" },
          { step: "2", title: "於瀏覽器生成 Groth16 證明", desc: "SDK 呼叫 generateProof({ witness, privateValues })，透過 snarkjs 於瀏覽器本地生成 Groth16 證明。證明內容只揭示「此動作在已簽邊界內」，不揭示任何策略值。電路強制五項約束：承諾雜湊一致、金額上限、協議白名單、動作類型白名單、USD 上限（以 Pyth 當下價結算）。瀏覽器端耗時約 600ms。" },
          { step: "3", title: "組裝 v0 原子交易 · ZK 閘門與 DeFi 指令同捆", desc: "透過 buildAtomicTx({ proof, defiIx }) 將驗證指令（execute_with_intent_proof）與 DeFi 指令打包至同一筆 Solana v0 交易。兩者共生共滅——若證明驗證失敗或 DeFi 指令失敗，整筆交易回滾。不存在「證明通過但動作懸空」的縫隙。代理每次動作結算 \$0.01，用於覆蓋鏈上驗證成本。" },
          { step: "4", title: "提交 · 於 Solscan 留下審計指紋", desc: "交易提交至 mainnet。成功後，ActionRecord PDA 以 (intent_commitment, action_nonce) 為種子建立，keccak256 動作指紋永久上鏈。Solscan 上，用戶、審計師、對手方皆可獨立還原這次動作——意圖是什麼、證明是否通過、DeFi 指令是什麼、何時落地。Sakura 不持有任何一方的信任，只作為鏈上閘門。" },
        ],
        risks: [],
      },
      {
        id: "auditor-enterprise",
        badge: "PATH III · AUDITOR / ENTERPRISE",
        badgeColor: "#5A7A4A",
        title: "🔍 審計 / 合規 / 機構",
        subtitle: "律師、審計師、機構合規如何獨立核驗",
        intro: "Sakura 的價值主張不是「請信任我們」——而是「您不需要信任我們」。每一筆代理動作在 Solana 鏈上留下 keccak256 指紋；每一筆意圖簽署的 Poseidon 承諾；每一筆 Groth16 證明的 public inputs。您不需要任何 Sakura 伺服器的存取，就能獨立還原全部執行路徑。這是 Verifiable Compute 在架構層面的最高保證。",
        steps: [
          { step: "1", title: "從 Solscan 檢索 ActionRecord PDA", desc: "在 Solscan 搜尋被審計錢包位址，過濾 Sakura program ID（AnszeCRFsBKmT5fBY9WywxGsZZZob8ZPFYqboYXpuYLp）。每一筆 execute_with_intent_proof 交易會建立一個 ActionRecord PDA，以 (intent_commitment, action_nonce) 為種子。下載全部 ActionRecord 帳戶資料——這是該錢包所有代理動作的完整時間軸。" },
          { step: "2", title: "解析 keccak256 動作指紋", desc: "每個 ActionRecord 包含：32 位元組意圖承諾、action_nonce、action_type、action_target、action_amount、landed slot、keccak256 執行指紋。指紋是 (intent, nonce, type, target, amount, slot) 的 keccak256 雜湊——您可以獨立計算並比對，驗證沒有任何事後竄改。" },
          { step: "3", title: "下載公開 verifying key", desc: "Sakura 的 Groth16 verifying key 在合約部署時烘焙進 zk_verifying_key.rs；非重新部署無法更改。您可以從 GitHub（MIT 授權）或直接從已部署的合約帳戶下載 vkey。驗證金鑰的 SHA-256 雜湊應與部署 commit 的 CI artifact 雜湊一致——任何不一致都是紅旗。" },
          { step: "4", title: "snarkjs 獨立驗證證明", desc: "使用標準 snarkjs（任何版本）對每一筆被審計動作執行 snarkjs.groth16.verify(vkey, publicSignals, proof)。若您重建的 Poseidon 承諾與鏈上儲存的一致、證明通過驗證、且 Pyth slot 在 150 塊新鮮度內——這次動作在數學上確實落在簽署邊界內。審計結論獨立於 Sakura 任何伺服器，亦獨立於任何代理運營方。" },
        ],
        risks: [],
      },
    ],
    feeTitle: "透明費用結構 · 按使用付費、無隱藏、無代幣",
    fees: [
      { feature: "🪪 意圖簽署", free: "首 $10M 整合量免收", paid: "0.1% 名義金額（一次性，鏈上扣除）" },
      { feature: "🤖 代理動作", free: "無", paid: "$0.01 / 次（鏈上驗證成本覆蓋）" },
      { feature: "📮 x402 MCP 呼叫", free: "無", paid: "$1 USDC / 次（HTTP 402 原子結算）" },
    ],
    contact: "整合支援、技術問題、合規諮詢：",
    contactHandle: "𝕏 @sakuraaijp",
  },
  en: {
    back: "← Back to Home",
    badge: "🌸 INTEGRATION DOCS · SOLANA AGENTIC BOUNDS LAYER",
    title: "Sakura Integration Docs",
    subtitle: "In the first half of 2026, Phantom, Backpack, Abstract, and Infinex will each ship an agent mode. Each building this verification layer independently — signature check, Pyth oracle integration, 150-block freshness, replay guard — is a cost measured in engineer-quarters per wallet. Sakura ships it once, for all of them. One document, three integration paths. MIT-licensed source. Permissionless integration.",
    sections: [
      {
        id: "wallet-integrator",
        badge: "PATH I · WALLET INTEGRATOR",
        badgeColor: "#C9312A",
        title: "🪪 Wallet Integrator",
        subtitle: "How Phantom / Backpack / Abstract / Infinex integrate Sakura",
        intro: "The business case for a wallet integrating Sakura is one line: you avoid the engineering cost of building this layer yourself. It should be solved once, not four times. The first \$10M of integrator notional is rebated; thereafter 0.1% routes automatically to the protocol fee vault. There is no business-development gate, no quota approval, no negotiation. Four steps from SDK install to the user's first signed intent — roughly a week on the engineering calendar, not a quarter.",
        steps: [
          { step: "1", title: "Install SDK · wire your wallet provider", desc: "yarn add @sakura/solana-sdk. Import the IntentSigner React component and pass in your wallet provider (Phantom, Backpack, OKX — any). The SDK defaults to Solana mainnet-beta; switching to devnet is a single prop. No API key. No OAuth. No registration with Sakura." },
          { step: "2", title: "Render the intent-signing interface", desc: "Drop <IntentSigner /> into your agent-mode settings page. The user writes the agent's bounds in natural language — for instance: \"the agent may lend up to \$500 USDC into Kamino, for one week.\" The SDK parses the sentence into seven policy values (intent text, wallet, nonce, amount cap, USD cap, protocol bitmap, action bitmap). The raw values stay in the browser; they never touch a Sakura server." },
          { step: "3", title: "Sign · anchor the commitment on-chain", desc: "Once the user confirms, the SDK folds the seven values through a two-layer Poseidon tree into a 32-byte commitment and submits sign_intent. The commitment is written to a Program Derived Address seeded by the user's wallet. A one-time 0.1% fee is deducted from the user's approved USDC and routed to the protocol fee vault — rebated for the integrator's first \$10M of notional. From the user's side: a single wallet signature." },
          { step: "4", title: "Audit integration · collect rebate", desc: "Post-integration, your wallet address is registered in Sakura's rebate whitelist; the first \$10M of integrator notional automatically rebates to the USDC address you declared. Beyond that, 0.1% flows into the protocol fee vault (85% operations, 15% platform treasury). Every intent-sign tx leaves a keccak256 fingerprint on Solscan — you, your auditor, your regulator can each reconstruct any transaction independently, without ever calling a Sakura server.",
          },
        ],
        risks: [],
      },
      {
        id: "agent-developer",
        badge: "PATH II · AGENT DEVELOPER",
        badgeColor: "#B8932A",
        title: "🤖 Agent Developer",
        subtitle: "How an AI agent generates a Groth16 proof and submits an action",
        intro: "Before the agent does anything, it must prove the action falls inside the user's signed bounds. The Sakura client generates a Groth16 proof in the user's browser in under 600 ms; the on-chain verifier completes the pairing check in ~116k compute units — roughly \$0.0001 per call. No private policy value is disclosed. Only: this action, in bounds.",
        steps: [
          { step: "1", title: "Assemble an unsigned DeFi instruction via lib/adapters", desc: "Sakura ships native mainnet adapters for the four Solana 龙头 (lib/adapters/{jito,raydium,kamino,jupiter-lend}.ts) covering 13 action cells with real on-chain CPI — Jupiter (Swap + Lend × 4), Raydium (Swap), Kamino (Lend / Borrow / Repay / Withdraw), Jito (Stake / Unstake). Anyone can independently reproduce the verifications via npx tsx scripts/verify-{jito,raydium,kamino,jupiter-lend}-adapter.ts. The Sakura SDK provides buildActionWitness() which accepts the adapter's TransactionInstruction and extracts the three core fields required as circuit public inputs: action_type, action_target, action_amount." },
          { step: "2", title: "Generate the Groth16 proof in-browser", desc: "Call generateProof({ witness, privateValues }). snarkjs generates the Groth16 proof locally. The proof asserts \"this action sits inside the signed commitment\" without revealing any policy value. The circuit enforces five constraints: commitment hash match, amount cap, protocol allowlist, action-type allowlist, USD cap (resolved against live Pyth price). Browser-side generation runs at ~600 ms." },
          { step: "3", title: "Bundle the v0 atomic transaction", desc: "Call buildAtomicTx({ proof, defiIx }) to bundle the verification instruction (execute_with_intent_proof) and the DeFi instruction into a single Solana v0 transaction. They share a fate: if the proof fails to verify, or if the DeFi instruction itself fails, the entire transaction reverts. There is no gap in which the proof passes while the action hangs mid-flight. Each agent action settles at \$0.01, covering on-chain verification cost." },
          { step: "4", title: "Submit · leave an audit fingerprint on Solscan", desc: "Submit the transaction to mainnet. On success, an ActionRecord PDA is created, seeded by (intent_commitment, action_nonce); a keccak256 fingerprint of the action is anchored on-chain permanently. On Solscan, the user, an auditor, and a counterparty can each independently reconstruct the action — what the intent was, whether the proof passed, what the DeFi instruction was, when it landed. Sakura holds no one's trust; it acts only as an on-chain gate." },
        ],
        risks: [],
      },
      {
        id: "auditor-enterprise",
        badge: "PATH III · AUDITOR / ENTERPRISE",
        badgeColor: "#5A7A4A",
        title: "🔍 Auditor / Compliance / Institutional",
        subtitle: "How legal counsel, auditors, and institutional compliance independently verify",
        intro: "Sakura's value proposition is not \"trust us.\" It is \"you do not need to trust us.\" Every agent action leaves a keccak256 fingerprint on Solana; every intent signing leaves a Poseidon commitment; every Groth16 proof has its public inputs on-chain. You do not need any access to a Sakura server to fully reconstruct the execution path. This is Verifiable Compute at its architectural limit.",
        steps: [
          { step: "1", title: "Retrieve ActionRecord PDAs from Solscan", desc: "On Solscan, search the audited wallet and filter on Sakura's program ID (AnszeCRFsBKmT5fBY9WywxGsZZZob8ZPFYqboYXpuYLp). Each execute_with_intent_proof transaction creates an ActionRecord PDA seeded by (intent_commitment, action_nonce). Download all such account records — this is the complete timeline of agent actions for that wallet." },
          { step: "2", title: "Parse the keccak256 action fingerprint", desc: "Each ActionRecord holds: the 32-byte intent commitment, action_nonce, action_type, action_target, action_amount, landed slot, and a keccak256 execution fingerprint. The fingerprint is the keccak256 hash of (intent, nonce, type, target, amount, slot). You can compute it independently and compare — any discrepancy is evidence of post-hoc tampering." },
          { step: "3", title: "Download the public verifying key", desc: "The Groth16 verifying key is baked into zk_verifying_key.rs at deploy time; it cannot be altered without redeployment. Download the vkey from GitHub (MIT-licensed) or directly from the deployed program account. The vkey's SHA-256 should match the CI artifact hash recorded against the deploy commit — any mismatch is a red flag." },
          { step: "4", title: "Verify with snarkjs — independently", desc: "Run snarkjs.groth16.verify(vkey, publicSignals, proof) on every audited action using any standard version of snarkjs. If your reconstructed Poseidon commitment matches the one on-chain, the proof verifies, and the Pyth slot is within the 150-block freshness window, then the action mathematically did fall inside the signed bounds. The audit conclusion is independent of any Sakura server and of any agent operator." },
        ],
        risks: [],
      },
    ],
    feeTitle: "Transparent Fee Structure · Pay-per-use, no hidden charges, no token",
    fees: [
      { feature: "🪪 Intent signing", free: "First $10M integrator volume rebated", paid: "0.1% of notional, one-time, on-chain" },
      { feature: "🤖 Agent action", free: "—", paid: "$0.01 per verified action, on-chain" },
      { feature: "📮 x402 MCP call", free: "—", paid: "$1 USDC per call, atomic via HTTP 402" },
    ],
    contact: "Integration support, technical questions, compliance inquiries:",
    contactHandle: "𝕏 @sakuraaijp",
  },
  ja: {
    back: "← ホームへ戻る",
    badge: "🌸 統合ドキュメント · SOLANA エージェント境界層",
    title: "Sakura 統合ドキュメント",
    subtitle: "2026 年上期、Phantom、Backpack、Abstract、Infinex の 4 社は、それぞれエージェントモードを出荷する。各社がこの検証層——署名検証、Pyth 価格統合、150 ブロック新鮮度、再生防止——を独立に構築する場合、コストはウォレットあたりエンジニア四半期の単位である。Sakura は、それを一度だけ構築し、4 社すべてに届ける。1 つの文書、3 つの統合パス。ソースは MIT。統合に許可は要らない。",
    sections: [
      {
        id: "wallet-integrator",
        badge: "パス I · ウォレット統合者",
        badgeColor: "#C9312A",
        title: "🪪 ウォレット統合者",
        subtitle: "Phantom / Backpack / Abstract / Infinex が Sakura を接続する方法",
        intro: "ウォレットが Sakura を接続するビジネス上の動機は、1 つである——この層を自社で構築する工数を省くこと。この問題は一度解かれるべきであり、四度解かれるべきではない。統合者の最初の \$10M 分はリベート、以降は 0.1% の名目額が自動的にプロトコル金庫へ流れる。事業開発交渉、BD プロセス、枠の承認、いずれも存在しない。SDK のインストールから、ユーザーが最初の意図に署名するまで、エンジニアリングカレンダー上はおよそ 1 週間——四半期ではない。",
        steps: [
          { step: "1", title: "SDK をインストール · ウォレット provider を接続", desc: "yarn add @sakura/solana-sdk。IntentSigner React コンポーネントをインポートし、ウォレット provider（Phantom、Backpack、OKX のいずれでも）を渡す。SDK は既定で Solana mainnet-beta に接続。devnet への切替は 1 つの prop のみ。API キー不要、OAuth 不要、Sakura への登録不要。" },
          { step: "2", title: "意図署名 UI をレンダリング", desc: "エージェントモード設定ページに <IntentSigner /> を配置。ユーザーは、エージェントの動作境界を自然言語で書き下す——たとえば「エージェントは Kamino に、1 回 \$500 USDC、1 週間だけ貸せる」。SDK はこれを 7 つのポリシー値（意図テキスト、ウォレット、ノンス、金額上限、USD 上限、プロトコルビットマップ、アクションビットマップ）に解析する。元の値はブラウザに留まり、Sakura のサーバーには一切届かない。" },
          { step: "3", title: "署名 · コミットメントをオンチェーンに定錨", desc: "ユーザーが確定すると、SDK は 7 つの値を 2 層 Poseidon ツリーで 32 バイトのコミットメントに畳み込み、sign_intent 命令を発行。コミットメントはユーザーのウォレットをシードとする PDA に書き込まれる。名目額の 0.1% の一回限り手数料は、approve された USDC から自動的に控除され、プロトコル金庫へルーティングされる——統合者の最初の \$10M 分は免除。ユーザーの側から見えるのは、ただ 1 回のウォレット署名。" },
          { step: "4", title: "統合監査 · リベートを受領", desc: "統合完了後、貴社ウォレットアドレスは Sakura のリベートホワイトリストに登録される。統合者の最初の \$10M 分は、事前に宣言した USDC アドレスへ自動リベートされる。以降、0.1% はプロトコル金庫に流れる（運営 85%、プラットフォーム 15%）。各意図署名トランザクションは、Solscan 上に keccak256 指紋を残す——貴社、監査人、規制当局は、Sakura のサーバーを経由せずに、任意の 1 件を独立に復元できる。" },
        ],
        risks: [],
      },
      {
        id: "agent-developer",
        badge: "パス II · エージェント開発者",
        badgeColor: "#B8932A",
        title: "🤖 エージェント開発者",
        subtitle: "AI エージェントが Groth16 証明を生成し、動作を提出する方法",
        intro: "エージェントが何らかの動作を行う前に、その動作がユーザー署名済みの境界内にあることを証明せねばならない。Sakura クライアントは、ブラウザ内で 600ms 以内に Groth16 証明を生成する。オンチェーン検証器は、ペアリング検証を約 116k CU で完了する——呼び出し 1 回あたりおよそ \$0.0001。プライベートなポリシー値は一切開示されない。開示されるのは、ただ一つの命題——「この動作は、境界内」。",
        steps: [
          { step: "1", title: "lib/adapters で未署名 DeFi 命令を組み立てる", desc: "Sakura は Solana の 4 龍頭プロトコル向けのメインネット adapter（lib/adapters/{jito,raydium,kamino,jupiter-lend}.ts）を内蔵しており、計 13 アクションセルすべてが本物の CPI 命令を生成する——Jupiter（Swap + Lend × 4）、Raydium（Swap）、Kamino（Lend / Borrow / Repay / Withdraw）、Jito（Stake / Unstake）。誰でも npx tsx scripts/verify-{jito,raydium,kamino,jupiter-lend}-adapter.ts を実行して独立に再現検証できる。Sakura SDK は buildActionWitness() 関数を提供し、adapter から返される TransactionInstruction を受け取り、回路の public inputs として必要な 3 つのコア欄位——action_type、action_target、action_amount——を自動抽出する。" },
          { step: "2", title: "ブラウザ内で Groth16 証明を生成", desc: "generateProof({ witness, privateValues }) を呼び出す。snarkjs がブラウザローカルで Groth16 証明を生成する。証明は「この動作は署名済みコミットメントの内側にある」ことだけを主張し、いかなるポリシー値も開示しない。回路が強制する制約は 5 項目——コミットメントハッシュの一致、金額上限、プロトコル許可リスト、動作タイプ許可リスト、USD 上限（Pyth の現行価格に基づく）。ブラウザ側の生成時間は約 600 ms。" },
          { step: "3", title: "v0 アトミックトランザクションに束ねる", desc: "buildAtomicTx({ proof, defiIx }) を呼び出し、検証命令（execute_with_intent_proof）と DeFi 命令を、単一の Solana v0 トランザクションに束ねる。両者は運命を共にする——証明が検証に失敗するか、あるいは DeFi 命令が失敗した場合、トランザクション全体がリバートされる。「証明は通ったが動作は宙に浮いた」という隙間は、存在しない。各エージェント動作は \$0.01 で決済され、オンチェーン検証コストを補填する。" },
          { step: "4", title: "提出 · Solscan に監査指紋を残す", desc: "トランザクションをメインネットに提出する。成功すると、(intent_commitment, action_nonce) をシードとする ActionRecord PDA が作成され、動作の keccak256 指紋がオンチェーンに永久に定錨される。Solscan 上、ユーザー、監査人、取引相手は、各々独立にこの動作を復元できる——意図は何であったか、証明は通過したか、DeFi 命令は何であったか、いつ着地したか。Sakura は誰の信頼も保持しない。オンチェーンのゲートとしてのみ、機能する。" },
        ],
        risks: [],
      },
      {
        id: "auditor-enterprise",
        badge: "パス III · 監査 / コンプライアンス / 機関",
        badgeColor: "#5A7A4A",
        title: "🔍 監査 / コンプライアンス / 機関",
        subtitle: "弁護士、監査人、機関コンプライアンスが独立に検証する方法",
        intro: "Sakura の価値提案は「我々を信じよ」ではない。「我々を信じる必要はない」である。各エージェント動作は、Solana に keccak256 指紋を残す。各意図署名は、Poseidon コミットメントを残す。各 Groth16 証明は、その public inputs をオンチェーンに残す。Sakura のサーバーに一切アクセスせずとも、実行経路は完全に復元できる。これが Verifiable Compute のアーキテクチャ上の最高保証である。",
        steps: [
          { step: "1", title: "Solscan から ActionRecord PDA を取得", desc: "Solscan で監査対象のウォレットを検索し、Sakura のプログラム ID（AnszeCRFsBKmT5fBY9WywxGsZZZob8ZPFYqboYXpuYLp）でフィルタリングする。各 execute_with_intent_proof トランザクションは、(intent_commitment, action_nonce) をシードとする ActionRecord PDA を作成する。すべての ActionRecord アカウントデータをダウンロードする——これが、当該ウォレットにおけるエージェント動作の完全なタイムラインである。" },
          { step: "2", title: "keccak256 動作指紋を解析", desc: "各 ActionRecord には以下が含まれる：32 バイト意図コミットメント、action_nonce、action_type、action_target、action_amount、着地 slot、keccak256 実行指紋。指紋は、(intent, nonce, type, target, amount, slot) の keccak256 ハッシュである。独立に計算して比較可能——いかなる不一致も、事後改竄の証拠である。" },
          { step: "3", title: "公開 verifying key をダウンロード", desc: "Sakura の Groth16 検証鍵は、デプロイ時に zk_verifying_key.rs に焼き込まれる。再デプロイなしには変更できない。鍵は GitHub（MIT ライセンス）から、あるいはデプロイ済みのプログラムアカウントから直接取得できる。鍵の SHA-256 は、デプロイコミットに対する CI artifact のハッシュと一致するはずである——いかなる不一致も、レッドフラッグである。" },
          { step: "4", title: "snarkjs で独立に検証", desc: "任意のバージョンの snarkjs を用いて、各監査対象動作について snarkjs.groth16.verify(vkey, publicSignals, proof) を実行する。貴方が再構成した Poseidon コミットメントがオンチェーンのものと一致し、証明が検証を通過し、かつ Pyth slot が 150 ブロックの新鮮度内にあれば——当該動作は数学的に、署名済みの境界内に収まっていた。この監査結論は、Sakura の任意のサーバーから、そしていかなるエージェント運営者からも、独立している。" },
        ],
        risks: [],
      },
    ],
    feeTitle: "透明な料金体系 · 従量課金、隠れコストなし、トークンなし",
    fees: [
      { feature: "🪪 意図署名", free: "統合者の最初の $10M 分は免除", paid: "名目額の 0.1%、一回限り、オンチェーンで徴収" },
      { feature: "🤖 エージェント動作", free: "—", paid: "検証 1 回あたり $0.01、オンチェーンで徴収" },
      { feature: "📮 x402 MCP 呼び出し", free: "—", paid: "$1 USDC / 回、HTTP 402 により原子決済" },
    ],
    contact: "統合サポート、技術的な質問、コンプライアンスの問い合わせ：",
    contactHandle: "𝕏 @sakuraaijp",
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

        {/* Sakura intro block — aligned to current product thesis */}
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
              🌸 Sakura · 為 AI 代理而建 · 由數學強制執行
            </div>
            <div style={{ fontSize: 13, fontWeight: 400, color: "var(--text-primary)", marginBottom: 8, fontFamily: "var(--font-heading)", letterSpacing: "0.04em" }}>
              {lang === "zh" ? "每一家代理錢包都得蓋的這一層 · 做一次，給四家同時" :
               lang === "ja" ? "どのエージェントウォレットも構築せねばならぬ層——一度だけ造り、4 社に同時に届ける" :
               "The layer every agentic wallet will build — built once, for all four of them"}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.9 }}>
              {lang === "zh"
                ? "Sakura 是 Solana 原生的代理執行邊界層。用戶簽下一句自然語言邊界——Poseidon 壓縮為 32 位元組承諾上鏈；代理每一次動作都附 Groth16 證明，由鏈上 alt_bn128 配對 syscall 於 ~116k CU 驗證，然後 DeFi 指令才被允許動用用戶資金。零託管。無代幣。源碼 MIT。整合無需許可。用戶即是主權，數學不過是強制執行。"
                : lang === "ja"
                ? "Sakura は、AI エージェントのための Solana ネイティブ実行境界層である。ユーザーは、自然言語で境界を 1 度だけ署名する——Poseidon が 32 バイトのコミットメントに圧縮し、オンチェーンに定錨する。エージェントの各動作には Groth16 証明が伴い、オンチェーンの alt_bn128 ペアリング syscall が約 116k CU で検証する——その後でなければ、DeFi 命令はユーザーの資金に触れることができない。ゼロカストディ。トークンなし。ソースは MIT。統合に許可は要らない。ユーザーこそが主権、数学はその執行にすぎぬ。"
                : "Sakura is a Solana-native execution-bounds layer for AI agents. The user signs, once, a natural-language bound — Poseidon compresses it into a 32-byte commitment on-chain. Every agent action thereafter must ship with a Groth16 proof, verified on-chain by the alt_bn128 pairing syscall in ~116k CU, before the DeFi instruction is allowed to touch user funds. Zero custody. No token. MIT source. Permissionless integration. The user is the sovereign. The math, merely the enforcement."}
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
