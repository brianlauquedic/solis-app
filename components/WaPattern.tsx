/**
 * 和柄 Wa-gara — traditional Japanese geometric pattern components.
 *
 * Server-compatible (no "use client"): these are pure presentational
 * components with no hooks, state, refs, or browser APIs. They stay
 * in the React Server Component bundle and ship zero client JS.
 *
 * Each pattern is rendered as an inline SVG via CSS `background-image` on
 * a container. The patterns are intentionally minimal and low-opacity —
 * they carry the Japanese-traditional texture without ever competing
 * with foreground content. Think of them as the subtle wash in a
 * sumi-e painting, not as decoration.
 *
 * Patterns included:
 *   • Seigaiha  (青海波)  — ocean waves, the most iconic Edo pattern
 *   • Shippo    (七宝)    — seven treasures, overlapping circles
 *   • Asanoha   (麻の葉)  — hemp leaf, six-pointed star lattice
 *   • Kanoko    (鹿の子)  — fawn dots, simple polka
 *
 * Usage:
 *   <Seigaiha className="absolute inset-0" opacity={0.04} />
 *   <Shippo   className="h-40"             opacity={0.05} size={48} />
 *
 * Colors default to the 煤竹色 (Susu-take) border token for subtle
 * contrast on dark backgrounds; override with `color` prop.
 */

import { type CSSProperties } from "react";

interface WaPatternProps {
  /** Tailwind / CSS className on the wrapping div. */
  className?: string;
  /** SVG stroke color — defaults to 煤竹色 (`--border` token). */
  color?: string;
  /** Tile size in pixels. */
  size?: number;
  /** Opacity applied to the pattern image (0..1). */
  opacity?: number;
  /** Inline style override. */
  style?: CSSProperties;
}

/** Build a CSS url() wrapping a base64-encoded inline SVG. */
function svgDataUrl(svg: string) {
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
}

// ───────────────────────────────────────────────────────────────────
// 青海波 Seigaiha — concentric arcs, classical Edo wave pattern
// ───────────────────────────────────────────────────────────────────
export function Seigaiha({
  className = "",
  color = "#3A342C",
  size = 40,
  opacity = 0.08,
  style,
}: WaPatternProps) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size * 2}" height="${size}"
         viewBox="0 0 ${size * 2} ${size}" fill="none">
      <g stroke="${color}" stroke-width="1" fill="none">
        <circle cx="${size}" cy="${size}" r="${size * 0.5}"/>
        <circle cx="${size}" cy="${size}" r="${size * 0.35}"/>
        <circle cx="${size}" cy="${size}" r="${size * 0.2}"/>
        <circle cx="0"         cy="${size}" r="${size * 0.5}"/>
        <circle cx="0"         cy="${size}" r="${size * 0.35}"/>
        <circle cx="0"         cy="${size}" r="${size * 0.2}"/>
        <circle cx="${size * 2}" cy="${size}" r="${size * 0.5}"/>
        <circle cx="${size * 2}" cy="${size}" r="${size * 0.35}"/>
        <circle cx="${size * 2}" cy="${size}" r="${size * 0.2}"/>
      </g>
    </svg>`.trim();

  return (
    <div
      className={className}
      aria-hidden
      style={{
        backgroundImage: svgDataUrl(svg),
        backgroundRepeat: "repeat",
        backgroundSize: `${size * 2}px ${size}px`,
        opacity,
        pointerEvents: "none",
        ...style,
      }}
    />
  );
}

// ───────────────────────────────────────────────────────────────────
// 七宝 Shippo — interlocking circles ("seven treasures")
// ───────────────────────────────────────────────────────────────────
export function Shippo({
  className = "",
  color = "#3A342C",
  size = 48,
  opacity = 0.06,
  style,
}: WaPatternProps) {
  const r = size * 0.5;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"
         viewBox="0 0 ${size} ${size}" fill="none">
      <g stroke="${color}" stroke-width="1" fill="none">
        <circle cx="${r}" cy="${r}" r="${r}"/>
        <circle cx="0" cy="0" r="${r}"/>
        <circle cx="${size}" cy="0" r="${r}"/>
        <circle cx="0" cy="${size}" r="${r}"/>
        <circle cx="${size}" cy="${size}" r="${r}"/>
      </g>
    </svg>`.trim();

  return (
    <div
      className={className}
      aria-hidden
      style={{
        backgroundImage: svgDataUrl(svg),
        backgroundRepeat: "repeat",
        backgroundSize: `${size}px ${size}px`,
        opacity,
        pointerEvents: "none",
        ...style,
      }}
    />
  );
}

// ───────────────────────────────────────────────────────────────────
// 麻の葉 Asanoha — six-pointed star lattice (hemp leaf)
// ───────────────────────────────────────────────────────────────────
export function Asanoha({
  className = "",
  color = "#3A342C",
  size = 56,
  opacity = 0.05,
  style,
}: WaPatternProps) {
  const h = size;
  const w = size * Math.sqrt(3);
  const mx = w * 0.5;
  const my = h * 0.5;
  // Lines from center to 6 surrounding points + connecting triangles.
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"
         viewBox="0 0 ${w} ${h}" fill="none">
      <g stroke="${color}" stroke-width="0.8" fill="none">
        <line x1="${mx}" y1="${my}" x2="0"       y2="0"/>
        <line x1="${mx}" y1="${my}" x2="${w}"    y2="0"/>
        <line x1="${mx}" y1="${my}" x2="0"       y2="${h}"/>
        <line x1="${mx}" y1="${my}" x2="${w}"    y2="${h}"/>
        <line x1="${mx}" y1="${my}" x2="0"       y2="${my}"/>
        <line x1="${mx}" y1="${my}" x2="${w}"    y2="${my}"/>
        <line x1="0"       y1="0" x2="${w}"    y2="0"/>
        <line x1="0"       y1="${h}" x2="${w}" y2="${h}"/>
        <line x1="0"       y1="0" x2="0"       y2="${h}"/>
        <line x1="${w}"    y1="0" x2="${w}"    y2="${h}"/>
      </g>
    </svg>`.trim();

  return (
    <div
      className={className}
      aria-hidden
      style={{
        backgroundImage: svgDataUrl(svg),
        backgroundRepeat: "repeat",
        backgroundSize: `${w}px ${h}px`,
        opacity,
        pointerEvents: "none",
        ...style,
      }}
    />
  );
}

// ───────────────────────────────────────────────────────────────────
// 鹿の子 Kanoko — fawn-spot dots (simplest Japanese textile polka)
// ───────────────────────────────────────────────────────────────────
export function Kanoko({
  className = "",
  color = "#3A342C",
  size = 16,
  opacity = 0.1,
  style,
}: WaPatternProps) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"
         viewBox="0 0 ${size} ${size}" fill="${color}">
      <circle cx="${size / 2}" cy="${size / 2}" r="1"/>
    </svg>`.trim();

  return (
    <div
      className={className}
      aria-hidden
      style={{
        backgroundImage: svgDataUrl(svg),
        backgroundRepeat: "repeat",
        backgroundSize: `${size}px ${size}px`,
        opacity,
        pointerEvents: "none",
        ...style,
      }}
    />
  );
}

// ───────────────────────────────────────────────────────────────────
// 境界 Kyōkai — a single hairline divider with a small 印 seal dot,
// echoing the red-seal-on-parchment motif from traditional hanko.
// ───────────────────────────────────────────────────────────────────
export function KyokaiDivider({
  className = "",
  sealColor = "#C9312A",
}: {
  className?: string;
  sealColor?: string;
}) {
  return (
    <div
      className={className}
      role="separator"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        width: "100%",
      }}
    >
      <div
        style={{
          flex: 1,
          height: 1,
          background:
            "linear-gradient(to right, transparent, var(--border), var(--border-light), var(--border), transparent)",
        }}
      />
      <div
        style={{
          width: 5,
          height: 5,
          borderRadius: "50%",
          background: sealColor,
          boxShadow: `0 0 0 1px ${sealColor}50`,
        }}
        aria-hidden
      />
      <div
        style={{
          flex: 1,
          height: 1,
          background:
            "linear-gradient(to right, transparent, var(--border), var(--border-light), var(--border), transparent)",
        }}
      />
    </div>
  );
}
