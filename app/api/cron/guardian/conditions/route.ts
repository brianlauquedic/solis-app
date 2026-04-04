/**
 * Guardian Conditions — 自动化条件触发器
 *
 * Minara 对标创新：
 *   - 条件支持多维度：价格 / APY / 健康系数 / 聪明钱动作
 *   - 触发后生成预准备交易，用户一键签名即可执行（非托管、完全自主）
 *   - 条件类型比 Minara 更丰富（健康系数、APY 条件是 Minara 没有的）
 *
 * POST /api/cron/guardian/conditions   — add condition
 * GET  /api/cron/guardian/conditions   — list conditions for wallet
 * DELETE /api/cron/guardian/conditions — remove condition
 */

import { NextRequest, NextResponse } from "next/server";
import { runQuotaGate } from "@/lib/rate-limit";
import {
  guardianCache,
  conditionsCache,
  evaluateConditions,
  CONDITION_TEMPLATES,
  type TradingCondition,
  type ConditionMetric,
  type ConditionOperator,
  type ActionType,
} from "@/lib/guardian-state";

// Re-export for consumers that previously imported from this file
export { conditionsCache, evaluateConditions };
export type { TradingCondition };

// ── Route handlers ────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const gate = await runQuotaGate(req, "portfolio");
  if (!gate.proceed) return gate.response;

  let body: Partial<TradingCondition> & { action?: string };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }

  const walletAddress = (req.headers.get("x-wallet-address") ?? "").trim();
  if (!walletAddress || walletAddress.length < 32) {
    return NextResponse.json({ error: "x-wallet-address header required" }, { status: 400 });
  }

  // Return templates if no body provided
  if (!body.metric || !body.operator || body.threshold === undefined || !body.action) {
    return NextResponse.json({
      templates: CONDITION_TEMPLATES,
      hint: "POST with { metric, operator, threshold, action, label } to create a condition",
    });
  }

  const VALID_METRICS: ConditionMetric[] = [
    "sol_price", "sol_apy_marinade", "sol_apy_jito",
    "usdc_apy_kamino", "health_factor", "smart_money_buy",
  ];
  const VALID_OPERATORS: ConditionOperator[] = ["lt", "gt", "lte", "gte", "change_pct"];
  const VALID_ACTIONS: ActionType[] = ["alert_only", "prepare_stake", "prepare_lend", "prepare_swap"];

  if (!VALID_METRICS.includes(body.metric as ConditionMetric)) {
    return NextResponse.json({ error: `metric must be one of: ${VALID_METRICS.join(", ")}` }, { status: 400 });
  }
  if (!VALID_OPERATORS.includes(body.operator as ConditionOperator)) {
    return NextResponse.json({ error: `operator must be one of: ${VALID_OPERATORS.join(", ")}` }, { status: 400 });
  }
  if (!VALID_ACTIONS.includes(body.action as ActionType)) {
    return NextResponse.json({ error: `action must be one of: ${VALID_ACTIONS.join(", ")}` }, { status: 400 });
  }

  // Limit per wallet: 10 conditions max
  const walletConditions = Array.from(conditionsCache.values())
    .filter(c => c.walletAddress === walletAddress);
  if (walletConditions.length >= 10) {
    return NextResponse.json({
      error: "Maximum 10 conditions per wallet. Delete existing conditions to add more.",
      count: walletConditions.length,
    }, { status: 400 });
  }

  const now = Date.now();
  const condition: TradingCondition = {
    id: `cond-${walletAddress.slice(0, 6)}-${now}`,
    walletAddress,
    metric:       body.metric as ConditionMetric,
    operator:     body.operator as ConditionOperator,
    threshold:    Number(body.threshold),
    action:       body.action as ActionType,
    actionParams: body.actionParams,
    label:        body.label ?? `${body.metric} ${body.operator} ${body.threshold}`,
    enabled:      body.enabled !== false,
    triggerCount: 0,
    createdAt:    now,
    cooldownMs:   body.cooldownMs ?? (60 * 60 * 1000), // default 1h
  };

  conditionsCache.set(condition.id, condition);

  // Auto-register wallet for health monitoring
  guardianCache.watchedWallets.add(walletAddress);

  return NextResponse.json({
    ok: true,
    condition: {
      id: condition.id, label: condition.label,
      metric: condition.metric, threshold: condition.threshold,
      action: condition.action, enabled: condition.enabled,
    },
    totalConditions: walletConditions.length + 1,
  });
}

export async function GET(req: NextRequest) {
  const walletAddress = (req.headers.get("x-wallet-address") ?? "").trim();

  const conditions = walletAddress
    ? Array.from(conditionsCache.values()).filter(c => c.walletAddress === walletAddress)
    : Array.from(conditionsCache.values());

  return NextResponse.json({
    conditions: conditions.map(c => ({
      id: c.id, label: c.label,
      metric: c.metric, operator: c.operator, threshold: c.threshold,
      action: c.action, enabled: c.enabled,
      triggerCount: c.triggerCount,
      lastTriggered: c.triggeredAt ? new Date(c.triggeredAt).toISOString() : null,
      createdAt: new Date(c.createdAt).toISOString(),
    })),
    templates: CONDITION_TEMPLATES.map(t => ({
      metric: t.metric, operator: t.operator,
      threshold: t.threshold, action: t.action, label: t.label,
    })),
    totalActive: conditions.filter(c => c.enabled).length,
  });
}

export async function DELETE(req: NextRequest) {
  const walletAddress = (req.headers.get("x-wallet-address") ?? "").trim();
  let body: { conditionId?: string; deleteAll?: boolean };
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: "invalid json" }, { status: 400 }); }

  if (body.deleteAll && walletAddress) {
    let deleted = 0;
    for (const [id, cond] of conditionsCache.entries()) {
      if (cond.walletAddress === walletAddress) { conditionsCache.delete(id); deleted++; }
    }
    return NextResponse.json({ ok: true, deleted });
  }

  if (body.conditionId) {
    const cond = conditionsCache.get(body.conditionId);
    if (!cond) return NextResponse.json({ error: "condition not found" }, { status: 404 });
    if (walletAddress && cond.walletAddress !== walletAddress) {
      return NextResponse.json({ error: "unauthorized" }, { status: 403 });
    }
    conditionsCache.delete(body.conditionId);
    return NextResponse.json({ ok: true, deleted: body.conditionId });
  }

  return NextResponse.json({ error: "conditionId or deleteAll required" }, { status: 400 });
}
