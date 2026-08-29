"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Clipboard,
  Clock3,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Plus,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { Badge, Button, Card, Select, TextInput } from "@/components/ui";
import { generateApiKeyAction, revokeApiKeyAction } from "./server";

type ApiKeyRow = {
  id: string;
  name: string;
  keyPrefix: string;
  scopes: string[];
  isActive: boolean;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
};

type GeneratedKey = {
  id: string;
  raw: string;
  prefix: string;
  name: string;
  scopes: string[];
  expiresAt: string | null;
};

const SCOPE_OPTIONS = [
  { value: "read", label: "Read", description: "Reports, Power BI and read-only API access." },
  { value: "write", label: "Write", description: "Create and update supported records." },
  { value: "inspect", label: "Inspect", description: "Create and manage inspection operations." },
  { value: "admin", label: "Admin", description: "Wildcard API scope. Super Administrator only." },
];

export function ApiKeyManager({
  initialKeys,
  isSuperAdmin,
}: {
  initialKeys: ApiKeyRow[];
  isSuperAdmin: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("Power BI Read Access");
  const [scopes, setScopes] = useState<string[]>(["read"]);
  const [expiry, setExpiry] = useState("90");
  const [generated, setGenerated] = useState<GeneratedKey | null>(null);
  const [showGenerated, setShowGenerated] = useState(true);
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);

  const activeCount = useMemo(
    () => initialKeys.filter((key) => key.isActive && (!key.expiresAt || new Date(key.expiresAt) > new Date())).length,
    [initialKeys],
  );

  function toggleScope(scope: string) {
    if (scope === "admin" && !isSuperAdmin) return;
    setScopes((current) =>
      current.includes(scope) ? current.filter((item) => item !== scope) : [...current, scope],
    );
    setStatus(null);
  }

  function generateKey() {
    setStatus(null);
    setGenerated(null);
    setCopied(false);

    startTransition(async () => {
      const result = await generateApiKeyAction({
        name,
        scopes,
        expiresInDays: expiry === "never" ? null : Number(expiry),
      });

      if (!result.ok) {
        setStatus({ ok: false, message: result.error });
        return;
      }

      setGenerated(result.key);
      setShowGenerated(true);
      setStatus({ ok: true, message: "API key generated. Copy it now; the full value will not be shown again." });
      router.refresh();
    });
  }

  async function copyGeneratedKey() {
    if (!generated) return;
    try {
      await navigator.clipboard.writeText(generated.raw);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setStatus({ ok: false, message: "Copy failed. Select the displayed key and copy it manually." });
    }
  }

  function revokeKey(id: string, label: string) {
    if (!window.confirm(`Revoke API key “${label}”? Applications using it will stop working immediately.`)) return;

    setStatus(null);
    startTransition(async () => {
      const result = await revokeApiKeyAction(id);
      if (!result.ok) {
        setStatus({ ok: false, message: result.error || "Unable to revoke API key." });
        return;
      }
      setStatus({ ok: true, message: "API key revoked." });
      router.refresh();
    });
  }

  return (
    <Card className="overflow-hidden">
      <div className="border-b border-slate-200 bg-gradient-to-r from-slate-950 via-slate-900 to-emerald-950 px-5 py-5 text-white sm:px-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/10 ring-1 ring-white/15">
              <KeyRound className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">API Key Management</h2>
              <p className="mt-1 max-w-2xl text-sm text-slate-300">
                Generate secure keys for Power BI and approved integrations. Full keys are shown once and are hashed at rest.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Badge tone="emerald">{activeCount} active</Badge>
            <Badge tone="blue">{initialKeys.length} total</Badge>
          </div>
        </div>
      </div>

      <div className="grid gap-6 p-5 sm:p-6 xl:grid-cols-[.85fr_1.15fr]">
        <section>
          <div className="mb-4">
            <h3 className="font-semibold text-slate-950">Generate a new API key</h3>
            <p className="mt-1 text-sm text-slate-500">For Power BI, the default Read scope is sufficient.</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Key name</label>
              <TextInput
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setStatus(null);
                }}
                placeholder="e.g. Power BI Read Access"
                maxLength={100}
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <label className="text-sm font-semibold text-slate-700">Scopes</label>
                <span className="text-xs text-slate-500">Select least privilege needed</span>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                {SCOPE_OPTIONS.map((option) => {
                  const selected = scopes.includes(option.value);
                  const disabled = option.value === "admin" && !isSuperAdmin;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      disabled={disabled}
                      onClick={() => toggleScope(option.value)}
                      className={`rounded-xl border p-3 text-left transition ${
                        selected
                          ? "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-200"
                          : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                      } ${disabled ? "cursor-not-allowed opacity-45" : ""}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold text-slate-900">{option.label}</span>
                        <span className={`grid h-5 w-5 place-items-center rounded-md border ${selected ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 bg-white"}`}>
                          {selected && <Check className="h-3.5 w-3.5" />}
                        </span>
                      </div>
                      <p className="mt-1 text-xs leading-5 text-slate-500">{option.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700">Expiry</label>
              <Select value={expiry} onChange={(event) => setExpiry(event.target.value)}>
                <option value="7">7 days</option>
                <option value="30">30 days</option>
                <option value="90">90 days — recommended</option>
                <option value="180">180 days</option>
                <option value="365">1 year</option>
                <option value="never">No expiry</option>
              </Select>
            </div>

            <Button
              type="button"
              onClick={generateKey}
              disabled={pending || name.trim().length < 3 || scopes.length === 0}
              className="w-full sm:w-auto"
            >
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              {pending ? "Generating…" : "Generate API Key"}
            </Button>

            {status && (
              <div className={`rounded-xl px-4 py-3 text-sm ${status.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-700"}`}>
                {status.message}
              </div>
            )}
          </div>

          {generated && (
            <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-emerald-950">Copy this key now</p>
                  <p className="mt-1 text-xs leading-5 text-emerald-800">
                    VIMS will not be able to display the full key again after this screen is refreshed.
                  </p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-200 bg-white p-3">
                <code className="min-w-0 flex-1 break-all font-mono text-xs text-slate-900">
                  {showGenerated ? generated.raw : `${generated.prefix}••••••••••••••••••••••••••••`}
                </code>
                <button
                  type="button"
                  onClick={() => setShowGenerated((value) => !value)}
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                  aria-label={showGenerated ? "Hide generated key" : "Show generated key"}
                >
                  {showGenerated ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
                <button
                  type="button"
                  onClick={copyGeneratedKey}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-950 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Clipboard className="h-3.5 w-3.5" />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="min-w-0">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold text-slate-950">Your API keys</h3>
              <p className="mt-1 text-sm text-slate-500">Only prefixes are retained for identification; full secret values are not recoverable.</p>
            </div>
          </div>

          {initialKeys.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center">
              <KeyRound className="mx-auto h-8 w-8 text-slate-400" />
              <p className="mt-3 font-semibold text-slate-900">No API keys yet</p>
              <p className="mt-1 text-sm text-slate-500">Generate a Read key to connect Power BI.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.08em] text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Name / Key</th>
                      <th className="px-4 py-3">Scopes</th>
                      <th className="px-4 py-3">Last used</th>
                      <th className="px-4 py-3">Expiry</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {initialKeys.map((key) => {
                      const expired = Boolean(key.expiresAt && new Date(key.expiresAt) <= new Date());
                      const active = key.isActive && !expired;
                      return (
                        <tr key={key.id} className="align-top">
                          <td className="px-4 py-3">
                            <p className="font-semibold text-slate-900">{key.name}</p>
                            <code className="mt-1 block font-mono text-xs text-slate-500">{key.keyPrefix}••••</code>
                            <p className="mt-1 text-[11px] text-slate-400">Created {formatDate(key.createdAt)}</p>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex flex-wrap gap-1">
                              {key.scopes.map((scope) => <Badge key={scope} tone={scope === "admin" ? "red" : scope === "read" ? "blue" : "slate"}>{scope}</Badge>)}
                            </div>
                          </td>
                          <td className="px-4 py-3 text-slate-600">{key.lastUsedAt ? formatDate(key.lastUsedAt) : "Never"}</td>
                          <td className="px-4 py-3 text-slate-600">
                            <div className="flex items-center gap-1.5">
                              <Clock3 className="h-3.5 w-3.5 text-slate-400" />
                              {key.expiresAt ? formatDate(key.expiresAt) : "No expiry"}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <Badge tone={active ? "emerald" : expired && key.isActive ? "amber" : "red"}>
                              {active ? "Active" : expired && key.isActive ? "Expired" : "Revoked"}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-right">
                            {key.isActive ? (
                              <button
                                type="button"
                                onClick={() => revokeKey(key.id, key.name)}
                                disabled={pending}
                                className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                              >
                                <Trash2 className="h-3.5 w-3.5" /> Revoke
                              </button>
                            ) : (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      </div>
    </Card>
  );
}

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}
