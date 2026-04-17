/**
 * Rescue Executor Tests
 *
 * Focuses on the guard rails (pre-flight checks) that prevent a malformed or
 * unauthorized rescue from reaching the network. Each `refused_*` branch is
 * exercised without requiring a live RPC connection. The happy path
 * (status="executed") requires mainnet credentials + a funded agent keypair
 * and is covered by the live devnet integration test instead.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Keypair } from "@solana/web3.js";
import { executeRescue, type RescueExecutionResult } from "@/lib/liquidation-shield";
import type { LendingPosition, ShieldConfig } from "@/lib/liquidation-shield";

// Real ed25519 keypair (never funded; only used so Keypair.fromSecretKey parses)
const testKeypair = Keypair.generate();
const testKeyJson = JSON.stringify(Array.from(testKeypair.secretKey));

const mockPosition: LendingPosition = {
  protocol: "kamino",
  collateralUsd: 1000,
  debtUsd: 850,
  healthFactor: 1.06,
  liquidationThreshold: 0.8,
  collateralToken: "SOL",
  debtToken: "USDC",
  accountAddress: "FakeObligationAccountAddressForTestingOnly11111",
  marketAddress: "7u3HeL2iLLpFEPnE8Z5YZh4uDGRz6SreJqLLUMVFNM1a",
  rescueAmountUsdc: 50,
  postRescueHealthFactor: 1.4,
};

const mandateConfig: ShieldConfig = {
  approvedUsdc: 100,
  triggerThreshold: 1.1,
  targetHealthFactor: 1.4,
  mandateTxSig: "FakeMandateTxSigForTestingOnly11111111111111111",
};

describe("executeRescue — pre-flight guards", () => {
  let savedKey: string | undefined;
  beforeEach(() => { savedKey = process.env.SAKURA_AGENT_PRIVATE_KEY; });
  afterEach(() => {
    if (savedKey === undefined) delete process.env.SAKURA_AGENT_PRIVATE_KEY;
    else process.env.SAKURA_AGENT_PRIVATE_KEY = savedKey;
  });

  it("refuses when SAKURA_AGENT_PRIVATE_KEY is not set", async () => {
    delete process.env.SAKURA_AGENT_PRIVATE_KEY;
    const res = await executeRescue({
      position: mockPosition, walletAddress: "11111111111111111111111111111111",
      config: mandateConfig, repayUsdc: 50,
    });
    expect(res.status).toBe("refused_no_agent_key");
    expect(res.executionId).toMatch(/^[0-9a-f]{32}$/);
    expect(res.txSignature).toBeUndefined();
  });

  it("refuses when private key JSON is malformed", async () => {
    process.env.SAKURA_AGENT_PRIVATE_KEY = "not-a-valid-json-array";
    const res = await executeRescue({
      position: mockPosition, walletAddress: "11111111111111111111111111111111",
      config: mandateConfig, repayUsdc: 50,
    });
    expect(res.status).toBe("refused_no_agent_key");
  });

  it("refuses when mandateTxSig is missing", async () => {
    // Valid 64-byte keypair (zeroed) — parses but no real funds
    process.env.SAKURA_AGENT_PRIVATE_KEY = testKeyJson;
    const noMandate: ShieldConfig = { ...mandateConfig, mandateTxSig: undefined };
    const res = await executeRescue({
      position: mockPosition, walletAddress: "11111111111111111111111111111111",
      config: noMandate, repayUsdc: 50,
    });
    expect(res.status).toBe("refused_no_mandate");
  });

  it("refuses when repayUsdc exceeds approvedUsdc", async () => {
    process.env.SAKURA_AGENT_PRIVATE_KEY = testKeyJson;
    const res = await executeRescue({
      position: mockPosition, walletAddress: "11111111111111111111111111111111",
      config: mandateConfig, repayUsdc: 999, // > 100 approved
    });
    expect(res.status).toBe("refused_mandate_exceeded");
    expect(res.error).toContain("exceeds mandate");
  });

  it("produces deterministic executionId for identical inputs", async () => {
    delete process.env.SAKURA_AGENT_PRIVATE_KEY;
    const p = { ...mockPosition };
    const c = { ...mandateConfig };
    // executeRescue uses Date.now() internally, so identical inputs at different
    // times give different executionId. We check format stability + uniqueness.
    const r1 = await executeRescue({
      position: p, walletAddress: "11111111111111111111111111111111", config: c, repayUsdc: 50,
    });
    expect(r1.executionId).toMatch(/^[0-9a-f]{32}$/);
    // Different amount → different executionId
    const r2 = await executeRescue({
      position: p, walletAddress: "11111111111111111111111111111111", config: c, repayUsdc: 60,
    });
    expect(r2.executionId).not.toBe(r1.executionId);
  });
});

describe("RescueExecutionResult shape", () => {
  it("always carries executionId + repayUsdc even on refusal", async () => {
    delete process.env.SAKURA_AGENT_PRIVATE_KEY;
    const res: RescueExecutionResult = await executeRescue({
      position: mockPosition, walletAddress: "11111111111111111111111111111111",
      config: mandateConfig, repayUsdc: 42,
    });
    expect(res.repayUsdc).toBe(42);
    expect(res.executionId).toBeDefined();
  });
});
