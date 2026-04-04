"use client";

import { useEffect, useState } from "react";

interface PriceData {
  price: number;
  prev: number;
}

export default function PriceTicker() {
  const [data, setData] = useState<PriceData | null>(null);

  async function fetchPrice() {
    try {
      // CoinGecko simple price — no API key required
      const res = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd",
        { next: { revalidate: 30 } }
      );
      const json = await res.json();
      const p = json?.solana?.usd ?? 0;
      if (p > 0) {
        setData(prev => ({ price: p, prev: prev?.price ?? p }));
      }
    } catch { /* silent */ }
  }

  useEffect(() => {
    fetchPrice();
    const id = setInterval(fetchPrice, 30_000); // refresh every 30s
    return () => clearInterval(id);
  }, []);

  if (!data) return null;

  const up = data.price >= data.prev;
  const color = up ? "#10B981" : "#EF4444";
  const arrow = up ? "▲" : "▼";

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 6,
      background: "#13131A", border: "1px solid #1E1E2E",
      borderRadius: 8, padding: "5px 12px",
    }}>
      <span style={{ fontSize: 11, color: "#475569" }}>SOL</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: "#E2E8F0" }}>
        ${data.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
      <span style={{ fontSize: 10, color }}>{arrow}</span>
    </div>
  );
}
