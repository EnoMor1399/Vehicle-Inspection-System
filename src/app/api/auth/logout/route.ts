import { redirect } from "next/navigation";
import { signOut } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST() {
  await signOut();
  redirect("/login");
}

export async function GET() {
  return Response.json({ error: "Method not allowed" }, { status: 405, headers: { Allow: "POST" } });
}
