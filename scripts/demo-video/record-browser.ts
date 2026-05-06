/**
 * scripts/demo-video/record-browser.ts
 *
 * Drives sakuraaai.com (or local dev server) through the 3-min
 * Colosseum demo flow via Playwright, recording 1920x1080 to
 * dist/browser.webm. Reads dist/timings.json to align per-shot dwell
 * times with the audio-aligned voiceover.
 *
 * Records the BROWSER portions only (HOOK, SHOT-1.5, SHOT-2, COMPARE,
 * SHOT-5 are non-browser overlays composed in post-production via
 * ffmpeg).
 *
 * Browser timeline (per 9-shot timings.json):
 *   0..15s        HOOK         [parked — hook.mp4 overlay covers]
 *   15..30s       INTRO        sakuraaai.com landing hero
 *   30..53s       SHOT-1       /?demo=true IntentSigner flow
 *   53..77s       SHOT-1.5     [parked — revert.mp4 overlay covers]
 *   77..99s       SHOT-2       [parked — terminal.mp4 overlay covers]
 *   99..117s      SHOT-3       Solana Explorer tx view
 *   117..138s     COMPARE      [parked — comparison.mp4 overlay covers]
 *   138..154s     SHOT-4       back to app, ActionHistory feed
 *   154..169s     SHOT-5       [parked — closing-card.mp4 overlay covers]
 *
 * Adds a 朱 orange cursor overlay via page.addInitScript so viewers
 * can track clicks (Playwright's headless cursor is invisible).
 *
 * Usage:
 *   npx tsx scripts/demo-video/record-browser.ts
 *   APP_URL=http://localhost:3000 ... (override default https://www.sakuraaai.com)
 *   HEADLESS=false ...                (debug; default headless)
 *   SOLSCAN_TX=<sig> ...              (override the recorded explorer tx)
 */
import { chromium } from "playwright";
import { readFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DIST = join(HERE, "dist");
const APP_URL = process.env.APP_URL ?? "https://www.sakuraaai.com";
const DEMO_URL = `${APP_URL.replace(/\/$/, "")}/?demo=true`;
const SOLSCAN_TX =
  process.env.SOLSCAN_TX ??
  "3Ej3dFHFv2SV69w15aeLHQX8roaMEVK9bgB1ondyLsXtmdDZdML1QiH66VNQg47GbyHU5DhWjp9rpoA317GENXuQ";
const EXPLORER_URL = `https://explorer.solana.com/tx/${SOLSCAN_TX}?cluster=devnet`;

interface Shot {
  index: number;
  name: string;
  start_sec: number;
  audio_sec: number;
  trailing_pause_sec: number;
  visual_dur_sec: number;
}
interface Timings {
  voice: string;
  rate: string;
  pause_between_sec: number;
  total_sec: number;
  shots: Shot[];
}

function loadTimings(): Timings {
  const p = join(DIST, "timings.json");
  if (!existsSync(p)) {
    throw new Error(
      `dist/timings.json not found. Run scripts/demo-video/generate-voiceover.sh first.`
    );
  }
  return JSON.parse(readFileSync(p, "utf8"));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Cursor overlay JS — injected at every navigation. Renders a 朱
// orange dot tracking mouse position. Visible in Playwright recordings
// (which otherwise omit the OS cursor).
const CURSOR_INIT_SCRIPT = `
(() => {
  const cursor = document.createElement('div');
  cursor.id = '__sakura_cursor';
  cursor.style.cssText = [
    'position:fixed','pointer-events:none','z-index:2147483647',
    'width:28px','height:28px',
    'background:radial-gradient(circle, #FF6A00cc 30%, #FF6A0044 60%, transparent 75%)',
    'border-radius:50%',
    'transform:translate(-50%, -50%)',
    'transition:left 0.05s linear, top 0.05s linear',
    'left:-100px','top:-100px',
  ].join(';');
  const attach = () => {
    if (!document.body) { setTimeout(attach, 50); return; }
    document.body.appendChild(cursor);
  };
  attach();
  let lastX = 0, lastY = 0;
  const update = (x, y) => {
    lastX = x; lastY = y;
    cursor.style.left = x + 'px';
    cursor.style.top = y + 'px';
  };
  document.addEventListener('mousemove', e => update(e.clientX, e.clientY), {capture: true});
  document.addEventListener('click',     e => update(e.clientX, e.clientY), {capture: true});
  window.__sakuraMoveCursor = update;
})();
`;

async function main() {
  mkdirSync(DIST, { recursive: true });
  const timings = loadTimings();
  const shotByName = (n: string) => timings.shots.find((s) => s.name === n)!;

  const HOOK     = shotByName("HOOK");
  const INTRO    = shotByName("INTRO");
  const SHOT1    = shotByName("SHOT-1");
  const SHOT1_5  = shotByName("SHOT-1.5");
  const SHOT2    = shotByName("SHOT-2");
  const SHOT3    = shotByName("SHOT-3");
  const COMPARE  = shotByName("COMPARE");
  const SHOT4    = shotByName("SHOT-4");
  const SHOT5    = shotByName("SHOT-5");

  console.log(`▶ recording browser portion`);
  console.log(`  app:        ${APP_URL}`);
  console.log(`  total dur:  ${timings.total_sec}s`);
  console.log(`  output:     ${DIST}/`);

  const headless = process.env.HEADLESS !== "false";
  console.log(`  headless:   ${headless}`);
  const browser = await chromium.launch({
    headless,
    args: ["--window-size=1920,1080", "--window-position=0,0"],
  });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
    recordVideo: {
      dir: DIST,
      size: { width: 1920, height: 1080 },
    },
  });
  await context.addInitScript(CURSOR_INIT_SCRIPT);
  const page = await context.newPage();

  // Helper to drive a smooth visible cursor path. Playwright's
  // page.mouse.move emits mousemove events that the injected cursor
  // can catch.
  async function smoothMoveTo(x: number, y: number, steps = 18, between = 18) {
    await page.mouse.move(x, y, { steps });
    await sleep(between);
  }

  try {
    // ── HOOK (0..15s) ────────────────────────────────────────────────
    // Browser parked on a neutral page while hook.mp4 overlays.
    console.log(`\n[HOOK] browser parked, hook overlay covers`);
    await page.goto("about:blank", { waitUntil: "load" });
    await sleep(HOOK.visual_dur_sec * 1000);

    // ── INTRO (15..30s) ─────────────────────────────────────────────
    console.log(`[INTRO] navigating to ${APP_URL}`);
    await page.goto(APP_URL, { waitUntil: "load", timeout: 30_000 });
    await sleep(2_500);
    await smoothMoveTo(960, 540);
    // Slow scroll to reveal a bit, then back up.
    await page.evaluate(() => window.scrollBy({ top: 220, behavior: "smooth" }));
    await sleep(4_500);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    await sleep(INTRO.visual_dur_sec * 1000 - 7_500);

    // ── SHOT-1 (30..53s) ────────────────────────────────────────────
    console.log(`[SHOT-1] entering demo mode`);
    await page.goto(DEMO_URL, { waitUntil: "load", timeout: 30_000 });
    await sleep(2_500);
    await smoothMoveTo(960, 400);

    const intentTextarea = page.locator("textarea").first();
    await intentTextarea.waitFor({ state: "visible", timeout: 10_000 });
    const tBox = await intentTextarea.boundingBox();
    if (tBox) await smoothMoveTo(tBox.x + 80, tBox.y + 30);
    await intentTextarea.click();
    await intentTextarea.fill("");
    await intentTextarea.type(
      "Lend up to 1000 USDC into Kamino or Jupiter Lend, $10k max per action, one week.",
      { delay: 35 }
    );
    await sleep(2_000);

    await intentTextarea.evaluate((el) =>
      el.scrollIntoView({ block: "center", behavior: "smooth" })
    );
    await sleep(2_000);

    const signBtn = page.getByRole("button", { name: /Sign Intent|意図を署名|簽署意圖/ });
    if (await signBtn.count()) {
      const btn = signBtn.first();
      const bBox = await btn.boundingBox();
      if (bBox) await smoothMoveTo(bBox.x + bBox.width / 2, bBox.y + bBox.height / 2);
      await btn.click({ trial: false }).catch(() => {});
    }
    const remainSHOT1 = SHOT1.visual_dur_sec * 1000 - (2500 + 2000 + 2000 + 4000);
    await sleep(Math.max(500, remainSHOT1));

    // ── SHOT-1.5 (53..77s) ──────────────────────────────────────────
    // Revert overlay covers — browser parks.
    console.log(`[SHOT-1.5] revert overlay covers`);
    await sleep(SHOT1_5.visual_dur_sec * 1000);

    // ── SHOT-2 (77..99s) ────────────────────────────────────────────
    // Terminal overlay covers — browser parks.
    console.log(`[SHOT-2] terminal overlay covers`);
    await sleep(SHOT2.visual_dur_sec * 1000);

    // ── SHOT-3 (99..117s) ───────────────────────────────────────────
    console.log(`[SHOT-3] Solana Explorer tx view`);
    await page.goto(EXPLORER_URL, { waitUntil: "load", timeout: 45_000 }).catch((e) => {
      console.warn(`  warn: explorer navigation issue: ${e.message}`);
    });
    await sleep(3_500);
    await smoothMoveTo(960, 400);
    await page.evaluate(() =>
      window.scrollBy({ top: 600, behavior: "smooth" })
    );
    await sleep(5_000);
    await page.evaluate(() =>
      window.scrollBy({ top: 400, behavior: "smooth" })
    );
    await sleep(SHOT3.visual_dur_sec * 1000 - 11_500);

    // ── COMPARE (117..138s) ─────────────────────────────────────────
    // Comparison overlay covers — browser parks.
    console.log(`[COMPARE] comparison overlay covers`);
    await sleep(COMPARE.visual_dur_sec * 1000);

    // ── SHOT-4 (138..154s) ──────────────────────────────────────────
    console.log(`[SHOT-4] back to app, scroll to ActionHistory`);
    await page.goto(DEMO_URL, { waitUntil: "load", timeout: 30_000 });
    await sleep(2_000);
    await smoothMoveTo(960, 400);
    await page.evaluate(() =>
      window.scrollBy({ top: 1300, behavior: "smooth" })
    );
    await sleep(SHOT4.visual_dur_sec * 1000 - 3_500);

    // ── SHOT-5 (154..169s) ──────────────────────────────────────────
    // Closing card overlay covers — browser parks.
    console.log(`[SHOT-5] closing card overlay covers`);
    await sleep(SHOT5.visual_dur_sec * 1000);

    console.log(`\n✓ recording complete`);
  } finally {
    await context.close();
    await browser.close();
  }

  const fs = await import("node:fs/promises");
  const files = await fs.readdir(DIST);
  const webms = files
    .filter((f) => f.endsWith(".webm"))
    .map((f) => ({ name: f, mtime: 0 }));
  for (const w of webms) {
    const stat = await fs.stat(join(DIST, w.name));
    w.mtime = stat.mtimeMs;
  }
  webms.sort((a, b) => b.mtime - a.mtime);
  if (webms.length === 0) {
    console.error("✗ no .webm output in dist/");
    process.exit(1);
  }
  const latest = webms[0].name;
  // Remove the previous browser.webm if it exists.
  try {
    await fs.unlink(join(DIST, "browser.webm"));
  } catch {}
  await fs.rename(join(DIST, latest), join(DIST, "browser.webm"));
  console.log(`✓ wrote ${DIST}/browser.webm`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
