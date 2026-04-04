"use client";

interface WaBijinSVGProps {
  size?: number;
  className?: string;
}

export default function WaBijinSVG({ size = 32, className }: WaBijinSVGProps) {
  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
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
          width: "78%",
          height: "auto",
          objectFit: "cover",
          objectPosition: "50% top",
          top: "2%",
          left: "11%",
          filter: "contrast(1.05) brightness(1.0)",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
