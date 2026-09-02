import { requirePermission } from "@/lib/require-auth";
import { getSettings } from "@/lib/settings";
import { toEditableSystemSettings } from "@/lib/settings-view";
import { SettingsForm } from "./SettingsForm";
import { PageHeader, Badge } from "@/components/ui";
import { ShieldAlert } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requirePermission("settings");
  const canEdit = true;
  const settings = toEditableSystemSettings(await getSettings());

  return (
    <div className="p-6 lg:p-10">
      <PageHeader
        eyebrow="Administration"
        title="System Settings"
        description="Configure branding, organization details, inspection defaults, security and notifications for the entire platform."
        action={
          canEdit ? (
            <Badge tone="emerald" className="text-sm px-3 py-1">
              <ShieldAlert className="h-4 w-4" /> Administrator Access
            </Badge>
          ) : (
            <Badge tone="slate" className="text-sm px-3 py-1">
              Read-only · Admin access required to edit
            </Badge>
          )
        }
      />

      {!canEdit && (
        <div className="mb-6 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-900 flex items-start gap-2">
          <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium">Read-only mode</p>
            <p className="text-xs mt-0.5 text-amber-800">
              Only Administrators and Super Administrators can modify system settings.
              Contact your administrator to request changes.
            </p>
          </div>
        </div>
      )}

      <SettingsForm settings={settings} canEdit={canEdit} />
    </div>
  );
}
