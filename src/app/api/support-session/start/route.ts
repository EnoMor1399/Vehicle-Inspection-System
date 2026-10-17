import { NextResponse, type NextRequest } from "next/server";
import { beginUserSupportView } from "@/app/platform/account-support/support-actions";

export const runtime = "nodejs";

const privateHeaders = { "Cache-Control": "no-store" };

function messageForSupportError(error: unknown) {
  if (!(error instanceof Error)) return { message: "The support view could not be started. Try again.", status: 500 };
  switch (error.message) {
    case "The authenticator code was not accepted":
    case "Enter your authenticator code":
      return { message: "The authenticator code was not accepted. Check your code and try again.", status: 400 };
    case "This subscriber workspace is not currently available":
      return { message: "This organization's workspace is not operational. Verify and activate it in Subscriber Companies before starting a support view.", status: 409 };
    case "Too many support verification attempts. Try again later":
      return { message: "Too many verification attempts. Please wait a few minutes.", status: 429 };
    case "Exit the current support session before starting another":
      return { message: "A support view is already open. Use Exit support view before starting another.", status: 409 };
    case "Enter a support reason of at least 12 characters":
    case "Invalid account identifier":
    case "This account cannot be opened in support mode":
      return { message: error.message, status: 400 };
    case "Your administrator login has expired":
    case "Sign in again to continue":
    case "Authentication required":
      return { message: "Your session expired. Sign in again before starting a support view.", status: 401 };
    case "Only a Super Administrator with MFA may begin a support view":
      return { message: "An active Super Administrator with MFA is required.", status: 403 };
    default:
      // Do not disclose provider, database or internal session errors to browsers.
      return { message: "The support view could not be started. Try again or contact an administrator.", status: 500 };
  }
}

/**
 * Use a route handler rather than a cookie-setting Server Action:
 * Server Actions can re-render the RSC page on the same POST after setting the
 * support cookie, and support sessions intentionally reject POST renders.
 */
export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if (!origin || origin !== request.nextUrl.origin || (fetchSite && fetchSite !== "same-origin")) {
    return NextResponse.json({ error: "Cross-origin support requests are not permitted." }, { status: 403, headers: privateHeaders });
  }
  const contentType = request.headers.get("content-type");
  if (!contentType?.toLowerCase().startsWith("application/json")) {
    return NextResponse.json({ error: "Expected a JSON request." }, { status: 415, headers: privateHeaders });
  }
  const byteLength = request.headers.get("content-length");
  if (byteLength && (!/^\d+$/.test(byteLength) || Number(byteLength) > 4096)) {
    return NextResponse.json({ error: "Invalid support request size." }, { status: 413, headers: privateHeaders });
  }

  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Enter a valid support request." }, { status: 400, headers: privateHeaders });
    }
    const values = body as Record<string, unknown>;
    if (typeof values.userId !== "string" || typeof values.reason !== "string"
      || typeof values.authenticationCode !== "string"
      || values.userId.length > 64 || values.reason.length > 500 || values.authenticationCode.length > 8) {
      return NextResponse.json({ error: "Check the support target, reason and authenticator code." }, { status: 400, headers: privateHeaders });
    }
    const result = await beginUserSupportView({
      userId: values.userId,
      reason: values.reason,
      authenticationCode: values.authenticationCode,
    });
    return NextResponse.json(result, { headers: privateHeaders });
  } catch (error) {
    const response = messageForSupportError(error);
    return NextResponse.json({ error: response.message }, { status: response.status, headers: privateHeaders });
  }
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405, headers: { ...privateHeaders, Allow: "POST" } });
}
