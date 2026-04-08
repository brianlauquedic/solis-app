import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { generateStrategyId } from "@/lib/strategy-compiler";
import type { Strategy, CompileResult } from "@/lib/strategy-compiler";

export const maxDuration = 30;

const SYSTEM_PROMPT = `You are a Solana DeFi strategy compiler. Convert natural language investment instructions into structured JSON strategies.

Output ONLY valid JSON matching this schema:
{
  "strategy": {
    "id": "strat_placeholder",
    "name": "<short name in user's language>",
    "description": "<1-2 sentence human-readable description>",
    "trigger": {
      "type": "manual" | "cron" | "apy_threshold",
      "schedule": "<cron expression if type=cron>",
      "condition": { "protocol_a": "", "protocol_b": "", "diff_pct": 0 }
    },
    "actions": [
      {
        "type": "lend" | "stake" | "swap" | "unstake",
        "protocol": "<protocol name>",
        "token": "<token symbol>",
        "amountPct": <0-100 or null>,
        "amountUsd": <number or null>
      }
    ],
    "safety": {
      "maxAmountUsd": <derived from user's instruction or default 100>,
      "requireApproval": true,
      "maxSlippagePct": 0.5
    },
    "createdAt": 0,
    "status": "draft"
  },
  "confidence": <0.0-1.0>,
  "warnings": ["<any assumptions made>"]
}

Rules:
- If user says "每週五" → type: "cron", schedule: "0 9 * * 5"
- If user says "APY 差超過X%" → type: "apy_threshold"
- If no trigger specified → type: "manual"
- If amount not specified → default to amountPct: 50 and add a warning
- Map Chinese protocol names: 卡米諾/Kamino → "kamino", 海神/Marinade → "marinade", Jito → "jito"
- Supported action types: lend (存入借貸), stake (質押), swap (兌換), unstake (解除質押)
- Output ONLY the JSON object. No explanation, no markdown.`;

export async function POST(req: NextRequest) {
  let body: { text?: string } = {};
  try { body = await req.json(); } catch { /* ok */ }

  const text = (body.text ?? "").trim();
  if (!text || text.length < 5) {
    return NextResponse.json({ error: "Please provide strategy description" }, { status: 400 });
  }
  if (text.length > 500) {
    return NextResponse.json({ error: "Description too long (max 500 chars)" }, { status: 400 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "AI service unavailable" }, { status: 503 });
  }

  const client = new Anthropic({ apiKey });

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 800,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: text }],
    });

    const rawText = message.content[0].type === "text" ? message.content[0].text : "";

    // Parse JSON — strip markdown fences if present
    const jsonStr = rawText.replace(/^```json?\n?/, "").replace(/\n?```$/, "").trim();
    let result: CompileResult;
    try {
      result = JSON.parse(jsonStr) as CompileResult;
    } catch {
      return NextResponse.json({ error: "AI returned invalid JSON", raw: rawText }, { status: 500 });
    }

    // Assign real ID and timestamp
    result.strategy.id = generateStrategyId();
    result.strategy.createdAt = Date.now();
    result.strategy.status = "draft";

    return NextResponse.json(result);
  } catch (err) {
    console.error("[strategy/compile] error:", err);
    return NextResponse.json({ error: "Compilation failed" }, { status: 500 });
  }
}
