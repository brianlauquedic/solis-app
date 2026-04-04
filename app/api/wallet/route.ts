import { NextRequest, NextResponse } from "next/server";

const HELIUS_API_KEY = process.env.HELIUS_API_KEY ?? "";
const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

// Known token list for labeling
const KNOWN_TOKENS: Record<string, { name: string; symbol: string; type: string }> = {
  "So11111111111111111111111111111111111111112":   { name: "Solana",          symbol: "SOL",  type: "native" },
  "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v": { name: "USD Coin",        symbol: "USDC", type: "stablecoin" },
  "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB": { name: "Tether USD",      symbol: "USDT", type: "stablecoin" },
  "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263": { name: "Bonk",           symbol: "BONK", type: "meme" },
  "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN":  { name: "Jupiter",         symbol: "JUP",  type: "defi" },
  "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So": { name: "Marinade SOL",   symbol: "mSOL", type: "liquid_stake" },
  "7vfCXTUXx5WJV5JADk17DUJ4ksgau7utNKj4b963voxs": { name: "Ether (Wormhole)", symbol: "ETH", type: "bridge" },
  "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R": { name: "Raydium",        symbol: "RAY",  type: "defi" },
  "orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE":  { name: "Orca",           symbol: "ORCA", type: "defi" },
  "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3": { name: "Pyth Network",   symbol: "PYTH", type: "defi" },
};

function fetchWithTimeout(url: string, opts: RequestInit = {}, ms = 8000): Promise<Response> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(timer));
}

async function rpc(method: string, params: unknown[]) {
  const res = await fetchWithTimeout(HELIUS_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const data = await res.json();
  return data.result;
}

async function getSOLBalance(address: string): Promise<number> {
  const balance = await rpc("getBalance", [address]);
  return (balance?.value ?? 0) / 1e9;
}

async function getTokenAccounts(address: string) {
  const result = await rpc("getTokenAccountsByOwner", [
    address,
    { programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
    { encoding: "jsonParsed" },
  ]);
  return result?.value ?? [];
}

async function getSOLPrice(): Promise<number> {
  try {
    const res = await fetchWithTimeout(
      "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd",
      { next: { revalidate: 60 } } as RequestInit,
      5000
    );
    const data = await res.json();
    return data?.solana?.usd ?? 150;
  } catch {
    return 150;
  }
}

// Batch fetch prices from Jupiter — handles any number of mints in chunks of 100
async function getJupiterPrices(mints: string[]): Promise<Record<string, number>> {
  if (mints.length === 0) return {};
  const prices: Record<string, number> = {};
  const CHUNK = 100;
  for (let i = 0; i < mints.length; i += CHUNK) {
    const chunk = mints.slice(i, i + CHUNK);
    try {
      const res = await fetchWithTimeout(
        `https://api.jup.ag/price/v2?ids=${chunk.join(",")}`,
        {},
        6000
      );
      const data = await res.json();
      for (const [mint, info] of Object.entries(data?.data ?? {})) {
        const p = (info as { price?: string })?.price;
        if (p) prices[mint] = parseFloat(p);
      }
    } catch { /* skip chunk, continue */ }
  }
  return prices;
}

// Fetch symbol/name for ALL unknown tokens via Helius DAS in parallel batches of 10
async function getHeliusTokenMeta(
  mints: string[]
): Promise<Record<string, { name: string; symbol: string }>> {
  if (mints.length === 0) return {};
  const results: Record<string, { name: string; symbol: string }> = {};
  const BATCH = 10;

  for (let i = 0; i < mints.length; i += BATCH) {
    const batch = mints.slice(i, i + BATCH);
    await Promise.all(
      batch.map(async (mint) => {
        try {
          const res = await fetchWithTimeout(HELIUS_RPC, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0", id: 1,
              method: "getAsset",
              params: { id: mint },
            }),
          }, 5000);
          const data = await res.json();
          const meta = data?.result?.content?.metadata;
          const tokenInfo = data?.result?.token_info;
          if (meta?.name || tokenInfo?.symbol) {
            results[mint] = {
              name: meta?.name ?? tokenInfo?.symbol ?? "Unknown",
              symbol: meta?.symbol ?? tokenInfo?.symbol ?? mint.slice(0, 6) + "...",
            };
          }
        } catch { /* skip individual token */ }
      })
    );
  }
  return results;
}

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");
  if (!address) return NextResponse.json({ error: "Missing address" }, { status: 400 });

  try {
    const [solBalance, tokenAccounts, solPrice] = await Promise.all([
      getSOLBalance(address),
      getTokenAccounts(address),
      getSOLPrice(),
    ]);

    const solUSD = solBalance * solPrice;

    // ── Step 1: Parse token accounts ────────────────────────────
    const rawTokens = tokenAccounts
      .map((acc: unknown) => {
        const account = acc as { account?: { data?: { parsed?: { info?: { mint?: string; tokenAmount?: { uiAmount?: number; decimals?: number } } } } } };
        const info = account.account?.data?.parsed?.info;
        if (!info) return null;
        const mint = info.mint ?? "";
        const amount = info.tokenAmount?.uiAmount ?? 0;
        if (amount === 0) return null;
        const known = KNOWN_TOKENS[mint];
        return {
          mint,
          amount,
          decimals: info.tokenAmount?.decimals ?? 0,
          name: known?.name ?? "",
          symbol: known?.symbol ?? "",
          type: known?.type ?? "unknown",
          usdValue: null as number | null,
        };
      })
      .filter(Boolean) as {
        mint: string; amount: number; decimals: number;
        name: string; symbol: string; type: string; usdValue: number | null;
      }[];

    // ── Step 2: Enrich unknown tokens with Helius metadata ───────
    const unknownMints = rawTokens
      .filter((t) => !t.name)
      .map((t) => t.mint);
    const heliusMeta = await getHeliusTokenMeta(unknownMints);
    for (const t of rawTokens) {
      if (!t.name && heliusMeta[t.mint]) {
        t.name = heliusMeta[t.mint].name;
        t.symbol = heliusMeta[t.mint].symbol;
      }
      // Fallback
      if (!t.name) t.name = "Unknown Token";
      if (!t.symbol) t.symbol = t.mint.slice(0, 6) + "...";
    }

    // ── Step 3: Batch fetch Jupiter prices for all tokens ────────
    const allMints = rawTokens.map((t) => t.mint);
    const jupPrices = await getJupiterPrices(allMints);

    // ── Step 4: Assign USD values ────────────────────────────────
    for (const t of rawTokens) {
      if (t.type === "stablecoin") {
        t.usdValue = t.amount; // 1:1 USD
      } else if (jupPrices[t.mint] !== undefined) {
        t.usdValue = t.amount * jupPrices[t.mint];
      } else if (t.type === "liquid_stake") {
        t.usdValue = t.amount * solPrice; // approximation
      }
      // else remains null
    }

    // ── Step 5: Sort by USD value descending ─────────────────────
    rawTokens.sort((a, b) => (b.usdValue ?? -1) - (a.usdValue ?? -1));

    // ── Step 6: Calculate totals ─────────────────────────────────
    const knownUSD = rawTokens
      .filter((t) => t.usdValue !== null)
      .reduce((sum, t) => sum + (t.usdValue ?? 0), 0);
    const totalUSD = solUSD + knownUSD;

    // ── Step 7: Risk analysis ────────────────────────────────────
    const riskyTokens = rawTokens.filter(
      (t) => t.type === "unknown" || t.type === "meme"
    );
    const stableAssets = rawTokens.filter((t) => t.type === "stablecoin");
    const idleUSDC = stableAssets.reduce(
      (sum, t) => sum + (t.usdValue ?? 0), 0
    );

    // ── Step 8: Portfolio breakdown for chart ────────────────────
    const breakdown = {
      sol: totalUSD > 0 ? (solUSD / totalUSD) * 100 : 0,
      stablecoin: totalUSD > 0
        ? (stableAssets.reduce((s, t) => s + (t.usdValue ?? 0), 0) / totalUSD) * 100
        : 0,
      defi: totalUSD > 0
        ? (rawTokens.filter(t => t.type === "defi" || t.type === "liquid_stake" || t.type === "bridge")
            .reduce((s, t) => s + (t.usdValue ?? 0), 0) / totalUSD) * 100
        : 0,
      risky: totalUSD > 0
        ? (riskyTokens.reduce((s, t) => s + (t.usdValue ?? 0), 0) / totalUSD) * 100
        : 0,
    };

    // ── Step 9: Health score ─────────────────────────────────────
    let score = 70;
    if (solBalance > 1) score += 10;
    if (riskyTokens.length > 3) score -= 15;
    else if (riskyTokens.length > 1) score -= 8;
    if (idleUSDC > 100) score -= 5;
    if (rawTokens.some((t) => t.type === "liquid_stake")) score += 5;
    if (breakdown.risky > 50) score -= 10;
    score = Math.max(10, Math.min(95, score));

    return NextResponse.json({
      address,
      solBalance,
      solPrice,
      solUSD,
      tokens: rawTokens,
      totalUSD,
      idleUSDC,
      riskyTokenCount: riskyTokens.length,
      healthScore: score,
      breakdown,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
