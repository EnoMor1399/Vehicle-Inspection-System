import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { finishUserSupportView } from "@/app/platform/account-support/support-actions";
import { SUPPORT_COOKIE_NAME } from "@/lib/support-session";

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  const fetchSite = request.headers.get("sec-fetch-site");
  if ((origin && origin !== request.nextUrl.origin) || fetchSite === "cross-site") {
    return NextResponse.json({ error: "Cross-origin support exit is not permitted" }, { status: 403 });
  }

  await finishUserSupportView();
  const response = NextResponse.redirect(new URL("/platform/account-support", request.url), 303);
  response.cookies.set(SUPPORT_COOKIE_NAME, "", {
    path: "/", maxAge: 0, httpOnly: true,
    sameSite: "strict", secure: process.env.NODE_ENV === "production",
  });
  response.headers.set("Cache-Control", "no-store");
  return response;
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405, headers: { Allow: "POST" } });
}
