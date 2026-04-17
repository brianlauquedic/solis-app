"use client";

import { useLang } from "@/contexts/LanguageContext";
import Footer from "@/components/Footer";

const CONTENT = {
  en: {
    badge: "PRIVACY · SAKURA AI GUARDIAN",
    title: "Privacy Policy",
    updated: "Last updated: 6 April 2026",
    sections: [
      {
        heading: "1. Overview",
        body: [
          `This Privacy Policy ("Policy") describes how Sakura ("Sakura," "we," "us," or "our") collects, uses, stores, and shares information when you access or use Sakura Mutual — our zero-knowledge insurance settlement protocol on Solana and its associated Solana-native defense suite (Nonce Guardian, Ghost Run, Liquidation Shield), including the web application, the mutual-pool smart contract, AI analysis features, and all associated interfaces (collectively, the "Services").`,
          `Sakura is non-custodial. We do not hold custody of your assets. Insurance claims on Sakura Mutual are settled by on-chain Groth16 ZK-proof verification (alt_bn128_pairing syscall), not by human discretion. Any on-chain action Sakura takes on your behalf — Ghost Run execution, Liquidation Shield rescue, or claim repayment — occurs only within your explicit per-transaction signature or your pre-authorized SPL Token Approve spending cap. Your Phantom wallet remains entirely under your control at all times.`,
          `By using the Services, you acknowledge that you have read and understood this Policy and consent to the collection and use of your information as described herein. This Policy should be read alongside our Terms of Service.`,
        ],
      },
      {
        heading: "2. Information We Collect",
        subsections: [
          {
            title: "2.1 Wallet Information",
            items: [
              "Public wallet address – when you connect your Phantom wallet, we read your public wallet address. We never request or access your private keys, seed phrase, or signing authority.",
              "On-chain portfolio data – token holdings, balances, and transaction history that are publicly visible on the Solana blockchain, retrieved via Helius RPC for analysis purposes.",
            ],
          },
          {
            title: "2.2 AI Interaction Data",
            items: [
              "AI analysis logs – wallet addresses submitted to Nonce Guardian, strategy descriptions submitted to Ghost Run, and lending position data queried via Liquidation Shield.",
              "AI-generated outputs – Claude AI security reports (SHA-256 hashed and recorded on Solana), Ghost Run simulation results, and Liquidation Shield rescue logs. On-chain Memo records are permanently public.",
            ],
          },
          {
            title: "2.3 Usage and Technical Data",
            items: [
              "Device and environment data – device type, operating system, browser type and version, IP address, and time zone.",
              "In-app behavioral data – pages visited, features accessed, session duration, and error logs.",
            ],
          },
          {
            title: "2.4 Subscription Data",
            items: [
              "Subscription tier – your current plan (Free or Pro) and credit usage.",
              "Payment processing – payment transactions are handled by Stripe. Sakura does not store raw payment card data.",
            ],
          },
          {
            title: "2.5 Cookies and Tracking Technologies",
            body: "We use cookies and similar technologies for session management, security monitoring, and analytics. You may control non-essential cookies through your browser settings.",
          },
          {
            title: "2.6 Minors",
            body: "The Services are intended solely for users who are at least 18 years of age. We do not knowingly collect personal information from anyone under 18.",
          },
        ],
      },
      {
        heading: "3. How We Use Your Information",
        intro: "We use the information we collect for the following purposes:",
        items: [
          "Deliver AI analysis – Nonce Guardian security reports, Ghost Run strategy simulations, and Liquidation Shield rescue operations powered by Claude AI.",
          "Blockchain data retrieval – querying Helius RPC and Solana program accounts to fetch on-chain data required for Nonce Guardian scans, Ghost Run simulations, and Liquidation Shield health factor monitoring.",
          "Platform improvement – improving AI models and platform performance using anonymized, aggregated data only.",
          "Subscription management – managing your plan, credit balance, and billing cycle.",
          "Security and compliance – detecting abuse, fraud, and enforcing our Terms of Service.",
          "Legal obligations – complying with applicable laws and lawful authority requests.",
        ],
        note: "We do not use your wallet data or AI conversation history to train AI models without first anonymizing or aggregating such data.",
      },
      {
        heading: "4. Sharing of Information",
        intro: "We do not sell your personal information. We may share your information in the following circumstances:",
        subsections: [
          { title: "Infrastructure and service providers", body: "We share data with hosting, analytics, and security vendors under strict data processing agreements. This includes Helius (Solana RPC for on-chain data), Claude AI (Anthropic) for AI security reports and strategy parsing, Jupiter (DEX aggregator for Ghost Run execution), and Solana Agent Kit (SAK) for on-chain transaction execution." },
          { title: "Blockchain data", body: "Your public wallet address is used to query the Solana blockchain. Blockchain data is inherently public. Sakura writes to the blockchain on your behalf only during Ghost Run execution (with your explicit confirmation) and Liquidation Shield rescue (within your pre-authorized SPL Token Approve spending cap). SHA-256 hashes of AI reports are permanently recorded via Solana Memo Program and are publicly visible." },
          { title: "Legal and regulatory authorities", body: "We may disclose your information in response to lawful requests from government authorities or where necessary to prevent fraud or comply with applicable law." },
          { title: "Corporate transactions", body: "In connection with a merger, acquisition, or similar transaction, your information may be transferred to the acquiring entity, subject to equivalent privacy protections." },
          { title: "Aggregated or anonymized statistics", body: "We may share aggregated, non-personally identifiable data for analytical or promotional purposes." },
        ],
      },
      {
        heading: "5. Blockchain Data Notice",
        body: ["The Solana blockchain is a public ledger. Your wallet address and all transactions associated with it are permanently visible on-chain. Sakura reads this public data to provide analysis but cannot delete or modify any on-chain records. Connecting your wallet to Sakura does not grant us any signing authority or control over your funds."],
      },
      {
        heading: "6. Security",
        body: [
          "We implement industry-standard security measures including TLS encryption for data in transit, role-based access controls, and regular security reviews. We never request your private key, seed phrase, or any wallet signing permission beyond read-only portfolio access.",
          "While we take reasonable precautions, no system is perfectly secure. You are responsible for maintaining the security of your own Phantom wallet.",
        ],
      },
      {
        heading: "7. Data Retention",
        intro: "We retain personal data only for as long as necessary to:",
        items: [
          "Deliver and improve the Services;",
          "Comply with applicable legal and regulatory requirements; and",
          "Resolve disputes and enforce our rights.",
        ],
        note: "When data is no longer required for these purposes, it is securely deleted or irreversibly anonymized.",
      },
      {
        heading: "8. Your Choices and Rights",
        intro: "Depending on your jurisdiction, you may have the right to:",
        items: [
          "Access a copy of the personal information we hold about you;",
          "Correct inaccurate or incomplete information;",
          "Delete your personal data (subject to legal retention obligations);",
          "Restrict or object to certain processing activities;",
          "Portability – receive your data in a structured, machine-readable format;",
          "Withdraw consent for optional processing activities at any time.",
        ],
        note: "To exercise any of these rights, contact us via @sakuraaijp on X.",
      },
      {
        heading: "9. Updates to This Policy",
        body: ["We may revise this Policy from time to time. Material changes will be communicated in-app with reasonable advance notice. Continued use of the Services after the effective date of any update constitutes your acceptance of the revised Policy."],
      },
      {
        heading: "10. Contact",
        body: ["If you have questions, concerns, or requests relating to this Privacy Policy, please contact us:"],
        contact: true,
      },
    ],
  },
  zh: {
    badge: "隱私 · SAKURA AI GUARDIAN",
    title: "隱私政策",
    updated: "最後更新：2026年4月6日",
    sections: [
      {
        heading: "1. 概述",
        body: [
          `本隱私政策（「政策」）說明 Sakura（「Sakura」、「我們」或「我方」）在您訪問或使用 Sakura Mutual — 我們位於 Solana 的零知識保險結算協議，及其配套 Solana 原生防禦套件（Nonce Guardian、Ghost Run、Liquidation Shield）時，如何收集、使用、儲存和分享資訊，包括網頁應用程式、互助池智能合約、AI 分析功能及所有相關介面（統稱「服務」）。`,
          `Sakura 為非託管架構。我們不持有您的資產。Sakura Mutual 的保險理賠由鏈上 Groth16 ZK 證明驗證（alt_bn128_pairing 系統呼叫）自動結算，不由任何人工裁決。Sakura 代您執行的任何鏈上動作——Ghost Run 執行、Liquidation Shield 救援、理賠自動還款——皆需您逐筆明確簽名，或在您預先授權的 SPL Token Approve 支出上限內進行。您的 Phantom 錢包始終完全由您掌控。`,
          `使用服務即表示您已閱讀並理解本政策，並同意按照本政策所述方式收集和使用您的資訊。`,
        ],
      },
      {
        heading: "2. 我們收集的資訊",
        subsections: [
          {
            title: "2.1 錢包資訊",
            items: [
              "公開錢包地址——當您連接 Phantom 錢包時，我們讀取您的公開錢包地址。我們絕不要求或存取您的私鑰、助記詞或簽署權限。",
              "鏈上投資組合資料——透過 Helius RPC 獲取的代幣持倉、餘額及交易記錄，這些資料在 Solana 區塊鏈上公開可見。",
            ],
          },
          {
            title: "2.2 AI 互動資料",
            items: [
              "AI 分析日誌——提交給 Nonce Guardian 的錢包地址、提交給 Ghost Run 的策略描述，以及 Liquidation Shield 查詢的借貸倉位資料。",
              "AI 生成輸出——Claude AI 安全報告（SHA-256 哈希記錄在 Solana 鏈上）、Ghost Run 模擬結果及 Liquidation Shield 救援日誌。鏈上 Memo 記錄永久公開可見。",
            ],
          },
          {
            title: "2.3 使用及技術資料",
            items: [
              "設備與環境資料——設備類型、作業系統、瀏覽器類型及版本、IP 地址及時區。",
              "應用內行為資料——訪問頁面、使用功能、使用時長及錯誤日誌。",
            ],
          },
          {
            title: "2.4 訂閱資料",
            items: [
              "訂閱方案——您當前的方案（免費或 Pro）及點數使用情況。",
              "付款處理——付款交易由 Stripe 處理。Sakura 不儲存原始支付卡資料。",
            ],
          },
          {
            title: "2.5 Cookie 及追蹤技術",
            body: "我們使用 Cookie 及類似技術進行工作階段管理、安全監控及分析。您可透過瀏覽器設定控制非必要 Cookie。",
          },
          {
            title: "2.6 未成年人",
            body: "本服務僅供年滿 18 歲的使用者使用。我們不會故意收集 18 歲以下人士的個人資訊。",
          },
        ],
      },
      {
        heading: "3. 我們如何使用您的資訊",
        intro: "我們將收集的資訊用於以下目的：",
        items: [
          "提供 AI 分析——包括 Nonce Guardian 安全報告、Ghost Run 策略模擬及 Liquidation Shield 救援操作，均由 Claude AI 驅動。",
          "區塊鏈資料獲取——查詢 Helius RPC 及 Solana 程序賬戶，獲取 Nonce Guardian 掃描、Ghost Run 模擬及 Liquidation Shield 健康因子監控所需的鏈上資料。",
          "平台改進——僅使用匿名化、彙總資料改進 AI 模型及平台效能。",
          "訂閱管理——管理您的方案、點數餘額及帳單週期。",
          "安全與合規——偵測濫用、詐騙行為並執行我們的服務條款。",
          "法律義務——遵守適用法律及合法機關的要求。",
        ],
        note: "我們不會在未先匿名化或彙總您的資料的情況下，將您的錢包資料或 AI 對話記錄用於訓練 AI 模型。",
      },
      {
        heading: "4. 資訊分享",
        intro: "我們不出售您的個人資訊。在以下情況下，我們可能分享您的資訊：",
        subsections: [
          { title: "基礎設施及服務提供商", body: "我們在嚴格的資料處理協議下與供應商共享資料，包括 Helius（Solana RPC 鏈上資料）、Claude AI（Anthropic，AI 安全報告與策略解析）、Jupiter（DEX 聚合器，Ghost Run 執行）及 Solana Agent Kit（SAK，鏈上交易執行）。" },
          { title: "區塊鏈資料", body: "您的公開錢包地址用於查詢 Solana 區塊鏈。區塊鏈資料本質上是公開的。Sakura 僅在以下情況代您寫入區塊鏈：Ghost Run 執行（需您明確確認）及 Liquidation Shield 救援（在您預授權的 SPL Token Approve 支出上限內）。AI 報告的 SHA-256 哈希透過 Solana Memo Program 永久上鏈，永久公開可見。" },
          { title: "法律及監管機關", body: "我們可能根據政府機關、法院或監管機構的合法要求披露您的資訊，或在必要時防止詐騙或遵守法律。" },
          { title: "公司交易", body: "在合併、收購或類似交易中，您的資訊可能轉移給收購方，並受同等隱私保護。" },
          { title: "彙總或匿名統計資料", body: "我們可能出於分析或推廣目的分享彙總的、非個人身份識別資料。" },
        ],
      },
      {
        heading: "5. 區塊鏈資料聲明",
        body: ["Solana 區塊鏈是公開帳本。您的錢包地址及相關所有交易永久可見。Sakura 讀取此公開資料以提供分析，但無法刪除或修改任何鏈上記錄。連接錢包至 Sakura 不授予我們任何簽署權限或對您資金的控制。"],
      },
      {
        heading: "6. 安全性",
        body: [
          "我們實施包括 TLS 加密、角色存取控制及定期安全審查在內的行業標準安全措施。我們絕不要求您的私鑰、助記詞或超出唯讀存取的任何錢包簽署權限。",
          "儘管我們採取合理預防措施，但任何系統都不能完全安全。您有責任維護自己 Phantom 錢包的安全。",
        ],
      },
      {
        heading: "7. 資料保留",
        intro: "我們僅在以下必要期間保留個人資料：",
        items: [
          "提供並改進服務；",
          "遵守適用的法律及監管要求；及",
          "解決爭議並執行我們的權利。",
        ],
        note: "當資料不再需要用於上述目的時，將被安全刪除或不可逆地匿名化。",
      },
      {
        heading: "8. 您的選擇與權利",
        intro: "根據您所在的司法管轄區，您可能有權：",
        items: [
          "存取我們持有的您的個人資訊副本；",
          "更正不準確或不完整的資訊；",
          "刪除您的個人資料（受法律保留義務約束）；",
          "限制或反對某些處理活動；",
          "可攜性——以結構化、機器可讀格式接收您的資料；",
          "隨時撤回對選擇性處理活動的同意。",
        ],
        note: "如需行使上述任何權利，請透過 X 上的 @sakuraaijp 聯絡我們。",
      },
      {
        heading: "9. 政策更新",
        body: ["我們可能不時修訂本政策。重大變更將透過應用程式內通知提前告知。在任何更新生效日期後繼續使用服務，即表示您接受修訂後的政策。"],
      },
      {
        heading: "10. 聯絡方式",
        body: ["如您對本隱私政策有任何疑問、意見或要求，請聯絡我們："],
        contact: true,
      },
    ],
  },
  ja: {
    badge: "プライバシー · SAKURA AI GUARDIAN",
    title: "プライバシーポリシー",
    updated: "最終更新：2026年4月6日",
    sections: [
      {
        heading: "1. 概要",
        body: [
          `本プライバシーポリシー（「ポリシー」）は、Sakura（「Sakura」「当社」）が Sakura Mutual — Solana上のゼロ知識保険決済プロトコル — およびその付属のSolanaネイティブ防衛スイート（Nonce Guardian、Ghost Run、Liquidation Shield）、ウェブアプリケーション、相互プールスマートコントラクト、AI分析機能、関連インターフェース（総称して「サービス」）へのアクセスまたは利用時に、情報をどのように収集・使用・保存・共有するかを説明します。`,
          `Sakuraは非カストディアルです。お客様の資産を預かることはありません。Sakura Mutualの保険請求は、オンチェーンのGroth16 ZK証明検証（alt_bn128_pairingシステムコール）によって自動決済され、人間の裁量で判断されることはありません。Sakuraがお客様に代わって実行するオンチェーン動作——Ghost Run実行、Liquidation Shield救済、請求時の自動返済——はすべて、お客様の都度署名、または事前に承認されたSPL Token Approveの支出上限内でのみ行われます。Phantomウォレットは常にお客様が完全に管理します。`,
          `サービスを利用することで、お客様は本ポリシーを読み理解し、記載された方法での情報収集・利用に同意したものとみなされます。`,
        ],
      },
      {
        heading: "2. 収集する情報",
        subsections: [
          {
            title: "2.1 ウォレット情報",
            items: [
              "公開ウォレットアドレス——Phantomウォレットを接続する際、当社は公開ウォレットアドレスを読み取ります。秘密鍵、シードフレーズ、署名権限へのアクセスは一切要求しません。",
              "オンチェーンポートフォリオデータ——Helius RPCを通じて取得するSolanaブロックチェーン上で公開されているトークン保有量、残高、取引履歴。",
            ],
          },
          {
            title: "2.2 AIインタラクションデータ",
            items: [
              "AI会話ログ——SakuraのAIアドバイザー（Claude AI搭載）に送信したプロンプトとAIが生成した分析回答。",
              "分析リクエスト——お客様が開始したセキュリティスキャンリクエスト、ポートフォリオヘルスチェッククエリ、DeFi戦略に関する質問。",
            ],
          },
          {
            title: "2.3 利用・技術データ",
            items: [
              "デバイス・環境データ——デバイスの種類、OS、ブラウザの種類とバージョン、IPアドレス、タイムゾーン。",
              "アプリ内行動データ——訪問ページ、利用機能、セッション時間、エラーログ。",
            ],
          },
          {
            title: "2.4 サブスクリプションデータ",
            items: [
              "サブスクリプションプラン——現在のプラン（無料またはPro）とクレジット使用状況。",
              "支払い処理——決済はStripeが処理します。Sakuraは生の支払いカードデータを保存しません。",
            ],
          },
          {
            title: "2.5 CookieとトラッキングTechnology",
            body: "当社はセッション管理、セキュリティ監視、分析のためにCookieや類似技術を使用します。ブラウザ設定から不要なCookieを制御できます。",
          },
          {
            title: "2.6 未成年者",
            body: "サービスは18歳以上のユーザーのみを対象としています。当社は18歳未満の個人情報を意図的に収集しません。",
          },
        ],
      },
      {
        heading: "3. 情報の利用方法",
        intro: "収集した情報を以下の目的で利用します：",
        items: [
          "AI分析の提供——ウォレットデータに基づくポートフォリオヘルスレポート、セキュリティスキャン、DeFiアドバイスの生成。",
          "セキュリティ分析——GoPlus Security APIにトークンコントラクトアドレスを送信してリスクスコアリングを実施。",
          "ブロックチェーンデータ取得——Helius RPCを照会してオンチェーンポートフォリオデータを分析。",
          "プラットフォーム改善——匿名化・集計データのみを使用したAIモデルとプラットフォームのパフォーマンス向上。",
          "サブスクリプション管理——プラン、クレジット残高、請求サイクルの管理。",
          "セキュリティとコンプライアンス——不正利用・詐欺の検出と利用規約の執行。",
          "法的義務——適用法令および適法な当局の要請への対応。",
        ],
        note: "当社は、お客様のウォレットデータやAI会話履歴を匿名化または集計せずにAIモデルの学習に使用することはありません。",
      },
      {
        heading: "4. 情報の共有",
        intro: "当社はお客様の個人情報を販売しません。以下の状況で情報を共有する場合があります：",
        subsections: [
          { title: "インフラ・サービスプロバイダー", body: "Helius（Solana RPC）、GoPlus Security（トークンリスク分析）、Claude AI（Anthropic）、Stripe（決済処理）を含む、厳格なデータ処理契約のもとでベンダーとデータを共有します。" },
          { title: "ブロックチェーンデータ", body: "公開ウォレットアドレスはSolanaブロックチェーンの照会に使用されます。ブロックチェーンデータは本質的に公開されており、当社はお客様に代わってブロックチェーンへの書き込みは行いません。" },
          { title: "法的・規制当局", body: "政府機関、裁判所、規制当局からの適法な要請に応じて、または詐欺防止や法令遵守のために必要と判断した場合に情報を開示することがあります。" },
          { title: "企業取引", body: "合併、買収、または類似の取引に関連して、同等のプライバシー保護を条件として、情報が買収事業体に移転される場合があります。" },
          { title: "集計または匿名化統計", body: "分析または宣伝目的で、集計された個人を特定できないデータを共有する場合があります。" },
        ],
      },
      {
        heading: "5. ブロックチェーンデータに関する注意",
        body: ["Solanaブロックチェーンは公開台帳です。ウォレットアドレスとそれに関連するすべての取引は永続的に公開されています。Sakuraはこの公開データを分析のために読み取りますが、オンチェーンの記録を削除または変更することはできません。ウォレットをSakuraに接続しても、当社に署名権限やお客様の資金に対する制御権は付与されません。"],
      },
      {
        heading: "6. セキュリティ",
        body: [
          "当社は転送中のデータへのTLS暗号化、ロールベースのアクセス制御、定期的なセキュリティレビューなど、業界標準のセキュリティ対策を実施しています。秘密鍵、シードフレーズ、または読み取り専用アクセスを超えたウォレット署名権限を一切要求しません。",
          "合理的な予防措置を講じていますが、いかなるシステムも完全に安全ではありません。お客様自身のPhantomウォレットのセキュリティを維持する責任はお客様にあります。",
        ],
      },
      {
        heading: "7. データ保持",
        intro: "個人データは以下の目的に必要な期間のみ保持します：",
        items: [
          "サービスの提供と改善；",
          "適用される法的・規制上の要件への準拠；および",
          "紛争の解決と権利の執行。",
        ],
        note: "これらの目的にデータが不要になった場合、安全に削除または不可逆的に匿名化されます。",
      },
      {
        heading: "8. お客様の選択と権利",
        intro: "お客様の居住地によっては、以下の権利が認められる場合があります：",
        items: [
          "当社が保有するお客様の個人情報のコピーへのアクセス；",
          "不正確または不完全な情報の訂正；",
          "個人データの削除（法的保持義務の対象となる場合を除く）；",
          "特定の処理活動の制限または異議申し立て；",
          "ポータビリティ——構造化された機械可読形式でのデータ受け取り；",
          "任意の処理活動に対する同意の随時撤回。",
        ],
        note: "これらの権利を行使するには、XのアカウントでX上の @sakuraaijp にご連絡ください。",
      },
      {
        heading: "9. ポリシーの更新",
        body: ["本ポリシーは随時改訂される場合があります。重要な変更はアプリ内通知で事前にお知らせします。更新の発効日以降もサービスを継続して利用することで、改訂されたポリシーへの同意とみなされます。"],
      },
      {
        heading: "10. お問い合わせ",
        body: ["本プライバシーポリシーに関するご質問、ご意見、またはご要望は以下までご連絡ください："],
        contact: true,
      },
    ],
  },
};

export default function PrivacyPage() {
  const { lang } = useLang();
  const c = CONTENT[lang] ?? CONTENT.en;

  const sectionStyle: React.CSSProperties = { marginBottom: 40 };
  const h2Style: React.CSSProperties = {
    fontSize: 20, fontWeight: 700, fontFamily: "var(--font-heading)",
    color: "var(--text-primary)", marginBottom: 12,
    paddingBottom: 8, borderBottom: "1px solid var(--border)",
  };
  const h3Style: React.CSSProperties = {
    fontSize: 15, fontWeight: 700, color: "var(--text-primary)",
    marginBottom: 8, marginTop: 20,
  };
  const pStyle: React.CSSProperties = {
    fontSize: 14, lineHeight: 1.85, color: "var(--text-secondary)", marginBottom: 12,
  };
  const ulStyle: React.CSSProperties = { paddingLeft: 20, marginBottom: 12 };
  const liStyle: React.CSSProperties = {
    fontSize: 14, lineHeight: 1.85, color: "var(--text-secondary)", marginBottom: 4,
  };

  return (
    <div style={{ background: "var(--bg-base)", minHeight: "100vh", color: "var(--text-primary)" }}>
      <main style={{ maxWidth: 800, margin: "0 auto", padding: "56px 32px 80px" }}>
        {/* Header */}
        <div style={{ marginBottom: 48 }}>
          <div style={{
            display: "inline-block", fontSize: 11, letterSpacing: "0.12em",
            textTransform: "uppercase", color: "var(--accent)",
            border: "1px solid var(--accent-mid)", borderRadius: 4,
            padding: "3px 10px", marginBottom: 16, fontFamily: "var(--font-mono)",
          }}>
            {c.badge}
          </div>
          <h1 style={{
            fontSize: 36, fontWeight: 700, fontFamily: "var(--font-heading)",
            color: "var(--text-primary)", letterSpacing: "0.04em", marginBottom: 12,
          }}>
            {c.title}
          </h1>
          <p style={{ fontSize: 13, color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>
            {c.updated}
          </p>
        </div>

        {/* Sakura platform intro */}
        <div style={{
          background: "var(--bg-card)", border: "1px solid var(--border)",
          borderLeft: "3px solid var(--accent)", borderRadius: 8,
          padding: "16px 20px", marginBottom: 32,
          fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.85,
        }}>
          <strong style={{ color: "var(--text-primary)", fontFamily: "var(--font-heading)", letterSpacing: "0.04em" }}>
            {lang === "zh" ? "Sakura 零託管原則" : lang === "ja" ? "Sakura ゼロカストディ原則" : "Sakura Zero-Custody Principle"}
          </strong>
          {" — "}
          {lang === "zh"
            ? "大多數 AI DeFi 工具在隱私上提供的只是一份政策文件——你只能選擇相信。Sakura 的隱私保護建立在三個可以被獨立驗證的架構原則之上，而不是一份需要相信的承諾：① 唯讀優先——Nonce Guardian 以完全唯讀模式運行；Ghost Run 模擬永遠不請求簽名；即使 Liquidation Shield 需要 SPL Token Approve，也是由您在自己的錢包內完成授權——Sakura 的服務器在任何時候都無法訪問您的私鑰或助記詞；② 最小數據收集——我們只收集提供服務所必需的鏈上公開數據，AI 交互記錄僅用於服務交付，絕不出售，不共享給廣告商；③ AI 決策鏈上透明——每一條 AI 推理路徑的 SHA-256 哈希永久刻入 Solana 主網，您和任何第三方均可在 Solscan 以 tx signature 獨立核驗，無需信任 Sakura 的任何服務器。這不是「我們承諾保護您的隱私」——這是「我們無法違反您的隱私」的架構設計。備えあれば憂いなし。"
            : lang === "ja"
            ? "ほとんどのAI DeFiツールがプライバシーについて提供するのはポリシー文書だけ——あなたは信じるかどうかを選ぶしかありません。Sakuraのプライバシー保護は独立して検証できる3つのアーキテクチャ原則に基づいており、信じなければならない約束ではありません：①読み取り専用優先——Nonce Guardianは完全な読み取り専用モードで動作；Ghost Runシミュレーションは決して署名を要求しない；Liquidation ShieldがSPL Token Approveを必要とする場合でも、あなた自身のウォレット内で承認が完了——Sakuraのサーバーは秘密鍵やシードフレーズに一切アクセスできない；②最小データ収集——サービス提供に必要なオンチェーン公開データのみを収集し、AI対話記録はサービス提供のみに使用、広告主への販売・共有は一切しない；③AI判断のオンチェーン透明性——すべてのAI推論経路のSHA-256ハッシュがSolanaメインネットに永久刻印され、tx signatureでSolscanで独立検証可能、Sakuraのサーバーへの信頼不要。これは「プライバシーを守ることを約束します」ではなく、「Sakuraがプライバシーを侵害できない」設計です。備えあれば憂いなし。"
            : "Most AI DeFi tools offer only a policy document on privacy — you have no choice but to trust it. Sakura's privacy protection rests on three architectural principles that can be independently verified, not a promise you must believe: ① Read-only first — Nonce Guardian operates in fully read-only mode; Ghost Run simulations never request a signature; even where Liquidation Shield requires SPL Token Approve, the authorization is completed inside your own wallet — Sakura's servers cannot access your private keys or seed phrase at any time; ② Minimum data collection — we collect only on-chain public data necessary to deliver the service; AI interaction records are used solely for service delivery and never sold or shared with advertisers; ③ On-chain AI transparency — the SHA-256 hash of every AI reasoning path is permanently inscribed on Solana mainnet, independently verifiable by you or any third party via tx signature on Solscan, with zero reliance on Sakura's servers. This is not 'we promise to protect your privacy' — it is 'we are architecturally incapable of violating your privacy.' 備えあれば憂いなし."}
        </div>

        {c.sections.map((sec, i) => (
          <div key={i} style={sectionStyle}>
            <h2 style={h2Style}>{sec.heading}</h2>

            {/* Top-level body paragraphs */}
            {"body" in sec && Array.isArray(sec.body) && sec.body.map((p, j) => (
              <p key={j} style={pStyle}>{p}</p>
            ))}

            {/* Intro text */}
            {"intro" in sec && sec.intro && <p style={pStyle}>{sec.intro}</p>}

            {/* Top-level bullet list */}
            {"items" in sec && sec.items && (
              <ul style={ulStyle}>
                {sec.items.map((item, j) => <li key={j} style={liStyle}>{item}</li>)}
              </ul>
            )}

            {/* Note */}
            {"note" in sec && sec.note && <p style={{ ...pStyle, fontStyle: "italic", opacity: 0.85 }}>{sec.note}</p>}

            {/* Subsections */}
            {"subsections" in sec && sec.subsections && sec.subsections.map((sub, j) => (
              <div key={j}>
                <h3 style={h3Style}>{sub.title}</h3>
                {"body" in sub && sub.body && <p style={pStyle}>{sub.body}</p>}
                {"items" in sub && sub.items && (
                  <ul style={ulStyle}>
                    {sub.items.map((item, k) => <li key={k} style={liStyle}>{item}</li>)}
                  </ul>
                )}
              </div>
            ))}

            {/* Contact block */}
            {"contact" in sec && sec.contact && (
              <div style={{
                background: "var(--bg-card)", border: "1px solid var(--border)",
                borderRadius: 10, padding: "20px 24px", display: "inline-block", marginTop: 8,
              }}>
                <p style={{ margin: 0, fontSize: 14, color: "var(--text-primary)", fontFamily: "var(--font-mono)" }}>
                  𝕏 <a href="https://x.com/sakuraaijp" target="_blank" rel="noopener noreferrer"
                    style={{ color: "var(--accent)", textDecoration: "none" }}>@sakuraaijp</a>
                </p>
              </div>
            )}
          </div>
        ))}
      </main>
      <Footer />
    </div>
  );
}
