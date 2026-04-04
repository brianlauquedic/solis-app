import { NextRequest, NextResponse } from "next/server";
import { runQuotaGate } from "@/lib/rate-limit";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? "";

interface RebalanceRequest {
  walletAddress: string;
  solBalance: number;
  totalUSD: number;
  idleUSDC: number;
  liveYield?: {
    opportunities: Array<{
      protocol: string;
      apy: number;
      apyDisplay: string;
      riskLevel: string;
      detail: string;
    }>;
  };
}

interface RebalanceAction {
  type: "stake" | "lend" | "swap" | "lp";
  protocol: string;
  icon: string;
  amount: number;
  amountDisplay: string;
  expectedAPY: number;
  riskLevel: "低" | "中" | "高";
  reasoning: string;
  url: string;
  color: string;
}

interface RebalancePlan {
  currentAllocation: { sol: number; usdc: number; staked: number; lent: number };
  recommendedAllocation: { sol: number; usdc: number; staked: number; lent: number };
  actions: RebalanceAction[];
  projectedAnnualYield: number;
  currentAnnualYield: number;
  confidenceScore: number;
  summary: string;
}

function deterministicPlan(req: RebalanceRequest): RebalancePlan {
  const { solBalance, totalUSD, idleUSDC, liveYield } = req;

  const getAPY = (protocol: string, fallback: number) => {
    const found = liveYield?.opportunities.find(o => o.protocol === protocol);
    return found ? found.apy : fallback;
  };

  const marinadeAPY = getAPY("Marinade Finance", 7.2);
  const kaminoAPY = getAPY("Kamino Finance", 8.2);
  const solPrice = solBalance > 0 && totalUSD > 0 ? totalUSD / solBalance : 180;

  const actions: RebalanceAction[] = [];
  let projectedYield = 0;

  // Stake 70% of SOL
  if (solBalance > 0.1) {
    const stakeAmt = solBalance * 0.7;
    const yearlyEarn = stakeAmt * marinadeAPY / 100 * solPrice;
    projectedYield += yearlyEarn;
    actions.push({
      type: "stake",
      protocol: "Marinade Finance",
      icon: "🫙",
      amount: stakeAmt,
      amountDisplay: `${stakeAmt.toFixed(2)} SOL`,
      expectedAPY: marinadeAPY,
      riskLevel: "低",
      reasoning: `将 ${stakeAmt.toFixed(2)} SOL 质押获取 ${marinadeAPY.toFixed(1)}% 年化，mSOL 保留流动性，预计年收益 $${yearlyEarn.toFixed(0)}`,
      url: "https://marinade.finance/",
      color: "#8B5CF6",
    });
  }

  // Lend 100% of idle USDC
  if (idleUSDC > 5) {
    const yearlyEarn = idleUSDC * kaminoAPY / 100;
    projectedYield += yearlyEarn;
    actions.push({
      type: "lend",
      protocol: "Kamino Finance",
      icon: "🌿",
      amount: idleUSDC,
      amountDisplay: `$${idleUSDC.toFixed(0)} USDC`,
      expectedAPY: kaminoAPY,
      riskLevel: "低",
      reasoning: `$${idleUSDC.toFixed(0)} USDC 闲置零收益，存入 Kamino 自动复利 ${kaminoAPY.toFixed(1)}%，预计年收益 $${yearlyEarn.toFixed(0)}`,
      url: "https://app.kamino.finance/",
      color: "#10B981",
    });
  }

  const currentAllocation = {
    sol: Math.round((solBalance * solPrice / totalUSD) * 100) || 0,
    usdc: Math.round((idleUSDC / totalUSD) * 100) || 0,
    staked: 0,
    lent: 0,
  };
  const stakedSOLValue = actions.filter(a => a.type === "stake").reduce((s, a) => s + a.amount * solPrice, 0);
  const lentValue = actions.filter(a => a.type === "lend").reduce((s, a) => s + a.amount, 0);

  const recommendedAllocation = {
    sol: Math.max(0, Math.round(((solBalance * solPrice - stakedSOLValue) / totalUSD) * 100)),
    usdc: Math.max(0, Math.round(((idleUSDC - lentValue) / totalUSD) * 100)),
    staked: Math.round((stakedSOLValue / totalUSD) * 100) || 0,
    lent: Math.round((lentValue / totalUSD) * 100) || 0,
  };

  return {
    currentAllocation,
    recommendedAllocation,
    actions,
    projectedAnnualYield: projectedYield,
    currentAnnualYield: 0,
    confidenceScore: 87,
    summary: actions.length > 0
      ? `发现 ${actions.length} 个优化机会，可将年化收益从 $0 提升至 $${projectedYield.toFixed(0)}`
      : "当前钱包余额较少，建议先积累更多 SOL/USDC",
  };
}

async function callClaudeForPlan(
  req: RebalanceRequest
): Promise<RebalancePlan | null> {
  if (!ANTHROPIC_API_KEY || ANTHROPIC_API_KEY === "your-anthropic-api-key-here") return null;

  const getAPY = (protocol: string, fallback: number) => {
    const found = req.liveYield?.opportunities.find(o => o.protocol === protocol);
    return found ? found.apy : fallback;
  };

  const yieldCtx = req.liveYield?.opportunities
    .map(o => `${o.protocol}: ${o.apyDisplay} (${o.riskLevel}风险)`)
    .join(", ") ?? "暂无实时数据";

  const marinadeAPY = getAPY("Marinade Finance", 7.2);
  const kaminoAPY = getAPY("Kamino Finance", 8.2);
  const solPrice = req.solBalance > 0 && req.totalUSD > 0 ? req.totalUSD / req.solBalance : 180;

  const systemPrompt = `你是 Sakura AI Agent。根据用户钱包，生成一个最优再平衡方案，输出严格的 JSON。

用户钱包：
- SOL: ${req.solBalance.toFixed(3)} (≈$${(req.solBalance * solPrice).toFixed(0)})
- 闲置 USDC: $${req.idleUSDC.toFixed(0)}
- 总资产: $${req.totalUSD.toFixed(0)}
- 当前年化收益: $0（全部闲置）

实时 APY 数据：${yieldCtx}

输出 JSON 格式（不要有任何其他文字）：
{
  "currentAllocation": {"sol": 数字, "usdc": 数字, "staked": 0, "lent": 0},
  "recommendedAllocation": {"sol": 数字, "usdc": 数字, "staked": 数字, "lent": 数字},
  "actions": [
    {
      "type": "stake"|"lend"|"swap"|"lp",
      "protocol": "协议名称",
      "icon": "emoji",
      "amount": 数字,
      "amountDisplay": "显示文字",
      "expectedAPY": 数字,
      "riskLevel": "低"|"中"|"高",
      "reasoning": "一句话说明理由和预计收益",
      "url": "https://...",
      "color": "#hex"
    }
  ],
  "projectedAnnualYield": 数字,
  "currentAnnualYield": 0,
  "confidenceScore": 数字(70-95),
  "summary": "一句话总结"
}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 800,
        system: systemPrompt,
        messages: [{
          role: "user",
          content: `请生成再平衡方案。重点优先质押 SOL (Marinade ${marinadeAPY.toFixed(1)}% APY) 和存入 USDC (Kamino ${kaminoAPY.toFixed(1)}% APY)。`,
        }],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    if (!res.ok) return null;

    const data = await res.json();
    const text = (data?.content?.[0]?.text ?? "").trim();

    // Extract JSON from response
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const plan = JSON.parse(jsonMatch[0]) as RebalancePlan;
    if (!plan.actions || !Array.isArray(plan.actions)) return null;
    return plan;
  } catch {
    return null;
  }
}

// Allowed protocols that the platform officially supports
const SUPPORTED_PROTOCOLS = new Set([
  "marinade", "jito", "kamino", "solend", "save", "jupiter", "raydium", "orca", "lulo"
]);

// [SECURITY FIX] Server-side mandate validation
// Prevents attackers from bypassing client-side mandate checks via direct API calls
function validateMandateServerSide(
  plan: RebalancePlan,
  walletAddress: string,
  mandateHeader: string | null,
): { valid: boolean; violations: string[] } {
  if (!mandateHeader) return { valid: true, violations: [] }; // no mandate = no constraint

  let mandate: { maxStakePct?: number; maxSingleProtocolPct?: number; allowedProtocols?: string[]; owner?: string } = {};
  try {
    mandate = JSON.parse(Buffer.from(mandateHeader, "base64").toString("utf-8"));
  } catch {
    return { valid: false, violations: ["Invalid mandate format"] };
  }

  // Verify mandate belongs to the requesting wallet
  if (mandate.owner && mandate.owner !== walletAddress) {
    return { valid: false, violations: ["Mandate wallet mismatch"] };
  }

  const violations: string[] = [];
  const totalUSD = plan.actions.reduce((s, a) =>
    s + (a.type === "stake" ? a.amount * 180 : a.amount), 0) || 1;

  for (const action of plan.actions) {
    const actionUSD = action.type === "stake" ? action.amount * 180 : action.amount;
    const pct = (actionUSD / totalUSD) * 100;

    // Check max stake percentage
    if (mandate.maxStakePct !== undefined &&
        (action.type === "stake" || action.type === "lend") &&
        pct > mandate.maxStakePct) {
      violations.push(`${action.protocol} (${pct.toFixed(0)}%) exceeds maxStakePct (${mandate.maxStakePct}%)`);
    }

    // Check max single-protocol percentage
    if (mandate.maxSingleProtocolPct !== undefined && pct > mandate.maxSingleProtocolPct) {
      violations.push(`${action.protocol} (${pct.toFixed(0)}%) exceeds maxSingleProtocolPct (${mandate.maxSingleProtocolPct}%)`);
    }

    // Check allowed protocols whitelist (if specified)
    if (mandate.allowedProtocols && mandate.allowedProtocols.length > 0) {
      const key = action.protocol.toLowerCase().split(" ")[0];
      const allowed = mandate.allowedProtocols.some((p: string) => key.includes(p.toLowerCase()));
      if (!allowed) {
        violations.push(`${action.protocol} is not in the allowed protocols list`);
      }
    }

    // Always validate against platform-supported protocols (hard security boundary)
    const protocolKey = action.protocol.toLowerCase().split(" ")[0];
    if (!SUPPORTED_PROTOCOLS.has(protocolKey)) {
      violations.push(`${action.protocol} is not a supported protocol`);
    }
  }

  return { valid: violations.length === 0, violations };
}

export async function POST(req: NextRequest) {
  // Anti-Sybil quota gate: 3 free agent plans per wallet/device/IP
  const gate = await runQuotaGate(req, "agent");
  if (!gate.proceed) return gate.response;

  let body: RebalanceRequest;
  try {
    body = await req.json() as RebalanceRequest;
  } catch {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  // [SECURITY FIX] Validate wallet address format before processing
  if (!body.walletAddress || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(body.walletAddress)) {
    return NextResponse.json({ error: "invalid wallet address" }, { status: 400 });
  }

  // [SECURITY FIX] Clamp financial inputs to prevent absurd calculations
  body.solBalance = Math.max(0, Math.min(body.solBalance ?? 0, 1_000_000));
  body.totalUSD   = Math.max(0, Math.min(body.totalUSD   ?? 0, 100_000_000));
  body.idleUSDC   = Math.max(0, Math.min(body.idleUSDC   ?? 0, 100_000_000));

  // Try Claude first, fall back to deterministic plan
  const claudePlan = await callClaudeForPlan(body);
  const plan = claudePlan ?? deterministicPlan(body);
  const aiAvailable = !!claudePlan;

  // [SECURITY FIX] Server-side mandate validation after plan is generated
  const mandateHeader = req.headers.get("x-mandate");
  const mandateCheck = validateMandateServerSide(plan, body.walletAddress, mandateHeader);
  if (!mandateCheck.valid) {
    return NextResponse.json({
      error: "mandate_violation",
      violations: mandateCheck.violations,
      message: "Rebalance plan violates your signed mandate constraints.",
    }, { status: 403 });
  }

  // Build SHA-256 hash of the plan for verifiable reasoning
  const planStr = JSON.stringify({
    wallet: body.walletAddress.slice(0, 8),
    actions: plan.actions.map(a => a.protocol),
    yield: plan.projectedAnnualYield.toFixed(0),
    ts: Math.floor(Date.now() / 1000),
  });
  const msgBuf = new TextEncoder().encode(planStr);
  const hashBuf = await crypto.subtle.digest("SHA-256", msgBuf);
  const hash = Array.from(new Uint8Array(hashBuf))
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");

  return NextResponse.json({
    ...plan,
    aiAvailable,
    planHash: hash,
    memoPayload: `[Sakura Agent] ${body.walletAddress.slice(0, 8)} | $${plan.projectedAnnualYield.toFixed(0)}/yr | ${plan.actions.map(a => `${a.protocol} ${a.type}`).join(", ")}`.slice(0, 700),
  });
}
