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

interface Message {
  id: number;
  role: "user" | "assistant";
  text: string;
  actions?: ActionCard[];
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

  if (/(质押|staking|stake|liquid.*stake)/i.test(text) && /sol/i.test(text)) return { type: "stake_sol", amount };
  if (/(存入|理财|存usdc|earn|lending)/i.test(text) && /usdc/i.test(text)) return { type: "deposit_usdc", amount };
  if (/(收益|yield|apy|利率|最高|怎么赚|赚钱|被动收入)/i.test(text)) return { type: "yield_find" };
  if (/(换|swap|兑换|卖掉)/i.test(text)) {
    const to = text.match(/(换成|to|买)\s*(sol|usdc|usdt|bonk|jup)/i)?.[2]?.toUpperCase() ?? "USDC";
    return { type: "swap", from: "SOL", to, amount };
  }
  const mintMatch = text.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
  if (mintMatch) return { type: "analyze_token", mint: mintMatch[0] };
  if (/(rug|跑路|骗局|safe|安全|检测)/i.test(text)) {
    const tok = text.match(/\$?([A-Z]{2,10})/i)?.[1]?.toUpperCase() ?? "?";
    return { type: "rug_check", token: tok };
  }
  const priceMatch = text.match(/(sol|usdc|bonk|jup|btc|eth)/i);
  if (priceMatch && /(价格|price|多少|涨|跌)/i.test(text)) return { type: "price_check", token: priceMatch[1].toUpperCase() };
  if (/(我的钱包|portfolio|资产|持仓|总值|体检|健康)/i.test(text)) return { type: "portfolio_check" };
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
        text: `质押 **${amt.toFixed(2)} SOL** 到流动性质押协议，年化 ${(marinadeAPY * 100).toFixed(1)}-${(jitoAPY * 100).toFixed(1)}%，mSOL/jitoSOL 可继续用于 DeFi：`,
        actions: [
          { protocol: "Marinade Finance", icon: "🫙", action: `质押 ${amt.toFixed(2)} SOL → mSOL`, detail: "全链最大 SOL 质押协议，流动性最好", apy: `${(marinadeAPY * 100).toFixed(1)}%`, estimatedEarn: `+${(amt * marinadeAPY).toFixed(3)} SOL/年`, url: "https://marinade.finance/", color: "#8B5CF6", riskLevel: "低" },
          { protocol: "Jito", icon: "⚡", action: `质押 ${amt.toFixed(2)} SOL → jitoSOL`, detail: "含 MEV 奖励，APY 略高于 Marinade", apy: `${(jitoAPY * 100).toFixed(1)}%`, estimatedEarn: `+${(amt * jitoAPY).toFixed(3)} SOL/年`, url: "https://www.jito.network/staking/", color: "#06B6D4", riskLevel: "低" },
        ],
      };
    }
    case "deposit_usdc": {
      const amt = intent.amount ?? usdc;
      const kaminoAPY = getAPY("Kamino Finance", 8.2) / 100;
      const solendAPY = getAPY("Save (Solend)", 5.5) / 100;
      return {
        text: `将 **$${amt.toFixed(0)} USDC** 存入借贷协议，稳定获取利息，无价格风险：`,
        actions: [
          { protocol: "Kamino Finance", icon: "🌿", action: `存入 $${amt.toFixed(0)} USDC`, detail: "自动复利，利率随市场波动", apy: `${(kaminoAPY * 100).toFixed(1)}%`, estimatedEarn: `$${(amt * kaminoAPY / 12).toFixed(1)}/月`, url: "https://app.kamino.finance/", color: "#10B981", riskLevel: "低" },
          { protocol: "Save (Solend)", icon: "🏦", action: `存入 $${amt.toFixed(0)} USDC`, detail: "Solana 最老牌借贷协议，合约经过多次审计", apy: `${(solendAPY * 100).toFixed(1)}%`, estimatedEarn: `$${(amt * solendAPY / 12).toFixed(1)}/月`, url: "https://save.finance/", color: "#3B82F6", riskLevel: "低" },
          { protocol: "Marginfi", icon: "💎", action: `存入 $${amt.toFixed(0)} USDC`, detail: "支持跨保证金，功能最丰富", apy: "~6.5%", estimatedEarn: `$${(amt * 0.065 / 12).toFixed(1)}/月`, url: "https://app.marginfi.com/", color: "#F59E0B", riskLevel: "低" },
        ],
      };
    }
    case "swap": {
      const amt = intent.amount ?? 1;
      return {
        text: `通过 Jupiter 聚合器兑换，自动寻找最优路由：`,
        actions: [{ protocol: "Jupiter Swap", icon: "🪐", action: `${amt} ${intent.from} → ${intent.to}`, detail: "全 Solana 最优价格，支持100+交易对", url: `https://jup.ag/swap/${intent.from}-${intent.to}`, color: "#8B5CF6", riskLevel: "低" }],
      };
    }
    case "yield_find":
      return buildYieldResponse(sol, usdc, total, liveYield);
    case "portfolio_check":
      return { text: `你的钱包总资产 **$${total.toFixed(0)}**，含 **${sol.toFixed(3)} SOL** + **$${usdc.toFixed(0)} USDC** 闲置。切换到「🏥 钱包体检」Tab 查看完整报告。\n\n用我做什么操作？` };
    case "analyze_token":
      return { text: `切换到「🔍 代币分析」Tab，粘贴合约地址 **${intent.mint.slice(0, 8)}...** 即可获得安全评分和买入建议。` };
    case "rug_check":
      return { text: `检测 **$${intent.token}** 安全性：切换到「🔍 代币分析」Tab，输入合约地址，Solis 将检测增发权限、持币集中度、蜜罐等 5 项风险。` };
    default:
      return { text: `我可以帮你：\n\n💰 **收益** — "帮我质押 2 SOL" / "USDC 存哪里利息最高"\n🔍 **安全** — "分析这个代币 [地址]"\n💱 **交易** — "把 1 SOL 换成 USDC"\n📊 **资产** — "查看我的收益机会"`, actions: [] };
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
      action: `质押 ${(sol * 0.6).toFixed(2)} SOL`,
      detail: `流动性质押，获得 mSOL，当前 APY ${(marinadeAPY * 100).toFixed(1)}%`,
      apy: `${(marinadeAPY * 100).toFixed(1)}%`,
      estimatedEarn: `$${(sol * 0.6 * marinadeAPY * solPrice).toFixed(0)}/年`,
      url: "https://marinade.finance/", color: "#8B5CF6", riskLevel: "低",
    });
  }
  if (usdc > 5) {
    actions.push({
      protocol: "Kamino Finance", icon: "🌿",
      action: `存入 $${usdc.toFixed(0)} USDC`,
      detail: `USDC 借贷自动复利，当前 APY ${(kaminoAPY * 100).toFixed(1)}%`,
      apy: `${(kaminoAPY * 100).toFixed(1)}%`,
      estimatedEarn: `$${(usdc * kaminoAPY / 12).toFixed(1)}/月`,
      url: "https://app.kamino.finance/", color: "#10B981", riskLevel: "低",
    });
  }
  if (sol > 0.5 && usdc > 10) {
    actions.push({
      protocol: "Raydium CLMM", icon: "🌊",
      action: "SOL-USDC 集中流动性",
      detail: "在指定价格区间做市，手续费收益高但有无常损失风险",
      apy: "15–30%", estimatedEarn: "收益随市场波动",
      url: "https://raydium.io/liquidity/", color: "#F59E0B", riskLevel: "中",
    });
  }
  const text = actions.length > 0
    ? `基于你的钱包（SOL: ${sol.toFixed(3)}，USDC: $${usdc.toFixed(0)}），以下是实时最优收益机会，按风险由低到高：`
    : "你的钱包余额较少，建议先积累更多 SOL/USDC 再进行 DeFi 操作。";
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
        <div style={{ fontSize: 13, fontWeight: 700, color: "#E2E8F0" }}>
          💡 为你发现的收益机会
        </div>
        {totalAnnual > 0 && (
          <div style={{
            fontSize: 12, color: "#10B981",
            background: "#10B98115", border: "1px solid #10B98130",
            borderRadius: 8, padding: "4px 10px",
          }}>
            预计年收益 +${totalAnnual.toFixed(0)}
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
const QUICK_ACTION_DEFS = [
  { icon: "🫙", label: "质押 SOL", protocol: "Marinade Finance", fallbackSub: "Marinade / Jito", color: "#8B5CF6", prompt: "帮我质押 SOL 获取最高收益" },
  { icon: "🌿", label: "USDC 理财", protocol: "Kamino Finance", fallbackSub: "Kamino Finance", color: "#10B981", prompt: "我的 USDC 存哪里利息最高" },
  { icon: "🪐", label: "代币兑换", protocol: null, fallbackSub: "Jupiter 最优路由", color: "#06B6D4", prompt: "把 1 SOL 换成 USDC" },
  { icon: "💡", label: "收益机会", protocol: null, fallbackSub: "全部 DeFi 机会排行", color: "#F59E0B", prompt: "给我看所有收益机会" },
];

// ── Suggestion Chips ─────────────────────────────────────────────
const SUGGESTIONS = [
  "帮我质押 SOL 获取最高收益",
  "我的 USDC 存哪里利息最高",
  "把 1 SOL 换成 USDC",
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
        .filter(m => !m.text.startsWith("欢迎回来！上次我们讨论了"))
        .slice(-1)[0];
      const preview = memory.sessionSummary
        ? memory.sessionSummary.slice(0, 60)
        : lastRealMsg?.text?.slice(0, 40) ?? "";
      if (preview) {
        setMessages(prev => [...prev, {
          id: Date.now(),
          role: "assistant",
          text: `欢迎回来！上次我们讨论了「${preview}…」，继续吗？`,
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
      m => !m.isTyping && !m.text.startsWith("欢迎回来！上次我们讨论了")
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
                const alertText = `${opp.protocol} APY ${dir} ${Math.abs(opp.apy - old.apy).toFixed(1)}%，现在 ${opp.apyDisplay}`;
                setToast({ id: Date.now(), text: alertText });
                setMessages(prev => [...prev, {
                  id: Date.now(),
                  role: "assistant",
                  text: `🔔 **主动提醒** — ${alertText}。要调整持仓吗？`,
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
            const emoji = alert.severity === "critical" ? "🚨" : alert.severity === "warning" ? "⚠️" : "🔔";
            setToast({ id: alert.timestamp, text: alert.message });
            setMessages(prev => [...prev, {
              id: alert.timestamp,
              role: "assistant",
              text: `${emoji} **Guardian Alert** — ${alert.message}。要调整持仓吗？`,
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
    const check = () => {
      const watchlist = getWatchlist();
      for (const token of watchlist.slice(0, 5)) { // limit to 5 tokens
        fetch(`https://price.jup.ag/v6/price?ids=${token.mint}`)
          .then(r => r.json())
          .then(d => {
            const newPrice = d?.data?.[token.mint]?.price as number | undefined;
            if (!newPrice || !token.lastKnownPrice) {
              if (newPrice) saveLastPrice(token.mint, newPrice);
              return;
            }
            const changePct = Math.abs(newPrice - token.lastKnownPrice) / token.lastKnownPrice * 100;
            if (changePct >= 10) {
              const dir = newPrice > token.lastKnownPrice ? "🚀 上涨" : "📉 下跌";
              const alertText = `${token.symbol} ${dir} ${changePct.toFixed(1)}%，现价 $${newPrice.toFixed(4)}`;
              setToast({ id: Date.now(), text: alertText });
              setMessages(prev => [...prev, {
                id: Date.now(),
                role: "assistant",
                text: `🔔 **价格提醒** — ${alertText}。要查看详情或操作吗？`,
                isAgentInitiated: true,
              }]);
              saveLastPrice(token.mint, newPrice);
            }
          })
          .catch(() => {});
      }
    };
    const interval = setInterval(check, 5 * 60 * 1000 + 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function isExecuteIntent(text: string): boolean {
    return /^(执行|确认|好的?|可以|做吧|行|就这样|开始|go|yes|ok|好的执行|确认执行)[\s!！。]*$/i.test(text.trim())
      || /^(执行|用|选|要)\s*(marinade|jito|kamino|solend|第一个|第二个|这个)/i.test(text.trim());
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

    // ── Execute intent: user replied "执行" / "好" after AI gave action cards ──
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

      const label = STAKE_PROTOCOLS[target.protocol] ? "质押"
        : LEND_PROTOCOLS[target.protocol] ? "存入"
        : "兑换";

      const userMsg: Message   = { id: Date.now(),     role: "user",      text: text.trim() };
      const confirmMsg: Message = { id: Date.now() + 1, role: "assistant", text: `好的，正在打开 **${target.protocol}** ${label}...` };
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
          description: "Solis AI 顾问会话 0.50 USDC",
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

              if (event === "thinking_delta") {
                accThinking += parsed.text as string;
                setThinkingText(accThinking);
                setMessages(prev => prev.map(m =>
                  m.id === assistantId
                    ? { ...m, isTyping: true, thinkingStep: "🧠 思考中..." }
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
                if (newActions && newActions.length > 0) setLastActions(newActions);
                if (parsed.sessionSummary) setSessionSummary(parsed.sessionSummary);
                setMessages(prev => prev.map(m =>
                  m.id === assistantId
                    ? {
                        ...m,
                        isTyping: false,
                        isStreaming: false,
                        thinkingStep: undefined,
                        text: accText || "抱歉，暂时无法回答，请稍后重试。",
                        actions: newActions,
                        reasoningHash: parsed.reasoningHash,
                        memoPayload: parsed.memoPayload,
                        aiAvailable: parsed.aiAvailable,
                      }
                    : m
                ));
              } else if (event === "error") {
                setMessages(prev => prev.map(m =>
                  m.id === assistantId
                    ? { ...m, isTyping: false, isStreaming: false, text: parsed.message ?? "发生错误，请重试。" }
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
          ? { ...m, isTyping: false, isStreaming: false, text: "网络错误，请稍后重试。" }
          : m
      ));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column" }}>

      {/* ── Toast notification ── */}
      {toast && (
        <div
          key={toast.id}
          style={{
            position: "fixed", bottom: 80, right: 20, zIndex: 100,
            background: "#13131A", border: "1px solid #8B5CF660",
            borderRadius: 12, padding: "12px 16px",
            maxWidth: 320, fontSize: 12, color: "#E2E8F0",
            boxShadow: "0 4px 24px #8B5CF620",
            display: "flex", gap: 10, alignItems: "flex-start",
            animation: "slideIn 0.3s ease-out",
          }}
        >
          <span style={{ flexShrink: 0 }}>🤖</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, color: "#8B5CF6", marginBottom: 2, fontSize: 10 }}>
              SOLIS AGENT
            </div>
            {toast.text}
          </div>
          <button
            onClick={() => setToast(null)}
            style={{
              background: "none", border: "none", color: "#475569",
              cursor: "pointer", fontSize: 12, flexShrink: 0,
            }}
          >✕</button>
        </div>
      )}

      {/* ── Live Deliberation Stream (Interleaved Thinking) ── */}
      {loading && thinkingText && (
        <div style={{
          background: "#0D0D14", border: "1px solid #8B5CF640",
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
            <span style={{ animation: "pulse 1.5s infinite", display: "inline-block" }}>🧠</span>
            Solis 正在思考... ({thinkingText.length} chars)
            <span style={{ marginLeft: "auto", color: "#475569" }}>{thinkingOpen ? "▲" : "▼"}</span>
          </button>
          {thinkingOpen && (
            <div style={{
              padding: "0 14px 12px", fontSize: 11, color: "#64748B",
              lineHeight: 1.7, whiteSpace: "pre-wrap", maxHeight: 200, overflowY: "auto",
              borderTop: "1px solid #1E1E2E",
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
          background: "#13131A", border: "1px solid #1E1E2E",
          borderRadius: 12, marginBottom: 20,
        }}>
          <SummaryPill label={t("totalAssets")} value={`$${wallet.totalUSD.toLocaleString(undefined, { maximumFractionDigits: 0 })}`} color="#E2E8F0" />
          <div style={{ width: 1, background: "#1E1E2E" }} />
          <SummaryPill label="SOL" value={`${wallet.solBalance.toFixed(3)}`} color="#8B5CF6" />
          <div style={{ width: 1, background: "#1E1E2E" }} />
          <SummaryPill label="USDC" value={`$${wallet.idleUSDC.toFixed(0)}`} color={wallet.idleUSDC > 10 ? "#F59E0B" : "#475569"} />
          <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
            {liveYield && (
              <span style={{
                fontSize: 10, color: "#10B981",
                background: "#10B98115", border: "1px solid #10B98130",
                borderRadius: 10, padding: "2px 8px",
              }}>
                ● 实时 APY
              </span>
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
                  fontSize: 10, color: "#475569",
                  background: "transparent", border: "1px solid #1E1E2E",
                  borderRadius: 8, padding: "2px 8px", cursor: "pointer",
                }}
              >
                {t("clearHistory")}
              </button>
            )}
            <span style={{ fontSize: 11, color: "#334155" }}>
              {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
            </span>
          </div>
        </div>
      )}

      {loadingWallet && (
        <div style={{
          padding: 16, background: "#13131A", border: "1px solid #1E1E2E",
          borderRadius: 12, marginBottom: 20, fontSize: 13, color: "#475569",
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
                    ? "linear-gradient(135deg, #8B5CF6, #06B6D4)"
                    : "#13131A",
                  border: msg.role === "user" ? "none" : "1px solid #1E1E2E",
                  borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                  fontSize: 13, color: "#E2E8F0", lineHeight: 1.7,
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
          <div style={{ fontSize: 11, color: "#475569", marginBottom: 10 }}>{t("agentsTitle")}</div>
          <div className="quick-actions-grid" style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 }}>
            {QUICK_ACTION_DEFS.map(qa => {
              const liveOpp = qa.protocol
                ? liveYield?.opportunities.find(o => o.protocol === qa.protocol)
                : null;
              const sub = liveOpp
                ? `${qa.protocol?.split(" ")[0]}，APY ${liveOpp.apyDisplay}`
                : qa.fallbackSub;
              return (
                <button key={qa.label} onClick={() => sendMessage(qa.prompt)} style={{
                  background: "#13131A", border: `1px solid ${qa.color}30`,
                  borderRadius: 10, padding: "12px 14px",
                  display: "flex", alignItems: "center", gap: 10,
                  cursor: "pointer", textAlign: "left",
                }}>
                  <span style={{ fontSize: 20 }}>{qa.icon}</span>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: qa.color }}>{qa.label}</div>
                    <div style={{ fontSize: 10, color: "#475569", marginTop: 2 }}>{sub}</div>
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
                background: "#0A0A0F", border: "1px solid #1E1E2E",
                borderRadius: 20, padding: "5px 12px",
                fontSize: 11, color: "#8B5CF6", cursor: "pointer",
              }}>{s}</button>
            ))}
          </div>
        </div>
      )}

      {/* ── Quota / session notice ── */}
      {advisorQuota && !advisorQuota.admin && messages.length === 0 && (
        <div style={{
          background: "linear-gradient(135deg, #1A0D2E, #0D1A2E)",
          border: "1px solid #8B5CF640",
          borderRadius: 12, padding: "14px 16px", marginBottom: 10,
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
        }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: "#8B5CF6", marginBottom: 2 }}>
              🤖 AI 顾问 — Claude Sonnet 4.6
            </div>
            <div style={{ fontSize: 11, color: "#475569" }}>
              {advisorQuota.remaining > 0
                ? <>还剩 <strong style={{ color: "#10B981" }}>{advisorQuota.remaining}/3</strong> 次免费 · 超出后每次 <strong style={{ color: "#E2E8F0" }}>0.50 USDC</strong></>
                : <>免费次数已用完 · 发送消息时自动支付 <strong style={{ color: "#E2E8F0" }}>0.50 USDC</strong></>}
            </div>
          </div>
          <span style={{
            fontSize: 11, fontWeight: 700,
            color: advisorQuota.remaining > 0 ? "#10B981" : "#8B5CF6",
            background: advisorQuota.remaining > 0 ? "#10B98120" : "#8B5CF620",
            border: `1px solid ${advisorQuota.remaining > 0 ? "#10B98140" : "#8B5CF640"}`,
            borderRadius: 6, padding: "3px 8px", whiteSpace: "nowrap",
          }}>
            {advisorQuota.remaining > 0 ? `🆓 ${advisorQuota.remaining}/3 次免费` : "💰 0.50 USDC/次"}
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
        borderTop: messages.length > 0 ? "1px solid #1E1E2E" : "none",
      }}>
        <input
          type="text" value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && sendMessage(input)}
          placeholder={t("messagePlaceholder")}
          disabled={loading}
          style={{
            flex: 1, padding: "12px 16px",
            background: "#13131A", border: "1px solid #1E1E2E",
            borderRadius: 12, fontSize: 13, color: "#E2E8F0", outline: "none",
          }}
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={loading || !input.trim()}
          style={{
            padding: "12px 20px",
            background: loading || !input.trim() ? "#1E1E2E" : "linear-gradient(135deg, #8B5CF6, #06B6D4)",
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

  // Parse amounts from action text e.g. "质押 1.50 SOL" or "存入 $200 USDC"
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
          兑换 →
        </button>
      );
    }
    if (stakeProtocol) {
      return (
        <button onClick={() => onStake({ protocol: stakeProtocol, amount: parsedAmount })} style={btnStyle(action.color)}>
          质押 →
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
        执行 →
      </a>
    );
  };

  return (
    <div style={{
      background: "#13131A", border: `1px solid ${action.color}30`,
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
            风险：{action.riskLevel}
          </span>
        </div>
        <div style={{ fontSize: 13, color: "#E2E8F0", marginBottom: 2 }}>{action.action}</div>
        <div style={{ fontSize: 11, color: "#64748B" }}>{action.detail}</div>
        {action.estimatedEarn && (
          <div style={{ fontSize: 12, color: "#10B981", marginTop: 4, fontWeight: 600 }}>
            预计收益：{action.estimatedEarn}
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
      background: "#080B14", border: "1px solid #1E3A5F",
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
            <span style={{ fontSize: 10 }}>🔐</span>
          )}
          <span style={{ fontSize: 10, color: "#475569" }}>可验证推理</span>
          <span style={{ fontSize: 10, color: "#334155", fontFamily: "monospace" }}>
            #{reasoningHash.slice(0, 12)}
          </span>
        </div>
        <span style={{ fontSize: 9, color: "#334155" }}>{expanded ? "▲" : "▼"}</span>
      </div>

      {expanded && (
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
          <div style={{ fontSize: 10, color: "#334155", fontFamily: "monospace", wordBreak: "break-all" }}>
            SHA-256: {reasoningHash}
          </div>
          <div style={{ fontSize: 10, color: "#334155", fontFamily: "monospace" }}>
            Memo: {memoPayload}
          </div>
          {memoStatus === "done" ? (
            <a href={`https://solscan.io/tx/${txSig}`} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 10, color: "#10B981", textDecoration: "none" }}>
              ✅ 已写入链上 →
            </a>
          ) : (
            <button onClick={writeMemo} disabled={memoStatus === "sending"} style={{
              fontSize: 10, color: memoStatus === "error" ? "#EF4444" : "#60A5FA",
              background: "none", border: "1px solid #1E3A5F",
              borderRadius: 6, padding: "4px 10px", cursor: "pointer", textAlign: "left",
            }}>
              {memoStatus === "sending" ? "⏳ 写入中..." : memoStatus === "error" ? "❌ 失败，重试" : "⛓ 写入 Solana 链上"}
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
      <div style={{ fontSize: 10, color: "#475569", marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color }}>{value}</div>
    </div>
  );
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
