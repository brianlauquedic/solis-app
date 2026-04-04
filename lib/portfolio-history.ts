const KEY = "solis_portfolio_history";

export interface PortfolioSnapshot {
  address: string;
  totalUSD: number;
  solBalance: number;
  healthScore: number;
  tokenCount: number;
  savedAt: number;
}

export function getHistory(address: string): PortfolioSnapshot[] {
  if (typeof window === "undefined") return [];
  try {
    const all: PortfolioSnapshot[] = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return all.filter(s => s.address === address);
  } catch {
    return [];
  }
}

export function saveSnapshot(snap: PortfolioSnapshot): void {
  if (typeof window === "undefined") return;
  try {
    const all: PortfolioSnapshot[] = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    // Keep max 30 snapshots per address, deduplicate within same hour
    const filtered = all.filter(s =>
      s.address !== snap.address ||
      snap.savedAt - s.savedAt > 3_600_000 // 1 hour gap
    );
    filtered.unshift(snap);
    localStorage.setItem(KEY, JSON.stringify(filtered.slice(0, 60)));
  } catch { /* ignore */ }
}
