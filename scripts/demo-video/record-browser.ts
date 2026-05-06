/**
 * scripts/demo-video/record-browser.ts
 *
 * Drives the live sakuraaai.com (or local dev server) through the 3-min
 * Colosseum demo flow via Playwright, recording the entire session at
 * 1920x1080 to dist/browser-{timestamp}.webm. Reads dist/timings.json
 * to align per-shot dwell times with the voiceover audio.
 *
 * Usage:
 *   npx tsx scripts/demo-video/record-browser.ts                # https://www.sakuraaai.com
 *   APP_URL=http://localhost:3000 npx tsx scripts/demo-video/record-browser.ts
 *
 * Output: dist/browser.webm (one continuous recording covering INTRO +
 * SHOT-1 + SHOT-3 + SHOT-4 segments; SHOT-2 is the terminal portion
 * via vhs; SHOT-5 is a static card composed in ffmpeg).
 *
 * Output map per timing manifest:
 *   t=0..15.2s    INTRO       landing hero scroll
 *   t=15.2..38.2s SHOT-1      ?demo=true intent signing flow
 *   t=38.2..68.4s SHOT-2      [terminal — provided by vhs, NOT here]
 *   t=68.4..92.2s SHOT-3      Solscan tx view
 *   t=92.2..108.8s SHOT-4     ActionHistory in app
 *   t=108.8..138s SHOT-5      [closing card — provided by ffmpeg, NOT here]
 *
 * This script records SHOT 1, 3, 4 + INTRO. Shots 2 and 5 are stitched
 * over silence in the recorded file by ffmpeg (the recording will have
 * a "blank" gap during shot-2 and at the end; ffmpeg overlays the
 * terminal video and closing card respectively).
 */
import { chromium } from "playwright";
import { readFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DIST = join(HERE, "dist");
const APP_URL = process.env.APP_URL ?? "https://www.sakuraaai.com";
const DEMO_URL = `${APP_URL.replace(/\/$/, "")}/?demo=true`;
// A real, settled Sakura execute_with_intent_proof tx on devnet — used
// for SHOT-3 Solscan view. Override SOLSCAN_TX env var if you want a
// fresher one.
// Most-recent successful tx on the Sakura devnet program at write time.
// Refresh via:
//   curl -sS https://api.devnet.solana.com -X POST -H 'Content-Type: application/json' \
//     -d '{"jsonrpc":"2.0","id":1,"method":"getSignaturesForAddress","params":["AnszeCRFsBKmT5fBY9WywxGsZZZob8ZPFYqboYXpuYLp",{"limit":5}]}'
const SOLSCAN_TX =
  process.env.SOLSCAN_TX ??
  "3Ej3dFHFv2SV69w15aeLHQX8roaMEVK9bgB1ondyLsXtmdDZdML1QiH66VNQg47GbyHU5DhWjp9rpoA317GENXuQ";
// Use Solana Explorer instead of Solscan — Solscan gates headless
// Playwright traffic via Cloudflare. Solana Explorer (the official
// foundation explorer) is open to all clients and renders the same
// program logs + inner-instruction tree.
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

async function main() {
  mkdirSync(DIST, { recursive: true });
  const timings = loadTimings();
  const shotByName = (n: string) => timings.shots.find((s) => s.name === n)!;

  const intro = shotByName("INTRO");
  const shot1 = shotByName("SHOT-1");
  const shot2 = shotByName("SHOT-2");
  const shot3 = shotByName("SHOT-3");
  const shot4 = shotByName("SHOT-4");
  const shot5 = shotByName("SHOT-5");

  console.log(`▶ recording browser portion`);
  console.log(`  app:        ${APP_URL}`);
  console.log(`  total dur:  ${timings.total_sec}s`);
  console.log(`  output:     ${DIST}/`);

  const headless = process.env.HEADLESS !== "false"; // headless by default for hands-off automation
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
  const page = await context.newPage();

  try {
    // ── INTRO (0..15.2s) ──────────────────────────────────────────────
    console.log(`\n[INTRO] navigating to ${APP_URL}`);
    await page.goto(APP_URL, { waitUntil: "load", timeout: 30_000 });
    // Hero is the visible viewport on first load. Slow scroll down to
    // reveal a bit of the body, then back up — gives motion vs a static
    // shot.
    await sleep(3_000);
    await page.evaluate(() => window.scrollBy({ top: 200, behavior: "smooth" }));
    await sleep(4_000);
    await page.evaluate(() => window.scrollBy({ top: 200, behavior: "smooth" }));
    await sleep(4_000);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
    await sleep(intro.visual_dur_sec * 1000 - 11_000);

    // ── SHOT-1 (15.2..38.2s) ──────────────────────────────────────────
    console.log(`[SHOT-1] entering demo mode`);
    await page.goto(DEMO_URL, { waitUntil: "load", timeout: 30_000 });
    await sleep(2_500);

    // Find the intent textarea by placeholder/role.
    const intentTextarea = page.locator("textarea").first();
    await intentTextarea.waitFor({ state: "visible", timeout: 10_000 });
    await intentTextarea.click();
    await intentTextarea.fill("");
    await intentTextarea.type(
      "Lend up to 1000 USDC into Kamino or Jupiter Lend, $10k max per action, one week.",
      { delay: 35 }
    );
    await sleep(2_000);

    // Try to scroll the IntentSigner into nicer view.
    await intentTextarea.evaluate((el) =>
      el.scrollIntoView({ block: "center", behavior: "smooth" })
    );
    await sleep(2_500);

    // Sign Intent button.
    const signBtn = page.getByRole("button", { name: /Sign Intent|意図を署名|簽署意圖/ });
    if (await signBtn.count()) {
      await signBtn.first().click({ trial: false }).catch(() => {});
    }
    // Hold on the success / awaiting state until SHOT-1 ends.
    const shot1End = intro.visual_dur_sec + shot1.visual_dur_sec;
    const elapsedMs = (intro.visual_dur_sec + 7) * 1000;
    await sleep(Math.max(500, shot1End * 1000 - elapsedMs));

    // ── SHOT-2 (38.2..68.4s) ──────────────────────────────────────────
    // Browser stays "static" (or on a neutral visual) — terminal video
    // overlays this segment in ffmpeg compose. We park on the demo page
    // with the success state visible.
    console.log(`[SHOT-2] terminal overlay segment — browser parked`);
    await sleep(shot2.visual_dur_sec * 1000);

    // ── SHOT-3 (68.4..92.2s) ──────────────────────────────────────────
    console.log(`[SHOT-3] Solana Explorer tx view`);
    await page.goto(EXPLORER_URL, { waitUntil: "load", timeout: 45_000 }).catch((e) => {
      console.warn(`  warn: explorer navigation issue: ${e.message}`);
    });
    await sleep(4_000);
    // Scroll to program logs section.
    await page.evaluate(() =>
      window.scrollBy({ top: 600, behavior: "smooth" })
    );
    await sleep(6_000);
    await page.evaluate(() =>
      window.scrollBy({ top: 400, behavior: "smooth" })
    );
    await sleep(shot3.visual_dur_sec * 1000 - 12_000);

    // ── SHOT-4 (92.2..108.8s) ─────────────────────────────────────────
    console.log(`[SHOT-4] back to app, scroll to ActionHistory`);
    await page.goto(DEMO_URL, { waitUntil: "load", timeout: 30_000 });
    await sleep(2_500);
    // Scroll down to find ActionHistory component.
    await page.evaluate(() =>
      window.scrollBy({ top: 1200, behavior: "smooth" })
    );
    await sleep(shot4.visual_dur_sec * 1000 - 4_000);

    // ── SHOT-5 (108.8..138s) ──────────────────────────────────────────
    // Closing card composed in ffmpeg. Browser parks here.
    console.log(`[SHOT-5] closing card overlay — browser parked`);
    await sleep(shot5.visual_dur_sec * 1000);

    console.log(`\n✓ recording complete`);
  } finally {
    await context.close(); // flushes the video file
    await browser.close();
  }

  // The video file is written with a generated name. Find the most
  // recent .webm in dist/ and rename to browser.webm.
  const fs = await import("node:fs/promises");
  const files = await fs.readdir(DIST);
  const webms = files
    .filter((f) => f.endsWith(".webm"))
    .map((f) => ({
      name: f,
      mtime: 0,
    }));
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
  await fs.rename(join(DIST, latest), join(DIST, "browser.webm"));
  console.log(`✓ wrote ${DIST}/browser.webm`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
