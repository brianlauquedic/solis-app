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
    badge: "INTEGRATION PLAYBOOK · AGENTIC BOUNDS LAYER",
    title: "Sakura 整合案例",
    subtitle: "六個場景，三種身份——錢包整合者、代理開發者、審計/合規機構。每一個場景給出具體工程路徑、費用結構、鏈上驗證指紋，以及「如果不用 Sakura 會付出什麼代價」的參照數字。不是行銷口號，是可核驗的工程事實。",
    contextLabel: "場景",
    outcomeLabel: "Sakura 的路徑",
    ctaTitle: "開始整合",
    ctaSubtitle: "首 $10M 整合量免收路由費 · 源碼 MIT · 整合無需許可",
    ctaPhantom: "👻 連接 Phantom 體驗 →",
    ctaOkx: "◈ 連接 OKX 體驗 →",
  },
  en: {
    back: "← Back to Home",
    badge: "INTEGRATION PLAYBOOK · AGENTIC BOUNDS LAYER",
    title: "Sakura Integration Playbook",
    subtitle: "Six scenarios across three roles — wallet integrator, agent developer, auditor / institutional compliance. Each gives a concrete engineering path, the fee structure at work, the on-chain verification fingerprint, and a reference number for \"what it would cost not to use Sakura.\" No marketing claims — verifiable engineering facts.",
    contextLabel: "Scenario",
    outcomeLabel: "Sakura's path",
    ctaTitle: "Start Integrating",
    ctaSubtitle: "First $10M of integrator notional rebated · MIT source · permissionless integration",
    ctaPhantom: "👻 Try with Phantom →",
    ctaOkx: "◈ Try with OKX →",
  },
  ja: {
    back: "← ホームへ戻る",
    badge: "INTEGRATION PLAYBOOK · エージェント境界層",
    title: "Sakura 統合事例集",
    subtitle: "6 つのシナリオ、3 つの役柄——ウォレット統合者、エージェント開発者、監査/機関コンプライアンス。それぞれに、具体的なエンジニアリング経路、稼働する料金構造、オンチェーン検証の指紋、そして「Sakura を使わなかった場合の代価」の参照数字を示す。マーケティング上の約束ではない。検証可能なエンジニアリングの事実である。",
    contextLabel: "シナリオ",
    outcomeLabel: "Sakura の経路",
    ctaTitle: "統合を始める",
    ctaSubtitle: "統合者の最初の $10M 分はリベート · ソースは MIT · 統合に許可は要らない",
    ctaPhantom: "👻 Phantom で試す →",
    ctaOkx: "◈ OKX で試す →",
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
    id: "uc-wallet",
    feature: "🪪 Wallet Integrator",
    featureColor: "#C9312A",
    badge: "PATH I · WALLET INTEGRATOR",
    cases: [
      {
        title: {
          zh: "Phantom 代理模式：直接接 Sakura，省掉 4 個工程師月",
          en: "Phantom Agent Mode: integrate Sakura, skip four engineer-months",
          ja: "Phantom のエージェントモード：Sakura を接続し、4 エンジニア月を節約する",
        },
        persona: {
          zh: "錢包工程團隊",
          en: "Wallet Engineering Team",
          ja: "ウォレットエンジニアリングチーム",
        },
        context: {
          zh: "Phantom 計劃在 2026 H1 推出代理模式。自家實作需要：Pyth 價格整合（1 工程師月）、簽名驗證與 nonce 防重放（1.5 工程師月）、150 塊新鮮度檢查（0.5 工程師月）、Groth16 驗證器接入（1 工程師月，或放棄 ZK 選雙伺服器方案）。總計約 4 工程師月，且每次 Solana 協議升級要重做一輪。",
          en: "Phantom plans to ship agent mode in H1 2026. Building in-house requires: Pyth oracle integration (1 engineer-month), signature check + replay guard (1.5), 150-block freshness (0.5), Groth16 verifier (1 engineer-month, or skip ZK and accept two-server trust). Roughly four engineer-months, re-incurred on every Solana protocol upgrade.",
          ja: "Phantom は 2026 年上期にエージェントモードを出荷する予定である。自社実装に要するのは：Pyth オラクル統合（エンジニア 1 人月）、署名検証と再生防止（1.5 人月）、150 ブロック新鮮度（0.5 人月）、Groth16 検証器（1 人月、あるいは ZK を諦めて二重サーバー信頼モデルを受け入れる）。合計およそ 4 エンジニア月。Solana プロトコル更新の度に再発生する。",
        },
        outcome: {
          zh: "接入 Sakura SDK：yarn add @sakura/solana-sdk。IntentSigner 元件放入代理模式設定頁；用戶簽署時透過 SDK 上鏈 32 位元組 Poseidon 承諾，一次性 0.1% 費用鏈上扣除。前 $10M 整合量免收，rebate 自動到 Phantom 指定的 USDC 錢包。總接入時程：工程 1 週，不需任何商務談判。每次 Solana 升級——Sakura 自動維護。",
          en: "Integrate the Sakura SDK: yarn add @sakura/solana-sdk. Drop the IntentSigner component into the agent-mode settings page; when the user signs, the SDK anchors a 32-byte Poseidon commitment on-chain and deducts a one-time 0.1% fee. The first $10M of integrator notional is rebated automatically to the USDC wallet Phantom declares. Total integration time: roughly one week of engineering. No business-development conversation required. Every Solana upgrade is maintained by Sakura.",
          ja: "Sakura SDK を統合する：yarn add @sakura/solana-sdk。IntentSigner コンポーネントをエージェントモードの設定画面に配置すれば、ユーザーが署名する際に SDK が 32 バイトの Poseidon コミットメントをオンチェーンに定錨し、名目額 0.1% の一回限り手数料を控除する。統合者の最初の $10M 分は、Phantom が指定した USDC アドレスへ自動的にリベートされる。総統合期間：およそエンジニア 1 週間。事業開発の交渉は一切要らない。Solana プロトコル更新の保守は Sakura 側が担う。",
        },
        tag: {
          zh: "錢包整合",
          en: "Wallet Integration",
          ja: "ウォレット統合",
        },
      },
      {
        title: {
          zh: "Backpack 的差異化：用「用戶即主權」代替「您授權我們代管」",
          en: "Backpack's Differentiation: \"User IS Sovereign\" replacing \"You authorize us to manage\"",
          ja: "Backpack の差異化——「ユーザーこそが主権である」、「お客様が私たちに管理を委任する」に代わって",
        },
        persona: {
          zh: "錢包產品團隊",
          en: "Wallet Product Team",
          ja: "ウォレットプロダクトチーム",
        },
        context: {
          zh: "代理模式是 2026 年 Solana 錢包的同質化戰場。會話金鑰輪替、allowlist、授權彈窗——四家錢包能做的事情幾乎沒有差別，都在同一層運營承諾上競爭。獲客故事蒼白，用戶選哪家靠 UI 手感，不靠結構差異。",
          en: "Agent mode is the commoditization battleground for Solana wallets in 2026. Session-key rotation, allowlists, approval popups — the four wallets are almost indistinguishable, competing on the same layer of operator promises. The acquisition story reads thin. Users choose on UI feel, not on structural difference.",
          ja: "エージェントモードは、2026 年の Solana ウォレットにとっての均質化の戦場である。セッションキーのローテーション、許可リスト、承認ポップアップ——4 社のウォレットは、ほぼ区別がつかないまま、同じ運営者の約束のレイヤーで競争している。獲得のナラティブは薄く、ユーザーは UI の手触りで選ぶのであって、構造的な違いでは選ばない。",
        },
        outcome: {
          zh: "接 Sakura 後，Backpack 可以用結構性命題做差異化：「在我們的代理模式下，代理的任何動作都無法越過您已簽的邊界——這由 Solana 鏈上 alt_bn128 配對驗證強制，不是由我們的伺服器承諾。用戶即是主權。」這不是行銷文案——Solscan 上每一筆代理動作都留有 keccak256 指紋，用戶可隨時獨立核驗。這是同業難複製的獲客信號。",
          en: "By integrating Sakura, Backpack differentiates on a structural claim: \"In our agent mode, the agent cannot act outside the bounds you signed — enforced by on-chain alt_bn128 pairing verification, not by our server's promise. The user is the sovereign.\" This is not marketing copy — every agent action leaves a keccak256 fingerprint on Solscan, independently verifiable at any time. A user-acquisition signal peers cannot easily replicate.",
          ja: "Sakura を統合することで、Backpack は構造的な命題で差異化できる——「当社のエージェントモードにおいて、エージェントはお客様が署名した境界の外では動けない。これは、オンチェーンの alt_bn128 ペアリング検証が強制するのであって、当社サーバーの約束ではない。ユーザーこそが、主権である」。これはマーケティングコピーではない——各エージェント動作は Solscan に keccak256 指紋を残し、いつでも独立に検証できる。競合が容易には真似できない、ユーザー獲得シグナル。",
        },
        tag: {
          zh: "產品差異化",
          en: "Product Differentiation",
          ja: "プロダクト差異化",
        },
      },
    ],
  },
  {
    id: "uc-agent",
    feature: "🤖 Agent Developer",
    featureColor: "#B8932A",
    badge: "PATH II · AGENT DEVELOPER",
    cases: [
      {
        title: {
          zh: "AI 自動再平衡代理：每次動作自動生成 Groth16 證明",
          en: "AI Rebalance Agent: Groth16 proof auto-generated for every action",
          ja: "AI 自動リバランスエージェント——各動作で Groth16 証明を自動生成",
        },
        persona: {
          zh: "AI Agent 開發者",
          en: "AI Agent Developer",
          ja: "AI エージェント開発者",
        },
        context: {
          zh: "開發者希望做一個 AI 代理，每日自動在 Kamino / Jupiter Lend / Jito 之間為用戶再平衡 USDC + SOL 收益倉位（Solana 借貸與 LST 的四大龍頭裡的三個）。問題：用戶不會為了一個還不知道能賺多少的 AI 代理，把任意金額的簽名權限交出去。必須有一個結構性的上限——但 allowlist / session key 並不夠硬。",
          en: "A developer wants to build an AI agent that daily rebalances the user's USDC + SOL yield positions across Kamino, Jupiter Lend, and Jito (three of Solana's four 龙头 lending + LST protocols). The problem: no user will sign over unbounded authority to an agent whose ROI is not yet proven. A structural ceiling is required — but allowlists and session keys are not hard enough.",
          ja: "ある開発者は、Kamino / Jupiter Lend / Jito の間で（Solana の貸付と LST の主要 4 プロトコルのうちの 3 つ）、ユーザーの USDC と SOL の利回りポジションを日次でリバランスする AI エージェントを構築したいと考えている。問題は、ROI がまだ実証されていないエージェントに、ユーザーが無制限の署名権を渡すことは決してない、ということである。構造的な上限が必要だが、許可リストやセッションキーでは硬さが足りない。",
        },
        outcome: {
          zh: "以 Sakura SDK 整合：用戶簽一次意圖——「代理每次可移動最多 $500 USDC，僅限 Kamino / Jupiter / Raydium / Jito 這四大龍頭，為期 30 天」。代理每次執行前，用 lib/adapters 組裝對應協議的真 mainnet CPI 指令（13 個格子已驗證），透過 SDK 於瀏覽器本地 600ms 生成 Groth16 證明，打包至 v0 原子交易。鏈上驗證 126k CU（實測）。用戶的上限由數學而非軟體保證——結構上不可逾越。",
          en: "Integrate via Sakura SDK: the user signs one intent — \"the agent may move up to $500 USDC per action, limited to the four 龙头 (Kamino / Jupiter / Raydium / Jito), for thirty days.\" Before each execution, the agent assembles the protocol-specific real mainnet CPI via lib/adapters (13 cells verified). The SDK generates a Groth16 proof locally in ~600ms and bundles it into a v0 atomic transaction. On-chain verification costs ~126k CU (measured). The user's cap is guaranteed by math, not by software — structurally unexceedable.",
          ja: "Sakura SDK を用いて統合する——ユーザーは、1 度の意図署名を行う。「エージェントは、Kamino / Jupiter / Raydium / Jito の 4 つの龍頭に限り、1 回最大 $500 USDC、30 日間に限って動かしてよい」。エージェントは各実行前に、lib/adapters で各プロトコルの本物のメインネット CPI 命令を組み立てる（13 セル検証済み）。SDK はブラウザ内で約 600ms の Groth16 証明を生成し、v0 アトミックトランザクションに束ねる。オンチェーン検証はおよそ 126k CU（実測）。ユーザーの上限は、ソフトウェアではなく、数学によって保証される——構造上、越えられない。",
        },
        tag: {
          zh: "代理整合",
          en: "Agent Integration",
          ja: "エージェント統合",
        },
      },
      {
        title: {
          zh: "DAO 金庫多協議授權代理：精確邊界，零治理爭議",
          en: "DAO Treasury Multi-Protocol Agent: precise bounds, zero governance disputes",
          ja: "DAO トレジャリーのマルチプロトコル委任エージェント——精密な境界、ガバナンス紛争ゼロ",
        },
        persona: {
          zh: "DAO 財庫管理者",
          en: "DAO Treasury Steward",
          ja: "DAO 財務ガバナンス",
        },
        context: {
          zh: "某 Solana DAO 金庫持有 $10M USDC，DAO 決議委託一個自動代理做流動性挖礦收益最佳化。問題：傳統的 multisig + allowlist 無法精確表達複雜意圖（「每次最多 $200k，僅限特定協議池，每週最多 50 次動作」）；若發生意外，整個金庫管理者會面臨治理彈劾。需要一份「鏈上可驗證的、每次動作皆自證合規」的授權。",
          en: "A Solana DAO treasury holds $10M USDC. The DAO resolves to delegate yield farming optimization to an autonomous agent. The problem: multisig + allowlist cannot express complex intent precisely (\"up to $200k per action, specific protocol pools only, max 50 actions per week\"). If something goes sideways, treasury stewards face governance impeachment. They need an on-chain-verifiable delegation where every action self-proves compliance.",
          ja: "ある Solana DAO のトレジャリーは $10M USDC を保有する。DAO は、利回りファーミングの最適化を自律エージェントに委任することを決議する。問題は、multisig と許可リストでは複雑な意図（「1 回最大 $200k、特定のプロトコルプールのみ、週あたり最大 50 アクション」）を精密に表現できないことである。何らかの事故が発生した場合、財務スチュワードはガバナンス的な弾劾に直面する。必要なのは、各動作が自ら合規性を証明する、オンチェーンで検証可能な委任状である。",
        },
        outcome: {
          zh: "DAO 在 multisig 簽一次意圖：七項策略值（金額 / USD 上限 / 協議位圖 / 動作位圖 / 過期 / nonce / 意圖文字）經 Poseidon 上鏈。每次代理動作鏈上驗證後才落地；越界鏈上拒絕——任何越界嘗試都在 Solscan 上留痕，治理紀錄可獨立還原。事後若有爭議，審計師以 snarkjs 獨立重驗每一筆 Groth16 證明，結論不依賴 DAO 任何一方。這是「程式化信託」（programmatic fiduciary duty）的實作範本。",
          en: "The DAO multisig signs one intent: seven policy values (amount / USD cap / protocol bitmap / action bitmap / expiry / nonce / intent text) folded through Poseidon, anchored on-chain. Each agent action lands only after on-chain verification; any out-of-bounds attempt is rejected on-chain and leaves a trace on Solscan that governance can reconstruct. If a dispute arises later, an auditor independently re-verifies every Groth16 proof with snarkjs; the conclusion does not rely on any DAO faction. This is programmatic fiduciary duty, as implementation.",
          ja: "DAO のマルチシグが、1 度の意図に署名する。7 つのポリシー値（金額 / USD 上限 / プロトコルビットマップ / アクションビットマップ / 有効期限 / ノンス / 意図テキスト）が Poseidon を経てオンチェーンに定錨される。各エージェント動作は、オンチェーン検証を通過して初めて着地する。境界外の試みはその場で拒絶され、Solscan に痕跡を残し、ガバナンス記録として独立に復元可能である。後日紛争が生じた場合、監査人は snarkjs で各 Groth16 証明を独立に再検証する——結論は、DAO のいかなる派閥からも独立する。これは、プログラム化された信認義務（programmatic fiduciary duty）の、実装としての範型である。",
        },
        tag: {
          zh: "機構委任",
          en: "Institutional Delegation",
          ja: "機関委任",
        },
      },
    ],
  },
  {
    id: "uc-auditor",
    feature: "🔍 Auditor / Enterprise",
    featureColor: "#5A7A4A",
    badge: "PATH III · AUDITOR / COMPLIANCE / ENTERPRISE",
    cases: [
      {
        title: {
          zh: "合規審計：從 Solscan 獨立驗證代理全部動作，無需存取 Sakura",
          en: "Compliance Audit: independently verify all agent actions on Solscan — no Sakura access required",
          ja: "コンプライアンス監査——Solscan 上でエージェントの全動作を独立に検証、Sakura へのアクセスは要らぬ",
        },
        persona: {
          zh: "外部合規審計師",
          en: "External Compliance Auditor",
          ja: "外部コンプライアンス監査人",
        },
        context: {
          zh: "某加密基金管理代理投資組合，年終時 LP 要求第三方審計師出具「代理的每一筆動作皆在章程授權範圍內」的獨立意見。傳統審計方式：向基金索取後端日誌、審核 Sakura 伺服器存取權、人工比對——成本高、可信度低、任何伺服器失信都會讓整個意見站不住。",
          en: "A crypto fund runs an agent-managed portfolio. At year-end, LPs demand a third-party auditor's independent opinion that \"every agent action fell within the charter's authorized bounds.\" Traditional audit paths: request backend logs from the fund, audit Sakura server access, manual reconciliation — high cost, low confidence, any server breach invalidates the entire opinion.",
          ja: "ある暗号資産ファンドは、エージェント運用のポートフォリオを運用する。年度末、LP は「エージェントの全動作が定款上の授権範囲内に収まっていた」ことを保証する第三者監査人の独立意見を求めてくる。従来の監査経路は、ファンドにバックエンドログの開示を求め、Sakura のサーバーアクセスを監査し、人手で突合する——コストは高く、信頼度は低く、サーバー侵害が一件でもあれば、意見全体が成り立たなくなる。",
        },
        outcome: {
          zh: "審計師從 Solscan 直接檢索基金錢包對應的 ActionRecord PDA（以 Sakura program ID 過濾），下載公開的 Groth16 verifying key（從 GitHub 或已部署合約）。以標準 snarkjs 重驗每一筆動作的證明：若 Poseidon 承諾與鏈上一致、Groth16 驗證通過、Pyth slot 在新鮮度窗口內——這筆動作在數學上確實在章程邊界內。100% 獨立於基金、獨立於 Sakura，結論可審計、可重現。",
          en: "The auditor queries Solscan directly for ActionRecord PDAs tied to the fund's wallet (filtered by Sakura's program ID), downloads the public Groth16 verifying key (from GitHub or directly from the deployed program). Using standard snarkjs, they re-verify every action's proof: if the Poseidon commitment matches on-chain, Groth16 verification passes, and the Pyth slot falls within the freshness window — the action mathematically sat inside the charter's bounds. Fully independent of the fund, fully independent of Sakura; the conclusion is auditable and reproducible.",
          ja: "監査人は、Solscan から直接、ファンドのウォレットに紐づく ActionRecord PDA を（Sakura のプログラム ID でフィルタリングして）取得し、公開の Groth16 検証鍵を（GitHub から、あるいはデプロイ済みのプログラムから）ダウンロードする。標準的な snarkjs を用いて、各動作の証明を再検証する。Poseidon コミットメントがオンチェーンのものと一致し、Groth16 検証が通過し、Pyth slot が新鮮度ウィンドウに収まっていれば——当該動作は、数学的に定款の境界内に収まっていたことになる。ファンドからも、Sakura からも、完全に独立した結論——監査可能、再現可能である。",
        },
        tag: {
          zh: "合規驗證",
          en: "Compliance Verification",
          ja: "コンプライアンス検証",
        },
      },
      {
        title: {
          zh: "訴訟重建：律師以鏈上證據還原代理行為時序",
          en: "Dispute Reconstruction: counsel rebuilds agent behavior timeline from on-chain evidence",
          ja: "訴訟における事実復元——弁護士がオンチェーン証拠から、エージェント挙動のタイムラインを再構成する",
        },
        persona: {
          zh: "法律顧問",
          en: "Legal Counsel",
          ja: "法務顧問",
        },
        context: {
          zh: "一筆來自 AI 代理的大額交易出現爭議——用戶主張代理「超出授權範圍」，代理運營方主張「合規範圍內」。傳統舉證：雙方互相出示後端日誌，法庭上真偽難辨。任何一方伺服器被入侵或日誌被動過，證據鏈即崩潰。",
          en: "A large-value transaction executed by an AI agent becomes disputed — the user claims the agent \"exceeded authorized scope,\" while the agent operator claims \"it remained in scope.\" Traditional evidence: both sides present backend logs; their truthfulness cannot be determined from the bench. If either server is compromised or its logs edited, the evidentiary chain collapses.",
          ja: "AI エージェントが執行した高額取引をめぐって、紛争が生じる——ユーザーは「エージェントは授権範囲を超えた」と主張し、エージェント運営者は「範囲内に収まっていた」と主張する。従来の立証は、双方がそれぞれバックエンドログを提出する、というものだが、法廷ではその真偽を見抜くことができない。いずれか一方のサーバーが侵害された、あるいはログが改変された場合、証拠鎖は崩壊する。",
        },
        outcome: {
          zh: "律師以被爭議動作的 tx signature 於 Solscan 直接調取 ActionRecord：32 位元組意圖承諾、action_nonce、動作類型、目標協議、金額、landed slot、keccak256 指紋，一目了然。對比用戶錢包簽署 sign_intent 時的原始承諾，若指紋匹配——代理動作確實在簽署邊界內；若不匹配——動作必然在運營方偽造。證據在鏈上留存、不可篡改、獨立於任何一方的伺服器。這是 Solana 作為司法可受證據載體的使用範例。",
          en: "Counsel pulls the disputed action's ActionRecord from Solscan using the tx signature: 32-byte intent commitment, action_nonce, action type, target protocol, amount, landed slot, keccak256 fingerprint — all legible at a glance. Compared against the user's wallet's original sign_intent commitment, a matching fingerprint proves the action sat inside the signed bounds; a mismatch proves the operator fabricated. The evidence lives on-chain, cannot be tampered with, and is independent of any party's server. This is Solana functioning as a judicially admissible evidentiary layer.",
          ja: "弁護士は、紛争中の動作の tx signature を用いて、Solscan から直接 ActionRecord を取得する——32 バイトの意図コミットメント、action_nonce、動作タイプ、対象プロトコル、金額、着地 slot、keccak256 指紋、すべてが一目で読める。ユーザーのウォレットが sign_intent を行った際の元のコミットメントと照合し、指紋が一致すれば——エージェント動作は署名済み境界内に収まっていた。一致しなければ——運営者の側の捏造、ということになる。証拠はオンチェーンに残り、改竄できず、いかなる当事者のサーバーからも独立する。これは、Solana が司法上受理可能な証拠レイヤーとして機能する使用例である。",
        },
        tag: {
          zh: "司法證據",
          en: "Judicial Evidence",
          ja: "司法証拠",
        },
      },
    ],
  },
];

export default function UseCasesPage() {
  const { lang } = useLang();
  const l = lang as L;
  const p = PAGE_TEXT[l] ?? PAGE_TEXT.zh;

  return (
    <main style={{ minHeight: "100vh", background: "var(--bg-base)", color: "var(--text-primary)" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "60px 24px 40px" }}>

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

        {/* Sakura intro — aligned to current product thesis */}
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
              🌸 Sakura · 代理執行邊界層 · 數學強制執行
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.9 }}>
              {lang === "zh"
                ? "Sakura 是代理錢包、代理開發者、審計/合規機構三方共用的一層：用戶以一句話簽下代理的動作邊界，Poseidon 壓縮為 32 位元組承諾上鏈；代理每一次動作都附 Groth16 證明，由 Solana alt_bn128 配對 syscall 於 ~116k CU 驗證；越界鏈上拒絕、在場鏈上留痕、爭議可鏈上還原。用戶即是主權。數學只是強制執行。"
                : lang === "ja"
                ? "Sakura は、エージェントウォレット、エージェント開発者、監査/コンプライアンス機関の三者が共有する 1 つのレイヤーである——ユーザーは 1 文でエージェントの動作境界を署名し、Poseidon が 32 バイトのコミットメントに圧縮してオンチェーンに定錨する。エージェントの各動作は Groth16 証明を伴い、Solana の alt_bn128 ペアリング syscall が約 116k CU で検証する。境界外はオンチェーンで拒絶され、動作はオンチェーンに痕跡を残し、紛争はオンチェーンで復元できる。ユーザーこそが主権。数学はその執行にすぎぬ。"
                : "Sakura is the single layer shared by three roles — wallet integrator, agent developer, auditor/compliance: the user signs the agent's action bounds in a single sentence, Poseidon compresses them into a 32-byte commitment on-chain; every agent action ships with a Groth16 proof, verified by Solana's alt_bn128 pairing syscall in ~116k CU; out-of-bounds is rejected on-chain, in-bounds leaves a fingerprint on-chain, disputes reconstructed on-chain. The user is the sovereign. The math, merely the enforcement."}
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
                  <div className="use-case-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
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
