import Link from "next/link";
import { Activity, ArrowUpRight, Building2, ShieldAlert, UsersRound } from "lucide-react";
import { Card, PageHeader, Badge } from "@/components/ui";
import { getPlatformOversightOverview } from "@/lib/platform-oversight";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PlatformOversightPage() {
  const orgs = await getPlatformOversightOverview();
  const total = (key: "users" | "vehicles" | "inspections") =>
    orgs.reduce((acc, org) => acc + org[key], 0);
  return (
    <main className="mx-auto max-w-[1600px] space-y-6 p-4 sm:p-6 lg:p-10">
      <PageHeader
        eyebrow="Super Administrator · Platform Administration"
        title="Platform Oversight Centre"
        description="Review company accounts, operational resources, security posture and activity without crossing subscriber data boundaries or taking over users' sessions."
      />
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {([
          { label: "Organisations", value: orgs.length, Icon: Building2 },
          { label: "User accounts", value: total("users"), Icon: UsersRound },
          { label: "Registered vehicles", value: total("vehicles"), Icon: Activity },
          { label: "Open security events", value: orgs.reduce((n, o) => n + o.unresolvedSecurityEvents, 0), Icon: ShieldAlert },
        ]).map(({ label, value, Icon }) => (
          <Card key={label} className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{String(label)}</p>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-2xl font-bold text-slate-950">{value.toLocaleString()}</span>
              <Icon className="h-5 w-5 text-emerald-700" />
            </div>
          </Card>
        ))}
      </div>
      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Subscriber oversight</h2>
            <p className="mt-1 text-sm text-slate-600">
              Select a company to inspect its own accounts, resources, audit history and security events.
            </p>
          </div>
          <Link href="/platform/organizations" className="rounded-lg border px-3 py-2 text-sm font-semibold hover:bg-slate-50">
            Manage organisations <ArrowUpRight className="ml-1 inline h-4 w-4" />
          </Link>
        </div>
        {orgs.length === 0 ? <p className="mt-5 text-sm text-slate-500">No subscriber companies have been registered.</p> : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[1020px] text-sm">
              <thead className="border-b bg-slate-50 text-left text-xs uppercase tracking-wider text-slate-600">
                <tr>
                  <th scope="col" className="p-3">Subscriber</th>
                  <th scope="col" className="p-3">Status / plan</th>
                  <th scope="col" className="p-3 text-right">Users</th>
                  <th scope="col" className="p-3 text-right">Vehicles</th>
                  <th scope="col" className="p-3 text-right">Inspections</th>
                  <th scope="col" className="p-3 text-right">Training</th>
                  <th scope="col" className="p-3 text-right">30-day activity</th>
                  <th scope="col" className="p-3 text-right">Security</th>
                  <th scope="col" className="p-3">View</th>
                </tr>
              </thead>
              <tbody>
                {orgs.map((org) => (
                  <tr key={org.id} className="border-b last:border-0">
                    <td className="p-3">
                      <p className="font-semibold">{org.name}</p>
                      <p className="text-xs text-slate-500">{org.slug}</p>
                    </td>
                    <td className="p-3">
                      <Badge tone={org.status === "active" ? "emerald" : org.status === "suspended" ? "red" : "amber"}>{org.status}</Badge>
                      <p className="mt-1 text-xs text-slate-600">{org.subscription?.plan || "No plan"} · {org.subscription?.status || "none"}</p>
                      {!org.operationalAccessEnabled && <p className="mt-1 text-xs text-amber-700">Workspace locked</p>}
                    </td>
                    <td className="p-3 text-right">{org.users}</td>
                    <td className="p-3 text-right">{org.vehicles}</td>
                    <td className="p-3 text-right">{org.inspections}</td>
                    <td className="p-3 text-right">{org.trainingSessions}</td>
                    <td className="p-3 text-right">{org.last30DayActions}</td>
                    <td className="p-3 text-right">{org.unresolvedSecurityEvents > 0
                      ? <strong className="text-red-700">{org.unresolvedSecurityEvents} open</strong> : "Clear"}</td>
                    <td className="p-3">
                      <Link href={`/platform/oversight/${org.id}`} className="inline-flex rounded-lg bg-slate-950 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800">
                        Open oversight <ArrowUpRight className="ml-1 h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <Card className="border border-emerald-100 bg-emerald-50/50 p-5">
        <h2 className="font-semibold text-emerald-950">Governed administration</h2>
        <p className="mt-2 text-sm leading-6 text-emerald-950">
          Platform-level organisation and subscription changes remain in Subscriber Companies.
          Password recovery and audited, MFA-protected, 15-minute read-only support views remain
          in Account Support. This oversight centre never changes organisation ownership,
          bypasses subscriber permissions or exposes authentication secrets.
        </p>
        <div className="mt-3 flex flex-wrap gap-3 text-sm font-semibold">
          <Link href="/platform/account-support" className="underline">Account Support</Link>
          <Link href="/platform/content" className="underline">Content Management Centre</Link>
          <Link href="/platform/notices" className="underline">System Notices</Link>
        </div>
      </Card>
    </main>
  );
}
