import { ImageResponse } from "next/og";

export const runtime = "nodejs";
export const alt = "Ghost Run · Proof-of-Simulation Report";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200, height: 630,
          background: "linear-gradient(135deg, #0A0A14, #0F0A1E)",
          display: "flex", flexDirection: "column",
          alignItems: "flex-start", justifyContent: "center",
          padding: "64px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ fontSize: 16, color: "#8B5CF6", letterSpacing: 3, marginBottom: 24 }}>
          SAKURA · GHOST RUN REPORT · PROOF-OF-SIMULATION
        </div>
        <div style={{ fontSize: 42, fontWeight: 700, color: "#F1F5F9", marginBottom: 32, maxWidth: 900 }}>
          Solana DeFi Strategy Pre-Simulated
        </div>
        <div style={{ fontSize: 18, color: "#A78BFA", fontFamily: "monospace" }}>
          ID: {id}
        </div>
        <div style={{ position: "absolute", bottom: 48, right: 64, fontSize: 14, color: "#334155" }}>
          sakuraaai.com
        </div>
      </div>
    ),
    { ...size }
  );
}
