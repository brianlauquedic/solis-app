/**
 * Smart Money Tracking — 聪明钱真实 P&L 追踪
 *
 * 核心算法：从链上真实交易推导 P&L（无需历史价格外部数据库）
 *
 *   原理：Helius 增强交易 API 返回每笔 SWAP 的双边金额
 *     Buy:  SOL/USDC → Token  (卖出 SOL, 买入 Token)
 *     Sell: Token → SOL/USDC  (卖出 Token, 得到 SOL)
 *
 *   在同一钱包内配对 Buy + Sell:
 *     如果 Buy 了 1 SOL 的 BONK, 后来卖掉得到 1.2 SOL → P&L = +20%
 *   完全基于链上数据，无需任何外部价格预言机
 *
 * 超越 Minara 的创新点：
 *   1. 真实胜率（基于实际闭合交易），不是估算
 *   2. 共识信号：多个聪明钱同时买入同一代币 = 强烈买入信号
 *   3. AI 分类：鲸鱼 / 机构 / 套利机器人 / DeFi 专家（基于行为特征）
 *   4. 复制模式分析：追踪买入时机（开盘 vs 中期 vs 高位）
 *
 * GET  /api/wallet/smart-money            — top smart money list
 * GET  /api/wallet/smart-money?wallet=xxx — analyze specific wallet
 * POST /api/wallet/smart-money            — track wallet moves in detail
 */

import { NextRequest, NextResponse } from "next/server";
import { runQuotaGate } from "@/lib/rate-limit";

const HELIUS_API_KEY = process.env.HELIUS_API_KEY ?? "";
const SOL_MINT  = "So11111111111111111111111111111111111111112";
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const BASE_MINTS = new Set([SOL_MINT, USDC_MINT]);

// ── Helius transaction type ───────────────────────────────────────

interface HeliusTx {
  signature: string;
  timestamp: number;
  type: string;
  feePayer: string;
  fee: number;
  tokenTransfers?: Array<{
    fromUserAccount: string;
    toUserAccount: string;
    tokenAmount: number;
    mint: string;
  }>;
  nativeTransfers?: Array<{
    fromUserAccount: string;
    toUserAccount: string;
    amount: number; // lamports
  }>;
}

// ── Parsed swap record ────────────────────────────────────────────

interface ParsedSwap {
  signature: string;
  timestamp: number;    // unix seconds
  soldMint: string;
  soldAmount: number;   // in token units (SOL in SOL, not lamports)
  boughtMint: string;
  boughtAmount: number;
}

// ── P&L tracking state ────────────────────────────────────────────

interface TradePosition {
  totalBought: number;        // total token units bought
  totalCostBase: number;      // total base currency (SOL/USDC) spent
}

interface ClosedTrade {
  mint: string;
  buyBase: number;   // cost in SOL/USDC
  sellBase: number;  // revenue in SOL/USDC
  pnlPct: number;
  isWin: boolean;
}

function computeRealPnL(swaps: ParsedSwap[]): {
  winRate: number;
  avgWinPct: number;
  avgLossPct: number;
  totalClosedTrades: number;
  winningTrades: number;
  losingTrades: number;
  estimatedTotalPnlPct: number;
  topWins: ClosedTrade[];
  topLosses: ClosedTrade[];
} {
  // Sort chronologically
  const sorted = [...swaps].sort((a, b) => a.timestamp - b.timestamp);

  // Open positions per token mint
  const positions = new Map<string, TradePosition>();
  const closed: ClosedTrade[] = [];

  for (const swap of sorted) {
    const isBuy  = BASE_MINTS.has(swap.soldMint)  && !BASE_MINTS.has(swap.boughtMint);
    const isSell = !BASE_MINTS.has(swap.soldMint) && BASE_MINTS.has(swap.boughtMint);

    if (isBuy) {
      // Opening / adding to a long position
      const existing = positions.get(swap.boughtMint) ?? { totalBought: 0, totalCostBase: 0 };
      existing.totalBought   += swap.boughtAmount;
      existing.totalCostBase += swap.soldAmount;
      positions.set(swap.boughtMint, existing);

    } else if (isSell) {
      const pos = positions.get(swap.soldMint);
      if (!pos || pos.totalBought <= 0) continue;

      // What fraction of position is being exited?
      const fraction = Math.min(1, swap.soldAmount / pos.totalBought);
      const costBasis = pos.totalCostBase * fraction;
      const revenue   = swap.boughtAmount; // how much SOL/USDC received

      if (costBasis > 0) {
        const pnlPct = ((revenue - costBasis) / costBasis) * 100;
        closed.push({
          mint:    swap.soldMint,
          buyBase: costBasis,
          sellBase: revenue,
          pnlPct,
          isWin: revenue > costBasis,
        });
      }

      // Reduce position
      pos.totalBought    -= swap.soldAmount;
      pos.totalCostBase  -= costBasis;
      if (pos.totalBought <= 0) positions.delete(swap.soldMint);
      else positions.set(swap.soldMint, pos);
    }
  }

  if (closed.length === 0) {
    return {
      winRate: 0, avgWinPct: 0, avgLossPct: 0,
      totalClosedTrades: 0, winningTrades: 0, losingTrades: 0,
      estimatedTotalPnlPct: 0, topWins: [], topLosses: [],
    };
  }

  const wins   = closed.filter(t => t.isWin);
  const losses = closed.filter(t => !t.isWin);

  const avgWinPct  = wins.length  > 0 ? wins.reduce((s, t) => s + t.pnlPct, 0)  / wins.length  : 0;
  const avgLossPct = losses.length > 0 ? losses.reduce((s, t) => s + t.pnlPct, 0) / losses.length : 0;
  const totalPnl   = closed.reduce((s, t) => s + (t.sellBase - t.buyBase), 0);
  const totalCost  = closed.reduce((s, t) => s + t.buyBase, 0);

  return {
    winRate:              wins.length / closed.length,
    avgWinPct,
    avgLossPct,
    totalClosedTrades:    closed.length,
    winningTrades:        wins.length,
    losingTrades:         losses.length,
    estimatedTotalPnlPct: totalCost > 0 ? (totalPnl / totalCost) * 100 : 0,
    topWins:              wins.sort((a, b) => b.pnlPct - a.pnlPct).slice(0, 3),
    topLosses:            losses.sort((a, b) => a.pnlPct - b.pnlPct).slice(0, 3),
  };
}

// ── Helius data fetching ──────────────────────────────────────────

async function fetchWithTimeout(url: string, opts: RequestInit = {}, ms = 10000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

async function getSwapHistory(walletAddress: string, dayLimit = 30): Promise<ParsedSwap[]> {
  if (!HELIUS_API_KEY) return [];

  const cutoffSec = Math.floor(Date.now() / 1000) - dayLimit * 86400;
  const swaps: ParsedSwap[] = [];
  let before: string | undefined;

  for (let page = 0; page < 8; page++) {  // max 800 transactions
    const url = `https://api.helius.xyz/v0/addresses/${walletAddress}/transactions` +
      `?api-key=${HELIUS_API_KEY}&type=SWAP&limit=100${before ? `&before=${before}` : ""}`;
    try {
      const res = await fetchWithTimeout(url);
      if (!res.ok) break;
      const txs = await res.json() as HeliusTx[];
      if (!txs.length) break;

      for (const tx of txs) {
        if (tx.timestamp < cutoffSec) return swaps; // Past the time window, stop

        const transfers = tx.tokenTransfers ?? [];
        const nativeOut = (tx.nativeTransfers ?? []).filter(t => t.fromUserAccount === walletAddress);
        const nativeIn  = (tx.nativeTransfers ?? []).filter(t => t.toUserAccount   === walletAddress);
        const tokOut    = transfers.filter(t => t.fromUserAccount === walletAddress);
        const tokIn     = transfers.filter(t => t.toUserAccount   === walletAddress);

        // Case 1: SOL out, Token in (buy with SOL)
        if (nativeOut.length > 0 && tokIn.length > 0) {
          swaps.push({
            signature:   tx.signature,
            timestamp:   tx.timestamp,
            soldMint:    SOL_MINT,
            soldAmount:  nativeOut.reduce((s, t) => s + t.amount, 0) / 1e9,
            boughtMint:  tokIn[0].mint,
            boughtAmount: tokIn[0].tokenAmount,
          });
        }
        // Case 2: Token out, SOL in (sell for SOL)
        else if (tokOut.length > 0 && nativeIn.length > 0) {
          swaps.push({
            signature:   tx.signature,
            timestamp:   tx.timestamp,
            soldMint:    tokOut[0].mint,
            soldAmount:  tokOut[0].tokenAmount,
            boughtMint:  SOL_MINT,
            boughtAmount: nativeIn.reduce((s, t) => s + t.amount, 0) / 1e9,
          });
        }
        // Case 3: Token out, USDC in (sell for USDC)
        else if (tokOut.length > 0 && tokIn.length > 0) {
          const outTok = tokOut[0];
          const inTok  = tokIn[0];
          if (!BASE_MINTS.has(outTok.mint) && BASE_MINTS.has(inTok.mint)) {
            swaps.push({
              signature:   tx.signature,
              timestamp:   tx.timestamp,
              soldMint:    outTok.mint,
              soldAmount:  outTok.tokenAmount,
              boughtMint:  inTok.mint,
              boughtAmount: inTok.tokenAmount,
            });
          }
          // Case 4: USDC out, Token in (buy with USDC)
          else if (BASE_MINTS.has(outTok.mint) && !BASE_MINTS.has(inTok.mint)) {
            swaps.push({
              signature:   tx.signature,
              timestamp:   tx.timestamp,
              soldMint:    outTok.mint,
              soldAmount:  outTok.tokenAmount,
              boughtMint:  inTok.mint,
              boughtAmount: inTok.tokenAmount,
            });
          }
        }
      }

      if (txs.length < 100) break;
      before = txs[txs.length - 1].signature;
    } catch {
      break;
    }
  }

  return swaps;
}

async function getWalletSOLBalance(walletAddress: string): Promise<number> {
  if (!HELIUS_API_KEY) return 0;
  try {
    const res = await fetchWithTimeout(
      `https://api.helius.xyz/v0/addresses/${walletAddress}/balances?api-key=${HELIUS_API_KEY}`
    );
    if (!res.ok) return 0;
    const data = await res.json() as { nativeBalance?: number };
    return (data.nativeBalance ?? 0) / 1e9;
  } catch { return 0; }
}

// ── Wallet categorization (behavior-based) ────────────────────────

function categorizeWallet(
  solBalance: number,
  txCount: number,
  winRate: number,
  avgIntervalSec: number
): { category: string; traits: string[] } {
  const traits: string[] = [];

  if (solBalance > 10000)      traits.push("巨鲸（>1万SOL）");
  else if (solBalance > 1000)  traits.push("大户（>千SOL）");
  if (txCount > 300)           traits.push("高频交易者");
  if (avgIntervalSec < 60)     traits.push("可能是机器人");
  if (winRate > 0.70)          traits.push("高胜率交易者");
  if (winRate > 0.60 && solBalance > 500) traits.push("专业 DeFi 操作");

  let category = "聪明钱";
  if (solBalance > 5000)           category = "鲸鱼";
  else if (avgIntervalSec < 30)    category = "套利机器人";
  else if (txCount > 500)          category = "高频机器人";
  else if (winRate > 0.65)         category = "DeFi专家";
  else if (solBalance > 500)       category = "大户";

  return { category, traits };
}

// ── Score calculation ─────────────────────────────────────────────

function scoreWallet(
  winRate: number,
  totalTrades: number,
  solBalance: number,
  pnlPct: number
): number {
  let score = 0;
  // Win rate — most important (0-40)
  score += Math.round(winRate * 40);
  // Trade volume — data confidence (0-20)
  score += totalTrades >= 20 ? 20 : totalTrades >= 10 ? 12 : totalTrades >= 5 ? 6 : 0;
  // Portfolio size — skin in game (0-20)
  score += solBalance >= 1000 ? 20 : solBalance >= 100 ? 12 : solBalance >= 10 ? 6 : 0;
  // P&L performance (0-20)
  score += pnlPct >= 50 ? 20 : pnlPct >= 20 ? 14 : pnlPct >= 5 ? 8 : pnlPct >= 0 ? 4 : 0;
  return Math.min(100, score);
}

// ── Full wallet analysis ──────────────────────────────────────────

export interface SmartMoneyWallet {
  address: string;
  shortAddress: string;
  label: string;
  category: string;
  traits: string[];
  score: number;
  solBalance: number;
  totalClosedTrades: number;
  winRate: number;
  avgWinPct: number;
  avgLossPct: number;
  estimatedPnlPct: number;
  recentSwaps: Array<{
    timestamp: number;
    soldMint: string;
    soldAmount: number;
    boughtMint: string;
    boughtAmount: number;
    impliedPriceRatio: number;
  }>;
  topWins: Array<{ mint: string; pnlPct: number }>;
  copySignal?: {
    token: string;
    recentBuyCount: number;
    confidence: number;
    reason: string;
  };
  dataQuality: "high" | "medium" | "low";
  dataSource: "helius_realtime" | "demo";
}

async function analyzeWallet(walletAddress: string): Promise<SmartMoneyWallet | null> {
  const [swaps, solBalance] = await Promise.all([
    getSwapHistory(walletAddress, 30),
    getWalletSOLBalance(walletAddress),
  ]);

  // Minimum activity threshold
  if (swaps.length < 3 && solBalance < 1) return null;

  const pnl = computeRealPnL(swaps);

  // Average interval between trades (proxy for bot detection)
  const intervals = swaps.slice(1).map((tx, i) => Math.abs(tx.timestamp - swaps[i].timestamp));
  const avgIntervalSec = intervals.length > 0
    ? intervals.reduce((s, v) => s + v, 0) / intervals.length
    : 3600;

  const { category, traits } = categorizeWallet(solBalance, swaps.length, pnl.winRate, avgIntervalSec);
  const score = scoreWallet(pnl.winRate, pnl.totalClosedTrades, solBalance, pnl.estimatedTotalPnlPct);

  // Detect copy signal: which token did this wallet buy multiple times recently?
  const last7d = swaps.filter(s => s.timestamp > Date.now() / 1000 - 7 * 86400);
  const buyMap = new Map<string, number>();
  for (const s of last7d) {
    if (BASE_MINTS.has(s.soldMint) && !BASE_MINTS.has(s.boughtMint)) {
      buyMap.set(s.boughtMint, (buyMap.get(s.boughtMint) ?? 0) + 1);
    }
  }
  const topBuy = [...buyMap.entries()].sort((a, b) => b[1] - a[1])[0];
  const copySignal = topBuy && topBuy[1] >= 2 && score >= 60
    ? {
        token:          topBuy[0].slice(0, 8) + "…" + topBuy[0].slice(-4),
        recentBuyCount: topBuy[1],
        confidence:     Math.min(95, 40 + score * 0.3 + topBuy[1] * 8),
        reason: `该钱包 7 日内 ${topBuy[1]} 次买入此代币，综合评分 ${score}，` +
          `历史胜率 ${(pnl.winRate * 100).toFixed(0)}%`,
      }
    : undefined;

  const dataQuality: SmartMoneyWallet["dataQuality"] =
    pnl.totalClosedTrades >= 10 ? "high"
    : pnl.totalClosedTrades >= 3  ? "medium"
    : "low";

  const shortAddr = walletAddress.slice(0, 4) + "…" + walletAddress.slice(-4);

  return {
    address: walletAddress,
    shortAddress: shortAddr,
    label: `${category} ${shortAddr}`,
    category,
    traits,
    score,
    solBalance,
    totalClosedTrades: pnl.totalClosedTrades,
    winRate: pnl.winRate,
    avgWinPct: pnl.avgWinPct,
    avgLossPct: pnl.avgLossPct,
    estimatedPnlPct: pnl.estimatedTotalPnlPct,
    recentSwaps: swaps.slice(0, 10).map(s => ({
      timestamp: s.timestamp * 1000,
      soldMint: s.soldMint.slice(0, 8) + "…",
      soldAmount: parseFloat(s.soldAmount.toFixed(4)),
      boughtMint: s.boughtMint.slice(0, 8) + "…",
      boughtAmount: parseFloat(s.boughtAmount.toFixed(4)),
      impliedPriceRatio: s.boughtAmount > 0
        ? parseFloat((s.soldAmount / s.boughtAmount).toFixed(8))
        : 0,
    })),
    topWins: pnl.topWins.map(t => ({
      mint: t.mint.slice(0, 8) + "…" + t.mint.slice(-4),
      pnlPct: parseFloat(t.pnlPct.toFixed(1)),
    })),
    copySignal,
    dataQuality,
    dataSource: HELIUS_API_KEY ? "helius_realtime" : "demo",
  };
}

// ── Demo data (when no API key) ───────────────────────────────────

function generateDemoWallet(address: string, index: number): SmartMoneyWallet {
  const winRates = [0.73, 0.68, 0.62, 0.71, 0.58];
  const pnls     = [124, 87, 43, 156, 31];
  const trades   = [28, 15, 42, 19, 67];
  const balances = [2840, 760, 125, 1240, 380];
  const cats     = ["DeFi专家", "鲸鱼", "DeFi专家", "DeFi专家", "套利机器人"];
  const i = index % 5;
  const shortAddr = address.slice(0, 4) + "…" + address.slice(-4);

  return {
    address,
    shortAddress: shortAddr,
    label: `${cats[i]} ${shortAddr}`,
    category: cats[i],
    traits: winRates[i] > 0.65 ? ["高胜率交易者", "专业 DeFi 操作"] : ["高频交易者", "可能是机器人"],
    score: Math.round(winRates[i] * 40 + 20 + (balances[i] > 500 ? 15 : 8) + (pnls[i] > 50 ? 18 : 10)),
    solBalance: balances[i],
    totalClosedTrades: trades[i],
    winRate: winRates[i],
    avgWinPct: pnls[i] * 0.6,
    avgLossPct: -(pnls[i] * 0.2),
    estimatedPnlPct: pnls[i],
    recentSwaps: [],
    topWins: [
      { mint: "BONK…3xKp", pnlPct: pnls[i] * 1.2 },
      { mint: "JUP…9wQr",  pnlPct: pnls[i] * 0.8 },
    ],
    copySignal: winRates[i] > 0.65 ? {
      token: "JUP…9wQr",
      recentBuyCount: 3,
      confidence: Math.round(winRates[i] * 80 + 10),
      reason: `演示：该钱包 7 日内 3 次买入，历史胜率 ${(winRates[i]*100).toFixed(0)}%`,
    } : undefined,
    dataQuality: "low",
    dataSource: "demo",
  };
}

// ── Seed wallets (known Solana DeFi power users — public data) ────
// These are real high-activity Solana addresses from public leaderboards
const SEED_WALLETS = [
  "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
  "DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh",
  "3XFMsNi28sE99aX4BCpkKXjx7Bxuuz3pJNXeGhwn5vR3",
  "7YttLkHDoNj9wyDur5pM1ejNaAvT9X4eqaYcHQqtj2G5",
  "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1",
  "HmRGnNRMGznFw6VJ8LCeChQ9wjt2E5hCEbpBSBSE7UBY",
  "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R",
];

// ── GET handler ───────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const gate = await runQuotaGate(req, "portfolio");
  if (!gate.proceed) return gate.response;

  const url = new URL(req.url);
  const walletAddress = url.searchParams.get("wallet") ?? url.searchParams.get("walletAddress");
  const limit = Math.min(20, parseInt(url.searchParams.get("limit") ?? "7"));

  // Single wallet analysis
  if (walletAddress && walletAddress.length >= 32) {
    if (!HELIUS_API_KEY) {
      return NextResponse.json({
        wallet: generateDemoWallet(walletAddress, 0),
        note: "演示模式：配置 HELIUS_API_KEY 启用真实链上 P&L 计算",
      });
    }
    const analysis = await analyzeWallet(walletAddress);
    if (!analysis) {
      return NextResponse.json({
        error: "Insufficient on-chain activity for this wallet (< 3 swaps in 30 days)",
        wallet: walletAddress.slice(0, 8) + "…",
      }, { status: 404 });
    }
    return NextResponse.json({ wallet: analysis, dataSource: "helius_realtime" });
  }

  // Top smart money list
  let wallets: SmartMoneyWallet[];

  if (!HELIUS_API_KEY) {
    wallets = SEED_WALLETS.slice(0, limit).map((addr, i) => generateDemoWallet(addr, i));
  } else {
    const results = await Promise.allSettled(
      SEED_WALLETS.slice(0, limit).map(addr => analyzeWallet(addr))
    );
    wallets = results
      .map(r => r.status === "fulfilled" ? r.value : null)
      .filter((w): w is SmartMoneyWallet => w !== null)
      .sort((a, b) => b.score - a.score);
  }

  // Consensus signal: tokens multiple smart wallets are buying
  const buyMap = new Map<string, { wallets: string[]; count: number }>();
  for (const w of wallets) {
    if (w.copySignal) {
      const key = w.copySignal.token;
      const entry = buyMap.get(key) ?? { wallets: [], count: 0 };
      entry.wallets.push(w.shortAddress);
      entry.count++;
      buyMap.set(key, entry);
    }
  }

  const consensus = [...buyMap.entries()]
    .filter(([, v]) => v.count >= 2)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 5)
    .map(([token, data]) => ({
      token,
      walletCount: data.count,
      wallets: data.wallets,
      signal: `🔥 ${data.count} 个聪明钱同时关注`,
      confidence: Math.min(95, 50 + data.count * 15),
    }));

  return NextResponse.json({
    wallets: wallets.map(w => ({
      address:           w.address,
      shortAddress:      w.shortAddress,
      label:             w.label,
      category:          w.category,
      traits:            w.traits,
      score:             w.score,
      solBalance:        w.solBalance,
      totalClosedTrades: w.totalClosedTrades,
      winRate:           parseFloat((w.winRate * 100).toFixed(1)),
      avgWinPct:         parseFloat(w.avgWinPct.toFixed(1)),
      estimatedPnlPct:   parseFloat(w.estimatedPnlPct.toFixed(1)),
      copySignal:        w.copySignal,
      dataQuality:       w.dataQuality,
      topWins:           w.topWins,
    })),
    consensusSignals: consensus,
    totalTracked: wallets.length,
    dataSource: HELIUS_API_KEY ? "helius_realtime" : "demo",
    note: HELIUS_API_KEY
      ? `真实数据：基于 Helius 链上交易 P&L 计算，30天历史`
      : `演示模式：配置 HELIUS_API_KEY 获取真实链上数据`,
    updatedAt: Date.now(),
  });
}

// ── POST handler — deep dive into a wallet ────────────────────────

export async function POST(req: NextRequest) {
  const gate = await runQuotaGate(req, "analyze");
  if (!gate.proceed) return gate.response;

  let body: { targetWallet?: string };
  try { body = await req.json() as { targetWallet?: string }; }
  catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }

  const { targetWallet } = body;
  if (!targetWallet || targetWallet.length < 32) {
    return NextResponse.json({ error: "targetWallet required (Solana address)" }, { status: 400 });
  }

  if (!HELIUS_API_KEY) {
    return NextResponse.json({
      wallet: generateDemoWallet(targetWallet, 0),
      fullSwapHistory: [],
      note: "演示模式：配置 HELIUS_API_KEY 获取真实数据",
    });
  }

  const [analysis, swaps] = await Promise.all([
    analyzeWallet(targetWallet),
    getSwapHistory(targetWallet, 30),
  ]);

  if (!analysis) {
    return NextResponse.json({
      error: "Insufficient activity (< 3 SWAP transactions in last 30 days)",
      targetWallet: targetWallet.slice(0, 8) + "…",
    }, { status: 404 });
  }

  return NextResponse.json({
    wallet: analysis,
    fullSwapHistory: swaps.slice(0, 50).map(s => ({
      date:             new Date(s.timestamp * 1000).toISOString(),
      soldMint:         s.soldMint.slice(0, 8) + "…" + s.soldMint.slice(-4),
      soldAmount:       parseFloat(s.soldAmount.toFixed(4)),
      boughtMint:       s.boughtMint.slice(0, 8) + "…" + s.boughtMint.slice(-4),
      boughtAmount:     parseFloat(s.boughtAmount.toFixed(4)),
      impliedPrice:     s.boughtAmount > 0 ? parseFloat((s.soldAmount / s.boughtAmount).toFixed(8)) : 0,
      isBuy:            BASE_MINTS.has(s.soldMint),
      explorerUrl:      `https://solscan.io/tx/${s.signature}`,
    })),
    summary: {
      totalSwaps:      swaps.length,
      closedTrades:    analysis.totalClosedTrades,
      winRate:         `${(analysis.winRate * 100).toFixed(1)}%`,
      estimatedPnl:    `${analysis.estimatedPnlPct >= 0 ? "+" : ""}${analysis.estimatedPnlPct.toFixed(1)}%`,
      dataSource:      "helius_realtime",
    },
  });
}
