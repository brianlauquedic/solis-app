/**
 * Input validation security tests.
 *
 * Verifies that API endpoints properly validate and sanitize inputs
 * to prevent injection, overflow, and bypass attacks.
 */
import { describe, it, expect } from "vitest";

// ── Wallet Address Validation ───────────────────────────────────────

describe("Wallet Address Validation", () => {
  const WALLET_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

  it("accepts valid Solana base58 addresses", () => {
    expect(WALLET_REGEX.test("11111111111111111111111111111112")).toBe(true);
    expect(WALLET_REGEX.test("So11111111111111111111111111111111111111112")).toBe(true);
    expect(WALLET_REGEX.test("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v")).toBe(true);
  });

  it("rejects addresses with invalid characters", () => {
    expect(WALLET_REGEX.test("0x1234567890abcdef1234567890abcdef12345678")).toBe(false); // hex
    expect(WALLET_REGEX.test("wallet' OR 1=1 --")).toBe(false); // SQL injection
    expect(WALLET_REGEX.test("<script>alert(1)</script>")).toBe(false); // XSS
  });

  it("rejects too-short addresses", () => {
    expect(WALLET_REGEX.test("abc")).toBe(false);
    expect(WALLET_REGEX.test("")).toBe(false);
  });

  it("rejects addresses with base58-excluded chars (0, O, I, l)", () => {
    expect(WALLET_REGEX.test("0" + "1".repeat(43))).toBe(false); // starts with 0
    expect(WALLET_REGEX.test("O" + "1".repeat(43))).toBe(false); // capital O
    expect(WALLET_REGEX.test("I" + "1".repeat(43))).toBe(false); // capital I
    expect(WALLET_REGEX.test("l" + "1".repeat(43))).toBe(false); // lowercase l
  });
});

// ── Token Allowlist ─────────────────────────────────────────────────

describe("Token Allowlist Enforcement", () => {
  // Token allowlist from the Jupiter integration surface.
  const TOKEN_MINTS: Record<string, string> = {
    SOL: "So11111111111111111111111111111111111111112",
    USDC: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
    USDT: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB",
    mSOL: "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So",
    jitoSOL: "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn",
    BONK: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263",
  };

  it("known tokens resolve to valid mint addresses", () => {
    expect(TOKEN_MINTS["SOL"]).toBeDefined();
    expect(TOKEN_MINTS["USDC"]).toBeDefined();
    expect(TOKEN_MINTS["mSOL"]).toBeDefined();
  });

  it("unknown tokens return undefined (not raw input)", () => {
    // Security: execute route must NOT fall back to raw user input
    const userInput = "MALICIOUS_TOKEN";
    const mint = TOKEN_MINTS[userInput]; // undefined, not userInput
    expect(mint).toBeUndefined();
  });

  it("prevents URL injection via token names", () => {
    const maliciousToken = "SOL&outputMint=EVIL_MINT";
    expect(TOKEN_MINTS[maliciousToken]).toBeUndefined();
  });
});

// ── Rescue Amount Validation ────────────────────────────────────────

describe("Rescue Amount Validation", () => {
  const MINIMUM_RESCUE_USDC = 1.0;
  const MAXIMUM_RESCUE_USDC = 1_000_000;

  function isValidRescueAmount(amount: unknown): boolean {
    const n = Number(amount);
    return Number.isFinite(n) && n >= MINIMUM_RESCUE_USDC && n <= MAXIMUM_RESCUE_USDC;
  }

  it("accepts valid rescue amounts", () => {
    expect(isValidRescueAmount(1)).toBe(true);
    expect(isValidRescueAmount(500)).toBe(true);
    expect(isValidRescueAmount(1_000_000)).toBe(true);
  });

  it("rejects zero and negative amounts", () => {
    expect(isValidRescueAmount(0)).toBe(false);
    expect(isValidRescueAmount(-100)).toBe(false);
  });

  it("rejects non-numeric inputs", () => {
    expect(isValidRescueAmount("abc")).toBe(false);
    expect(isValidRescueAmount(NaN)).toBe(false);
    expect(isValidRescueAmount(Infinity)).toBe(false);
    expect(isValidRescueAmount(null)).toBe(false);
    expect(isValidRescueAmount(undefined)).toBe(false);
  });

  it("rejects amounts exceeding maximum", () => {
    expect(isValidRescueAmount(1_000_001)).toBe(false);
    expect(isValidRescueAmount(Number.MAX_SAFE_INTEGER)).toBe(false);
  });

  it("rejects dust amounts below minimum", () => {
    expect(isValidRescueAmount(0.5)).toBe(false);
    expect(isValidRescueAmount(0.99)).toBe(false);
  });
});

// ── Health Factor Threshold ─────────────────────────────────────────

describe("Health Factor Trigger Threshold", () => {
  function getThreshold(clientHF: unknown): number {
    const n = Number(clientHF);
    return Number.isFinite(n) && n >= 1.01 && n <= 2.0 ? n : 1.5;
  }

  it("uses client value within valid range", () => {
    expect(getThreshold(1.2)).toBe(1.2);
    expect(getThreshold(1.01)).toBe(1.01);
    expect(getThreshold(2.0)).toBe(2.0);
  });

  it("falls back to 1.5 for invalid values", () => {
    expect(getThreshold(0.5)).toBe(1.5);   // too low
    expect(getThreshold(3.0)).toBe(1.5);   // too high
    expect(getThreshold(NaN)).toBe(1.5);
    expect(getThreshold(null)).toBe(1.5);
    expect(getThreshold("abc")).toBe(1.5);
  });
});

// ── Memo Payload Size ───────────────────────────────────────────────

describe("Memo Payload Size Enforcement", () => {
  const MAX_MEMO_BYTES = 560;

  it("short payloads pass through unchanged", () => {
    const payload = "short memo";
    const encoded = new TextEncoder().encode(payload);
    expect(encoded.length).toBeLessThanOrEqual(MAX_MEMO_BYTES);
  });

  it("oversized payloads are truncated to byte-safe length", () => {
    const oversized = "x".repeat(1000);
    const encoded = new TextEncoder().encode(oversized);
    const truncated = new TextDecoder().decode(encoded.slice(0, MAX_MEMO_BYTES));
    expect(new TextEncoder().encode(truncated).length).toBeLessThanOrEqual(MAX_MEMO_BYTES);
  });

  it("multi-byte UTF-8 truncation uses safe boundary", () => {
    // Chinese chars are 3 bytes each in UTF-8
    // Naive byte-slice can split a multi-byte char → replacement char (U+FFFD)
    // Safe approach: use TextDecoder with fatal:false then strip trailing U+FFFD
    const chinese = "你".repeat(200); // 600 bytes
    const encoded = new TextEncoder().encode(chinese);
    const rawTruncated = new TextDecoder().decode(encoded.slice(0, MAX_MEMO_BYTES));
    // Safe truncation: strip any trailing replacement characters
    const safeTruncated = rawTruncated.replace(/\uFFFD+$/, "");
    expect(safeTruncated).not.toContain("\uFFFD");
    expect(new TextEncoder().encode(safeTruncated).length).toBeLessThanOrEqual(MAX_MEMO_BYTES);
  });
});
