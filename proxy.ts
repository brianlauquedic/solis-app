/**
 * Sakura — Anti-Crawler & Rate-Limit Middleware (v3)
 *
 * Layered defense in execution order:
 *   1. Banned IP instant block (honeypot triggered)
 *   2. Honeypot path detection → ban IP + 404
 *   3. Suspicious request pattern detection (injection, traversal, anomalies)
 *   4. Known bot/crawler User-Agent block (32+ patterns)
 *   5. Header fingerprint anomaly scoring (missing browser headers)
 *   6. Tight per-endpoint rate limits — Redis (distributed) or in-memory fallback
 *   7. General sliding-window rate limit — Redis (distributed) or in-memory fallback
 *   8. Short UA block for page routes (headless browsers)
 *   9. Security response headers on all responses
 *
 * Redis mode (set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN):
 *   → Rate limits are shared across ALL Vercel function instances.
 *   → Sybil / multi-instance bypass is closed.
 *   → bannedIps and replay Sets are still in-memory (per-instance), but
 *     rate limiting — the critical DoS/abuse defence — is now distributed.
 *
 * Fallback mode (env vars not set):
 *   → In-memory Maps/Sets as before. Works for dev and single-instance demo.
 */

import { NextRequest, NextResponse } from "next/server";
import { getDistributedLimiter, getGeneralLimiter } from "@/lib/redis";

// ── 1. Banned IP set (honeypot-triggered, session-scoped) ─────────
// In-memory: bans persist within one instance. Acceptable — most scanners
// hit the same instance in a session. Distributed ban list needs Redis + KV.
const bannedIps = new Set<string>();

// ── Bot User-Agent patterns ───────────────────────────────────────
const BOT_UA_PATTERNS = [
  /bot/i, /crawl/i, /spider/i, /scraper/i,
  /slurp/i, /baidu/i, /yandex/i, /sogou/i,
  /exabot/i, /facebot/i, /ia_archiver/i,
  /python-requests/i, /python-urllib/i, /pycurl/i,
  /axios\/0\./i, /go-http-client/i, /java\//i,
  /curl\//i, /wget\//i, /libwww/i, /httpie/i,
  /headless/i, /phantomjs/i, /puppeteer/i, /playwright/i,
  /selenium/i, /webdriver/i, /mechanize/i,
  /scrapy/i, /beautifulsoup/i, /aiohttp/i,
  /gptbot/i, /chatgpt/i, /openai/i, /anthropic-ai/i, /claude-web/i,
  /ccbot/i, /common-crawl/i, /dataprovider/i,
  /semrush/i, /ahrefs/i, /mj12bot/i, /dotbot/i,
  /nmap/i, /masscan/i, /zgrab/i, /nuclei/i,
  /dataforseo/i, /serpstat/i, /majestic/i,
];

// ── Header fingerprint scoring ────────────────────────────────────
const FINGERPRINT_BLOCK_SCORE = 60;

function headerFingerprintScore(req: NextRequest): number {
  let score = 0;
  const ua  = req.headers.get("user-agent") ?? "";
  const acc = req.headers.get("accept") ?? "";
  const lng = req.headers.get("accept-language") ?? "";
  const enc = req.headers.get("accept-encoding") ?? "";

  if (!lng) score += 30;
  if (!acc) score += 20;
  if (acc && !acc.includes("text/html") && !acc.includes("*/*")) score += 10;
  if (!enc) score += 15;
  if (/^(python|node|ruby|php|go|java|rust|dart)/i.test(ua)) score += 40;
  if (ua.length > 0 && ua.length < 20) score += 20;
  const fwd = req.headers.get("x-forwarded-for") ?? "";
  if (fwd.split(",").length > 4) score += 15;

  return score;
}

// ── Suspicious request patterns ───────────────────────────────────

function isSuspiciousRequest(req: NextRequest, pathname: string): boolean {
  // Path traversal — ../, ..\, %2e%2e, %2E%2E, double-encoded, mixed
  if (/\.\.(\/|\\|%2[fF]|%5[cC])/.test(pathname)) return true;
  if (/%252[eE]%252[eE]/.test(pathname)) return true;
  if (pathname.includes("%2e%2e") || pathname.includes("%2E%2E")) return true;
  // Null bytes
  if (pathname.includes("\0") || pathname.includes("%00")) return true;
  // SQL/NoSQL injection probes
  const raw = req.nextUrl.toString();
  if (/(\bUNION\b|\bSELECT\b|\bDROP TABLE\b|;\s*DROP|--\s)/i.test(raw)) return true;
  // XSS probes
  if (/<script|javascript:|onerror=/i.test(raw)) return true;
  // Excessively long query string
  if (req.nextUrl.search.length > 2000) return true;
  // JSON content-type on GET
  const ct = req.headers.get("content-type") ?? "";
  if (req.method === "GET" && ct.includes("application/json")) return true;
  // Cross-origin POST: block if EITHER header is present and wrong
  const referer = req.headers.get("referer") ?? "";
  const origin  = req.headers.get("origin") ?? "";
  const host    = req.nextUrl.hostname;
  const originWrong  = origin  && !origin.includes(host);
  const refererWrong = referer && !referer.includes(host);
  if (req.method === "POST" && pathname.startsWith("/api/") && (originWrong || refererWrong)) return true;

  return false;
}

// ── Per-endpoint config ───────────────────────────────────────────
interface EndpointLimit {
  path: string;
  rpm: number;
  burst: number;
  burstWindowMs: number;
}

const AI_ENDPOINT_LIMITS: EndpointLimit[] = [
  { path: "/api/agent/loop",                   rpm: 6,  burst: 2, burstWindowMs: 10_000 },
  { path: "/api/analyze",                      rpm: 10, burst: 3, burstWindowMs: 10_000 },
  { path: "/api/token/premium",                rpm: 5,  burst: 2, burstWindowMs: 10_000 },
  { path: "/api/defi-chat",                    rpm: 10, burst: 3, burstWindowMs: 10_000 },
  { path: "/api/mcp",                          rpm: 20, burst: 5, burstWindowMs:  5_000 },
  { path: "/api/insurance/claim-with-repay",   rpm: 4,  burst: 2, burstWindowMs: 15_000 },
  { path: "/api/insurance/buy-policy",         rpm: 6,  burst: 2, burstWindowMs: 10_000 },
  { path: "/api/rpc",                          rpm: 30, burst: 5, burstWindowMs: 10_000 },
];

const API_RATE_LIMITED = [
  "/api/analyze",
  "/api/defi-chat",
  "/api/agent/",
  "/api/insurance/",
  "/api/token/",
  "/api/yield",
  "/api/wallet",
  "/api/mcp",
  "/api/rpc",
];

const MAX_API_RPM = 60;
const MAX_BURST   = 15;

// ── In-memory fallback rate limiters (used when Redis is not configured) ──
const aiEndpointWindows = new Map<string, number[]>();
const ipWindows         = new Map<string, number[]>();

function checkEndpointLimitMemory(
  pathname: string, ip: string
): { blocked: boolean; retryAfter?: number } {
  const rule = AI_ENDPOINT_LIMITS.find(r => pathname.startsWith(r.path));
  if (!rule) return { blocked: false };

  const windowKey  = `${rule.path}:${ip}`;
  const now        = Date.now();
  const minCutoff  = now - 60_000;
  const burstCutoff = now - rule.burstWindowMs;

  const ts = (aiEndpointWindows.get(windowKey) ?? []).filter(t => t > minCutoff);
  ts.push(now);
  aiEndpointWindows.set(windowKey, ts);

  if (ts.filter(t => t > burstCutoff).length > rule.burst)
    return { blocked: true, retryAfter: Math.ceil(rule.burstWindowMs / 1000) };
  if (ts.length > rule.rpm)
    return { blocked: true, retryAfter: 60 };
  return { blocked: false };
}

function checkGeneralLimitMemory(ip: string): { blocked: boolean; retryAfter?: number } {
  const now        = Date.now();
  const windowStart = now - 60_000;
  const burstStart  = now - 5_000;

  const ts = (ipWindows.get(ip) ?? []).filter(t => t > windowStart);
  ts.push(now);
  ipWindows.set(ip, ts);

  if (ts.filter(t => t > burstStart).length > MAX_BURST) return { blocked: true, retryAfter: 5 };
  if (ts.length > MAX_API_RPM)                            return { blocked: true, retryAfter: 60 };
  return { blocked: false };
}

// ── Lazy cleanup (every 5 minutes, in-memory only) ────────────────
let lastCleanup = Date.now();
function maybeCleanup() {
  const now = Date.now();
  if (now - lastCleanup < 300_000) return;
  lastCleanup = now;
  const gc = now - 60_000;
  for (const [k, ts] of ipWindows)         { const f = ts.filter(t => t > gc); f.length ? ipWindows.set(k, f) : ipWindows.delete(k); }
  for (const [k, ts] of aiEndpointWindows) { const f = ts.filter(t => t > gc); f.length ? aiEndpointWindows.set(k, f) : aiEndpointWindows.delete(k); }
}

// ── JSON error helper ─────────────────────────────────────────────

function jsonBlock(status: number, message: string, extra?: Record<string, string>): NextResponse {
  return new NextResponse(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json", ...extra },
  });
}

// ── Middleware (async — required for Redis await) ─────────────────

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const ua = req.headers.get("user-agent") ?? "";
  const ip =
    (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() ||
    (req.headers.get("x-real-ip") ?? "").trim() ||
    "unknown";

  // ── Layer 1: Banned IP instant block ──────────────────────────
  if (ip !== "unknown" && bannedIps.has(ip)) {
    return new NextResponse(null, { status: 403 });
  }

  // ── Layer 2: Honeypot paths — ban IP, silent 404 ──────────────
  if (
    pathname.startsWith("/api/_") ||
    pathname === "/robots-probe.txt" ||
    pathname.startsWith("/.env") ||
    pathname.startsWith("/wp-") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/phpmyadmin") ||
    pathname.endsWith(".php") ||
    pathname.endsWith(".asp") ||
    pathname.endsWith(".aspx")
  ) {
    if (ip !== "unknown") bannedIps.add(ip);
    return new NextResponse(null, { status: 404 });
  }

  maybeCleanup();

  // ── Layer 3: Suspicious request patterns ──────────────────────
  if (isSuspiciousRequest(req, pathname)) {
    if (ip !== "unknown") bannedIps.add(ip);
    return jsonBlock(400, "Bad request");
  }

  // ── Layers 4-7: API-only ───────────────────────────────────────
  if (pathname.startsWith("/api/")) {

    // /api/mcp is designed for programmatic access by AI agents (Claude Desktop,
    // Cursor, VS Code, etc.) — skip bot UA and fingerprint checks for this path.
    const isMcpEndpoint = pathname.startsWith("/api/mcp");

    // /api/og/ generates Open Graph images fetched by social media crawlers
    // (Twitter, Facebook, Slack, Discord, etc.) — must be publicly accessible.
    // /api/run/ serves run report data — also needed by crawlers reading og:image.
    // Skip ALL bot/fingerprint/rate-limit checks for these routes.
    if (pathname.startsWith("/api/og/") || pathname.startsWith("/api/run/")) {
      return NextResponse.next();
    }

    // [SECURITY FIX M-2] Demo mode rate-limit bypass REMOVED.
    // Previously, spoofing Referer+Host headers bypassed ALL rate limiting.
    // Demo endpoints use static data and are lightweight — they can share
    // the general rate limit without issues.

    // Layer 4: Known bot UA
    if (!isMcpEndpoint && BOT_UA_PATTERNS.some(p => p.test(ua))) {
      return jsonBlock(403, "Forbidden");
    }

    // Layer 5: Header fingerprint scoring
    if (!isMcpEndpoint && headerFingerprintScore(req) >= FINGERPRINT_BLOCK_SCORE) {
      return jsonBlock(403, "Forbidden");
    }

    // Layer 6: Per-endpoint rate limit ─────────────────────────
    const rule = AI_ENDPOINT_LIMITS.find(r => pathname.startsWith(r.path));
    if (rule) {
      const distributedLimiter = getDistributedLimiter(rule.path, rule.rpm);
      if (distributedLimiter) {
        // ✅ Redis mode: shared across all Vercel instances
        const { success, reset } = await distributedLimiter.limit(`${rule.path}:${ip}`);
        if (!success) {
          return jsonBlock(429, "Too many requests", {
            "Retry-After": String(Math.max(1, Math.ceil((reset - Date.now()) / 1000))),
            "X-RateLimit-Scope": "endpoint",
            "X-RateLimit-Mode": "distributed",
          });
        }
      } else {
        // ⚠️ Fallback: in-memory (per-instance only)
        const { blocked, retryAfter } = checkEndpointLimitMemory(pathname, ip);
        if (blocked) {
          return jsonBlock(429, "Too many requests", {
            "Retry-After": String(retryAfter ?? 10),
            "X-RateLimit-Scope": "endpoint",
            "X-RateLimit-Mode": "memory",
          });
        }
      }
    }

    // Layer 7: General API rate limit ──────────────────────────
    if (API_RATE_LIMITED.some(p => pathname.startsWith(p))) {
      const generalLimiter = getGeneralLimiter(MAX_API_RPM);
      if (generalLimiter) {
        // ✅ Redis mode
        const { success } = await generalLimiter.limit(ip);
        if (!success) {
          return jsonBlock(429, "Too many requests", {
            "Retry-After": "60",
            "X-RateLimit-Limit": String(MAX_API_RPM),
            "X-RateLimit-Scope": "global",
            "X-RateLimit-Mode": "distributed",
          });
        }
      } else {
        // ⚠️ Fallback: in-memory
        const { blocked, retryAfter } = checkGeneralLimitMemory(ip);
        if (blocked) {
          return jsonBlock(429, "Too many requests", {
            "Retry-After": String(retryAfter ?? 60),
            "X-RateLimit-Limit": String(MAX_API_RPM),
            "X-RateLimit-Scope": "global",
            "X-RateLimit-Mode": "memory",
          });
        }
      }
    }
  }

  // ── Layer 8: Short/empty UA on page routes ─────────────────────
  if (!pathname.startsWith("/api/") && !pathname.startsWith("/_next/")) {
    if (ua.length < 10) {
      return new NextResponse("Forbidden", { status: 403 });
    }
  }

  // ── Layer 9: Security response headers ────────────────────────
  const response = NextResponse.next();
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  response.headers.set("Strict-Transport-Security", "max-age=63072000; includeSubDomains; preload");
  response.headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.googleapis.com https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https: wss:;"
  );

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
