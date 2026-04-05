"use client";

import { useState, useRef, useEffect } from "react";
import SwapModal from "./SwapModal";
import StakeModal from "./StakeModal";
import LendModal from "./LendModal";
import { loadChatMemory, saveChatMemory, clearChatMemory } from "@/lib/chat-memory";
import { getWatchlist, saveLastPrice } from "@/lib/watchlist";
import { useLang } from "@/contexts/LanguageContext";
import { payWithPhantom } from "@/lib/x402";
import { getDeviceId } from "@/lib/device-id";
import CopyTradeModal from "./CopyTradeModal";
import AgentFactory from "./AgentFactory";

const SOLIS_FEE_WALLET_ADDR = "Goc5kAMb9NTXjobxzZogAWaHwajmQjw7CdmATWJN1mQh";

// ── Types ────────────────────────────────────────────────────────
interface YieldOpportunity {
  protocol: string;
  icon: string;
  action: string;
  apy: number;
  apyDisplay: string;
  url: string;
  color: string;
  riskLevel: "低" | "中" | "高";
  category: "stake" | "lend" | "lp";
  detail: string;
}

interface LiveYield {
  opportunities: YieldOpportunity[];
  updatedAt: number;
}

interface ActionCard {
  protocol: string;
  icon: string;
  action: string;
  detail: string;
  apy?: string;
  url: string;
  color: string;
  riskLevel: "低" | "中" | "高";
  estimatedEarn?: string;
}

// ── Smart Money Panel types ──────────────────────────────────────
interface ConsensusToken {
  mint: string;
  symbol?: string;
  buyerCount: number;
  buyerLabels: string;
  buyers: Array<{ shortAddr: string; twitter?: string; name?: string; labels: string[] }>;
  totalBuyUSD: number;
  starRating: 1|2|3|4|5;
  firstSeenAt: number;
}

interface TrackedWallet {
  address: string;
  shortAddress: string;
  labels: string[];
  twitter?: string;
  name?: string;
  activityCount: number;
  tokens: string[];
}

interface SmartMoneyData {
  consensusTokens: ConsensusToken[];
  activeWallets: TrackedWallet[];
  solPrice: number;
  trackedWallets: number;
  dataSource: "helius_realtime" | "demo";
  updatedAt: number;
}

interface StrategyCard {
  asset: string;
  action: "buy" | "sell" | "stake" | "lend" | "reduce" | "hold" | "swap";
  entryLow?: number;
  entryHigh?: number;
  takeProfit1?: number;
  takeProfit2?: number;
  stopLoss?: number;
  allocationPct?: number;
  timeHorizon?: string;
  confidence: number;
  thesis: string;
  riskFactors?: string[];
  generatedAt: number;
}

interface Message {
  id: number;
  role: "user" | "assistant";
  text: string;
  actions?: ActionCard[];
  strategyCards?: StrategyCard[];
  isTyping?: boolean;
  thinkingStep?: string;     // current thinking step (streaming)
  isStreaming?: boolean;     // text is still being streamed
  reasoningHash?: string;
  memoPayload?: string;
  aiAvailable?: boolean;
  isAgentInitiated?: boolean;
}

interface WalletSnapshot {
  solBalance: number;
  totalUSD: number;
  idleUSDC: number;
}

interface Props {
  walletAddress: string;
  walletSnapshot?: WalletSnapshot;
}

// ── Intent Parser ────────────────────────────────────────────────
type Intent =
  | { type: "stake_sol"; amount: number | null }
  | { type: "deposit_usdc"; amount: number | null }
  | { type: "swap"; from: string; to: string; amount: number | null }
  | { type: "yield_find" }
  | { type: "price_check"; token: string }
  | { type: "analyze_token"; mint: string }
  | { type: "rug_check"; token: string }
  | { type: "portfolio_check" }
  | { type: "unknown" };

function parseIntent(input: string): Intent {
  const text = input.toLowerCase().trim();
  const numMatch = text.match(/[\d,.]+/);
  const amount = numMatch ? parseFloat(numMatch[0].replace(",", "")) : null;

  if (/(質押|staking|stake|liquid.*stake)/i.test(text) && /sol/i.test(text)) return { type: "stake_sol", amount };
  if (/(存入|理财|存usdc|earn|lending)/i.test(text) && /usdc/i.test(text)) return { type: "deposit_usdc", amount };
  if (/(收益|yield|apy|利率|最高|怎麼賺|賺錢|被動收入)/i.test(text)) return { type: "yield_find" };
  // Buy intent: "買 BONK", "buy 10 WIF", "幫我買 USDC"
  const buyMatch = text.match(/(?:買|buy|購買)\s+(?:([\d.]+)\s+)?(\$?[A-Za-z]{2,12})/i);
  if (buyMatch) {
    const amt = buyMatch[1] ? parseFloat(buyMatch[1]) : 10;
    const tok = buyMatch[2].replace("$", "").toUpperCase();
    return { type: "swap", from: "USDC", to: tok, amount: amt };
  }
  // Swap intent: "swap 10 USDC for BONK"
  const swapMatch = text.match(/swap\s+([\d.]+)\s+([A-Za-z]+)\s+(?:for|to|換成|換)\s+([A-Za-z]+)/i);
  if (swapMatch) {
    return { type: "swap", from: swapMatch[2].toUpperCase(), to: swapMatch[3].toUpperCase(), amount: parseFloat(swapMatch[1]) };
  }
  if (/(換|swap|兑換|賣掉)/i.test(text)) {
    const to = text.match(/(換成|to|買)\s*(sol|usdc|usdt|bonk|jup)/i)?.[2]?.toUpperCase() ?? "USDC";
    return { type: "swap", from: "SOL", to, amount };
  }
  const mintMatch = text.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
  if (mintMatch) return { type: "analyze_token", mint: mintMatch[0] };
  if (/(rug|跑路|骗局|safe|安全|檢測)/i.test(text)) {
    const tok = text.match(/\$?([A-Z]{2,10})/i)?.[1]?.toUpperCase() ?? "?";
    return { type: "rug_check", token: tok };
  }
  const priceMatch = text.match(/(sol|usdc|bonk|jup|btc|eth)/i);
  if (priceMatch && /(價格|price|多少|涨|跌)/i.test(text)) return { type: "price_check", token: priceMatch[1].toUpperCase() };
  if (/(我的錢包|portfolio|資產|持倉|總值|体檢|健康)/i.test(text)) return { type: "portfolio_check" };
  return { type: "unknown" };
}

// ── Response Generator ───────────────────────────────────────────
function generateResponse(
  intent: Intent,
  wallet: WalletSnapshot,
  liveYield?: LiveYield
): { text: string; actions?: ActionCard[] } {
  const sol = wallet.solBalance;
  const usdc = wallet.idleUSDC;
  const total = wallet.totalUSD;

  // Helper: get live APY or fallback
  const getAPY = (protocol: string, fallback: number) => {
    const found = liveYield?.opportunities.find(o => o.protocol === protocol);
    return found ? found.apy : fallback;
  };

  switch (intent.type) {
    case "stake_sol": {
      const amt = intent.amount ?? sol * 0.6;
      const marinadeAPY = getAPY("Marinade Finance", 7.2) / 100;
      const jitoAPY = getAPY("Jito", 7.5) / 100;
      return {
        text: `質押 **${amt.toFixed(2)} SOL** 到流動性質押協議，年化 ${(marinadeAPY * 100).toFixed(1)}-${(jitoAPY * 100).toFixed(1)}%，mSOL/jitoSOL 可繼續用於 DeFi：`,
        actions: [
          { protocol: "Marinade Finance", icon: "🫙", action: `質押 ${amt.toFixed(2)} SOL → mSOL`, detail: "全鏈最大 SOL 質押協議，流動性最好", apy: `${(marinadeAPY * 100).toFixed(1)}%`, estimatedEarn: `+${(amt * marinadeAPY).toFixed(3)} SOL/年`, url: "https://marinade.finance/", color: "#8B5CF6", riskLevel: "低" },
          { protocol: "Jito", icon: "🫙", action: `質押 ${amt.toFixed(2)} SOL → jitoSOL`, detail: "含 MEV 獎励，APY 略高於 Marinade", apy: `${(jitoAPY * 100).toFixed(1)}%`, estimatedEarn: `+${(amt * jitoAPY).toFixed(3)} SOL/年`, url: "https://www.jito.network/staking/", color: "#06B6D4", riskLevel: "低" },
        ],
      };
    }
    case "deposit_usdc": {
      const amt = intent.amount ?? usdc;
      const kaminoAPY = getAPY("Kamino Finance", 8.2) / 100;
      const solendAPY = getAPY("Save (Solend)", 5.5) / 100;
      return {
        text: `將 **$${amt.toFixed(0)} USDC** 存入借貸協議，穩定獲取利息，無價格風險：`,
        actions: [
          { protocol: "Kamino Finance", icon: "🌿", action: `存入 $${amt.toFixed(0)} USDC`, detail: "自動复利，利率随市場波動", apy: `${(kaminoAPY * 100).toFixed(1)}%`, estimatedEarn: `$${(amt * kaminoAPY / 12).toFixed(1)}/月`, url: "https://app.kamino.finance/", color: "#10B981", riskLevel: "低" },
          { protocol: "Save (Solend)", icon: "🏦", action: `存入 $${amt.toFixed(0)} USDC`, detail: "Solana 最老牌借貸協議，合約經過多次審計", apy: `${(solendAPY * 100).toFixed(1)}%`, estimatedEarn: `$${(amt * solendAPY / 12).toFixed(1)}/月`, url: "https://save.finance/", color: "#3B82F6", riskLevel: "低" },
          { protocol: "Marginfi", icon: "💎", action: `存入 $${amt.toFixed(0)} USDC`, detail: "支持跨保證金，功能最丰富", apy: "~6.5%", estimatedEarn: `$${(amt * 0.065 / 12).toFixed(1)}/月`, url: "https://app.marginfi.com/", color: "#F59E0B", riskLevel: "低" },
        ],
      };
    }
    case "swap":
      return {
        text: `⚡ **Swap 執行** — 將 ${intent.amount ?? 10} ${intent.from} 換成 ${intent.to}，透過 Jupiter 最優路由執行`,
        actions: [{
          protocol: "Jupiter Swap",
          icon: "⚡",
          action: `${intent.amount ?? 10} ${intent.from} → ${intent.to}`,
          detail: "Jupiter 聚合路由，0.3% 平台費",
          apy: "",
          estimatedEarn: "",
          url: `https://jup.ag/swap/${intent.from}-${intent.to}`,
          color: "#8B5CF6",
          riskLevel: "低",
        }],
      };
    case "yield_find":
      return buildYieldResponse(sol, usdc, total, liveYield);
    case "portfolio_check":
      return { text: `你的錢包總資產 **$${total.toFixed(0)}**，含 **${sol.toFixed(3)} SOL** + **$${usdc.toFixed(0)} USDC** 閒置。切換到「🏥 錢包体檢」Tab 查看完整報告。\n\n用我做什麼操作？` };
    case "analyze_token":
      return { text: `切換到「🌸 代幣分析」Tab，貼上合約地址 **${intent.mint.slice(0, 8)}...** 即可獲得安全評分和買入建議。` };
    case "rug_check":
      return { text: `檢測 **$${intent.token}** 安全性：切換到「🌸 代幣分析」Tab，輸入合約地址，Sakura 將檢測增發權限、持幣集中度、蜜罐等 5 項風險。` };
    default:
      return { text: `我可以幫你：\n\n💰 **收益** — "幫我質押 2 SOL" / "USDC 存哪里利息最高"\n🌸 **安全** — "分析這個代幣 [地址]"\n💱 **交易** — "把 1 SOL 換成 USDC"\n🌸 **資產** — "查看我的收益机会"`, actions: [] };
  }
}

function buildYieldResponse(
  sol: number,
  usdc: number,
  total: number,
  liveYield?: LiveYield
): { text: string; actions: ActionCard[] } {
  const getAPY = (protocol: string, fallback: number) => {
    const found = liveYield?.opportunities.find(o => o.protocol === protocol);
    return found ? found.apy / 100 : fallback / 100;
  };

  const marinadeAPY = getAPY("Marinade Finance", 7.2);
  const kaminoAPY = getAPY("Kamino Finance", 8.2);
  const solPrice = sol > 0 && total > 0 ? total / sol : 180;

  const actions: ActionCard[] = [];
  if (sol > 0.1) {
    actions.push({
      protocol: "Marinade Finance", icon: "🫙",
      action: `質押 ${(sol * 0.6).toFixed(2)} SOL`,
      detail: `流動性質押，獲得 mSOL，当前 APY ${(marinadeAPY * 100).toFixed(1)}%`,
      apy: `${(marinadeAPY * 100).toFixed(1)}%`,
      estimatedEarn: `$${(sol * 0.6 * marinadeAPY * solPrice).toFixed(0)}/年`,
      url: "https://marinade.finance/", color: "#8B5CF6", riskLevel: "低",
    });
  }
  if (usdc > 5) {
    actions.push({
      protocol: "Kamino Finance", icon: "🌿",
      action: `存入 $${usdc.toFixed(0)} USDC`,
      detail: `USDC 借貸自動复利，当前 APY ${(kaminoAPY * 100).toFixed(1)}%`,
      apy: `${(kaminoAPY * 100).toFixed(1)}%`,
      estimatedEarn: `$${(usdc * kaminoAPY / 12).toFixed(1)}/月`,
      url: "https://app.kamino.finance/", color: "#10B981", riskLevel: "低",
    });
  }
  if (sol > 0.5 && usdc > 10) {
    actions.push({
      protocol: "Raydium CLMM", icon: "🌊",
      action: "SOL-USDC 集中流動性",
      detail: "在指定價格区間做市，手續費收益高但有無常損失風險",
      apy: "15–30%", estimatedEarn: "收益随市場波動",
      url: "https://raydium.io/liquidity/", color: "#F59E0B", riskLevel: "中",
    });
  }
  const text = actions.length > 0
    ? `基於你的錢包（SOL: ${sol.toFixed(3)}，USDC: $${usdc.toFixed(0)}），以下是實時最優收益机会，按風險由低到高：`
    : "你的錢包餘額較少，建議先積累更多 SOL/USDC 再進行 DeFi 操作。";
  return { text, actions };
}

// ── Opportunity Panel (auto-shown) ───────────────────────────────
function OpportunityPanel({
  wallet, liveYield, onSwap, onStake, onLend,
}: {
  wallet: WalletSnapshot;
  liveYield?: LiveYield;
  onSwap: (p: { from: string; to: string; amount: number }) => void;
  onStake: (p: { protocol: "marinade" | "jito"; amount: number }) => void;
  onLend: (p: { protocol: "kamino" | "solend"; amount: number }) => void;
}) {
  const { actions } = buildYieldResponse(wallet.solBalance, wallet.idleUSDC, wallet.totalUSD, liveYield);
  if (actions.length === 0) return null;

  const marinadeAPY = liveYield?.opportunities.find(o => o.protocol === "Marinade Finance")?.apy ?? 7.2;
  const kaminoAPY = liveYield?.opportunities.find(o => o.protocol === "Kamino Finance")?.apy ?? 8.2;
  const solPrice = wallet.solBalance > 0 ? wallet.totalUSD / wallet.solBalance : 180;
  const totalAnnual =
    (wallet.solBalance * 0.6 * (marinadeAPY / 100) * solPrice) +
    wallet.idleUSDC * (kaminoAPY / 100);

  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 12,
      }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
          🪷 為你發現的收益机会
        </div>
        {totalAnnual > 0 && (
          <div style={{
            fontSize: 12, color: "#10B981",
            background: "#10B98115", border: "1px solid #10B98130",
            borderRadius: 8, padding: "4px 10px",
          }}>
            预計年收益 +${totalAnnual.toFixed(0)}
          </div>
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {actions.map((a, i) => <ActionCardView key={i} action={a} onSwap={onSwap} onStake={onStake} onLend={onLend} />)}
      </div>
    </div>
  );
}

// ── Quick Actions (sub populated dynamically with live APY) ──────
const QUICK_ACTION_DEFS: Array<{
  icon: string; label: string; protocol: string | null;
  fallbackSub: string; color: string; prompt: string | null;
}> = [
  { icon: "🫙", label: "質押 SOL",    protocol: "Marinade Finance", fallbackSub: "Marinade / Jito",    color: "#8B5CF6", prompt: "幫我質押 SOL 獲取最高收益" },
  { icon: "🌿", label: "USDC 理财",   protocol: "Kamino Finance",   fallbackSub: "Kamino Finance",     color: "#10B981", prompt: "我的 USDC 存哪里利息最高" },
  { icon: "🌊", label: "代幣兑換",    protocol: null,               fallbackSub: "Jupiter 最優路由",   color: "#06B6D4", prompt: "把 1 SOL 換成 USDC" },
  { icon: "🪷", label: "收益机会",    protocol: null,               fallbackSub: "全部 DeFi 机会排行", color: "#F59E0B", prompt: "给我看所有收益机会" },
  { icon: "🐋", label: "聰明錢追蹤",  protocol: null,               fallbackSub: "24h 共識買入信號",   color: "#C0392B", prompt: null },
  { icon: "🏭", label: "Agent Workshop", protocol: null,            fallbackSub: "自然語言創建 Agent", color: "#8B5CF6", prompt: null },
];

// ── Suggestion Chips ─────────────────────────────────────────────
const SUGGESTIONS = [
  "幫我質押 SOL 獲取最高收益",
  "我的 USDC 存哪里利息最高",
  "把 1 SOL 換成 USDC",
  "给我看所有收益机会",
];

// ── Main Component ───────────────────────────────────────────────
export default function DefiAssistant({ walletAddress, walletSnapshot }: Props) {
  const { t } = useLang();
  const [wallet, setWallet] = useState<WalletSnapshot>(
    walletSnapshot ?? { solBalance: 0, totalUSD: 0, idleUSDC: 0 }
  );
  const [loadingWallet, setLoadingWallet] = useState(!walletSnapshot);
  const [liveYield, setLiveYield] = useState<LiveYield | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessionSummary, setSessionSummary] = useState<string | undefined>(undefined);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [swapModal, setSwapModal]   = useState<{ from: string; to: string; amount: number } | null>(null);
  const [stakeModal, setStakeModal] = useState<{ protocol: "marinade" | "jito"; amount: number } | null>(null);
  const [lendModal, setLendModal]   = useState<{ protocol: "kamino" | "solend"; amount: number } | null>(null);
  const [lastActions, setLastActions] = useState<ActionCard[] | null>(null);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const [thinkingText, setThinkingText] = useState<string>("");
  const [thinkingOpen, setThinkingOpen] = useState(false);
  const [advisorQuota, setAdvisorQuota] = useState<{ remaining: number; used: number; admin?: boolean } | null>(null);
  const [advisorPaymentSig, setAdvisorPaymentSig] = useState<string | null>(null);
  const [showSmartMoney, setShowSmartMoney]       = useState(false);
  const [showAgentFactory, setShowAgentFactory]   = useState(false);
  const lastYieldRef = useRef<LiveYield | null>(null);
  const lastAlertTimestampRef = useRef<number>(0);

  // Auto-dismiss toast after 8 seconds
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 8000);
    return () => clearTimeout(t);
  }, [toast]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const memorySavedRef = useRef(false);

  // Load chat history on mount
  useEffect(() => {
    const memory = loadChatMemory(walletAddress);
    if (memory && memory.messages.length > 0) {
      const loaded: Message[] = memory.messages.map((m, i) => ({
        id: i,
        role: m.role,
        text: m.text,
      }));
      setMessages(loaded);
      if (memory.sessionSummary) setSessionSummary(memory.sessionSummary);
      // Welcome-back message
      // Use sessionSummary if available; otherwise find last real user message
      // (skip any previously-saved welcome-back messages to prevent nesting)
      const lastRealMsg = memory.messages
        .filter(m => !m.text.startsWith("歡迎回來！上次我們讨論了"))
        .slice(-1)[0];
      const preview = memory.sessionSummary
        ? memory.sessionSummary.slice(0, 60)
        : lastRealMsg?.text?.slice(0, 40) ?? "";
      if (preview) {
        setMessages(prev => [...prev, {
          id: Date.now(),
          role: "assistant",
          text: `歡迎回來！上次我們讨論了「${preview}…」，繼續吗？`,
        }]);
      }
    }
    memorySavedRef.current = true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletAddress]);

  // Save chat history whenever messages change
  useEffect(() => {
    if (!memorySavedRef.current) return;
    // Filter out: typing placeholders + welcome-back greetings (prevents nesting on reload)
    const real = messages.filter(
      m => !m.isTyping && !m.text.startsWith("歡迎回來！上次我們讨論了")
    );
    if (real.length === 0) return;
    saveChatMemory(walletAddress, {
      walletAddress,
      messages: real.map(m => ({ role: m.role, text: m.text, timestamp: m.id })),
      sessionSummary,
    });
  }, [messages, walletAddress, sessionSummary]);

  // Auto-fetch wallet data if not provided
  // Fetch advisor quota on mount
  useEffect(() => {
    const deviceId = getDeviceId();
    fetch(`/api/quota?features=advisor`, {
      headers: { "X-Device-ID": deviceId, "X-Wallet-Address": walletAddress ?? "" },
    })
      .then(r => r.json())
      .then(d => { if (d.advisor) setAdvisorQuota(d.advisor); })
      .catch(() => {});
  }, [walletAddress]);

  useEffect(() => {
    if (walletSnapshot) {
      setWallet(walletSnapshot);
      setLoadingWallet(false);
      return;
    }
    fetch(`/api/wallet?address=${walletAddress}`)
      .then(r => r.json())
      .then(d => {
        if (!d.error) setWallet({ solBalance: d.solBalance, totalUSD: d.totalUSD, idleUSDC: d.idleUSDC });
      })
      .finally(() => setLoadingWallet(false));
  }, [walletAddress, walletSnapshot]);

  // Fetch live yield data from Agent Kit API
  useEffect(() => {
    fetch("/api/yield")
      .then(r => r.json())
      .then(d => { if (d.opportunities) setLiveYield(d); })
      .catch(() => {}); // non-fatal, fallback APY values used
  }, []);

  // ── APY monitoring: re-fetch every 5 minutes, alert on >0.5% change ──
  useEffect(() => {
    const check = () => {
      fetch("/api/yield")
        .then(r => r.json())
        .then((fresh: LiveYield) => {
          if (!fresh.opportunities) return;
          const prev = lastYieldRef.current;
          if (prev) {
            for (const opp of fresh.opportunities) {
              const old = prev.opportunities.find(o => o.protocol === opp.protocol);
              if (old && Math.abs(opp.apy - old.apy) >= 0.5) {
                const dir = opp.apy > old.apy ? "↑ 上涨" : "↓ 下降";
                const alertText = `${opp.protocol} APY ${dir} ${Math.abs(opp.apy - old.apy).toFixed(1)}%，現在 ${opp.apyDisplay}`;
                setToast({ id: Date.now(), text: alertText });
                setMessages(prev => [...prev, {
                  id: Date.now(),
                  role: "assistant",
                  text: `🪭 **主動提醒** — ${alertText}。要調整持倉吗？`,
                  isAgentInitiated: true,
                }]);
                break; // alert once per cycle
              }
            }
          }
          lastYieldRef.current = fresh;
          setLiveYield(fresh);
        })
        .catch(() => {});
    };
    const interval = setInterval(check, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // ── Guardian cron alerts polling: poll /api/cron/alerts every 5 min ──
  useEffect(() => {
    const check = () => {
      const since = lastAlertTimestampRef.current;
      fetch(`/api/cron/alerts${since > 0 ? `?since=${since}` : ""}`)
        .then(r => r.json())
        .then((data: { alerts: Array<{ id: string; message: string; timestamp: number; severity: string }>; count: number }) => {
          if (!data.alerts || data.count === 0) return;
          for (const alert of data.alerts.slice(0, 3)) {
            const emoji = alert.severity === "critical" ? "🚨" : alert.severity === "warning" ? "⚠️" : "🪭";
            setToast({ id: alert.timestamp, text: alert.message });
            setMessages(prev => [...prev, {
              id: alert.timestamp,
              role: "assistant",
              text: `${emoji} **Guardian Alert** — ${alert.message}。要調整持倉吗？`,
              isAgentInitiated: true,
            }]);
            if (alert.timestamp > lastAlertTimestampRef.current) {
              lastAlertTimestampRef.current = alert.timestamp;
            }
          }
        })
        .catch(() => {});
    };
    // Stagger: run 2.5 min after APY check
    const interval = setInterval(check, 5 * 60 * 1000);
    const delay = setTimeout(check, 2.5 * 60 * 1000);
    return () => { clearInterval(interval); clearTimeout(delay); };
  }, []);

  // ── Watchlist price monitoring: re-fetch every 5 min + 30s offset ──
  useEffect(() => {
    const fetchPrice = async (mint: string): Promise<number | null> => {
      // Jupiter v2 first
      try {
        const r = await fetch(`https://api.jup.ag/price/v2?ids=${mint}`);
        if (r.ok) {
          const d = await r.json() as { data?: Record<string, { price?: string }> };
          const p = d?.data?.[mint]?.price;
          if (p) return parseFloat(p);
        }
      } catch { /* fall through */ }
      // DexScreener fallback
      try {
        const r = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`);
        if (r.ok) {
          const d = await r.json() as { pairs?: Array<{ priceUsd?: string; liquidity?: { usd?: number } }> };
          const pairs = (d?.pairs ?? [])
            .filter(p => p.priceUsd && parseFloat(p.priceUsd) > 0)
            .sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0));
          const best = pairs[0]?.priceUsd;
          if (best) return parseFloat(best);
        }
      } catch { /* ignore */ }
      return null;
    };

    const check = async () => {
      const watchlist = getWatchlist();
      let updated = false;
      for (const token of watchlist.slice(0, 5)) {
        const newPrice = await fetchPrice(token.mint);
        if (newPrice === null) continue;
        const prev = token.lastKnownPrice ?? token.price;
        if (prev !== null && prev !== undefined) {
          const changePct = Math.abs(newPrice - prev) / prev * 100;
          if (changePct >= 10) {
            const dir = newPrice > prev ? "🚀 上涨" : "📉 下跌";
            const alertText = `${token.symbol} ${dir} ${changePct.toFixed(1)}%，現價 $${newPrice.toFixed(4)}`;
            setToast({ id: Date.now(), text: alertText });
            setMessages(p => [...p, {
              id: Date.now(), role: "assistant",
              text: `🪭 **價格提醒** — ${alertText}。要查看详情或操作吗？`,
              isAgentInitiated: true,
            }]);
          }
        }
        saveLastPrice(token.mint, newPrice);
        updated = true;
      }
      // Refresh sidebar prices if any changed
      if (updated) {
        // TokenAnalysis sidebar reads from localStorage directly; no shared state to update here
      }
    };

    // Run immediately on mount to fill in any null prices, then every 5 min
    check();
    const interval = setInterval(check, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function isExecuteIntent(text: string): boolean {
    return /^(執行|確認|好的?|可以|做吧|行|就這樣|開始|go|yes|ok|好的執行|確認執行)[\s!！。]*$/i.test(text.trim())
      || /^(執行|用|選|要)\s*(marinade|jito|kamino|solend|第一個|第二個|這個)/i.test(text.trim());
  }

  function openActionModal(action: ActionCard) {
    const stakeProtocol = STAKE_PROTOCOLS[action.protocol];
    const lendProtocol  = LEND_PROTOCOLS[action.protocol];
    const amountMatch   = action.action.match(/([\d,.]+)/);
    const amount        = amountMatch ? parseFloat(amountMatch[1].replace(",", "")) : 1;

    if (stakeProtocol) {
      setStakeModal({ protocol: stakeProtocol, amount });
    } else if (lendProtocol) {
      setLendModal({ protocol: lendProtocol, amount });
    } else if (action.protocol === "Jupiter Swap") {
      const m = action.action.match(/^([\d.]+)\s*([A-Z]+)\s*[→>]\s*([A-Z]+)/i);
      if (m) setSwapModal({ from: m[2].toUpperCase(), to: m[3].toUpperCase(), amount: parseFloat(m[1]) });
    }
  }

  async function sendMessage(text: string) {
    if (!text.trim() || loading) return;

    // ── Execute intent: user replied "執行" / "好" after AI gave action cards ──
    if (isExecuteIntent(text) && lastActions && lastActions.length > 0) {
      const lower = text.toLowerCase();
      // Try to match a specific protocol name, else pick first
      const target =
        lastActions.find(a => {
          const key = a.protocol.toLowerCase().split(" ")[0];
          return lower.includes(key);
        }) ??
        (lower.includes("第二") ? lastActions[1] : null) ??
        lastActions[0];

      const label = STAKE_PROTOCOLS[target.protocol] ? "質押"
        : LEND_PROTOCOLS[target.protocol] ? "存入"
        : "兑換";

      const userMsg: Message   = { id: Date.now(),     role: "user",      text: text.trim() };
      const confirmMsg: Message = { id: Date.now() + 1, role: "assistant", text: `好的，正在打開 **${target.protocol}** ${label}...` };
      setMessages(prev => [...prev, userMsg, confirmMsg]);
      setInput("");
      setLastActions(null);
      openActionModal(target);
      return;
    }

    const userMsg: Message = { id: Date.now(), role: "user", text: text.trim() };
    const assistantId = Date.now() + 1;
    const typingMsg: Message = { id: assistantId, role: "assistant", text: "", isTyping: true, thinkingStep: "..." };
    setMessages(prev => [...prev, userMsg, typingMsg]);
    setInput("");
    setLastActions(null);
    setLoading(true);

    setThinkingText("");
    setThinkingOpen(false);

    try {
      const deviceId = getDeviceId();
      const history = messages
        .filter(m => !m.isTyping)
        .slice(-8)
        .map(m => ({ role: m.role, content: m.text }));

      const loopHeaders: Record<string, string> = {
        "Content-Type": "application/json",
        "X-Device-ID": deviceId,
        "X-Wallet-Address": walletAddress ?? "",
      };
      if (advisorPaymentSig) loopHeaders["X-PAYMENT"] = advisorPaymentSig;

      const loopBody = JSON.stringify({
        message: text.trim(), walletAddress,
        walletSnapshot: wallet, history, sessionSummary,
      });

      let res = await fetch("/api/agent/loop", {
        method: "POST", headers: loopHeaders, body: loopBody,
      });

      // Quota exhausted — trigger $0.50 USDC payment then retry
      if (res.status === 402 && !advisorPaymentSig) {
        const challenge = await res.json();
        const payResult = await payWithPhantom({
          recipient: challenge.recipient ?? SOLIS_FEE_WALLET_ADDR,
          amount: challenge.amount ?? 0.50,
          currency: "USDC",
          network: "solana-mainnet",
          description: "Sakura AI 顾问会話 0.50 USDC",
        });
        if ("error" in payResult) {
          setMessages(prev => prev.map(m =>
            m.id === assistantId
              ? { ...m, text: `❌ 支付失败: ${payResult.error}`, isTyping: false }
              : m
          ));
          setLoading(false);
          return;
        }
        setAdvisorPaymentSig(payResult.sig);
        setAdvisorQuota(q => q ? { ...q, remaining: 0, used: 3 } : null);
        res = await fetch("/api/agent/loop", {
          method: "POST",
          headers: { ...loopHeaders, "X-PAYMENT": payResult.sig },
          body: loopBody,
        });
      }

      // Update quota display after free use
      if (!advisorPaymentSig) {
        setAdvisorQuota(q => q ? { ...q, remaining: Math.max(0, (q.remaining ?? 1) - 1), used: (q.used ?? 0) + 1 } : null);
      }

      if (!res.ok || !res.body) throw new Error("stream failed");

      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let accText = "";
      let accThinking = "";
      let accStrategyCards: StrategyCard[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";

        let event = "";
        for (const line of lines) {
          if (line.startsWith("event: ")) {
            event = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            try {
              const parsed = JSON.parse(line.slice(6));

              if (event === "strategy_card") {
                accStrategyCards = [...accStrategyCards, parsed as StrategyCard];
                setMessages(prev => prev.map(m =>
                  m.id === assistantId
                    ? { ...m, isTyping: true, thinkingStep: `🌸 策略卡片：${(parsed as StrategyCard).asset}` }
                    : m
                ));
              } else if (event === "thinking_delta") {
                accThinking += parsed.text as string;
                setThinkingText(accThinking);
                setMessages(prev => prev.map(m =>
                  m.id === assistantId
                    ? { ...m, isTyping: true, thinkingStep: "🌿 思考中..." }
                    : m
                ));
              } else if (event === "thinking") {
                // Legacy format from defi-chat route
                setMessages(prev => prev.map(m =>
                  m.id === assistantId
                    ? { ...m, isTyping: true, thinkingStep: parsed.step }
                    : m
                ));
              } else if (event === "tool_call") {
                setMessages(prev => prev.map(m =>
                  m.id === assistantId
                    ? { ...m, isTyping: true, thinkingStep: `🔧 ${parsed.name}...` }
                    : m
                ));
              } else if (event === "tool_result") {
                setMessages(prev => prev.map(m =>
                  m.id === assistantId
                    ? { ...m, isTyping: true, thinkingStep: `✓ ${parsed.name}` }
                    : m
                ));
              } else if (event === "token") {
                accText += parsed.text as string;
                const snap = accText;
                setMessages(prev => prev.map(m =>
                  m.id === assistantId
                    ? { ...m, isTyping: false, isStreaming: true, thinkingStep: undefined, text: snap }
                    : m
                ));
              } else if (event === "done") {
                const newActions: ActionCard[] | undefined = parsed.actions;
                const newStrategyCards: StrategyCard[] = parsed.strategyCards ?? accStrategyCards;
                if (newActions && newActions.length > 0) setLastActions(newActions);
                if (parsed.sessionSummary) setSessionSummary(parsed.sessionSummary);
                setMessages(prev => prev.map(m =>
                  m.id === assistantId
                    ? {
                        ...m,
                        isTyping: false,
                        isStreaming: false,
                        thinkingStep: undefined,
                        text: accText || "抱歉，暂時無法回答，請稍后重試。",
                        actions: newActions,
                        strategyCards: newStrategyCards.length > 0 ? newStrategyCards : undefined,
                        reasoningHash: parsed.reasoningHash,
                        memoPayload: parsed.memoPayload,
                        aiAvailable: parsed.aiAvailable,
                      }
                    : m
                ));
              } else if (event === "error") {
                setMessages(prev => prev.map(m =>
                  m.id === assistantId
                    ? { ...m, isTyping: false, isStreaming: false, text: parsed.message ?? "發生错誤，請重試。" }
                    : m
                ));
              }
            } catch { /* ignore parse errors */ }
          }
        }
      }
    } catch {
      setMessages(prev => prev.map(m =>
        m.id === assistantId
          ? { ...m, isTyping: false, isStreaming: false, text: "网絡错誤，請稍后重試。" }
          : m
      ));
    } finally {
      setLoading(false);
    }
  }

  function exportAnalysis() {
    const assistantMessages = messages.filter(m => m.role === "assistant");
    if (assistantMessages.length === 0) return;

    const content = assistantMessages.map((m, i) =>
      `<div class="msg"><div class="num">${i + 1}</div><div class="text">${
        m.text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
               .replace(/\n/g, '<br>')
      }</div></div>`
    ).join('');

    const html = `<!DOCTYPE html><html><head>
    <meta charset="utf-8">
    <title>Sakura AI 分析報告 · ${new Date().toLocaleDateString('zh-TW')}</title>
    <style>
      body { font-family: 'Noto Sans JP', 'Noto Serif TC', serif; max-width: 800px; margin: 40px auto; color: #1a1a1a; line-height: 1.8; }
      h1 { font-size: 22px; border-bottom: 2px solid #C0392B; padding-bottom: 10px; color: #C0392B; }
      .meta { font-size: 12px; color: #888; margin-bottom: 30px; }
      .msg { margin-bottom: 24px; padding: 16px; border-left: 3px solid #C0392B; background: #fafaf8; }
      .num { font-size: 11px; color: #C0392B; font-weight: 700; margin-bottom: 6px; }
      .text { font-size: 14px; }
      strong { color: #C0392B; }
      @media print { body { margin: 20px; } }
    </style>
  </head><body>
    <h1>🌸 Sakura AI 分析報告</h1>
    <div class="meta">生成時間：${new Date().toLocaleString('zh-TW')} · Powered by Claude Sonnet 4.6</div>
    ${content}
    <div style="margin-top:40px;font-size:11px;color:#aaa;text-align:center">Sakura — Solana DeFi AI 顧問 · sakura.finance</div>
  </body></html>`;

    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 500); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>

      {/* ── Toast notification ── */}
      {toast && (
        <div
          key={toast.id}
          style={{
            position: "fixed", bottom: 80, right: 20, zIndex: 100,
            background: "var(--bg-card)", border: "1px solid #8B5CF660",
            borderRadius: 12, padding: "12px 16px",
            maxWidth: 320, fontSize: 12, color: "var(--text-primary)",
            boxShadow: "0 4px 24px #8B5CF620",
            display: "flex", gap: 10, alignItems: "flex-start",
            animation: "slideIn 0.3s ease-out",
          }}
        >
          <span style={{ flexShrink: 0 }}>⚙️</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, color: "#8B5CF6", marginBottom: 2, fontSize: 10 }}>
              SOLIS AGENT
            </div>
            {toast.text}
          </div>
          <button
            onClick={() => setToast(null)}
            style={{
              background: "none", border: "none", color: "var(--text-secondary)",
              cursor: "pointer", fontSize: 12, flexShrink: 0,
            }}
          >✕</button>
        </div>
      )}

      {/* ── Live Deliberation Stream (Interleaved Thinking) ── */}
      {loading && thinkingText && (
        <div style={{
          background: "var(--bg-card)", border: "1px solid #8B5CF640",
          borderRadius: 12, marginBottom: 12, overflow: "hidden",
        }}>
          <button
            onClick={() => setThinkingOpen(o => !o)}
            style={{
              width: "100%", background: "none", border: "none", cursor: "pointer",
              padding: "10px 14px", display: "flex", alignItems: "center", gap: 8,
              color: "#8B5CF6", fontSize: 11, fontWeight: 700, textAlign: "left",
            }}
          >
            <span style={{ animation: "pulse 1.5s infinite", display: "inline-block" }}>🌿</span>
            Sakura 正在思考... ({thinkingText.length} chars)
            <span style={{ marginLeft: "auto", color: "var(--text-secondary)" }}>{thinkingOpen ? "▲" : "▼"}</span>
          </button>
          {thinkingOpen && (
            <div style={{
              padding: "0 14px 12px", fontSize: 11, color: "var(--text-secondary)",
              lineHeight: 1.7, whiteSpace: "pre-wrap", maxHeight: 200, overflowY: "auto",
              borderTop: "1px solid var(--border)",
            }}>
              {thinkingText}
            </div>
          )}
        </div>
      )}

      {/* ── Wallet summary bar ── */}
      {!loadingWallet && (
        <div className="wallet-summary" style={{
          display: "flex", gap: 16, padding: "12px 16px",
          background: "var(--bg-card)", border: "1px solid var(--border)",
          borderRadius: 12, marginBottom: 20,
        }}>
          <SummaryPill label={t("totalAssets")} value={`$${wallet.totalUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} color="var(--text-primary)" />
          <div style={{ width: 1, background: "var(--border)" }} />
          <SummaryPill label="SOL" value={`${wallet.solBalance.toFixed(3)}`} color="#8B5CF6" />
          <div style={{ width: 1, background: "var(--border)" }} />
          <SummaryPill label="USDC" value={`$${wallet.idleUSDC.toFixed(0)}`} color={wallet.idleUSDC > 10 ? "#F59E0B" : "#475569"} />
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
            {liveYield && (
              <span style={{
                fontSize: 10, color: "#10B981",
                background: "#10B98115", border: "1px solid #10B98130",
                borderRadius: 10, padding: "2px 8px",
              }}>
                ● 實時 APY
              </span>
            )}
            {messages.length > 0 && (
              <button
                onClick={exportAnalysis}
                title="導出分析報告"
                style={{
                  padding: "4px 10px", borderRadius: 6, border: "1px solid var(--border)",
                  background: "var(--bg-card)", color: "var(--text-secondary)",
                  fontSize: 11, fontWeight: 600, cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 4,
                }}
              >
                📄 導出
              </button>
            )}
            {messages.length > 0 && (
              <button
                onClick={() => {
                  clearChatMemory(walletAddress);
                  setMessages([]);
                  setSessionSummary(undefined);
                  setLastActions(null);
                }}
                style={{
                  fontSize: 10, color: "var(--text-secondary)",
                  background: "transparent", border: "1px solid var(--border)",
                  borderRadius: 8, padding: "2px 8px", cursor: "pointer",
                }}
              >
                {t("clearHistory")}
              </button>
            )}
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
            </span>
          </div>
        </div>
      )}

      {loadingWallet && (
        <div style={{
          padding: 16, background: "var(--bg-card)", border: "1px solid var(--border)",
          borderRadius: 12, marginBottom: 20, fontSize: 13, color: "var(--text-secondary)",
        }}>
          {t("scanning")}
        </div>
      )}

      {/* ── Auto opportunity panel ── */}
      {!loadingWallet && messages.length === 0 && (
        <OpportunityPanel wallet={wallet} liveYield={liveYield ?? undefined} onSwap={setSwapModal} onStake={setStakeModal} onLend={setLendModal} />
      )}

      {/* ── Chat messages ── */}
      {messages.length > 0 && (
        <div style={{
          flex: 1, overflowY: "auto", padding: "4px 0",
          display: "flex", flexDirection: "column", gap: 14,
          maxHeight: "55vh", marginBottom: 16,
        }}>
          {messages.map(msg => (
            <div key={msg.id} style={{
              display: "flex",
              justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
            }}>
              <div style={{ maxWidth: "88%", display: "flex", flexDirection: "column", gap: 8 }}>
                <div style={{
                  padding: "11px 15px",
                  background: msg.role === "user"
                    ? "var(--accent)"
                    : "var(--bg-card)",
                  border: msg.role === "user" ? "none" : "1px solid var(--border)",
                  borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                  fontSize: 13, color: "var(--text-primary)", lineHeight: 1.7,
                }}>
                  {msg.isTyping ? (
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      {[0, 1, 2].map(i => (
                        <div key={i} style={{
                          width: 6, height: 6, borderRadius: "50%", background: "#8B5CF6",
                          animation: `bounce 1s ease-in-out ${i * 0.15}s infinite`,
                        }} />
                      ))}
                      {msg.thinkingStep && msg.thinkingStep !== "..." && (
                        <span style={{ fontSize: 10, color: "#8B5CF6", marginLeft: 2 }}>
                          {msg.thinkingStep}
                        </span>
                      )}
                    </div>
                  ) : (
                    <>
                      <MarkdownText text={msg.text} />
                      {msg.isStreaming && (
                        <span className="streaming-cursor" />
                      )}
                    </>
                  )}
                </div>
                {msg.strategyCards && msg.strategyCards.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {msg.strategyCards.map((card, i) => (
                      <StrategyCardView key={i} card={card} />
                    ))}
                  </div>
                )}
                {msg.actions && msg.actions.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {msg.actions.map((a, i) => (
                      <ActionCardView key={i} action={a} onSwap={setSwapModal} onStake={setStakeModal} onLend={setLendModal} />
                    ))}
                  </div>
                )}
                {msg.role === "assistant" && !msg.isTyping && msg.reasoningHash && (
                  <ReasoningBox
                    reasoningHash={msg.reasoningHash}
                    memoPayload={msg.memoPayload ?? ""}
                    isStreaming={false}
                  />
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}

      {/* ── Quick action grid ── */}
      {messages.length === 0 && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 10 }}>{t("agentsTitle")}</div>
          <div className="quick-actions-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
            {QUICK_ACTION_DEFS.map(qa => {
              const liveOpp = qa.protocol
                ? liveYield?.opportunities.find(o => o.protocol === qa.protocol)
                : null;
              const sub = liveOpp
                ? `${qa.protocol?.split(" ")[0]}，APY ${liveOpp.apyDisplay}`
                : qa.fallbackSub;
              const isSmartMoney    = qa.label === "聰明錢追蹤";
              const isAgentFactory = qa.label === "Agent Workshop";
              const isToggle       = qa.prompt === null;
              const isActive       = (isSmartMoney && showSmartMoney) || (isAgentFactory && showAgentFactory);
              return (
                <button
                  key={qa.label}
                  onClick={() => {
                    if (isSmartMoney)    { setShowSmartMoney(v => !v); setShowAgentFactory(false); }
                    else if (isAgentFactory) { setShowAgentFactory(v => !v); setShowSmartMoney(false); }
                    else if (!isToggle)  sendMessage(qa.prompt!);
                  }}
                  style={{
                    background: isActive ? "var(--accent-soft)" : "var(--bg-card)",
                    border: `1px solid ${isActive ? "var(--accent)" : qa.color + "30"}`,
                    borderRadius: 10, padding: "12px 14px",
                    display: "flex", alignItems: "center", gap: 10,
                    cursor: "pointer", textAlign: "left",
                    transition: "all 0.15s",
                  }}
                >
                  <span style={{ fontSize: 20 }}>{qa.icon}</span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: isActive ? "var(--accent)" : qa.color }}>{qa.label}</div>
                    <div style={{ fontSize: 10, color: "var(--text-secondary)", marginTop: 2 }}>{sub}</div>
                  </div>
                </button>
              );
            })}
          </div>

          <div style={{
            display: "flex", gap: 8, flexWrap: "wrap",
            paddingTop: 12, marginTop: 4,
          }}>
            {SUGGESTIONS.map(s => (
              <button key={s} onClick={() => sendMessage(s)} style={{
                background: "var(--bg-base)", border: "1px solid var(--border)",
                borderRadius: 20, padding: "5px 12px",
                fontSize: 11, color: "#8B5CF6", cursor: "pointer",
              }}>{s}</button>
            ))}
          </div>
        </div>
      )}

      {/* ── Smart Money Panel ── */}
      {messages.length === 0 && showSmartMoney && <SmartMoneyPanel walletAddress={walletAddress} />}

      {/* ── Agent Workshop Panel ── */}
      {messages.length === 0 && showAgentFactory && <AgentFactory />}

      {/* ── Quota / session notice ── */}
      {advisorQuota && !advisorQuota.admin && messages.length === 0 && (
        <div style={{
          background: "var(--bg-card-2)",
          border: "1px solid #8B5CF640",
          borderRadius: 12, padding: "14px 16px", marginBottom: 10,
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
        }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#8B5CF6", marginBottom: 2 }}>
              ⚙️ AI 顾问 — Claude Sonnet 4.6
            </div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
              {advisorQuota.remaining > 0
                ? <>還剩 <strong style={{ color: "#10B981" }}>{advisorQuota.remaining}/3</strong> 次免費 · 超出后每次 <strong style={{ color: "var(--text-primary)" }}>0.50 USDC</strong></>
                : <>免費次數已用完 · 發送消息時自動支付 <strong style={{ color: "var(--text-primary)" }}>0.50 USDC</strong></>}
            </div>
          </div>
          <span style={{
            fontSize: 11, fontWeight: 700,
            color: advisorQuota.remaining > 0 ? "#10B981" : "#8B5CF6",
            background: advisorQuota.remaining > 0 ? "#10B98120" : "#8B5CF620",
            border: `1px solid ${advisorQuota.remaining > 0 ? "#10B98140" : "#8B5CF640"}`,
            borderRadius: 6, padding: "3px 8px", whiteSpace: "nowrap",
          }}>
            {advisorQuota.remaining > 0 ? `🆓 ${advisorQuota.remaining}/3 次免費` : "💰 0.50 USDC/次"}
          </span>
        </div>
      )}
      {advisorPaymentSig && messages.length === 0 && (
        <div style={{
          fontSize: 11, color: "#10B981", textAlign: "center",
          padding: "6px 0 10px",
        }}>
          ✅ 已支付 · {advisorPaymentSig.slice(0, 12)}...
        </div>
      )}

      {/* ── Input ── */}
      <div style={{
        display: "flex", gap: 10,
        paddingTop: messages.length > 0 ? 12 : 0,
        borderTop: messages.length > 0 ? "1px solid var(--border)" : "none",
      }}>
        <input
          type="text" value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && sendMessage(input)}
          placeholder={t("messagePlaceholder")}
          disabled={loading}
          style={{
            flex: 1, padding: "12px 16px",
            background: "var(--bg-card)", border: "1px solid var(--border)",
            borderRadius: 12, fontSize: 13, color: "var(--text-primary)", outline: "none",
          }}
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={loading || !input.trim()}
          style={{
            padding: "12px 20px",
            background: loading || !input.trim() ? "var(--border)" : "var(--accent)",
            border: "none", borderRadius: 12, fontSize: 18,
            cursor: loading ? "not-allowed" : "pointer", color: "#fff",
          }}
        >↑</button>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: translateY(0); }
          40% { transform: translateY(-6px); }
        }
      `}</style>

      {swapModal && (
        <SwapModal
          from={swapModal.from}
          to={swapModal.to}
          amount={swapModal.amount}
          onClose={() => setSwapModal(null)}
        />
      )}

      {stakeModal && (
        <StakeModal
          protocol={stakeModal.protocol}
          amount={stakeModal.amount}
          onClose={() => setStakeModal(null)}
        />
      )}

      {lendModal && (
        <LendModal
          protocol={lendModal.protocol}
          amount={lendModal.amount}
          onClose={() => setLendModal(null)}
        />
      )}
    </div>
  );
}

// ── Action Card ──────────────────────────────────────────────────
// Map protocol names to modal types
const STAKE_PROTOCOLS: Record<string, "marinade" | "jito"> = {
  "Marinade Finance": "marinade",
  "Marinade":         "marinade",
  "Jito":             "jito",
};
// Marginfi excluded — no public REST deposit API, opens external link instead
const LEND_PROTOCOLS: Record<string, "kamino" | "solend"> = {
  "Kamino Finance": "kamino",
  "Kamino":         "kamino",
  "Save (Solend)":  "solend",
  "Solend":         "solend",
};

// ── Strategy Card View ────────────────────────────────────────────
function StrategyCardView({ card }: { card: StrategyCard }) {
  const ACTION_LABEL: Record<string, { label: string; color: string }> = {
    buy:    { label: "買入", color: "#10B981" },
    sell:   { label: "賣出", color: "#EF4444" },
    stake:  { label: "質押", color: "#8B5CF6" },
    lend:   { label: "借貸", color: "#06B6D4" },
    hold:   { label: "持有", color: "#F59E0B" },
    reduce: { label: "減倉", color: "#F97316" },
    swap:   { label: "兌換", color: "#3B82F6" },
  };
  const style = ACTION_LABEL[card.action] ?? { label: card.action.toUpperCase(), color: "#8B5CF6" };
  const confidenceColor = card.confidence >= 70 ? "#10B981" : card.confidence >= 50 ? "#F59E0B" : "#EF4444";

  return (
    <div style={{
      background: "var(--bg-base)",
      border: `1px solid ${style.color}30`,
      borderLeft: `3px solid ${style.color}`,
      borderRadius: 12,
      padding: "14px 16px",
      position: "relative",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{
            fontFamily: "var(--font-heading, 'Noto Serif JP', serif)",
            fontSize: 18, fontWeight: 600, color: "var(--text-primary)",
          }}>{card.asset}</span>
          <span style={{
            fontSize: 11, fontWeight: 700, color: style.color,
            background: `${style.color}15`, border: `1px solid ${style.color}35`,
            borderRadius: 4, padding: "2px 8px",
          }}>{style.label}</span>
          {card.timeHorizon && (
            <span style={{ fontSize: 10, color: "var(--text-secondary)" }}>⏱ {card.timeHorizon}</span>
          )}
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{
            fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
            fontSize: 18, fontWeight: 700, color: confidenceColor,
          }}>{card.confidence}%</div>
          <div style={{ fontSize: 9, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1 }}>信心</div>
        </div>
      </div>

      {/* Price levels grid */}
      {(card.entryLow || card.takeProfit1 || card.stopLoss) && (
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 10,
        }}>
          {card.entryLow && (
            <div style={{ background: "var(--bg-card)", borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
              <div style={{ fontSize: 9, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>入場</div>
              <div style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
                ${card.entryLow}{card.entryHigh && card.entryHigh !== card.entryLow ? `–${card.entryHigh}` : ""}
              </div>
            </div>
          )}
          {card.takeProfit1 && (
            <div style={{ background: "rgba(16,185,129,0.08)", borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
              <div style={{ fontSize: 9, color: "#10B981", textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>止盈</div>
              <div style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 13, fontWeight: 700, color: "#10B981" }}>
                ${card.takeProfit1}{card.takeProfit2 ? ` / $${card.takeProfit2}` : ""}
              </div>
            </div>
          )}
          {card.stopLoss && (
            <div style={{ background: "rgba(239,68,68,0.08)", borderRadius: 8, padding: "8px 10px", textAlign: "center" }}>
              <div style={{ fontSize: 9, color: "#EF4444", textTransform: "uppercase", letterSpacing: 1, marginBottom: 2 }}>止損</div>
              <div style={{ fontFamily: "var(--font-mono, monospace)", fontSize: 13, fontWeight: 700, color: "#EF4444" }}>
                ${card.stopLoss}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Thesis */}
      <div style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.6, marginBottom: 8 }}>
        {card.thesis}
      </div>

      {/* Allocation + Risk */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        {card.allocationPct && (
          <span style={{
            fontSize: 11, color: style.color,
            background: `${style.color}10`, border: `1px solid ${style.color}25`,
            borderRadius: 4, padding: "2px 8px", fontFamily: "var(--font-mono, monospace)",
          }}>倉位 {card.allocationPct}%</span>
        )}
        {card.riskFactors && card.riskFactors.map((r, i) => (
          <span key={i} style={{
            fontSize: 10, color: "var(--text-muted)",
            background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)",
            borderRadius: 4, padding: "2px 6px",
          }}>⚠ {r}</span>
        ))}
      </div>

      {/* Strategy card badge */}
      <div style={{
        position: "absolute", top: 10, right: 10,
        fontSize: 9, color: "var(--accent)",
        background: "var(--accent-soft)", border: "1px solid rgba(192,57,43,0.2)",
        borderRadius: 3, padding: "1px 5px", letterSpacing: 1, textTransform: "uppercase",
      }}>AI 策略</div>
    </div>
  );
}

function ActionCardView({
  action,
  onSwap,
  onStake,
  onLend,
}: {
  action: ActionCard;
  onSwap: (p: { from: string; to: string; amount: number }) => void;
  onStake: (p: { protocol: "marinade" | "jito"; amount: number }) => void;
  onLend: (p: { protocol: "kamino" | "solend"; amount: number }) => void;
}) {
  const riskColor = action.riskLevel === "低" ? "#10B981" : action.riskLevel === "中" ? "#F59E0B" : "#EF4444";

  // Detect action type
  const isJupiterSwap  = action.protocol === "Jupiter Swap";
  const stakeProtocol  = STAKE_PROTOCOLS[action.protocol];
  const lendProtocol   = LEND_PROTOCOLS[action.protocol];

  // Parse amounts from action text e.g. "質押 1.50 SOL" or "存入 $200 USDC"
  const amountMatch = action.action.match(/([\d,.]+)/);
  const parsedAmount = amountMatch ? parseFloat(amountMatch[1].replace(",", "")) : 1;

  // Parse swap params from "1 SOL → USDC"
  const swapParams = isJupiterSwap
    ? (() => {
        const m = action.action.match(/^([\d.]+)\s*([A-Z]+)\s*[→>]\s*([A-Z]+)/i);
        if (m) return { from: m[2].toUpperCase(), to: m[3].toUpperCase(), amount: parseFloat(m[1]) };
        return null;
      })()
    : null;

  const renderButton = () => {
    if (isJupiterSwap && swapParams) {
      return (
        <button onClick={() => onSwap(swapParams)} style={btnStyle(action.color)}>
          兑換 →
        </button>
      );
    }
    if (stakeProtocol) {
      return (
        <button onClick={() => onStake({ protocol: stakeProtocol, amount: parsedAmount })} style={btnStyle(action.color)}>
          質押 →
        </button>
      );
    }
    if (lendProtocol) {
      return (
        <button onClick={() => onLend({ protocol: lendProtocol, amount: parsedAmount })} style={btnStyle(action.color)}>
          存入 →
        </button>
      );
    }
    return (
      <a href={action.url} target="_blank" rel="noopener noreferrer" style={{
        ...btnStyle(action.color), textDecoration: "none", display: "inline-block",
      }}>
        執行 →
      </a>
    );
  };

  return (
    <div style={{
      background: "var(--bg-card)", border: `1px solid ${action.color}30`,
      borderRadius: 14, padding: "14px 16px",
      display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
    }}>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
          <span>{action.icon}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: action.color }}>{action.protocol}</span>
          {action.apy && (
            <span style={{ fontSize: 11, background: `${action.color}20`, color: action.color, borderRadius: 4, padding: "1px 6px", fontWeight: 700 }}>
              APY {action.apy}
            </span>
          )}
          <span style={{ fontSize: 10, color: riskColor, background: `${riskColor}15`, borderRadius: 4, padding: "1px 6px" }}>
            風險：{action.riskLevel}
          </span>
        </div>
        <div style={{ fontSize: 13, color: "var(--text-primary)", marginBottom: 2 }}>{action.action}</div>
        <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{action.detail}</div>
        {action.estimatedEarn && (
          <div style={{ fontSize: 12, color: "#10B981", marginTop: 4, fontWeight: 600 }}>
            预計收益：{action.estimatedEarn}
          </div>
        )}
      </div>
      {renderButton()}
    </div>
  );
}

function btnStyle(color: string): React.CSSProperties {
  return {
    background: color, color: "#fff", border: "none",
    borderRadius: 8, padding: "8px 14px", fontSize: 12,
    fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap",
  };
}

// ── Reasoning Box (collapsible, shows hash + on-chain write) ─────
function ReasoningBox({
  reasoningHash, memoPayload, isStreaming,
}: {
  reasoningHash: string;
  memoPayload: string;
  isStreaming: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [memoStatus, setMemoStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [txSig, setTxSig] = useState("");

  async function writeMemo() {
    setMemoStatus("sending");
    try {
      // Try server-side first
      const res = await fetch("/api/agent/memo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memoPayload }),
      });
      const data = await res.json();
      if (res.ok && data.txSignature) {
        setTxSig(data.txSignature);
        setMemoStatus("done");
        return;
      }
      // Fallback: Phantom
      if (!window.solana?.isPhantom) { setMemoStatus("error"); return; }
      const { Transaction, TransactionInstruction, Connection, PublicKey } = await import("@solana/web3.js");
      const MEMO_ID = new PublicKey("MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr");
      const conn = new Connection("/api/rpc", "confirmed");
      const { publicKey } = await window.solana.connect({ onlyIfTrusted: true });
      const { blockhash } = await conn.getLatestBlockhash("confirmed");
      const tx = new Transaction({ recentBlockhash: blockhash, feePayer: new PublicKey(publicKey.toString()) });
      tx.add(new TransactionInstruction({ keys: [], programId: MEMO_ID, data: Buffer.from(memoPayload, "utf-8") }));
      const { signature } = await window.solana.signAndSendTransaction(tx);
      setTxSig(signature);
      setMemoStatus("done");
    } catch {
      setMemoStatus("error");
    }
  }

  return (
    <div style={{
      background: "var(--bg-base)", border: "1px solid var(--border)",
      borderRadius: 10, padding: "8px 12px", marginTop: 2,
    }}>
      <div
        onClick={() => setExpanded(e => !e)}
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          cursor: "pointer",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {isStreaming ? (
            <span style={{
              width: 7, height: 7, borderRadius: "50%", background: "#8B5CF6",
              display: "inline-block",
              animation: "pulse 1s ease-in-out infinite",
            }} />
          ) : (
            <span style={{ fontSize: 10 }}>⛩️</span>
          )}
          <span style={{ fontSize: 10, color: "var(--text-secondary)" }}>可验證推理</span>
          <span style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "monospace" }}>
            #{reasoningHash.slice(0, 12)}
          </span>
        </div>
        <span style={{ fontSize: 9, color: "var(--text-muted)" }}>{expanded ? "▲" : "▼"}</span>
      </div>

      {expanded && (
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "monospace", wordBreak: "break-all" }}>
            SHA-256: {reasoningHash}
          </div>
          <div style={{ fontSize: 10, color: "var(--text-muted)", fontFamily: "monospace" }}>
            Memo: {memoPayload}
          </div>
          {memoStatus === "done" ? (
            <a href={`https://solscan.io/tx/${txSig}`} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 10, color: "#10B981", textDecoration: "none" }}>
              ✅ 已寫入鏈上 →
            </a>
          ) : (
            <button onClick={writeMemo} disabled={memoStatus === "sending"} style={{
              fontSize: 10, color: memoStatus === "error" ? "#EF4444" : "#60A5FA",
              background: "none", border: "1px solid var(--border)",
              borderRadius: 6, padding: "4px 10px", cursor: "pointer", textAlign: "left",
            }}>
              {memoStatus === "sending" ? "🌿 寫入中..." : memoStatus === "error" ? "❌ 失败，重試" : "⛩️ 寫入 Solana 鏈上"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function SummaryPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div>
      <div style={{ fontSize: 10, color: "var(--text-secondary)", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

// ── Smart Money Panel ────────────────────────────────────────────
function SmartMoneyPanel({ walletAddress }: { walletAddress: string | null }) {
  const [tab, setTab]             = useState<"consensus" | "wallets">("consensus");
  const [data, setData]           = useState<SmartMoneyData | null>(null);
  const [loading, setLoading]     = useState(true);
  const [walletPage, setWalletPage] = useState(0);
  const [expanded, setExpanded]   = useState<string | null>(null);
  const [copyMint, setCopyMint]   = useState<string | null>(null);
  const [copySymbol, setCopySymbol] = useState<string>("");
  const [discoveredCount, setDiscoveredCount] = useState(0);

  const PAGE_SIZE   = 10;
  const totalBatches = data ? Math.ceil((data.activeWallets?.length ?? 0) / PAGE_SIZE) : 1;
  const pageWallets  = data ? (data.activeWallets ?? []).slice(walletPage * PAGE_SIZE, (walletPage + 1) * PAGE_SIZE) : [];

  const LABEL_COLOR: Record<string, string> = {
    Cabal:       "#C0392B",
    KOL:         "#8B5CF6",
    Whale:       "#0EA5E9",
    Smart_Money: "#10B981",
    HighLight:   "#F59E0B",
  };

  useEffect(() => {
    fetch("/api/wallet/smart-money?type=consensus_24h")
      .then(r => r.json())
      .then(d => { setData(d as SmartMoneyData); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetch("/api/wallet/smart-money?type=discover")
        .then(r => r.json())
        .then((d: { total?: number }) => { if (d.total) setDiscoveredCount(d.total); })
        .catch(() => {});
    }, 1500);
    return () => clearTimeout(timer);
  }, []);

  function Stars({ n }: { n: number }) {
    return (
      <span>
        {Array.from({ length: 5 }, (_, i) => (
          <span key={i} style={{ color: i < n ? "#F59E0B" : "var(--border)", fontSize: 13 }}>★</span>
        ))}
      </span>
    );
  }

  return (
    <div style={{
      background: "var(--bg-card)",
      border: "1px solid var(--border)",
      borderRadius: 14,
      marginBottom: 16,
      overflow: "hidden",
    }}>
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 16px",
        borderBottom: "1px solid var(--border)",
        background: "var(--bg-card-2)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 15 }}>🐋</span>
          <span style={{ fontFamily: "var(--font-heading, serif)", fontSize: 13, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "0.03em" }}>
            聰明錢地址追蹤
          </span>
          {discoveredCount > 0 && (
            <span style={{
              fontSize: 10, background: "rgba(192,57,43,0.15)", color: "#C0392B",
              borderRadius: 10, padding: "2px 8px", marginLeft: 8, fontWeight: 700,
            }}>🔍 +{discoveredCount} 新發現</span>
          )}
          {data?.dataSource === "demo" && (
            <span style={{ fontSize: 9, color: "#F59E0B", background: "#F59E0B15", border: "1px solid #F59E0B30", borderRadius: 4, padding: "2px 6px" }}>演示數據</span>
          )}
          {data?.dataSource === "helius_realtime" && (
            <span style={{ fontSize: 9, color: "#10B981", background: "#10B98115", border: "1px solid #10B98130", borderRadius: 4, padding: "2px 6px" }}>● 真實鏈上</span>
          )}
        </div>
        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
          追蹤 {data?.trackedWallets ?? "—"} 個地址
        </span>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", borderBottom: "1px solid var(--border)" }}>
        {([
          { key: "consensus", label: "🎯 共識信號" },
          { key: "wallets",   label: "🌸 地址追蹤" },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              flex: 1, padding: "10px 0",
              background: "none", border: "none",
              borderBottom: tab === t.key ? "2px solid var(--accent)" : "2px solid transparent",
              color: tab === t.key ? "var(--accent)" : "var(--text-secondary)",
              fontSize: 12, fontWeight: tab === t.key ? 700 : 400,
              cursor: "pointer",
            }}
          >{t.label}</button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div style={{ padding: "28px 16px", textAlign: "center" }}>
          <div style={{ display: "flex", gap: 6, justifyContent: "center", marginBottom: 10 }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", animation: `bounce 1s ease-in-out ${i * 0.15}s infinite` }} />
            ))}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>正在分析 24h 鏈上數據…</div>
        </div>
      ) : tab === "consensus" ? (
        // ── Consensus signals tab ──
        <div>
          <div style={{ padding: "8px 16px 4px", fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6 }}>
            <span>🎯</span>
            <span style={{ fontFamily: "var(--font-heading, serif)", letterSpacing: "0.02em" }}>聰明錢最新關注的代幣</span>
          </div>
          {!data?.consensusTokens?.length ? (
            <div style={{ padding: "24px 16px", textAlign: "center", fontSize: 12, color: "var(--text-muted)" }}>
              過去 24h 暫無共識信號
            </div>
          ) : data.consensusTokens.map((token, idx) => (
            <div key={token.mint}>
              {/* Token row */}
              <div
                onClick={() => setExpanded(expanded === token.mint ? null : token.mint)}
                style={{
                  padding: "13px 16px",
                  borderBottom: "1px solid var(--border)",
                  cursor: "pointer",
                  background: expanded === token.mint ? "rgba(192,57,43,0.04)" : "transparent",
                  transition: "background 0.15s",
                }}
              >
                {/* Token name + chain */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 15 }}>
                      {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `${idx + 1}.`}
                    </span>
                    <span style={{
                      fontSize: 14, fontWeight: 700,
                      fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)",
                      color: "var(--text-primary)",
                    }}>
                      ${token.symbol ?? (token.mint.slice(0, 6) + "…")}
                    </span>
                    <span style={{
                      fontSize: 10, color: "var(--text-muted)",
                      background: "var(--bg-base)", border: "1px solid var(--border)",
                      borderRadius: 4, padding: "1px 6px",
                    }}>Solana</span>
                  </div>
                  <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{expanded === token.mint ? "▲" : "▼"}</span>
                </div>

                {/* Stats grid */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "5px 20px" }}>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 4 }}>
                    共識強度 <span style={{ marginLeft: 2 }}><Stars n={token.starRating} /></span>
                    <span style={{ color: token.starRating >= 5 ? "#10B981" : token.starRating >= 4 ? "#F59E0B" : "var(--text-muted)", fontWeight: 700 }}>
                      {token.starRating >= 5 ? " 高" : token.starRating >= 4 ? " 中高" : " 中"}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                    24h淨買入&nbsp;
                    <span style={{
                      color: "#10B981", fontWeight: 700,
                      fontFamily: "var(--font-mono, monospace)",
                    }}>
                      ${token.totalBuyUSD >= 1000 ? (token.totalBuyUSD / 1000).toFixed(2) + "K" : token.totalBuyUSD.toFixed(0)}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                    買入地址&nbsp;
                    <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{token.buyerCount} 個</span>
                    <span style={{ fontSize: 10, color: "var(--text-muted)", marginLeft: 4 }}>
                      ({token.buyerLabels})
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                    首次發現&nbsp;
                    <span style={{ color: "var(--text-muted)" }}>{smFormatTimeAgo(token.firstSeenAt)}</span>
                  </div>
                </div>
                {/* Copy trade button */}
                <div style={{ marginTop: 8, display: "flex", justifyContent: "flex-end" }}>
                  <button
                    onClick={(e) => { e.stopPropagation(); setCopyMint(token.mint); setCopySymbol(token.symbol ?? token.mint.slice(0, 6)); }}
                    style={{
                      padding: "6px 14px", borderRadius: 8, border: "1px solid rgba(192,57,43,0.4)",
                      background: "rgba(192,57,43,0.08)", color: "#C0392B",
                      fontSize: 11, fontWeight: 700, cursor: "pointer",
                      display: "flex", alignItems: "center", gap: 4,
                    }}
                  >
                    🛡 跟單
                  </button>
                </div>
              </div>

              {/* Expanded buyer list */}
              {expanded === token.mint && (
                <div style={{
                  background: "var(--bg-base)",
                  borderBottom: "1px solid var(--border)",
                  padding: "12px 16px",
                }}>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", marginBottom: 8, fontWeight: 700, textTransform: "uppercase", letterSpacing: 1 }}>主要買家</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {token.buyers.map((b, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11 }}>
                        <span style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono, monospace)", fontSize: 10 }}>{b.shortAddr}</span>
                        {b.twitter ? (
                          <a href={`https://twitter.com/${b.twitter.replace("@", "")}`} target="_blank" rel="noopener noreferrer"
                            style={{ color: "#0EA5E9", textDecoration: "none", fontWeight: 600 }}>{b.twitter}</a>
                        ) : (
                          <span style={{ color: "var(--text-muted)", fontSize: 10 }}>匿名地址</span>
                        )}
                        {b.name && <span style={{ color: "var(--text-secondary)" }}>({b.name})</span>}
                        <div style={{ display: "flex", gap: 3, marginLeft: "auto", flexWrap: "wrap" }}>
                          {b.labels.map(l => (
                            <span key={l} style={{
                              fontSize: 9, color: LABEL_COLOR[l] ?? "#888",
                              background: `${LABEL_COLOR[l] ?? "#888"}15`,
                              border: `1px solid ${LABEL_COLOR[l] ?? "#888"}35`,
                              borderRadius: 3, padding: "1px 5px",
                            }}>{l === "Smart_Money" ? "Smart" : l}</span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        // ── Wallets tab ──
        <div>
          <div style={{ padding: "8px 16px 4px", fontSize: 11, color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6 }}>
            <span>🌸</span>
            <span style={{ fontFamily: "var(--font-heading, serif)", letterSpacing: "0.02em" }}>核心聰明錢地址（按活躍度排序）</span>
          </div>

          {/* Column header */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "minmax(0,2.5fr) 0.5fr 1.2fr 0.9fr 0.9fr 0.7fr",
            gap: 6, padding: "8px 16px",
            borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)",
            background: "var(--bg-base)",
          }}>
            {["地址", "链", "标签", "Twitter", "名称", "24h活动"].map(h => (
              <div key={h} style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>{h}</div>
            ))}
          </div>

          {pageWallets.map((w, i) => (
            <div key={w.address} style={{
              display: "grid",
              gridTemplateColumns: "minmax(0,2.5fr) 0.5fr 1.2fr 0.9fr 0.9fr 0.7fr",
              gap: 6, padding: "11px 16px",
              borderBottom: "1px solid var(--border)",
              alignItems: "start",
              background: i % 2 === 0 ? "transparent" : "rgba(0,0,0,0.02)",
            }}>
              {/* Address */}
              <a href={`https://solscan.io/account/${w.address}`} target="_blank" rel="noopener noreferrer"
                style={{ color: "#0EA5E9", textDecoration: "none", fontSize: 10, fontFamily: "var(--font-mono, monospace)", wordBreak: "break-all", lineHeight: 1.4 }}>
                {w.address}
              </a>
              {/* Chain */}
              <div style={{ fontSize: 11, color: "var(--text-secondary)", paddingTop: 1 }}>Solana</div>
              {/* Labels */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                {w.labels.map(l => (
                  <span key={l} style={{
                    fontSize: 9, color: LABEL_COLOR[l] ?? "#888",
                    border: `1px solid ${LABEL_COLOR[l] ?? "#888"}50`,
                    borderRadius: 3, padding: "1px 4px", whiteSpace: "nowrap",
                  }}>{l === "Smart_Money" ? "Smart" : l}</span>
                ))}
              </div>
              {/* Twitter */}
              <div>
                {w.twitter ? (
                  <a href={`https://twitter.com/${w.twitter.replace("@", "")}`} target="_blank" rel="noopener noreferrer"
                    style={{ color: "#0EA5E9", textDecoration: "none", fontSize: 11 }}>{w.twitter}</a>
                ) : <span style={{ color: "var(--text-muted)", fontSize: 11 }}>—</span>}
              </div>
              {/* Name */}
              <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                {w.name ?? <span style={{ color: "var(--text-muted)" }}>—</span>}
              </div>
              {/* Activity */}
              <div style={{ fontSize: 11, color: w.activityCount > 0 ? "#10B981" : "var(--text-muted)", fontWeight: w.activityCount > 0 ? 600 : 400 }}>
                {w.activityCount > 0 ? `${w.activityCount}個代幣` : "—"}
              </div>
            </div>
          ))}

          {/* Pagination */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            gap: 12, padding: "12px 16px",
          }}>
            {totalBatches > 1 && (
              <>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  第 {walletPage + 1} 批 / 共 {totalBatches} 批
                </span>
                <button
                  onClick={() => setWalletPage(p => (p + 1) % totalBatches)}
                  style={{
                    background: "var(--bg-base)", border: "1px solid var(--border)",
                    borderRadius: 20, padding: "5px 14px", fontSize: 11,
                    color: "var(--text-secondary)", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: 4,
                  }}
                >
                  換一批 ↓
                </button>
              </>
            )}
            {!data?.trackedWallets && (
              <span style={{ fontSize: 10, color: "var(--text-muted)" }}>暫無活躍地址</span>
            )}
          </div>
        </div>
      )}
      {/* Copy Trade Modal */}
      {copyMint && (
        <CopyTradeModal
          mint={copyMint}
          symbol={copySymbol}
          walletAddress={walletAddress}
          onClose={() => { setCopyMint(null); setCopySymbol(""); }}
        />
      )}
    </div>
  );
}

function smFormatTimeAgo(ts: number): string {
  const diff = Date.now() - ts;
  if (diff < 3600000)  return `${Math.floor(diff / 60000)}m 前`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h 前`;
  return `${Math.floor(diff / 86400000)}d 前`;
}

// ── Simple Markdown ──────────────────────────────────────────────
function MarkdownText({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((line, i) => (
        <div key={i} style={{ minHeight: line === "" ? 8 : undefined }}>
          {line.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
            part.startsWith("**") && part.endsWith("**")
              ? <strong key={j} style={{ color: "#fff" }}>{part.slice(2, -2)}</strong>
              : part
          )}
        </div>
      ))}
    </>
  );
}
