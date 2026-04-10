/**
 * Demo Mode — Preset data for ?demo=true
 *
 * Returns visually compelling, realistic-looking data for each feature.
 * Used for hackathon demo recordings. Never affects real users.
 */

// ── Nonce Guardian Demo ───────────────────────────────────────────────────────

export const DEMO_NONCE_RESULT = {
  accounts: [
    {
      address: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
      authority: "Hacker9qLzYmXkRdJmFGzNLvqBmHg4gJXe3K1mQ7pV5w", // foreign authority!
      nonce: "AZnjh12Rqp9wXmK8vP2LbTcE4qYsDfUoGnWsHjK3mVpQ",
      lamports: 1447680,
      isOwned: false,
    },
    {
      address: "3mFgHjK9pQzXnWsLbTcE2vYqRdUoGnWsHjK3mVpQAZ",
      authority: "Goc5kAMb9NTXjobxzZogAWaHwajmQjw7CdmATWJN1mQh", // wallet owner
      nonce: "BmNjK23Sqp8wXmL9vP3LbTcF5qZsDgVpHnWtIkL4nWqR",
      lamports: 1447680,
      isOwned: true,
    },
    {
      address: "9pQzLbTcE4vYqRdUoGnWsHjK3mVpQAZnjh12Rqp8wXm",
      authority: "FreshWa11etCreated3DaysAgo8xKjP2mQ5vZnLbTcE4",
      nonce: "CnOkL34Trq9xYnM0wQ4McUdG6rAuEhWqJoXuJlM5oXrS",
      lamports: 1447680,
      isOwned: false,
    },
  ],
  riskSignals: [
    {
      type: "foreign_authority" as const,
      severity: "critical" as const,
      description: "Nonce 帳戶 7xKXtg...gAsU 的控制權不屬於您的錢包。攻擊者可隨時用此 Nonce 執行預簽名惡意交易，無需您的知情或同意。這是 2026 年 4 月 Drift $285M 攻擊的相同手法。",
      address: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
    },
    {
      type: "fresh_account" as const,
      severity: "high" as const,
      description: "Nonce 帳戶 9pQzLb...wXm 的授權地址是一個 3 天前才創建的新錢包，擁有 0.05 SOL gas 費用，具有典型的一次性攻擊者地址特徵。",
      address: "9pQzLbTcE4vYqRdUoGnWsHjK3mVpQAZnjh12Rqp8wXm",
    },
  ],
  scannedAt: Date.now(),
  aiAnalysis: `🚨 **高危警報：偵測到 1 個 CRITICAL 風險、1 個 HIGH 風險**

**CRITICAL — 外部控制的 Nonce 帳戶**
帳戶 \`7xKXtg...gAsU\` 的 authority 為 \`Hacker9q...V5w\`，**不屬於您的錢包**。這意味著攻擊者現在就可以使用這個 Nonce 帳戶執行任意預簽名交易，包括轉走您帳戶中的所有資產，且該交易永遠有效、不會過期。

**這與 2026 年 4 月 Drift 協議 $285M 攻擊手法完全一致。**

**HIGH — 可疑的新創授權地址**
另一個 Nonce 帳戶的 authority 是一個僅 3 天前創建的新錢包，持有少量 SOL（攻擊 gas 費）。這是典型的一次性攻擊者地址特徵。

**立即行動建議：**
1. 將您的 SOL 和 SPL 代幣轉移到全新的錢包地址
2. 撤銷 \`7xKXtg...gAsU\` 的 Nonce 帳戶授權
3. 在轉移完成前，不要進行任何交易簽名

風險評分：**94/100（極高危）**`,
};

// ── Ghost Run Demo ────────────────────────────────────────────────────────────

export const DEMO_GHOST_STRATEGY = "質押 2 SOL 到 Marinade，把 150 USDC 存入 Kamino，然後用 0.5 SOL 換成 JitoSOL";

// Demo result for "質押 1 SOL 到 Marinade，獲得 mSOL"
export const DEMO_GHOST_RESULT_MARINADE = {
  steps: [{ type: "stake" as const, inputToken: "SOL", inputAmount: 1, outputToken: "mSOL", description: "質押 1 SOL 到 Marinade" }],
  result: {
    steps: [{
      step: { type: "stake" as const, inputToken: "SOL", inputAmount: 1, outputToken: "mSOL", protocol: "Marinade", description: "質押 1 SOL 到 Marinade" },
      success: true, outputAmount: 0.9931, gasSol: 0.000025, estimatedApy: 7.24, annualUsdYield: 12.09,
      pdaSeedDescription: "Marinade stake account PDA: [marinade_state, validator_list, stake_account]",
    }],
    totalGasSol: 0.000025, canExecute: true, warnings: [], priorityFeeUsed: 12500, conditionalOrder: null,
  },
  aiAnalysis: `✅ **策略分析：單步操作，預期年化收益 $12.09**\n\n**Marinade Stake（1 SOL → 0.9931 mSOL）**\nAPY 7.24%，預期年化收益 $12.09。mSOL 為液態質押代幣，可繼續用於 DeFi 借貸或流動性挖礦，不影響質押收益。\n\n總 Gas 費用：0.000025 SOL（$0.0039），極低成本。`,
};

// Demo result for "把 50 USDC 存入 Kamino 賺取收益"
export const DEMO_GHOST_RESULT_KAMINO = {
  steps: [{ type: "lend" as const, inputToken: "USDC", inputAmount: 50, outputToken: "kUSDC", description: "存入 50 USDC 到 Kamino" }],
  result: {
    steps: [{
      step: { type: "lend" as const, inputToken: "USDC", inputAmount: 50, outputToken: "kUSDC", protocol: "Kamino", description: "存入 50 USDC 到 Kamino" },
      success: true, outputAmount: 49.96, gasSol: 0.000025, estimatedApy: 8.15, annualUsdYield: 4.08,
      pdaSeedDescription: "Kamino obligation PDA: [lending_market, owner, seed1, seed2]",
    }],
    totalGasSol: 0.000025, canExecute: true, warnings: [], priorityFeeUsed: 12500, conditionalOrder: null,
  },
  aiAnalysis: `✅ **策略分析：穩健收益存款，預期年化收益 $4.08**\n\n**Kamino Lend（50 USDC → 49.96 kUSDC）**\nAPY 8.15%，預期年化收益 $4.08。Kamino 主市場 USDC 池 utilization rate 74%，收益穩定。無清算風險（純存款操作）。\n\n總 Gas 費用：0.000025 SOL（$0.0039），極低成本。`,
};

// Demo result for "質押 2 SOL 到 Jito，並把 100 USDC 存入 Kamino"
export const DEMO_GHOST_RESULT_JITO = {
  steps: [
    { type: "stake" as const, inputToken: "SOL", inputAmount: 2, outputToken: "JitoSOL", description: "質押 2 SOL 到 Jito" },
    { type: "lend" as const, inputToken: "USDC", inputAmount: 100, outputToken: "kUSDC", description: "存入 100 USDC 到 Kamino" },
  ],
  result: {
    steps: [
      {
        step: { type: "stake" as const, inputToken: "SOL", inputAmount: 2, outputToken: "JitoSOL", protocol: "Jito", description: "質押 2 SOL 到 Jito" },
        success: true, outputAmount: 1.9847, gasSol: 0.000025, estimatedApy: 8.92, annualUsdYield: 27.92,
        pdaSeedDescription: "Jito stake pool PDA: [stake_pool, validator_list, reserve_stake]",
      },
      {
        step: { type: "lend" as const, inputToken: "USDC", inputAmount: 100, outputToken: "kUSDC", protocol: "Kamino", description: "存入 100 USDC 到 Kamino" },
        success: true, outputAmount: 99.91, gasSol: 0.000025, estimatedApy: 8.15, annualUsdYield: 8.15,
        pdaSeedDescription: "Kamino obligation PDA: [lending_market, owner, seed1, seed2]",
      },
    ],
    totalGasSol: 0.000050, canExecute: true, warnings: [], priorityFeeUsed: 12500, conditionalOrder: null,
  },
  aiAnalysis: `✅ **策略分析：雙步操作，預期年化收益 $36.07**\n\n**第一步 — Jito Stake（2 SOL → 1.9847 JitoSOL）**\nAPY 8.92%（含 MEV 收益分成），預期年化收益 $27.92。Jito 是 Solana 最大的 MEV 質押協議，TVL $2.1B。\n\n**第二步 — Kamino Lend（100 USDC → 99.91 kUSDC）**\nAPY 8.15%，預期年化收益 $8.15。兩步操作無資金衝突，可按順序執行。\n\n總 Gas 費用：0.000050 SOL（$0.0078），極低成本。\n預計年化總收益：**$36.07 USD**`,
};

export const DEMO_GHOST_RESULT = {
  steps: [
    {
      type: "stake" as const,
      inputToken: "SOL",
      inputAmount: 2,
      outputToken: "mSOL",
      description: "質押 2 SOL 到 Marinade",
    },
    {
      type: "lend" as const,
      inputToken: "USDC",
      inputAmount: 150,
      outputToken: "kUSDC",
      description: "存入 150 USDC 到 Kamino",
    },
    {
      type: "swap" as const,
      inputToken: "SOL",
      inputAmount: 0.5,
      outputToken: "JitoSOL",
      description: "換取 0.5 SOL → JitoSOL",
    },
  ],
  result: {
    steps: [
      {
        step: {
          type: "stake" as const,
          inputToken: "SOL",
          inputAmount: 2,
          outputToken: "mSOL",
          protocol: "Marinade",
          description: "質押 2 SOL 到 Marinade",
        },
        success: true,
        outputAmount: 1.9862,
        gasSol: 0.000025,
        estimatedApy: 7.24,
        annualUsdYield: 24.18,
        pdaSeedDescription: "Marinade stake account PDA: [marinade_state, validator_list, stake_account]",
      },
      {
        step: {
          type: "lend" as const,
          inputToken: "USDC",
          inputAmount: 150,
          outputToken: "kUSDC",
          protocol: "Kamino",
          description: "存入 150 USDC 到 Kamino",
        },
        success: true,
        outputAmount: 149.87,
        gasSol: 0.000025,
        estimatedApy: 8.15,
        annualUsdYield: 12.23,
        pdaSeedDescription: "Kamino obligation PDA: [lending_market, owner, seed1, seed2]",
      },
      {
        step: {
          type: "swap" as const,
          inputToken: "SOL",
          inputAmount: 0.5,
          outputToken: "JitoSOL",
          protocol: "Jupiter",
          description: "換取 0.5 SOL → JitoSOL",
        },
        success: true,
        outputAmount: 0.4923,
        gasSol: 0.000045,
        priceImpactPct: 0.08,
        estimatedApy: 8.92,
        annualUsdYield: 7.31,
      },
    ],
    totalGasSol: 0.000095,
    canExecute: true,
    warnings: [],
    priorityFeeUsed: 12500,
    conditionalOrder: null,
  },
  aiAnalysis: `✅ **策略分析：三步均可安全執行，預期年化收益 $43.72**

**第一步 — Marinade Stake（2 SOL → 1.9862 mSOL）**
APY 7.24%，預期年化收益 $24.18。Marinade 是 Solana 最大的液態質押協議，TVL $1.2B，風險極低。mSOL 可繼續用於 DeFi 操作。

**第二步 — Kamino Lend（150 USDC → 149.87 kUSDC）**
APY 8.15%，預期年化收益 $12.23。Kamino 主市場 USDC 池 utilization rate 74%，收益穩定。

**第三步 — SOL→JitoSOL Swap（0.5 SOL → 0.4923 JitoSOL）**
價格衝擊僅 0.08%（極低），路由通過 Jupiter 聚合器最優路徑。JitoSOL APY 8.92%，包含 MEV 收益分成。

**三步無資金衝突，可按順序執行。**
總 Gas 費用：0.000095 SOL（$0.0148），極低成本。
預計年化總收益：**$43.72 USD**`,
};

// ── Liquidation Shield Demo ───────────────────────────────────────────────────

export const DEMO_SHIELD_RESULT = {
  positions: [
    {
      protocol: "kamino" as const,
      collateralUsd: 8420.50,
      debtUsd: 5180.20,
      healthFactor: 1.03,
      liquidationThreshold: 0.80,
      collateralToken: "SOL",
      debtToken: "USDC",
      accountAddress: "KmNo7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJos",
      marketAddress: "7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF",
      rescueAmountUsdc: 812.40,
      postRescueHealthFactor: 1.42,
      liquidationPrice: 148.20,
    },
    {
      protocol: "marginfi" as const,
      collateralUsd: 3200.00,
      debtUsd: 820.00,
      healthFactor: 2.81,
      liquidationThreshold: 0.80,
      collateralToken: "mSOL",
      debtToken: "USDC",
      accountAddress: "MFi9pQzLbTcE4vYqRdUoGnWsHjK3mVpQAZnjh12Rqp8",
      rescueAmountUsdc: 0,
      postRescueHealthFactor: 2.81,
      liquidationPrice: 42.10,
    },
  ],
  atRisk: [
    {
      protocol: "kamino" as const,
      collateralUsd: 8420.50,
      debtUsd: 5180.20,
      healthFactor: 1.03,
      liquidationThreshold: 0.80,
      collateralToken: "SOL",
      debtToken: "USDC",
      accountAddress: "KmNo7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJos",
      marketAddress: "7u3HeHxYDLhnCoErrtycNokbQYbWGzLs6JSDqGAv5PfF",
      rescueAmountUsdc: 812.40,
      postRescueHealthFactor: 1.42,
      liquidationPrice: 148.20,
    },
  ],
  safest: {
    protocol: "marginfi" as const,
    collateralUsd: 3200.00,
    debtUsd: 820.00,
    healthFactor: 2.81,
    liquidationThreshold: 0.80,
    collateralToken: "mSOL",
    debtToken: "USDC",
    accountAddress: "MFi9pQzLbTcE4vYqRdUoGnWsHjK3mVpQAZnjh12Rqp8",
    rescueAmountUsdc: 0,
    postRescueHealthFactor: 2.81,
    liquidationPrice: 42.10,
  },
  scannedAt: Date.now(),
  solPrice: 156.40,
  portfolioRiskScore: 78,
  portfolioRiskLabel: "高風險",
  portfolioRiskColor: "red" as const,
  atRiskRatioPct: 72.5,
  totalRescueNeededUsdc: 812.40,
  impliedLiquidationProb: 0.7248,
  config: {
    approvedUsdc: 1000,
    triggerThreshold: 1.05,
    targetHealthFactor: 1.4,
  },
  rescueSimulations: [
    {
      position: {
        protocol: "kamino" as const,
        collateralUsd: 8420.50,
        debtUsd: 5180.20,
        healthFactor: 1.03,
        liquidationThreshold: 0.80,
        collateralToken: "SOL",
        debtToken: "USDC",
        accountAddress: "KmNo7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJos",
        rescueAmountUsdc: 812.40,
        postRescueHealthFactor: 1.42,
        liquidationPrice: 148.20,
      },
      rescueUsdc: 812.40,
      postRescueHealth: 1.42,
      gasSol: 0.000025,
      withinMandate: true,
      success: true,
    },
  ],
  aiAnalysis: `🚨 **緊急警報：Kamino 倉位健康因子 1.03，距清算僅 3% 空間**

**高危倉位（Kamino Main Market）**
- 抵押品：8,420.50 USDC（SOL 計價）
- 未償債務：5,180.20 USDC
- 當前健康因子：**1.03**（清算閾值 1.00）
- 清算觸發價格：SOL **$148.20**（當前 $156.40，下跌空間僅 **5.2%**）

**市場風險評估**
當前 SOL 價格波動率（24h）為 ±8.3%，意味著在正常市場條件下，此倉位有高概率在未來 24 小時內觸發清算。一旦清算，損失金額約為 $518-$776（10%-15% 清算罰款）。

**Sakura AI 救援方案**
還款 **$812.40 USDC**，健康因子將恢復至 **1.42**，創造安全緩衝。
操作成本：$8.12（1% 平台費）+ $0.004 Gas
節省清算損失：**$509-$764 USDC**

**救援授權已設置 $1,000 USDC 上限，在預授權範圍內，點擊執行救援即可。**`,
  mintWarnings: undefined,
};
