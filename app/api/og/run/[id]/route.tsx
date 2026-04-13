import { ImageResponse } from "next/og";
import { NextRequest } from "next/server";
import { OG_BIJIN_B64 } from "@/lib/og-bijin-b64";

export const runtime = "nodejs";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  await params; // id unused — image is the same for all reports

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          background: "#ffffff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={OG_BIJIN_B64}
          alt=""
          width={1200}
          height={630}
          style={{ objectFit: "contain" }}
        />
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
