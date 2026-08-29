import { requirePermission } from "@/lib/require-auth";
import { PageHeader } from "@/components/ui";
import { RfidScanner } from "@/components/RfidScanner";

export const dynamic = "force-dynamic";

export default async function RfidPage() {
  await requirePermission("vehicles");

  return (
    <div className="mx-auto max-w-[1500px] p-4 sm:p-6 lg:p-8 xl:p-10">
      <PageHeader
        title="RFID Vehicle Scanner"
        description="Scan a registered RFID tag to identify a vehicle and continue directly to its inspection workflow."
      />
      <RfidScanner />
    </div>
  );
}
