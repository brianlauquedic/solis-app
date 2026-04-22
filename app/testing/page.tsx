"use client";

import Link from "next/link";
import { useState } from "react";
import Footer from "@/components/Footer";
import { useLang } from "@/contexts/LanguageContext";

type Lang = "zh" | "en" | "ja";

type Step = {
  step: string;
  title: string;
  body: string;
  screenshot?: string; // path under /public, else undefined = TODO
};

const CONTENT: Record<Lang, {
  back: string;
  badge: string;
  title: string;
  subtitle: string;
  introKanji: string;
  introTitle: string;
  introBody: string;
  phantomOnlyNote: string;

  steps: Step[];

  faucetTitle: string;
  faucetBody: string;
  faucetInputPlaceholder: string;
  faucetButton: string;
  faucetButtonLoading: string;
  faucetSuccessTitle: string;
  faucetSuccessNote: string;
  faucetErrorPrefix: string;

  successTitle: string;
  successList: string[];

  gotchaTitle: string;
  gotchaUsdcTitle: string;
  gotchaUsdcBody: string;
  gotchaOthers: Array<{ q: string; a: string }>;

  nextTitle: string;
  nextBody: string;
  nextGuideLink: string;

  contact: string;
  contactHandle: string;
}> = {
  // ═══════════════════════════════════════════════════════════════════
  //  繁體中文
  // ═══════════════════════════════════════════════════════════════════
  zh: {
    back: "← 返回首頁",
    badge: "🌸 DEVNET 測試教程 · PHANTOM",
    title: "在 Devnet 上測試 Sakura",
    subtitle: "教你用自己的 Phantom 錢包，在 Solana devnet 上真實簽一份意圖。從空錢包到上鏈成功，按順序走完。",
    introKanji: "試",
    introTitle: "這份教程只針對 Phantom 桌面插件。",
    introBody: "其他錢包（OKX、Backpack、Solflare 等）在 Solana 上沒有 devnet 切換按鈕，用它們來測試會卡在網絡選擇這一步。如果你想測試而不是用自己的錢包，見文末「替代路徑」。",
    phantomOnlyNote: "⚠️ 不支援手機版 Phantom · 本教程只針對桌面瀏覽器插件。",

    steps: [
      {
        step: "壱",
        title: "安裝 Phantom 桌面插件",
        body: "在 Chrome / Brave / Arc 瀏覽器打開 https://phantom.com/ → 點 Download → 安裝插件。裝完右上角會有 Phantom 圖標。點它 → Create a new wallet → 記下 12 個種子詞（寫紙上，不要拍照上傳雲端）→ 設密碼。",
        screenshot: undefined, // TODO: 你截 Phantom 的 Create wallet 界面
      },
      {
        step: "弐",
        title: "切換到 Devnet",
        body: "Phantom 右上角頭像 → Settings → Developer Settings → 打開 Testnet Mode。然後回主界面，頂部的「Solana」下拉 → 選 Devnet。切對了之後，你的錢包餘額會顯示「0 SOL · Solana Devnet」。",
        screenshot: undefined, // TODO: Developer Settings 和 Network 下拉的截圖
      },
      {
        step: "参",
        title: "領測試幣（用 Sakura faucet，下面一鍵）",
        body: "在 Phantom 主界面點你的錢包名旁邊的 Copy Address → 貼到下面的輸入框 → 點「領測試幣」。你會收到 0.05 SOL（付 gas）和 100 USDC（付 Sakura 協議費）。每個地址每 24 小時只能領一次。",
        screenshot: undefined,
      },
      {
        step: "肆",
        title: "打開 Sakura → 連錢包",
        body: "訪問 https://www.sakuraaai.com → 點右上 Connect Wallet → 選 Phantom → Phantom 彈窗點 Connect。連接本身不花錢。",
        screenshot: undefined, // TODO: Connect 按鈕 + Phantom 連接彈窗
      },
      {
        step: "伍",
        title: "簽第一份意圖",
        body: "在「簽一次意圖」區塊填：意圖文字寫「代理可以在 Kamino 或 MarginFi 存入 USDC，每週結算」；單次上限 10；總 USD 上限 10（這樣簽名費只扣 $0.01）；勾 Kamino + MarginFi；勾 Lend；期限 24 小時。點「簽署意圖」→ Phantom 彈窗確認 → 等 3-5 秒。",
        screenshot: undefined, // TODO: 填好的表單 + Phantom 確認彈窗
      },
      {
        step: "陸",
        title: "確認成功",
        body: "界面會出現綠色「意圖已上鏈簽署」+ tx 鏈接。點那個鏈接跳到 Solscan，Result 欄位應該顯示 SUCCESS + Finalized (MAX Confirmations)。這就是全流程成功的硬證據。",
        screenshot: undefined, // TODO: 成功狀態的 Sakura UI + Solscan 頁面
      },
    ],

    faucetTitle: "一鍵領測試幣",
    faucetBody: "把 Phantom 的 Solana devnet 地址貼下面，我們給你打 0.05 SOL + 100 USDC。全部是 devnet 測試幣，不是真錢。",
    faucetInputPlaceholder: "貼你的 Phantom devnet 地址（如 89duEF…）",
    faucetButton: "領測試幣",
    faucetButtonLoading: "處理中…（約 10 秒）",
    faucetSuccessTitle: "✓ 已發送",
    faucetSuccessNote: "SOL 和 USDC 都已經在鏈上。注意 Phantom 可能「看不到」USDC 餘額（原因見下方第 7 節）。請在 Solscan 的 ATA 地址驗證。",
    faucetErrorPrefix: "出錯：",

    successTitle: "你成功的 3 個標誌",
    successList: [
      "Sakura UI 出現綠色「意圖已上鏈簽署」+ 一個 tx 鏈接",
      "Phantom 的交易歷史裡出現一筆 Program Interaction（扣了 ~$0.01 USDC + ~0.002 SOL）",
      "tx 鏈接跳 Solscan：Result = SUCCESS · Finalized (MAX Confirmations)",
    ],

    gotchaTitle: "注意事項 & 常見問題",
    gotchaUsdcTitle: "Phantom 看不到你剛領的 100 USDC 餘額",
    gotchaUsdcBody: "這是 Phantom 的顯示設計，不是錢沒到。Sakura devnet 用的是 admin 自己鑄的 test USDC（mint 地址 7rEh…Li3），不是 Circle 的 canonical devnet USDC。Phantom UI 只會自動顯示它認識的 token。真實餘額 100% 在鏈上，可以在 Solscan 上查你的 USDC ATA：先領了測試幣之後，faucet 回應裡會給你 ATA 地址，直接貼到 https://solscan.io/account/<ATA>?cluster=devnet 看 Amount 字段。簽意圖時，Sakura 會自動找到這個 ATA 扣費，無需依賴 Phantom 的顯示。",
    gotchaOthers: [
      {
        q: "點 Connect Wallet 沒彈窗",
        a: "Phantom 插件可能被禁用或沒裝。右上角找 Phantom 圖標確認。裝了但沒彈 → 硬刷新網頁 Cmd+Shift+R。",
      },
      {
        q: "簽意圖時 Phantom 彈窗顯示「Failed to decode」",
        a: "通常是 Phantom 還沒切到 Devnet。檢查頂部網絡是否顯示「Solana Devnet」。切對了再試一次。",
      },
      {
        q: "簽完 30 秒 UI 還沒變綠",
        a: "硬刷新。如果還是沒變 → 點頂部 tx 鏈接看 Solscan。如果 Solscan 顯示 SUCCESS 但 Sakura UI 沒反映，是前端狀態沒同步，再刷一次。",
      },
      {
        q: "faucet 報 429 rate limit",
        a: "每個地址每 24 小時只能領一次，每個 IP 5 次。換個地址、或等 24 小時、或聯繫團隊手動打。",
      },
      {
        q: "簽名費應該是 $0.01，但 Phantom 彈窗顯示不同",
        a: "簽名費 = 0.1% × 總 USD 上限。你填 10 就是 $0.01，填 1000 就是 $1。Phantom 彈窗顯示的是你要扣的 USDC 和可能的 rent（~0.002 SOL）。",
      },
    ],

    nextTitle: "下一步",
    nextBody: "你剛剛完成的是技術驗證：簽一次意圖，確認鏈上記錄。真正「簽一份好意圖」的策略層面（該勾多少協議？期限設多長？5 個最常踩的坑？）— 見完整散戶指南：",
    nextGuideLink: "→ 使用手冊 · 如何簽一份好的意圖",

    contact: "卡在某一步？",
    contactHandle: "𝕏 @sakuraaijp",
  },

  // ═══════════════════════════════════════════════════════════════════
  //  English
  // ═══════════════════════════════════════════════════════════════════
  en: {
    back: "← Back to Home",
    badge: "🌸 DEVNET WALKTHROUGH · PHANTOM",
    title: "Test Sakura on Devnet",
    subtitle: "Use your own Phantom wallet to sign a real intent on Solana devnet. From empty wallet to on-chain success, step by step.",
    introKanji: "Try",
    introTitle: "This tutorial assumes Phantom browser extension only.",
    introBody: "Other wallets (OKX, Backpack, Solflare) lack a Solana devnet switch, so they cannot complete this flow. If you want to test without installing Phantom, see \"Alternate path\" at the bottom.",
    phantomOnlyNote: "⚠️ Mobile Phantom not supported. This tutorial is desktop-extension only.",

    steps: [
      {
        step: "I",
        title: "Install Phantom desktop extension",
        body: "In Chrome / Brave / Arc, open https://phantom.com/ → Download → install. Phantom icon appears in the top-right. Click it → Create a new wallet → record the 12 seed words (write on paper, do not photograph or upload) → set a password.",
        screenshot: undefined,
      },
      {
        step: "II",
        title: "Switch to Devnet",
        body: "Phantom top-right avatar → Settings → Developer Settings → toggle Testnet Mode ON. Back to main view, network dropdown → Devnet. When switched correctly, balance shows \"0 SOL · Solana Devnet\".",
        screenshot: undefined,
      },
      {
        step: "III",
        title: "Claim test tokens (Sakura faucet, one click)",
        body: "In Phantom main view, click the wallet name → Copy Address → paste below → click \"Claim test tokens\". You'll receive 0.05 SOL (gas) and 100 USDC (Sakura protocol fees). One claim per address per 24 hours.",
        screenshot: undefined,
      },
      {
        step: "IV",
        title: "Open Sakura → Connect wallet",
        body: "Go to https://www.sakuraaai.com → top-right Connect Wallet → Phantom → Phantom popup → Connect. Connection itself costs nothing.",
        screenshot: undefined,
      },
      {
        step: "V",
        title: "Sign your first intent",
        body: "In the \"Sign Intent\" block: intent text = \"agent may deposit USDC into Kamino or MarginFi, weekly settlement\"; single-action cap = 10; total USD cap = 10 (keeps sign fee at $0.01); check Kamino + MarginFi; check Lend; expiry 24 hours. Click \"Sign Intent\" → Phantom popup → approve → wait 3-5 seconds.",
        screenshot: undefined,
      },
      {
        step: "VI",
        title: "Verify success",
        body: "UI shows a green \"Intent signed on-chain\" + a tx link. Click the link to Solscan. The Result field should show SUCCESS + Finalized (MAX Confirmations). That is your hard proof of end-to-end success.",
        screenshot: undefined,
      },
    ],

    faucetTitle: "One-click faucet",
    faucetBody: "Paste your Phantom devnet Solana address below, and we'll send 0.05 SOL + 100 USDC. All devnet test tokens — not real money.",
    faucetInputPlaceholder: "Paste Phantom devnet address (e.g. 89duEF…)",
    faucetButton: "Claim test tokens",
    faucetButtonLoading: "Processing… (~10 seconds)",
    faucetSuccessTitle: "✓ Sent",
    faucetSuccessNote: "Both SOL and USDC are on-chain. Note that Phantom likely won't DISPLAY the USDC balance (see item 7 below for why). Verify via the Solscan ATA link.",
    faucetErrorPrefix: "Error: ",

    successTitle: "3 signs of success",
    successList: [
      "Sakura UI shows green \"Intent signed on-chain\" with a tx link",
      "Phantom tx history gains one Program Interaction (debited ~$0.01 USDC + ~0.002 SOL)",
      "Clicking the tx link in Solscan shows Result = SUCCESS · Finalized (MAX Confirmations)",
    ],

    gotchaTitle: "Gotchas & FAQ",
    gotchaUsdcTitle: "Phantom won't show your new 100 USDC balance",
    gotchaUsdcBody: "This is a Phantom UI quirk, not missing funds. Sakura's devnet deployment uses an admin-minted test USDC (mint 7rEh…Li3), not Circle's canonical devnet USDC. Phantom auto-displays only tokens it recognizes. The real balance lives on-chain. Verify via your ATA on Solscan (the faucet response gives you the ATA address): https://solscan.io/account/<ATA>?cluster=devnet — check the Amount field. When you sign an intent, Sakura will find and debit this ATA automatically; Phantom's display is not on the critical path.",
    gotchaOthers: [
      {
        q: "Connect Wallet does nothing",
        a: "Phantom extension may be disabled or missing. Check top-right for the Phantom icon. If installed but no popup, hard-refresh (Cmd+Shift+R).",
      },
      {
        q: "Phantom popup says \"Failed to decode\" when signing",
        a: "Usually Phantom is still on Mainnet. Check the network dropdown reads \"Solana Devnet\". Switch, then retry.",
      },
      {
        q: "30s after signing, UI still hasn't turned green",
        a: "Hard-refresh. If still nothing, click the tx link and check Solscan. If Solscan shows SUCCESS but Sakura UI doesn't reflect it, front-end state is stale — refresh once more.",
      },
      {
        q: "Faucet returns 429 rate limit",
        a: "One claim per address per 24h, five per IP per 24h. Use a different address, wait 24h, or DM the team for a manual top-up.",
      },
      {
        q: "Sign fee should be $0.01 but Phantom popup shows something different",
        a: "Sign fee = 0.1% × total USD cap. Cap of 10 → $0.01. Cap of 1000 → $1. Phantom popup shows USDC debit + possible rent (~0.002 SOL).",
      },
    ],

    nextTitle: "Next",
    nextBody: "You just verified the technical flow: sign once, confirm on-chain. For the strategy of \"signing a GOOD intent\" (how many protocols to tick, how long to set the expiry, the 5 most common mistakes) — see the full retail user guide:",
    nextGuideLink: "→ User Guide · How to sign a good intent",

    contact: "Stuck on a step?",
    contactHandle: "𝕏 @sakuraaijp",
  },

  // ═══════════════════════════════════════════════════════════════════
  //  日本語
  // ═══════════════════════════════════════════════════════════════════
  ja: {
    back: "← ホームへ戻る",
    badge: "🌸 DEVNET 使い方チュートリアル · PHANTOM",
    title: "Devnet で Sakura を試す",
    subtitle: "自分の Phantom ウォレットを用いて、Solana devnet 上で実際に意図に署名する方法。空ウォレットからオンチェーン確認まで、順を追って。",
    introKanji: "試",
    introTitle: "本チュートリアルは Phantom ブラウザ拡張のみ対象。",
    introBody: "他のウォレット（OKX、Backpack、Solflare など）は Solana の devnet 切替機能を持たぬため、この流れを完走できぬ。Phantom をインストールせずに試したい場合は、末尾の「代替経路」を参照。",
    phantomOnlyNote: "⚠️ モバイル Phantom は非対応。本チュートリアルはデスクトップ拡張限定。",

    steps: [
      {
        step: "壱",
        title: "Phantom デスクトップ拡張をインストール",
        body: "Chrome / Brave / Arc で https://phantom.com/ を開く → Download → インストール。右上に Phantom のアイコンが現れる。クリック → Create a new wallet → 12 単語のシードフレーズを紙に記録（撮影・クラウドアップロードは厳禁）→ パスワードを設定。",
        screenshot: undefined,
      },
      {
        step: "弐",
        title: "Devnet に切り替える",
        body: "Phantom 右上のアバター → Settings → Developer Settings → Testnet Mode を ON。メイン画面に戻り、ネットワーク ドロップダウン → Devnet を選択。正しく切替えれば、残高が「0 SOL · Solana Devnet」と表示される。",
        screenshot: undefined,
      },
      {
        step: "参",
        title: "テストコインを受け取る（Sakura faucet、ワンクリック）",
        body: "Phantom メイン画面でウォレット名 → Copy Address → 下の入力欄に貼り付け → 「テストコインを受け取る」をクリック。0.05 SOL（ガス）と 100 USDC（Sakura プロトコル手数料）を受け取る。1 アドレスにつき 24 時間に 1 回まで。",
        screenshot: undefined,
      },
      {
        step: "肆",
        title: "Sakura を開いてウォレット接続",
        body: "https://www.sakuraaai.com にアクセス → 右上 Connect Wallet → Phantom → Phantom のポップアップ → Connect。接続自体は手数料ゼロ。",
        screenshot: undefined,
      },
      {
        step: "伍",
        title: "最初の意図に署名",
        body: "「意図署名」ブロックに入力：意図文「エージェントは Kamino または MarginFi に USDC を預けられる、週次精算」；1 回の上限 = 10；累計 USD 上限 = 10（署名手数料を $0.01 に抑える）；Kamino と MarginFi にチェック；Lend にチェック；期限 24 時間。「意図署名」をクリック → Phantom のポップアップ → 承認 → 3-5 秒待つ。",
        screenshot: undefined,
      },
      {
        step: "陸",
        title: "成功を確認",
        body: "UI に緑の「意図はオンチェーンに署名済」と tx リンクが現れる。リンクをクリックして Solscan へ。Result 欄が SUCCESS + Finalized (MAX Confirmations) と表示されれば、エンドツーエンド成功の確かな証拠。",
        screenshot: undefined,
      },
    ],

    faucetTitle: "ワンクリック faucet",
    faucetBody: "Phantom の devnet Solana アドレスを下に貼れば、0.05 SOL + 100 USDC を送る。すべて devnet テストコインで、実資産ではない。",
    faucetInputPlaceholder: "Phantom devnet アドレスを貼る（例 89duEF…）",
    faucetButton: "テストコインを受け取る",
    faucetButtonLoading: "処理中…（約 10 秒）",
    faucetSuccessTitle: "✓ 送信完了",
    faucetSuccessNote: "SOL と USDC の両方がオンチェーン済。ただし Phantom は USDC 残高を表示しない可能性が高い（理由は下の第 7 項目を参照）。Solscan の ATA リンクで検証を。",
    faucetErrorPrefix: "エラー：",

    successTitle: "成功の 3 つの徴候",
    successList: [
      "Sakura UI に緑の「意図はオンチェーンに署名済」と tx リンクが現れる",
      "Phantom の取引履歴に Program Interaction が 1 件追加される（約 $0.01 USDC + 約 0.002 SOL を引き落とし）",
      "tx リンクを Solscan で開けば、Result = SUCCESS · Finalized (MAX Confirmations)",
    ],

    gotchaTitle: "注意点 & よくある質問",
    gotchaUsdcTitle: "Phantom は受け取った 100 USDC を表示しない",
    gotchaUsdcBody: "Phantom UI の仕様であり、資金が届いていないわけではない。Sakura の devnet は admin が発行したテスト USDC（mint アドレス 7rEh…Li3）を使っており、Circle の canonical devnet USDC ではない。Phantom は認識している token しか自動表示せぬ。実際の残高は 100% オンチェーン上に存在する。Solscan で ATA を確認すれば Amount フィールドに見える：https://solscan.io/account/<ATA>?cluster=devnet。署名時には Sakura が自動でこの ATA から引き落とすので、Phantom の表示に依存しない。",
    gotchaOthers: [
      {
        q: "Connect Wallet を押しても何も起こらぬ",
        a: "Phantom 拡張が無効か未インストールの可能性。右上で Phantom アイコンを確認。インストール済なのにポップアップが出ぬ場合は、ページを強制再読込（Cmd+Shift+R）。",
      },
      {
        q: "署名時に Phantom が「Failed to decode」を出す",
        a: "通常、Phantom が Mainnet のまま。ネットワークドロップダウンが「Solana Devnet」になっていることを確認。切替えてから再試行。",
      },
      {
        q: "署名後 30 秒経っても UI が緑にならぬ",
        a: "強制再読込。それでも変化なければ、tx リンクをクリックして Solscan を確認。Solscan が SUCCESS でも Sakura UI が反映せぬ場合は、フロントエンドの状態キャッシュ。もう一度再読込。",
      },
      {
        q: "faucet が 429 rate limit を返す",
        a: "1 アドレスにつき 24 時間に 1 回、1 IP につき 5 回まで。別アドレスを使うか、24 時間待つか、チームに DM して手動で送金を依頼する。",
      },
      {
        q: "署名手数料は $0.01 のはずだが Phantom ポップアップが別の値を出す",
        a: "署名手数料 = 0.1% × 累計 USD 上限。上限 10 なら $0.01、上限 1000 なら $1。ポップアップは USDC 引落 + PDA レント（約 0.002 SOL）を表示する。",
      },
    ],

    nextTitle: "次のステップ",
    nextBody: "たった今終えたのは技術的な動作確認：意図を 1 度署名し、オンチェーンを確認。「良い意図を署名する」戦略面（プロトコルを幾つ選ぶか、期限はどれ位か、よく犯される 5 つの誤り）については、個人投資家向け完全ガイドを：",
    nextGuideLink: "→ 使用手冊 · 良い意図の署名方法",

    contact: "途中で詰まったら：",
    contactHandle: "𝕏 @sakuraaijp",
  },
};

export default function TestingPage() {
  const { lang } = useLang();
  const c = CONTENT[lang as Lang] ?? CONTENT.zh;

  const [addr, setAddr] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    sol_tx: string;
    usdc_tx: string;
    usdc_ata: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onClaim() {
    if (loading) return;
    setError(null);
    setResult(null);
    const trimmed = addr.trim();
    if (!trimmed) return;
    setLoading(true);
    try {
      const r = await fetch("/api/faucet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: trimmed }),
      });
      const j = await r.json();
      if (!r.ok) {
        setError(j.error || `HTTP ${r.status}`);
      } else {
        setResult(j);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ minHeight: "100vh", background: "var(--bg-base)", color: "var(--text-primary)" }}>
      <div style={{ maxWidth: 860, margin: "0 auto", padding: "60px 24px 40px" }}>

        {/* ── Header ────────────────────────────────────────────── */}
        <div style={{ marginBottom: 48 }}>
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
          <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.9, maxWidth: 640 }}>
            {c.subtitle}
          </p>
        </div>

        {/* ── Intro seal block ──────────────────────────────────── */}
        <div style={{
          background: "var(--bg-card)", border: "1px solid var(--border)",
          borderLeft: "3px solid var(--accent)", borderRadius: 10,
          padding: "20px 24px", marginBottom: 40,
          display: "flex", gap: 16, alignItems: "flex-start",
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 8, flexShrink: 0,
            background: "var(--accent-soft)", border: "1px solid var(--accent-mid)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 16, fontFamily: "var(--font-heading)", color: "var(--accent)",
          }}>{c.introKanji}</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 400, color: "var(--text-primary)", marginBottom: 8, fontFamily: "var(--font-heading)", letterSpacing: "0.04em" }}>
              {c.introTitle}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.9, marginBottom: 10 }}>
              {c.introBody}
            </div>
            <div style={{ fontSize: 11, color: "var(--gold)", letterSpacing: "0.04em" }}>
              {c.phantomOnlyNote}
            </div>
          </div>
        </div>

        {/* ── Steps 1-6 ────────────────────────────────────────── */}
        <section style={{ marginBottom: 48 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {c.steps.map((s, i) => (
              <div key={s.step} style={{
                background: "var(--bg-card)", border: "1px solid var(--border)",
                borderLeft: `3px solid var(--accent)`,
                borderRadius: 10, padding: "18px 22px",
              }}>
                <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: "50%", flexShrink: 0,
                    background: "var(--accent-soft)", border: "1px solid var(--accent-mid)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 13, fontWeight: 700, color: "var(--accent)",
                    fontFamily: "var(--font-mono)",
                  }}>{s.step}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 500, color: "var(--text-primary)", marginBottom: 8, letterSpacing: "0.03em" }}>
                      {s.title}
                    </div>
                    <div style={{ fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.9 }}>
                      {s.body}
                    </div>
                    {s.screenshot ? (
                      <div style={{ marginTop: 14 }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={s.screenshot}
                          alt={`Step ${s.step} screenshot`}
                          style={{ maxWidth: "100%", borderRadius: 6, border: "1px solid var(--border)" }}
                        />
                      </div>
                    ) : (
                      <div style={{
                        marginTop: 12,
                        padding: "10px 14px",
                        border: "1px dashed var(--border-light)",
                        borderRadius: 6,
                        fontSize: 11,
                        color: "var(--text-muted)",
                        fontFamily: "var(--font-mono)",
                        letterSpacing: "0.04em",
                      }}>
                        [screenshot placeholder — user to supply]
                      </div>
                    )}
                  </div>
                </div>

                {/* Faucet UI inline at step 参/III/参 */}
                {i === 2 && (
                  <FaucetWidget
                    c={c}
                    addr={addr}
                    setAddr={setAddr}
                    loading={loading}
                    result={result}
                    error={error}
                    onClaim={onClaim}
                  />
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ── Success signals ─────────────────────────────────── */}
        <section style={{ marginBottom: 48 }}>
          <h2 style={{ fontSize: 20, fontWeight: 300, fontFamily: "var(--font-heading)", letterSpacing: "0.05em", marginBottom: 12 }}>
            {c.successTitle}
          </h2>
          <ul style={{ paddingLeft: 20, listStyle: "none", margin: 0 }}>
            {c.successList.map((s, i) => (
              <li key={i} style={{
                fontSize: 13, color: "var(--text-secondary)", lineHeight: 1.85,
                marginBottom: 8, paddingLeft: 18, position: "relative",
              }}>
                <span style={{
                  position: "absolute", left: 0, top: 1,
                  color: "var(--green)", fontWeight: 600,
                }}>✓</span>
                {s}
              </li>
            ))}
          </ul>
        </section>

        {/* ── Gotchas ──────────────────────────────────────────── */}
        <section style={{ marginBottom: 48 }}>
          <h2 style={{ fontSize: 20, fontWeight: 300, fontFamily: "var(--font-heading)", letterSpacing: "0.05em", marginBottom: 12 }}>
            {c.gotchaTitle}
          </h2>

          {/* The big USDC display note */}
          <div style={{
            background: "var(--bg-card)", border: "1px solid var(--gold)",
            borderLeft: "3px solid var(--gold)",
            borderRadius: 10, padding: "16px 20px", marginBottom: 16,
          }}>
            <div style={{
              fontSize: 10, color: "var(--gold)", letterSpacing: "0.14em",
              fontFamily: "var(--font-mono)", marginBottom: 8, textTransform: "uppercase",
            }}>
              ⚠ IMPORTANT
            </div>
            <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>
              {c.gotchaUsdcTitle}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.85 }}>
              {c.gotchaUsdcBody}
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {c.gotchaOthers.map((f, i) => (
              <div key={i} style={{
                background: "var(--bg-card)", border: "1px solid var(--border)",
                borderRadius: 8, padding: "12px 16px",
              }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>
                  Q · {f.q}
                </div>
                <div style={{ fontSize: 11.5, color: "var(--text-secondary)", lineHeight: 1.75 }}>
                  {f.a}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Next step: link to /guide ────────────────────────── */}
        <section style={{
          background: "var(--bg-card)", border: "1px solid var(--accent-mid)",
          borderRadius: 10, padding: "20px 24px", marginBottom: 32,
        }}>
          <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 8 }}>
            {c.nextTitle}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.85, marginBottom: 10 }}>
            {c.nextBody}
          </div>
          <Link href="/guide" style={{
            fontSize: 13, color: "var(--accent)", textDecoration: "none",
            letterSpacing: "0.04em",
          }}>
            {c.nextGuideLink}
          </Link>
        </section>

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

// ═══════════════════════════════════════════════════════════════════
//  Faucet widget (inline inside step 3)
// ═══════════════════════════════════════════════════════════════════

function FaucetWidget(props: {
  c: (typeof CONTENT)[Lang];
  addr: string;
  setAddr: (v: string) => void;
  loading: boolean;
  result: { sol_tx: string; usdc_tx: string; usdc_ata: string } | null;
  error: string | null;
  onClaim: () => void;
}) {
  const { c, addr, setAddr, loading, result, error, onClaim } = props;
  return (
    <div style={{
      marginTop: 18,
      background: "var(--bg-base)",
      border: "1px solid var(--accent-mid)",
      borderRadius: 8, padding: "16px 18px",
    }}>
      <div style={{
        fontSize: 11, color: "var(--accent)", fontFamily: "var(--font-mono)",
        letterSpacing: "0.12em", marginBottom: 6, textTransform: "uppercase",
      }}>
        {c.faucetTitle}
      </div>
      <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.75, marginBottom: 12 }}>
        {c.faucetBody}
      </div>
      <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
        <input
          value={addr}
          onChange={(e) => props.setAddr(e.target.value)}
          placeholder={c.faucetInputPlaceholder}
          disabled={loading}
          style={{
            flex: 1, minWidth: 220,
            padding: "10px 12px", fontSize: 12, fontFamily: "var(--font-mono)",
            background: "var(--bg-card)", color: "var(--text-primary)",
            border: "1px solid var(--border)", borderRadius: 6,
            outline: "none",
          }}
        />
        <button
          onClick={onClaim}
          disabled={loading || addr.trim().length < 32}
          style={{
            padding: "10px 18px", fontSize: 12, fontFamily: "var(--font-heading)",
            background: loading ? "var(--border)" : "var(--accent)",
            color: loading ? "var(--text-muted)" : "white",
            border: "none", borderRadius: 6,
            cursor: loading || addr.trim().length < 32 ? "not-allowed" : "pointer",
            letterSpacing: "0.06em",
            opacity: addr.trim().length < 32 ? 0.5 : 1,
          }}
        >
          {loading ? c.faucetButtonLoading : c.faucetButton}
        </button>
      </div>
      {error && (
        <div style={{
          marginTop: 8, padding: "10px 12px",
          background: "#C9312A18", border: "1px solid #C9312A60",
          borderRadius: 6, fontSize: 11.5, color: "#C9312A", lineHeight: 1.6,
        }}>
          {c.faucetErrorPrefix}{error}
        </div>
      )}
      {result && (
        <div style={{
          marginTop: 10, padding: "12px 14px",
          background: "var(--accent-soft)", border: "1px solid var(--accent-mid)",
          borderRadius: 6, fontSize: 12, color: "var(--accent)", lineHeight: 1.75,
        }}>
          <div style={{ fontWeight: 600, marginBottom: 6 }}>{c.faucetSuccessTitle}</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--text-secondary)", wordBreak: "break-all" }}>
            <div>SOL tx:{" "}
              <a href={`https://solscan.io/tx/${result.sol_tx}?cluster=devnet`} target="_blank" rel="noopener noreferrer"
                style={{ color: "var(--accent)", textDecoration: "none" }}>
                {result.sol_tx.slice(0, 22)}…
              </a>
            </div>
            <div>USDC tx:{" "}
              <a href={`https://solscan.io/tx/${result.usdc_tx}?cluster=devnet`} target="_blank" rel="noopener noreferrer"
                style={{ color: "var(--accent)", textDecoration: "none" }}>
                {result.usdc_tx.slice(0, 22)}…
              </a>
            </div>
            <div>ATA:{" "}
              <a href={`https://solscan.io/account/${result.usdc_ata}?cluster=devnet`} target="_blank" rel="noopener noreferrer"
                style={{ color: "var(--accent)", textDecoration: "none" }}>
                {result.usdc_ata.slice(0, 22)}…
              </a>
            </div>
          </div>
          <div style={{ marginTop: 10, fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.7 }}>
            {c.faucetSuccessNote}
          </div>
        </div>
      )}
    </div>
  );
}
