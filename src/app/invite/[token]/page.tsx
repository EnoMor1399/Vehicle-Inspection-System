import Link from "next/link";
import { Building2, ShieldCheck } from "lucide-react";
import { getInvitationByToken } from "@/lib/organization-control-plane";
import { AcceptInvitationForm } from "./AcceptInvitationForm";

export const dynamic = "force-dynamic";

export default async function InvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const row = await getInvitationByToken(token);

  if (!row) {
    return (
      <main className="min-h-screen bg-slate-50 px-4 py-12">
        <div className="mx-auto max-w-lg rounded-3xl border border-red-200 bg-white p-7 text-center shadow-sm">
          <ShieldCheck className="mx-auto h-10 w-10 text-red-600" />
          <h1 className="mt-4 text-2xl font-semibold text-slate-950">Invitation unavailable</h1>
          <p className="mt-2 text-sm text-slate-600">This invitation link is invalid or no longer available.</p>
          <Link href="/login" className="mt-5 inline-flex rounded-lg bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white">Return to sign in</Link>
        </div>
      </main>
    );
  }

  const { invitation, organization, expired } = row;
  const unavailable = Boolean(invitation.acceptedAt || invitation.revokedAt || expired);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:py-12">
      <div className="mx-auto max-w-xl">
        <div className="mb-5 flex items-center justify-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-emerald-700 text-white"><Building2 className="h-5 w-5" /></span>
          <div>
            <p className="font-semibold text-slate-950">{organization.name}</p>
            <p className="text-xs text-slate-500">VIMS subscriber workspace</p>
          </div>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-700">Administrator invitation</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Create your VIMS account</h1>
          <p className="mt-2 mb-5 text-sm leading-6 text-slate-600">
            You were invited as <strong>{invitation.role.replaceAll("_", " ")}</strong>. This account is restricted to the responsibilities assigned to that role.
          </p>

          {unavailable ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
              {invitation.acceptedAt ? "This invitation has already been accepted." : invitation.revokedAt ? "This invitation was revoked." : "This invitation has expired."}
            </div>
          ) : (
            <AcceptInvitationForm token={token} email={invitation.email} suggestedName={invitation.name} />
          )}
        </div>
      </div>
    </main>
  );
}
