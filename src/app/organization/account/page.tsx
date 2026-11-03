import { requireOrganizationAccountManager } from "@/lib/require-auth";
import { OrganizationAccountContent } from "./OrganizationAccountContent";

export const dynamic = "force-dynamic";

export default async function OrganizationAccountPage() {
  const user = await requireOrganizationAccountManager();
  return <OrganizationAccountContent organizationId={user.organizationId} />;
}
