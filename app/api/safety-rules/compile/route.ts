import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { generateRuleId } from "@/lib/safety-rules";
import type { SafetyRule } from "@/lib/safety-rules";

export const maxDuration = 20;

const SYSTEM_PROMPT = `You are a DeFi security rule compiler. Convert plain language security instructions into structured JSON rules.

Output ONLY a JSON array of rule objects. Each rule matches this schema:
{
  "type": "max_per_tx" | "max_per_day" | "whitelist_protocols" | "blacklist_protocols" | "whitelist_tokens" | "require_approval",
  "value": <number for limits, string[] for lists, [] for require_approval>,
  "description": "<concise Chinese description of what this rule does>",
  "enabled": true
}

Type mapping guide:
- "每次最多 $X" / "單筆不超過 $X" → type: "max_per_tx", value: X (number)
- "每天最多 $X" → type: "max_per_day", value: X (number)
- "只能用 X 和 Y" / "只允許 X" → type: "whitelist_protocols", value: ["x", "y"]
- "不能用 X" / "禁止 X" → type: "blacklist_protocols", value: ["x"]
- "只能操作 USDC 和 SOL" → type: "whitelist_tokens", value: ["USDC", "SOL"]
- "每次都要我確認" → type: "require_approval", value: []

Protocol name normalization:
- 卡米諾, kamino → "kamino"
- 海神, marinade, Marinade → "marinade"
- Jito, jito → "jito"
- Jupiter, 木星 → "jupiter"

Output ONLY the JSON array. No explanation, no markdown code fences.`;

export async function POST(req: NextRequest) {
  let body: { text?: string } = {};
  try { body = await req.json(); } catch { /* ok */ }

  const text = (body.text ?? "").trim();
  if (!text || text.length < 5) {
    return NextResponse.json({ error: "Please provide rule description" }, { status: 400 });
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
      max_tokens: 400,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: text }],
    });

    const rawText = message.content[0].type === "text" ? message.content[0].text : "";
    const jsonStr = rawText.replace(/^```json?\n?/, "").replace(/\n?```$/, "").trim();

    let parsed: Omit<SafetyRule, "id" | "createdAt">[];
    try {
      parsed = JSON.parse(jsonStr);
      if (!Array.isArray(parsed)) parsed = [parsed];
    } catch {
      return NextResponse.json({ error: "AI returned invalid JSON", raw: rawText }, { status: 500 });
    }

    const rules: SafetyRule[] = parsed.map(r => ({
      ...r,
      id: generateRuleId(),
      createdAt: Date.now(),
    }));

    return NextResponse.json({ rules });
  } catch (err) {
    console.error("[safety-rules/compile] error:", err);
    return NextResponse.json({ error: "Compilation failed" }, { status: 500 });
  }
}
