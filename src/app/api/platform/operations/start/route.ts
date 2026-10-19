import { NextResponse, type NextRequest } from "next/server";
import { trustedOperationsOrigin } from "@/lib/operations-csrf";
import { readJsonBody } from "@/lib/request-body";

export const runtime = "nodejs";

const headers = { "Cache-Control": "no-store" };
function errorResponse(error: unknown) {
  // Never disclose session credentials, signed capability data or database errors.
  const message = error instanceof Error ? error.message : "Unable to authorize operations";
  const known = [
    "Exit read-only support mode first", "Sign in again to continue",
    "An active Super Administrator with MFA is required",
    "Invalid organization ID", "This subscriber's workspace is not operational and verified",
    "Provide an operations reason of at least 12 characters",
    "Type the requested organization confirmation exactly",
    "Enter a valid authenticator code", "Too many verification attempts. Try again later",
    "The authenticator code was not accepted",
    "Exit the current operations session before starting another",
    "Your operations session has expired", "Type the sensitive-action confirmation exactly",
  ];
  return NextResponse.json({ error: known.includes(message) ? message : "Unable to authorize operations. Try again." },
    { status: message.includes("attempts") ? 429 : message.includes("expired") ? 401 : 403, headers });
}
function badOrigin() { return NextResponse.json({ error: "Cross-origin operations request rejected" }, { status: 403, headers }); }
function badBody() { return NextResponse.json({ error: "Expected JSON input" }, { status: 415, headers }); }
import { beginSuperAdminOperations } from "@/lib/super-admin-operations-actions";

export async function POST(request: NextRequest) {
  if (!trustedOperationsOrigin(request)) return badOrigin();
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return badBody();
  const parsed = await readJsonBody(request, 4096);
  if (!parsed.ok) return NextResponse.json({ error: parsed.message }, { status: parsed.status, headers });
  const data: unknown = parsed.value;
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400, headers });
  }
  const x = data as Record<string, unknown>;
  if (typeof x.organizationId !== "string" || typeof x.reason !== "string"
    || typeof x.confirmation !== "string" || typeof x.authenticationCode !== "string"
    || x.organizationId.length > 64 || x.reason.length > 500
    || x.confirmation.length > 350 || x.authenticationCode.length > 8) {
    return NextResponse.json({ error: "Check organization, reason, confirmation, and code" }, { status: 400, headers });
  }
  try {
    return NextResponse.json(await beginSuperAdminOperations({
      organizationId: x.organizationId,
      reason: x.reason,
      confirmation: x.confirmation,
      authenticationCode: x.authenticationCode,
    }), { headers });
  } catch (error) { return errorResponse(error); }
}
export async function GET() { return NextResponse.json({ error: "Method not allowed" }, { status: 405, headers }); }
