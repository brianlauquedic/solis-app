/**
 * Frontend polling endpoint for guardian alerts.
 * Called every 5 minutes from DefiAssistant.tsx.
 * Returns alerts accumulated by the hourly cron job.
 */

import { NextResponse } from "next/server";
import { guardianCache } from "@/lib/guardian-state";

type GuardianAlertItem = (typeof guardianCache.alerts)[number];

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  // Optional: only return alerts since a given timestamp
  const since = parseInt(searchParams.get("since") ?? "0");

  const alerts = since > 0
    ? guardianCache.alerts.filter((a: GuardianAlertItem) => a.timestamp > since)
    : guardianCache.alerts;

  return NextResponse.json({
    alerts,
    lastRun: guardianCache.lastRun,
    count: alerts.length,
  });
}
