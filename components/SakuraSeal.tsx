/**
 * SakuraSeal — The brand's defining visual anchor.
 *
 * A traditional Japanese shuin (朱印) stamp rendered in SVG:
 *   • Rounded-square vermillion block (朱色 #C9312A)
 *   • Gold kamon (家紋) pattern overlay, 若隱若現 — ambient, not loud
 *   • Fine gold hairline inner border (金線)
 *   • 桜 kanji in cream-gold, center-stage
 *   • Brush-press entrance animation — the seal "lands" on the page
 *
 * Reference corpus: Kyoto temple seal aesthetics + TAPEDRIVE grand-prize
 * visual weight + ukiyo-e hanko composition.
 *
 * Server-compatible: pure SVG + CSS, zero client JS.
 */

import { type CSSProperties } from "react";

interface SakuraSealProps {
  size?: number;
  className?: string;
  style?: CSSProperties;
  /** If true, the seal animates in on mount (brush-press effect). */
  animate?: boolean;
}

export default function SakuraSeal({
  size = 200,
  className = "",
  style,
  animate = true,
}: SakuraSealProps) {
  return (
    <div
      className={`sakura-seal ${animate ? "animate-seal-press" : ""} ${className}`}
      style={{
        width: size,
        height: size,
        position: "relative",
        ...style,
      }}
      aria-label="Sakura seal"
    >
      <svg
        viewBox="0 0 200 200"
        width={size}
        height={size}
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: "block" }}
      >
        <defs>
          {/* 家紋 Kamon — cherry-blossom medallion pattern that echoes
              the large floral 桜紋 motifs on the bijin's kimono.
              Structure:
                • Large rounded sakura medallion (heart-notched petals
                  with a small outer notch at each petal tip, classic
                  heraldic 桜紋)
                • Tiny stamen dots between petals
                • Small scattered petals between medallions for texture
              Rendered in faint 金箔 gold on 朱色 red — 若隱若現. */}
          <pattern
            id="sakura-kamon"
            x="0"
            y="0"
            width="72"
            height="72"
            patternUnits="userSpaceOnUse"
          >
            {/* ── Large 桜紋 medallion at (36, 36) ── */}
            <g
              fill="rgba(230, 201, 101, 0.30)"
              stroke="rgba(230, 201, 101, 0.22)"
              strokeWidth="0.4"
            >
              {/* 5 rounded petals with tip-notch (桜花弁) — built as
                  ellipse body + small circle notch-out cue at tip */}
              {/* petal 1 (top, 0°) */}
              <ellipse cx="36" cy="22.5" rx="4.2" ry="7" />
              <circle cx="36" cy="16.5" r="1.3" fill="rgba(201,49,42,1)" stroke="none" />
              {/* petal 2 (72°) */}
              <ellipse cx="48.8" cy="31" rx="4.2" ry="7" transform="rotate(72 48.8 31)" />
              <circle cx="51.7" cy="26.6" r="1.3" fill="rgba(201,49,42,1)" stroke="none" />
              {/* petal 3 (144°) */}
              <ellipse cx="44" cy="45.7" rx="4.2" ry="7" transform="rotate(144 44 45.7)" />
              <circle cx="48.4" cy="48.2" r="1.3" fill="rgba(201,49,42,1)" stroke="none" />
              {/* petal 4 (216°) */}
              <ellipse cx="28" cy="45.7" rx="4.2" ry="7" transform="rotate(216 28 45.7)" />
              <circle cx="23.6" cy="48.2" r="1.3" fill="rgba(201,49,42,1)" stroke="none" />
              {/* petal 5 (288°) */}
              <ellipse cx="23.2" cy="31" rx="4.2" ry="7" transform="rotate(288 23.2 31)" />
              <circle cx="20.3" cy="26.6" r="1.3" fill="rgba(201,49,42,1)" stroke="none" />

              {/* Inner circle */}
              <circle cx="36" cy="36" r="2.6" />

              {/* Stamen dots between petals (5 small gold dots at 36°
                  offsets from petal axes) */}
              <circle cx="43.4" cy="25.5" r="0.9" />
              <circle cx="48.2" cy="39.6" r="0.9" />
              <circle cx="36.9" cy="48.6" r="0.9" />
              <circle cx="24.5" cy="42.2" r="0.9" />
              <circle cx="24.5" cy="29.8" r="0.9" />
            </g>

            {/* ── Small scattered petals between medallions (top-right
                and bottom-left corners of the tile) for density ── */}
            <g fill="rgba(230, 201, 101, 0.16)">
              {/* tiny offset sakura at (0, 0) corner — fragment of a
                  medallion continuing from the previous tile */}
              <ellipse cx="0" cy="0" rx="2.6" ry="4.4" />
              <ellipse cx="7" cy="-3" rx="1.6" ry="2.8" transform="rotate(36 7 -3)" />
              {/* Mirror at (72, 72) */}
              <ellipse cx="72" cy="72" rx="2.6" ry="4.4" />
              <ellipse cx="65" cy="75" rx="1.6" ry="2.8" transform="rotate(216 65 75)" />
            </g>
          </pattern>

          {/* Subtle ink-grain overlay — gives the seal the organic
              imperfection of a real hanko press rather than a flat block. */}
          <filter id="ink-grain" x="0" y="0" width="100%" height="100%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.9"
              numOctaves="2"
              seed="3"
            />
            <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.25 0" />
            <feComposite in2="SourceGraphic" operator="in" />
          </filter>
        </defs>

        {/* Outer square drop shadow for paper press depth */}
        <rect
          x="8"
          y="10"
          width="184"
          height="184"
          rx="14"
          fill="rgba(0,0,0,0.10)"
        />

        {/* 朱色 seal block */}
        <rect
          x="6"
          y="6"
          width="184"
          height="184"
          rx="14"
          fill="#C9312A"
        />

        {/* Ink grain overlay */}
        <rect
          x="6"
          y="6"
          width="184"
          height="184"
          rx="14"
          fill="#C9312A"
          filter="url(#ink-grain)"
          opacity="0.9"
        />

        {/* Gold kamon pattern — 若隱若現 */}
        <rect
          x="6"
          y="6"
          width="184"
          height="184"
          rx="14"
          fill="url(#sakura-kamon)"
        />

        {/* Fine gold hairline inner border 金線 */}
        <rect
          x="14"
          y="14"
          width="168"
          height="168"
          rx="10"
          fill="none"
          stroke="#E6C965"
          strokeWidth="0.8"
          opacity="0.55"
        />

        {/* Even thinner outermost gold line */}
        <rect
          x="6.5"
          y="6.5"
          width="183"
          height="183"
          rx="13.5"
          fill="none"
          stroke="#E6C965"
          strokeWidth="0.5"
          opacity="0.25"
        />

        {/* 桜 kanji — the character, painterly */}
        <text
          x="100"
          y="130"
          textAnchor="middle"
          fontSize="112"
          fontFamily="'Noto Serif JP', 'Hiragino Mincho ProN', 'Yu Mincho', serif"
          fontWeight="400"
          fill="#F5EEE0"
          letterSpacing="0"
          style={{
            filter: "drop-shadow(0 1px 0 rgba(0,0,0,0.12))",
          }}
        >
          桜
        </text>

        {/* Tiny gold corner dots — traditional seal flourish */}
        {[
          [22, 22],
          [178, 22],
          [22, 178],
          [178, 178],
        ].map(([cx, cy]) => (
          <circle
            key={`${cx}-${cy}`}
            cx={cx}
            cy={cy}
            r="1"
            fill="#E6C965"
            opacity="0.7"
          />
        ))}
      </svg>
    </div>
  );
}
