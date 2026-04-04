const KEY = "solis_proofs";

export interface ProofRecord {
  hash: string;
  memoPayload: string;
  mint: string;
  symbol: string;
  securityScore: number;
  decision: string;
  reasoning: string;
  timestamp: number;
  aiAvailable: boolean;
}

export function saveProof(record: ProofRecord): void {
  if (typeof window === "undefined") return;
  try {
    const all: Record<string, ProofRecord> = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    all[record.hash] = record;
    // Keep max 50 proofs
    const keys = Object.keys(all);
    if (keys.length > 50) {
      const oldest = keys.sort((a, b) => all[a].timestamp - all[b].timestamp)[0];
      delete all[oldest];
    }
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch { /* ignore */ }
}

export function lookupProof(hash: string): ProofRecord | null {
  if (typeof window === "undefined") return null;
  try {
    const all: Record<string, ProofRecord> = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    // Support both full hash and memo payload prefix (solis:xxxx)
    if (hash.startsWith("solis:")) {
      const prefix = hash.slice(6);
      const found = Object.values(all).find(r => r.hash.startsWith(prefix));
      return found ?? null;
    }
    return all[hash] ?? null;
  } catch {
    return null;
  }
}

export function getAllProofs(): ProofRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const all: Record<string, ProofRecord> = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    return Object.values(all).sort((a, b) => b.timestamp - a.timestamp);
  } catch {
    return [];
  }
}
