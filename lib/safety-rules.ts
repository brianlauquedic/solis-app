/**
 * Natural Language AI Agent Safety Rules.
 * Claude compiles plain-language rules into structured guardrails.
 * Every SAK action is validated against these rules before execution.
 */
import type { StrategyAction } from "@/lib/strategy-compiler";

export type RuleType =
  | "max_per_tx"          // max amount per transaction
  | "max_per_day"         // max total per day
  | "whitelist_protocols" // only allow listed protocols
  | "blacklist_protocols" // block listed protocols
  | "whitelist_tokens"    // only allow listed tokens
  | "require_approval";   // always require user approval

export interface SafetyRule {
  id: string;
  type: RuleType;
  value: number | string[];   // number for limits, string[] for allow/deny lists
  description: string;         // human-readable Chinese description
  enabled: boolean;
  createdAt: number;
}

export interface ValidationResult {
  allowed: boolean;
  reason?: string;    // why blocked (if not allowed)
  warnings: string[]; // non-blocking cautions
}

/** Validate a strategy action against the active safety rules */
export function validateAction(
  action: StrategyAction,
  rules: SafetyRule[]
): ValidationResult {
  const activeRules = rules.filter(r => r.enabled);
  const warnings: string[] = [];

  for (const rule of activeRules) {
    switch (rule.type) {
      case "max_per_tx": {
        const limit = rule.value as number;
        const amount = action.amountUsd ?? 0;
        if (amount > limit) {
          return {
            allowed: false,
            reason: `交易金額 $${amount} 超過單筆上限 $${limit}（規則：${rule.description}）`,
            warnings,
          };
        }
        if (amount > limit * 0.8) {
          warnings.push(`交易金額 $${amount} 接近單筆上限 $${limit}`);
        }
        break;
      }

      case "whitelist_protocols": {
        const allowed = (rule.value as string[]).map(p => p.toLowerCase());
        if (action.protocol && !allowed.includes(action.protocol.toLowerCase())) {
          return {
            allowed: false,
            reason: `協議 "${action.protocol}" 不在允許列表中（${(rule.value as string[]).join(", ")}）`,
            warnings,
          };
        }
        break;
      }

      case "blacklist_protocols": {
        const blocked = (rule.value as string[]).map(p => p.toLowerCase());
        if (action.protocol && blocked.includes(action.protocol.toLowerCase())) {
          return {
            allowed: false,
            reason: `協議 "${action.protocol}" 在禁止列表中（規則：${rule.description}）`,
            warnings,
          };
        }
        break;
      }

      case "whitelist_tokens": {
        const allowed = (rule.value as string[]).map(t => t.toUpperCase());
        if (action.token && !allowed.includes(action.token.toUpperCase())) {
          return {
            allowed: false,
            reason: `代幣 "${action.token}" 不在允許列表中（${(rule.value as string[]).join(", ")}）`,
            warnings,
          };
        }
        break;
      }

      case "require_approval": {
        // Don't block, but note that approval is required
        warnings.push("此操作需要手動確認（安全規則要求）");
        break;
      }
    }
  }

  return { allowed: true, warnings };
}

/** Generate a unique ID for a safety rule */
export function generateRuleId(): string {
  return `rule_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

/** Default safety rules for new users */
export const DEFAULT_RULES: Omit<SafetyRule, "id" | "createdAt">[] = [
  {
    type: "max_per_tx",
    value: 100,
    description: "單筆交易最多 $100 USDC",
    enabled: true,
  },
  {
    type: "whitelist_protocols",
    value: ["kamino", "marinade", "jito"],
    description: "只允許操作 Kamino、Marinade、Jito",
    enabled: true,
  },
  {
    type: "require_approval",
    value: [],
    description: "所有操作都需要手動確認",
    enabled: true,
  },
];
