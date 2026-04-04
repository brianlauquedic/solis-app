import { NextRequest, NextResponse } from "next/server";
import { extractIdentifiers, peekQuota, FREE_QUOTA, FEATURE_FEE, isAdminWallet, Feature } from "@/lib/rate-limit";

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
    } else {
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
