/**
 * Solana Agent Kit — unified initialization for Sakura.
 * All three plugins: TokenPlugin (prices, rug checks), DefiPlugin (stake/lend/swap), MiscPlugin (Jito).
 *
 * Three agent types:
 *  - createReadOnlyAgent()  — ephemeral keypair, signOnly: true — safe for price/data fetches
 *  - createSigningAgent()   — platform keypair (SOLIS_AGENT_PRIVATE_KEY) — for server-side Memo writes
 *
 * Tool wrappers at the bottom are used as Claude tool backends in /api/agent/loop/route.ts
 */

import { SolanaAgentKit, KeypairWallet } from "solana-agent-kit";
import TokenPlugin from "@solana-agent-kit/plugin-token";
import DefiPlugin  from "@solana-agent-kit/plugin-defi";
import MiscPlugin  from "@solana-agent-kit/plugin-misc";
import { Keypair, PublicKey, Connection } from "@solana/web3.js";

const HELIUS_API_KEY = process.env.HELIUS_API_KEY ?? "";
export const RPC_URL =
  process.env.HELIUS_RPC_URL ??
  `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

export const SOL_MINT = new PublicKey(
  "So11111111111111111111111111111111111111112"
);
export const USDC_MINT = new PublicKey(
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v"
);

// ── Agent factories ──────────────────────────────────────────────────────────

/**
 * Read-only agent: ephemeral keypair, signOnly mode.
 * Safe to use in any API route for data fetches (price, rug check, balance).
 */
export function createReadOnlyAgent() {
  const keypair = Keypair.generate();
  const wallet = new KeypairWallet(keypair, RPC_URL);
  return new SolanaAgentKit(wallet, RPC_URL, {
    HELIUS_API_KEY,
    ELFA_AI_API_KEY:   process.env.ELFA_API_KEY ?? "",
    ALLORA_API_KEY:    process.env.ALLORA_API_KEY ?? "",
    signOnly: true,
  })
    .use(TokenPlugin)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .use(DefiPlugin as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .use(MiscPlugin as any);
}

/**
 * Platform signing agent: uses SOLIS_AGENT_PRIVATE_KEY env var.
 * Used for server-side Memo writes (pre-commitment proofs).
 * Returns null if key is not configured.
 */
export function createSigningAgent() {
  const raw = process.env.SOLIS_AGENT_PRIVATE_KEY;
  if (!raw) return null;
  try {
    const arr = JSON.parse(raw) as number[];
    const keypair = Keypair.fromSecretKey(Uint8Array.from(arr));
    const wallet = new KeypairWallet(keypair, RPC_URL);
    return new SolanaAgentKit(wallet, RPC_URL, { HELIUS_API_KEY })
      .use(TokenPlugin);
  } catch {
    return null;
  }
}

// ── SAK tool wrappers (Claude tool backends) ─────────────────────────────────

/**
 * Get current USD price of any Solana token via Jupiter (TokenPlugin).
 */
export async function sakGetTokenPrice(
  mintPubkey: PublicKey
): Promise<number | null> {
  try {
    const agent = createReadOnlyAgent();
    const priceStr = await agent.methods.fetchPrice(mintPubkey);
    const n = parseFloat(priceStr as string);
    return isNaN(n) || n <= 0 ? null : n;
  } catch {
    return null;
  }
}

/**
 * Jupiter Shield rug check — returns safety report for a token mint.
 */
export async function sakGetTokenReport(mintStr: string): Promise<{
  score: number;
  risks: string[];
  raw: unknown;
} | null> {
  try {
    const agent = createReadOnlyAgent();
    const report = await agent.methods.fetchTokenReportSummary(mintStr);
    return report as unknown as { score: number; risks: string[]; raw: unknown };
  } catch {
    return null;
  }
}

/**
 * Get SOL balance for a wallet address.
 */
export async function sakGetBalance(walletAddress: string): Promise<{
  sol: number;
  usd: number | null;
} | null> {
  try {
    const conn = new Connection(RPC_URL, "confirmed");
    const pubkey = new PublicKey(walletAddress);
    const lamports = await conn.getBalance(pubkey);
    const sol = lamports / 1e9;
    const usdPrice = await sakGetTokenPrice(SOL_MINT);
    return { sol, usd: usdPrice ? sol * usdPrice : null };
  } catch {
    return null;
  }
}

/**
 * Prepare a Marinade or Jito stake transaction.
 * Returns a descriptor for the Claude tool result; actual signing happens client-side via Phantom StakeModal.
 */
export async function sakPrepareStakeTx(
  amountSol: number,
  protocol: "marinade" | "jito"
): Promise<{ protocol: string; amount: number; note: string } | null> {
  return {
    protocol,
    amount: amountSol,
    note: `Stake ${amountSol} SOL to ${protocol}. Transaction will be signed by user's Phantom wallet.`,
  };
}

/**
 * Prepare a USDC lending transaction via Lulo (SAK DefiPlugin).
 */
export async function sakPrepareLendTx(
  amountUsdc: number
): Promise<{ amount: number; note: string } | null> {
  return {
    amount: amountUsdc,
    note: `Lend ${amountUsdc} USDC to Kamino/Lulo. Transaction will be signed by user's Phantom wallet.`,
  };
}

/**
 * Prepare a Jupiter swap (returns descriptor; actual tx built client-side via Phantom).
 */
export async function sakPrepareSwapTx(
  inputMint: string,
  outputMint: string,
  amountIn: number
): Promise<{ amount: number; note: string } | null> {
  return {
    amount: amountIn,
    note: `Swap ${amountIn} (inputMint: ${inputMint.slice(0, 8)}... → outputMint: ${outputMint.slice(0, 8)}...) via Jupiter. Transaction will be signed by user's Phantom wallet.`,
  };
}

// ── Trending Tokens via SAK MiscPlugin (真正使用 SAK) ────────────────
export async function sakGetTrendingTokens(): Promise<{ id: string; name: string; symbol: string; price_change_24h: number }[]> {
  // 優先使用 SAK MiscPlugin.getTrendingTokens()，失敗回退 CoinGecko direct
  try {
    const agent = createReadOnlyAgent();
    const result = await (agent.methods as Record<string, (...args: unknown[]) => Promise<unknown>>)
      .getTrendingTokens?.() as { coins?: { item: { id: string; name: string; symbol: string; data?: { price_change_percentage_24h?: { usd?: number } } } }[] } | undefined;
    if (result?.coins?.length) {
      return result.coins.slice(0, 10).map(c => ({
        id:               c.item.id,
        name:             c.item.name,
        symbol:           c.item.symbol,
        price_change_24h: c.item.data?.price_change_percentage_24h?.usd ?? 0,
      }));
    }
  } catch { /* fallback below */ }
  // Fallback: CoinGecko direct
  try {
    const headers: Record<string, string> = process.env.COINGECKO_API_KEY
      ? { "x-cg-pro-api-key": process.env.COINGECKO_API_KEY } : {};
    const res = await fetch("https://api.coingecko.com/api/v3/search/trending", { headers, next: { revalidate: 300 } });
    if (!res.ok) return [];
    const data = await res.json() as { coins?: { item: { id: string; name: string; symbol: string; data?: { price_change_percentage_24h?: { usd?: number } } } }[] };
    return (data.coins ?? []).slice(0, 10).map(c => ({
      id:               c.item.id,
      name:             c.item.name,
      symbol:           c.item.symbol,
      price_change_24h: c.item.data?.price_change_percentage_24h?.usd ?? 0,
    }));
  } catch { return []; }
}

// ── Allora AI Price Inference via SAK MiscPlugin (真正使用 SAK) ──────
export async function sakGetAlloraInference(topicId: number = 14): Promise<{ prediction: number; confidence: string } | null> {
  void topicId;
  // 優先使用 SAK MiscPlugin.getPriceInference("SOL")
  try {
    const agent = createReadOnlyAgent();
    const result = await (agent.methods as Record<string, (...args: unknown[]) => Promise<unknown>>)
      .getPriceInference?.("SOL", "5m") as { inference_data?: { network_inference_normalized?: string } } | undefined;
    const raw = result?.inference_data?.network_inference_normalized;
    if (raw) {
      const prediction = parseFloat(raw);
      return { prediction, confidence: prediction > 0 ? "bullish" : "bearish" };
    }
  } catch { /* fallback below */ }
  // Fallback: Allora REST API direct
  try {
    const res = await fetch(
      "https://api.upshot.xyz/v2/allora/consumer/price/ethereum-11155111/token/solana?signal_type=5m",
      { headers: process.env.ALLORA_API_KEY ? { "x-api-key": process.env.ALLORA_API_KEY } : {}, next: { revalidate: 60 } }
    );
    if (!res.ok) return null;
    const json = await res.json() as { data?: { inference_data?: { network_inference_normalized?: string } } };
    const raw = json.data?.inference_data?.network_inference_normalized;
    if (!raw) return null;
    const prediction = parseFloat(raw);
    return { prediction, confidence: prediction > 0 ? "bullish" : "bearish" };
  } catch { return null; }
}

// ── Social Sentiment via SAK MiscPlugin (真正使用 SAK) ───────────────
export async function sakGetSocialSentiment(ticker: string): Promise<{ mentionCount: number; sentiment: "bullish" | "bearish" | "neutral"; topMentions: string[] } | null> {
  // 優先使用 SAK MiscPlugin.getTopMentionsByTicker(ticker)
  try {
    if (process.env.ELFA_API_KEY) {
      const agent = createReadOnlyAgent();
      const result = await (agent.methods as Record<string, (...args: unknown[]) => Promise<unknown>>)
        .getTopMentionsByTicker?.(ticker, 5) as { mentions?: { text: string; sentiment?: string }[]; total?: number } | undefined;
      if (result?.mentions?.length) {
        const mentions   = result.mentions;
        const total      = result.total ?? mentions.length;
        const bullCount  = mentions.filter(m => m.sentiment === "positive").length;
        const bearCount  = mentions.filter(m => m.sentiment === "negative").length;
        const sentiment: "bullish" | "bearish" | "neutral" = bullCount > bearCount ? "bullish" : bearCount > bullCount ? "bearish" : "neutral";
        return { mentionCount: total, sentiment, topMentions: mentions.slice(0, 3).map(m => m.text.slice(0, 80)) };
      }
    }
  } catch { /* fallback below */ }
  // Fallback: Elfa REST API direct
  try {
    if (!process.env.ELFA_API_KEY) return null;
    const res = await fetch(
      `https://api.elfa.ai/v1/mentions/top-by-ticker?ticker=${encodeURIComponent(ticker)}&limit=5`,
      { headers: { "x-elfa-api-key": process.env.ELFA_API_KEY }, next: { revalidate: 300 } }
    );
    if (!res.ok) return null;
    const json = await res.json() as { data?: { mentions?: { text: string; sentiment?: string }[]; total?: number } };
    const mentions  = json.data?.mentions ?? [];
    const total     = json.data?.total ?? 0;
    const bullCount = mentions.filter(m => m.sentiment === "positive").length;
    const bearCount = mentions.filter(m => m.sentiment === "negative").length;
    const sentiment: "bullish" | "bearish" | "neutral" = bullCount > bearCount ? "bullish" : bearCount > bullCount ? "bearish" : "neutral";
    return { mentionCount: total, sentiment, topMentions: mentions.slice(0, 3).map(m => m.text.slice(0, 80)) };
  } catch { return null; }
}

// ── OKX DEX Quote (with Jupiter comparison) ───────────────────────
import { createHmac } from "crypto";

export interface OkxQuoteResult {
  jupiter:   { outAmount: number; priceImpactPct: number; routePlan: string } | null;
  okxDex:    { outAmount: number; priceImpact: string; router: string } | null;
  bestRoute: "jupiter" | "okx" | "unavailable";
  savings?:  number; // USD savings if using best route vs other
}

function okxAuthHeaders(path: string, params: string): Record<string, string> {
  const key        = process.env.OKX_API_KEY ?? "";
  const secret     = process.env.OKX_SECRET_KEY ?? "";
  const passphrase = process.env.OKX_API_PASSPHRASE ?? "";
  const projectId  = process.env.OKX_PROJECT_ID ?? "";
  if (!key || !secret) return {};
  const ts   = new Date().toISOString();
  const msg  = `${ts}GET${path}?${params}`;
  const sign = createHmac("sha256", secret).update(msg).digest("base64");
  return {
    "OK-ACCESS-KEY":       key,
    "OK-ACCESS-SIGN":      sign,
    "OK-ACCESS-TIMESTAMP": ts,
    "OK-ACCESS-PASSPHRASE":passphrase,
    ...(projectId ? { "OK-PROJECT-ID": projectId } : {}),
  };
}

export async function sakGetOkxQuote(
  fromTokenAddress: string,
  toTokenAddress: string,
  amount: number  // in smallest unit (lamports for SOL)
): Promise<OkxQuoteResult> {
  const SOL_ADDR = "So11111111111111111111111111111111111111112";
  const USDC_ADDR = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

  // ── Jupiter quote ──────────────────────────────────────────────
  let jupiterResult: OkxQuoteResult["jupiter"] = null;
  try {
    const jupUrl = `https://quote-api.jup.ag/v6/quote?inputMint=${fromTokenAddress}&outputMint=${toTokenAddress}&amount=${amount}&slippageBps=50`;
    const jupRes = await fetch(jupUrl, { next: { revalidate: 10 } });
    if (jupRes.ok) {
      const j = await jupRes.json() as { outAmount: string; priceImpactPct: string; routePlan?: { swapInfo: { label: string } }[] };
      jupiterResult = {
        outAmount: Number(j.outAmount),
        priceImpactPct: parseFloat(j.priceImpactPct),
        routePlan: j.routePlan?.map(r => r.swapInfo.label).join(" → ") ?? "Jupiter",
      };
    }
  } catch { /* ignore */ }

  // ── OKX DEX quote ─────────────────────────────────────────────
  let okxResult: OkxQuoteResult["okxDex"] = null;
  const okxHasAuth = !!(process.env.OKX_API_KEY && process.env.OKX_SECRET_KEY);
  if (okxHasAuth) {
    try {
      const chainId = "501"; // Solana
      const fromAddr = fromTokenAddress === SOL_ADDR
        ? "11111111111111111111111111111111" // OKX uses native address for SOL
        : fromTokenAddress;
      const toAddr = toTokenAddress === USDC_ADDR
        ? USDC_ADDR
        : toTokenAddress;
      const params = `chainId=${chainId}&fromTokenAddress=${fromAddr}&toTokenAddress=${toAddr}&amount=${amount}`;
      const path = "/api/v5/dex/aggregator/quote";
      const headers = okxAuthHeaders(path, params);
      const okxRes = await fetch(`https://www.okx.com${path}?${params}`, {
        headers: { ...headers, "Content-Type": "application/json" },
        next: { revalidate: 10 },
      });
      if (okxRes.ok) {
        const o = await okxRes.json() as { data?: { toTokenAmount: string; priceImpactPercentage: string; dexRouterList?: { router: string }[] }[] };
        const d = o.data?.[0];
        if (d) {
          okxResult = {
            outAmount: Number(d.toTokenAmount),
            priceImpact: d.priceImpactPercentage,
            router: d.dexRouterList?.[0]?.router ?? "OKX DEX",
          };
        }
      }
    } catch { /* ignore */ }
  }

  // ── Determine best route ───────────────────────────────────────
  const jupOut = jupiterResult?.outAmount ?? 0;
  const okxOut = okxResult?.outAmount ?? 0;

  let bestRoute: OkxQuoteResult["bestRoute"] = "unavailable";
  let savings: number | undefined;

  if (jupOut > 0 && okxOut > 0) {
    bestRoute = okxOut >= jupOut ? "okx" : "jupiter";
    const diff = Math.abs(okxOut - jupOut);
    // savings in output token units (divide by token decimals elsewhere)
    savings = diff;
  } else if (jupOut > 0) {
    bestRoute = "jupiter";
  } else if (okxOut > 0) {
    bestRoute = "okx";
  }

  return { jupiter: jupiterResult, okxDex: okxResult, bestRoute, savings };
}

// ── Sanctum LST APY via SAK DefiPlugin (真正使用 SAK) ────────────────
export async function sakGetSanctumAPY(): Promise<{ name: string; symbol: string; apy: number; tvl: number }[]> {
  const known: { symbol: string; name: string; mint: string }[] = [
    { symbol: "mSOL",    name: "Marinade SOL",   mint: "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So" },
    { symbol: "JitoSOL", name: "Jito SOL",       mint: "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn" },
    { symbol: "bSOL",    name: "BlazeStake SOL", mint: "bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1" },
    { symbol: "stSOL",   name: "Lido stSOL",     mint: "7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj" },
  ];
  // 優先使用 SAK DefiPlugin.sanctumGetLSTAPY(mint)
  try {
    const agent  = createReadOnlyAgent();
    const method = (agent.methods as Record<string, (...args: unknown[]) => Promise<unknown>>).sanctumGetLSTAPY;
    if (method) {
      const results = await Promise.allSettled(known.map(k => method(k.mint)));
      const apyList = results.map((r, i) => ({
        name:   known[i].name,
        symbol: known[i].symbol,
        apy:    r.status === "fulfilled" ? (typeof r.value === "number" ? r.value : 0) : 0,
        tvl:    0,
      })).filter(k => k.apy > 0).sort((a, b) => b.apy - a.apy);
      if (apyList.length) return apyList;
    }
  } catch { /* fallback below */ }
  // Fallback: Sanctum REST API direct
  try {
    const res = await fetch("https://sanctum-extra-api.ngrok.dev/v1/apy/latest?lst=all", { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const json = await res.json() as { apys?: Record<string, number> };
    const apys = json.apys ?? {};
    return known
      .map(k => ({ name: k.name, symbol: k.symbol, apy: apys[k.mint] ?? 0, tvl: 0 }))
      .filter(k => k.apy > 0)
      .sort((a, b) => b.apy - a.apy);
  } catch { return []; }
}

// ── 5 個新增 SAK 高價值工具 ───────────────────────────────────────────

/**
 * 1. Resolve token ticker → mint address (SAK TokenPlugin)
 * AI 顧問可自動解析「買 WIF」→ 找 mint，無需用戶手動貼地址
 */
export async function sakGetTokenByTicker(ticker: string): Promise<{ mint: string; name: string; symbol: string } | null> {
  try {
    const agent  = createReadOnlyAgent();
    const result = await (agent.methods as Record<string, (...args: unknown[]) => Promise<unknown>>)
      .getTokenAddressFromTicker?.(ticker) as string | { mintAddress?: string; name?: string; symbol?: string } | undefined;
    if (!result) return null;
    if (typeof result === "string") return { mint: result, name: ticker, symbol: ticker.toUpperCase() };
    return { mint: result.mintAddress ?? "", name: result.name ?? ticker, symbol: result.symbol ?? ticker.toUpperCase() };
  } catch { return null; }
}

/**
 * 2. Top Gainers today (SAK MiscPlugin)
 * 今日漲幅最大代幣
 */
export async function sakGetTopGainers(): Promise<{ name: string; symbol: string; priceChangePercent: number; price: number }[]> {
  try {
    const agent  = createReadOnlyAgent();
    const result = await (agent.methods as Record<string, (...args: unknown[]) => Promise<unknown>>)
      .getTopGainers?.("24h") as { coins?: { name: string; symbol: string; data?: { price_change_percentage_24h?: { usd?: number }; current_price?: number } }[] } | undefined;
    if (result?.coins?.length) {
      return result.coins.slice(0, 10).map(c => ({
        name:              c.name,
        symbol:            c.symbol,
        priceChangePercent: c.data?.price_change_percentage_24h?.usd ?? 0,
        price:             c.data?.current_price ?? 0,
      }));
    }
  } catch { /* fallback */ }
  // Fallback: CoinGecko top gainers
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=price_change_percentage_24h_desc&per_page=10&page=1",
      { next: { revalidate: 300 } }
    );
    if (!res.ok) return [];
    const data = await res.json() as { name: string; symbol: string; price_change_percentage_24h: number; current_price: number }[];
    return data.map(c => ({ name: c.name, symbol: c.symbol.toUpperCase(), priceChangePercent: c.price_change_percentage_24h, price: c.current_price }));
  } catch { return []; }
}

/**
 * 3. Trending Pools (SAK MiscPlugin)
 * 最新熱門流動池（Raydium/Orca/Meteora）
 */
export async function sakGetTrendingPools(): Promise<{ poolAddress: string; token0: string; token1: string; volume24h: number; apr?: number }[]> {
  try {
    const agent  = createReadOnlyAgent();
    const result = await (agent.methods as Record<string, (...args: unknown[]) => Promise<unknown>>)
      .getTrendingPools?.("solana") as { pools?: { address: string; base_token_info?: { symbol: string }; quote_token_info?: { symbol: string }; volume24h?: number; apr?: number }[] } | undefined;
    if (result?.pools?.length) {
      return result.pools.slice(0, 10).map(p => ({
        poolAddress: p.address,
        token0:      p.base_token_info?.symbol ?? "?",
        token1:      p.quote_token_info?.symbol ?? "?",
        volume24h:   p.volume24h ?? 0,
        apr:         p.apr,
      }));
    }
  } catch { /* fallback */ }
  // Fallback: DexScreener trending
  try {
    const res = await fetch("https://api.dexscreener.com/latest/dex/search?q=sol", { next: { revalidate: 300 } });
    if (!res.ok) return [];
    const data = await res.json() as { pairs?: { pairAddress: string; baseToken: { symbol: string }; quoteToken: { symbol: string }; volume: { h24: number }; info?: { events?: { h24?: { priceChangePercent?: number } } } }[] };
    return (data.pairs ?? []).slice(0, 10).map(p => ({
      poolAddress: p.pairAddress,
      token0:      p.baseToken.symbol,
      token1:      p.quoteToken.symbol,
      volume24h:   p.volume.h24,
    }));
  } catch { return []; }
}

/**
 * 4. Bridge Quote via SAK DefiPlugin (deBridge)
 * 跨鏈橋接報價，支持 Solana → Ethereum/BSC/Arbitrum
 */
export async function sakGetBridgeQuote(
  toChainId: number,   // 1=Ethereum, 56=BSC, 42161=Arbitrum
  tokenAddress: string,
  amount: number,
  recipient?: string
): Promise<{ estimatedOutput: number; fee: number; estimatedTime: string; bridge: string } | null> {
  try {
    const agent  = createReadOnlyAgent();
    const result = await (agent.methods as Record<string, (...args: unknown[]) => Promise<unknown>>)
      .getBridgeQuote?.(
        101,           // Solana chainId (deBridge uses 101 for Solana)
        tokenAddress,
        0,             // slippage
        amount,
        toChainId,
        tokenAddress,  // same token address on dest chain
        recipient ?? "0x0000000000000000000000000000000000000000"
      ) as { estimation?: { fromAmount?: string; toAmount?: string; costsDetails?: { fixFee?: string }[] }; order?: { approximateFulfillmentDelay?: number } } | undefined;
    if (result?.estimation) {
      return {
        estimatedOutput: Number(result.estimation.toAmount ?? 0),
        fee:             Number(result.estimation.costsDetails?.[0]?.fixFee ?? 0),
        estimatedTime:   `~${Math.ceil((result.order?.approximateFulfillmentDelay ?? 300) / 60)} 分鐘`,
        bridge:          "deBridge",
      };
    }
  } catch { /* no fallback for bridge quotes */ }
  return null;
}

/**
 * 5. Drift Lending/Borrow APY via SAK DefiPlugin
 * Drift Protocol 借貸市場實時利率
 */
export async function sakGetDriftBorrowAPY(): Promise<{ token: string; depositAPY: number; borrowAPY: number }[]> {
  try {
    const agent  = createReadOnlyAgent();
    const result = await (agent.methods as Record<string, (...args: unknown[]) => Promise<unknown>>)
      .getLendingAndBorrowAPY?.("SOL") as { depositAPY?: number; borrowAPY?: number } | undefined;
    if (result) {
      return [
        { token: "SOL",  depositAPY: result.depositAPY ?? 0, borrowAPY: result.borrowAPY ?? 0 },
      ];
    }
  } catch { /* fallback below */ }
  // Fallback: Kamino API for lending rates
  try {
    const res = await fetch("https://api.kamino.finance/strategies/metrics/history?limit=1", { next: { revalidate: 1800 } });
    if (!res.ok) return [];
    const data = await res.json() as { metrics?: { netApy?: number; token?: string }[] };
    return (data.metrics ?? []).slice(0, 5).map(m => ({
      token:      m.token ?? "USDC",
      depositAPY: m.netApy ?? 0,
      borrowAPY:  0,
    }));
  } catch { return []; }
}

// ── 新數據源：DeFiLlama + Fear & Greed ─────────────────────────────────────

/**
 * DeFiLlama — Solana 生態 TVL + 高收益池
 * 完全免費公開 API，無需 Key
 */
export interface DefiLlamaResult {
  solanaTVL: number;           // Solana 鏈總 TVL (USD)
  tvl24hChange: number;        // 24h TVL 變化 %
  topProtocols: Array<{
    name: string;
    tvl: number;
    change24h: number;
    category: string;
  }>;
  topYieldPools: Array<{
    project: string;
    symbol: string;
    apy: number;
    tvlUsd: number;
    chain: string;
  }>;
}

export async function sakGetDefiLlamaData(): Promise<DefiLlamaResult> {
  const empty: DefiLlamaResult = { solanaTVL: 0, tvl24hChange: 0, topProtocols: [], topYieldPools: [] };
  try {
    // 並行請求：鏈 TVL + 協議列表 + 收益池
    const [chainsRes, protocolsRes, yieldsRes] = await Promise.allSettled([
      fetch("https://api.llama.fi/v2/chains",    { next: { revalidate: 1800 } }),
      fetch("https://api.llama.fi/protocols",     { next: { revalidate: 1800 } }),
      fetch("https://yields.llama.fi/pools",      { next: { revalidate: 1800 } }),
    ]);

    // Solana 鏈 TVL
    let solanaTVL = 0;
    let tvl24hChange = 0;
    if (chainsRes.status === "fulfilled" && chainsRes.value.ok) {
      const chains = await chainsRes.value.json() as Array<{
        name: string; tvl: number; change_1d?: number;
      }>;
      const sol = chains.find(c => c.name.toLowerCase() === "solana");
      if (sol) { solanaTVL = sol.tvl; tvl24hChange = sol.change_1d ?? 0; }
    }

    // Solana 協議 Top 8（按 TVL 排序）
    let topProtocols: DefiLlamaResult["topProtocols"] = [];
    if (protocolsRes.status === "fulfilled" && protocolsRes.value.ok) {
      const protocols = await protocolsRes.value.json() as Array<{
        name: string; tvl: number; change_1d?: number; category?: string;
        chains?: string[];
      }>;
      topProtocols = protocols
        .filter(p => p.chains?.some(c => c.toLowerCase() === "solana") && p.tvl > 1_000_000)
        .sort((a, b) => b.tvl - a.tvl)
        .slice(0, 8)
        .map(p => ({
          name:      p.name,
          tvl:       Math.round(p.tvl),
          change24h: p.change_1d ?? 0,
          category:  p.category ?? "DeFi",
        }));
    }

    // Solana 高收益池 Top 8（APY > 3%，TVL > $500K）
    let topYieldPools: DefiLlamaResult["topYieldPools"] = [];
    if (yieldsRes.status === "fulfilled" && yieldsRes.value.ok) {
      const yieldsData = await yieldsRes.value.json() as {
        data?: Array<{ project: string; symbol: string; apy: number; tvlUsd: number; chain: string }>;
      };
      topYieldPools = (yieldsData.data ?? [])
        .filter(p => p.chain === "Solana" && p.apy > 3 && p.tvlUsd > 500_000)
        .sort((a, b) => b.tvlUsd - a.tvlUsd)
        .slice(0, 8)
        .map(p => ({
          project: p.project,
          symbol:  p.symbol,
          apy:     parseFloat(p.apy.toFixed(2)),
          tvlUsd:  Math.round(p.tvlUsd),
          chain:   p.chain,
        }));
    }

    return { solanaTVL, tvl24hChange, topProtocols, topYieldPools };
  } catch { return empty; }
}

/**
 * Fear & Greed Index — 加密市場情緒指數
 * alternative.me 免費公開 API，無需 Key
 * 返回當前值 + 過去 7 天趨勢
 */
export interface FearGreedResult {
  current: {
    value: number;          // 0=極度恐懼，100=極度貪婪
    classification: string; // "Extreme Fear" | "Fear" | "Neutral" | "Greed" | "Extreme Greed"
    timestamp: string;
  };
  weekly: Array<{
    value: number;
    classification: string;
    date: string;
  }>;
  trend: "improving" | "deteriorating" | "stable";
  insight: string;  // AI-friendly 解讀文字
}

/**
 * CryptoPanic — 加密新聞聚合
 * 免費 tier (無 API key) 支持公開新聞，有 key 可解鎖更多
 * 按代幣過濾最新重要新聞
 */
export interface CryptoNewsResult {
  items: Array<{
    title: string;
    url: string;
    source: string;
    publishedAt: string;
    votes: { positive: number; negative: number };
    sentiment: "bullish" | "bearish" | "neutral";
  }>;
  currency: string;
}

export async function sakGetCryptoNews(currency = "SOL"): Promise<CryptoNewsResult> {
  const empty: CryptoNewsResult = { items: [], currency };
  try {
    const key = process.env.CRYPTOPANIC_API_KEY ?? "free";
    const url = key === "free"
      ? `https://cryptopanic.com/api/free/v1/posts/?auth_token=free&currencies=${currency}&kind=news&public=true`
      : `https://cryptopanic.com/api/v1/posts/?auth_token=${key}&currencies=${currency}&kind=news&public=true`;

    const res = await fetch(url, { next: { revalidate: 900 } });  // 15分鐘緩存
    if (!res.ok) return empty;

    const json = await res.json() as {
      results?: Array<{
        title: string;
        url: string;
        source: { title: string };
        published_at: string;
        votes: { positive?: number; negative?: number };
      }>;
    };

    const items = (json.results ?? []).slice(0, 8).map(item => {
      const pos = item.votes?.positive ?? 0;
      const neg = item.votes?.negative ?? 0;
      const sentiment: CryptoNewsResult["items"][0]["sentiment"] =
        pos > neg * 1.5 ? "bullish" : neg > pos * 1.5 ? "bearish" : "neutral";
      return {
        title:       item.title,
        url:         item.url,
        source:      item.source.title,
        publishedAt: item.published_at.slice(0, 10),
        votes:       { positive: pos, negative: neg },
        sentiment,
      };
    });

    return { items, currency };
  } catch { return empty; }
}

export async function sakGetFearGreed(): Promise<FearGreedResult | null> {
  try {
    const res = await fetch(
      "https://api.alternative.me/fng/?limit=7&format=json",
      { next: { revalidate: 3600 } }  // 1小時緩存，指數每日更新
    );
    if (!res.ok) return null;

    const json = await res.json() as {
      data?: Array<{ value: string; value_classification: string; timestamp: string }>;
    };
    const data = json.data ?? [];
    if (data.length === 0) return null;

    const current = data[0];
    const weekly = data.map(d => ({
      value:          parseInt(d.value),
      classification: d.value_classification,
      date:           new Date(parseInt(d.timestamp) * 1000).toISOString().slice(0, 10),
    }));

    // 計算趨勢：今日 vs 7日前
    const todayVal = parseInt(current.value);
    const weekAgoVal = parseInt(data[data.length - 1].value);
    const diff = todayVal - weekAgoVal;
    const trend: FearGreedResult["trend"] =
      diff > 5 ? "improving" : diff < -5 ? "deteriorating" : "stable";

    // 生成 AI 可直接引用的解讀
    const lvl = parseInt(current.value);
    let insight = "";
    if (lvl <= 25)      insight = `市場處於極度恐懼（${lvl}），歷史上往往是逢低買入機會，但需確認趨勢反轉信號。`;
    else if (lvl <= 45) insight = `市場偏向恐懼（${lvl}），投資者謹慎，可考慮分批建倉優質資產。`;
    else if (lvl <= 55) insight = `市場情緒中性（${lvl}），無明顯方向性偏差，關注個別資產基本面。`;
    else if (lvl <= 75) insight = `市場處於貪婪區間（${lvl}），注意風險管理，避免追高。`;
    else                insight = `市場極度貪婪（${lvl}），歷史上這往往預示近期回調風險升高，謹慎為上。`;

    if (trend === "improving")     insight += ` 過去一週情緒持續改善（+${diff}點）。`;
    else if (trend === "deteriorating") insight += ` 過去一週情緒持續惡化（${diff}點）。`;

    return {
      current: {
        value:          lvl,
        classification: current.value_classification,
        timestamp:      new Date(parseInt(current.timestamp) * 1000).toISOString().slice(0, 10),
      },
      weekly,
      trend,
      insight,
    };
  } catch { return null; }
}

// ── SAK 全面運用：8 個高價值新工具 ──────────────────────────────────────────

/**
 * 1. Pyth Network 實時 Oracle 價格 (TokenPlugin)
 * 比 CoinGecko 更即時（400ms 更新），適合交易決策
 */
export async function sakGetPythPrice(
  symbol: string
): Promise<{ price: number; confidence: number; symbol: string; feedId?: string } | null> {
  try {
    const agent  = createReadOnlyAgent();
    const m      = agent.methods as Record<string, (...a: unknown[]) => Promise<unknown>>;
    // 先取 feed ID，再取價格
    const feedId = await m.fetchPythPriceFeedID?.(symbol, "stable") as string | undefined;
    if (feedId) {
      const price = await m.fetchPythPrice?.(feedId) as number | undefined;
      if (price) return { price, confidence: 0, symbol: symbol.toUpperCase(), feedId };
    }
    // fallback: 直接用 symbol 取價（部分版本支援）
    const direct = await m.fetchPythPrice?.(symbol) as number | undefined;
    if (direct) return { price: direct, confidence: 0, symbol: symbol.toUpperCase() };
  } catch { /* fallback below */ }
  return null;
}

/**
 * 2. Solana 網絡狀態 — TPS + 健康度 (TokenPlugin)
 * AI 可回答「現在網絡擁堵嗎？」「為什麼 tx 很慢？」
 */
export async function sakGetNetworkStatus(): Promise<{
  tps: number;
  status: "healthy" | "congested" | "degraded";
  statusLabel: string;
}> {
  const defaultStatus = { tps: 0, status: "healthy" as const, statusLabel: "未知" };
  try {
    const agent  = createReadOnlyAgent();
    const m      = agent.methods as Record<string, (...a: unknown[]) => Promise<unknown>>;
    const tps    = await m.getTPS?.() as number | undefined;
    if (tps !== undefined && tps !== null) {
      const status =
        tps > 2000 ? "healthy" :
        tps > 800  ? "congested" : "degraded";
      const statusLabel =
        status === "healthy"   ? `健康（${tps} TPS）` :
        status === "congested" ? `輕微擁堵（${tps} TPS）` :
                                 `嚴重擁堵（${tps} TPS）`;
      return { tps, status, statusLabel };
    }
  } catch { /* fallback */ }
  // Fallback: Solana RPC getRecentPerformanceSamples
  try {
    const conn = new Connection(RPC_URL, "confirmed");
    const samples = await conn.getRecentPerformanceSamples(1);
    if (samples[0]) {
      const tps = Math.round(samples[0].numTransactions / samples[0].samplePeriodSecs);
      const status = tps > 2000 ? "healthy" : tps > 800 ? "congested" : "degraded";
      return { tps, status, statusLabel: `${status === "healthy" ? "健康" : status === "congested" ? "輕微擁堵" : "嚴重擁堵"}（${tps} TPS）` };
    }
  } catch { /* ignore */ }
  return defaultStatus;
}

/**
 * 3. Messari AI 機構研究 (MiscPlugin)
 * 提供機構級加密研究報告，需要 MESSARI_API_KEY
 */
export async function sakGetMessariResearch(
  query: string
): Promise<{ answer: string; sources?: string[] } | null> {
  const key = process.env.MESSARI_API_KEY;
  if (!key) return null;  // 靜默返回 null，不影響其他功能
  try {
    const agent  = createReadOnlyAgent();
    const m      = agent.methods as Record<string, (...a: unknown[]) => Promise<unknown>>;
    const result = await m.askMessariAi?.(query) as
      { answer?: string; sources?: string[]; data?: { answer?: string } } | undefined;
    if (result?.answer) return { answer: result.answer, sources: result.sources };
    if (result?.data?.answer) return { answer: result.data.answer };
  } catch { /* no fallback — Messari is paid */ }
  return null;
}

/**
 * 4. Drift 永續合約市場 + 資金費率 (DefiPlugin)
 * AI 可回答「Drift 上 SOL 資金費率是多少？做多做空哪個更划算？」
 */
export async function sakGetDriftPerpMarkets(): Promise<Array<{
  name: string;
  baseAsset: string;
  fundingRate: number;    // 每小時資金費率（%）
  fundingRatePct: string;
  bias: "long-favored" | "short-favored" | "neutral";
}>> {
  try {
    const agent  = createReadOnlyAgent();
    const m      = agent.methods as Record<string, (...a: unknown[]) => Promise<unknown>>;
    const markets = await m.getAvailableDriftPerpMarkets?.() as
      Array<{ marketName?: string; baseAssetSymbol?: string; marketIndex?: number }> | undefined;
    if (!markets?.length) return [];

    // 並行取各市場資金費率（最多 6 個）
    const top = markets.slice(0, 6);
    const rates = await Promise.allSettled(
      top.map(mk => m.getDriftFundingRateAsPercentage?.(mk.marketIndex ?? 0, "perp"))
    );

    return top.map((mk, i) => {
      const rateRaw = rates[i].status === "fulfilled"
        ? (rates[i] as PromiseFulfilledResult<unknown>).value as number ?? 0
        : 0;
      const rate = parseFloat((rateRaw * 100).toFixed(4));
      return {
        name:           mk.marketName ?? mk.baseAssetSymbol ?? `Market ${i}`,
        baseAsset:      mk.baseAssetSymbol ?? "?",
        fundingRate:    rateRaw,
        fundingRatePct: `${rate > 0 ? "+" : ""}${rate}%/hr`,
        bias:           rate > 0.001 ? "long-favored" : rate < -0.001 ? "short-favored" : "neutral",
      };
    });
  } catch { return []; }
}

/**
 * 5. Jupiter 開放限價單 (TokenPlugin)
 * 查詢用戶當前掛單狀況
 */
export async function sakGetLimitOrders(
  walletAddress: string
): Promise<Array<{
  orderId: string;
  inputMint: string;
  outputMint: string;
  inputAmount: number;
  outputAmount: number;
  price: number;
  expiredAt?: string;
}>> {
  try {
    const agent  = createReadOnlyAgent();
    const m      = agent.methods as Record<string, (...a: unknown[]) => Promise<unknown>>;
    const orders = await m.getOpenLimitOrders?.(walletAddress) as
      Array<{
        publicKey?: string;
        account?: {
          inputMint?: { toString: () => string };
          outputMint?: { toString: () => string };
          oriInAmount?: { toString: () => string };
          oriOutAmount?: { toString: () => string };
          expiredAt?: { toNumber: () => number } | null;
        };
      }> | undefined;
    if (!orders?.length) return [];
    return orders.map(o => {
      const a = o.account ?? {};
      const inAmt  = Number(a.oriInAmount?.toString()  ?? "0");
      const outAmt = Number(a.oriOutAmount?.toString() ?? "0");
      return {
        orderId:      o.publicKey ?? "",
        inputMint:    a.inputMint?.toString()  ?? "",
        outputMint:   a.outputMint?.toString() ?? "",
        inputAmount:  inAmt,
        outputAmount: outAmt,
        price:        inAmt > 0 ? outAmt / inAmt : 0,
        expiredAt:    a.expiredAt
          ? new Date(a.expiredAt.toNumber() * 1000).toISOString().slice(0, 10)
          : undefined,
      };
    });
  } catch { return []; }
}

/**
 * 6. Sanctum LST 完整詳情 — 價格 + TVL + APY (DefiPlugin)
 * 比現有的 sakGetSanctumAPY 更豐富，含 USD 價格和 TVL
 */
export async function sakGetSanctumLSTDetails(): Promise<Array<{
  symbol:  string;
  name:    string;
  mint:    string;
  apy:     number;
  price:   number;   // USD price
  tvl:     number;   // TVL in USD
}>> {
  const known = [
    { symbol: "mSOL",    name: "Marinade SOL",   mint: "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So" },
    { symbol: "JitoSOL", name: "Jito SOL",       mint: "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn" },
    { symbol: "bSOL",    name: "BlazeStake SOL", mint: "bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1" },
    { symbol: "stSOL",   name: "Lido stSOL",     mint: "7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj" },
  ];
  try {
    const agent = createReadOnlyAgent();
    const m     = agent.methods as Record<string, (...a: unknown[]) => Promise<unknown>>;

    const [apyRes, priceRes, tvlRes] = await Promise.allSettled([
      Promise.allSettled(known.map(k => m.sanctumGetLSTAPY?.(k.mint))),
      Promise.allSettled(known.map(k => m.sanctumGetLSTPrice?.(k.mint))),
      Promise.allSettled(known.map(k => m.sanctumGetLSTTVL?.(k.mint))),
    ]);

    return known.map((k, i) => ({
      symbol: k.symbol,
      name:   k.name,
      mint:   k.mint,
      apy:   apyRes.status === "fulfilled"  && apyRes.value[i].status  === "fulfilled"
        ? (apyRes.value[i] as PromiseFulfilledResult<unknown>).value as number ?? 0 : 0,
      price: priceRes.status === "fulfilled" && priceRes.value[i].status === "fulfilled"
        ? (priceRes.value[i] as PromiseFulfilledResult<unknown>).value as number ?? 0 : 0,
      tvl:   tvlRes.status === "fulfilled"  && tvlRes.value[i].status  === "fulfilled"
        ? (tvlRes.value[i] as PromiseFulfilledResult<unknown>).value as number ?? 0 : 0,
    })).filter(k => k.apy > 0 || k.tvl > 0);
  } catch { return []; }
}

/**
 * 7. Elfa AI 全市場趨勢代幣 (MiscPlugin)
 * 與 sakGetSocialSentiment（按 ticker 查詢）不同：
 * 這裡取全市場當前最熱門代幣 Top 10
 */
export async function sakGetElfaTrendingTokens(): Promise<Array<{
  symbol: string;
  mentions: number;
  smartMentions: number;
  sentiment: number;   // -1.0 ~ 1.0
}>> {
  try {
    const agent  = createReadOnlyAgent();
    const m      = agent.methods as Record<string, (...a: unknown[]) => Promise<unknown>>;
    const result = await m.getTrendingTokensUsingElfaAi?.() as
      { data?: Array<{ token?: string; mentionCount?: number; smartMentionCount?: number; sentiment?: number }> } | undefined;
    if (result?.data?.length) {
      return result.data.slice(0, 10).map(t => ({
        symbol:        t.token ?? "?",
        mentions:      t.mentionCount      ?? 0,
        smartMentions: t.smartMentionCount ?? 0,
        sentiment:     t.sentiment         ?? 0,
      }));
    }
  } catch { /* no fallback — Elfa is paid */ }
  // Fallback: CoinGecko trending
  try {
    const res  = await fetch("https://api.coingecko.com/api/v3/search/trending", { next: { revalidate: 1800 } });
    if (!res.ok) return [];
    const data = await res.json() as { coins?: Array<{ item: { symbol: string; score: number } }> };
    return (data.coins ?? []).slice(0, 10).map(c => ({
      symbol:        c.item.symbol.toUpperCase(),
      mentions:      Math.round((10 - c.item.score) * 100),
      smartMentions: 0,
      sentiment:     0,
    }));
  } catch { return []; }
}

/**
 * 8. 關閉空 Token 帳戶 — 回收 SOL Rent (TokenPlugin)
 * 每個空帳戶可回收 ~0.002 SOL，AI 可建議用戶清理
 * 返回預計回收量（需用戶 Phantom 簽名執行）
 */
export async function sakEstimateCloseEmptyAccounts(
  walletAddress: string
): Promise<{ estimatedAccounts: number; estimatedReclaimSol: number; note: string }> {
  try {
    const conn    = new Connection(RPC_URL, "confirmed");
    const pubkey  = new PublicKey(walletAddress);
    const tokenAccounts = await conn.getParsedTokenAccountsByOwner(pubkey, {
      programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
    });
    const emptyAccounts = tokenAccounts.value.filter(a => {
      const amount = a.account.data.parsed?.info?.tokenAmount?.uiAmount ?? 1;
      return amount === 0;
    });
    const count       = emptyAccounts.length;
    const reclaimSol  = parseFloat((count * 0.00203928).toFixed(4)); // Solana rent exemption
    return {
      estimatedAccounts:  count,
      estimatedReclaimSol: reclaimSol,
      note: count > 0
        ? `發現 ${count} 個空 Token 帳戶，關閉後可回收約 ${reclaimSol} SOL（~$${(reclaimSol * 170).toFixed(2)} USD）。可在 Token 頁面操作。`
        : "沒有空的 Token 帳戶，無需清理。",
    };
  } catch {
    return { estimatedAccounts: 0, estimatedReclaimSol: 0, note: "無法掃描帳戶" };
  }
}
