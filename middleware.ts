/**
 * Solis — Anti-Crawler & Rate-Limit Middleware (v2)
 *
 * Layered defense in execution order:
 *   1. Banned IP instant block (honeypot triggered)
 *   2. Honeypot path detection → ban IP + 404
 *   3. Suspicious request pattern detection (injection, traversal, anomalies)
 *   4. Known bot/crawler User-Agent block (32+ patterns)
 *   5. Header fingerprint anomaly scoring (missing browser headers)
 *   6. Tight per-endpoint rate limits for expensive AI routes
 *   7. General sliding-window rate limit (60 req/min, 15/5s burst)
 *   8. Short UA block for page routes (headless browsers)
 *   9. Security response headers on all responses
 */

import { NextRequest, NextResponse } from "next/server";

// ── 1. Banned IP set (honeypot-triggered, session-scoped) ────────
const bannedIps = new Set<string>();

// ── Bot User-Agent patterns ──────────────────────────────────────
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
  /nmap/i, /masscan/i, /zgrab/i, /nuclei/i,           // scanners
  /dataforseo/i, /serpstat/i, /majestic/i,             // SEO tools
];

// ── Header fingerprint scoring ───────────────────────────────────
const FINGERPRINT_BLOCK_SCORE = 60;

function headerFingerprintScore(req: NextRequest): number {
  let score = 0;
  const ua  = req.headers.get("user-agent") ?? "";
  const acc = req.headers.get("accept") ?? "";
  const lng = req.headers.get("accept-language") ?? "";
  const enc = req.headers.get("accept-encoding") ?? "";

  // Missing Accept-Language: strong bot signal
  if (!lng) score += 30;
  // Missing Accept header
  if (!acc) score += 20;
  // Accept present but neither text/html nor wildcard (raw API client)
  if (acc && !acc.includes("text/html") && !acc.includes("*/*")) score += 10;
  // Missing Accept-Encoding
  if (!enc) score += 15;
  // Non-browser runtime UA prefix
  if (/^(python|node|ruby|php|go|java|rust|dart)/i.test(ua)) score += 40;
  // Very short or empty UA (already caught elsewhere, layered defense)
  if (ua.length > 0 && ua.length < 20) score += 20;
  // Suspicious X-Forwarded-For with >4 hops (deep proxy chain)
  const fwd = req.headers.get("x-forwarded-for") ?? "";
  if (fwd.split(",").length > 4) score += 15;

  return score;
}

// ── Suspicious request patterns ──────────────────────────────────

function isSuspiciousRequest(req: NextRequest, pathname: string): boolean {
  // Path traversal
  if (pathname.includes("..") || pathname.includes("%2e%2e")) return true;
  // Null bytes
  if (pathname.includes("\0") || pathname.includes("%00")) return true;
  // SQL/NoSQL injection probes
  const raw = req.nextUrl.toString();
  if (/(\bUNION\b|\bSELECT\b|\bDROP TABLE\b|;\s*DROP|--\s)/i.test(raw)) return true;
  // XSS probes
  if (/<script|javascript:|onerror=/i.test(raw)) return true;
  // Excessively long query string (scraper pagination abuse)
  if (req.nextUrl.search.length > 2000) return true;
  // JSON content-type on GET (scripted client quirk)
  const ct = req.headers.get("content-type") ?? "";
  if (req.method === "GET" && ct.includes("application/json")) return true;
  // Cross-origin POST to API (referer from unrelated domain)
  const referer = req.headers.get("referer") ?? "";
  const origin  = req.headers.get("origin") ?? "";
  const host    = req.nextUrl.hostname;
  if (
    req.method === "POST" &&
    pathname.startsWith("/api/") &&
    referer && !referer.includes(host) &&
    origin  && !origin.includes(host)
  ) return true;

  return false;
}

// ── Per-endpoint tight rate limits (expensive AI routes) ─────────
interface EndpointLimit {
  path: string;
  rpm: number;       // max requests per minute
  burst: number;     // max requests in burstWindowMs
  burstWindowMs: number;
}

const AI_ENDPOINT_LIMITS: EndpointLimit[] = [
  { path: "/api/agent/loop",    rpm: 6,  burst: 2, burstWindowMs: 10_000 },
  { path: "/api/analyze",       rpm: 10, burst: 3, burstWindowMs: 10_000 },
  { path: "/api/token/premium", rpm: 5,  burst: 2, burstWindowMs: 10_000 },
  { path: "/api/defi-chat",     rpm: 10, burst: 3, burstWindowMs: 10_000 },
  { path: "/api/mcp",           rpm: 20, burst: 5, burstWindowMs: 5_000  },
];

// windowKey: `${endpoint.path}:${ip}` → timestamps[]
const aiEndpointWindows = new Map<string, number[]>();

function checkEndpointLimit(
  pathname: string,
  ip: string
): { blocked: boolean; retryAfter?: number } {
  const rule = AI_ENDPOINT_LIMITS.find(r => pathname.startsWith(r.path));
  if (!rule) return { blocked: false };

  const windowKey = `${rule.path}:${ip}`;
  const now        = Date.now();
  const minCutoff  = now - 60_000;
  const burstCutoff = now - rule.burstWindowMs;

  const ts = (aiEndpointWindows.get(windowKey) ?? []).filter(t => t > minCutoff);
  ts.push(now);
  aiEndpointWindows.set(windowKey, ts);

  const burst = ts.filter(t => t > burstCutoff).length;
  if (burst > rule.burst) {
    return { blocked: true, retryAfter: Math.ceil(rule.burstWindowMs / 1000) };
  }
  if (ts.length > rule.rpm) {
    return { blocked: true, retryAfter: 60 };
  }
  return { blocked: false };
}

// ── General sliding-window rate limiter ──────────────────────────
const ipWindows = new Map<string, number[]>();

const WINDOW_MS   = 60_000;
const MAX_API_RPM = 60;
const MAX_BURST   = 15;

const API_RATE_LIMITED = [
  "/api/analyze",
  "/api/defi-chat",
  "/api/agent/",
  "/api/verify/",
  "/api/token/",
  "/api/yield",
  "/api/wallet",
  "/api/mcp",
];

function checkRateLimit(ip: string): { blocked: boolean; retryAfter?: number } {
  const now        = Date.now();
  const windowStart = now - WINDOW_MS;
  const burstStart  = now - 5_000;

  const timestamps = (ipWindows.get(ip) ?? []).filter(t => t > windowStart);
  timestamps.push(now);
  ipWindows.set(ip, timestamps);

  const burst = timestamps.filter(t => t > burstStart).length;
  if (burst > MAX_BURST)       return { blocked: true, retryAfter: 5  };
  if (timestamps.length > MAX_API_RPM) return { blocked: true, retryAfter: 60 };
  return { blocked: false };
}

// ── Lazy cleanup (every 5 minutes) ───────────────────────────────
let lastCleanup = Date.now();
function maybeCleanup() {
  const now = Date.now();
  if (now - lastCleanup < 300_000) return;
  lastCleanup = now;

  const generalCutoff   = now - WINDOW_MS;
  const endpointCutoff  = now - 60_000;

  for (const [key, ts] of ipWindows.entries()) {
    const fresh = ts.filter(t => t > generalCutoff);
    if (fresh.length === 0) ipWindows.delete(key);
    else ipWindows.set(key, fresh);
  }
  for (const [key, ts] of aiEndpointWindows.entries()) {
    const fresh = ts.filter(t => t > endpointCutoff);
    if (fresh.length === 0) aiEndpointWindows.delete(key);
    else aiEndpointWindows.set(key, fresh);
  }
  // Note: bannedIps is intentionally NOT pruned — bans persist for the
  // lifetime of the server process (clears on redeploy)
}

// ── Helpers ───────────────────────────────────────────────────────

function jsonBlock(status: number, message: string, extra?: Record<string, string>): NextResponse {
  return new NextResponse(
    JSON.stringify({ error: message }),
    {
      status,
      headers: {
        "Content-Type": "application/json",
        ...extra,
      },
    }
  );
}

// ── Middleware ────────────────────────────────────────────────────

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const ua = req.headers.get("user-agent") ?? "";
  const ip =
    (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() ||
    (req.headers.get("x-real-ip") ?? "").trim() ||
    "unknown";

  // ── Layer 1: Banned IP instant block ────────────────────────────
  if (ip !== "unknown" && bannedIps.has(ip)) {
    return new NextResponse(null, { status: 403 });
  }

  // ── Layer 2: Honeypot paths — ban IP, silent 404 ────────────────
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

  // ── Layer 3: Suspicious request patterns ────────────────────────
  if (isSuspiciousRequest(req, pathname)) {
    if (ip !== "unknown") bannedIps.add(ip);
    return jsonBlock(400, "Bad request");
  }

  // ── Layers 4-7 apply only to API routes ─────────────────────────
  if (pathname.startsWith("/api/")) {

    // Layer 4: Known bot UA
    if (BOT_UA_PATTERNS.some(p => p.test(ua))) {
      return jsonBlock(403, "Forbidden");
    }

    // Layer 5: Header fingerprint scoring (API calls from scripts)
    const fpScore = headerFingerprintScore(req);
    if (fpScore >= FINGERPRINT_BLOCK_SCORE) {
      return jsonBlock(403, "Forbidden");
    }

    // Layer 6: Tight per-endpoint limits for expensive AI routes
    const endpointCheck = checkEndpointLimit(pathname, ip);
    if (endpointCheck.blocked) {
      return jsonBlock(429, "Too many requests", {
        "Retry-After": String(endpointCheck.retryAfter ?? 10),
        "X-RateLimit-Scope": "endpoint",
      });
    }

    // Layer 7: General API rate limit
    const isRateLimited = API_RATE_LIMITED.some(p => pathname.startsWith(p));
    if (isRateLimited) {
      const { blocked, retryAfter } = checkRateLimit(ip);
      if (blocked) {
        return jsonBlock(429, "Too many requests", {
          "Retry-After": String(retryAfter ?? 60),
          "X-RateLimit-Limit": String(MAX_API_RPM),
          "X-RateLimit-Scope": "global",
        });
      }
    }
  }

  // ── Layer 8: Short/empty UA on page routes ───────────────────────
  if (!pathname.startsWith("/api/") && !pathname.startsWith("/_next/")) {
    if (ua.length < 10) {
      return new NextResponse("Forbidden", { status: 403 });
    }
  }

  // ── Layer 9: Security response headers ──────────────────────────
  const response = NextResponse.next();
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-XSS-Protection", "1; mode=block");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=()"
  );
  response.headers.set(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https: wss:;"
  );

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)",
  ],
};
