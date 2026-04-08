import { NextRequest, NextResponse } from "next/server";
import { extractIdentifiers, peekQuota, FREE_QUOTA, FEATURE_FEE, isAdminWallet, isValidSolanaAddress, Feature } from "@/lib/rate-limit";
import { getOrCreateFreeRecord, FEATURE_CREDIT_COST, TIER_MONTHLY_CREDITS, Feature as SubFeature } from "@/lib/subscription";

const ALL_FEATURES: Feature[] = ["analyze", "advisor", "agent", "verify", "portfolio"];

/**
 * GET /api/quota?features=analyze,advisor,agent
 * Returns quota status for the requesting device/wallet across specified features.
 * Used by frontend to show "X/3 free remaining" badges.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const featuresParam = searchParams.get("features") ?? "analyze,advisor,agent,verify,portfolio";
  const requestedFeatures = featuresParam
    .split(",")
    .map(f => f.trim())
    .filter(f => ALL_FEATURES.includes(f as Feature)) as Feature[];

  const ids = extractIdentifiers(req);
  const wallet = (req.headers.get("x-wallet-address") ?? "").trim();
  if (wallet && !isValidSolanaAddress(wallet)) {
    return NextResponse.json({ error: "Invalid wallet address" }, { status: 400 });
  }
  const admin = wallet ? isAdminWallet(wallet) : false;

  const result: Record<string, {
    used: number;
    remaining: number;
    freeQuota: number;
    feePriceDollars: number;
    admin: boolean;
  }> = {};

  for (const feature of requestedFeatures) {
    if (admin) {
      result[feature] = { used: 0, remaining: FREE_QUOTA, freeQuota: FREE_QUOTA, feePriceDollars: 0, admin: true };
    } else if (wallet) {
      // Wallet connected (non-admin) → show subscription credit-based quota
      const record = await getOrCreateFreeRecord(wallet);
      const cost = FEATURE_CREDIT_COST[feature as SubFeature] ?? 10;

      let remaining: number;
      let freeQuota: number;

      if (record.tier === "free") {
        // Free tier: show per-feature use counter (3 per feature, consistent with pricing page)
        const FREE_PER_FEATURE = 3;
        const usedCount = record.featureUsage?.[feature as SubFeature] ?? 0;
        remaining = Math.max(0, FREE_PER_FEATURE - usedCount);
        freeQuota = FREE_PER_FEATURE;
      } else {
        // Paid tier: show actual credit balance ÷ cost
        const monthlyMax = TIER_MONTHLY_CREDITS[record.tier];
        remaining = Math.floor(record.creditBalance / cost);
        freeQuota = Math.floor(monthlyMax / cost);
      }

      result[feature] = {
        used: freeQuota - remaining,
        remaining,
        freeQuota,
        feePriceDollars: 0,
        admin: false,
      };
    } else {
      // No wallet → device/IP quota (3 per month)
      const { used, remaining } = await peekQuota(feature, ids);
      result[feature] = {
        used,
        remaining,
        freeQuota: FREE_QUOTA,
        feePriceDollars: FEATURE_FEE[feature] / 1_000_000,
        admin: false,
      };
    }
  }

  return NextResponse.json(result, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}
