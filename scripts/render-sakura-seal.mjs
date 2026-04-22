/**
 * Render SakuraSeal → all link-preview assets.
 *
 * Outputs:
 *   public/icon.png              512×512 transparent (favicon / Solana Action)
 *   public/apple-icon.png        180×180 edge-to-edge red (iOS home screen)
 *   public/og-sakura.png         1200×630 seal centered on cream (OG / Twitter)
 *   public/brand/sakura-seal-{512,1024,2048}.png  transparent source PNGs
 *
 * Usage: node scripts/render-sakura-seal.mjs
 */
import puppeteer from "puppeteer";
import { mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", "public");
const brandDir = join(publicDir, "brand");
mkdirSync(brandDir, { recursive: true });

// ── SEAL SVG ──────────────────────────────────────────────────────────────
// Extracted from components/SakuraSeal.tsx. `viewBox` is parametric so we can
// bleed to edge (for apple-touch-icon) or keep the paper-press margin.
function sealSvg({ bleed = false } = {}) {
  const vb = bleed ? "6 6 184 184" : "0 0 200 200";
  return `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}">
  <defs>
    <pattern id="sakura-kamon" x="0" y="0" width="72" height="72" patternUnits="userSpaceOnUse">
      <g fill="rgba(230,201,101,0.30)" stroke="rgba(230,201,101,0.22)" stroke-width="0.4">
        <ellipse cx="36" cy="22.5" rx="4.2" ry="7"/>
        <circle cx="36" cy="16.5" r="1.3" fill="rgba(201,49,42,1)" stroke="none"/>
        <ellipse cx="48.8" cy="31" rx="4.2" ry="7" transform="rotate(72 48.8 31)"/>
        <circle cx="51.7" cy="26.6" r="1.3" fill="rgba(201,49,42,1)" stroke="none"/>
        <ellipse cx="44" cy="45.7" rx="4.2" ry="7" transform="rotate(144 44 45.7)"/>
        <circle cx="48.4" cy="48.2" r="1.3" fill="rgba(201,49,42,1)" stroke="none"/>
        <ellipse cx="28" cy="45.7" rx="4.2" ry="7" transform="rotate(216 28 45.7)"/>
        <circle cx="23.6" cy="48.2" r="1.3" fill="rgba(201,49,42,1)" stroke="none"/>
        <ellipse cx="23.2" cy="31" rx="4.2" ry="7" transform="rotate(288 23.2 31)"/>
        <circle cx="20.3" cy="26.6" r="1.3" fill="rgba(201,49,42,1)" stroke="none"/>
        <circle cx="36" cy="36" r="2.6"/>
        <circle cx="43.4" cy="25.5" r="0.9"/>
        <circle cx="48.2" cy="39.6" r="0.9"/>
        <circle cx="36.9" cy="48.6" r="0.9"/>
        <circle cx="24.5" cy="42.2" r="0.9"/>
        <circle cx="24.5" cy="29.8" r="0.9"/>
      </g>
      <g fill="rgba(230,201,101,0.16)">
        <ellipse cx="0" cy="0" rx="2.6" ry="4.4"/>
        <ellipse cx="7" cy="-3" rx="1.6" ry="2.8" transform="rotate(36 7 -3)"/>
        <ellipse cx="72" cy="72" rx="2.6" ry="4.4"/>
        <ellipse cx="65" cy="75" rx="1.6" ry="2.8" transform="rotate(216 65 75)"/>
      </g>
    </pattern>
    <filter id="ink-grain" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3"/>
      <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.25 0"/>
      <feComposite in2="SourceGraphic" operator="in"/>
    </filter>
  </defs>
  ${bleed ? "" : `<rect x="8" y="10" width="184" height="184" rx="14" fill="rgba(0,0,0,0.10)"/>`}
  <rect x="6" y="6" width="184" height="184" rx="14" fill="#C9312A"/>
  <rect x="6" y="6" width="184" height="184" rx="14" fill="#C9312A" filter="url(#ink-grain)" opacity="0.9"/>
  <rect x="6" y="6" width="184" height="184" rx="14" fill="url(#sakura-kamon)"/>
  <rect x="14" y="14" width="168" height="168" rx="10" fill="none" stroke="#E6C965" stroke-width="0.8" opacity="0.55"/>
  <rect x="6.5" y="6.5" width="183" height="183" rx="13.5" fill="none" stroke="#E6C965" stroke-width="0.5" opacity="0.25"/>
  <text x="100" y="130" text-anchor="middle" font-size="112"
        font-family="'Noto Serif JP','Hiragino Mincho ProN','Yu Mincho',serif"
        font-weight="400" fill="#F5EEE0" letter-spacing="0"
        style="filter: drop-shadow(0 1px 0 rgba(0,0,0,0.12));">桜</text>
  <circle cx="22" cy="22" r="1" fill="#E6C965" opacity="0.7"/>
  <circle cx="178" cy="22" r="1" fill="#E6C965" opacity="0.7"/>
  <circle cx="22" cy="178" r="1" fill="#E6C965" opacity="0.7"/>
  <circle cx="178" cy="178" r="1" fill="#E6C965" opacity="0.7"/>
</svg>`.trim();
}

// ── PAGE TEMPLATES ────────────────────────────────────────────────────────
const fontsHead = `
<link rel="preconnect" href="https://fonts.googleapis.com"/>
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
<link href="https://fonts.googleapis.com/css2?family=Noto+Serif+JP:wght@300;400;500;600&display=swap" rel="stylesheet"/>`;

const fontReadyScript = `
<script>
  window.__fontReady = (async () => {
    if (document.fonts && document.fonts.ready) {
      await document.fonts.load("400 112px 'Noto Serif JP'");
      await document.fonts.load("500 42px 'Noto Serif JP'");
      await document.fonts.ready;
    }
    return true;
  })();
</script>`;

function seal({ bleed = false } = {}) {
  return `<!doctype html><html><head><meta charset="utf-8"/>${fontsHead}
<style>html,body{margin:0;padding:0;background:transparent;}
#seal{width:100vw;height:100vh;display:flex;align-items:center;justify-content:center;}
#seal svg{width:100%;height:100%;display:block;}</style></head>
<body><div id="seal">${sealSvg({ bleed })}</div>${fontReadyScript}</body></html>`;
}

// 1200×630 OG card: cream background, seal centered-left, brand wordmark right.
function ogCard() {
  return `<!doctype html><html><head><meta charset="utf-8"/>${fontsHead}
<style>
  html,body{margin:0;padding:0;}
  body{
    width:1200px;height:630px;
    background:
      radial-gradient(ellipse at 30% 50%, rgba(201,49,42,0.04) 0%, transparent 60%),
      linear-gradient(135deg, #F5EEE0 0%, #EFE6D4 100%);
    font-family:'Noto Serif JP','Hiragino Mincho ProN','Yu Mincho',serif;
    color:#1a1a1a;
    display:flex;align-items:center;gap:72px;
    padding:0 96px;box-sizing:border-box;
    position:relative;
  }
  /* faint gold hairline frame */
  body::before{
    content:"";position:absolute;inset:28px;
    border:1px solid rgba(201,151,60,0.35);border-radius:4px;
    pointer-events:none;
  }
  .seal{width:420px;height:420px;flex-shrink:0;}
  .seal svg{width:100%;height:100%;display:block;}
  .copy{flex:1;min-width:0;}
  .wordmark{
    font-size:96px;font-weight:500;letter-spacing:0.02em;
    color:#C9312A;line-height:1;margin:0 0 28px 0;
  }
  .tag{
    font-size:34px;font-weight:400;line-height:1.35;
    color:#2a2a2a;margin:0 0 36px 0;
    max-width:560px;
  }
  .domain{
    font-size:22px;font-weight:400;letter-spacing:0.12em;
    color:rgba(201,49,42,0.75);text-transform:uppercase;
    border-top:1px solid rgba(201,151,60,0.4);
    padding-top:20px;display:inline-block;
  }
</style></head>
<body>
  <div class="seal">${sealSvg()}</div>
  <div class="copy">
    <h1 class="wordmark">Sakura · 桜</h1>
    <p class="tag">数学で画定する、<br/>AI エージェントの実行境界。</p>
    <div class="domain">sakuraaai.com</div>
  </div>
  ${fontReadyScript}
</body></html>`;
}

// ── RENDER ────────────────────────────────────────────────────────────────
const browser = await puppeteer.launch({ headless: "new" });

async function shoot({ html, width, height, path, omitBackground = true, deviceScaleFactor = 1 }) {
  const page = await browser.newPage();
  await page.setViewport({ width, height, deviceScaleFactor });
  await page.setContent(html, { waitUntil: "networkidle0" });
  await page.evaluate(() => window.__fontReady);
  await page.screenshot({ path, omitBackground, type: "png" });
  console.log(`✓ ${path}`);
  await page.close();
}

try {
  // Transparent seal sources (for brand/)
  for (const size of [512, 1024, 2048]) {
    await shoot({
      html: seal(),
      width: size,
      height: size,
      path: join(brandDir, `sakura-seal-${size}.png`),
      omitBackground: true,
    });
  }

  // Favicon / Solana Action icon — transparent, square
  await shoot({
    html: seal(),
    width: 512,
    height: 512,
    path: join(publicDir, "icon.png"),
    omitBackground: true,
  });

  // Apple touch icon — 180×180, edge-to-edge red (iOS masks corners)
  await shoot({
    html: seal({ bleed: true }),
    width: 180,
    height: 180,
    path: join(publicDir, "apple-icon.png"),
    omitBackground: true,
  });

  // OG / Twitter summary_large_image card — 1200×630, cream background
  await shoot({
    html: ogCard(),
    width: 1200,
    height: 630,
    path: join(publicDir, "og-sakura.png"),
    omitBackground: false,
  });
} finally {
  await browser.close();
}
