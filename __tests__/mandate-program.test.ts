/**
 * Sakura Mandate Program (Anchor) — TypeScript Client Tests
 *
 * Tests the on-chain Anchor program client: PDA derivation, instruction
 * encoding/decoding, discriminator computation, state serialization.
 *
 * Critical properties: deterministic PDA derivation, valid discriminators,
 * correct borsh byte layout, round-trip serialization/deserialization.
 */

import { describe, it, expect } from "vitest";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import crypto from "crypto";
import {
  SAKURA_MANDATE_PROGRAM_ID,
  deriveMandatePDA,
  deserializeMandate,
  buildCreateMandateIx,
  buildExecuteRescueIx,
  buildUpdateMandateIx,
  buildCloseMandateIx,
  usdcToMicro,
  microToUsdc,
  formatMandateState,
  type RescueMandateState,
} from "@/lib/mandate-program";

// Well-formed base58 Solana addresses for testing
const TEST_AUTHORITY = new PublicKey("7nZbhE6h5h2YkpNp3N9k8zU8kR4vTcXAfXQJiCBJwBDz");
const TEST_AGENT = new PublicKey("11111111111111111111111111111112");
const TEST_USDC_MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

describe("Mandate PDA Derivation", () => {
  it("derives deterministic PDA from wallet pubkey", () => {
    const [pda1] = deriveMandatePDA(TEST_AUTHORITY);
    const [pda2] = deriveMandatePDA(TEST_AUTHORITY);
    expect(pda1.toString()).toBe(pda2.toString());
  });

  it("different wallets produce different PDAs", () => {
    const [pda1] = deriveMandatePDA(TEST_AUTHORITY);
    const [pda2] = deriveMandatePDA(TEST_AGENT);
    expect(pda1.toString()).not.toBe(pda2.toString());
  });

  it("returns valid bump seed (0-255)", () => {
    const [, bump] = deriveMandatePDA(TEST_AUTHORITY);
    expect(bump).toBeGreaterThanOrEqual(0);
    expect(bump).toBeLessThanOrEqual(255);
  });

  it("PDA is not on ed25519 curve (has no private key)", () => {
    const [pda] = deriveMandatePDA(TEST_AUTHORITY);
    expect(PublicKey.isOnCurve(pda.toBuffer())).toBe(false);
  });

  it("uses 'sakura_mandate' seed prefix", () => {
    // Verify by manually deriving with the same seeds
    const [expectedPda] = PublicKey.findProgramAddressSync(
      [Buffer.from("sakura_mandate"), TEST_AUTHORITY.toBuffer()],
      SAKURA_MANDATE_PROGRAM_ID
    );
    const [actualPda] = deriveMandatePDA(TEST_AUTHORITY);
    expect(actualPda.toString()).toBe(expectedPda.toString());
  });
});

describe("Program ID", () => {
  it("is a valid PublicKey", () => {
    expect(SAKURA_MANDATE_PROGRAM_ID).toBeInstanceOf(PublicKey);
  });

  it("has 32-byte representation", () => {
    expect(SAKURA_MANDATE_PROGRAM_ID.toBuffer().length).toBe(32);
  });
});

describe("USDC Micro Conversion", () => {
  it("converts USDC to micro-USDC (6 decimals)", () => {
    expect(usdcToMicro(1)).toBe(1_000_000n);
    expect(usdcToMicro(1000)).toBe(1_000_000_000n);
    expect(usdcToMicro(0.000001)).toBe(1n);
  });

  it("rounds up fractional micro-USDC", () => {
    // Math.ceil behavior for sub-micro precision
    expect(usdcToMicro(0.0000015)).toBe(2n);
  });

  it("converts micro-USDC back to USDC", () => {
    expect(microToUsdc(1_000_000n)).toBe(1);
    expect(microToUsdc(500_000_000n)).toBe(500);
  });

  it("round-trips whole-dollar USDC amounts", () => {
    for (const usdc of [1, 100, 1000, 50000]) {
      expect(microToUsdc(usdcToMicro(usdc))).toBe(usdc);
    }
  });
});

describe("Create Mandate Instruction", () => {
  it("builds instruction with correct accounts", () => {
    const ix = buildCreateMandateIx(TEST_AUTHORITY, TEST_AGENT, 1_000_000_000n, 150);
    expect(ix.programId.toString()).toBe(SAKURA_MANDATE_PROGRAM_ID.toString());
    expect(ix.keys).toHaveLength(4);
    expect(ix.keys[1].pubkey.toString()).toBe(TEST_AUTHORITY.toString());
    expect(ix.keys[1].isSigner).toBe(true);
    expect(ix.keys[2].pubkey.toString()).toBe(TEST_AGENT.toString());
    expect(ix.keys[3].pubkey.toString()).toBe(SystemProgram.programId.toString());
  });

  it("data starts with create_mandate discriminator", () => {
    const ix = buildCreateMandateIx(TEST_AUTHORITY, TEST_AGENT, 1_000_000_000n, 150);
    // Anchor discriminator = SHA-256("global:create_mandate")[0..8]
    const expectedDisc = crypto
      .createHash("sha256")
      .update("global:create_mandate")
      .digest()
      .subarray(0, 8);
    expect(ix.data.subarray(0, 8)).toEqual(expectedDisc);
  });

  it("encodes maxUsdc as u64 little-endian", () => {
    const ix = buildCreateMandateIx(TEST_AUTHORITY, TEST_AGENT, 1_000_000_000n, 150);
    expect(ix.data.readBigUInt64LE(8)).toBe(1_000_000_000n);
  });

  it("encodes triggerHfBps as u16 little-endian", () => {
    const ix = buildCreateMandateIx(TEST_AUTHORITY, TEST_AGENT, 1_000_000_000n, 150);
    expect(ix.data.readUInt16LE(16)).toBe(150);
  });

  it("total data length = 8 (disc) + 8 (u64) + 2 (u16) = 18", () => {
    const ix = buildCreateMandateIx(TEST_AUTHORITY, TEST_AGENT, 1_000_000_000n, 150);
    expect(ix.data.length).toBe(18);
  });

  it("mandate PDA is marked writable", () => {
    const ix = buildCreateMandateIx(TEST_AUTHORITY, TEST_AGENT, 500_000_000n, 120);
    expect(ix.keys[0].isWritable).toBe(true);
  });
});

describe("Execute Rescue Instruction", () => {
  const mandatePda = deriveMandatePDA(TEST_AUTHORITY)[0];
  const userAta = new PublicKey("3mBsXj1vcGfRTsJkQ9mB6cR6pU8WzVjKkZ1TfZjhdLhQ");
  const repayVault = new PublicKey("5FHwkrdxeaQ5LgoTbRYL3JxCqBRVrB1JcF42mB5xXYjZ");
  const proofHash = Buffer.alloc(32, 0xab);

  it("uses execute_rescue discriminator", () => {
    const ix = buildExecuteRescueIx(
      mandatePda, TEST_AGENT, userAta, repayVault, TEST_USDC_MINT,
      500_000_000n, 120, proofHash
    );
    const expectedDisc = crypto
      .createHash("sha256")
      .update("global:execute_rescue")
      .digest()
      .subarray(0, 8);
    expect(ix.data.subarray(0, 8)).toEqual(expectedDisc);
  });

  it("encodes rescueAmount as u64 LE", () => {
    const ix = buildExecuteRescueIx(
      mandatePda, TEST_AGENT, userAta, repayVault, TEST_USDC_MINT,
      500_000_000n, 120, proofHash
    );
    expect(ix.data.readBigUInt64LE(8)).toBe(500_000_000n);
  });

  it("encodes reportedHfBps as u16 LE", () => {
    const ix = buildExecuteRescueIx(
      mandatePda, TEST_AGENT, userAta, repayVault, TEST_USDC_MINT,
      500_000_000n, 120, proofHash
    );
    expect(ix.data.readUInt16LE(16)).toBe(120);
  });

  it("encodes proofHash as 32-byte array", () => {
    const ix = buildExecuteRescueIx(
      mandatePda, TEST_AGENT, userAta, repayVault, TEST_USDC_MINT,
      500_000_000n, 120, proofHash
    );
    expect(ix.data.subarray(18, 50)).toEqual(proofHash);
  });

  it("agent is the sole signer", () => {
    const ix = buildExecuteRescueIx(
      mandatePda, TEST_AGENT, userAta, repayVault, TEST_USDC_MINT,
      500_000_000n, 120, proofHash
    );
    const signers = ix.keys.filter(k => k.isSigner);
    expect(signers).toHaveLength(1);
    expect(signers[0].pubkey.toString()).toBe(TEST_AGENT.toString());
  });

  it("includes token_program + associated_token_program (7 accounts)", () => {
    const ix = buildExecuteRescueIx(
      mandatePda, TEST_AGENT, userAta, repayVault, TEST_USDC_MINT,
      500_000_000n, 120, proofHash
    );
    // mandate, agent, userAta, repayVault, usdcMint, token_program, ata_program
    expect(ix.keys).toHaveLength(7);
  });

  it("rejects proofHash of wrong length", () => {
    const badHash = Buffer.alloc(16, 0xab);
    expect(() =>
      buildExecuteRescueIx(
        mandatePda, TEST_AGENT, userAta, repayVault, TEST_USDC_MINT,
        500_000_000n, 120, badHash
      )
    ).toThrow(/32 bytes/);
  });
});

describe("Update Mandate Instruction", () => {
  it("uses update_mandate discriminator", () => {
    const ix = buildUpdateMandateIx(TEST_AUTHORITY, 2_000_000_000n, 140);
    const expectedDisc = crypto
      .createHash("sha256")
      .update("global:update_mandate")
      .digest()
      .subarray(0, 8);
    expect(ix.data.subarray(0, 8)).toEqual(expectedDisc);
  });

  it("encodes Some variants when both params provided", () => {
    const ix = buildUpdateMandateIx(TEST_AUTHORITY, 2_000_000_000n, 140);
    // Layout: disc(8) + Option<u64>(1+8) + Option<u16>(1+2) = 20
    expect(ix.data.length).toBe(20);
    expect(ix.data.readUInt8(8)).toBe(1); // Some for maxUsdc
    expect(ix.data.readBigUInt64LE(9)).toBe(2_000_000_000n);
    expect(ix.data.readUInt8(17)).toBe(1); // Some for triggerHfBps
    expect(ix.data.readUInt16LE(18)).toBe(140);
  });

  it("encodes None when maxUsdc omitted", () => {
    const ix = buildUpdateMandateIx(TEST_AUTHORITY, undefined, 140);
    // Layout: disc(8) + None(1) + Some(1+2) = 12
    expect(ix.data.length).toBe(12);
    expect(ix.data.readUInt8(8)).toBe(0); // None for maxUsdc
    expect(ix.data.readUInt8(9)).toBe(1); // Some for triggerHfBps
  });

  it("encodes None when both omitted", () => {
    const ix = buildUpdateMandateIx(TEST_AUTHORITY);
    // Layout: disc(8) + None(1) + None(1) = 10
    expect(ix.data.length).toBe(10);
    expect(ix.data.readUInt8(8)).toBe(0);
    expect(ix.data.readUInt8(9)).toBe(0);
  });
});

describe("Close Mandate Instruction", () => {
  it("uses close_mandate discriminator only (no data args)", () => {
    const ix = buildCloseMandateIx(TEST_AUTHORITY);
    const expectedDisc = crypto
      .createHash("sha256")
      .update("global:close_mandate")
      .digest()
      .subarray(0, 8);
    expect(ix.data).toEqual(expectedDisc);
    expect(ix.data.length).toBe(8);
  });

  it("has 2 accounts: PDA + authority", () => {
    const ix = buildCloseMandateIx(TEST_AUTHORITY);
    expect(ix.keys).toHaveLength(2);
    expect(ix.keys[1].isSigner).toBe(true);
    expect(ix.keys[1].isWritable).toBe(true); // receives rent refund
  });
});

describe("Mandate State Deserialization", () => {
  it("returns null for undersized buffer", () => {
    const tooSmall = Buffer.alloc(50);
    expect(deserializeMandate(tooSmall)).toBeNull();
  });

  it("returns null for wrong discriminator", () => {
    const buf = Buffer.alloc(116);
    buf.fill(0); // All zeros — wrong discriminator
    expect(deserializeMandate(buf)).toBeNull();
  });

  it("deserializes well-formed mandate data (116-byte layout, u64 rescue_count)", () => {
    const discriminator = crypto
      .createHash("sha256")
      .update("account:RescueMandate")
      .digest()
      .subarray(0, 8);

    const buf = Buffer.alloc(116);
    let offset = 0;
    discriminator.copy(buf, offset); offset += 8;
    TEST_AUTHORITY.toBuffer().copy(buf, offset); offset += 32;
    TEST_AGENT.toBuffer().copy(buf, offset); offset += 32;
    buf.writeBigUInt64LE(1_000_000_000n, offset); offset += 8;
    buf.writeUInt16LE(150, offset); offset += 2;
    buf.writeBigUInt64LE(250_000_000n, offset); offset += 8; // totalRescued
    buf.writeBigUInt64LE(3n, offset); offset += 8; // rescueCount (u64)
    buf.writeBigInt64LE(1700000000n, offset); offset += 8; // createdAt
    buf.writeBigInt64LE(1700001000n, offset); offset += 8; // lastRescueAt
    buf.writeUInt8(1, offset); offset += 1; // isActive
    buf.writeUInt8(254, offset); // bump

    const state = deserializeMandate(buf);
    expect(state).not.toBeNull();
    expect(state!.authority.toString()).toBe(TEST_AUTHORITY.toString());
    expect(state!.agent.toString()).toBe(TEST_AGENT.toString());
    expect(state!.maxUsdc).toBe(1_000_000_000n);
    expect(state!.triggerHfBps).toBe(150);
    expect(state!.totalRescued).toBe(250_000_000n);
    expect(state!.rescueCount).toBe(3n);
    expect(state!.isActive).toBe(true);
    expect(state!.bump).toBe(254);
  });

  it("handles rescue_count > 255 without overflow (was u8 bug)", () => {
    const discriminator = crypto
      .createHash("sha256")
      .update("account:RescueMandate")
      .digest()
      .subarray(0, 8);

    const buf = Buffer.alloc(116);
    let offset = 0;
    discriminator.copy(buf, offset); offset += 8;
    TEST_AUTHORITY.toBuffer().copy(buf, offset); offset += 32;
    TEST_AGENT.toBuffer().copy(buf, offset); offset += 32;
    buf.writeBigUInt64LE(1_000_000_000n, offset); offset += 8;
    buf.writeUInt16LE(150, offset); offset += 2;
    buf.writeBigUInt64LE(0n, offset); offset += 8;
    // rescue_count = 9999 — would overflow u8, must decode correctly as u64
    buf.writeBigUInt64LE(9999n, offset); offset += 8;
    buf.writeBigInt64LE(1700000000n, offset); offset += 8;
    buf.writeBigInt64LE(1700001000n, offset); offset += 8;
    buf.writeUInt8(1, offset); offset += 1;
    buf.writeUInt8(254, offset);

    const state = deserializeMandate(buf);
    expect(state!.rescueCount).toBe(9999n);
  });
});

describe("Format Mandate State", () => {
  const fullState: RescueMandateState = {
    authority: TEST_AUTHORITY,
    agent: TEST_AGENT,
    maxUsdc: 1_000_000_000n, // $1000
    triggerHfBps: 150,
    totalRescued: 250_000_000n, // $250
    rescueCount: 3n,
    createdAt: 1700000000n,
    lastRescueAt: 1700001000n,
    isActive: true,
    bump: 254,
  };

  it("formats maxUsdc as USDC (not micro)", () => {
    const f = formatMandateState(fullState);
    expect(f.maxUsdc).toBe(1000);
  });

  it("converts triggerHfBps to HF ratio", () => {
    const f = formatMandateState(fullState);
    expect(f.triggerHf).toBe(1.5);
  });

  it("computes remainingUsdc", () => {
    const f = formatMandateState(fullState);
    expect(f.remainingUsdc).toBe(750); // 1000 - 250
  });

  it("converts timestamps to ISO strings", () => {
    const f = formatMandateState(fullState);
    expect(f.createdAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(f.lastRescueAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("lastRescueAt is null when zero", () => {
    const f = formatMandateState({ ...fullState, lastRescueAt: 0n });
    expect(f.lastRescueAt).toBeNull();
  });
});
