import { requireAuth } from "@/lib/require-auth";
import { PageHeader, Card } from "@/components/ui";
import { RfidScanner } from "@/components/RfidScanner";
import { Radio } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function RfidPage() {
  await requireAuth();
  return (
    <div className="p-6 lg:p-10">
      <PageHeader
        eyebrow="Hardware Integration"
        title="RFID Vehicle Scanner"
        description="Scan vehicle RFID tags for instant identification. Compatible with USB and Bluetooth RFID readers."
        action={
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 text-xs font-medium">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Scanner Ready
            </span>
          </div>
        }
      />
      <RfidScanner />
    </div>
  );
}
