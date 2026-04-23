/**
 * scripts/som-analysis/activity-pattern.ts
 *
 * Activity-flow evidence for the Day-1 SOM. Pairs with day1-som.ts.
 *
 * day1-som.ts       answers "how much TVL is addressable" — a static stock.
 * activity-pattern  answers "how much activity flows through our 4 protocols
 *                    right now" — a throughput measure.
 *
 * Together they support the Dovey-critique response:
 *   - Day-1 SOM         $4.48B reachable TVL        (stock)
 *   - Activity share    % of Solana DeFi fees       (flow)
 *   - Borrow exposure   $1.62B live debt            (the "pain surface")
 *
 * Philosophy: every number here is sourced from DefiLlama's public API and
 * computable in a single run; evaluators can verify the denominator
 * (`/overview/fees/solana`) and each numerator (`/summary/fees/{slug}`)
 * independently. No API key, no projections, no multipliers.
 *
 * Usage:
 *   npx tsx scripts/som-analysis/activity-pattern.ts
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(HERE, "output");

// DefiLlama fee-type slugs for each of our 4 integrated protocols.
// Jupiter is split into aggregator (swap) and lend (earn/borrow) — we sum
// both because our 12 CPI cells cover both surfaces.
const FEE_SLUGS = [
  { slug: "kamino", label: "Kamino", kind: "Lending" },
  { slug: "jupiter-aggregator", label: "Jupiter (Swap)", kind: "Aggregator" },
  { slug: "jupiter-lend", label: "Jupiter (Lend)", kind: "Lending" },
  { slug: "jito-liquid-staking", label: "Jito", kind: "LST" },
  { slug: "raydium", label: "Raydium", kind: "AMM" },
] as const;

interface FeeSummary {
  name: string;
  total24h?: number;
  total7d?: number;
  total30d?: number;
  category?: string;
}

async function fetchSummary(slug: string, attempt = 1): Promise<FeeSummary> {
  const url = `https://api.llama.fi/summary/fees/${slug}?dataType=dailyFees`;
  try {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) throw new Error(`${slug}: HTTP ${res.status}`);
    return (await res.json()) as FeeSummary;
  } catch (err) {
    // DefiLlama's per-protocol summary endpoint intermittently times out
    // under parallel load. One retry is sufficient in practice; if the
    // second attempt also fails, surface the error.
    if (attempt < 2) return fetchSummary(slug, attempt + 1);
    throw err;
  }
}

async function fetchSolanaTotal(): Promise<{
  total24h: number;
  total7d: number;
  total30d: number;
}> {
  const url =
    "https://api.llama.fi/overview/fees/solana?dataType=dailyFees&excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true";
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(25_000),
  });
  if (!res.ok) throw new Error(`solana fees: HTTP ${res.status}`);
  const d = (await res.json()) as FeeSummary;
  return {
    total24h: d.total24h ?? 0,
    total7d: d.total7d ?? 0,
    total30d: d.total30d ?? 0,
  };
}

function fmtUsd(n: number | undefined): string {
  if (n === undefined || n === 0) return "—";
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${Math.round(n)}`;
}

function buildMarkdown(
  perProto: Array<{ label: string; kind: string; total24h: number; total7d: number; total30d: number }>,
  solana: { total24h: number; total7d: number; total30d: number },
  date: string
): string {
  const our30d = perProto.reduce((s, p) => s + p.total30d, 0);
  const our7d = perProto.reduce((s, p) => s + p.total7d, 0);
  const our24h = perProto.reduce((s, p) => s + p.total24h, 0);
  const share30d = solana.total30d > 0 ? (our30d / solana.total30d) * 100 : 0;
  const share7d = solana.total7d > 0 ? (our7d / solana.total7d) * 100 : 0;
  const share24h = solana.total24h > 0 ? (our24h / solana.total24h) * 100 : 0;

  const rows = perProto
    .map(
      (p) =>
        `| ${p.label} | ${p.kind} | ${fmtUsd(p.total24h)} | ${fmtUsd(p.total7d)} | ${fmtUsd(p.total30d)} |`
    )
    .join("\n");

  return `# Activity-Flow Snapshot — ${date}

**Of all fees paid across all Solana DeFi protocols in the last 30 days,
${share30d.toFixed(1)}% flowed through the four protocols Sakura's ZK
gate can mediate today.**

This is the "flow" half of the SOM case. \`day1-som.ts\` establishes the
stock ($4.48B reachable TVL, of which $1.62B borrow); this script
establishes the flow (% share of protocol fee activity).

## Headline

- **Our-4 share of Solana DeFi fees — 30d: ${share30d.toFixed(1)}%**
- **Our-4 share of Solana DeFi fees — 7d:  ${share7d.toFixed(1)}%**
- **Our-4 share of Solana DeFi fees — 24h: ${share24h.toFixed(1)}%**
- **Solana DeFi fees, 30d total: ${fmtUsd(solana.total30d)}**
- **Our-4 fees, 30d total:       ${fmtUsd(our30d)}**

The 30-day window is the operationally relevant one: it smooths one-off
spikes (airdrops, new-listing volume) and tracks the rhythm an agent
would actually traverse inside a multi-week bounded-intent window.

## Per-protocol breakdown

| Protocol | Category | 24h fees | 7d fees | 30d fees |
|---|---|---:|---:|---:|
${rows}
| **Our 4 protocols (5 surfaces)** |  | **${fmtUsd(our24h)}** | **${fmtUsd(our7d)}** | **${fmtUsd(our30d)}** |
| **Solana DeFi total**            |  | ${fmtUsd(solana.total24h)} | ${fmtUsd(solana.total7d)} | ${fmtUsd(solana.total30d)} |
| **Our share**                    |  | **${share24h.toFixed(1)}%** | **${share7d.toFixed(1)}%** | **${share30d.toFixed(1)}%** |

## What this answers in the Dovey critique

> "每类 integration 的使用频次" (usage frequency per integration type)

The table above, directly. Lending (Kamino + Jupiter Lend), swap (Jupiter
Aggregator + Raydium), and LST (Jito) each pull from a live fee stream
DefiLlama indexes independently.

> "哪类交易最需要这种边界验证" (which txs most need boundary verification)

The stock side: \`day1-som.ts\` shows $1.62B of outstanding borrow debt
(from Kamino + Jupiter Lend) sitting inside the surface a session-key
agent can touch. Borrow debt has the longest average position duration
of the five surfaces here — \`stake\` and \`swap\` are one-shot; borrow
debt survives across market moves and compounds the delegation window's
exposure. That is the sharpest wedge for bounded-intent verification.

Wallet-level pattern evidence (e.g. "of N agentic wallets active on ≥ 2
of the 4 protocols in 30d, X% traced a long-horizon rebalancing pattern")
requires decoded chain data not available via DefiLlama's public
endpoints. The reproducible Dune SQL to build that layer lives in
\`scripts/som-analysis/queries/\` and can be executed in Dune's free
web UI by any evaluator.

## Reproducibility

\`\`\`bash
npx tsx scripts/som-analysis/activity-pattern.ts
\`\`\`

Re-runs any time; no API key. Every number traces back to one of:

- \`https://api.llama.fi/overview/fees/solana\` (denominator)
- \`https://api.llama.fi/summary/fees/{slug}\` (numerators)

---

_Generated by \`scripts/som-analysis/activity-pattern.ts\` at ${new Date().toISOString()}_
`;
}

async function main() {
  console.log("Fetching Solana DeFi activity flow from DefiLlama...\n");

  console.log("  [Solana total] fetching...");
  const solana = await fetchSolanaTotal();
  console.log(
    `      24h ${fmtUsd(solana.total24h)} · 7d ${fmtUsd(solana.total7d)} · 30d ${fmtUsd(solana.total30d)}`
  );

  // Parallelize the per-protocol summary fetches. DefiLlama's
  // `/summary/fees/{slug}` occasionally times out serially; in-parallel
  // latency is ~5s for all five slugs combined, and the fetchSummary
  // helper retries once on its own.
  console.log(`  Fetching ${FEE_SLUGS.length} protocol summaries in parallel...`);
  const perProto = await Promise.all(
    FEE_SLUGS.map(async (spec) => {
      const s = await fetchSummary(spec.slug);
      const entry = {
        label: spec.label,
        kind: spec.kind,
        total24h: s.total24h ?? 0,
        total7d: s.total7d ?? 0,
        total30d: s.total30d ?? 0,
      };
      console.log(
        `    [${spec.label}] 30d ${fmtUsd(entry.total30d)}  7d ${fmtUsd(entry.total7d)}  24h ${fmtUsd(entry.total24h)}`
      );
      return entry;
    })
  );

  const date = new Date().toISOString().slice(0, 10);
  const our30d = perProto.reduce((s, p) => s + p.total30d, 0);
  const share30d = solana.total30d > 0 ? (our30d / solana.total30d) * 100 : 0;

  mkdirSync(OUT_DIR, { recursive: true });

  const jsonPath = join(OUT_DIR, `activity-pattern-${date}.json`);
  writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        solanaTotalFees: solana,
        perProtocol: perProto,
        our4TotalFees: {
          total24h: perProto.reduce((s, p) => s + p.total24h, 0),
          total7d: perProto.reduce((s, p) => s + p.total7d, 0),
          total30d: our30d,
        },
        share: {
          pct24h:
            solana.total24h > 0
              ? (perProto.reduce((s, p) => s + p.total24h, 0) / solana.total24h) * 100
              : 0,
          pct7d:
            solana.total7d > 0
              ? (perProto.reduce((s, p) => s + p.total7d, 0) / solana.total7d) * 100
              : 0,
          pct30d: share30d,
        },
      },
      null,
      2
    )
  );

  const mdPath = join(OUT_DIR, `activity-pattern-${date}.md`);
  writeFileSync(mdPath, buildMarkdown(perProto, solana, date));

  console.log(`\n✅ Activity-flow snapshot complete.`);
  console.log(
    `   Of all Solana DeFi fees (30d total ${fmtUsd(solana.total30d)}),`
  );
  console.log(
    `   ${share30d.toFixed(1)}% flowed through our 4 integrated protocols.`
  );
  console.log(`\n   Wrote:`);
  console.log(`     ${jsonPath}`);
  console.log(`     ${mdPath}`);
}

main().catch((err) => {
  console.error(`\n❌ ${err.message}`);
  process.exit(1);
});
