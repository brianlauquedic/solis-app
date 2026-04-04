const KEY = "solis_watchlist";

export interface WatchedToken {
  mint: string;
  symbol: string;
  name: string;
  logoURI: string | null;
  securityScore: number;
  verdict: "buy" | "caution" | "avoid";
  price: number | null;
  checkedAt: number;
  lastKnownPrice?: number;
  lastPriceCheckedAt?: number;
}

export function getWatchlist(): WatchedToken[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function addToWatchlist(token: WatchedToken): void {
  const list = getWatchlist().filter(t => t.mint !== token.mint);
  list.unshift(token); // newest first
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, 20))); // keep max 20
}

export function removeFromWatchlist(mint: string): void {
  const list = getWatchlist().filter(t => t.mint !== mint);
  localStorage.setItem(KEY, JSON.stringify(list));
}

export function saveLastPrice(mint: string, price: number): void {
  const list = getWatchlist();
  const updated = list.map(t =>
    t.mint === mint
      ? { ...t, lastKnownPrice: price, lastPriceCheckedAt: Date.now() }
      : t
  );
  localStorage.setItem(KEY, JSON.stringify(updated));
}
