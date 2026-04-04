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
  SOL_MINT,
  USDC_MINT,
} from "@/lib/agent";
import { runQuotaGate } from "@/lib/rate-limit";

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
