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
          {/* 家紋 Kamon — cherry-blossom crest pattern.
              Rendered subtle gold on red; the "若隱若現" effect. */}
          <pattern
            id="sakura-kamon"
            x="0"
            y="0"
            width="34"
            height="34"
            patternUnits="userSpaceOnUse"
          >
            <g fill="rgba(230, 201, 101, 0.14)">
              {/* 5-petal sakura crest */}
              <circle cx="17" cy="17" r="2.2" />
              <ellipse cx="17" cy="8" rx="1.8" ry="3.2" />
              <ellipse
                cx="25"
                cy="13"
                rx="1.8"
                ry="3.2"
                transform="rotate(72 25 13)"
              />
              <ellipse
                cx="23"
                cy="23"
                rx="1.8"
                ry="3.2"
                transform="rotate(144 23 23)"
              />
              <ellipse
                cx="11"
                cy="23"
                rx="1.8"
                ry="3.2"
                transform="rotate(216 11 23)"
              />
              <ellipse
                cx="9"
                cy="13"
                rx="1.8"
                ry="3.2"
                transform="rotate(288 9 13)"
              />
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
