"use client";

import { Card, Badge, EmptyState } from "@/components/ui";
import { DocumentActions } from "./DocumentActions";
import { FileText } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface DocumentsListProps {
  rows: any[];
}

export function DocumentsList({ rows }: DocumentsListProps) {
  const now = new Date();
  const in30 = new Date(now.getTime() + 30 * 24 * 3600 * 1000);

  if (rows.length === 0) {
    return (
      <Card>
        <EmptyState icon={<FileText className="h-10 w-10" />} title="No documents uploaded" />
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr className="text-left text-xs uppercase tracking-wider text-slate-500">
              <th className="py-3 px-4">Document</th>
              <th className="py-3 px-4">Type</th>
              <th className="py-3 px-4">Owner</th>
              <th className="py-3 px-4">Version</th>
              <th className="py-3 px-4">Size</th>
              <th className="py-3 px-4">Expires</th>
              <th className="py-3 px-4">Uploaded By</th>
              <th className="py-3 px-4"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((d: any) => {
              const expiry = d.expiryDate ? new Date(d.expiryDate) : null;
              const daysToExpire = expiry ? Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : null;
              const tone = daysToExpire == null ? "slate" : daysToExpire < 0 ? "red" : daysToExpire <= 30 ? "amber" : "emerald";
              return (
                <tr key={d.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-slate-500" />
                      <div>
                        <p className="font-medium text-slate-900">{d.name}</p>
                        <p className="text-xs text-slate-500">{formatDate(d.uploadedAt)}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <Badge tone="blue">{d.type}</Badge>
                  </td>
                  <td className="py-3 px-4 text-slate-600 capitalize">{d.ownerType}</td>
                  <td className="py-3 px-4 text-slate-600">v{d.version}</td>
                  <td className="py-3 px-4 text-slate-600 text-xs">
                    {d.sizeBytes ? `${Math.round(d.sizeBytes / 1024)} KB` : "—"}
                  </td>
                  <td className="py-3 px-4">
                    {d.expiryDate ? (
                      <Badge tone={tone as any}>
                        {formatDate(d.expiryDate)}
                        {daysToExpire !== null && (
                          <span className="ml-1 opacity-75">
                            ({daysToExpire >= 0 ? `${daysToExpire}d` : "expired"})
                          </span>
                        )}
                      </Badge>
                    ) : (
                      <span className="text-slate-400 text-xs">No expiry</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-slate-600">{d.uploadedBy || "—"}</td>
                  <td className="py-3 px-4 text-right">
                    <DocumentActions url={d.url} name={d.name} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
