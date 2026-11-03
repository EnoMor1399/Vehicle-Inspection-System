import { notFound } from "next/navigation";
import { requirePlatformSuperAdmin } from "@/lib/require-auth";
import { getOrganizationAccountSnapshot } from "@/lib/organization-control-plane";
import { isValidOrganizationId } from "@/lib/organization-id";
import { OrganizationAccountContent } from "@/app/organization/account/page";

export const dynamic = "force-dynamic";

// Platform Super Admin is the only actor able to open arbitrary organization
// accounts without impersonating a subscriber or using a browser-supplied scope.
export default async function PlatformOrganizationAccountPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePlatformSuperAdmin();
  const { id } = await params;
  if (!isValidOrganizationId(id)) notFound();
  const snapshot = await getOrganizationAccountSnapshot(id);
  if (!snapshot.organization) notFound();
  return <OrganizationAccountContent organizationId={id} platformAdmin />;
}
