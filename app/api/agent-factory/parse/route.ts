import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export type AgentType = "price_alert" | "auto_trade" | "scheduled_report" | "smart_copy";

export interface AgentConfig {
  type: AgentType;
  displayName: string;
  confirmText: string;
  params: Record<string, unknown>;
}

const SYSTEM_PROMPT = `You are an agent configuration parser for Sakura DeFi platform.
Parse the user's natural language description into a structured agent configuration.

Available agent types:
1. price_alert — triggers when token price hits a threshold
   params: { token: string, condition: "above"|"below", price: number, tokenMint?: string }
   examples: "SOL 跌到 $140 提醒我", "當 SOL > $200 通知我", "BONK 漲到 0.00003 告訴我"

2. auto_trade — executes a Jupiter swap when price condition is met
   params: { token: string, condition: "above"|"below", triggerPrice: number, action: "buy"|"sell", amountUSD: number, tokenMint?: string }
   examples: "WIF > $0.20 自動買 $50", "SOL 跌到 $140 買 100 USDC 的 SOL", "當 BONK 漲到目標自動賣"

3. scheduled_report — generates an AI market analysis report on a schedule
   params: { cronExpr: string, cronLabel: string, reportType: "market_overview"|"portfolio"|"trending" }
   examples: "每天早9點生成市場報告", "每週一給我投資組合分析", "每小時推送熱門代幣"
   cronExpr format: "0 9 * * *" for daily 9am

4. smart_copy — follows smart money consensus signals
   params: { minStarRating: 1|2|3|4|5, minBuyersCount: number, autoExecute: boolean, maxAmountUSD: number }
   examples: "自動跟單聰明錢共識 ⭐⭐⭐ 以上", "聰明錢買什麼我也買，每次最多 $20", "追蹤 KOL 買入信號"

Respond with ONLY valid JSON in this format:
{
  "type": "<agent_type>",
  "displayName": "<short display name in user's language, max 20 chars>",
  "confirmText": "<confirmation message explaining what will happen, 1 sentence>",
  "params": { <type-specific params> }
}

If you cannot parse into any type, respond with:
{ "type": null, "error": "Cannot parse — please be more specific" }`;

export async function POST(req: NextRequest) {
  let body: { description?: string };
  try {
    body = await req.json() as { description?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const rawDesc = body.description?.trim() ?? "";
  if (!rawDesc || rawDesc.length < 3) {
    return NextResponse.json({ error: "Description too short" }, { status: 400 });
  }
  // Prompt injection guard: strip control chars and cap length
  const description = rawDesc.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "").slice(0, 500);

  if (!process.env.ANTHROPIC_API_KEY) {
    // Fallback: simple rule-based parsing
    return NextResponse.json(fallbackParse(description));
  }

  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: description }],
    });

    const text = msg.content[0].type === "text" ? msg.content[0].text.trim() : "";
    // Extract JSON from response (may have markdown wrapping)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "Parse failed", raw: text }, { status: 422 });
    }

    const parsed = JSON.parse(jsonMatch[0]) as AgentConfig & { error?: string };
    if (!parsed.type) {
      return NextResponse.json({ error: parsed.error ?? "Could not parse agent config" }, { status: 422 });
    }

    return NextResponse.json(parsed);
  } catch (err) {
    console.error("[agent-factory/parse]", err);
    return NextResponse.json(fallbackParse(description));
  }
}

// ── Rule-based fallback parser (no API key needed) ──────────────────
function fallbackParse(text: string): AgentConfig | { error: string } {
  const lower = text.toLowerCase();

  // Price alert patterns
  const priceMatch = text.match(/(SOL|BONK|JUP|WIF|[A-Z]{2,8})[^\d]*([<>≤≥跌漲到]+)[^\d]*[$\s]*(\d+[\d.,]*)/i);
  if (priceMatch || /(提醒|通知|警報|alert)/i.test(text)) {
    const token = priceMatch?.[1]?.toUpperCase() ?? "SOL";
    const op    = priceMatch?.[2] ?? "";
    const price = parseFloat((priceMatch?.[3] ?? "0").replace(",", ""));
    const cond  = (op.includes("<") || /跌|低於/.test(op)) ? "below" : "above";
    return {
      type: "price_alert",
      displayName: `${token} 價格警報`,
      confirmText: `當 ${token} ${cond === "below" ? "跌至" : "漲至"} $${price} 時，系統將推送通知。`,
      params: { token, condition: cond, price },
    };
  }

  // Auto trade patterns
  if (/(自動買|auto.*buy|買入|buy\s)/i.test(text)) {
    const token  = text.match(/(SOL|BONK|JUP|WIF|[A-Z]{2,8})/i)?.[1]?.toUpperCase() ?? "SOL";
    const amount = parseFloat(text.match(/\$?([\d]+)/)?.[1] ?? "20");
    return {
      type: "auto_trade",
      displayName: `自動買入 ${token}`,
      confirmText: `達到觸發條件時，自動用 $${amount} USDC 買入 ${token}（通過 Jupiter 執行）。`,
      params: { token, condition: "below", triggerPrice: 0, action: "buy", amountUSD: amount },
    };
  }

  // Scheduled report patterns
  if (/(每天|每日|每週|daily|weekly|報告|report|定時)/i.test(text)) {
    const isWeekly = /(每週|weekly)/i.test(text);
    return {
      type: "scheduled_report",
      displayName: isWeekly ? "每週市場報告" : "每日市場報告",
      confirmText: `${isWeekly ? "每週一" : "每天早上 9:00"} 自動生成 AI 市場分析報告。`,
      params: {
        cronExpr: isWeekly ? "0 9 * * 1" : "0 9 * * *",
        cronLabel: isWeekly ? "每週一 09:00" : "每日 09:00",
        reportType: "market_overview",
      },
    };
  }

  // Smart copy patterns
  if (/(跟單|copy|聰明錢|smart.money|kol)/i.test(text)) {
    const amount = parseFloat(text.match(/\$?([\d]+)/)?.[1] ?? "20");
    return {
      type: "smart_copy",
      displayName: "聰明錢跟單",
      confirmText: `當聰明錢共識信號 ⭐⭐⭐ 以上時，自動跟單（每次最多 $${amount}）。`,
      params: { minStarRating: 3, minBuyersCount: 2, autoExecute: false, maxAmountUSD: amount },
    };
  }

  return { error: "無法識別 Agent 類型。請嘗試：「SOL 跌到 $140 提醒我」或「每天早9點生成市場報告」" };
}
