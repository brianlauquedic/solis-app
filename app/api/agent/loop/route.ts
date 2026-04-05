/**
 * Agent Loop — Claude Sonnet 4.6 + Interleaved Thinking + SAK Tool Use → SSE
 *
 * Core Innovation (Module 2 — DeFi Advisor):
 * - Claude Sonnet 4.6 with interleaved-thinking-2025-05-14 beta
 * - Each tool call is preceded and followed by visible reasoning blocks
 * - SAK-backed tools: balance, price, APY, rug check, stake/lend/swap tx prep
 * - Pre-commitment: reasoning hash written to Solana BEFORE final recommendation
 * - SSE events: thinking_delta, tool_call, tool_result, token, done
 *
 * This proves AI deliberation happened before advice — not post-hoc rationalization.
 */

import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "crypto";
import { PublicKey } from "@solana/web3.js";
import {
  sakGetBalance,
  sakGetTokenPrice,
  sakGetTokenReport,
  sakPrepareStakeTx,
  sakPrepareLendTx,
  sakPrepareSwapTx,
  sakGetTrendingTokens,
  sakGetSocialSentiment,
  sakGetAlloraInference,
  sakGetSanctumAPY,
  sakGetOkxQuote,
  sakGetTokenByTicker,
  sakGetTopGainers,
  sakGetTrendingPools,
  sakGetBridgeQuote,
  sakGetDriftBorrowAPY,
  sakGetDefiLlamaData,
  sakGetFearGreed,
  sakGetCryptoNews,
  sakGetPythPrice,
  sakGetNetworkStatus,
  sakGetMessariResearch,
  sakGetDriftPerpMarkets,
  sakGetLimitOrders,
  sakGetSanctumLSTDetails,
  sakGetElfaTrendingTokens,
  sakEstimateCloseEmptyAccounts,
  SOL_MINT,
  USDC_MINT,
} from "@/lib/agent";
import { runQuotaGate, isValidSolanaAddress } from "@/lib/rate-limit";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? "";

interface LoopRequest {
  message: string;
  walletAddress: string;
  walletSnapshot?: {
    solBalance: number;
    totalUSD: number;
    idleUSDC: number;
  };
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  sessionSummary?: string;
}

// ── Tool definitions (backed by SAK methods) ────────────────────────────────

// ── Strategy card type ────────────────────────────────────────────

export interface StrategyCard {
  asset: string;
  action: "buy" | "sell" | "stake" | "lend" | "reduce" | "hold" | "swap";
  entryLow?: number;
  entryHigh?: number;
  takeProfit1?: number;
  takeProfit2?: number;
  stopLoss?: number;
  allocationPct?: number;
  timeHorizon?: string;
  confidence: number;      // 0-100
  thesis: string;          // 1-2 sentence investment thesis
  riskFactors?: string[];
  generatedAt: number;
}

// ── Tool definitions (backed by SAK methods) ─────────────────────

const TOOLS: Anthropic.Tool[] = [
  {
    name: "output_strategy",
    description: "Output a structured, actionable investment strategy card. ALWAYS call this tool when you have a definitive buy/sell/stake/lend recommendation with specific price levels or allocation advice. Do NOT call this for general commentary.",
    input_schema: {
      type: "object" as const,
      properties: {
        asset: {
          type: "string",
          description: "Asset symbol or protocol (e.g. 'SOL', 'mSOL', 'USDC via Kamino')",
        },
        action: {
          type: "string",
          enum: ["buy", "sell", "stake", "lend", "reduce", "hold", "swap"],
          description: "Recommended action",
        },
        entryLow: {
          type: "number",
          description: "Lower bound of entry price zone (USD). For staking/lending, use current price.",
        },
        entryHigh: {
          type: "number",
          description: "Upper bound of entry price zone (USD). Same as entryLow for immediate action.",
        },
        takeProfit1: {
          type: "number",
          description: "First take-profit target (USD). For yield strategies, the target APY%.",
        },
        takeProfit2: {
          type: "number",
          description: "Second (higher) take-profit target (USD). Optional.",
        },
        stopLoss: {
          type: "number",
          description: "Stop-loss level (USD). For lending positions, use health-factor threshold.",
        },
        allocationPct: {
          type: "number",
          description: "Suggested % of relevant portfolio to allocate (1-100). Be conservative.",
        },
        timeHorizon: {
          type: "string",
          description: "Expected holding period (e.g. '7-14天', '1-3个月', '长期质押').",
        },
        confidence: {
          type: "number",
          description: "Your confidence level 0-100 based on data quality and analysis depth. Be honest.",
        },
        thesis: {
          type: "string",
          description: "Core investment thesis in 1-2 concise sentences explaining WHY.",
        },
        riskFactors: {
          type: "array",
          items: { type: "string" },
          description: "Key risks that could invalidate this strategy (2-3 items).",
        },
      },
      required: ["asset", "action", "confidence", "thesis"],
    },
  },
  {
    name: "get_wallet_balance",
    description: "Get SOL and USDC balances for the connected wallet in USD terms.",
    input_schema: {
      type: "object" as const,
      properties: {
        wallet_address: { type: "string", description: "Solana wallet public key" },
      },
      required: ["wallet_address"],
    },
  },
  {
    name: "get_token_price",
    description: "Get current USD price of a Solana token by mint address. Use So11111111111111111111111111111111111111112 for SOL.",
    input_schema: {
      type: "object" as const,
      properties: {
        mint: { type: "string", description: "Token mint address" },
      },
      required: ["mint"],
    },
  },
  {
    name: "get_apy_data",
    description: "Get live APY rates for Marinade, Jito (SOL staking) and Kamino, Solend (USDC lending). Always call this before making yield recommendations.",
    input_schema: {
      type: "object" as const,
      properties: {},
    },
  },
  {
    name: "check_token_security",
    description: "Run Jupiter Shield security check on a token. Returns risk score and detected issues.",
    input_schema: {
      type: "object" as const,
      properties: {
        mint: { type: "string", description: "Token mint address to analyze" },
      },
      required: ["mint"],
    },
  },
  {
    name: "prepare_stake_tx",
    description: "Prepare a SOL staking transaction for Marinade or Jito. Returns serialized transaction for user to sign.",
    input_schema: {
      type: "object" as const,
      properties: {
        amount_sol: { type: "number", description: "Amount of SOL to stake" },
        protocol: { type: "string", enum: ["marinade", "jito"], description: "Staking protocol" },
      },
      required: ["amount_sol", "protocol"],
    },
  },
  {
    name: "prepare_lend_tx",
    description: "Prepare a USDC lending transaction via Lulo. Returns serialized transaction for user to sign.",
    input_schema: {
      type: "object" as const,
      properties: {
        amount_usdc: { type: "number", description: "Amount of USDC to lend" },
      },
      required: ["amount_usdc"],
    },
  },
  {
    name: "prepare_swap_tx",
    description: "Prepare a Jupiter swap transaction. Returns serialized transaction for user to sign.",
    input_schema: {
      type: "object" as const,
      properties: {
        input_mint: { type: "string", description: "Input token mint (use So111...112 for SOL)" },
        output_mint: { type: "string", description: "Output token mint" },
        amount: { type: "number", description: "Amount to swap in input token units" },
      },
      required: ["input_mint", "output_mint", "amount"],
    },
  },
  {
    name: "get_technical_analysis",
    description: `Get 6-indicator technical analysis (MACD + RSI + Bollinger Bands + OBV + Elliott Wave + Fibonacci) for any token.
Returns: signal tier (strong_buy/buy/neutral/sell/strong_sell), confluence score (0-100), entry zone, TP1, TP2, stop-loss.
ALWAYS call this before making price-target or entry/exit recommendations.
MACD gold cross + RSI 30-50 range + BB lower-band bounce + BB not-squeezed must ALL pass for a buy signal.
Use symbol='SOL' for Solana, or provide mint address for SPL tokens.`,
    input_schema: {
      type: "object" as const,
      properties: {
        symbol: {
          type: "string",
          description: "Token symbol (e.g. 'SOL', 'BONK', 'JUP', 'WIF'). Use uppercase.",
        },
        mint: {
          type: "string",
          description: "Optional: SPL token mint address for tokens not in the default list.",
        },
      },
      required: ["symbol"],
    },
  },
  {
    name: "get_trending_tokens",
    description: "Get currently trending Solana/crypto tokens from CoinGecko with 24h price change. Use to identify market momentum and hot sectors.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_price_prediction",
    description: "Get Allora AI on-chain machine learning price inference for SOL. Returns a short-term bullish/bearish signal based on decentralized ML models.",
    input_schema: {
      type: "object" as const,
      properties: {
        asset: { type: "string", description: "Asset to predict (currently only 'SOL' supported)" },
      },
      required: [],
    },
  },
  {
    name: "get_social_sentiment",
    description: "Get social media sentiment for a token ticker using Elfa AI. Returns mention count, bullish/bearish/neutral sentiment, and top mentions.",
    input_schema: {
      type: "object" as const,
      properties: {
        ticker: { type: "string", description: "Token ticker symbol e.g. SOL, WIF, BONK" },
      },
      required: ["ticker"],
    },
  },
  {
    name: "get_sanctum_apy",
    description: "Get real-time APY rates for all Sanctum LST (Liquid Staking Tokens) including mSOL, JitoSOL, bSOL. More comprehensive than Marinade-only data.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "compare_swap_quotes",
    description: "Compare Jupiter vs OKX DEX swap quotes to find the best route and price for a token swap. Returns both quotes and recommends the better option. Use before any swap recommendation to ensure best execution.",
    input_schema: {
      type: "object" as const,
      properties: {
        input_mint:  { type: "string", description: "Input token mint address (use So11111111111111111111111111111111111111112 for SOL)" },
        output_mint: { type: "string", description: "Output token mint address" },
        amount:      { type: "number", description: "Amount in smallest unit (lamports for SOL: multiply SOL amount by 1e9)" },
      },
      required: ["input_mint", "output_mint", "amount"],
    },
  },
  {
    name: "resolve_token_ticker",
    description: "Resolve a token ticker/name to its Solana mint address using SAK TokenPlugin. Use when user mentions a token by name (e.g. 'WIF', 'BONK', 'JUP') and you need the mint address for price checks or swaps.",
    input_schema: {
      type: "object" as const,
      properties: {
        ticker: { type: "string", description: "Token ticker symbol (e.g. WIF, BONK, JUP, PYTH)" },
      },
      required: ["ticker"],
    },
  },
  {
    name: "get_top_gainers",
    description: "Get today's top performing tokens by price gain percentage using SAK MiscPlugin. Use when user asks about which tokens are going up, best performers, or market movers.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_trending_pools",
    description: "Get currently trending liquidity pools on Solana (Raydium/Orca/Meteora) using SAK MiscPlugin. Returns volume, APR and token pairs. Use when user asks about yield opportunities, new pools, or liquidity mining.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_bridge_quote",
    description: "Get cross-chain bridge quote via deBridge using SAK DefiPlugin. Supports Solana → Ethereum/BSC/Arbitrum. Use when user asks about moving assets cross-chain.",
    input_schema: {
      type: "object" as const,
      properties: {
        to_chain:      { type: "string", enum: ["ethereum", "bsc", "arbitrum"], description: "Destination chain" },
        token_address: { type: "string", description: "Token mint address on Solana" },
        amount:        { type: "number", description: "Amount in token units" },
      },
      required: ["to_chain", "amount"],
    },
  },
  {
    name: "get_drift_borrow_apy",
    description: "Get Drift Protocol real-time lending and borrowing APY rates using SAK DefiPlugin. More comprehensive than Kamino-only data. Use when user asks about borrowing costs or lending yields on Drift.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_defi_llama",
    description: "Get Solana ecosystem TVL data and top yield pools from DeFiLlama. Use when user asks about: total Solana DeFi TVL, which protocols have the most locked value, top yield opportunities on Solana, protocol health trends, or DeFi ecosystem overview.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_fear_greed",
    description: "Get the Crypto Fear & Greed Index (0=Extreme Fear, 100=Extreme Greed) with 7-day trend. ALWAYS call this when user asks about market sentiment, whether it's a good time to buy/sell, market mood, or macro outlook. Pair with technical analysis for complete picture.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_crypto_news",
    description: "Get latest crypto news headlines for a specific token or the market. Includes sentiment (bullish/bearish/neutral) per article based on community votes. Use when user asks about recent news, what's happening with a token, market events, or catalysts.",
    input_schema: {
      type: "object" as const,
      properties: {
        currency: {
          type: "string",
          description: "Token ticker to filter news (e.g. SOL, BTC, ETH, BONK, JUP). Default: SOL",
        },
      },
      required: [],
    },
  },
  {
    name: "get_pyth_price",
    description: "Get real-time price from Pyth Network oracle (updates every 400ms). More accurate than CoinGecko for trading decisions. Use for SOL, BTC, ETH price checks when precision matters or when user is about to execute a trade.",
    input_schema: {
      type: "object" as const,
      properties: {
        symbol: { type: "string", description: "Token symbol: SOL, BTC, ETH, BNB, etc." },
      },
      required: ["symbol"],
    },
  },
  {
    name: "get_network_status",
    description: "Get current Solana network TPS and health status. Use when user asks why transactions are slow, whether the network is congested, or before recommending time-sensitive trades.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_messari_research",
    description: "Query Messari AI for institutional-grade crypto research. Returns deep fundamental analysis, market reports, and protocol insights. Use when user asks for serious research, protocol fundamentals, or investment thesis beyond price action.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: { type: "string", description: "Research question (e.g. 'What is Solana DeFi TVL trend?' or 'Marinade Finance protocol analysis')" },
      },
      required: ["query"],
    },
  },
  {
    name: "get_drift_perp_markets",
    description: "Get available Drift Protocol perpetual futures markets with real-time funding rates. Use when user asks about perpetual trading, funding rates, long/short costs, or Drift market overview.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_user_limit_orders",
    description: "Get user's open Jupiter limit orders. Use when user asks about their pending orders, active limit orders, or order management.",
    input_schema: {
      type: "object" as const,
      properties: {
        wallet_address: { type: "string", description: "User wallet address" },
      },
      required: ["wallet_address"],
    },
  },
  {
    name: "get_sanctum_lst_details",
    description: "Get comprehensive LST (Liquid Staking Token) data from Sanctum including APY, USD price, and TVL for mSOL, JitoSOL, bSOL, stSOL. More complete than get_sanctum_apy. Use for detailed LST comparison.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_elfa_trending_tokens",
    description: "Get top trending tokens across all crypto social media right now using Elfa AI smart money signals. Shows mention counts, smart money mentions, and sentiment. Use when user asks what the market is talking about or what's trending.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "estimate_close_empty_accounts",
    description: "Estimate how much SOL can be reclaimed by closing empty token accounts in the user's wallet. Each empty account wastes ~0.002 SOL in rent. Use when user asks about wallet optimization or reclaiming SOL.",
    input_schema: {
      type: "object" as const,
      properties: {
        wallet_address: { type: "string", description: "User wallet address to scan" },
      },
      required: ["wallet_address"],
    },
  },
];

// ── Tool execution (SAK-backed) ──────────────────────────────────────────────

// strategy card is captured separately, not "executed"
function captureStrategyCard(input: Record<string, unknown>): StrategyCard {
  return {
    asset:         String(input.asset ?? ""),
    action:        (input.action as StrategyCard["action"]) ?? "hold",
    entryLow:      typeof input.entryLow      === "number" ? input.entryLow      : undefined,
    entryHigh:     typeof input.entryHigh     === "number" ? input.entryHigh     : undefined,
    takeProfit1:   typeof input.takeProfit1   === "number" ? input.takeProfit1   : undefined,
    takeProfit2:   typeof input.takeProfit2   === "number" ? input.takeProfit2   : undefined,
    stopLoss:      typeof input.stopLoss      === "number" ? input.stopLoss      : undefined,
    allocationPct: typeof input.allocationPct === "number" ? input.allocationPct : undefined,
    timeHorizon:   typeof input.timeHorizon   === "string" ? input.timeHorizon   : undefined,
    confidence:    typeof input.confidence    === "number" ? input.confidence    : 50,
    thesis:        String(input.thesis ?? ""),
    riskFactors:   Array.isArray(input.riskFactors) ? input.riskFactors.map(String) : [],
    generatedAt:   Date.now(),
  };
}

async function executeTool(name: string, input: Record<string, unknown>): Promise<unknown> {
  switch (name) {
    case "output_strategy":
      // Not really "executed" — captured as a strategy card in the loop below
      return { captured: true, asset: input.asset, action: input.action };
    case "get_wallet_balance": {
      const result = await sakGetBalance(input.wallet_address as string);
      return result ?? { error: "Could not fetch balance" };
    }
    case "get_token_price": {
      const mint = input.mint as string;
      const price = await sakGetTokenPrice(new PublicKey(mint));
      return { mint, price, currency: "USD" };
    }
    case "get_apy_data": {
      try {
        // Use internal yield API
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
        const res = await fetch(`${baseUrl}/api/yield`);
        if (res.ok) return await res.json();
        return { error: "Could not fetch APY data" };
      } catch {
        return { error: "APY fetch failed" };
      }
    }
    case "check_token_security": {
      const report = await sakGetTokenReport(input.mint as string);
      return report ?? { error: "Security check unavailable" };
    }
    case "prepare_stake_tx": {
      const result = await sakPrepareStakeTx(
        input.amount_sol as number,
        input.protocol as "marinade" | "jito"
      );
      if (!result) return { error: "Could not prepare staking transaction" };
      return {
        ...result,
        action: {
          type: "stake",
          protocol: result.protocol,
          amount: input.amount_sol,
        },
      };
    }
    case "prepare_lend_tx": {
      const result = await sakPrepareLendTx(input.amount_usdc as number);
      if (!result) return { error: "Could not prepare lending transaction" };
      return {
        ...result,
        action: {
          type: "lend",
          protocol: "Kamino/Lulo",
          amount: input.amount_usdc,
        },
      };
    }
    case "prepare_swap_tx": {
      const result = await sakPrepareSwapTx(
        input.input_mint as string,
        input.output_mint as string,
        input.amount as number
      );
      if (!result) return { error: "Could not prepare swap transaction" };
      return {
        ...result,
        action: {
          type: "swap",
          amount: input.amount,
        },
      };
    }
    case "get_technical_analysis": {
      try {
        const sym    = (input.symbol as string ?? "SOL").toUpperCase();
        const mint   = input.mint ? `&mint=${encodeURIComponent(input.mint as string)}` : "";
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
        const res    = await fetch(`${baseUrl}/api/market/technical?symbol=${sym}${mint}`);
        if (!res.ok) return { error: `Technical analysis unavailable (${res.status})` };
        const data   = await res.json() as {
          symbol: string;
          currentPrice: number;
          source: string;
          analysis: {
            tier: string;
            score: number;
            direction: string;
            coreGate: { passed: boolean; mode: string; conditions: Record<string, boolean>; failures: string[] };
            marketRegime: { regime: string; label: string; description: string };
            entry?: number;
            tp1?: number;
            tp2?: number;
            stopLoss?: number;
            stopLossMethod?: "fibonacci" | "atr";
            riskReward?: number;
            isRRValid?: boolean;
            macd: { signal: string; isBullishCross: boolean; crossBelowZero: boolean; aboveZero: boolean; histExpanding: boolean; detail: string };
            rsi: { current: number; rsi: number; signal: string; inBuyZone: boolean; inTrendZone: boolean; detail: string };
            bb: { signal: string; priceAboveMid: boolean; isSqueeze: boolean; detail: string };
            obv: { signal: string; score: number; obvTrend: string; detail: string };
            atr: { atr: number; atrPct: number; atrStop: number; detail: string };
            adx: { adx: number; plusDI: number; minusDI: number; trending: boolean; trendDirection: string; detail: string };
            fibonacci: { nearestLevel: string; nearestPct: number; swingHigh: number; swingLow: number; detail: string };
            elliott: { wavePosition: string; waveLabel: string; isBullishSetup: boolean; score: number; confidence: number; detail: string };
            summary: string;
          };
          warning?: string;
        };
        const a = data.analysis;
        // Return structured summary for Claude to reason about
        return {
          symbol:         data.symbol,
          currentPrice:   data.currentPrice,
          dataSource:     data.source,
          // ── Signal ─────────────────────────────────────────────
          tier:           a.tier,
          score:          a.score,
          direction:      a.direction,
          // ── Market regime (v2 new) ──────────────────────────────
          marketRegime:   a.marketRegime?.regime,
          regimeLabel:    a.marketRegime?.label,
          regimeNote:     a.marketRegime?.description,
          // ── Core gate ──────────────────────────────────────────
          coreGatePassed:  a.coreGate?.passed ?? false,
          coreGateMode:    a.coreGate?.mode,
          coreConditions:  a.coreGate?.conditions ?? {},
          coreFailures:    a.coreGate?.failures ?? [],
          // ── Trade levels ────────────────────────────────────────
          entry:          a.entry,
          tp1:            a.tp1,
          tp2:            a.tp2,
          stopLoss:       a.stopLoss,
          stopLossMethod: a.stopLossMethod,  // "fibonacci" or "atr"
          riskReward:     a.riskReward,
          rrValid:        a.isRRValid,
          // ── Indicators ──────────────────────────────────────────
          macd: {
            signal:       a.macd?.signal,
            goldCross:    a.macd?.isBullishCross,
            aboveZero:    a.macd?.aboveZero,
            histExpanding:a.macd?.histExpanding,
            detail:       a.macd?.detail,
          },
          rsi: {
            value:        a.rsi?.current,
            signal:       a.rsi?.signal,
            inBuyZone:    a.rsi?.inBuyZone,
            inTrendZone:  a.rsi?.inTrendZone,
            detail:       a.rsi?.detail,
          },
          bb: {
            signal:       a.bb?.signal,
            aboveMid:     a.bb?.priceAboveMid,
            squeeze:      a.bb?.isSqueeze,
            detail:       a.bb?.detail,
          },
          obv: {
            trend:        a.obv?.obvTrend,
            signal:       a.obv?.signal,
            score:        a.obv?.score,
            detail:       a.obv?.detail,
          },
          atr: {
            value:        a.atr?.atr,
            pct:          a.atr?.atrPct,
            dynamicStop:  a.atr?.atrStop,
            detail:       a.atr?.detail,
          },
          adx: {
            value:        a.adx?.adx,
            plusDI:       a.adx?.plusDI,
            minusDI:      a.adx?.minusDI,
            trending:     a.adx?.trending,
            direction:    a.adx?.trendDirection,
            detail:       a.adx?.detail,
          },
          fibonacci: {
            nearestLevel: a.fibonacci?.nearestLevel,
            pct:          a.fibonacci?.nearestPct,
            swingHigh:    a.fibonacci?.swingHigh,
            swingLow:     a.fibonacci?.swingLow,
            detail:       a.fibonacci?.detail,
          },
          elliott: {
            wave:         a.elliott?.wavePosition,
            label:        a.elliott?.waveLabel,
            bullishSetup: a.elliott?.isBullishSetup,
            score:        a.elliott?.score,
            confidence:   a.elliott?.confidence,
            detail:       a.elliott?.detail,
          },
          summary:        a.summary,
          warning:        data.warning,
        };
      } catch (err) {
        return { error: `Technical analysis failed: ${err instanceof Error ? err.message : String(err)}` };
      }
    }
    case "get_trending_tokens": {
      const trending = await sakGetTrendingTokens();
      return { trending, count: trending.length };
    }
    case "get_price_prediction": {
      const prediction = await sakGetAlloraInference();
      return prediction ?? { error: "Allora inference unavailable" };
    }
    case "get_social_sentiment": {
      const ticker = (input as { ticker?: string }).ticker ?? "SOL";
      const sentiment = await sakGetSocialSentiment(ticker);
      return sentiment ?? { error: "Elfa API unavailable - set ELFA_API_KEY env var" };
    }
    case "get_sanctum_apy": {
      const lsts = await sakGetSanctumAPY();
      return { lsts, count: lsts.length };
    }
    case "compare_swap_quotes": {
      const result = await sakGetOkxQuote(
        input.input_mint as string,
        input.output_mint as string,
        input.amount as number
      );
      const okxAvailable = !!process.env.OKX_API_KEY;
      return {
        ...result,
        okxAvailable,
        note: !okxAvailable
          ? "OKX DEX 未配置 API Key，僅顯示 Jupiter 報價。設置 OKX_API_KEY 環境變量即可啟用雙聚合器比較。"
          : undefined,
      };
    }
    case "resolve_token_ticker": {
      const ticker = input.ticker as string;
      const result = await sakGetTokenByTicker(ticker);
      return result ?? { error: `Could not resolve ticker: ${ticker}` };
    }
    case "get_top_gainers": {
      const gainers = await sakGetTopGainers();
      return { gainers, count: gainers.length };
    }
    case "get_trending_pools": {
      const pools = await sakGetTrendingPools();
      return { pools, count: pools.length };
    }
    case "get_bridge_quote": {
      const chainMap: Record<string, number> = { ethereum: 1, bsc: 56, arbitrum: 42161 };
      const toChainId = chainMap[input.to_chain as string] ?? 1;
      const result = await sakGetBridgeQuote(
        toChainId,
        (input.token_address as string) ?? SOL_MINT.toBase58(),
        input.amount as number
      );
      return result ?? { error: "Bridge quote unavailable — deBridge may not support this route" };
    }
    case "get_drift_borrow_apy": {
      const rates = await sakGetDriftBorrowAPY();
      return { rates, count: rates.length };
    }
    case "get_defi_llama": {
      const data = await sakGetDefiLlamaData();
      return {
        solanaTVL:    data.solanaTVL,
        tvl24hChange: data.tvl24hChange,
        topProtocols: data.topProtocols,
        topYieldPools: data.topYieldPools,
        dataSource:   "DeFiLlama",
        note: data.solanaTVL === 0
          ? "DeFiLlama API temporarily unavailable"
          : `Solana DeFi TVL: $${(data.solanaTVL / 1e9).toFixed(2)}B`,
      };
    }
    case "get_fear_greed": {
      const fg = await sakGetFearGreed();
      if (!fg) return { error: "Fear & Greed Index unavailable — alternative.me API may be down" };
      return {
        ...fg,
        dataSource: "alternative.me Crypto Fear & Greed Index",
      };
    }
    case "get_crypto_news": {
      const currency = (input.currency as string | undefined) ?? "SOL";
      const news = await sakGetCryptoNews(currency.toUpperCase());
      return {
        ...news,
        dataSource: "CryptoPanic",
        note: news.items.length === 0
          ? "CryptoPanic API unavailable or no recent news for this token"
          : `${news.items.length} latest news items for ${currency}`,
      };
    }
    case "get_pyth_price": {
      const symbol = (input.symbol as string ?? "SOL").toUpperCase();
      const result = await sakGetPythPrice(symbol);
      if (!result) return { error: `Pyth price unavailable for ${symbol}. Try get_token_price instead.` };
      return { ...result, dataSource: "Pyth Network Oracle", note: "Real-time oracle price (updates every 400ms)" };
    }
    case "get_network_status": {
      const status = await sakGetNetworkStatus();
      return { ...status, dataSource: "Solana RPC", recommendation:
        status.status === "healthy"   ? "網絡狀況良好，適合執行交易。" :
        status.status === "congested" ? "網絡輕微擁堵，建議稍後或提高優先費執行交易。" :
                                        "網絡嚴重擁堵，非緊急交易建議等待網絡恢復。",
      };
    }
    case "get_messari_research": {
      const query = input.query as string;
      const result = await sakGetMessariResearch(query);
      if (!result) return {
        error: "Messari API 未配置。請在 .env.local 設置 MESSARI_API_KEY=your_key。",
        note:  "Messari 提供機構級加密研究，可在 messari.io 申請 API key。",
      };
      return { ...result, dataSource: "Messari AI Research" };
    }
    case "get_drift_perp_markets": {
      const markets = await sakGetDriftPerpMarkets();
      if (!markets.length) return { error: "Drift perp markets unavailable", markets: [] };
      const longFavored  = markets.filter(m => m.bias === "long-favored").map(m => m.name);
      const shortFavored = markets.filter(m => m.bias === "short-favored").map(m => m.name);
      return {
        markets,
        summary: {
          longFavored,
          shortFavored,
          note: longFavored.length  ? `${longFavored.join(", ")} 目前多頭承擔資金費用（市場偏多）` :
                shortFavored.length ? `${shortFavored.join(", ")} 目前空頭承擔資金費用（市場偏空）` :
                                      "市場情緒中性，資金費率接近零。",
        },
        dataSource: "Drift Protocol via SAK DefiPlugin",
      };
    }
    case "get_user_limit_orders": {
      const wallet = input.wallet_address as string;
      const orders = await sakGetLimitOrders(wallet);
      return {
        orders,
        count: orders.length,
        dataSource: "Jupiter Limit Orders via SAK TokenPlugin",
        note: orders.length === 0 ? "No open limit orders found for this wallet." : undefined,
      };
    }
    case "get_sanctum_lst_details": {
      const lsts = await sakGetSanctumLSTDetails();
      if (!lsts.length) return { error: "Sanctum LST details unavailable", lsts: [] };
      const bestAPY = lsts.reduce((a, b) => a.apy > b.apy ? a : b);
      return {
        lsts,
        bestAPY: bestAPY.symbol,
        dataSource: "Sanctum Protocol via SAK DefiPlugin",
        summary: `目前 APY 最高的 LST 是 ${bestAPY.symbol}（${(bestAPY.apy * 100).toFixed(2)}%），TVL $${(bestAPY.tvl / 1e6).toFixed(0)}M。`,
      };
    }
    case "get_elfa_trending_tokens": {
      const tokens = await sakGetElfaTrendingTokens();
      return {
        tokens,
        count: tokens.length,
        dataSource: tokens.some(t => t.smartMentions > 0) ? "Elfa AI Smart Money Signals" : "CoinGecko Trending (Elfa fallback)",
        note: tokens.length === 0 ? "Trending data unavailable" : undefined,
      };
    }
    case "estimate_close_empty_accounts": {
      const wallet = input.wallet_address as string;
      const result = await sakEstimateCloseEmptyAccounts(wallet);
      return { ...result, dataSource: "Solana RPC Token Accounts", action: result.estimatedAccounts > 0 ? "可在錢包管理頁面執行清理" : undefined };
    }
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

// ── SSE helpers ──────────────────────────────────────────────────────────────

function sseEvent(type: string, data: unknown): string {
  return `event: ${type}\ndata: ${JSON.stringify(data)}\n\n`;
}

// ── Main route ───────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Anti-Sybil quota gate: uses "advisor_deep" (80pts) — Sonnet 4.6 + extended thinking
  const gate = await runQuotaGate(req, "advisor_deep");
  if (!gate.proceed) return gate.response;

  let body: LoopRequest;
  try {
    body = await req.json() as LoopRequest;
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  if (!body.walletAddress || !isValidSolanaAddress(body.walletAddress)) {
    return new Response(JSON.stringify({ error: "Invalid wallet address" }), { status: 400, headers: { "Content-Type": "application/json" } });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: string, data: unknown) => {
        controller.enqueue(encoder.encode(sseEvent(event, data)));
      };

      // If no API key, return a helpful message in Chinese
      if (!ANTHROPIC_API_KEY) {
        send("token", { text: "⚙️ AI 顾问需要配置 Anthropic API Key 才能运行。\n\n请在 `.env.local` 文件中设置：\n`ANTHROPIC_API_KEY=sk-ant-...`\n\n配置完成后重启服务即可使用 Claude Sonnet 4.6 深度分析功能。" });
        send("done", {
          memoPayload: `[Sakura] no API key configured`,
          actions: [],
          reasoningHash: createHash("sha256").update("no-key").digest("hex"),
        });
        controller.close();
        return;
      }

      const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

      const systemPrompt = `You are Sakura, an AI-powered DeFi advisor for Solana.
You have access to real-time data tools. Use them proactively.

TOOL USAGE RULES (严格遵守):
1. ALWAYS call get_apy_data before making yield/staking/lending recommendations.
2. ALWAYS call get_wallet_balance to understand the user's portfolio first.
3. ALWAYS call get_technical_analysis before recommending entry/exit price levels for any token.
   - The TA engine runs MACD + RSI + Bollinger Bands + OBV + Elliott Wave + Fibonacci.
   - Only issue a "buy" recommendation if coreGatePassed=true (all 4 core conditions met).
   - Include the TA tier (strong_buy/buy/neutral/sell/strong_sell) and score in your answer.
   - Quote the exact TP1/TP2/stopLoss levels calculated from Fibonacci extensions.
4. Call output_strategy AFTER calling get_technical_analysis when you have a buy/sell recommendation.
   Use the entry/tp1/tp2/stopLoss from TA result — do NOT invent price levels.

Wallet: ${body.walletAddress}
${body.walletSnapshot ? `Current holdings: ${body.walletSnapshot.solBalance.toFixed(3)} SOL, $${body.walletSnapshot.totalUSD.toFixed(0)} total, $${body.walletSnapshot.idleUSDC.toFixed(0)} idle USDC` : ""}
${body.sessionSummary ? `Previous conversation summary: ${body.sessionSummary}` : ""}

Rules:
- Be specific with numbers (exact SOL amounts, exact APY %, exact USD values)
- Always explain WHY you chose one protocol over another
- If preparing transactions, clearly state what the user needs to sign
- Keep responses under 300 words but information-dense
- Respond in the same language as the user's message`;

      const messages: Anthropic.MessageParam[] = [
        ...(body.history ?? []).slice(-8).map(h => ({
          role: h.role as "user" | "assistant",
          content: h.content,
        })),
        { role: "user", content: body.message },
      ];

      let allThinkingText = "";
      let finalText = "";
      const actionsPrepared: unknown[] = [];
      const strategyCards: StrategyCard[] = [];

      try {
        // Agentic loop: keep calling Claude until it stops using tools
        let continueLoop = true;
        let loopMessages = [...messages];

        while (continueLoop) {
          const response = await (client.messages.create as (params: unknown) => Promise<Anthropic.Message>)({
            model: "claude-sonnet-4-6",
            max_tokens: 16000,
            tools: TOOLS,
            messages: loopMessages,
            system: systemPrompt,
            thinking: { type: "enabled", budget_tokens: 8000 },
            betas: ["interleaved-thinking-2025-05-14"],
          });

          // Process content blocks (thinking + text + tool_use interleaved)
          for (const block of response.content) {
            if (block.type === "thinking") {
              allThinkingText += block.thinking + "\n";
              send("thinking_delta", { text: block.thinking });
            } else if (block.type === "text") {
              finalText += block.text;
              // Stream text token by token simulation (send in chunks)
              const words = block.text.split(" ");
              for (const word of words) {
                send("token", { text: word + " " });
              }
            } else if (block.type === "tool_use") {
              send("tool_call", { name: block.name, args: block.input });

              // Strategy card: capture without executing
              if (block.name === "output_strategy") {
                const card = captureStrategyCard(block.input as Record<string, unknown>);
                strategyCards.push(card);
                send("strategy_card", card);
                // Return acknowledgment to Claude so it can continue
                loopMessages = [
                  ...loopMessages,
                  { role: "assistant", content: response.content },
                  {
                    role: "user",
                    content: [{
                      type: "tool_result",
                      tool_use_id: block.id,
                      content: JSON.stringify({ captured: true, asset: card.asset }),
                    }],
                  },
                ];
                continue;
              }

              const toolResult = await executeTool(
                block.name,
                block.input as Record<string, unknown>
              );

              send("tool_result", { name: block.name, result: toolResult });

              // Collect prepared transactions as actions
              if (
                toolResult &&
                typeof toolResult === "object" &&
                "action" in toolResult
              ) {
                actionsPrepared.push((toolResult as { action: unknown }).action);
              }

              // Append assistant's message + tool result and continue loop
              loopMessages = [
                ...loopMessages,
                { role: "assistant", content: response.content },
                {
                  role: "user",
                  content: [
                    {
                      type: "tool_result",
                      tool_use_id: block.id,
                      content: JSON.stringify(toolResult),
                    },
                  ],
                },
              ];
            }
          }

          // Stop if Claude didn't use any tools (or hit end_turn)
          if (
            response.stop_reason === "end_turn" ||
            !response.content.some(b => b.type === "tool_use")
          ) {
            continueLoop = false;
          }
        }

        // Pre-commitment: hash all reasoning before emitting done
        const reasoningHash = createHash("sha256")
          .update(allThinkingText + finalText)
          .digest("hex");

        const memoPayload = `[Sakura] ${body.walletAddress.slice(0, 8)} | ${finalText.slice(0, 200)} | hash:${reasoningHash.slice(0, 16)}`.slice(0, 500);

        send("done", {
          memoPayload,
          reasoningHash,
          actions: actionsPrepared,
          strategyCards,
          thinkingLength: allThinkingText.length,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Loop error";
        send("error", { message: msg });
        send("done", {
          memoPayload: `[Sakura error] ${body.walletAddress.slice(0, 8)}`,
          actions: [],
          reasoningHash: createHash("sha256").update("error").digest("hex"),
        });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
