/**
 * Natural Language Strategy Compiler.
 * Uses Claude to compile plain Chinese/English into structured strategy JSON.
 */

export type TriggerType = "manual" | "cron" | "apy_threshold";
export type ActionType = "lend" | "stake" | "swap" | "unstake";

export interface StrategyTrigger {
  type: TriggerType;
  schedule?: string;       // cron: "0 9 * * 5" (every Friday 9am)
  condition?: {
    protocol_a: string;
    protocol_b: string;
    diff_pct: number;      // APY difference threshold
  };
}

export interface StrategyAction {
  type: ActionType;
  protocol?: string;       // e.g. "kamino", "marinade", "jito"
  token?: string;          // e.g. "USDC", "SOL"
  amountPct?: number;      // percentage of holdings (0-100)
  amountUsd?: number;      // fixed USD amount
  params?: Record<string, unknown>;
}

export interface Strategy {
  id: string;
  name: string;
  description: string;     // human-readable summary
  trigger: StrategyTrigger;
  actions: StrategyAction[];
  safety: {
    maxAmountUsd: number;
    requireApproval: boolean;
    maxSlippagePct: number;
  };
  createdAt: number;
  lastExecuted?: number;
  status: "draft" | "active" | "paused";
}

export interface CompileResult {
  strategy: Strategy;
  confidence: number;   // 0-1
  warnings: string[];   // e.g. "Amount not specified, defaulted to 10%"
}

/** Generate a unique ID for a strategy */
export function generateStrategyId(): string {
  return `strat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Create a human-readable summary of a strategy */
export function summarizeStrategy(strategy: Strategy): string {
  const triggerStr =
    strategy.trigger.type === "manual" ? "手動觸發" :
    strategy.trigger.type === "cron" ? `定時執行 (${strategy.trigger.schedule ?? "?"})` :
    `APY 差值超過 ${strategy.trigger.condition?.diff_pct ?? "?"}% 時觸發`;

  const actionsStr = strategy.actions.map(a => {
    const amount = a.amountUsd ? `$${a.amountUsd}` : a.amountPct ? `${a.amountPct}%` : "?";
    const proto = a.protocol ? ` (${a.protocol})` : "";
    return `${a.type} ${amount} ${a.token ?? ""}${proto}`;
  }).join(" → ");

  return `${triggerStr}: ${actionsStr}`;
}
