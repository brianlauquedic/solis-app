"use client";

interface WaBijinSVGProps {
  size?: number;
  height?: number;
  className?: string;
}

export default function WaBijinSVG({ size = 32, height, className }: WaBijinSVGProps) {
  return (
    <div
      className={className}
      style={{
        width: size,
        height: height ?? size,
        overflow: "hidden",
        position: "relative",
        flexShrink: 0,
        borderRadius: "inherit",
      }}
    >
      <img
        src="/logo-bijin.png"
        alt="Sakura"
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          objectFit: "contain",
          objectPosition: "50% top",
          top: "0%",
          left: "0%",
          filter: "contrast(1.05) brightness(1.0)",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
