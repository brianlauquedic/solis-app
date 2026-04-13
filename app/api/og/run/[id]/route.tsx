import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { LOGO_BIJIN_B64 } from "@/lib/logo-bijin-b64";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background: "#ffffff",
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 80px",
          fontFamily: "sans-serif",
        }}
      >
        {/* Left: text content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            flex: 1,
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              marginBottom: 24,
            }}
          >
            <span style={{ fontSize: 28 }}>👻</span>
            <span style={{ fontSize: 12, color: "#8B5CF6", letterSpacing: 3, fontWeight: 700 }}>
              SAKURA · GHOST RUN
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", marginBottom: 24 }}>
            <span style={{ fontSize: 44, fontWeight: 800, color: "#0F0A1E", lineHeight: 1.15 }}>
              Solana DeFi
            </span>
            <span style={{ fontSize: 44, fontWeight: 800, color: "#0F0A1E", lineHeight: 1.15 }}>
              Strategy Pre-Simulated
            </span>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              gap: 8,
              marginBottom: 32,
            }}
          >
            <span style={{ fontSize: 16, color: "#8B5CF6" }}>⛩️</span>
            <span style={{ fontSize: 16, color: "#6B7280" }}>
              SHA-256 committed on Solana mainnet · pre-trade
            </span>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              gap: 10,
              background: "#F5F3FF",
              border: "1px solid #DDD6FE",
              borderRadius: 10,
              padding: "8px 18px",
            }}
          >
            <span style={{ fontSize: 11, color: "#8B5CF6", letterSpacing: 2, fontWeight: 700 }}>
              REPORT ID
            </span>
            <span style={{ fontSize: 13, color: "#7C3AED", fontFamily: "monospace" }}>
              {id}
            </span>
          </div>

          <div
            style={{
              display: "flex",
              marginTop: 40,
              fontSize: 13,
              color: "#9CA3AF",
              letterSpacing: 2,
            }}
          >
            <span>sakuraaai.com</span>
          </div>
        </div>

        {/* Right: WaBijin girl */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={LOGO_BIJIN_B64}
          alt=""
          width={200}
          height={267}
          style={{
            objectFit: "cover",
            objectPosition: "top",
            flexShrink: 0,
          }}
        />
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
