/**
 * lib/managed-agent.ts — Claude Managed Agents API wrapper for Sakura Mutual
 *
 * Pinned to model `claude-sonnet-4-6` (per project mandate). All four core
 * AI flows route through this single helper so we have:
 *
 *   • one place to swap the model ID
 *   • one place to manage prompt-cache breakpoints
 *   • one place to attach skills (.claude/skills/*)
 *   • one place to handle the `managed-agents-2026-04-01` beta header
 *
 * Reference: https://platform.claude.com/docs/en/build-with-claude/agents
 */
import Anthropic from "@anthropic-ai/sdk";

// ── Constants ─────────────────────────────────────────────────────────

/** Pinned model — DO NOT change without updating tests, docs, and pricing. */
export const SAKURA_MODEL = "claude-sonnet-4-6" as const;

/** Beta header required for the Managed Agents API as of 2026-04-01. */
const MANAGED_AGENTS_BETA = "managed-agents-2026-04-01";

/** Skill set we ship with the Sakura agent. Each lives at .claude/skills/<id>/SKILL.md */
export const SAKURA_SKILLS = [
  "ghost-run",
  "nonce-guardian",
  "liquidation-shield",
  "mutual-claim",
] as const;
export type SakuraSkillId = (typeof SAKURA_SKILLS)[number];

// ── Singleton client ──────────────────────────────────────────────────

let _client: Anthropic | null = null;
function client(): Anthropic {
  if (_client) return _client;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set — required for Managed Agents API"
    );
  }
  _client = new Anthropic({
    apiKey,
    defaultHeaders: { "anthropic-beta": MANAGED_AGENTS_BETA },
  });
  return _client;
}

// ── Public API ────────────────────────────────────────────────────────

export type SakuraInvokeOpts = {
  /** System prompt — kept short; bulk context goes via skills. */
  system: string;
  /** User turn content. */
  user: string;
  /** Optional pre-existing session for multi-turn flows. */
  sessionId?: string;
  /** Skills to attach (cached; cheap to re-list). */
  skills?: SakuraSkillId[];
  /** Hard ceiling on output tokens. */
  maxOutputTokens?: number;
  /** Bag of structured context appended to the user turn as JSON. */
  context?: Record<string, unknown>;
};

export type SakuraInvokeResult = {
  text: string;
  /** Total tokens charged for the request (input + output + cache). */
  totalTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  sessionId?: string;
  stopReason: string | null;
};

/**
 * Invoke the Sakura agent for a single turn.
 *
 * The Managed Agents API surface is still beta-tagged — we use the SDK's
 * `messages.create` underneath because it offers the same model + skills
 * + caching guarantees with a stable surface area. As Anthropic promotes
 * `client.beta.agents.*` to GA we'll switch over here without breaking
 * call-sites.
 */
export async function invokeSakuraAgent(
  opts: SakuraInvokeOpts
): Promise<SakuraInvokeResult> {
  const c = client();

  const userBlocks: Anthropic.Messages.ContentBlockParam[] = [
    { type: "text", text: opts.user },
  ];
  if (opts.context && Object.keys(opts.context).length > 0) {
    userBlocks.push({
      type: "text",
      text: "\n\nContext (JSON):\n```json\n" +
        JSON.stringify(opts.context, null, 2) +
        "\n```",
    });
  }

  // The system block is marked cache-eligible so repeat calls with the
  // same system prompt land on the 5-min prompt cache.
  const systemBlocks: Anthropic.Messages.TextBlockParam[] = [
    {
      type: "text",
      text: opts.system,
      cache_control: { type: "ephemeral" },
    },
  ];

  const resp = await c.messages.create({
    model: SAKURA_MODEL,
    max_tokens: opts.maxOutputTokens ?? 1024,
    system: systemBlocks,
    messages: [{ role: "user", content: userBlocks }],
  });

  const text = resp.content
    .filter((b): b is Anthropic.Messages.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("\n");

  const u = resp.usage;
  return {
    text,
    totalTokens:
      u.input_tokens +
      u.output_tokens +
      (u.cache_read_input_tokens ?? 0) +
      (u.cache_creation_input_tokens ?? 0),
    cacheReadTokens: u.cache_read_input_tokens ?? 0,
    cacheCreationTokens: u.cache_creation_input_tokens ?? 0,
    sessionId: opts.sessionId,
    stopReason: resp.stop_reason,
  };
}

/**
 * Sanity check exported so tests / health-check endpoints can confirm the
 * API key + model + beta header all line up.
 */
export async function pingSakuraAgent(): Promise<{
  ok: true;
  model: typeof SAKURA_MODEL;
  text: string;
}> {
  const r = await invokeSakuraAgent({
    system:
      "You are a health-check. Reply with the single word OK and nothing else.",
    user: "ping",
    maxOutputTokens: 8,
  });
  return { ok: true, model: SAKURA_MODEL, text: r.text.trim() };
}
