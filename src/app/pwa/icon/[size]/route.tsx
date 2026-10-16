import { ImageResponse } from "next/og";

export const runtime = "edge";

const SUPPORTED_SIZES = new Set([192, 512]);

export async function GET(
  _request: Request,
  context: { params: Promise<{ size: string }> },
) {
  const { size: rawSize } = await context.params;
  const size = Number(rawSize);

  if (!SUPPORTED_SIZES.has(size)) {
    return new Response("Not found", { status: 404 });
  }

  const compact = size <= 192;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(145deg, #039703 0%, #026b02 62%, #0b1525 100%)",
          color: "white",
          borderRadius: size * 0.18,
          fontFamily: "Arial, Helvetica, sans-serif",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            width: size * 0.72,
            height: size * 0.72,
            border: `${Math.max(5, Math.round(size * 0.026))}px solid rgba(255,255,255,0.16)`,
            borderRadius: size * 0.24,
            transform: "rotate(18deg)",
          }}
        />
        <div
          style={{
            width: size * 0.48,
            height: size * 0.48,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: size * 0.14,
            background: "rgba(255,255,255,0.96)",
            color: "#026b02",
            fontSize: compact ? 42 : 108,
            fontWeight: 800,
            letterSpacing: "-0.05em",
            boxShadow: "0 12px 32px rgba(0,0,0,0.18)",
          }}
        >
          RSL
        </div>
        <div
          style={{
            marginTop: compact ? 12 : 28,
            display: "flex",
            fontSize: compact ? 19 : 50,
            fontWeight: 800,
            letterSpacing: compact ? "0.13em" : "0.16em",
          }}
        >
          VIMS
        </div>
      </div>
    ),
    {
      width: size,
      height: size,
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    },
  );
}
