/**
 * Guardian Cron Job — runs hourly via Vercel Cron (vercel.json).
 *
 * Monitors:
 *   1. APY changes across Marinade, Jito, Kamino (existing)
 *   2. SOL price movements (existing)
 *   3. Lending position health factors — NEW (F3)
 *      · Kamino: fetches obligations, checks LTV/health factor
 *      · Marginfi: fetches accounts, checks health
 *      · Solend: fetches obligations, checks utilization
 *
 * Alert severity levels:
 *   info     — notable change (APY ±0.5%, health > 1.5)
 *   warning  — action recommended (APY ±2%, health 1.2–1.5, price ±5%)
 *   critical — urgent action required (health < 1.2, price ±10%)
 *
 * Alerts stored in module-level cache; frontend polls /api/cron/alerts.
 */

import { NextResponse } from "next/server";
import { sakGetTokenPrice, SOL_MINT } from "@/lib/agent";
import {
  guardianCache,
  evaluateConditions,
  conditionsCache,
  type GuardianAlert,
} from "@/lib/guardian-state";

function fetchWithTimeout(url: string, opts: RequestInit = {}, ms = 6000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

// ── APY fetchers (existing) ───────────────────────────────────────

async function fetchMarinadeAPY(): Promise<number> {
  try {
    const res = await fetchWithTimeout("https://api.marinade.finance/msol/apy/30d");
    if (!res.ok) return 7.2;
    const data = await res.json();
    return typeof data === "number" ? data * 100 : 7.2;
  } catch { return 7.2; }
}

async function fetchJitoAPY(): Promise<number> {
  try {
    const res = await fetchWithTimeout("https://kv-cache.jito.network/api/v1/jitoSOL/apy");
    if (!res.ok) return 7.5;
    const data = await res.json();
    const val = data?.value ?? data?.apy ?? data;
    return typeof val === "number" ? val * 100 : 7.5;
  } catch { return 7.5; }
}

async function fetchKaminoUSDCAPY(): Promise<number> {
  try {
    const res = await fetchWithTimeout(
      "https://api.kamino.finance/strategies/metrics?env=mainnet-beta&status=ACTIVE"
    );
    if (!res.ok) return 8.2;
    const data = await res.json();
    const usdcStrategy = Array.isArray(data)
      ? data.find((s: { tokenSymbol?: string }) =>
          s.tokenSymbol === "USDC" || s.tokenSymbol === "USD Coin"
        )
      : null;
    const apy = usdcStrategy?.apy;
    return typeof apy === "number" && apy > 0 ? apy * 100 : 8.2;
  } catch { return 8.2; }
}

// ── Lending position health check (F3 — NEW) ─────────────────────

export interface LendingPosition {
  protocol: "kamino" | "marginfi" | "solend";
  walletAddress: string;
  depositedUSD: number;
  borrowedUSD: number;
  healthFactor: number;   // > 1.0 = solvent; < 1.0 = liquidatable
  ltv: number;            // loan-to-value ratio (0–1)
  maxLtv: number;         // protocol max LTV before liquidation
  liquidationThreshold: number;
}

interface KaminoObligation {
  state?: {
    deposits?: Array<{ marketValue?: { val?: number } }>;
    borrows?: Array<{ marketValue?: { val?: number } }>;
    loanToValue?: { val?: number };
    unhealthyBorrowValue?: { val?: number };
    borrowedAssetsMarketValue?: { val?: number };
  };
}

interface MarginfiAccount {
  group?: string;
  balances?: Array<{
    active?: boolean;
    bankAddress?: string;
    assetShares?: { value?: number };
    liabilityShares?: { value?: number };
  }>;
  riskTier?: string;
}

async function fetchKaminoPositions(walletAddress: string): Promise<LendingPosition[]> {
  try {
    const res = await fetchWithTimeout(
      `https://api.kamino.finance/v2/users/${walletAddress}/obligations?env=mainnet-beta`,
      {}, 8000
    );
    if (!res.ok) return [];
    const data = await res.json() as { obligations?: KaminoObligation[] };
    const positions: LendingPosition[] = [];

    for (const obl of (data.obligations ?? [])) {
      const state = obl.state;
      if (!state) continue;

      const depositedUSD = (state.deposits ?? [])
        .reduce((sum, d) => sum + (d.marketValue?.val ?? 0), 0);
      const borrowedUSD = (state.borrows ?? [])
        .reduce((sum, b) => sum + (b.marketValue?.val ?? 0), 0);

      if (depositedUSD < 1 && borrowedUSD < 1) continue; // skip dust positions

      const ltv = depositedUSD > 0 ? borrowedUSD / depositedUSD : 0;
      // Kamino liquidation threshold is typically 80% LTV
      const maxLtv = 0.80;
      // Health factor = maxLtv / ltv (> 1 = healthy)
      const healthFactor = ltv > 0 ? maxLtv / ltv : 999;

      positions.push({
        protocol: "kamino",
        walletAddress,
        depositedUSD,
        borrowedUSD,
        healthFactor,
        ltv,
        maxLtv,
        liquidationThreshold: maxLtv,
      });
    }
    return positions;
  } catch {
    return [];
  }
}

async function fetchMarginfiPositions(walletAddress: string): Promise<LendingPosition[]> {
  try {
    const res = await fetchWithTimeout(
      `https://app.marginfi.com/api/user?wallet=${walletAddress}`,
      {}, 8000
    );
    if (!res.ok) return [];
    const data = await res.json() as { accounts?: MarginfiAccount[] };
    const positions: LendingPosition[] = [];

    for (const acct of (data.accounts ?? [])) {
      // Estimate health from balances
      let depositedUSD = 0;
      let borrowedUSD = 0;
      for (const bal of (acct.balances ?? [])) {
        if (!bal.active) continue;
        const assetVal = (bal.assetShares?.value ?? 0);
        const liabVal = (bal.liabilityShares?.value ?? 0);
        depositedUSD += assetVal;
        borrowedUSD += liabVal;
      }
      if (depositedUSD < 1 && borrowedUSD < 1) continue;

      const ltv = depositedUSD > 0 ? borrowedUSD / depositedUSD : 0;
      const maxLtv = 0.80;
      const healthFactor = ltv > 0 ? maxLtv / ltv : 999;

      positions.push({
        protocol: "marginfi",
        walletAddress,
        depositedUSD,
        borrowedUSD,
        healthFactor,
        ltv,
        maxLtv,
        liquidationThreshold: maxLtv,
      });
    }
    return positions;
  } catch {
    return [];
  }
}

async function fetchSolendPositions(walletAddress: string): Promise<LendingPosition[]> {
  try {
    const res = await fetchWithTimeout(
      `https://api.solend.fi/v1/obligations?wallet=${walletAddress}`,
      {}, 8000
    );
    if (!res.ok) return [];
    type SolendObl = {
      depositedValue?: string | number;
      borrowedValue?: string | number;
      liquidationThreshold?: string | number;
    };
    const data = await res.json() as { results?: SolendObl[] };
    const positions: LendingPosition[] = [];

    for (const obl of (data.results ?? [])) {
      const depositedUSD = Number(obl.depositedValue ?? 0);
      const borrowedUSD  = Number(obl.borrowedValue ?? 0);
      if (depositedUSD < 1 && borrowedUSD < 1) continue;

      const maxLtv = Number(obl.liquidationThreshold ?? 0.80);
      const ltv = depositedUSD > 0 ? borrowedUSD / depositedUSD : 0;
      const healthFactor = ltv > 0 ? maxLtv / ltv : 999;

      positions.push({
        protocol: "solend",
        walletAddress,
        depositedUSD,
        borrowedUSD,
        healthFactor,
        ltv,
        maxLtv,
        liquidationThreshold: maxLtv,
      });
    }
    return positions;
  } catch {
    return [];
  }
}

function healthAlertSeverity(hf: number): "info" | "warning" | "critical" | null {
  if (hf < 1.05) return "critical";  // < 5% buffer → liquidation imminent
  if (hf < 1.20) return "critical";  // < 20% buffer
  if (hf < 1.35) return "warning";   // < 35% buffer
  if (hf < 1.50) return "info";      // < 50% buffer
  return null; // healthy, no alert needed
}

// guardianCache and GuardianAlert are now in lib/guardian-state.ts (re-exported for consumers)
export type { GuardianAlert };

// ── Main cron handler ─────────────────────────────────────────────

export async function GET(req: Request) {
  // Verify Vercel Cron secret (or allow dev bypass)
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret) {
    const authHeader = req.headers.get("Authorization");
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }

  const [marinadeAPY, jitoAPY, kaminoAPY, solPrice] = await Promise.all([
    fetchMarinadeAPY(),
    fetchJitoAPY(),
    fetchKaminoUSDCAPY(),
    sakGetTokenPrice(SOL_MINT),
  ]);

  const current: Record<string, number> = {
    marinade: marinadeAPY,
    jito: jitoAPY,
    kamino: kaminoAPY,
  };

  const newAlerts: GuardianAlert[] = [];
  const now = Date.now();

  // ── 1. APY change detection ───────────────────────────────────

  for (const [protocol, apy] of Object.entries(current)) {
    const baseline = guardianCache.baselineAPY[protocol];
    if (baseline !== undefined && Math.abs(apy - baseline) >= 0.5) {
      const direction = apy > baseline ? "up" : "down";
      const severity = Math.abs(apy - baseline) >= 2 ? "warning" : "info";
      newAlerts.push({
        id: `apy-${protocol}-${now}`,
        type: "apy_change",
        protocol: protocol.charAt(0).toUpperCase() + protocol.slice(1),
        message: `${protocol.charAt(0).toUpperCase() + protocol.slice(1)} APY ${direction === "up" ? "上升" : "下降"} ${baseline.toFixed(1)}% → ${apy.toFixed(1)}%`,
        oldValue: baseline,
        newValue: apy,
        direction,
        severity,
        timestamp: now,
      });
    }
  }

  // ── 2. SOL price change detection ────────────────────────────

  if (solPrice && guardianCache.lastSolPrice) {
    const pctChange = (solPrice - guardianCache.lastSolPrice) / guardianCache.lastSolPrice;
    if (Math.abs(pctChange) >= 0.05) {
      const direction = pctChange > 0 ? "up" : "down";
      const severity = Math.abs(pctChange) >= 0.10 ? "critical" : "warning";
      newAlerts.push({
        id: `price-sol-${now}`,
        type: "price_alert",
        protocol: "SOL",
        message: `SOL 价格${direction === "up" ? "急涨" : "急跌"} ${(Math.abs(pctChange) * 100).toFixed(1)}% → $${solPrice.toFixed(2)}`,
        oldValue: guardianCache.lastSolPrice,
        newValue: solPrice,
        direction,
        severity,
        timestamp: now,
      });
    }
  }

  // ── 3. Lending health monitoring (F3) ────────────────────────

  let healthChecked = 0;
  const walletList = Array.from(guardianCache.watchedWallets);

  // Run health checks in parallel for all watched wallets
  const healthResults = await Promise.allSettled(
    walletList.map(async (wallet) => {
      const positions = await Promise.all([
        fetchKaminoPositions(wallet),
        fetchMarginfiPositions(wallet),
        fetchSolendPositions(wallet),
      ]);
      return positions.flat();
    })
  );

  for (let i = 0; i < walletList.length; i++) {
    const wallet = walletList[i];
    const result = healthResults[i];
    if (result.status !== "fulfilled") continue;

    for (const pos of result.value) {
      healthChecked++;
      const severity = healthAlertSeverity(pos.healthFactor);
      if (!severity) continue;

      const ltvPct = (pos.ltv * 100).toFixed(1);
      const hf = pos.healthFactor.toFixed(2);
      const walletShort = wallet.slice(0, 6) + "…";
      const protocolName = pos.protocol.charAt(0).toUpperCase() + pos.protocol.slice(1);

      let actionRequired = "";
      if (severity === "critical") {
        actionRequired = `立即还款 $${Math.ceil(pos.borrowedUSD * 0.2).toLocaleString()} 或增加质押物`;
      } else if (severity === "warning") {
        actionRequired = `建议还款部分借款或增加质押，当前 LTV ${ltvPct}%`;
      } else {
        actionRequired = `监控中：健康系数 ${hf}，建议保持 LTV 低于 60%`;
      }

      newAlerts.push({
        id: `health-${pos.protocol}-${wallet.slice(0, 8)}-${now}`,
        type: "health_warning",
        protocol: protocolName,
        message: `${walletShort} ${protocolName} 借贷健康系数 ${hf}（LTV ${ltvPct}%，存款 $${pos.depositedUSD.toFixed(0)}，借款 $${pos.borrowedUSD.toFixed(0)}）`,
        direction: "neutral",
        severity,
        timestamp: now,
        healthFactor: pos.healthFactor,
        ltv: pos.ltv,
        walletAddress: wallet,
        actionRequired,
      });
    }
  }

  // ── 4. Evaluate automated conditions (F4) ────────────────────

  const healthFactors: Record<string, number> = {};
  for (let i = 0; i < walletList.length; i++) {
    const result = healthResults[i];
    if (result.status !== "fulfilled") continue;
    for (const pos of result.value) {
      // Use lowest health factor per wallet across all protocols
      const prev = healthFactors[pos.walletAddress] ?? 999;
      healthFactors[pos.walletAddress] = Math.min(prev, pos.healthFactor);
    }
  }

  const conditionResults = conditionsCache.size > 0
    ? evaluateConditions({
        solPrice: solPrice ?? undefined,
        marinadeAPY: current.marinade,
        jitoAPY: current.jito,
        kaminoAPY: current.kamino,
        healthFactors,
      })
    : [];

  let conditionsTriggered = 0;
  for (const { condition, triggered, currentValue } of conditionResults) {
    if (!triggered) continue;
    conditionsTriggered++;

    const metricLabel =
      condition.metric === "sol_price"        ? `SOL 价格 $${currentValue.toFixed(2)}` :
      condition.metric === "health_factor"    ? `健康系数 ${currentValue.toFixed(2)}` :
      condition.metric === "usdc_apy_kamino"  ? `Kamino APY ${currentValue.toFixed(1)}%` :
      condition.metric === "sol_apy_marinade" ? `Marinade APY ${currentValue.toFixed(1)}%` :
      `${condition.metric} = ${currentValue.toFixed(2)}`;

    const actionLabel =
      condition.action === "prepare_stake" ? `→ 已准备质押交易` :
      condition.action === "prepare_lend"  ? `→ 已准备借贷交易` :
      condition.action === "prepare_swap"  ? `→ 已准备兑换交易` :
      `→ 请检查您的仓位`;

    newAlerts.push({
      id: `cond-${condition.id}-${now}`,
      type: "protocol_risk",
      protocol: "Guardian",
      message: `🤖 条件触发：${condition.label}（当前：${metricLabel}）${actionLabel}`,
      direction: "neutral",
      severity: condition.metric === "health_factor" ? "critical" : "warning",
      timestamp: now,
      walletAddress: condition.walletAddress,
      actionRequired: condition.action !== "alert_only"
        ? `在 Agent 面板中执行预准备的${condition.action === "prepare_stake" ? "质押" : condition.action === "prepare_lend" ? "借贷" : "兑换"}操作`
        : condition.label,
    });
  }

  // Update cache
  guardianCache.baselineAPY = current;
  if (solPrice) guardianCache.lastSolPrice = solPrice;
  guardianCache.alerts = [...newAlerts, ...guardianCache.alerts].slice(0, 50);
  guardianCache.lastRun = now;

  return NextResponse.json({
    ok: true,
    newAlerts: newAlerts.length,
    totalAlerts: guardianCache.alerts.length,
    apys: current,
    solPrice,
    lastRun: now,
    healthChecked,
    watchedWallets: walletList.length,
    conditionsChecked: conditionsCache.size,
    conditionsTriggered,
  });
}

// ── POST: add wallet to health watch list ─────────────────────────

export async function POST(req: Request) {
  try {
    const { walletAddress, action } = await req.json() as {
      walletAddress?: string;
      action?: "watch" | "unwatch";
    };
    if (!walletAddress || walletAddress.length < 32) {
      return NextResponse.json({ error: "invalid walletAddress" }, { status: 400 });
    }
    if (action === "unwatch") {
      guardianCache.watchedWallets.delete(walletAddress);
    } else {
      guardianCache.watchedWallets.add(walletAddress);
    }
    return NextResponse.json({
      ok: true,
      action: action ?? "watch",
      walletAddress: walletAddress.slice(0, 8) + "…",
      watchedCount: guardianCache.watchedWallets.size,
    });
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }
}
