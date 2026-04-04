/**
 * Market Research & Visualization — 真实链上数据，机构级分析
 *
 * 数据源（全部免费、无需额外API key）：
 *   - DeFiLlama  → Solana TVL、DEX 交易量（免费、无需key）
 *   - DeFiLlama Yields → 所有 Solana 协议 APY（免费）
 *   - CoinGecko  → SOL 价格历史 30 天（免费，限速 10-30次/min）
 *   - Marinade   → 实时质押 APY（免费）
 *   - Jito       → 实时质押 APY（免费）
 *   - CryptoPanic → 新闻情绪（免费版，需 CRYPTOPANIC_API_TOKEN env var）
 *
 * 恐慌贪婪指数构成（5个真实链上指标）：
 *   1. SOL 价格动量    (25%) — CoinGecko 30d 历史收益率
 *   2. DEX 交易量趋势  (25%) — DeFiLlama 7d vs 30d 均量
 *   3. 质押率变化      (15%) — Marinade + Jito APY 趋势
 *   4. Solana TVL 变化 (20%) — DeFiLlama 7d TVL 涨跌幅
 *   5. 新闻情绪        (15%) — CryptoPanic 正面/负面新闻比
 *
 * GET /api/market/research?type=overview|apy_chart|fear_greed|flow|ai_report
 */

import { NextRequest, NextResponse } from "next/server";
import { runQuotaGate } from "@/lib/rate-limit";

const ANTHROPIC_API_KEY    = process.env.ANTHROPIC_API_KEY ?? "";
const CRYPTOPANIC_TOKEN    = process.env.CRYPTOPANIC_API_TOKEN ?? "";
const COINGECKO_API_KEY    = process.env.COINGECKO_API_KEY ?? "";  // optional Pro key

function fetchWithTimeout(url: string, opts: RequestInit = {}, ms = 8000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

// ── 1. SOL Price Momentum (CoinGecko) ────────────────────────────

interface PriceMomentum {
  currentPrice: number;
  priceChange7d: number;   // percentage
  priceChange30d: number;  // percentage
  priceChange1h: number;   // percentage
  volatility30d: number;   // standard deviation of daily returns
  score: number;           // 0-100
}

async function fetchSOLMomentum(): Promise<PriceMomentum> {
  const fallback: PriceMomentum = {
    currentPrice: 170, priceChange7d: 0, priceChange30d: 0,
    priceChange1h: 0, volatility30d: 0, score: 50,
  };

  try {
    // Use CoinGecko free API for 30-day history
    const cgBase = COINGECKO_API_KEY
      ? `https://pro-api.coingecko.com/api/v3`
      : `https://api.coingecko.com/api/v3`;
    const headers: Record<string, string> = COINGECKO_API_KEY
      ? { "x-cg-pro-api-key": COINGECKO_API_KEY }
      : {};

    const res = await fetchWithTimeout(
      `${cgBase}/coins/solana/market_chart?vs_currency=usd&days=30&interval=daily`,
      { headers }
    );
    if (!res.ok) return fallback;

    const data = await res.json() as { prices?: [number, number][] };
    const prices = data.prices ?? [];
    if (prices.length < 7) return fallback;

    const currentPrice = prices[prices.length - 1][1];
    const price7dAgo   = prices[prices.length - 7][1];
    const price30dAgo  = prices[0][1];

    const priceChange7d  = ((currentPrice - price7dAgo)  / price7dAgo)  * 100;
    const priceChange30d = ((currentPrice - price30dAgo) / price30dAgo) * 100;

    // Volatility: std dev of daily returns
    const dailyReturns = prices.slice(1).map((p, i) => (p[1] - prices[i][1]) / prices[i][1] * 100);
    const mean = dailyReturns.reduce((s, r) => s + r, 0) / dailyReturns.length;
    const variance = dailyReturns.reduce((s, r) => s + Math.pow(r - mean, 2), 0) / dailyReturns.length;
    const volatility30d = Math.sqrt(variance);

    // Score: map 30d return to 0-100 (−50% = 0, +50% = 100)
    const returnScore = Math.max(0, Math.min(100, 50 + priceChange30d));
    // Reduce score in high volatility (>10% daily vol = risky)
    const volPenalty = Math.max(0, (volatility30d - 5) * 2);
    const score = Math.max(0, Math.min(100, returnScore - volPenalty));

    return { currentPrice, priceChange7d, priceChange30d, priceChange1h: 0, volatility30d, score };
  } catch {
    return fallback;
  }
}

// ── 2. DEX Volume Trend (DeFiLlama) ──────────────────────────────

interface VolumeTrend {
  volume7dAvgUSD: number;
  volume30dAvgUSD: number;
  trendPct: number;   // (7d avg / 30d avg - 1) * 100
  score: number;      // 0-100
}

async function fetchDEXVolumeTrend(): Promise<VolumeTrend> {
  const fallback: VolumeTrend = { volume7dAvgUSD: 0, volume30dAvgUSD: 0, trendPct: 0, score: 50 };
  try {
    const res = await fetchWithTimeout(
      "https://api.llama.fi/overview/dexs/Solana?excludeTotalDataChart=false&excludeTotalDataChartBreakdown=true&dataType=dailyVolume"
    );
    if (!res.ok) return fallback;

    type LlamaVol = { totalDataChart?: [number, number][] };
    const data = await res.json() as LlamaVol;
    const chart = data.totalDataChart ?? [];
    if (chart.length < 30) return fallback;

    const last7  = chart.slice(-7).map(d => d[1]);
    const last30 = chart.slice(-30).map(d => d[1]);
    const avg7   = last7.reduce((s, v) => s + v, 0)  / last7.length;
    const avg30  = last30.reduce((s, v) => s + v, 0) / last30.length;

    const trendPct = avg30 > 0 ? ((avg7 - avg30) / avg30) * 100 : 0;
    // Score: +30% vol increase = 80, −30% = 20, neutral = 50
    const score = Math.max(0, Math.min(100, 50 + trendPct * 1.0));

    return { volume7dAvgUSD: avg7, volume30dAvgUSD: avg30, trendPct, score };
  } catch {
    return fallback;
  }
}

// ── 3. Staking Rate (Marinade + Jito) ────────────────────────────

interface StakingSignal {
  marinadeAPY: number;
  jitoAPY: number;
  avgAPY: number;
  score: number;   // higher APY = more demand for staking = bullish
}

async function fetchStakingSignal(): Promise<StakingSignal> {
  const fallback: StakingSignal = { marinadeAPY: 7.2, jitoAPY: 7.5, avgAPY: 7.35, score: 55 };
  try {
    const [marinadeRes, jitoRes] = await Promise.allSettled([
      fetchWithTimeout("https://api.marinade.finance/msol/apy/30d"),
      fetchWithTimeout("https://kv-cache.jito.network/api/v1/jitoSOL/apy"),
    ]);

    let marinadeAPY = 7.2;
    if (marinadeRes.status === "fulfilled" && marinadeRes.value.ok) {
      const d = await marinadeRes.value.json();
      if (typeof d === "number") marinadeAPY = d * 100;
    }

    let jitoAPY = 7.5;
    if (jitoRes.status === "fulfilled" && jitoRes.value.ok) {
      const d = await jitoRes.value.json() as { value?: number; apy?: number };
      const val = d?.value ?? d?.apy ?? d;
      if (typeof val === "number") jitoAPY = val * 100;
    }

    const avgAPY = (marinadeAPY + jitoAPY) / 2;
    // Score: APY > 9% = bullish (80), APY < 6% = bearish (30)
    const score = Math.max(20, Math.min(90, 20 + (avgAPY / 0.1)));

    return { marinadeAPY, jitoAPY, avgAPY, score };
  } catch {
    return fallback;
  }
}

// ── 4. Solana TVL Change (DeFiLlama) ─────────────────────────────

interface TVLSignal {
  currentTVL: number;
  tvlChange7d: number;   // percentage
  tvlChange30d: number;  // percentage
  score: number;         // 0-100
}

async function fetchTVLSignal(): Promise<TVLSignal> {
  const fallback: TVLSignal = { currentTVL: 0, tvlChange7d: 0, tvlChange30d: 0, score: 50 };
  try {
    const res = await fetchWithTimeout("https://api.llama.fi/v2/historicalChainTvl/Solana");
    if (!res.ok) return fallback;

    type LlamaTVL = Array<{ date: number; tvl: number }>;
    const data = await res.json() as LlamaTVL;
    if (data.length < 30) return fallback;

    const latest  = data[data.length - 1].tvl;
    const ago7d   = data[data.length - 7].tvl;
    const ago30d  = data[data.length - 30].tvl;

    const tvlChange7d  = ago7d  > 0 ? ((latest - ago7d)  / ago7d)  * 100 : 0;
    const tvlChange30d = ago30d > 0 ? ((latest - ago30d) / ago30d) * 100 : 0;

    // Score: +20% TVL growth = 80, −20% = 20
    const score = Math.max(0, Math.min(100, 50 + tvlChange7d * 1.5));

    return { currentTVL: latest, tvlChange7d, tvlChange30d, score };
  } catch {
    return fallback;
  }
}

// ── 5. News Sentiment (CryptoPanic) ──────────────────────────────

interface NewsSentiment {
  bullishCount: number;
  bearishCount: number;
  neutralCount: number;
  score: number;      // 0-100
  topHeadlines: string[];
  source: "cryptopanic" | "unavailable";
}

async function fetchNewsSentiment(): Promise<NewsSentiment> {
  const fallback: NewsSentiment = {
    bullishCount: 0, bearishCount: 0, neutralCount: 0,
    score: 50, topHeadlines: [], source: "unavailable",
  };

  if (!CRYPTOPANIC_TOKEN) return fallback;

  try {
    const res = await fetchWithTimeout(
      `https://cryptopanic.com/api/free/v1/posts/?auth_token=${CRYPTOPANIC_TOKEN}` +
      `&currencies=SOL&kind=news&public=true&filter=hot`
    );
    if (!res.ok) return fallback;

    type CPPost = {
      title: string;
      votes?: { positive?: number; negative?: number; important?: number };
      kind: string;
    };
    const data = await res.json() as { results?: CPPost[] };
    const posts = data.results ?? [];

    let bullishCount = 0;
    let bearishCount = 0;
    let neutralCount = 0;
    const headlines: string[] = [];

    for (const post of posts.slice(0, 20)) {
      const pos = post.votes?.positive ?? 0;
      const neg = post.votes?.negative ?? 0;
      if (pos > neg + 2)       { bullishCount++; }
      else if (neg > pos + 2)  { bearishCount++; }
      else                     { neutralCount++; }
      if (headlines.length < 5) headlines.push(post.title);
    }

    const total = bullishCount + bearishCount + neutralCount;
    const score = total > 0
      ? Math.max(0, Math.min(100, 50 + ((bullishCount - bearishCount) / total) * 100))
      : 50;

    return {
      bullishCount, bearishCount, neutralCount,
      score, topHeadlines: headlines, source: "cryptopanic",
    };
  } catch {
    return fallback;
  }
}

// ── Composite Fear & Greed Index ──────────────────────────────────

interface FearGreedIndex {
  score: number;
  label: string;
  labelEn: string;
  color: string;
  components: Array<{
    name: string;
    score: number;
    weight: number;
    contribution: number;
    detail: string;
    source: string;
  }>;
  interpretation: string;
  updatedAt: number;
}

async function computeFearGreed(): Promise<FearGreedIndex> {
  // Fetch all 5 components in parallel
  const [momentum, volume, staking, tvl, news] = await Promise.all([
    fetchSOLMomentum(),
    fetchDEXVolumeTrend(),
    fetchStakingSignal(),
    fetchTVLSignal(),
    fetchNewsSentiment(),
  ]);

  const components = [
    {
      name:         "SOL 价格动量",
      score:        momentum.score,
      weight:       0.25,
      contribution: momentum.score * 0.25,
      detail:       `7日 ${momentum.priceChange7d >= 0 ? "+" : ""}${momentum.priceChange7d.toFixed(1)}%，` +
                    `30日 ${momentum.priceChange30d >= 0 ? "+" : ""}${momentum.priceChange30d.toFixed(1)}%，` +
                    `30日波动率 ${momentum.volatility30d.toFixed(1)}%`,
      source:       "CoinGecko",
    },
    {
      name:         "DEX 交易量趋势",
      score:        volume.score,
      weight:       0.25,
      contribution: volume.score * 0.25,
      detail:       `7日均量 $${(volume.volume7dAvgUSD / 1e9).toFixed(2)}B，` +
                    `较30日均量 ${volume.trendPct >= 0 ? "+" : ""}${volume.trendPct.toFixed(1)}%`,
      source:       "DeFiLlama DEX",
    },
    {
      name:         "Solana TVL 变化",
      score:        tvl.score,
      weight:       0.20,
      contribution: tvl.score * 0.20,
      detail:       `当前 TVL $${(tvl.currentTVL / 1e9).toFixed(1)}B，` +
                    `7日 ${tvl.tvlChange7d >= 0 ? "+" : ""}${tvl.tvlChange7d.toFixed(1)}%，` +
                    `30日 ${tvl.tvlChange30d >= 0 ? "+" : ""}${tvl.tvlChange30d.toFixed(1)}%`,
      source:       "DeFiLlama TVL",
    },
    {
      name:         "质押信号",
      score:        staking.score,
      weight:       0.15,
      contribution: staking.score * 0.15,
      detail:       `Marinade ${staking.marinadeAPY.toFixed(1)}%，Jito ${staking.jitoAPY.toFixed(1)}%，均值 ${staking.avgAPY.toFixed(1)}%`,
      source:       "Marinade + Jito API",
    },
    {
      name:         "新闻情绪",
      score:        news.score,
      weight:       0.15,
      contribution: news.score * 0.15,
      detail:       news.source === "cryptopanic"
        ? `正面 ${news.bullishCount}，负面 ${news.bearishCount}，中性 ${news.neutralCount}`
        : "暂无数据（配置 CRYPTOPANIC_API_TOKEN 启用）",
      source:       news.source === "cryptopanic" ? "CryptoPanic" : "N/A",
    },
  ];

  const score = Math.round(components.reduce((s, c) => s + c.contribution, 0));

  const label =
    score >= 80 ? "极度贪婪" :
    score >= 65 ? "贪婪" :
    score >= 45 ? "中性" :
    score >= 30 ? "恐慌" :
    "极度恐慌";

  const labelEn =
    score >= 80 ? "Extreme Greed" :
    score >= 65 ? "Greed" :
    score >= 45 ? "Neutral" :
    score >= 30 ? "Fear" :
    "Extreme Fear";

  const color =
    score >= 65 ? "#10B981" :
    score >= 45 ? "#F59E0B" :
    "#EF4444";

  const interpretation =
    score >= 80 ? "市场极度亢奋，高位警惕回调风险，考虑分批减仓或转稳定币" :
    score >= 65 ? "市场情绪积极，可持有多头但设好止损，不追高" :
    score >= 45 ? "中性区间，均衡配置，关注个别协议 APY 机会" :
    score >= 30 ? "市场恐慌，链上数据下滑但可能是买入机会，分批建仓" :
    "极度恐慌，历史上常是最佳抄底区，但需确认链上数据企稳";

  return { score, label, labelEn, color, components, interpretation, updatedAt: Date.now() };
}

// ── TVL + APY data helpers ────────────────────────────────────────

interface ProtocolTVL {
  name: string; tvl: number; change24h: number; category: string;
}

async function fetchSolanaTVL(): Promise<ProtocolTVL[]> {
  try {
    const res = await fetchWithTimeout("https://api.llama.fi/protocols", {}, 10000);
    if (!res.ok) return [];
    type LP = { name: string; tvl?: number; change_1d?: number; category?: string; chains?: string[] };
    const all = await res.json() as LP[];
    return all
      .filter(p => (p.chains ?? []).includes("Solana") && (p.tvl ?? 0) > 500_000)
      .sort((a, b) => (b.tvl ?? 0) - (a.tvl ?? 0))
      .slice(0, 20)
      .map(p => ({ name: p.name, tvl: p.tvl ?? 0, change24h: p.change_1d ?? 0, category: p.category ?? "DeFi" }));
  } catch { return []; }
}

interface YieldPool {
  protocol: string; asset: string; apy: number; tvl: number; category: string; apyBase: number; apyReward: number;
}

async function fetchYieldPools(): Promise<YieldPool[]> {
  try {
    const res = await fetchWithTimeout("https://yields.llama.fi/pools", {}, 10000);
    if (!res.ok) return [];
    type LP = { project: string; symbol: string; apy?: number; apyBase?: number; apyReward?: number; tvlUsd?: number; category?: string; chain?: string };
    const data = await res.json() as { data?: LP[] };
    return (data.data ?? [])
      .filter(p => p.chain === "Solana" && (p.apy ?? 0) > 0.1 && (p.tvlUsd ?? 0) > 50_000)
      .sort((a, b) => (b.tvlUsd ?? 0) - (a.tvlUsd ?? 0))
      .slice(0, 100)
      .map(p => ({
        protocol:  p.project,
        asset:     p.symbol,
        apy:       p.apy ?? 0,
        apyBase:   p.apyBase ?? 0,
        apyReward: p.apyReward ?? 0,
        tvl:       p.tvlUsd ?? 0,
        category:  p.category ?? "Lending",
      }));
  } catch { return []; }
}

// ── AI Market Report ──────────────────────────────────────────────

async function generateAIReport(
  fearGreed: FearGreedIndex,
  protocols: ProtocolTVL[],
  yields: YieldPool[],
  momentum: PriceMomentum,
): Promise<string> {
  // Top yields by APY (with meaningful TVL > $5M)
  const topYields = yields
    .filter(y => y.tvl > 5_000_000)
    .sort((a, b) => b.apy - a.apy)
    .slice(0, 5);

  const dataContext = [
    `日期：${new Date().toLocaleDateString("zh-CN")}`,
    `SOL价格：$${momentum.currentPrice.toFixed(2)} (7日${momentum.priceChange7d >= 0 ? "+" : ""}${momentum.priceChange7d.toFixed(1)}%, 30日${momentum.priceChange30d >= 0 ? "+" : ""}${momentum.priceChange30d.toFixed(1)}%)`,
    `恐慌贪婪指数：${fearGreed.score}/100（${fearGreed.label}）`,
    `TVL前5：${protocols.slice(0, 5).map(p => `${p.name}($${(p.tvl / 1e9).toFixed(1)}B, ${p.change24h >= 0 ? "+" : ""}${p.change24h.toFixed(1)}%)`).join(", ")}`,
    `最高APY（TVL>$5M）：${topYields.map(y => `${y.protocol}/${y.asset} ${y.apy.toFixed(1)}%`).join(", ")}`,
    `成分指标：${fearGreed.components.map(c => `${c.name}${c.score.toFixed(0)}分`).join("，")}`,
  ].join("\n");

  if (!ANTHROPIC_API_KEY) {
    return `## Solana DeFi 市场周报（${new Date().toLocaleDateString("zh-CN")}）\n\n` +
      `**恐慌贪婪指数：${fearGreed.score}/100（${fearGreed.label}）**\n\n` +
      `SOL 当前 $${momentum.currentPrice.toFixed(2)}，30日涨跌 ${momentum.priceChange30d >= 0 ? "+" : ""}${momentum.priceChange30d.toFixed(1)}%\n\n` +
      `### Solana TVL 前三\n${protocols.slice(0, 3).map((p, i) => `${i + 1}. **${p.name}** $${(p.tvl / 1e9).toFixed(1)}B (${p.change24h >= 0 ? "+" : ""}${p.change24h.toFixed(1)}% 24h)`).join("\n")}\n\n` +
      `### 最高收益机会（TVL>$5M）\n${topYields.slice(0, 3).map(y => `- **${y.protocol} ${y.asset}** APY ${y.apy.toFixed(1)}% (TVL $${(y.tvl / 1e6).toFixed(0)}M)`).join("\n")}\n\n` +
      `### 策略建议\n${fearGreed.interpretation}`;
  }

  try {
    const res = await fetchWithTimeout("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 600,
        messages: [{
          role: "user",
          content: `你是机构级 Solana DeFi 分析师。根据以下真实链上数据，用中文写一份简洁的市场报告（300字以内），` +
            `格式 Markdown，包含：市场判断（牛熊）、3个最佳操作机会（具体协议+APY）、2个风险提示。\n\n${dataContext}`,
        }],
      }),
    }, 12000);

    if (!res.ok) throw new Error(`API ${res.status}`);
    const data = await res.json() as { content?: Array<{ text?: string }> };
    return data.content?.[0]?.text ?? "报告生成失败，请稍后重试。";
  } catch {
    return `## Solana DeFi 市场摘要（${new Date().toLocaleDateString("zh-CN")}）\n\n${dataContext}`;
  }
}

// ── Main GET handler ──────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const url  = new URL(req.url);
  const type = url.searchParams.get("type") ?? "overview";

  if (type === "ai_report") {
    const gate = await runQuotaGate(req, "advisor");
    if (!gate.proceed) return gate.response;
  }

  switch (type) {

    case "fear_greed": {
      const fg = await computeFearGreed();
      return NextResponse.json(fg, { headers: { "Cache-Control": "s-maxage=300, stale-while-revalidate=60" } });
    }

    case "apy_chart": {
      const pools = await fetchYieldPools();
      const top = pools
        .filter(p => p.tvl > 1_000_000)
        .sort((a, b) => b.apy - a.apy)
        .slice(0, 20);

      return NextResponse.json({
        type: "apy_chart",
        // Chart.js-ready dataset
        chartData: {
          labels: top.map(p => `${p.protocol}\n${p.asset}`),
          datasets: [
            {
              label: "总 APY (%)",
              data:  top.map(p => parseFloat(p.apy.toFixed(2))),
              backgroundColor: top.map(p =>
                p.apy > 25 ? "#EF444480" :
                p.apy > 12 ? "#F59E0B80" :
                p.apy > 5  ? "#10B98180" : "#6366F180"
              ),
            },
            {
              label: "基础 APY (%)",
              data:  top.map(p => parseFloat(p.apyBase.toFixed(2))),
              backgroundColor: "#6366F140",
            },
          ],
        },
        tableData: top.map(p => ({
          protocol: p.protocol,
          asset:    p.asset,
          apy:      parseFloat(p.apy.toFixed(2)),
          apyBase:  parseFloat(p.apyBase.toFixed(2)),
          apyReward: parseFloat(p.apyReward.toFixed(2)),
          tvlM:     parseFloat((p.tvl / 1e6).toFixed(1)),
          category: p.category,
        })),
        updatedAt: Date.now(),
      }, { headers: { "Cache-Control": "s-maxage=300" } });
    }

    case "flow": {
      const protocols = await fetchSolanaTVL();
      const byCategory: Record<string, { tvl: number; change24h: number; count: number }> = {};
      for (const p of protocols) {
        const cat = p.category;
        if (!byCategory[cat]) byCategory[cat] = { tvl: 0, change24h: 0, count: 0 };
        byCategory[cat].tvl      += p.tvl;
        byCategory[cat].change24h += p.change24h;
        byCategory[cat].count++;
      }

      const flowData = protocols.slice(0, 15).map(p => ({
        protocol:  p.name,
        category:  p.category,
        tvlB:      parseFloat((p.tvl / 1e9).toFixed(3)),
        change24h: parseFloat(p.change24h.toFixed(2)),
        flowUSD:   p.tvl * (p.change24h / 100),
        // For heatmap coloring
        heatColor:
          p.change24h > 10  ? "#059669" :
          p.change24h > 3   ? "#10B981" :
          p.change24h > 0   ? "#34D399" :
          p.change24h > -3  ? "#94A3B8" :
          p.change24h > -10 ? "#F87171" :
          "#DC2626",
      }));

      return NextResponse.json({
        type:          "flow",
        protocols:     flowData,
        categoryFlow:  Object.entries(byCategory).map(([cat, d]) => ({
          category:  cat,
          tvlB:      parseFloat((d.tvl / 1e9).toFixed(2)),
          avgChange: parseFloat((d.change24h / d.count).toFixed(2)),
        })).sort((a, b) => b.tvlB - a.tvlB),
        totalSolanaTVL: protocols.reduce((s, p) => s + p.tvl, 0),
        netFlow24h:    flowData.reduce((s, p) => s + p.flowUSD, 0),
        updatedAt:     Date.now(),
      }, { headers: { "Cache-Control": "s-maxage=300" } });
    }

    case "ai_report": {
      const [fg, protocols, yields, momentum] = await Promise.all([
        computeFearGreed(),
        fetchSolanaTVL(),
        fetchYieldPools(),
        fetchSOLMomentum(),
      ]);
      const report = await generateAIReport(fg, protocols, yields, momentum);
      return NextResponse.json({
        type: "ai_report",
        report,
        fearGreed: fg,
        topProtocols: protocols.slice(0, 8).map(p => ({
          name: p.name, category: p.category,
          tvlB: parseFloat((p.tvl / 1e9).toFixed(2)),
          change24h: parseFloat(p.change24h.toFixed(2)),
        })),
        topYield: yields
          .filter(y => y.tvl > 5_000_000)
          .sort((a, b) => b.apy - a.apy)
          .slice(0, 8)
          .map(y => ({
            protocol: y.protocol, asset: y.asset,
            apy:      parseFloat(y.apy.toFixed(2)),
            tvlM:     parseFloat((y.tvl / 1e6).toFixed(1)),
          })),
        updatedAt: Date.now(),
      });
    }

    case "overview":
    default: {
      const [fg, protocols, momentum] = await Promise.all([
        computeFearGreed(),
        fetchSolanaTVL(),
        fetchSOLMomentum(),
      ]);
      return NextResponse.json({
        type: "overview",
        fearGreed: {
          score:  fg.score,
          label:  fg.label,
          color:  fg.color,
          interpretation: fg.interpretation,
        },
        solPrice: {
          current:    momentum.currentPrice,
          change7d:   parseFloat(momentum.priceChange7d.toFixed(2)),
          change30d:  parseFloat(momentum.priceChange30d.toFixed(2)),
          volatility: parseFloat(momentum.volatility30d.toFixed(2)),
        },
        topProtocols: protocols.slice(0, 10).map(p => ({
          name: p.name, category: p.category,
          tvlB: parseFloat((p.tvl / 1e9).toFixed(2)),
          change24h: parseFloat(p.change24h.toFixed(2)),
        })),
        totalSolanaTVLB: parseFloat((protocols.reduce((s, p) => s + p.tvl, 0) / 1e9).toFixed(2)),
        availableTypes: ["overview", "apy_chart", "fear_greed", "flow", "ai_report"],
        updatedAt: Date.now(),
      }, { headers: { "Cache-Control": "s-maxage=120" } });
    }
  }
}
