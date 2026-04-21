/**
 * demo-store.ts — localStorage-backed store for ?demo=true action history.
 *
 * Demo users don't have a wallet, so we can't read their real on-chain
 * history via getProgramAccounts. Instead, every time the demo user
 * signs an intent in IntentSigner, we synthesize an ActionRecord-shaped
 * entry and append it here; ActionHistory reads from this same store
 * to render the audit trail.
 *
 * Cross-tab + same-tab reactivity:
 *   - `storage` event fires across tabs when localStorage changes
 *   - `sakura:demo-action` CustomEvent fires within the current tab
 *     immediately after appendDemoAction() (storage event does NOT
 *     fire in the tab that triggered it)
 *
 * Signature linking:
 *   Each demo row links to one of 5 REAL on-chain devnet signatures
 *   from our bench run at docs/bench/2026-04-21-cu.json. Cycling
 *   through real sigs means the click-through experience is honest
 *   ("this product DOES execute on-chain — here's a real receipt")
 *   even though the simulated action itself never touched a chain.
 */

export const DEMO_ACTIONS_KEY = "sakura:demo:actions";
export const DEMO_ACTION_EVENT = "sakura:demo-action";

/** Real, publicly verifiable devnet execute_with_intent_proof signatures
 *  from the 2026-04-21 CU benchmark. See docs/bench/2026-04-21-cu.json. */
export const BENCH_SIGS: readonly string[] = [
  "37Wkg128nQ4mD4Nf2Ezzkf7bn9cj81PPTrRXpuWUr2qjWRrQ1ZoExxTytJAPLgn5Yd2tz7BaRCM8cYbu1MDDTyfy",
  "2yjT9ivnyJWnqRRLX8hcK159EmDkA4fXaCGTHTtVHAUNofGFqcS8LkJZcbdjVFG2zPGcipvjhop6jTpT5ezGPfoC",
  "pM8WLYrMeS2vJRefYovKpt834wyFw783pBphQtCG3TYTNvaZW8iRGcxHn5KfTPoJttwbAZhX9QPxXWqeoWfFxt7",
  "dZcYCcW1YKeCWCeJPtzZtN3eHbHYgwbXqihAESCZDZvnD7gkDiaaQVjMdVkuKu4PMUW13WDbGP7JSvSbGFx1Pm8",
  "yZTwTCZ9W2rHvhoV6wpmkoh1JbUuvZEpmSXAuCBnMatzqU4zQao7iPHunrFTC37z29qANV5wYHArMP2p8ri5Cia",
];

/** A single row in the demo-mode action-history localStorage array.
 *  bigints are serialized as strings; Buffers as hex. */
export interface DemoActionEntry {
  nonce: string;                  // bigint as string
  actionType: number;             // ActionType enum index
  actionAmount: string;           // bigint micro-USDC, as string
  actionTargetIndex: number;      // ProtocolId enum index
  oraclePriceUsdMicro: string;    // bigint as string
  oracleSlot: string;             // bigint as string
  ts: string;                     // bigint unix seconds, as string
  proofFingerprintHex: string;    // 64-char hex (32 bytes)
  demoSignature: string;          // the 88-char bs58 demo signature
  benchRefSignature: string;      // real devnet sig for the "view" link
  commitmentHex: string;          // 32-byte commitment, 64-char hex
}

/** Snapshot of the most recent demo intent — surfaces as IntentSummary. */
export interface DemoIntent {
  commitmentHex: string;
  signedAt: string;   // bigint as string
  expiresAt: string;  // bigint as string
  actionsExecuted: number;
}

function readArray(): DemoActionEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(DEMO_ACTIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as DemoActionEntry[]) : [];
  } catch {
    return [];
  }
}

function writeArray(arr: DemoActionEntry[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(DEMO_ACTIONS_KEY, JSON.stringify(arr));
}

export function getDemoActions(): DemoActionEntry[] {
  return readArray();
}

export function appendDemoAction(
  entry: Omit<DemoActionEntry, "benchRefSignature">
): DemoActionEntry {
  const all = readArray();
  const benchRefSignature =
    BENCH_SIGS[all.length % BENCH_SIGS.length] ?? BENCH_SIGS[0]!;
  const full: DemoActionEntry = { ...entry, benchRefSignature };
  all.push(full);
  writeArray(all);
  if (typeof window !== "undefined") {
    // Same-tab listeners (cross-tab is handled by the native `storage` event).
    window.dispatchEvent(new CustomEvent(DEMO_ACTION_EVENT));
  }
  return full;
}

export function clearDemoActions() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(DEMO_ACTIONS_KEY);
  window.dispatchEvent(new CustomEvent(DEMO_ACTION_EVENT));
}

export function solscanTxUrl(signature: string): string {
  return `https://solscan.io/tx/${signature}?cluster=devnet`;
}
