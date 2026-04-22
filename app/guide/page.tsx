"use client";

import Link from "next/link";
import Footer from "@/components/Footer";
import { useLang } from "@/contexts/LanguageContext";

type Lang = "zh" | "en" | "ja";

type Step = { step: string; title: string; desc: string };
type Risk = { level: string; color: string; desc: string };

const CONTENT: Record<Lang, {
  back: string;
  badge: string;
  title: string;
  subtitle: string;
  introSealKanji: string;
  introSealLine: string;
  introHeadline: string;
  introBody: string;
  sections: Array<{
    id: string;
    badge: string;
    badgeColor: string;
    title: string;
    subtitle: string;
    intro: string;
    steps: Step[];
    risks: Risk[];
  }>;
  feeTitle: string;
  fees: Array<{ feature: string; free: string; paid: string }>;
  contact: string;
  contactHandle: string;
}> = {
  // ═══════════════════════════════════════════════════════════════════
  //  繁體中文 — primary
  // ═══════════════════════════════════════════════════════════════════
  zh: {
    back: "← 返回首頁",
    badge: "🌸 USER GUIDE · SIGN A GOOD INTENT, ONCE",
    title: "Sakura 使用手冊",
    subtitle: "Sakura 對散戶而言是一次性動作——簽一份意圖。簽完之後，代理在你設定的邊界內工作，不必盯著，不必信任任何人。這份手冊只教這一件事：如何簽一份不會讓你後悔的意圖。",
    introSealKanji: "簽",
    introSealLine: "🌸 Sakura · 一次簽名 · 數學守門",
    introHeadline: "打開代理模式前，你只需要做對一件事——簽一份好的意圖。",
    introBody: "Sakura 是道你自己設定、無人能繞開的安全門。一次簽名，邊界上鏈。之後代理每一次動作，都必須在數學上證明它沒越界——否則 Solana 自己在執行前拒絕交易，資金根本不會離開你的錢包。不需要監控 app，不需要信任任何第三方。你是主權者，數學只是強制執行。",
    sections: [
      {
        id: "five-mistakes",
        badge: "第 壱 章 · 五個最常見的錯法",
        badgeColor: "#C9312A",
        title: "五個最常見的錯法",
        subtitle: "簽意圖的時候最容易踩的坑——先認得它們",
        intro: "AI 代理會忠實執行你簽下的每一個字。這意味著：你寫得越模糊，代理的自由度越大；你勾得越寬，代理能動的地方越多。下面這五種錯，是 Sakura 團隊反覆在早期使用者身上看到的——把它們記住，你已經避開 80% 的麻煩。",
        steps: [
          { step: "壱", title: "描述寫得太抽象", desc: "糟糕例子：「代理做一些有收益的事」。AI 對「有收益」有自己的理解——你以為它會 Lend，它可能認為「Borrow 然後 Swap 再 Lend」也算。好的例子：「代理可以把最多 \$500 USDC 存入 Kamino 或 Jupiter Lend，每週結算一次」。具體，可查證，界線清楚。" },
          { step: "弐", title: "勾選了「反正也沒差」的協議", desc: "為了省事把 4 個龍頭協議（Jupiter、Raydium、Kamino、Jito）全部勾上。問題是：每個協議的失敗模式不同——Kamino 是借貸市場（清算風險）、Jito 是流動質押（LST 脫鉤風險）、Jupiter Swap 是聚合（MEV / 滑點）、Jupiter Lend 是借貸（清算 + 利息）、Raydium 是直接 AMM（滑點）。一個沒做功課的勾選 = 同意代理在你不理解的風險裡做決定。原則：只勾你親自用過、知道風險特徵的協議。不熟的不勾，損失有限。" },
          { step: "参", title: "過期時間設得太長", desc: "一簽 180 天。180 天裡市場可能翻天——你當時覺得合理的 APY、協議風險、代理策略，6 個月後可能都已失效。意圖期間你不能改規則，只能撤銷重簽（每次約 \$1）。原則：第一次試用 ≤ 24 小時；熟了再延到 7 天；永遠不要第一次就簽超過 30 天。" },
          { step: "肆", title: "單筆上限 = 總額上限", desc: "單筆上限 \$1,000，總 USD 上限也是 \$1,000——等於授權 AI「一口氣動完」。AI 判斷錯誤的話，你一次性全部暴露。原則：單筆上限 ≤ 總額 ÷ 5。這樣代理至少要分 5 次動作才能用完授權，中間你有機會看到情況不對並撤銷。" },
          { step: "伍", title: "勾了 Borrow 但沒想清楚", desc: "以為勾 Borrow 只是「為了靈活」。問題是：Borrow 會產生利息債務和清算風險。代理認為借一筆搞套利划算但失手了——你的帳戶不只是虧錢，還可能有未還債務和被清算。原則：Borrow 單獨審慎對待。新手直接不勾，損失有限；老手勾之前先在心裡演練「如果策略失手會怎樣」。" },
        ],
        risks: [],
      },
      {
        id: "correct-flow",
        badge: "第 弐 章 · 正確流程 · 3 分鐘",
        badgeColor: "#B8932A",
        title: "3 分鐘簽一份好意圖",
        subtitle: "從打開頁面到完成簽名，六個步驟",
        intro: "一份好意圖不是寫得多漂亮，是限制得足夠精確。下面的六步是團隊建議的安全流程——熟了之後你大約 60 秒能簽完。重點不是快，是每一步都有想清楚。",
        steps: [
          { step: "壱", title: "先想清楚策略類型", desc: "保守：Lend USDC 生息；中等：Lend + 為了再平衡的 Swap；激進：涉及 Borrow 或衍生品（不建議新手）。你心裡要先有答案——代理到底在幫你做哪一類事？不要讓 AI 替你決定風險偏好。" },
          { step: "弐", title: "根據策略勾最少的協議 + 動作", desc: "保守：Kamino 或 Jupiter Lend × Lend；或 Jito × Stake。中等：Kamino + Jupiter Lend × Lend + Jupiter / Raydium × Swap。激進：加上 Kamino 或 Jupiter Lend × Borrow（產生利息債務 + 清算風險）。原則是「勾到足夠跑策略即可，多一個都不要」。每多勾一個協議 / 動作，就是多給 AI 一扇門。" },
          { step: "参", title: "寫自然語言描述——具體、可查證", desc: "不要寫「代理幫我賺錢」這種話。寫「代理可以在 Kamino 或 Jupiter Lend 的 USDC 市場存款；不能提領或 Swap；每週檢視一次」。你之後回頭看 ActionHistory，這段話是你對照代理行為的唯一基準——寫具體，以後才有得核對。" },
          { step: "肆", title: "金額：總額 = 輸得起的數字；單筆 = 總額 ÷ 5", desc: "問自己兩個問題：（1）最壞情況下我願意虧多少？那就是總額上限。（2）單筆能不能更保守？填總額的 1/5。這樣即使 AI 判斷失誤，它也要至少 5 次獨立動作才能把授權用完——你有時間看到不對勁。" },
          { step: "伍", title: "期限：第一次 24 小時 → 7 天 → 30 天", desc: "第一次用 Sakura，強烈建議 24 小時。看完一輪代理動作，撤銷，重新想策略，再簽一份。熟了之後延到 7 天。長期用也不建議超過 30 天。永遠不要第一次就簽 365 天——你不了解的東西，不該給它那麼久的信任。" },
          { step: "陸", title: "錢包確認前最後一眼：收款地址是 Sakura fee_vault PDA", desc: "錢包會彈出交易確認視窗，顯示收款地址。正確的收款地址是 Sakura 協議的 fee_vault PDA（由 Solana 程式自動控制，沒有私鑰）。如果顯示任何其他地址——不要簽，立即關掉彈窗，檢查你是不是在正確的 Sakura 網站上。" },
        ],
        risks: [],
      },
      {
        id: "guarantees",
        badge: "第 参 章 · Sakura 的邊界與責任",
        badgeColor: "#5A7A4A",
        title: "Sakura 替你保證什麼、不保證什麼",
        subtitle: "黑白分明，沒有灰色地帶",
        intro: "Sakura 是邊界護欄，不是風險顧問。設定邊界是你的責任；執行邊界是 Sakura 的責任。下面左欄是 Sakura 在合約層面替你保證的，右欄是不在 Sakura 職責範圍內的——看清楚界線，你才能做出合理的授權決定。",
        steps: [],
        risks: [
          { level: "✅ Sakura 替你保證", color: "#5A7A4A", desc: "代理不能做你沒簽過的事——金額、協議、動作類型、期限，任何一項越界，Solana 在執行前拒絕整筆交易。" },
          { level: "❌ Sakura 不替你保證", color: "#C9312A", desc: "代理不會在你授權範圍內做蠢事。授權了 Lend，它選了一個 APY 0.01% 的協議——這不是 Sakura 管的範圍，是你簽的時候該想清楚的。" },
          { level: "✅ Sakura 替你保證", color: "#5A7A4A", desc: "用過期或假的預言機報價 → 整筆交易 revert。Sakura 同時檢查 Pyth 和 Switchboard 兩個獨立預言機：feed_id、slot、150 塊新鮮度、Pyth 現貨 vs EMA ≤ 2%、Pyth vs Switchboard ≤ 1%。任一越界都拒絕。" },
          { level: "❌ Sakura 不替你保證", color: "#C9312A", desc: "Sakura 不保護底層 DeFi 協議本身。Kamino 被黑的話，Sakura 的證明照樣有效——你的錢在 Kamino 裡仍會受影響。選協議就是選底層風險。" },
          { level: "✅ Sakura 替你保證", color: "#5A7A4A", desc: "Sakura 團隊不能偷你的錢。fee_vault 是 PDA 帳戶，合約裡沒有「管理員提領」指令——即使整個團隊明天都不見了，金庫裡的錢也只能按預先寫好的規則流出。" },
          { level: "❌ Sakura 不替你保證", color: "#C9312A", desc: "如果 Pyth 和 Switchboard 兩個預言機同時被操縱、且報價一致偏離真實市場價，Sakura 只能驗證「來自這兩個預言機」而不是「它們說的對不對」。要做到這種攻擊，需要同時攻破兩個獨立的發布者網路——門檻顯著高於單一預言機，但非絕對。" },
        ],
      },
    ],
    feeTitle: "你會付給 Sakura 的錢 · 只有兩筆，封頂透明",
    fees: [
      { feature: "🪪 簽 / 撤銷意圖", free: "—", paid: "0.1% × 總 USD 上限（例：總額 \$1,000 → 付 \$1；硬封頂 \$1,000）" },
      { feature: "🤖 代理每次動作", free: "—", paid: "固定 \$0.01（EXECUTE_ACTION_FEE_MICRO = 10_000）" },
      { feature: "🔗 網路 gas", free: "—", paid: "~0.001 SOL / 筆（付給 Solana 驗證者，不歸 Sakura）" },
    ],
    contact: "有任何操作疑問或遇到 bug：",
    contactHandle: "𝕏 @sakuraaijp",
  },

  // ═══════════════════════════════════════════════════════════════════
  //  English
  // ═══════════════════════════════════════════════════════════════════
  en: {
    back: "← Back to Home",
    badge: "🌸 USER GUIDE · SIGN A GOOD INTENT, ONCE",
    title: "Sakura User Guide",
    subtitle: "For retail users, Sakura is essentially one action — signing an intent. Once signed, the agent works inside the bounds you set, without you watching, without you trusting anyone. This guide teaches that one thing: how to sign an intent you will not regret.",
    introSealKanji: "Sign",
    introSealLine: "🌸 Sakura · One signature · Math stands guard",
    introHeadline: "Before you open agent mode, there is exactly one thing to get right — signing a good intent.",
    introBody: "Sakura is a safety gate you set yourself, and that no one can override. One signature anchors your bounds on-chain. Every action the agent takes thereafter must mathematically prove it is within those bounds — or Solana itself rejects the transaction before the action executes, and the funds never leave your wallet. No monitoring app. No trust in any third party. You are the sovereign. The math is merely the enforcement.",
    sections: [
      {
        id: "five-mistakes",
        badge: "CHAPTER I · FIVE COMMON MISTAKES",
        badgeColor: "#C9312A",
        title: "Five Most Common Mistakes",
        subtitle: "The traps users fall into when signing intent — recognize them first",
        intro: "An AI agent faithfully executes every word you sign. Which means: the vaguer you write, the more latitude the agent has; the broader you tick, the more terrain it can touch. The five mistakes below are what the Sakura team repeatedly sees in early users — internalize them and you have avoided 80% of the trouble.",
        steps: [
          { step: "I", title: "Writing the description too abstractly", desc: "Bad example: \"Agent does something profitable.\" The AI has its own interpretation of \"profitable\" — you meant Lend, but it may read \"Borrow then Swap then Lend\" as also profitable. Good example: \"Agent may lend up to \$500 USDC into Kamino or Jupiter Lend, settled weekly.\" Specific, verifiable, clearly bounded." },
          { step: "II", title: "Ticking protocols \"just in case\"", desc: "For convenience, all 4 龙头 protocols (Jupiter, Raydium, Kamino, Jito) get checked. Problem: every protocol has a different failure mode — Kamino is a lending market (liquidation risk), Jito is liquid staking (LST-depeg risk), Jupiter Swap is a swap aggregator (MEV / slippage), Jupiter Lend is collateralised borrowing (liquidation + interest), Raydium is direct AMM swap (slippage). An uninformed tick equals consent to the agent making decisions inside risks you do not understand. Principle: tick only protocols you have personally used and whose risk profile you know. Skip what you don't recognize — the loss upside is bounded." },
          { step: "III", title: "Setting the expiry too long", desc: "Signing for 180 days in one go. Markets can turn over in 180 days — the APY, protocol risk, and agent strategy you found reasonable today may all be stale 6 months later. You cannot modify rules mid-intent; only revoke and re-sign (~\$1 each). Principle: first use ≤ 24 hours; once familiar, extend to 7 days; never sign over 30 days on a first attempt." },
          { step: "IV", title: "Single-action cap = total USD cap", desc: "Single-action cap \$1,000, total USD cap also \$1,000 — this is consenting to the AI \"using it all in one go.\" If the AI misjudges, you are fully exposed in a single action. Principle: single-action cap ≤ total ÷ 5. This forces the agent into at least 5 independent actions to exhaust the authorization — giving you time to see something wrong and revoke." },
          { step: "V", title: "Ticking Borrow without thinking it through", desc: "Thinking \"Borrow just for flexibility.\" Problem: Borrow creates interest debt and liquidation risk. If the agent thinks borrowing for arbitrage is profitable and misfires — your account loses money AND carries an unpaid debt that may be liquidated. Principle: Borrow deserves a separate deliberation. Newcomers, leave it unchecked; experienced users, mentally rehearse the failure case before ticking it." },
        ],
        risks: [],
      },
      {
        id: "correct-flow",
        badge: "CHAPTER II · CORRECT FLOW · 3 MINUTES",
        badgeColor: "#B8932A",
        title: "Signing a Good Intent in 3 Minutes",
        subtitle: "From opening the page to completing the signature — six steps",
        intro: "A good intent is not well-written; it is precisely bounded. The six steps below are the team's recommended safety flow — once familiar, you can sign in about 60 seconds. The point is not speed; the point is that every step has been thought through.",
        steps: [
          { step: "I", title: "Decide the strategy class first", desc: "Conservative: Lend USDC for yield. Medium: Lend + rebalancing Swaps. Aggressive: anything involving Borrow or derivatives (not recommended for newcomers). Have the answer in your head before you start — what kind of thing, specifically, is the agent supposed to do for you? Do not let the AI decide your risk profile." },
          { step: "II", title: "Tick the minimum protocols + actions needed", desc: "Conservative: Kamino or Jupiter Lend × Lend; or Jito × Stake. Medium: Kamino + Jupiter Lend × Lend + Jupiter / Raydium × Swap. Aggressive: add Kamino or Jupiter Lend × Borrow (interest debt + liquidation risk). Principle is \"tick enough to run the strategy, not one more.\" Every extra protocol or action you tick is another door you hand to the AI." },
          { step: "III", title: "Write the natural-language description — specific, auditable", desc: "Do not write \"agent makes me money.\" Write: \"agent may deposit into Kamino or Jupiter Lend USDC markets; may not withdraw or swap; reviews weekly.\" When you later come back to ActionHistory, this sentence is your sole reference for whether the agent behaved — so write something you can check against later." },
          { step: "IV", title: "Amount: total = what you can lose; single = total ÷ 5", desc: "Ask yourself two questions. (1) What is the worst case I can absorb? That is your total cap. (2) Can single be more conservative? Set it to total ÷ 5. Even if the AI misfires, it would need at least 5 independent actions to exhaust the authorization — giving you time to see trouble and revoke." },
          { step: "V", title: "Expiry: first 24 hours → 7 days → 30 days", desc: "First time using Sakura, 24 hours is strongly recommended. Watch one round of agent actions, revoke, rethink strategy, sign again. Once familiar, extend to 7 days. Even long-term use should rarely exceed 30 days. Never sign for 365 days on a first attempt — you do not know the thing well enough to give it that much trust." },
          { step: "VI", title: "Last check before wallet confirms: payee is Sakura fee_vault PDA", desc: "The wallet pops up a confirmation window showing the payee address. The correct address is Sakura protocol's fee_vault PDA (controlled by the Solana program itself, no private key). If any other address shows up — do not sign. Close the window, check that you are on the real Sakura domain." },
        ],
        risks: [],
      },
      {
        id: "guarantees",
        badge: "CHAPTER III · BOUNDS & RESPONSIBILITIES",
        badgeColor: "#5A7A4A",
        title: "What Sakura Guarantees and What It Does Not",
        subtitle: "Black and white — no grey zone",
        intro: "Sakura is a bounds rail, not a risk advisor. Setting the bound is your responsibility; enforcing it is Sakura's. The left column lists what Sakura guarantees at the contract level; the right column lists what is outside Sakura's scope. Understand where the line runs, and you can authorize with clarity.",
        steps: [],
        risks: [
          { level: "✅ Sakura GUARANTEES", color: "#5A7A4A", desc: "The agent cannot do what you did not sign for — amount, protocol, action type, expiry. Any one of them out of bounds, and Solana rejects the entire transaction before execution." },
          { level: "❌ Sakura DOES NOT guarantee", color: "#C9312A", desc: "The agent will not make stupid choices within your authorization. You allowed Lend, it picked a protocol with 0.01% APY — not Sakura's concern. That is a decision you should have thought through when you signed." },
          { level: "✅ Sakura GUARANTEES", color: "#5A7A4A", desc: "Stale or spoofed oracle prices → transaction reverts. Sakura verifies both Pyth AND Switchboard independently: feed_id, slot, 150-block freshness, Pyth spot-vs-EMA ≤ 2%, and Pyth-vs-Switchboard ≤ 1%. Any one out of bounds rejects the action." },
          { level: "❌ Sakura DOES NOT guarantee", color: "#C9312A", desc: "Sakura does not protect the underlying DeFi protocols themselves. If Kamino is exploited, Sakura's proof remains valid — your funds inside Kamino are still affected. Choosing the protocol is choosing the underlying risk." },
          { level: "✅ Sakura GUARANTEES", color: "#5A7A4A", desc: "The Sakura team cannot steal your money. The fee_vault is a PDA account; the contract has no \"admin withdrawal\" instruction. Even if the entire team disappears tomorrow, vault funds can only flow via pre-defined rules." },
          { level: "❌ Sakura DOES NOT guarantee", color: "#C9312A", desc: "If Pyth AND Switchboard are simultaneously manipulated and their prices agree on a wrong value, Sakura only verifies \"prices came from these two oracles\" — not \"the oracles are correct.\" Achieving this requires compromising two independent publisher networks at once — a much higher bar than single-oracle attack, but not impossible." },
        ],
      },
    ],
    feeTitle: "What you pay Sakura · Only two fees, both capped and transparent",
    fees: [
      { feature: "🪪 Sign / revoke intent", free: "—", paid: "0.1% × total USD cap (e.g. \$1,000 cap → \$1 fee; hard-capped at \$1,000)" },
      { feature: "🤖 Each agent action", free: "—", paid: "Flat \$0.01 (EXECUTE_ACTION_FEE_MICRO = 10_000)" },
      { feature: "🔗 Network gas", free: "—", paid: "~0.001 SOL / tx (paid to Solana validators, not Sakura)" },
    ],
    contact: "Any operating question or bug:",
    contactHandle: "𝕏 @sakuraaijp",
  },

  // ═══════════════════════════════════════════════════════════════════
  //  日本語
  // ═══════════════════════════════════════════════════════════════════
  ja: {
    back: "← ホームへ戻る",
    badge: "🌸 使用手冊 · 良い意図を、一度、正しく",
    title: "Sakura 使用手冊",
    subtitle: "個人投資家にとって Sakura は実質 1 つの動作に尽きる——意図を 1 度署名すること。署名後、エージェントはあなたが定めた境界の内側で動く。監視する必要はない。誰を信じる必要もない。この手冊は、その 1 つのことだけを教える——後悔しない意図の署名の仕方。",
    introSealKanji: "署",
    introSealLine: "🌸 Sakura · 一度の署名 · 数学が番をする",
    introHeadline: "エージェントモードを開く前に、正しく行わねばならぬことは、ただ 1 つ——良い意図に署名すること。",
    introBody: "Sakura は、あなた自身が設定し、誰にも迂回されぬ安全ゲートである。1 度の署名で境界をオンチェーンに定錨。以後、エージェントが行う各動作は、境界の内側にあることを数学的に証明せねばならぬ——さもなければ、Solana 自身が、実行の前にトランザクションを拒み、資金はあなたのウォレットから出ることすらない。監視アプリは要らぬ。第三者を信じる必要もない。あなたこそが主権、数学はその執行にすぎぬ。",
    sections: [
      {
        id: "five-mistakes",
        badge: "第 壱 章 · 五つの陥穴",
        badgeColor: "#C9312A",
        title: "最もよくある五つの誤り",
        subtitle: "意図に署名するとき、人が踏む穴——まず知ることから",
        intro: "AI エージェントは、あなたが署名した一字一句を忠実に実行する。すなわち、曖昧に書くほどエージェントの裁量は広がり、広く選ぶほど触れられる地盤が増える。下記の五つは、Sakura チームが初期ユーザーの中で繰り返し見てきた誤りである——これらを覚えれば、厄介事の八割は既に回避されている。",
        steps: [
          { step: "壱", title: "説明が抽象的すぎる", desc: "悪い例：「エージェントは利益の出ることをする」。AI は「利益」を独自に解釈する——あなたは Lend のつもりでも、AI は「Borrow → Swap → Lend」も利益だと解釈するかもしれぬ。良い例：「エージェントは最大 \$500 USDC を Kamino または Jupiter Lend に貸せる、週次精算」。具体的で、検証可能で、境界が明確。" },
          { step: "弐", title: "「ついでに」とプロトコルを選びすぎる", desc: "手間を省くために 4 つの龍頭プロトコル（Jupiter、Raydium、Kamino、Jito）すべてにチェックを入れる。問題：各プロトコルは、失敗モードが互いに異なる——Kamino は貸付市場（清算リスク）、Jito は流動性ステーキング（LST デペッグリスク）、Jupiter Swap はアグリゲータ（MEV・スリッページ）、Jupiter Lend は担保付き借入（清算 + 利息）、Raydium は直接 AMM（スリッページ）。不勉強な選択は、エージェントが、あなたの理解せぬリスクの中で判断を下すことへの同意である。原則：自分で使ったことがあり、リスクプロファイルを知っているプロトコルだけを選ぶ。不慣れなものは外せ——損失の上限が有限のままである。" },
          { step: "参", title: "期限を長くしすぎる", desc: "一度に 180 日分署名する。180 日あれば市場は激変しうる——当時合理的と見えた APY、プロトコルリスク、エージェント戦略は、6 ヶ月後にはすべて陳腐化していることがある。意図の期間中はルールを変更できない。取り消して再署名するしかない（1 回あたり約 \$1）。原則：初回使用 ≤ 24 時間。慣れたら 7 日に延ばす。初回で 30 日を超えてはならぬ。" },
          { step: "肆", title: "1 回の上限 = 累計 USD 上限", desc: "1 回の上限 \$1,000、累計 USD 上限も \$1,000——これは AI に「一気に全額使ってよい」と許可することと同義である。AI が判断を誤れば、あなたは 1 回の動作で全額を曝す。原則：1 回の上限 ≤ 累計 ÷ 5。これにより、エージェントは許可を使い切るのに少なくとも 5 回の独立動作を要する——あなたは途中で不具合を察知し、取り消す時間を得る。" },
          { step: "伍", title: "深く考えずに Borrow を選ぶ", desc: "「柔軟性のために」と Borrow を選ぶ。問題：Borrow は利子債務と清算リスクを生む。エージェントが「借りて裁定取引すれば得」と判断し失敗すれば——あなたのアカウントは損失を出すだけでなく、未払の債務を抱え、清算される可能性がある。原則：Borrow は単独で慎重に検討する。初心者は選ばぬ方が良い——損失が限定的になる。熟達者でも、選ぶ前に「戦略が失敗したらどうなるか」を頭の中で演練せよ。" },
        ],
        risks: [],
      },
      {
        id: "correct-flow",
        badge: "第 弐 章 · 正しい流れ · 3 分",
        badgeColor: "#B8932A",
        title: "3 分で良い意図に署名する",
        subtitle: "ページを開くところから署名完了まで——六つの手順",
        intro: "良い意図とは、うまく書かれた意図ではなく、精確に制限された意図である。下記の六手順は、チーム推奨の安全な流れ——慣れれば 60 秒程度で署名できる。要点は速度ではなく、各手順が考え抜かれていること。",
        steps: [
          { step: "壱", title: "まず戦略の分類を決める", desc: "保守：USDC を貸して利息を得る。中程度：Lend ＋ リバランシングの Swap。攻撃的：Borrow やデリバティブを含むもの（初心者には推奨せぬ）。答えを頭の中に用意しておけ——エージェントは、具体的にどのような仕事をあなたに代わって行うのか？ AI にリスク選好を代わりに決めさせてはならぬ。" },
          { step: "弐", title: "戦略に基づき、必要最小限のプロトコル + 動作を選ぶ", desc: "保守：Kamino または Jupiter Lend × Lend；あるいは Jito × Stake。中程度：Kamino + Jupiter Lend × Lend + Jupiter / Raydium × Swap。攻撃的：Kamino または Jupiter Lend × Borrow を加える（利子債務 + 清算リスクを伴う）。原則は「戦略を実行するのに足るだけ選び、余分に 1 つも加えぬ」。余分に選ぶ 1 つは、AI に渡す扉が 1 つ増えるに等しい。" },
          { step: "参", title: "自然言語で説明を書く——具体的に、検証可能に", desc: "「エージェント、儲けて」のような文は書くな。代わりに：「エージェントは Kamino または Jupiter Lend の USDC 市場に預金できる。引き出しも Swap も不可。週次で確認する」。後日 ActionHistory に戻る際、この一文がエージェントの挙動を照合する唯一の基準となる——後で照合できるよう、具体的に書け。" },
          { step: "肆", title: "金額：累計 = 失っても良い額；1 回 = 累計 ÷ 5", desc: "自分に二つの問いを立てよ。（一）最悪の場合、いくらまでなら耐えられるか？それが累計上限である。（二）1 回分はもっと保守的にできるか？累計の 1/5 に設定せよ。AI が判断を誤っても、許可を使い切るには少なくとも 5 回の独立動作を要する——途中で異変を察知し、取り消す時間が生まれる。" },
          { step: "伍", title: "期限：初回 24 時間 → 7 日 → 30 日", desc: "初めて Sakura を使うときは、24 時間を強く推奨する。一周分のエージェント動作を見届け、取り消し、戦略を練り直し、再び署名せよ。慣れたら 7 日に延ばす。長期利用でも 30 日を超えることは稀であるべきだ。初回で 365 日を署名してはならぬ——十分に知らぬものに、それほど長い信頼を預けるべきではない。" },
          { step: "陸", title: "ウォレット確認の直前に最後の確認：受取アドレスが Sakura の fee_vault PDA", desc: "ウォレットが確認ウィンドウを出し、受取アドレスを表示する。正しい受取先は Sakura プロトコルの fee_vault PDA——Solana プログラム自身が制御する、秘密鍵のない口座。ほかのアドレスが表示されたら——署名するな。ウィンドウを閉じ、本物の Sakura ドメインに居ることを確認せよ。" },
        ],
        risks: [],
      },
      {
        id: "guarantees",
        badge: "第 参 章 · 境界と責任",
        badgeColor: "#5A7A4A",
        title: "Sakura が保証すること、保証せぬこと",
        subtitle: "白黒はっきりと——灰色地帯なし",
        intro: "Sakura は境界の柵であり、リスクアドバイザーではない。境界の設定はあなたの責任、境界の執行は Sakura の責任である。左欄は Sakura が契約レベルで保証する事項。右欄は Sakura の責務の外にある事項——線の在りかを理解して初めて、明確に許可できる。",
        steps: [],
        risks: [
          { level: "✅ Sakura の保証", color: "#5A7A4A", desc: "エージェントは、あなたが署名せぬことを行えぬ——金額、プロトコル、動作タイプ、期限。どれか 1 つでも境界を越えれば、Solana が実行前にトランザクション全体を拒絶する。" },
          { level: "❌ Sakura の保証外", color: "#C9312A", desc: "エージェントが許可内で愚かな選択をしないこと。Lend を許可したら、エージェントが APY 0.01% のプロトコルを選んだ——これは Sakura の管轄ではない。署名の時点で考えるべきだった事柄である。" },
          { level: "✅ Sakura の保証", color: "#5A7A4A", desc: "陳腐化したり偽造されたオラクル価格 → トランザクションはリバートする。Sakura は Pyth と Switchboard の二つを独立に検証：feed_id、slot、150 ブロック新鮮度、Pyth 現物 vs EMA ≤ 2%、Pyth vs Switchboard ≤ 1%。どれか 1 つでも境界を越えれば、その動作は拒絶される。" },
          { level: "❌ Sakura の保証外", color: "#C9312A", desc: "Sakura は基礎となる DeFi プロトコル自体を保護せぬ。Kamino が侵害されれば、Sakura の証明は依然として有効だが、Kamino 内の資金は影響を受ける。プロトコルを選ぶことは、基礎リスクを選ぶことと同義。" },
          { level: "✅ Sakura の保証", color: "#5A7A4A", desc: "Sakura チームがあなたの資金を盗むことはできぬ。fee_vault は PDA アカウント、契約には「管理者引き出し」命令が存在せぬ——チーム全員が明日姿を消しても、金庫の資金は事前に定めた規則でしか流出せぬ。" },
          { level: "❌ Sakura の保証外", color: "#C9312A", desc: "Pyth と Switchboard が同時に操作され、両者が一致して誤った価格を示す場合、Sakura は「価格が両オラクルから来たこと」のみ検証し、「オラクル自身が真実を語っているか」は検証せぬ。この攻撃には二つの独立した発行者ネットワークを同時に破る必要があり——単一オラクル攻撃よりも遥かに高い閾値だが、絶対ではない。" },
        ],
      },
    ],
    feeTitle: "Sakura に払う金銭 · 二項目のみ、上限付き、透明",
    fees: [
      { feature: "🪪 意図の署名 / 取消", free: "—", paid: "0.1% × 累計 USD 上限（例：累計 \$1,000 → 手数料 \$1、上限 \$1,000）" },
      { feature: "🤖 各エージェント動作", free: "—", paid: "固定 \$0.01（EXECUTE_ACTION_FEE_MICRO = 10_000）" },
      { feature: "🔗 ネットワーク gas", free: "—", paid: "~0.001 SOL / 件（Solana バリデータに支払い、Sakura の取り分ではない）" },
    ],
    contact: "操作上の疑問やバグ報告：",
    contactHandle: "𝕏 @sakuraaijp",
  },
};

export default function GuidePage() {
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

        {/* Intro seal block — mirrors the 桜 block on docs/page.tsx */}
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
          }}>{c.introSealKanji}</div>
          <div>
            <div style={{ fontSize: 9, letterSpacing: "0.2em", color: "var(--accent)", fontFamily: "var(--font-mono)", marginBottom: 6, textTransform: "uppercase" }}>
              {c.introSealLine}
            </div>
            <div style={{ fontSize: 13, fontWeight: 400, color: "var(--text-primary)", marginBottom: 8, fontFamily: "var(--font-heading)", letterSpacing: "0.04em" }}>
              {c.introHeadline}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.9 }}>
              {c.introBody}
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
            {section.steps.length > 0 && (
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
            )}

            {/* Risk / guarantees grid — 2 columns */}
            {section.risks.length > 0 && (
              <div className="guide-risks-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 10 }}>
                {section.risks.map((r, ri) => (
                  <div key={ri} style={{
                    background: "var(--bg-card)", border: `1px solid ${r.color}25`,
                    borderLeft: `3px solid ${r.color}`, borderRadius: 8, padding: "14px 16px",
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: r.color, marginBottom: 6, letterSpacing: "0.03em" }}>{r.level}</div>
                    <div style={{ fontSize: 11.5, color: "var(--text-secondary)", lineHeight: 1.75 }}>{r.desc}</div>
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

        {/* Mobile: collapse risk grid to single column */}
        <style jsx>{`
          @media (max-width: 640px) {
            :global(.guide-risks-grid) { grid-template-columns: 1fr !important; }
          }
        `}</style>
      </div>
      <Footer />
    </main>
  );
}
