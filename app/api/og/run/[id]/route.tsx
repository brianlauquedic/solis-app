import { OG_BIJIN_B64 } from "@/lib/og-bijin-b64";

export const runtime = "nodejs";

// No satori / ImageResponse — just return the pre-generated PNG directly.
// This is the most reliable approach: zero rendering, zero deps, zero failures.
export async function GET() {
  const base64 = OG_BIJIN_B64.replace("data:image/png;base64,", "");
  const buffer = Buffer.from(base64, "base64");

  return new Response(buffer, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400, immutable",
    },
  });
}
