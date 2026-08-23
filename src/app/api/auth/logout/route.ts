import { redirect } from "next/navigation";
import { signOut } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST() {
  await signOut();
  redirect("/login");
}

export async function GET() {
  await signOut();
  redirect("/login");
}
