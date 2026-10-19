import { AlertTriangle, ShieldAlert } from "lucide-react";
import { Card, PageHeader } from "@/components/ui";

export const dynamic = "force-dynamic";

// This page does not use the operational authorization context. It is the
// fail-closed landing page for expired, revoked or tampered signed scopes.
export default function ExpiredSuperAdminOperationsPage() {
  return (
    <main className="mx-auto max-w-3xl p-6 lg:p-10">
      <PageHeader eyebrow="Super Administrator · Security"
        title="Organization operations authorization expired"
        description="Your elevated organization session is no longer valid. No further changes to any organization can be made until you exit and verify again." />
      <Card className="p-6">
        <div className="flex items-start gap-3">
          <ShieldAlert className="mt-0.5 h-7 w-7 text-amber-600" />
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Operations locked</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              The selected organization is not automatically changed back to your login
              organization. Use the Exit expired session button above, then select
              the intended organization again and provide fresh MFA authorization.
            </p>
            <p className="mt-3 flex items-center gap-2 text-xs font-medium text-amber-800">
              <AlertTriangle className="h-4 w-4" /> This safeguard prevents wrong-company writes after expiry.
            </p>
          </div>
        </div>
      </Card>
    </main>
  );
}
