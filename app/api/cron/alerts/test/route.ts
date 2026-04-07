/**
 * Test endpoint: inject a demo Guardian alert into the cache.
 * Used by GuardianConditionsPanel "提醒" button to simulate a condition trigger.
 * POST /api/cron/alerts/test  { label, metric, currentValue, severity }
 */

import { NextRequest, NextResponse } from "next/server";
import { guardianCache } from "@/lib/guardian-state";

export async function POST(req: NextRequest) {
  // Require same CRON_SECRET as the Guardian cron job
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("Authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json() as {
    label?: string;
    metric?: string;
    currentValue?: number;
    severity?: "info" | "warning" | "critical";
  };

  const label        = body.label        ?? "SOL 價格跌破 $150";
  const currentValue = body.currentValue ?? 150;
  const severity     = body.severity     ?? "warning";
  const metric       = body.metric       ?? "sol_price";

  const metricLabel =
    metric === "sol_price"        ? `SOL 價格 $${currentValue.toFixed(2)}` :
    metric === "health_factor"    ? `健康系數 ${currentValue.toFixed(2)}` :
    metric === "usdc_apy_kamino"  ? `Kamino APY ${currentValue.toFixed(1)}%` :
    metric === "sol_apy_marinade" ? `Marinade APY ${currentValue.toFixed(1)}%` :
    `${metric} = ${currentValue.toFixed(2)}`;

  const now = Math.floor(Date.now() / 1000);
  guardianCache.alerts.push({
    id: `test-${now}`,
    type: "price_alert",
    protocol: "Guardian",
    message: `條件觸發：${label}（當前：${metricLabel}）→ 請檢查您的倉位`,
    direction: "neutral",
    severity,
    timestamp: now,
  });

  // Keep last 20 alerts
  if (guardianCache.alerts.length > 20) {
    guardianCache.alerts.splice(0, guardianCache.alerts.length - 20);
  }

  return NextResponse.json({ ok: true, injected: label });
}
