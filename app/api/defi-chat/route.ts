import { NextRequest } from "next/server";
import { runQuotaGate } from "@/lib/rate-limit";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? "";

// ── Referral links ───────────────────────────────────────────────
const REF = {
  marinade: process.env.MARINADE_REFERRAL_CODE ? `?ref=${process.env.MARINADE_REFERRAL_CODE}` : "",
  kamino:   process.env.KAMINO_REFERRAL_CODE   ? `?ref=${process.env.KAMINO_REFERRAL_CODE}`   : "",
  jito:     "",
};

interface WalletSnapshot {
  solBalance: number;
  totalUSD: number;
  idleUSDC: number;
}

export interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
}

interface ChatRequest {
  message: string;
  wallet: WalletSnapshot;
  history?: HistoryMessage[];
  sessionSummary?: string;
  liveYield?: {
    opportunities: Array<{
      protocol: string;
      apy: number;
      apyDisplay: string;
      riskLevel: string;
      url: string;
      detail: string;
    }>;
  };
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

// ── Intent detection ─────────────────────────────────────────────
type IntentType =
  | "stake_sol" | "deposit_usdc" | "swap"
  | "yield_find" | "price_check" | "portfolio_check"
  | "analyze_token" | "rug_check" | "unknown";

function detectIntent(text: string): { type: IntentType; amount?: number; token?: string; mint?: string } {
  const t = text.toLowerCase();
  const numMatch = t.match(/[\d,.]+/);
  const amount = numMatch ? parseFloat(numMatch[0].replace(",", "")) : undefined;

  if (/(质押|staking|stake|liquid.*stake)/i.test(t) && /sol/i.test(t)) return { type: "stake_sol", amount };
  if (/(存入|理财|存usdc|earn|lending)/i.test(t) && /usdc/i.test(t)) return { type: "deposit_usdc", amount };
  if (/(收益|yield|apy|利率|最高|怎么赚|赚钱|被动收入|机会)/i.test(t)) return { type: "yield_find" };
  if (/(换|swap|兑换|卖掉)/i.test(t)) {
    const to = t.match(/(换成|to|买)\s*(sol|usdc|usdt|bonk|jup)/i)?.[2]?.toUpperCase() ?? "USDC";
    return { type: "swap", amount, token: to };
  }
  const mintMatch = t.match(/[1-9A-HJ-NP-Za-km-z]{32,44}/);
  if (mintMatch) return { type: "analyze_token", mint: mintMatch[0] };
  if (/(rug|跑路|骗局|safe|安全|检测)/i.test(t)) {
    const tok = t.match(/\$?([a-z]{2,10})/i)?.[1]?.toUpperCase() ?? "?";
    return { type: "rug_check", token: tok };
  }
  const priceMatch = t.match(/(sol|usdc|bonk|jup|btc|eth)/i);
  if (priceMatch && /(价格|price|多少|涨|跌)/i.test(t)) return { type: "price_check", token: priceMatch[1].toUpperCase() };
  if (/(我的钱包|portfolio|资产|持仓|总值|体检|健康)/i.test(t)) return { type: "portfolio_check" };
  return { type: "unknown" };
}

// ── Rule-based response generator ───────────────────────────────
function ruleBasedResponse(
  intent: ReturnType<typeof detectIntent>,
  wallet: WalletSnapshot,
  liveYield?: ChatRequest["liveYield"]
): { text: string; actions?: ActionCard[] } {
  const sol = wallet.solBalance;
  const usdc = wallet.idleUSDC;
  const total = wallet.totalUSD;

  const getAPY = (protocol: string, fallback: number) => {
    const found = liveYield?.opportunities.find(o => o.protocol === protocol);
    return found ? found.apy : fallback;
  };

  switch (intent.type) {
    case "stake_sol": {
      const amt = intent.amount ?? Math.max(sol * 0.6, 0.01);
      const marinadeAPY = getAPY("Marinade Finance", 7.2);
      const jitoAPY = getAPY("Jito", 7.5);
      return {
        text: `质押 **${amt.toFixed(2)} SOL** 到流动性质押协议，年化 ${marinadeAPY.toFixed(1)}-${jitoAPY.toFixed(1)}%，获得的 mSOL/jitoSOL 可继续在 DeFi 中使用不影响流动性：`,
        actions: [
          {
            protocol: "Marinade Finance", icon: "🫙",
            action: `质押 ${amt.toFixed(2)} SOL → mSOL`,
            detail: "全链最大 SOL 质押协议，流动性最好",
            apy: `${marinadeAPY.toFixed(1)}%`,
            estimatedEarn: `+${(amt * marinadeAPY / 100).toFixed(3)} SOL/年`,
            url: `https://marinade.finance/${REF.marinade}`, color: "#8B5CF6", riskLevel: "低",
          },
          {
            protocol: "Jito", icon: "⚡",
            action: `质押 ${amt.toFixed(2)} SOL → jitoSOL`,
            detail: "含 MEV 奖励，APY 略高于 Marinade",
            apy: `${jitoAPY.toFixed(1)}%`,
            estimatedEarn: `+${(amt * jitoAPY / 100).toFixed(3)} SOL/年`,
            url: "https://www.jito.network/staking/", color: "#06B6D4", riskLevel: "低",
          },
        ],
      };
    }

    case "deposit_usdc": {
      const amt = intent.amount ?? usdc;
      const kaminoAPY = getAPY("Kamino Finance", 8.2);
      const solendAPY = getAPY("Save (Solend)", 5.5);
      return {
        text: `将 **$${amt.toFixed(0)} USDC** 存入借贷协议，稳定获取利息，无价格风险：`,
        actions: [
          {
            protocol: "Kamino Finance", icon: "🌿",
            action: `存入 $${amt.toFixed(0)} USDC`,
            detail: "自动复利，利率随市场波动",
            apy: `${kaminoAPY.toFixed(1)}%`,
            estimatedEarn: `$${(amt * kaminoAPY / 100 / 12).toFixed(1)}/月`,
            url: `https://app.kamino.finance/${REF.kamino}`, color: "#10B981", riskLevel: "低",
          },
          {
            protocol: "Save (Solend)", icon: "🏦",
            action: `存入 $${amt.toFixed(0)} USDC`,
            detail: "Solana 最老牌借贷协议，多次审计",
            apy: `${solendAPY.toFixed(1)}%`,
            estimatedEarn: `$${(amt * solendAPY / 100 / 12).toFixed(1)}/月`,
            url: "https://save.finance/", color: "#3B82F6", riskLevel: "低",
          },
          {
            protocol: "Marginfi", icon: "💎",
            action: `存入 $${amt.toFixed(0)} USDC`,
            detail: "支持跨保证金，功能最丰富",
            apy: "~6.5%",
            estimatedEarn: `$${(amt * 0.065 / 12).toFixed(1)}/月`,
            url: "https://app.marginfi.com/", color: "#F59E0B", riskLevel: "低",
          },
        ],
      };
    }

    case "swap": {
      const amt = intent.amount ?? 1;
      const to = intent.token ?? "USDC";
      return {
        text: `通过 Jupiter 聚合器兑换，自动寻找最优路由，滑点最小：`,
        actions: [{
          protocol: "Jupiter Swap", icon: "🪐",
          action: `${amt} SOL → ${to}`,
          detail: "全 Solana 最优价格，支持 100+ 交易对，MEV 保护",
          url: `https://jup.ag/swap/SOL-${to}`,
          color: "#8B5CF6", riskLevel: "低",
        }],
      };
    }

    case "yield_find": {
      const actions: ActionCard[] = [];
      const marinadeAPY = getAPY("Marinade Finance", 7.2);
      const kaminoAPY = getAPY("Kamino Finance", 8.2);
      const raydiumAPY = getAPY("Raydium CLMM", 22);
      const solPrice = sol > 0 && total > 0 ? total / sol : 180;

      if (sol > 0.1) {
        actions.push({
          protocol: "Marinade Finance", icon: "🫙",
          action: `质押 ${(sol * 0.6).toFixed(2)} SOL`,
          detail: `流动性质押，当前 APY ${marinadeAPY.toFixed(1)}%`,
          apy: `${marinadeAPY.toFixed(1)}%`,
          estimatedEarn: `$${(sol * 0.6 * marinadeAPY / 100 * solPrice).toFixed(0)}/年`,
          url: `https://marinade.finance/${REF.marinade}`, color: "#8B5CF6", riskLevel: "低",
        });
      }
      if (usdc > 5) {
        actions.push({
          protocol: "Kamino Finance", icon: "🌿",
          action: `存入 $${usdc.toFixed(0)} USDC`,
          detail: `USDC 借贷自动复利，当前 APY ${kaminoAPY.toFixed(1)}%`,
          apy: `${kaminoAPY.toFixed(1)}%`,
          estimatedEarn: `$${(usdc * kaminoAPY / 100 / 12).toFixed(1)}/月`,
          url: `https://app.kamino.finance/${REF.kamino}`, color: "#10B981", riskLevel: "低",
        });
      }
      if (sol > 0.5 && usdc > 10) {
        actions.push({
          protocol: "Raydium CLMM", icon: "🌊",
          action: "SOL-USDC 集中流动性",
          detail: `手续费做市，当前 APY ${raydiumAPY.toFixed(1)}%（含无常损失风险）`,
          apy: `${raydiumAPY.toFixed(1)}%`,
          estimatedEarn: "收益随市场波动",
          url: "https://raydium.io/liquidity/", color: "#F59E0B", riskLevel: "中",
        });
      }

      const text = actions.length > 0
        ? `基于你的钱包（SOL: ${sol.toFixed(3)}，USDC: $${usdc.toFixed(0)}），以下是当前实时最优收益机会：`
        : "你的钱包余额较少，建议先积累更多 SOL/USDC 再进行 DeFi 操作。";
      return { text, actions };
    }

    case "portfolio_check":
      return {
        text: `你的钱包总资产 **$${total.toFixed(0)}**，含 **${sol.toFixed(3)} SOL** + **$${usdc.toFixed(0)} USDC** 闲置。切换到「🏥 钱包体检」Tab 查看完整报告。\n\n有什么我可以帮你做的？`,
      };

    case "analyze_token":
      return {
        text: `切换到「🔍 代币分析」Tab，粘贴合约地址 **${intent.mint?.slice(0, 8)}...** 即可获得安全评分和 AI 买入建议，并生成链上可验证推理证明。`,
      };

    case "rug_check":
      return {
        text: `检测 **$${intent.token}** 安全性：切换到「🔍 代币分析」Tab，输入合约地址，Solis 将检测增发权限、持币集中度、蜜罐等 5 项风险。`,
      };

    default:
      return {
        text: `我可以帮你：\n\n💰 **收益** — "帮我质押 2 SOL" / "USDC 存哪里利息最高"\n🔍 **安全** — "分析这个代币 [合约地址]"\n💱 **交易** — "把 1 SOL 换成 USDC"\n📊 **资产** — "查看我的收益机会"`,
      };
  }
}

// ── Session summary ──────────────────────────────────────────────
async function generateSessionSummary(
  history: HistoryMessage[],
  wallet: WalletSnapshot
): Promise<string | null> {
  if (!ANTHROPIC_API_KEY || ANTHROPIC_API_KEY === "your-anthropic-api-key-here") return null;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);
    const transcript = history.slice(-10).map(h => `${h.role}: ${h.content}`).join("\n");
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 80,
        system: "根据对话记录，用一句话（不超过40字）总结用户的投资偏好和关注点，只输出总结内容。",
        messages: [{
          role: "user",
          content: `对话记录：\n${transcript}\n用户钱包：SOL ${wallet.solBalance.toFixed(2)}，总资产 $${wallet.totalUSD.toFixed(0)}`,
        }],
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const data = await res.json();
    return data?.content?.[0]?.text?.trim() ?? null;
  } catch {
    return null;
  }
}

// ── SHA-256 reasoning hash ───────────────────────────────────────
async function buildReasoningHash(
  message: string,
  responseText: string,
  wallet: WalletSnapshot,
  aiAvailable: boolean
): Promise<string> {
  const payload = JSON.stringify({
    input: message,
    output: responseText.slice(0, 200),
    wallet: wallet.totalUSD.toFixed(0),
    engine: aiAvailable ? "claude-haiku-4-5" : "rule-based",
    ts: Math.floor(Date.now() / 1000),
  });
  const msgBuf = new TextEncoder().encode(payload);
  const hashBuf = await crypto.subtle.digest("SHA-256", msgBuf);
  return Array.from(new Uint8Array(hashBuf))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── SSE helpers ──────────────────────────────────────────────────
function sseEvent(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Main SSE handler ─────────────────────────────────────────────
export async function POST(req: NextRequest) {
  // Anti-Sybil quota gate: 3 free AI advisor sessions per wallet/device/IP
  const gate = await runQuotaGate(req, "advisor");
  if (!gate.proceed) return gate.response;

  let body: ChatRequest;
  try {
    body = await req.json() as ChatRequest;
  } catch {
    return new Response(JSON.stringify({ error: "invalid json" }), { status: 400 });
  }

  const { message, wallet, history, sessionSummary, liveYield } = body;
  if (!message?.trim()) {
    return new Response(JSON.stringify({ error: "empty message" }), { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      function emit(event: string, data: unknown) {
        controller.enqueue(encoder.encode(sseEvent(event, data)));
      }

      try {
        // ── Phase 1: Thinking steps ──────────────────────────────
        const steps = ["分析钱包上下文...", "获取实时 APY...", "评估风险偏好..."];
        for (const step of steps) {
          emit("thinking", { step });
          await sleep(90);
        }

        // ── Phase 2: Generate response ───────────────────────────
        let fullText = "";
        let actions: ActionCard[] | undefined;
        let aiAvailable = false;

        const hasApiKey = !!ANTHROPIC_API_KEY && ANTHROPIC_API_KEY !== "your-anthropic-api-key-here";

        if (hasApiKey) {
          // Build system prompt
          const topYield = liveYield?.opportunities
            .slice(0, 3)
            .map(o => `${o.protocol}: ${o.apyDisplay} APY (${o.riskLevel}风险)`)
            .join("、") ?? "暂无实时数据";
          const summaryLine = sessionSummary ? `\n用户历史偏好：${sessionSummary}` : "";
          const systemPrompt = `你是 Solis，一个 Solana 链上 AI 财务顾问。用简洁的中文回答，不超过120字。
用户钱包：SOL ${wallet.solBalance.toFixed(3)}，USDC $${wallet.idleUSDC.toFixed(0)}，总资产 $${wallet.totalUSD.toFixed(0)}
当前实时最优收益：${topYield}${summaryLine}
规则：直接给出建议，涉及协议时给出名称，基于用户实际余额，不要套话。`;

          const historyMessages = (history ?? []).slice(-8).map(h => ({
            role: h.role as "user" | "assistant",
            content: h.content,
          }));
          const allMessages = [...historyMessages, { role: "user" as const, content: message }];

          try {
            const controller2 = new AbortController();
            const timeout = setTimeout(() => controller2.abort(), 10000);

            const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
              method: "POST",
              headers: {
                "x-api-key": ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type": "application/json",
              },
              body: JSON.stringify({
                model: "claude-haiku-4-5",
                max_tokens: 300,
                stream: true,
                system: systemPrompt,
                messages: allMessages,
              }),
              signal: controller2.signal,
            });

            clearTimeout(timeout);

            if (anthropicRes.ok && anthropicRes.body) {
              aiAvailable = true;
              const reader = anthropicRes.body.getReader();
              const dec = new TextDecoder();
              let buffer = "";

              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += dec.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop() ?? "";

                for (const line of lines) {
                  if (line.startsWith("data: ")) {
                    try {
                      const parsed = JSON.parse(line.slice(6));
                      if (
                        parsed.type === "content_block_delta" &&
                        parsed.delta?.type === "text_delta" &&
                        parsed.delta.text
                      ) {
                        const token = parsed.delta.text as string;
                        fullText += token;
                        emit("token", { text: token });
                      }
                    } catch { /* ignore malformed SSE lines */ }
                  }
                }
              }
            }
          } catch {
            aiAvailable = false;
          }
        }

        // ── Fallback: rule-based (emit as single token chunk) ────
        if (!aiAvailable) {
          const intent = detectIntent(message);
          const result = ruleBasedResponse(intent, wallet, liveYield);
          fullText = result.text;
          actions = result.actions;
          emit("token", { text: fullText });
        }

        // ── Phase 3: Build hash and emit done ────────────────────
        const reasoningHash = await buildReasoningHash(message, fullText, wallet, aiAvailable);
        const memoPayload = `[Solis] ${fullText}`.slice(0, 500);

        // Generate session summary if history is long enough
        let newSessionSummary: string | undefined;
        if (history && history.length >= 10 && !sessionSummary) {
          newSessionSummary = await generateSessionSummary(history, wallet) ?? undefined;
        }

        emit("done", {
          reasoningHash,
          memoPayload,
          actions,
          aiAvailable,
          ...(newSessionSummary ? { sessionSummary: newSessionSummary } : {}),
        });

      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "stream error";
        emit("error", { message: msg });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
