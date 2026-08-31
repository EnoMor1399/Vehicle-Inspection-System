import { RELEASE_VERSION } from "@/lib/version";

export const dynamic = "force-dynamic";

export async function GET() {
  const started = performance.now();
  const responseTimeMs = Math.round(performance.now() - started);

  return Response.json(
    {
      status: "alive",
      timestamp: new Date().toISOString(),
      version: RELEASE_VERSION,
      responseTimeMs,
    },
    {
      status: 200,
      headers: {
        "Cache-Control": "no-store",
        "Server-Timing": `app;dur=${responseTimeMs}`,
        "X-VIMS-Version": RELEASE_VERSION,
      },
    }
  );
}
