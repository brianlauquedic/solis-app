/**
 * Guardian Shared State — 解决 guardian/route.ts ↔ conditions/route.ts 循环引用
 *
 * 所有 Guardian 模块共享的类型与缓存都在这里定义。
 * 两个路由文件分别从这里导入，不再相互依赖。
 */

// ── Alert types ───────────────────────────────────────────────────

export interface GuardianAlert {
  id: string;
  type: "apy_change" | "price_alert" | "protocol_risk" | "health_warning";
  protocol: string;
  message: string;
  oldValue?: number;
  newValue?: number;
  direction: "up" | "down" | "neutral";
  severity: "info" | "warning" | "critical";
  timestamp: number;
  healthFactor?: number;
  ltv?: number;
  walletAddress?: string;
  actionRequired?: string;
}

// ── Guardian cache (module-level singleton) ───────────────────────

export const guardianCache: {
  alerts: GuardianAlert[];
  lastRun: number;
  baselineAPY: Record<string, number>;
  lastSolPrice: number | null;
  watchedWallets: Set<string>;
} = {
  alerts: [],
  lastRun: 0,
  baselineAPY: {},
  lastSolPrice: null,
  watchedWallets: new Set(),
};

// ── Conditions cache (module-level singleton) ─────────────────────
// Imported by both guardian/route.ts and guardian/conditions/route.ts

export type ConditionOperator = "lt" | "gt" | "lte" | "gte" | "change_pct";
export type ConditionMetric =
  | "sol_price"
  | "sol_apy_marinade"
  | "sol_apy_jito"
  | "usdc_apy_kamino"
  | "health_factor"
  | "smart_money_buy";

export type ActionType =
  | "alert_only"
  | "prepare_stake"
  | "prepare_lend"
  | "prepare_swap";

export interface TradingCondition {
  id: string;
  walletAddress: string;
  metric: ConditionMetric;
  operator: ConditionOperator;
  threshold: number;
  action: ActionType;
  actionParams?: {
    amount?: number;
    protocol?: string;
    inputMint?: string;
    outputMint?: string;
    smartWallet?: string;
  };
  label: string;
  enabled: boolean;
  triggeredAt?: number;
  triggerCount: number;
  createdAt: number;
  cooldownMs: number;
}

export const conditionsCache: Map<string, TradingCondition> = new Map();

// ── Default condition templates (shown when user hasn't set any) ───

export const CONDITION_TEMPLATES: Array<Omit<TradingCondition, "id" | "walletAddress" | "createdAt" | "triggeredAt" | "triggerCount">> = [
  {
    metric: "sol_price", operator: "lt", threshold: 150,
    action: "prepare_stake", actionParams: { amount: 1, protocol: "marinade" },
    label: "SOL 跌破 $150 → 准备质押 1 SOL（低价抄底）",
    enabled: false, cooldownMs: 4 * 60 * 60 * 1000,
  },
  {
    metric: "sol_price", operator: "gt", threshold: 250,
    action: "prepare_swap",
    actionParams: { inputMint: "So11111111111111111111111111111111111111112", outputMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", amount: 1 },
    label: "SOL 涨超 $250 → 准备换 USDC（获利了结）",
    enabled: false, cooldownMs: 4 * 60 * 60 * 1000,
  },
  {
    metric: "usdc_apy_kamino", operator: "gt", threshold: 12,
    action: "prepare_lend", actionParams: { amount: 100 },
    label: "Kamino USDC APY 超过 12% → 准备存入 100 USDC",
    enabled: false, cooldownMs: 24 * 60 * 60 * 1000,
  },
  {
    metric: "health_factor", operator: "lt", threshold: 1.3,
    action: "alert_only",
    label: "借贷健康系数低于 1.3 → 立即提醒（建议还款）",
    enabled: true, cooldownMs: 2 * 60 * 60 * 1000,
  },
];

// ── Condition evaluation (pure function — no route imports) ───────

export function evaluateConditions(
  metrics: {
    solPrice?: number;
    marinadeAPY?: number;
    jitoAPY?: number;
    kaminoAPY?: number;
    healthFactors?: Record<string, number>;
  }
): Array<{ condition: TradingCondition; triggered: boolean; currentValue: number }> {
  const results: Array<{ condition: TradingCondition; triggered: boolean; currentValue: number }> = [];
  const now = Date.now();

  for (const cond of conditionsCache.values()) {
    if (!cond.enabled) continue;
    if (cond.triggeredAt && (now - cond.triggeredAt) < cond.cooldownMs) continue;

    let currentValue: number | undefined;
    switch (cond.metric) {
      case "sol_price":         currentValue = metrics.solPrice; break;
      case "sol_apy_marinade":  currentValue = metrics.marinadeAPY; break;
      case "sol_apy_jito":      currentValue = metrics.jitoAPY; break;
      case "usdc_apy_kamino":   currentValue = metrics.kaminoAPY; break;
      case "health_factor":     currentValue = metrics.healthFactors?.[cond.walletAddress]; break;
      case "smart_money_buy":   currentValue = 0; break;
    }

    if (currentValue === undefined) {
      results.push({ condition: cond, triggered: false, currentValue: 0 });
      continue;
    }

    let triggered = false;
    switch (cond.operator) {
      case "lt":  triggered = currentValue < cond.threshold; break;
      case "gt":  triggered = currentValue > cond.threshold; break;
      case "lte": triggered = currentValue <= cond.threshold; break;
      case "gte": triggered = currentValue >= cond.threshold; break;
      case "change_pct": {
        const baseline = guardianCache.lastSolPrice ?? currentValue;
        const pctChange = Math.abs((currentValue - baseline) / baseline) * 100;
        triggered = pctChange >= cond.threshold;
        break;
      }
    }

    if (triggered) {
      cond.triggeredAt = now;
      cond.triggerCount++;
    }

    results.push({ condition: cond, triggered, currentValue });
  }

  return results;
}
