/**
 * Network Config Tests
 *
 * Verifies the mainnet / devnet switching logic:
 *   - Default is mainnet-beta
 *   - SOLANA_NETWORK=devnet flips cluster + USDC mint + explorer suffix
 *   - Invalid values fall back to mainnet (fail-safe, never unexpectedly devnet)
 *   - Explorer URL builders include the correct ?cluster= suffix
 *
 * Note: `getNetwork()` and `getNetworkConfig()` read `process.env` at call time,
 * so we can mutate env between test cases without any module re-import.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  getNetwork,
  getNetworkConfig,
  explorerTxUrl,
  explorerAddressUrl,
} from "@/lib/network-config";

describe("network-config", () => {
  let savedNetwork: string | undefined;
  beforeEach(() => { savedNetwork = process.env.SOLANA_NETWORK; });
  afterEach(() => {
    if (savedNetwork === undefined) delete process.env.SOLANA_NETWORK;
    else process.env.SOLANA_NETWORK = savedNetwork;
  });

  it("defaults to mainnet-beta when env is unset", () => {
    delete process.env.SOLANA_NETWORK;
    expect(getNetwork()).toBe("mainnet-beta");
    const cfg = getNetworkConfig();
    expect(cfg.network).toBe("mainnet-beta");
    expect(cfg.usdcMint).toBe("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
    expect(cfg.explorerSuffix).toBe("");
  });

  it("switches to devnet when SOLANA_NETWORK=devnet", () => {
    process.env.SOLANA_NETWORK = "devnet";
    expect(getNetwork()).toBe("devnet");
    const cfg = getNetworkConfig();
    expect(cfg.network).toBe("devnet");
    expect(cfg.usdcMint).toBe("4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
    expect(cfg.explorerSuffix).toBe("?cluster=devnet");
  });

  it("falls back to mainnet on invalid values (never leaks into devnet)", () => {
    process.env.SOLANA_NETWORK = "testnet"; // not supported
    expect(getNetwork()).toBe("mainnet-beta");
  });

  it("is case-insensitive for env value", () => {
    process.env.SOLANA_NETWORK = "DEVNET";
    expect(getNetwork()).toBe("devnet");
  });

  it("explorerTxUrl carries cluster suffix on devnet", () => {
    process.env.SOLANA_NETWORK = "devnet";
    expect(explorerTxUrl("FakeSig123")).toBe(
      "https://solscan.io/tx/FakeSig123?cluster=devnet"
    );
  });

  it("explorerTxUrl omits cluster on mainnet", () => {
    delete process.env.SOLANA_NETWORK;
    expect(explorerTxUrl("FakeSig123")).toBe(
      "https://solscan.io/tx/FakeSig123"
    );
  });

  it("explorerAddressUrl uses the account path", () => {
    delete process.env.SOLANA_NETWORK;
    expect(explorerAddressUrl("AddrXYZ")).toBe(
      "https://solscan.io/account/AddrXYZ"
    );
  });
});
