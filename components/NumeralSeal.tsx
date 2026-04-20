/**
 * NumeralSeal — miniature 朱印 that replaces the bare mincho 壱/弐/参/
 * 肆/伍/陸 numerals in section headings.
 *
 * Each section heading gets a ~52-60px vermillion seal block with the
 * same 桜紋 gold kamon pattern as the hero's big SakuraSeal, a fine
 * gold inner hairline border, 4 corner gold-bead flourishes, and the
 * section numeral rendered in cream on red.
 *
 * This makes the 6 section openers read as a numbered seal stamp
 * series — the classical temple-guide 冊子 aesthetic where every
 * section is "stamped" rather than "numbered".
 *
 * Pure SVG + CSS, server-compatible.
 */

import { type CSSProperties } from "react";

interface NumeralSealProps {
  /** The kanji numeral to stamp: 壱 弐 参 肆 伍 陸 etc */
  numeral: string;
  size?: number;
  className?: string;
  style?: CSSProperties;
}

let counter = 0;
const uid = () => `numeral-seal-${++counter}`;

export default function NumeralSeal({
  numeral,
  size = 56,
  className = "",
  style,
}: NumeralSealProps) {
  // Unique pattern id per instance so multiple seals don't share a
  // single pattern (would render identically anyway, but avoids id
  // collisions during SSR hydration).
  const patId = uid();

  return (
    <div
      className={`numeral-seal ${className}`}
      style={{
        width: size,
        height: size,
        flexShrink: 0,
        position: "relative",
        ...style,
      }}
      aria-label={`Section ${numeral}`}
    >
      <svg
        viewBox="0 0 56 56"
        width={size}
        height={size}
        xmlns="http://www.w3.org/2000/svg"
        style={{ display: "block" }}
      >
        <defs>
          {/* Miniature 桜紋 pattern — same visual language as SakuraSeal
              but scaled down to fit a 56px seal. One medallion per tile. */}
          <pattern
            id={patId}
            x="0"
            y="0"
            width="28"
            height="28"
            patternUnits="userSpaceOnUse"
          >
            <g
              fill="rgba(230, 201, 101, 0.26)"
              stroke="rgba(230, 201, 101, 0.18)"
              strokeWidth="0.3"
            >
              {/* 5-petal mini sakura medallion */}
              <ellipse cx="14" cy="7" rx="1.8" ry="3.2" />
              <ellipse cx="20.65" cy="11.45" rx="1.8" ry="3.2" transform="rotate(72 20.65 11.45)" />
              <ellipse cx="18.1" cy="19.25" rx="1.8" ry="3.2" transform="rotate(144 18.1 19.25)" />
              <ellipse cx="9.9" cy="19.25" rx="1.8" ry="3.2" transform="rotate(216 9.9 19.25)" />
              <ellipse cx="7.35" cy="11.45" rx="1.8" ry="3.2" transform="rotate(288 7.35 11.45)" />
              <circle cx="14" cy="14" r="1.1" />
            </g>
          </pattern>
        </defs>

        {/* Drop shadow — subtle paper press depth */}
        <rect x="3" y="4" width="50" height="50" rx="5" fill="rgba(0,0,0,0.14)" />

        {/* 朱色 seal block */}
        <rect x="2" y="2" width="50" height="50" rx="5" fill="#C9312A" />

        {/* Gold kamon pattern */}
        <rect x="2" y="2" width="50" height="50" rx="5" fill={`url(#${patId})`} />

        {/* Fine gold inner hairline */}
        <rect
          x="6"
          y="6"
          width="42"
          height="42"
          rx="3.5"
          fill="none"
          stroke="#E6C965"
          strokeWidth="0.6"
          opacity="0.55"
        />

        {/* Outermost ultra-thin gold line */}
        <rect
          x="2.4"
          y="2.4"
          width="49.2"
          height="49.2"
          rx="4.8"
          fill="none"
          stroke="#E6C965"
          strokeWidth="0.4"
          opacity="0.25"
        />

        {/* Numeral in cream — positioned to be optically centered */}
        <text
          x="27"
          y="38"
          textAnchor="middle"
          fontSize="30"
          fontFamily="'Noto Serif JP', 'Hiragino Mincho ProN', 'Yu Mincho', serif"
          fontWeight="400"
          fill="#F5EEE0"
          style={{
            filter: "drop-shadow(0 1px 0 rgba(0,0,0,0.14))",
          }}
        >
          {numeral}
        </text>

        {/* 4 corner gold bead flourishes — traditional seal detail */}
        {[
          [7, 7],
          [47, 7],
          [7, 47],
          [47, 47],
        ].map(([cx, cy]) => (
          <circle
            key={`${cx}-${cy}`}
            cx={cx}
            cy={cy}
            r="0.65"
            fill="#E6C965"
            opacity="0.7"
          />
        ))}
      </svg>
    </div>
  );
}
