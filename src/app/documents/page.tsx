import { db } from "@/db";
import { documents, users } from "@/db/schema";
import { desc, eq } from "drizzle-orm";
import { PageHeader, Card, Badge } from "@/components/ui";
import { AlertTriangle, Clock, ShieldCheck } from "lucide-react";
import { DocumentsList } from "./DocumentsList";
import { requirePermission } from "@/lib/require-auth";

export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  await requirePermission("documents");
  
  const rows = await db
    .select({
      id: documents.id,
      name: documents.name,
      type: documents.type,
      ownerType: documents.ownerType,
      ownerId: documents.ownerId,
      url: documents.url,
      mimeType: documents.mimeType,
      sizeBytes: documents.sizeBytes,
      version: documents.version,
      expiryDate: documents.expiryDate,
      uploadedAt: documents.createdAt,
      uploadedBy: users.name,
    })
    .from(documents)
    .leftJoin(users, eq(users.id, documents.uploadedBy))
    .orderBy(desc(documents.createdAt));

  const now = new Date();
  const in30 = new Date(now.getTime() + 30 * 24 * 3600 * 1000);
  const expired = rows.filter((r) => r.expiryDate && new Date(r.expiryDate) < now).length;
  const expiringSoon = rows.filter((r) => r.expiryDate && new Date(r.expiryDate) >= now && new Date(r.expiryDate) <= in30).length;
  const valid = rows.filter((r) => !r.expiryDate || new Date(r.expiryDate) > in30).length;

  return (
    <div className="p-6 lg:p-10">
      <PageHeader
        eyebrow="Document Management"
        title="Documents & Certificates"
        description="Controlled document registry with expiry monitoring, preview, and download for records already stored in approved locations."
        action={<Badge tone="blue"><ShieldCheck className="h-3.5 w-3.5" /> Controlled registry</Badge>}
      />

      <div className="mb-6 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        <p className="font-semibold">Document storage integration</p>
        <p className="mt-1 text-xs leading-relaxed text-blue-800">Direct file upload is intentionally disabled until an approved object-storage provider is configured. This avoids storing unrestricted file payloads inside the application database. Existing registered documents remain available for preview and download.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-emerald-100 text-emerald-700 grid place-items-center">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Valid</p>
            <p className="text-2xl font-semibold text-emerald-700">{valid}</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-amber-100 text-amber-700 grid place-items-center">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Expiring Soon (≤30d)</p>
            <p className="text-2xl font-semibold text-amber-700">{expiringSoon}</p>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-red-100 text-red-700 grid place-items-center">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <p className="text-xs text-slate-500">Expired</p>
            <p className="text-2xl font-semibold text-red-700">{expired}</p>
          </div>
        </Card>
      </div>

      <DocumentsList rows={rows} />
    </div>
  );
}
