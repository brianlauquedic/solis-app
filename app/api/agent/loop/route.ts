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
  // ── 極致運用：10 個新工具 ──
  sakGetTokenMetadata,
  sakGetAlloraTopics,
  sakGetAlloraInferenceByTopicId,
  sakSearchElfaMentions,
  sakGetElfaSmartMentions,
  sakGetDriftOrderBook,
  sakGetBridgeChains,
  sakParseTransaction,
  sakGetWalletAssets,
  sakPrepareSolayerStakeTx,
  SOL_MINT,
  USDC_MINT,
} from "@/lib/agent";
import { runQuotaGate, isValidSolanaAddress } from "@/lib/rate-limit";

export const maxDuration = 60; // Vercel: extend function timeout to 60s

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
    name: "get_weekly_report",
    description: "⚠️ MANDATORY for weekly/ecosystem requests. Get the latest Solana ecosystem weekly report in ONE call — SOL price, total DeFi TVL, DEX volume breakdown (Raydium/Orca/Jupiter), pump.fun data, top protocols, Fear & Greed Index, smart money flow, AI-generated narrative. Use this INSTEAD OF calling get_defi_llama + get_fear_greed + get_crypto_news separately. Trigger keywords: 週報, 生態週報, weekly report, ecosystem overview, TVL+DEX+pump.fun together.",
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
  // ── 極致運用：10 個新工具 ──────────────────────────────────────────────
  {
    name: "get_token_metadata",
    description: "Get full token metadata from Jupiter: name, symbol, decimals, daily volume, freeze/mint authority status, tags, and CoinGecko ID. Use when user asks about token details, whether a token is verified, or needs decimals for calculations.",
    input_schema: {
      type: "object" as const,
      properties: {
        mint: { type: "string", description: "Token mint address" },
      },
      required: ["mint"],
    },
  },
  {
    name: "get_allora_topics",
    description: "List all available Allora Network ML inference topics (price predictions for different assets). Use to discover what topics are available before calling get_allora_inference_by_topic.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "get_allora_inference_by_topic",
    description: "Get Allora Network ML price inference for a specific topic ID. More flexible than get_price_prediction — supports any asset, not just SOL. First call get_allora_topics to find the right topic ID.",
    input_schema: {
      type: "object" as const,
      properties: {
        topic_id: { type: "number", description: "Allora topic ID (get from get_allora_topics)" },
      },
      required: ["topic_id"],
    },
  },
  {
    name: "search_social_mentions",
    description: "Search crypto social media (Twitter/X) for posts containing specific keywords using Elfa AI. Use when user wants to know what people are saying about a specific topic, token, or narrative (e.g. 'Solana ETF', 'SOL breakout', '$JUP listing').",
    input_schema: {
      type: "object" as const,
      properties: {
        keywords:  { type: "string", description: "Search keywords (e.g. 'SOL breakout', '$BONK pump', 'Solana ETF')" },
        from_days: { type: "number", description: "How many days back to search (default: 7)" },
      },
      required: ["keywords"],
    },
  },
  {
    name: "get_smart_social_mentions",
    description: "Get the latest social media posts from smart money / KOL accounts tracked by Elfa AI. Shows what influential crypto figures are currently talking about. Use for macro intelligence and early alpha.",
    input_schema: {
      type: "object" as const,
      properties: {
        limit: { type: "number", description: "Number of posts to return (default: 20, max: 50)" },
      },
      required: [],
    },
  },
  {
    name: "get_drift_orderbook",
    description: "Get real-time L2 order book (bids/asks) for any Drift perpetual market. Shows market depth, best bid/ask, and oracle price. Use when user asks about market liquidity, price impact of large trades, or spread analysis.",
    input_schema: {
      type: "object" as const,
      properties: {
        market: { type: "string", description: "Market symbol: SOL-PERP, BTC-PERP, ETH-PERP, etc. (default: SOL-PERP)" },
      },
      required: [],
    },
  },
  {
    name: "get_bridge_chains",
    description: "List all blockchain networks supported by deBridge for cross-chain transfers. Use when user asks which chains they can bridge to/from, or before making bridge recommendations.",
    input_schema: {
      type: "object" as const,
      properties: {},
      required: [],
    },
  },
  {
    name: "parse_transaction",
    description: "Parse and explain any Solana transaction using Helius enhanced API. Returns human-readable description of what happened: swaps, transfers, staking, etc. Use when user pastes a transaction signature and asks 'what did this transaction do?'",
    input_schema: {
      type: "object" as const,
      properties: {
        tx_signature: { type: "string", description: "Solana transaction signature (base58 encoded, ~88 chars)" },
      },
      required: ["tx_signature"],
    },
  },
  {
    name: "get_wallet_assets",
    description: "Get all assets in a wallet using Helius DAS API: NFTs, compressed NFTs, fungible tokens. Use when user asks about their NFT portfolio, what tokens they hold, or a complete wallet overview.",
    input_schema: {
      type: "object" as const,
      properties: {
        wallet_address: { type: "string", description: "Solana wallet address" },
        limit:          { type: "number", description: "Max assets to return (default: 20)" },
      },
      required: ["wallet_address"],
    },
  },
  {
    name: "prepare_solayer_stake",
    description: "Prepare a Solayer native restaking transaction (SOL → sSOL). Solayer offers ~6-8% APY through native restaking + EigenLayer. Returns a serialized transaction for user to sign with Phantom. Use when user wants to stake SOL for maximum yield beyond standard LSTs.",
    input_schema: {
      type: "object" as const,
      properties: {
        amount_sol: { type: "number", description: "Amount of SOL to stake via Solayer" },
      },
      required: ["amount_sol"],
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
    case "get_weekly_report": {
      return {
        url: "https://sakuraaai.com/market",
        instruction: "The full Solana ecosystem weekly report is available on the market page. Direct the user there.",
      };
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
      // Try Messari first if key configured
      const result = await sakGetMessariResearch(query);
      if (result) return { ...result, dataSource: "Messari AI Research" };
      // Fallback: aggregate free on-chain research from DeFiLlama + CoinGecko
      try {
        const [llamaRes, cgRes] = await Promise.allSettled([
          fetch("https://api.llama.fi/v2/chains").then(r => r.ok ? r.json() : null),
          fetch("https://api.coingecko.com/api/v3/coins/solana?localization=false&tickers=false&community_data=false&developer_data=false").then(r => r.ok ? r.json() : null),
        ]);
        const llama = llamaRes.status === "fulfilled" ? llamaRes.value : null;
        const cg    = cgRes.status === "fulfilled" ? cgRes.value : null;
        const solChain = Array.isArray(llama) ? llama.find((c: {name?: string; tvl?: number}) => c.name === "Solana") : null;
        const price    = cg?.market_data?.current_price?.usd ?? "N/A";
        const mcap     = cg?.market_data?.market_cap?.usd ? `$${(cg.market_data.market_cap.usd / 1e9).toFixed(1)}B` : "N/A";
        const tvl      = solChain?.tvl ? `$${(solChain.tvl / 1e9).toFixed(2)}B` : "N/A";
        const change7d = cg?.market_data?.price_change_percentage_7d?.toFixed(1) ?? "N/A";
        return {
          answer: `Solana research summary (free data):\n• Price: $${price} | 7d change: ${change7d}%\n• Market Cap: ${mcap}\n• DeFiLlama TVL: ${tvl}\n• Query: "${query}"\n\nFor deeper institutional research, consider Messari Pro.`,
          sources: ["DeFiLlama", "CoinGecko"],
          dataSource: "DeFiLlama + CoinGecko (free fallback)",
        };
      } catch {
        return { error: "Research data unavailable", query };
      }
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
    // ── 極致運用：10 個新 SAK 工具 ──────────────────────────────────────
    case "get_token_metadata": {
      const mint = input.mint as string;
      const meta = await sakGetTokenMetadata(mint);
      if (!meta) return { error: `Token metadata not found for mint: ${mint}` };
      const warnings: string[] = [];
      if (meta.mintAuthority) warnings.push("⚠️ 此代幣仍可增發（Mint Authority 未放棄）");
      if (meta.freezeAuthority) warnings.push("⚠️ 此代幣帳戶可被凍結（Freeze Authority 存在）");
      if (!meta.isVerified) warnings.push("ℹ️ 此代幣未通過 Jupiter 驗證");
      return { ...meta, warnings, dataSource: "Jupiter Token List via SAK TokenPlugin" };
    }
    case "get_allora_topics": {
      const topics = await sakGetAlloraTopics();
      return {
        topics,
        count: topics.length,
        dataSource: "Allora Network ML via SAK MiscPlugin",
        note: topics.length === 0
          ? "Allora topics unavailable — set ALLORA_API_KEY for access"
          : `${topics.length} ML inference topics available. Use get_allora_inference_by_topic with a topicId for predictions.`,
      };
    }
    case "get_allora_inference_by_topic": {
      const topicId = input.topic_id as number;
      const inference = await sakGetAlloraInferenceByTopicId(topicId);
      if (!inference) return { error: `Allora inference unavailable for topic ${topicId}. Check ALLORA_API_KEY.` };
      return { ...inference, dataSource: "Allora Network ML via SAK MiscPlugin" };
    }
    case "search_social_mentions": {
      const keywords = input.keywords as string;
      const fromDays = (input.from_days as number | undefined) ?? 7;
      const mentions = await sakSearchElfaMentions(keywords, fromDays);
      return {
        keywords, fromDays, mentions, count: mentions.length,
        dataSource: "Elfa AI Social Search via SAK MiscPlugin",
        note: mentions.length === 0
          ? "No mentions found — set ELFA_API_KEY for full social search access"
          : `Found ${mentions.length} social posts mentioning "${keywords}"`,
      };
    }
    case "get_smart_social_mentions": {
      const limit = (input.limit as number | undefined) ?? 20;
      const posts = await sakGetElfaSmartMentions(limit);
      // Aggregate mentioned tickers
      const tickerFreq: Record<string, number> = {};
      posts.forEach(p => p.mentionedTickers.forEach(t => { tickerFreq[t] = (tickerFreq[t] ?? 0) + 1; }));
      const topTickers = Object.entries(tickerFreq).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([t, c]) => `${t}(×${c})`);
      return {
        posts, count: posts.length, topMentionedTickers: topTickers,
        dataSource: "Elfa AI Smart Mentions via SAK MiscPlugin",
        note: posts.length === 0 ? "Set ELFA_API_KEY for smart money social feed" : undefined,
      };
    }
    case "get_drift_orderbook": {
      const market = ((input.market as string | undefined) ?? "SOL-PERP").toUpperCase();
      const book = await sakGetDriftOrderBook(market);
      if (!book) return { error: `Order book unavailable for ${market}` };
      return { ...book, dataSource: "Drift DLOB via SAK DefiPlugin" };
    }
    case "get_bridge_chains": {
      const chains = await sakGetBridgeChains();
      return {
        chains, count: chains.length,
        dataSource: "deBridge via SAK DefiPlugin",
        note: chains.length === 0
          ? "deBridge API unavailable"
          : `${chains.length} chains supported. Use get_bridge_quote to get transfer quotes.`,
      };
    }
    case "parse_transaction": {
      const sig = input.tx_signature as string;
      const parsed = await sakParseTransaction(sig);
      if (!parsed) return {
        error: "Transaction parsing failed. Ensure HELIUS_API_KEY is set and the signature is valid.",
        tip: "Paste a valid Solana transaction signature (base58, ~88 characters)",
      };
      return { ...parsed, dataSource: "Helius Enhanced Transaction API via SAK MiscPlugin" };
    }
    case "get_wallet_assets": {
      const wallet = input.wallet_address as string;
      const limit  = (input.limit as number | undefined) ?? 20;
      const assets = await sakGetWalletAssets(wallet, limit);
      const totalUSD = assets.fungibleTokens.reduce((s, t) => s + (t.usdValue ?? 0), 0);
      return {
        ...assets,
        totalFungibleUSD: parseFloat(totalUSD.toFixed(2)),
        dataSource: "Helius DAS API via SAK MiscPlugin",
        summary: `${assets.nfts.length} NFTs, ${assets.fungibleTokens.length} fungible tokens, ${assets.compressedNfts} compressed NFTs`,
      };
    }
    case "prepare_solayer_stake": {
      const amountSol = input.amount_sol as number;
      const result = await sakPrepareSolayerStakeTx(amountSol);
      if (!result) return {
        error: "Solayer staking unavailable. The Solayer API may be temporarily down.",
        fallback: "Consider Marinade (prepare_stake_tx with protocol='marinade') as alternative.",
      };
      return {
        ...result,
        action: { type: "stake", protocol: "Solayer", amount: amountSol, outputToken: "sSOL" },
        note: "Transaction prepared. User must sign with Phantom wallet to execute.",
        dataSource: "Solayer Native Restaking API via SAK DefiPlugin pattern",
      };
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
  // Anti-Sybil quota gate: uses "advisor" (9pts) — Sonnet 4.6 streaming
  const gate = await runQuotaGate(req, "advisor");
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

  // Prompt injection guard: sanitize all user-controlled string inputs
  const MAX_MSG = 3000;
  const MAX_HISTORY_MSG = 1000;
  const MAX_SUMMARY = 200;

  function sanitize(s: string, maxLen: number): string {
    return s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").slice(0, maxLen);
  }

  const safeMessage = sanitize(body.message ?? "", MAX_MSG);
  const safeHistory = (body.history ?? []).slice(-8).map(h => ({
    role: h.role,
    content: sanitize(h.content, MAX_HISTORY_MSG),
  }));
  const safeSessionSummary = body.sessionSummary
    ? sanitize(body.sessionSummary, MAX_SUMMARY)
    : undefined;

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

      const systemPrompt = `You are Sakura, an AI-powered DeFi advisor for Solana with access to 40 real-time tools.

━━ TOOL USAGE RULES (MANDATORY) ━━
1. ALWAYS call get_apy_data before yield/staking/lending recommendations.
2. ALWAYS call get_wallet_balance to understand portfolio first.
3. ALWAYS call get_technical_analysis before recommending entry/exit levels.
   - Only issue "buy" if coreGatePassed=true. Use exact TP1/TP2/stopLoss from result.
4. Call output_strategy AFTER get_technical_analysis for buy/sell recommendations.
5. For market sentiment questions: call get_fear_greed + get_technical_analysis together.
6. For "what's happening with [token]": call get_crypto_news + get_social_sentiment together.
7. For comprehensive research: call get_messari_research + get_defi_llama + get_technical_analysis.
8. ⚠️ CRITICAL: If user asks for 週報, 生態週報, weekly report, or ecosystem overview — call get_weekly_report ONLY, then respond: "最新 Solana 生態週報已準備好，請前往查看：https://sakuraaai.com/market 🌸". Do NOT call any other tools.

━━ TOOL CAPABILITIES ━━
PRICING: get_token_price (Jupiter), get_pyth_price (Pyth oracle 400ms), get_token_metadata (full info)
YIELD:   get_apy_data, get_sanctum_apy, get_sanctum_lst_details (APY+TVL+price), get_drift_borrow_apy
TRADING: compare_swap_quotes (Jupiter vs OKX), prepare_swap_tx, prepare_stake_tx, prepare_solayer_stake (sSOL)
ORDERS:  get_user_limit_orders, get_drift_orderbook (L2 depth), get_drift_perp_markets (funding rates)
BRIDGE:  get_bridge_quote, get_bridge_chains (all supported chains)
ANALYSIS: get_technical_analysis (6 indicators), get_defi_llama (TVL), get_messari_research (institutional)
SENTIMENT: get_fear_greed, get_social_sentiment, get_elfa_trending_tokens, get_smart_social_mentions
SEARCH:  search_social_mentions (keyword search on crypto social), get_crypto_news
ALLORA:  get_price_prediction (SOL), get_allora_topics (all ML topics), get_allora_inference_by_topic
WALLET:  get_wallet_balance, get_wallet_assets (NFTs+tokens via Helius DAS), estimate_close_empty_accounts
UTILITY: parse_transaction (explain any tx hash), get_network_status (TPS), resolve_token_ticker
REPORT:  get_weekly_report (full Solana ecosystem weekly report — TVL, DEX volume, pump.fun, smart money, narrative)

━━ DATA PRECISION ━━
- Use Pyth oracle (get_pyth_price) for time-sensitive trades — updates every 400ms
- Use Sanctum LST details for comprehensive LST comparison with TVL validation
- Use DeFiLlama TVL to validate protocol health before recommending
- Combine Fear&Greed + TA score for highest-confidence entry signals
- For social alpha: search_social_mentions + get_smart_social_mentions together

Wallet: ${body.walletAddress}
${body.walletSnapshot ? `Portfolio: ${body.walletSnapshot.solBalance.toFixed(3)} SOL | $${body.walletSnapshot.totalUSD.toFixed(0)} total | $${body.walletSnapshot.idleUSDC.toFixed(0)} idle USDC` : ""}
${safeSessionSummary ? `Session context: ${safeSessionSummary}` : ""}

Rules:
- Be specific with numbers (exact SOL amounts, exact APY %, exact USD)
- Always cite which data source you used and when it was retrieved
- If preparing transactions, state exactly what the user needs to sign
- When multiple staking options exist, compare APY + TVL + protocol risk
- Respond in the same language as the user's message`;

      const messages: Anthropic.MessageParam[] = [
        ...safeHistory.map(h => ({
          role: h.role as "user" | "assistant",
          content: h.content,
        })),
        { role: "user", content: safeMessage },
      ];

      // ── Weekly report shortcut: bypass Claude entirely ───────────
      const isWeeklyReportRequest = /週報|生態週報|weekly\s*report|ecosystem\s*(report|overview)/i.test(safeMessage);
      if (isWeeklyReportRequest) {
        const text = "最新 Solana 生態週報已準備好，請前往查看：https://sakuraaai.com/market 🌸";
        send("token", { text });
        send("done", {
          memoPayload: `[Sakura] weekly report → sakuraaai.com/market`,
          reasoningHash: createHash("sha256").update(text).digest("hex"),
          actions: [],
        });
        controller.close();
        return;
      }

      let allThinkingText = "";
      let finalText = "";
      const actionsPrepared: unknown[] = [];
      const strategyCards: StrategyCard[] = [];

      try {
        // Agentic loop: keep calling Claude until it stops using tools
        let continueLoop = true;
        let loopMessages = [...messages];

        while (continueLoop) {
          // Use streaming API so tokens appear in real-time (no waiting for full response)
          const streamInstance = client.messages.stream({
            model: "claude-sonnet-4-6",
            max_tokens: 4096,
            tools: TOOLS,
            messages: loopMessages,
            system: systemPrompt,
          });

          // Stream text/thinking deltas in real-time via async iterator
          for await (const chunk of streamInstance) {
            if (chunk.type === "content_block_delta") {
              if (chunk.delta.type === "text_delta") {
                finalText += chunk.delta.text;
                send("token", { text: chunk.delta.text });
              } else if (chunk.delta.type === "thinking_delta") {
                allThinkingText += chunk.delta.thinking;
                send("thinking_delta", { text: chunk.delta.thinking });
              }
            }
          }

          // Get the fully assembled message for tool call handling
          const response = await streamInstance.finalMessage();

          // Process tool_use blocks (text/thinking already streamed above)
          // Collect all tool results first, then append once (prevents duplicate assistant messages)
          const toolResults: Array<{ type: "tool_result"; tool_use_id: string; content: string }> = [];

          for (const block of response.content) {
            if (block.type === "thinking") {
              // Already streamed above — skip to avoid duplicates
            } else if (block.type === "text") {
              // Already streamed above — skip to avoid duplicates
            } else if (block.type === "tool_use") {
              send("tool_call", { name: block.name, args: block.input });

              // Strategy card: capture without executing
              if (block.name === "output_strategy") {
                const card = captureStrategyCard(block.input as Record<string, unknown>);
                strategyCards.push(card);
                send("strategy_card", card);
                toolResults.push({
                  type: "tool_result",
                  tool_use_id: block.id,
                  content: JSON.stringify({ captured: true, asset: card.asset }),
                });
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

              toolResults.push({
                type: "tool_result",
                tool_use_id: block.id,
                content: JSON.stringify(toolResult),
              });
            }
          }

          // Append assistant message + ALL tool results once (correct multi-tool format)
          if (toolResults.length > 0) {
            loopMessages = [
              ...loopMessages,
              { role: "assistant", content: response.content },
              { role: "user", content: toolResults },
            ];
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
        const msg = err instanceof Error ? `${err.message} | ${err.stack?.split("\n")[1]?.trim() ?? ""}` : String(err);
        console.error("[agent/loop] error:", msg);
        send("error", { message: msg });
        send("done", {
          memoPayload: `[Sakura error] ${body.walletAddress.slice(0, 8)}`,
          actions: [],
          errorMessage: msg,
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
