/**
 * Subscription API — Credit-based model
 *
 * GET  /api/subscription
 *   Headers: X-Wallet-Address
 *   Returns: credit balance, tier, expiry, plan info
 *
 * POST /api/subscription
 *   Body: { tier: "basic"|"pro", txSig: string, billingPeriod?: "monthly"|"annual" }
 *   Headers: X-Wallet-Address
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getSubscription,
  activateSubscription,
  subscriptionSummary,
  SUBSCRIPTION_PRICE_MONTHLY,
  SUBSCRIPTION_PRICE_ANNUAL,
  TIER_MONTHLY_CREDITS,
  FEATURE_CREDIT_COST,
  FEATURE_CREDIT_LABELS,
  SUBSCRIPTION_FEATURES,
  SubscriptionTier,
  BillingPeriod,
} from "@/lib/subscription";
import { isAdminWallet } from "@/lib/rate-limit";

// ── GET — subscription status ─────────────────────────────────────

export async function GET(req: NextRequest) {
  const walletAddress = (req.headers.get("x-wallet-address") ?? "").trim();

  // Admin wallets get unlimited Pro
  if (walletAddress && isAdminWallet(walletAddress)) {
    return NextResponse.json(
      {
        tier: "pro",
        active: true,
        admin: true,
        creditBalance: 999_999,
        monthlyCredits: 999_999,
        rolloverCredits: 0,
        daysRemaining: null,
        plans: buildPlans(),
        creditCosts: FEATURE_CREDIT_COST,
        creditLabels: FEATURE_CREDIT_LABELS,
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  const record = walletAddress ? await getSubscription(walletAddress) : null;
  const summary = subscriptionSummary(record);

  return NextResponse.json(
    {
      ...summary,
      walletAddress: walletAddress ? walletAddress.slice(0, 8) + "…" : null,
      plans: buildPlans(),
      creditCosts: FEATURE_CREDIT_COST,
      creditLabels: FEATURE_CREDIT_LABELS,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

// ── POST — activate subscription ─────────────────────────────────

interface ActivateBody {
  tier: "basic" | "pro";
  txSig: string;
  billingPeriod?: BillingPeriod;
}

export async function POST(req: NextRequest) {
  const walletAddress = (req.headers.get("x-wallet-address") ?? "").trim();

  if (!walletAddress || walletAddress.length < 32) {
    return NextResponse.json(
      { error: "X-Wallet-Address header required (connected wallet)" },
      { status: 400 }
    );
  }

  let body: ActivateBody;
  try {
    body = (await req.json()) as ActivateBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { tier, txSig, billingPeriod = "monthly" } = body;

  if (!tier || !["basic", "pro"].includes(tier)) {
    return NextResponse.json({ error: "tier must be 'basic' or 'pro'" }, { status: 400 });
  }
  if (!txSig || txSig.length < 32) {
    return NextResponse.json({ error: "txSig required" }, { status: 400 });
  }

  const result = await activateSubscription(walletAddress, tier, txSig, billingPeriod);

  if (!result.success) {
    const priceMonthly = (SUBSCRIPTION_PRICE_MONTHLY[tier] / 1_000_000).toFixed(2);
    const priceAnnual  = (SUBSCRIPTION_PRICE_ANNUAL[tier]  / 1_000_000).toFixed(2);
    return NextResponse.json(
      {
        error: result.error,
        feeWallet: process.env.SOLIS_FEE_WALLET || "not-configured",
        pricingOptions: {
          monthly: `$${priceMonthly} USDC/月`,
          annual:  `$${priceAnnual} USDC/年 (省30%)`,
        },
      },
      { status: 402 }
    );
  }

  const summary = subscriptionSummary(result.record!);
  const tierLabel = tier === "basic" ? "Basic ($8/月)" : "Pro ($28/月)";

  return NextResponse.json(
    {
      success: true,
      subscription: summary,
      message: `🎉 ${tierLabel} 订阅已激活！获得 ${summary.creditBalance} 点数，有效 30 天。`,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}

// ── Build plans for frontend ──────────────────────────────────────

function buildPlans() {
  const tiers: SubscriptionTier[] = ["free", "basic", "pro"];
  return tiers.map(tier => ({
    tier,
    label:         tier === "free" ? "Free" : tier === "basic" ? "Basic" : "Pro",
    priceMonthly:  tier === "free" ? 0 : SUBSCRIPTION_PRICE_MONTHLY[tier as "basic" | "pro"] / 1_000_000,
    priceAnnual:   tier === "free" ? 0 : SUBSCRIPTION_PRICE_ANNUAL[tier  as "basic" | "pro"] / 1_000_000,
    currency:      "USDC",
    credits:       TIER_MONTHLY_CREDITS[tier],
    features:      SUBSCRIPTION_FEATURES[tier],
    recommended:   tier === "basic",
    rollover:      tier === "pro" ? 2000 : 0,
    savingsAnnual: tier === "free" ? 0
      : Math.round((SUBSCRIPTION_PRICE_MONTHLY[tier as "basic" | "pro"] * 12 - SUBSCRIPTION_PRICE_ANNUAL[tier as "basic" | "pro"]) / 1_000_000),
  }));
}
