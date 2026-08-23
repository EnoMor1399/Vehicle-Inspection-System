import { db } from "@/db";
import { documents, users } from "@/db/schema";
import { desc, sql, eq } from "drizzle-orm";
import { PageHeader, Card, Badge } from "@/components/ui";
import { Upload, AlertTriangle, Clock } from "lucide-react";
import { DocumentsList } from "./DocumentsList";
import { requireAuth } from "@/lib/require-auth";

export const dynamic = "force-dynamic";

export default async function DocumentsPage() {
  await requireAuth();
  
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
        description="Versioned document storage with expiry monitoring, preview, download, and secure access. Covers insurance, registration, roadworthy, permits, photos, and driver licenses."
        action={
          <button className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800">
            <Upload className="h-4 w-4" /> Upload Document
          </button>
        }
      />

      <div className="grid grid-cols-3 gap-4 mb-6">
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
