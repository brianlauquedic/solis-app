// app/api/weekly-report/route.ts

import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const runtime = "nodejs";
export const revalidate = 3600;

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY ?? "" });

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NarrativeSection {
  headline: string;
  opening: string;
  hotSector: string;
  capitalFlow: string;
  macroContext: string;
  riskRadar: string;
  verdict: string;
  findings: string[];   // 5 items
  catalysts: string[];  // 3 items
}

export interface ReportProtocol {
  name: string;
  slug: string;
  tvlFmt: string;
  tvlRaw: number;
  change7d: number;
  category: string;
  logoUrl: string;
}

export interface DexShare {
  name: string;
  vol7dFmt: string;
  vol7dRaw: number;
  share: number;
  color: string;
}

export interface WeeklyReport {
  issue: number;
  issueDate: string;
  weekKey: string;
  // metrics
  solPrice: string | null;
  solChange: string | null;
  solanaTvl: string | null;
  tvlChange7d: string | null;
  dexVol7d: string | null;
  fees7d: string | null;
  tpsTotal: string | null;
  tpsUser: string | null;
  tpsPeak: string | null;
  tpsUserPeak: string | null;
  clusterNodes: string | null;
  stakingRatio: string | null;
  epochInfo: { epoch: number; progress: number; slotsRemaining: number; hoursRemaining: number } | null;
  // macro
  ethTvl: string | null;
  solEthRatio: string | null;
  btcDominance: string | null;
  cryptoMarket24h: string | null;
  feeToTvlRatio: string | null;
  tvlVs4wAvg: string | null;
  // analysis
  hotSector: {
    name: string;
    nameZh: string;
    nameJa: string;
    emoji: string;
    momentum: string;
    topProtocol: string;
    rationale: string;
  };
  protocols: ReportProtocol[];
  protocolGainers: ReportProtocol[];
  protocolLosers: ReportProtocol[];
  dexShare: DexShare[];
  dexTotal7d: string | null;
  tvlHistory: Array<{ date: string; tvl: number }>;
  fearGreed: { score: number; label: string; labelEn: string; color: string };
  lst: Record<string, { apy: string; tvl: string } | null>;
  lending: Record<string, string | null>;
  newsItems: string[];
  narrative: { zh: NarrativeSection; en: NarrativeSection; ja: NarrativeSection } | null;
  updatedAt: string;
}

// ─── In-memory cache ──────────────────────────────────────────────────────────

interface NarrativeBundle {
  zh: NarrativeSection;
  en: NarrativeSection;
  ja: NarrativeSection;
}

const narrativeCache = new Map<string, {
  bundle: NarrativeBundle;
  ts: number;
  verdict_en: string;
}>();

// ─── Sector metadata ──────────────────────────────────────────────────────────

const SECTOR_META: Record<string, { zh: string; ja: string; emoji: string }> = {
  "Liquid Staking": { zh: "流動質押", ja: "流動ステーキング", emoji: "🪙" },
  "Dexes":          { zh: "DEX 交易", ja: "DEX取引",          emoji: "📈" },
  "Lending":        { zh: "借貸",     ja: "レンディング",      emoji: "🏦" },
  "Derivatives":    { zh: "衍生品",   ja: "デリバティブ",      emoji: "⚡" },
  "Yield":          { zh: "收益聚合", ja: "利回り集約",        emoji: "💎" },
  "CDP":            { zh: "超額抵押借貸", ja: "CDP",           emoji: "🔐" },
  "Bridge":         { zh: "跨鏈橋",   ja: "ブリッジ",         emoji: "🌉" },
  "RWA":            { zh: "現實資產", ja: "リアルワールドアセット", emoji: "🏛️" },
};

const DEX_COLORS = ["#C9A84C", "#3D7A5C", "#4A7EB5", "#8B5CF6", "#A8293A", "#6B7280"];

// ─── Helper functions ─────────────────────────────────────────────────────────

function getWeekKey(): string {
  const now = new Date();
  const day = now.getUTCDay();
  const diff = day === 0 ? 6 : day - 1;
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() - diff);
  return monday.toISOString().slice(0, 10);
}

function getPrevWeekKey(): string {
  const d = new Date(getWeekKey() + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() - 7);
  return d.toISOString().slice(0, 10);
}

function getIssueNumber(): number {
  const genesis = new Date("2026-04-06T00:00:00Z");
  const monday = new Date(getWeekKey() + "T00:00:00Z");
  const msPerWeek = 7 * 24 * 60 * 60 * 1000;
  const weeksDiff = Math.floor((monday.getTime() - genesis.getTime()) / msPerWeek);
  return Math.max(1, weeksDiff + 1);
}

function getIssueDateStr(): string {
  const weekKey = getWeekKey();
  const d = new Date(weekKey + "T00:00:00Z");
  return d.toLocaleDateString("en-US", {
    month: "long", day: "numeric", year: "numeric", timeZone: "UTC",
  });
}

async function get<T = unknown>(url: string, ms = 10000): Promise<T | null> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": UA },
    });
    return (await res.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(id);
  }
}

async function rpc(method: string, params: unknown[] = [], ms = 10000): Promise<unknown> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch("https://api.mainnet-beta.solana.com", {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": UA },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
      signal: controller.signal,
    });
    const d = (await res.json()) as { result?: unknown };
    return d?.result ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(id);
  }
}

function fmtUsd(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function fmtPct(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

function getLogoUrl(name: string, slug?: string): string {
  const KNOWN: Record<string, string> = {
    Jupiter: "jupiter", Kamino: "kamino", Raydium: "raydium",
    Jito: "jito", Marinade: "marinade", Meteora: "meteora",
    Orca: "orca", Drift: "drift", MarginFi: "marginfi",
    Marginfi: "marginfi", Sanctum: "sanctum", Lifinity: "lifinity",
    Mango: "mango-markets", Phoenix: "phoenix",
  };
  const s = KNOWN[name] ?? slug ?? name.toLowerCase().replace(/[\s.]/g, "-");
  return `https://icons.llamao.fi/icons/protocols/${s}?w=48&h=48`;
}

// ─── News fetcher ─────────────────────────────────────────────────────────────

async function fetchSolanaNews(): Promise<string[]> {
  const results: string[] = [];

  // Source 1: solana.com sitemap-0.xml (SSR XML — sitemap.xml is just an index pointing here)
  try {
    const xml = await fetch("https://solana.com/sitemap-0.xml", {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(8000),
    }).then(r => r.text());
    const allSlugs = [...new Set(
      [...xml.matchAll(/<loc>https:\/\/solana\.com\/news\/([^<]+)<\/loc>/g)]
        .map(m => m[1].trim())
        .filter(s => s.length > 5 && !s.includes("/"))
    )];
    // Prefer slugs that contain the current or previous year (most recent posts)
    const yr = new Date().getFullYear();
    const yearFiltered = allSlugs.filter(s => s.includes(String(yr)) || s.includes(String(yr - 1)));
    const selected = yearFiltered.length >= 2 ? yearFiltered.slice(-4) : allSlugs.slice(-4);
    const titles = selected.map(slug =>
      slug
        .replace(/^\d{1,2}-\d{1,2}-\d{2,4}-/, "")  // strip MM-DD-YY(YY)- date prefix
        .replace(/^\d{4}-/, "")                       // strip YYYY- prefix
        .replace(/-/g, " ")
        .replace(/\b\w/g, l => l.toUpperCase())
    );
    results.push(...titles.map(t => `[Solana] ${t}`));
  } catch { /* ignore */ }

  // Source 2: CoinDesk RSS
  try {
    const xml = await fetch("https://www.coindesk.com/arc/outboundfeeds/rss/?outputType=xml", {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(6000),
    }).then(r => r.text());
    const solKeywords = /solana|SOL\b|phantom|jupiter|jito|raydium|kamino|drift|marinade/i;
    const titles = [...xml.matchAll(/<title>(?:<!\[CDATA\[)?(.+?)(?:\]\]>)?<\/title>/g)]
      .map(m => m[1].trim())
      .slice(1)
      .filter(t => solKeywords.test(t));
    results.push(...titles.slice(0, 3).map(t => `[CoinDesk] ${t}`));
  } catch { /* ignore */ }

  return results.slice(0, 6);
}

// ─── Hot sector detection ─────────────────────────────────────────────────────

function detectHotSector(protocols: ReportProtocol[]): WeeklyReport["hotSector"] {
  const categoryMap = new Map<string, {
    totalTvl: number; totalChange: number; count: number; protocols: ReportProtocol[];
  }>();

  for (const p of protocols) {
    if (!p.category) continue;
    const existing = categoryMap.get(p.category) ?? { totalTvl: 0, totalChange: 0, count: 0, protocols: [] };
    existing.totalTvl += p.tvlRaw;
    existing.totalChange += p.change7d;
    existing.count += 1;
    existing.protocols.push(p);
    categoryMap.set(p.category, existing);
  }

  type CatEntry = { name: string; totalTvl: number; avgChange: number; protocols: ReportProtocol[] };
  const candidates: CatEntry[] = [];
  for (const [name, data] of categoryMap.entries()) {
    if (data.totalTvl < 50_000_000) continue;
    candidates.push({
      name, totalTvl: data.totalTvl,
      avgChange: data.count > 0 ? data.totalChange / data.count : 0,
      protocols: data.protocols,
    });
  }
  candidates.sort((a, b) => b.avgChange - a.avgChange);

  const top = candidates[0] ?? { name: "Dexes", totalTvl: 0, avgChange: 0, protocols: [] };
  const meta = SECTOR_META[top.name] ?? { zh: top.name, ja: top.name, emoji: "📊" };
  const topProto = top.protocols.sort((a, b) => b.tvlRaw - a.tvlRaw)[0];
  const topProtocolName = topProto?.name ?? "Unknown";

  return {
    name: top.name,
    nameZh: meta.zh,
    nameJa: meta.ja,
    emoji: meta.emoji,
    momentum: fmtPct(top.avgChange),
    topProtocol: topProtocolName,
    rationale: `${top.name} leads with ${fmtPct(top.avgChange)} avg 7d TVL momentum, driven by ${topProtocolName} at ${topProto ? fmtUsd(topProto.tvlRaw) : "N/A"}.`,
  };
}

// ─── Two-stage narrative generation ──────────────────────────────────────────

async function generateNarrative(
  report: Omit<WeeklyReport, "narrative">,
  newsItems: string[],
  prevVerdict?: string
): Promise<NarrativeBundle | null> {
  try {
    const dataCtx = buildDataCtx(report, newsItems);

    // ══ Stage 1: Editorial Pass (~400 tokens) ══
    const stage1Prompt = `You are editor-in-chief of a Bloomberg-tier crypto publication. Identify this week's editorial angle.

${dataCtx}
${prevVerdict ? `\nLAST WEEK'S VERDICT: "${prevVerdict}"` : ""}

Return JSON only (no markdown):
{
  "thesis": "Single most counter-intuitive story this week (1 sentence, conclusion first)",
  "whyCounterIntuitive": "Why this contradicts market consensus (1 sentence)",
  "keyTension": "Main contradiction in the data (1 sentence)",
  "riskToWatch": "Specific risk that could invalidate this thesis (1 sentence)",
  "prevVerdictAssessment": ${prevVerdict ? '"Was last week\'s call correct? (1 sentence assessment)"' : "null"}
}`;

    const stage1Res = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 400,
      temperature: 0,
      messages: [{ role: "user", content: stage1Prompt }],
    });

    const s1text = stage1Res.content
      .filter(b => b.type === "text")
      .map(b => (b as { type: "text"; text: string }).text).join("");
    const s1match = s1text.match(/\{[\s\S]*\}/);
    if (!s1match) return null;

    const editorial = JSON.parse(s1match[0]) as {
      thesis: string;
      whyCounterIntuitive: string;
      keyTension: string;
      riskToWatch: string;
      prevVerdictAssessment: string | null;
    };

    // ══ Stage 2: Writing Pass (~3200 tokens) ══
    const stage2Prompt = `You are lead analyst for Solana Ecosystem Weekly — Bloomberg/CoinDesk-tier publication.
Write this week's full report using the editorial framework below.

EDITORIAL FRAMEWORK (from editor-in-chief):
· Core thesis: ${editorial.thesis}
· Why counter-intuitive: ${editorial.whyCounterIntuitive}
· Key tension: ${editorial.keyTension}
· Risk to watch: ${editorial.riskToWatch}
${editorial.prevVerdictAssessment ? `· Last week's verdict assessment: ${editorial.prevVerdictAssessment}` : ""}

══ NARRATIVE ARC (this is ONE article, not six independent sections) ══
· opening: establish the tension — what does the data say that surprises you?
· hotSector + capitalFlow + macroContext: build the case, layer by layer
· riskRadar: the complication — what could make the thesis wrong?
· verdict: the resolution — what should a sophisticated participant do with this?
Every section must connect to the core thesis. Data that doesn't support it must be contextualized, not just listed.
${prevVerdict ? `Open by noting whether last week's verdict proved correct: "${prevVerdict}"` : ""}

══ ABSOLUTE STYLE RULES ══
1. First sentence = conclusion. NEVER start with "This week" / "本週" / "今週" / "In this issue."
2. Data is evidence, not subject. ✗ "DEX volume reached $11B" → ✓ "$11B in DEX activity says traders haven't left."
3. BANNED: "it's worth noting" / "importantly" / "notably" / "interestingly" / "in conclusion" / "as we can see" / "值得注意" / "顯然" / "可以看出" / "the data shows"
4. Rhythm: alternate short punchy sentences (5-8 words) with longer analytical ones.
5. Every section: one observation that challenges the obvious interpretation.
6. Every number change: causal explanation (because / driven by / following / 受…驅動 / 由於).
7. Every section: time comparison (this week vs last week, 7d vs 4-week average where available).
8. TWEETABLE SENTENCE: opening / hotSector / verdict must each contain exactly one sentence ≤20 words that works as a standalone insight worth sharing.
9. capitalFlow: name specific winner protocol with +X% AND loser with -X%. Never vague.
10. verdict: (a) directional call, (b) time window, (c) signal that invalidates this call.
11. catalysts: grounded in RECENT NEWS items below. Format: [Source] event → ecosystem implication.
12. riskRadar: name specific protocols, not categories. "Kamino's X" not "lending sector risk."
13. macroContext: include ETH TVL ratio, BTC dominance %, crypto market 24h change.
14. zh: 繁體中文，《財新》/《彭博中文》金融媒體語氣，非科技文件
15. ja: 正式《日経》風格，用「～とみられる」「～に留まった」「～を受けて」「～が続いている」
DATA NULL RULE: If any field is N/A, reason from surrounding context. Never write "data unavailable."

LIVE DATA:
${dataCtx}

Return ONLY valid JSON (no markdown fences):
{
  "headline": "≤15字中文標題，含論點+關鍵數字，非日期",
  "zh": {
    "opening": "3-4句。句1=核心論點（結論非描述）。句2=為何反直覺。句3=數據支撐（含4週均值對比如有）。句4=指向全文。含一句≤20字可轉發句。",
    "hotSector": "4句。1)結論+動量數字。2)具體因果（利率差/激勵結構/觸發事件）。3)可持續性+逆轉條件。4)反向論點。含一句≤20字可轉發句。",
    "capitalFlow": "3句。贏家協議+7d漲幅%。輸家協議+7d跌幅%。資本路徑和輪動信號含義。",
    "macroContext": "3句。Solana/ETH TVL比率。BTC主導率X%說明當前風險偏好。加密市場24h變化Z%背景下Solana的相對強弱。",
    "riskRadar": "3句。具體協議風險（點名協議+原因）。市場層面觸發條件。本週需監控的一個具體信號。",
    "verdict": "3句。方向性結論（非「值得關注」）。時間窗口（本週/未來兩週）。什麼信號出現代表判斷失效。含一句≤20字可轉發句。",
    "findings": ["5條獨立洞察，每條1句，非數字重述，每條是真正非顯而易見的觀察"],
    "catalysts": ["3條，格式：[來源] 事件描述 → 對Solana生態的具體含義。必須來自RECENT NEWS列表。"]
  },
  "en": {
    "opening": "...", "hotSector": "...", "capitalFlow": "...", "macroContext": "...",
    "riskRadar": "...", "verdict": "...", "findings": ["x5"], "catalysts": ["x3"]
  },
  "ja": {
    "opening": "...", "hotSector": "...", "capitalFlow": "...", "macroContext": "...",
    "riskRadar": "...", "verdict": "...", "findings": ["x5"], "catalysts": ["x3"]
  }
}`;

    const msg = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 3200,
      temperature: 0,
      messages: [{ role: "user", content: stage2Prompt }],
    });

    const text = msg.content
      .filter(b => b.type === "text")
      .map(b => (b as { type: "text"; text: string }).text).join("");
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return null;

    const parsed = JSON.parse(match[0]) as {
      headline: string;
      zh: NarrativeSection; en: NarrativeSection; ja: NarrativeSection;
    };

    // Inject headline into all three languages and validate
    for (const lang of ["zh", "en", "ja"] as const) {
      parsed[lang].headline = parsed.headline;
      const s = parsed[lang];
      if (!s?.opening || !s?.verdict || !s?.macroContext || !s?.riskRadar ||
          !Array.isArray(s.findings) || !Array.isArray(s.catalysts)) {
        return null;
      }
    }

    return { zh: parsed.zh, en: parsed.en, ja: parsed.ja };
  } catch {
    return null;
  }
}

function buildDataCtx(report: Omit<WeeklyReport, "narrative">, newsItems: string[]): string {
  const gainers = report.protocolGainers ?? [];
  const losers  = report.protocolLosers  ?? [];
  return `
WEEK: Issue #${report.issue} — ${report.issueDate}
SOL: ${report.solPrice ?? "N/A"} (24h: ${report.solChange ?? "N/A"})
SOLANA TVL: ${report.solanaTvl ?? "N/A"} (7d: ${report.tvlChange7d ?? "N/A"}) | VS 4-WEEK AVG: ${report.tvlVs4wAvg ?? "N/A"}
ETH TVL: ${report.ethTvl ?? "N/A"} | SOL/ETH RATIO: ${report.solEthRatio ?? "N/A"}
DEX VOLUME (7d): ${report.dexVol7d ?? "N/A"}
PROTOCOL FEES (7d): ${report.fees7d ?? "N/A"} | FEE/TVL EFFICIENCY: ${report.feeToTvlRatio ?? "N/A"}
TPS avg/peak: ${report.tpsTotal ?? "N/A"} / ${report.tpsPeak ?? "N/A"} (user: ${report.tpsUser ?? "N/A"} / ${report.tpsUserPeak ?? "N/A"})
VALIDATOR NODES: ${report.clusterNodes ?? "N/A"}
FEAR/GREED: ${report.fearGreed.score}/100 — ${report.fearGreed.labelEn}
BTC DOMINANCE: ${report.btcDominance ?? "N/A"}
CRYPTO MARKET 24h CHANGE: ${report.cryptoMarket24h ?? "N/A"}

HOT SECTOR: ${report.hotSector.name} ${report.hotSector.emoji} (${report.hotSector.momentum})
TOP PROTOCOL IN SECTOR: ${report.hotSector.topProtocol}

TOP PROTOCOLS BY TVL:
${report.protocols.slice(0, 8).map(p => `  ${p.name} (${p.category}): ${p.tvlFmt} | 7d: ${fmtPct(p.change7d)}`).join("\n")}

PROTOCOL GAINERS (7d TVL): ${gainers.map(p => `${p.name} ${fmtPct(p.change7d)}`).join(", ") || "N/A"}
PROTOCOL LOSERS  (7d TVL): ${losers.map(p => `${p.name} ${fmtPct(p.change7d)}`).join(", ") || "N/A"}

DEX MARKET SHARE (7d vol):
${report.dexShare.map(d => `  ${d.name}: ${d.vol7dFmt} (${(d.share * 100).toFixed(1)}%)`).join("\n")}

LST YIELDS:
${Object.entries(report.lst).map(([k, v]) => `  ${k}: APY=${v?.apy ?? "N/A"}, TVL=${v?.tvl ?? "N/A"}`).join("\n")}

LENDING RATES (Kamino):
${Object.entries(report.lending).map(([k, v]) => `  ${k.replace("kamino_", "").replace("_supply", "")}: ${v ?? "N/A"}`).join("\n")}

RECENT NEWS:
${newsItems.length > 0 ? newsItems.map(n => `  · ${n}`).join("\n") : "  (no news fetched this cycle)"}
`.trim();
}

// ─── Fallback narrative ───────────────────────────────────────────────────────

function buildFallback(
  report: Omit<WeeklyReport, "narrative">,
  newsItems: string[]
): NarrativeBundle {
  const sol    = report.solPrice ?? "N/A";
  const solChg = report.solChange ?? "N/A";
  const tvl    = report.solanaTvl ?? "N/A";
  const tvlChg = report.tvlChange7d ?? "N/A";
  const dex    = report.dexVol7d ?? "N/A";
  const fees   = report.fees7d ?? "N/A";
  const sector = report.hotSector;
  const topProto   = report.protocols[0];
  const secondProto = report.protocols[1];
  const loserProto  = report.protocolLosers?.[0];
  const fearScore  = report.fearGreed.score;
  const headline   = `${sector.nameZh}領跑：Solana TVL ${tvl}，DEX 週量 ${dex}`;

  const fallbackCatalysts = newsItems.length >= 2
    ? newsItems.slice(0, 3).map(n => `${n} → 關注後續對 Solana 生態的影響`)
    : [
        `${sector.topProtocol} 若發布新產品或治理提案，將引發板塊資金二次集中`,
        `SOL 質押收益率變化直接影響 LST 競爭格局，本週需持續監控`,
        `跨鏈橋資金流入量是外部資本進入 Solana 的先行指標`,
      ];

  const zh: NarrativeSection = {
    headline,
    opening: `市場對 Solana 的定價低估了鏈上的真實活躍度。${tvl} 的 TVL（週變化 ${tvlChg}）${report.tvlVs4wAvg ? `，${report.tvlVs4wAvg}` : ""}，說明資金並未撤離，只是在等待催化劑。DEX 週交易量 ${dex}、協議費收入 ${fees}，顯示鏈上真實需求持續運作。情緒指數 ${fearScore}/100 提示的是機會窗口，不是風險信號。`,
    hotSector: `${sector.name}（${sector.nameZh}）以 ${sector.momentum} 的 7 日動能領跑本週所有板塊，資本正在向最高確定性的收益點集中。${sector.topProtocol} 是這波資金流入的核心承載者，受益於其在 ${sector.name} 賽道中的流動性優勢。這類板塊主導趨勢通常持續 2-3 週，直到利差收窄或更大的市場波動打斷節奏。反向論點：強勢板塊往往是即將到來的輪動起點，而不是繼續追入的信號。`,
    capitalFlow: `${topProto ? `${topProto.name} 以 ${topProto.tvlFmt} TVL 穩居龍頭，7 日變化 ${fmtPct(topProto.change7d)}，是本週的資金錨。` : ""}${loserProto ? `${loserProto.name}（7d ${fmtPct(loserProto.change7d)}）是主要資金流出方，資本正在從這裡流向 ${sector.name} 板塊。` : secondProto ? `${secondProto.name}（${secondProto.tvlFmt}，${fmtPct(secondProto.change7d)}）緊隨其後。` : ""}這種輪動結構說明市場在做選擇，而非全面撤退。`,
    macroContext: `Solana TVL ${tvl} 佔以太坊生態${report.solEthRatio ? `約 ${report.solEthRatio}` : "個位數百分比"}，兩者資本規模差距仍大，但 Solana 的資本效率比（fees/TVL）正在縮小差距。BTC 主導率${report.btcDominance ? ` ${report.btcDominance}` : "偏高"}，反映市場風險偏好尚未完全打開，altcoin 資金仍受壓制。加密市場${report.cryptoMarket24h ? ` 24h 變化 ${report.cryptoMarket24h}，` : "整體震盪背景下，"}Solana 鏈上活躍度呈現相對強勢。`,
    riskRadar: `${topProto?.name ?? "頭部協議"} TVL 集中度過高是本週首要結構性風險，單一協議主導意味著系統性衝擊的傳導路徑更短。${sector.momentum.startsWith("+") ? `${sector.name} 板塊連續上漲後，均值回歸壓力將在 2-3 週內顯現，需警惕快速解鎖或流動性遷移。` : `${sector.name} 板塊動能轉弱，需觀察是否觸發更大範圍的板塊輪動。`}本週重點關注 ${sector.topProtocol} 的大額鏈上資金異動，這是最早的風險兌現信號。`,
    verdict: `在 ${tvl} TVL 支撐下，Solana DeFi 進入結構性積累階段，而非週期頂部。未來兩週聚焦 ${sector.topProtocol} 和 ${sector.name} 板塊，做多鏈上活躍度，做空「生態停滯」的市場敘事。若 TVL 跌破 ${report.tvlVs4wAvg ? "4週均值" : "當前水位"}10% 或 DEX 量連續兩週萎縮，則這個判斷失效。`,
    findings: [
      `${sol} 的 SOL 價格低估了鏈上活躍度——TVL 與價格的背離是歷史上最可靠的買入信號之一`,
      `${sector.name} 板塊吸收的不只是本地資金，跨鏈遷移資金佔比值得追蹤`,
      `${report.clusterNodes ? `${report.clusterNodes} 個驗證節點的分散化程度，是 Solana 抗審查能力的底層保障` : "驗證節點的穩定增長是網路韌性的最被忽視的指標"}`,
      `DEX 市佔向頭部集中是效率優化的結果，不應與壟斷風險混為一談`,
      `借貸市場利率${report.lending["kamino_usdc_supply"] ? `（USDC 供應年化 ${report.lending["kamino_usdc_supply"]}）` : ""}反映的是真實槓桿需求，是生態健康度的滯後指標`,
    ],
    catalysts: fallbackCatalysts,
  };

  const en: NarrativeSection = {
    headline,
    opening: `Solana is priced for stagnation. The on-chain data won't cooperate. ${tvl} in TVL (${tvlChg} over 7 days${report.tvlVs4wAvg ? `, ${report.tvlVs4wAvg}` : ""}) paired with ${dex} in weekly DEX volume isn't the signature of an ecosystem in retreat. Fear/greed at ${fearScore}/100 is where conviction gets built, not where it ends.`,
    hotSector: `${sector.name} ${sector.emoji} is the week's conviction trade at ${sector.momentum} average 7-day momentum — capital is concentrating, not diversifying. ${sector.topProtocol} is the primary beneficiary, driven by its liquidity structural advantage within the sector. These sector-dominant trends typically run 2-3 weeks before yield compression or macro disruption interrupts the flow. Counter-thesis: strong sector performance is often a rotation signal, not a continuation one.`,
    capitalFlow: `${topProto ? `${topProto.name} commands ${topProto.tvlFmt} in TVL at ${fmtPct(topProto.change7d)} over 7 days — the liquidity anchor this week. ` : ""}${loserProto ? `${loserProto.name} at ${fmtPct(loserProto.change7d)} is the primary outflow source, with capital rotating toward ${sector.name}. ` : secondProto ? `${secondProto.name} at ${secondProto.tvlFmt} (${fmtPct(secondProto.change7d)}) holds the second position. ` : ""}This rotation structure signals selective conviction, not broad capitulation.`,
    macroContext: `Solana TVL at ${tvl} represents${report.solEthRatio ? ` ${report.solEthRatio} of Ethereum's ecosystem` : " a fraction of Ethereum's ecosystem"} — the capital gap remains wide, but Solana's fee-to-TVL efficiency is closing it. BTC dominance at ${report.btcDominance ?? "elevated levels"} signals risk appetite is still constrained, keeping altcoin capital flows compressed. Against a crypto market ${report.cryptoMarket24h ? `moving ${report.cryptoMarket24h} in 24h` : "in consolidation"}, Solana's on-chain metrics are showing relative strength.`,
    riskRadar: `${topProto?.name ?? "The top protocol"}'s TVL concentration is the week's primary structural risk — single-protocol dominance shortens systemic contagion paths. ${sector.momentum.startsWith("+") ? `${sector.name}'s momentum run sets up a mean-reversion scenario within 2-3 weeks as yield compression begins.` : `${sector.name}'s weakening momentum could trigger broader sector rotation if it accelerates.`} Watch ${sector.topProtocol} for large on-chain outflows this week — it's the earliest risk materialization signal.`,
    verdict: `${tvl} in TVL is a base, not a ceiling. The two-week playbook: position around ${sector.topProtocol} and ${sector.name} sector strength, fade the "Solana stagnation" narrative. Invalidation signal: TVL breaks ${report.tvlVs4wAvg ? "below 4-week average" : "down 10% from current"} or DEX volume contracts for two consecutive weeks.`,
    findings: [
      `${sol} SOL understates ecosystem momentum — TVL/price divergence is historically one of the strongest accumulation signals`,
      `${sector.name} momentum at ${sector.momentum} is consistent with institutional reallocation, not retail rotation`,
      `${report.clusterNodes ? `${report.clusterNodes} validator nodes represent structural decentralization most competing L1s cannot match` : "Validator node growth remains the most underreported network health indicator"}`,
      `DEX volume concentration is a market efficiency feature, not a centralization risk`,
      `Lending rates${report.lending["kamino_usdc_supply"] ? ` (USDC supply APY ${report.lending["kamino_usdc_supply"]})` : ""} reflect genuine leverage demand — a lagging indicator of ecosystem conviction`,
    ],
    catalysts: newsItems.length >= 2
      ? newsItems.slice(0, 3).map(n => `${n} → watch for downstream impact on Solana ecosystem positioning`)
      : [
          `${sector.topProtocol} governance or product announcement would trigger a second TVL inflow wave into ${sector.name}`,
          `SOL staking yield compression will reshape LST competitive dynamics — monitor protocol responses`,
          `Cross-chain bridge inflows are the leading indicator for external capital entering Solana`,
        ],
  };

  const ja: NarrativeSection = {
    headline,
    opening: `市場の評価とオンチェーンの実態が乖離している。Solana の TVL は ${tvl}（7 日変化: ${tvlChg}${report.tvlVs4wAvg ? `、${report.tvlVs4wAvg}` : ""}）に達しており、資金流出ではなく待機状態にあるとみられる。DEX 週次取引量 ${dex}、プロトコル手数料 ${fees} は実需の継続を裏付けている。恐怖・強欲指数 ${fearScore}/100 はリスクではなく機会を示唆している。`,
    hotSector: `${sector.name}（${sector.nameJa}）は今週 ${sector.momentum} の 7 日モメンタムで全セクターをリードしており、資本が確実性の高い収益源に集中する動きが続いている。${sector.topProtocol} への資金集中がその中心にあり、セクター内の流動性優位性を受けて資金流入が加速した。こうしたセクター主導の動きは通常 2〜3 週間持続するとみられるが、利回り圧縮が進むと局面転換のリスクが高まる。`,
    capitalFlow: `${topProto ? `${topProto.name} は ${topProto.tvlFmt} の TVL で首位を維持し、7 日変化率は ${fmtPct(topProto.change7d)} となっている。` : ""}${loserProto ? `${loserProto.name}（7d ${fmtPct(loserProto.change7d)}）が主な資金流出元となっており、${sector.name} セクターへの移動が確認される。` : secondProto ? `${secondProto.name}（${secondProto.tvlFmt}、${fmtPct(secondProto.change7d)}）が後を追う。` : ""}この輪換構造は全面撤退ではなく選択的な資金配分を示している。`,
    macroContext: `Solana の TVL ${tvl} はイーサリアムエコシステムの${report.solEthRatio ? `約 ${report.solEthRatio}` : "一部"}に留まっており、資本規模の差は依然として大きい。BTC 主導率${report.btcDominance ? ` ${report.btcDominance}` : "の高止まり"}はリスク選好が十分に回復していないことを示しており、アルトコインへの資金流入は抑制されたままとみられる。暗号資産市場が${report.cryptoMarket24h ? ` 24h で ${report.cryptoMarket24h} 変化する` : "全体として横ばいの"}中、Solana のオンチェーン指標は相対的な底堅さを示している。`,
    riskRadar: `${topProto?.name ?? "主要プロトコル"}への TVL 集中が今週最大の構造的リスクであり、単一プロトコルへの依存は連鎖的な影響を受けやすい環境を生む。${sector.momentum.startsWith("+") ? `${sector.name} セクターの上昇継続後、2〜3 週以内に平均回帰圧力が顕在化するとみられる。` : `${sector.name} のモメンタム低下が続く場合、より広範なセクター輪換が始まる可能性がある。`}${sector.topProtocol} における大口資金の異常流出が今週最も注視すべきリスク顕在化シグナルとなる。`,
    verdict: `TVL ${tvl} は天井ではなく底値圏であり、Solana DeFi は構造的な蓄積局面にあるとみられる。今後 2 週間は ${sector.topProtocol} を中心とした ${sector.name} セクターへのポジション構築が合理的な戦術となる。TVL が${report.tvlVs4wAvg ? "4週平均を" : "現水準から"} 10% 超下落するか、DEX 取引量が 2 週連続で縮小した場合、このシナリオは見直しが必要となる。`,
    findings: [
      `${sol} の SOL 価格は TVL との乖離という最も信頼性の高い蓄積シグナルを織り込んでいない`,
      `${sector.name} の ${sector.momentum} モメンタムは機関投資家のリアロケーションと整合的な動きを示す`,
      `${report.clusterNodes ? `バリデータノード数 ${report.clusterNodes} は他の L1 に対する分散化優位性を示す` : "バリデータノードの増加は最も過小評価されているネットワーク健全性指標の一つである"}`,
      `DEX 取引量の集中化は市場効率化の結果であり、中央集権リスクとは区別して分析すべきである`,
      `レンディング金利${report.lending["kamino_usdc_supply"] ? `（USDC 供給年利 ${report.lending["kamino_usdc_supply"]}）` : ""}は実需レバレッジを反映しており、エコシステム信頼度の遅行指標として機能する`,
    ],
    catalysts: newsItems.length >= 2
      ? newsItems.slice(0, 3).map(n => `${n} → Solana エコシステムへの波及効果に注目`)
      : [
          `${sector.topProtocol} によるガバナンス提案または新製品発表は ${sector.name} セクターへの追加資金流入を誘発する可能性がある`,
          `SOL ステーキング利回りの変動は LST 競争構造を直接変化させるため、今週の動向を注視する必要がある`,
          `クロスチェーンブリッジへの資金流入は Solana への外部資本流入の先行指標として機能する`,
        ],
  };

  return { zh, en, ja };
}

// ─── Main GET handler ─────────────────────────────────────────────────────────

export async function GET() {
  const weekKey   = getWeekKey();
  const issue     = getIssueNumber();
  const issueDate = getIssueDateStr();

  type PoolRow = { project: string; symbol: string; tvlUsd: number; apy: number; chain: string };
  type LlamaProtocol = { name: string; slug: string; tvl: number; change_7d?: number; category?: string; chains?: string[] };
  type LlamaDexProtocol = { name: string; slug?: string; total7d?: number; displayName?: string };
  type LlamaDexOverview = { total7d?: number; protocols?: LlamaDexProtocol[] };
  type LlamaChain = { name: string; tvl: number };
  type LlamaHistoryPoint = { date: number; tvl: number };
  type PerformanceSample = { numTransactions: number; numNonVoteTransactions: number; samplePeriodSecs: number };
  type CoinGeckoGlobal = { data: { market_cap_percentage: { btc: number }; market_cap_change_percentage_24h_usd: number } };
  type AlternativeFng = { data: Array<{ value: string; value_classification: string }> };
  type StakewizOverall = { total_active_stake_sol?: number; total_supply_sol?: number };
  type EpochInfoResult = { epoch: number; slotIndex: number; slotsInEpoch: number };

  // ── Parallel fetches ──────────────────────────────────────────────────────
  const [
    solPriceRaw, solChangeRaw,
    llamaChains, llamaDexRaw, llamaFeesRaw,
    llamaProtocolsRaw, tvlHistoryRaw,
    tpsRaw, clusterNodesRaw,
    yieldsRaw, individualTvls,
    coinGeckoGlobal, alternativeFng,
    newsItems,
    epochInfoRaw, stakewizRaw,
  ] = await Promise.all([
    get<{ coins?: { "coingecko:solana"?: { price?: number } } }>(
      "https://coins.llama.fi/prices/current/coingecko:solana?searchWidth=4h"
    ),
    get<{ coins?: { "coingecko:solana"?: number } }>(
      `https://coins.llama.fi/percentage/coingecko:solana?timestamp=${Math.floor(Date.now() / 1000)}&lookForward=false&period=24h`
    ),
    get<LlamaChain[]>("https://api.llama.fi/v2/chains"),
    get<LlamaDexOverview>(
      "https://api.llama.fi/overview/dexs/solana?excludeTotalDataChart=true&excludeTotalDataChartBreakdown=true&dataType=dailyVolume"
    ),
    get<{ total7d?: number }>(
      "https://api.llama.fi/overview/fees/solana?excludeTotalDataChartBreakdown=true&excludeTotalDataChart=true&dataType=dailyFees"
    ),
    get<LlamaProtocol[]>("https://api.llama.fi/protocols", 15000),
    get<LlamaHistoryPoint[]>("https://api.llama.fi/v2/historicalChainTvl/Solana", 12000),
    rpc("getRecentPerformanceSamples", [60]),
    rpc("getClusterNodes"),
    get<{ data?: PoolRow[] }>("https://yields.llama.fi/pools", 12000),
    Promise.all([
      get<number>("https://api.llama.fi/tvl/kamino"),
      get<number>("https://api.llama.fi/tvl/jito"),
      get<number>("https://api.llama.fi/tvl/raydium"),
      get<number>("https://api.llama.fi/tvl/marinade"),
      get<number>("https://api.llama.fi/tvl/meteora"),
      get<number>("https://api.llama.fi/tvl/orca"),
      get<number>("https://api.llama.fi/tvl/drift"),
      get<number>("https://api.llama.fi/tvl/jupiter"),
    ]),
    get<CoinGeckoGlobal>("https://api.coingecko.com/api/v3/global", 8000),
    get<AlternativeFng>("https://api.alternative.me/fng/?limit=1", 6000),
    fetchSolanaNews(),
    rpc("getEpochInfo"),
    get<StakewizOverall>("https://api.stakewiz.com/overall", 6000),
  ]);

  // ── SOL price ──────────────────────────────────────────────────────────────
  let solUsd: number | null = null;
  let solChange24h: number | null = null;
  try {
    solUsd = solPriceRaw?.coins?.["coingecko:solana"]?.price ?? null;
    solChange24h = solChangeRaw?.coins?.["coingecko:solana"] ?? null;
  } catch { /* ignore */ }

  // ── Chain TVLs ─────────────────────────────────────────────────────────────
  let solanaTvlRaw: number | null = null;
  let ethTvlRaw: number | null = null;
  try {
    solanaTvlRaw = llamaChains?.find(c => c.name === "Solana")?.tvl ?? null;
    ethTvlRaw    = llamaChains?.find(c => c.name === "Ethereum")?.tvl ?? null;
  } catch { /* ignore */ }

  // ── Macro: CoinGecko Global ────────────────────────────────────────────────
  let btcDominanceRaw: number | null = null;
  let cryptoMarket24hRaw: number | null = null;
  try {
    btcDominanceRaw   = coinGeckoGlobal?.data?.market_cap_percentage?.btc ?? null;
    cryptoMarket24hRaw = coinGeckoGlobal?.data?.market_cap_change_percentage_24h_usd ?? null;
  } catch { /* ignore */ }

  // ── Fear/Greed (real index from alternative.me) ───────────────────────────
  let fgScore = 50;
  let fgClassification = "Neutral";
  try {
    const fngVal = alternativeFng?.data?.[0];
    if (fngVal) {
      fgScore = parseInt(fngVal.value, 10);
      fgClassification = fngVal.value_classification;
    } else {
      // Fallback: compute from SOL price change + TVL change
      if (solChange24h !== null) fgScore += Math.max(-15, Math.min(15, solChange24h * 3));
    }
  } catch { /* ignore */ }
  fgScore = Math.max(10, Math.min(90, Math.round(fgScore)));

  type FearGreedLevel = { min: number; label: string; labelEn: string; color: string };
  const FG_LEVELS: FearGreedLevel[] = [
    { min: 75, label: "極度貪婪", labelEn: "Extreme Greed", color: "#16a34a" },
    { min: 60, label: "貪婪",     labelEn: "Greed",          color: "#65a30d" },
    { min: 45, label: "中性",     labelEn: "Neutral",        color: "#ca8a04" },
    { min: 30, label: "恐懼",     labelEn: "Fear",           color: "#ea580c" },
    { min: 0,  label: "極度恐懼", labelEn: "Extreme Fear",   color: "#dc2626" },
  ];
  // Use alternative.me classification if available
  const fgLevelByClass: Record<string, FearGreedLevel> = {
    "Extreme Greed": FG_LEVELS[0], "Greed": FG_LEVELS[1],
    "Neutral": FG_LEVELS[2], "Fear": FG_LEVELS[3], "Extreme Fear": FG_LEVELS[4],
  };
  const fgLevel = fgLevelByClass[fgClassification]
    ?? FG_LEVELS.find(l => fgScore >= l.min)
    ?? FG_LEVELS[FG_LEVELS.length - 1];
  const fearGreed = { score: fgScore, label: fgLevel.label, labelEn: fgLevel.labelEn, color: fgLevel.color };

  // ── DEX volume ──────────────────────────────────────────────────────────────
  let dexVol7dRaw: number | null = null;
  let dexProtos: LlamaDexProtocol[] = [];
  try {
    dexVol7dRaw = llamaDexRaw?.total7d ?? null;
    dexProtos   = llamaDexRaw?.protocols ?? [];
  } catch { /* ignore */ }

  // ── Protocol fees ──────────────────────────────────────────────────────────
  let fees7dRaw: number | null = null;
  try { fees7dRaw = llamaFeesRaw?.total7d ?? null; } catch { /* ignore */ }

  // ── Top protocols list ────────────────────────────────────────────────────
  let protocols: ReportProtocol[] = [];
  try {
    const all = llamaProtocolsRaw ?? [];
    const solana = all.filter(p => p.chains?.includes("Solana") && typeof p.tvl === "number" && p.tvl > 0);
    solana.sort((a, b) => (b.tvl ?? 0) - (a.tvl ?? 0));
    protocols = solana.slice(0, 12).map(p => ({
      name: p.name, slug: p.slug,
      tvlFmt: fmtUsd(p.tvl), tvlRaw: p.tvl,
      change7d: p.change_7d ?? 0,
      category: p.category ?? "Other",
      logoUrl: getLogoUrl(p.name, p.slug),
    }));
  } catch { /* ignore */ }

  // ── TVL history + 4-week average ──────────────────────────────────────────
  let tvlHistory: Array<{ date: string; tvl: number }> = [];
  let tvlChange7dRaw: number | null = null;
  let tvl4wAvg: number | null = null;
  try {
    const hist = tvlHistoryRaw ?? [];
    const slice = hist.slice(-30);
    tvlHistory = slice.map(p => ({ date: new Date(p.date * 1000).toISOString().slice(0, 10), tvl: p.tvl }));
    if (slice.length >= 7) {
      const latest = slice[slice.length - 1].tvl;
      const prev7  = slice[slice.length - 7].tvl;
      if (prev7 > 0) tvlChange7dRaw = ((latest - prev7) / prev7) * 100;
    }
    if (hist.length >= 28) {
      const last28 = hist.slice(-28);
      tvl4wAvg = last28.reduce((sum, p) => sum + p.tvl, 0) / 28;
    }
  } catch { /* ignore */ }

  // ── DEX share ──────────────────────────────────────────────────────────────
  let dexShare: DexShare[] = [];
  try {
    const sorted = [...dexProtos]
      .filter(p => typeof p.total7d === "number" && (p.total7d ?? 0) > 0)
      .sort((a, b) => (b.total7d ?? 0) - (a.total7d ?? 0));
    const top5  = sorted.slice(0, 5);
    const total = sorted.reduce((acc, p) => acc + (p.total7d ?? 0), 0);
    dexShare = top5.map((p, i) => ({
      name: p.displayName ?? p.name,
      vol7dFmt: fmtUsd(p.total7d ?? 0),
      vol7dRaw: p.total7d ?? 0,
      share: total > 0 ? (p.total7d ?? 0) / total : 0,
      color: DEX_COLORS[i] ?? DEX_COLORS[DEX_COLORS.length - 1],
    }));
  } catch { /* ignore */ }

  // ── TPS ────────────────────────────────────────────────────────────────────
  let tpsTotal: number | null = null, tpsUser: number | null = null;
  let tpsPeak: number | null = null,  tpsUserPeak: number | null = null;
  try {
    const samples = tpsRaw as PerformanceSample[] | null;
    if (samples?.length) {
      const totals = samples.map(s => s.numTransactions / s.samplePeriodSecs);
      const users  = samples.map(s => s.numNonVoteTransactions / s.samplePeriodSecs);
      tpsTotal    = Math.round(totals.reduce((a, b) => a + b, 0) / totals.length);
      tpsUser     = Math.round(users.reduce((a, b) => a + b, 0) / users.length);
      tpsPeak     = Math.round(Math.max(...totals));
      tpsUserPeak = Math.round(Math.max(...users));
    }
  } catch { /* ignore */ }

  // ── Cluster nodes ──────────────────────────────────────────────────────────
  let clusterNodes: number | null = null;
  try { clusterNodes = (clusterNodesRaw as unknown[] | null)?.length ?? null; } catch { /* ignore */ }

  // ── Epoch info ────────────────────────────────────────────────────────────
  let epochInfo: WeeklyReport["epochInfo"] = null;
  try {
    const ei = epochInfoRaw as EpochInfoResult | null;
    if (ei && ei.slotsInEpoch > 0) {
      const progress = Math.round((ei.slotIndex / ei.slotsInEpoch) * 100);
      const slotsRemaining = ei.slotsInEpoch - ei.slotIndex;
      // Solana produces ~2 slots/sec on average
      const hoursRemaining = Math.round(slotsRemaining / 2 / 3600);
      epochInfo = { epoch: ei.epoch, progress, slotsRemaining, hoursRemaining };
    }
  } catch { /* ignore */ }

  // ── Staking ratio ─────────────────────────────────────────────────────────
  let stakingRatio: string | null = null;
  try {
    const sw = stakewizRaw as StakewizOverall | null;
    if (sw?.total_active_stake_sol && sw?.total_supply_sol && sw.total_supply_sol > 0) {
      const pct = (sw.total_active_stake_sol / sw.total_supply_sol) * 100;
      stakingRatio = `${pct.toFixed(1)}%`;
    }
  } catch { /* ignore */ }

  // ── LST yields ────────────────────────────────────────────────────────────
  const lstMap: Record<string, { apy: string; tvl: string } | null> = {};
  try {
    const pools  = yieldsRaw?.data ?? [];
    const solana = pools.filter(p => p.chain === "Solana");
    const lstTargets: Array<[string, string]> = [
      ["marinade-liquid-staking", "mSOL"],
      ["jito-liquid-staking",     "jitoSOL"],
      ["jupiter-staked-sol",      "JUPSOL"],
      ["binance-staked-sol",      "BNSOL"],
      ["phantom-sol",             "PSOL"],
    ];
    for (const [proj, key] of lstTargets) {
      const pool = solana.find(p => p.project === proj);
      lstMap[key] = pool ? { apy: `${pool.apy.toFixed(2)}%`, tvl: fmtUsd(pool.tvlUsd) } : null;
    }
  } catch { /* ignore */ }

  // ── Kamino lending rates ──────────────────────────────────────────────────
  const lendMap: Record<string, string | null> = {};
  try {
    const pools  = yieldsRaw?.data ?? [];
    const kamino = pools.filter(p => p.project === "kamino-lend" && p.chain === "Solana");
    for (const asset of ["USDC", "SOL", "USDT"]) {
      const pool = kamino.find(p => p.symbol === asset);
      lendMap[`kamino_${asset.toLowerCase()}_supply`] = pool ? `${pool.apy.toFixed(2)}%` : null;
    }
  } catch { /* ignore */ }

  // ── Individual TVLs (augment protocols list if sparse) ────────────────────
  const [kaminoTvl, jitoTvl, raydiumTvl, marinadeTvl, meteoraTvl, orcaTvl, driftTvl, jupiterTvl] =
    individualTvls.map(v => (typeof v === "number" ? v : null));

  if (protocols.length < 8) {
    const known = [
      { name: "Kamino",   slug: "kamino",   tvl: kaminoTvl,   category: "Lending"        },
      { name: "Jito",     slug: "jito",     tvl: jitoTvl,     category: "Liquid Staking" },
      { name: "Raydium",  slug: "raydium",  tvl: raydiumTvl,  category: "Dexes"          },
      { name: "Marinade", slug: "marinade", tvl: marinadeTvl, category: "Liquid Staking" },
      { name: "Meteora",  slug: "meteora",  tvl: meteoraTvl,  category: "Dexes"          },
      { name: "Orca",     slug: "orca",     tvl: orcaTvl,     category: "Dexes"          },
      { name: "Drift",    slug: "drift",    tvl: driftTvl,    category: "Derivatives"    },
      { name: "Jupiter",  slug: "jupiter",  tvl: jupiterTvl,  category: "Dexes"          },
    ];
    for (const k of known) {
      if (k.tvl !== null && !protocols.some(p => p.slug === k.slug)) {
        protocols.push({
          name: k.name, slug: k.slug,
          tvlFmt: fmtUsd(k.tvl), tvlRaw: k.tvl,
          change7d: 0, category: k.category,
          logoUrl: getLogoUrl(k.name, k.slug),
        });
      }
    }
    protocols.sort((a, b) => b.tvlRaw - a.tvlRaw);
  }

  // ── Protocol gainers / losers ─────────────────────────────────────────────
  const protocolGainers = [...protocols].sort((a, b) => b.change7d - a.change7d).slice(0, 3);
  const protocolLosers  = [...protocols].sort((a, b) => a.change7d - b.change7d).slice(0, 3);

  // ── Computed macro fields ─────────────────────────────────────────────────
  const solEthRatio = (solanaTvlRaw && ethTvlRaw && ethTvlRaw > 0)
    ? `${(solanaTvlRaw / ethTvlRaw * 100).toFixed(1)}% of ETH`
    : null;

  const feeToTvlRatio = (fees7dRaw && solanaTvlRaw && solanaTvlRaw > 0)
    ? `${(fees7dRaw / solanaTvlRaw * 100).toFixed(3)}%`
    : null;

  const tvlVs4wAvg = (solanaTvlRaw && tvl4wAvg && tvl4wAvg > 0)
    ? `${((solanaTvlRaw - tvl4wAvg) / tvl4wAvg * 100).toFixed(1)}% vs 4-week avg (${fmtUsd(tvl4wAvg)})`
    : null;

  // ── Hot sector ────────────────────────────────────────────────────────────
  const hotSector = detectHotSector(protocols);

  // ── Assemble report base ──────────────────────────────────────────────────
  const reportBase: Omit<WeeklyReport, "narrative"> = {
    issue, issueDate, weekKey,
    solPrice:     solUsd       !== null ? `$${solUsd.toFixed(2)}`      : null,
    solChange:    solChange24h !== null ? fmtPct(solChange24h)         : null,
    solanaTvl:    solanaTvlRaw !== null ? fmtUsd(solanaTvlRaw)         : null,
    tvlChange7d:  tvlChange7dRaw !== null ? fmtPct(tvlChange7dRaw)     : null,
    dexVol7d:     dexVol7dRaw !== null ? fmtUsd(dexVol7dRaw)           : null,
    fees7d:       fees7dRaw   !== null ? fmtUsd(fees7dRaw)             : null,
    tpsTotal:     tpsTotal    !== null ? tpsTotal.toLocaleString()      : null,
    tpsUser:      tpsUser     !== null ? tpsUser.toLocaleString()       : null,
    tpsPeak:      tpsPeak     !== null ? tpsPeak.toLocaleString()       : null,
    tpsUserPeak:  tpsUserPeak !== null ? tpsUserPeak.toLocaleString()   : null,
    clusterNodes: clusterNodes !== null ? clusterNodes.toLocaleString() : null,
    stakingRatio,
    epochInfo,
    ethTvl:       ethTvlRaw   !== null ? fmtUsd(ethTvlRaw)             : null,
    solEthRatio,
    btcDominance:    btcDominanceRaw   !== null ? `${btcDominanceRaw.toFixed(1)}%`   : null,
    cryptoMarket24h: cryptoMarket24hRaw !== null ? fmtPct(cryptoMarket24hRaw)        : null,
    feeToTvlRatio,
    tvlVs4wAvg,
    hotSector,
    protocols,
    protocolGainers,
    protocolLosers,
    dexShare,
    dexTotal7d:   dexVol7dRaw !== null ? fmtUsd(dexVol7dRaw) : null,
    tvlHistory,
    fearGreed,
    lst:     lstMap,
    lending: lendMap,
    newsItems: newsItems ?? [],
    updatedAt: new Date().toISOString(),
  };

  // ── Narrative (24h cache) ─────────────────────────────────────────────────
  const NOW    = Date.now();
  const MS_24H = 24 * 60 * 60 * 1000;
  const cached = narrativeCache.get(weekKey);

  let narrative: NarrativeBundle | null = null;
  if (cached && NOW - cached.ts < MS_24H) {
    narrative = cached.bundle;
  } else {
    const prevVerdict = narrativeCache.get(getPrevWeekKey())?.verdict_en;
    narrative = await generateNarrative(reportBase, newsItems ?? [], prevVerdict);
    if (!narrative) {
      narrative = buildFallback(reportBase, newsItems ?? []);
    }
    narrativeCache.set(weekKey, {
      bundle: narrative,
      ts: NOW,
      verdict_en: narrative.en.verdict,
    });
  }

  const report: WeeklyReport = { ...reportBase, narrative };
  return NextResponse.json(report);
}
