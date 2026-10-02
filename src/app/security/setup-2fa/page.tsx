import { requireAuth } from "@/lib/require-auth";
import { Setup2FA } from "./Setup2FA";

export default async function Setup2FAPage() {
  await requireAuth({ allowPendingPrivileged2FA: true });
  return <Setup2FA />;
}
