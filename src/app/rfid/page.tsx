import { requirePermission } from "@/lib/require-auth";
import { PageHeader } from "@/components/ui";
import { RfidScanner } from "@/components/RfidScanner";

export const dynamic = "force-dynamic";

export default async function RfidPage() {
  await requirePermission("vehicles");
  return (
    <div className="p-6 lg:p-10">
      <PageHeader
        eyebrow="Hardware Integration"
        title="RFID Vehicle Scanner"
        description="Identify registered vehicle tags using keyboard-wedge or reader input supported by the browser and workstation configuration."
        action={
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Reader Input Ready
            </span>
          </div>
        }
      />
      <RfidScanner />
    </div>
  );
}
