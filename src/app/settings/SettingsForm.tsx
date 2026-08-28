"use client";

import { useState, useTransition, useRef } from "react";
import { updateSettingsAction } from "./server";
import { Card, Button, Field, TextInput, TextArea } from "@/components/ui";
import {
  Building2, Paintbrush, FileText, Bell, Shield, Save, Loader2,
  CheckCircle2, AlertCircle, Upload, X, Globe, Phone, Mail,
} from "lucide-react";

type SettingsData = {
  logoDataUrl: string | null;
  logoUrl: string | null;
  companyName: string;
  companyShortName: string;
  tagline: string | null;
  themeColor: string;
  accentColor: string;
  address: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  taxId: string | null;
  registrationNumber: string | null;
  certificateValidityMonths: number;
  reinspectionGraceDays: number;
  requireSupervisorApproval: boolean;
  requireGpsCapture: boolean;
  requireDigitalSignature: boolean;
  certificateHeader: string | null;
  certificateFooter: string | null;
  footerText: string | null;
  sessionTimeoutMinutes: number;
  passwordMinLength: number;
  passwordRequireUppercase: boolean;
  passwordRequireNumber: boolean;
  maxFailedAttempts: number;
  lockoutDurationMinutes: number;
  emailNotificationsEnabled: boolean;
  smsNotificationsEnabled: boolean;
  reminderDaysBefore: number;
};

type TabId = "branding" | "organization" | "inspection" | "certificate" | "security" | "notifications";

const TABS: { id: TabId; label: string; icon: typeof Building2; description: string }[] = [
  { id: "branding", label: "Branding", icon: Paintbrush, description: "Logo, company name, colors" },
  { id: "organization", label: "Organization", icon: Building2, description: "Contact & legal information" },
  { id: "inspection", label: "Inspection Defaults", icon: FileText, description: "Workflow rules & defaults" },
  { id: "certificate", label: "Certificates", icon: FileText, description: "Header, footer, validity" },
  { id: "security", label: "Security", icon: Shield, description: "Password policy & sessions" },
  { id: "notifications", label: "Notifications", icon: Bell, description: "Email & SMS settings" },
];

export function SettingsForm({ settings, canEdit }: { settings: SettingsData; canEdit: boolean }) {
  const [activeTab, setActiveTab] = useState<TabId>("branding");
  const [data, setData] = useState<SettingsData>(settings);
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const logoInput = useRef<HTMLInputElement>(null);

  function update<K extends keyof SettingsData>(key: K, value: SettingsData[K]) {
    setData((prev) => ({ ...prev, [key]: value }));
    setStatus(null);
  }

  function handleLogoUpload(file: File) {
    if (file.size > 2 * 1024 * 1024) {
      setStatus({ ok: false, message: "Logo must be smaller than 2MB" });
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      update("logoDataUrl", e.target?.result as string);
    };
    reader.readAsDataURL(file);
  }

  function save() {
    setStatus(null);
    startTransition(async () => {
      const res = await updateSettingsAction(data);
      if (res.ok) {
        setStatus({ ok: true, message: "Settings saved successfully" });
        setTimeout(() => setStatus(null), 3000);
      } else {
        setStatus({ ok: false, message: res.error || "Failed to save" });
      }
    });
  }

  const disabled = !canEdit;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
      {/* Tabs */}
      <aside>
        <Card className="p-2 sticky top-4">
          <div className="space-y-0.5">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg transition flex items-start gap-2.5 ${
                    active ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <Icon className="h-4 w-4 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{tab.label}</p>
                    <p className={`text-xs ${active ? "text-slate-300" : "text-slate-500"}`}>
                      {tab.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>
        </Card>
      </aside>

      {/* Content */}
      <div className="space-y-6">
        <Card className="p-6">
          {activeTab === "branding" && (
            <div className="space-y-6">
              <SectionTitle icon={Paintbrush} title="Branding" description="Logo and visual identity" />

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Company Logo</label>
                <div className="flex items-start gap-4">
                  <div className="h-24 w-24 rounded-xl bg-slate-100 border-2 border-dashed border-slate-300 grid place-items-center overflow-hidden">
                    {data.logoDataUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={data.logoDataUrl} alt="Logo" className="h-full w-full object-contain" />
                    ) : (
                      <Upload className="h-8 w-8 text-slate-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <input
                      ref={logoInput}
                      type="file"
                      accept="image/png,image/jpeg,image/svg+xml"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleLogoUpload(e.target.files[0])}
                    />
                    <div className="flex gap-2 mb-2">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => logoInput.current?.click()}
                        disabled={disabled}
                      >
                        <Upload className="h-3.5 w-3.5" /> Upload Logo
                      </Button>
                      {data.logoDataUrl && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => update("logoDataUrl", null)}
                          disabled={disabled}
                        >
                          <X className="h-3.5 w-3.5" /> Remove
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">PNG, JPG, or SVG · Max 2MB · Recommended 512×512px</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Company Name" required>
                  <TextInput
                    value={data.companyName}
                    onChange={(e) => update("companyName", e.target.value)}
                    disabled={disabled}
                  />
                </Field>
                <Field label="Short Name / Acronym" required>
                  <TextInput
                    value={data.companyShortName}
                    onChange={(e) => update("companyShortName", e.target.value)}
                    disabled={disabled}
                    placeholder="e.g. RSL"
                  />
                </Field>
                <div className="md:col-span-2">
                  <Field label="Tagline">
                    <TextInput
                      value={data.tagline || ""}
                      onChange={(e) => update("tagline", e.target.value)}
                      disabled={disabled}
                      placeholder="Vehicle Inspection Management System"
                    />
                  </Field>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Theme Color" hint="Primary brand color used throughout the UI">
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={data.themeColor}
                      onChange={(e) => update("themeColor", e.target.value)}
                      disabled={disabled}
                      className="h-10 w-16 rounded-lg border border-slate-300 cursor-pointer"
                    />
                    <TextInput
                      value={data.themeColor}
                      onChange={(e) => update("themeColor", e.target.value)}
                      disabled={disabled}
                      placeholder="#f59e0b"
                    />
                  </div>
                </Field>
                <Field label="Accent Color" hint="Secondary color for backgrounds">
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={data.accentColor}
                      onChange={(e) => update("accentColor", e.target.value)}
                      disabled={disabled}
                      className="h-10 w-16 rounded-lg border border-slate-300 cursor-pointer"
                    />
                    <TextInput
                      value={data.accentColor}
                      onChange={(e) => update("accentColor", e.target.value)}
                      disabled={disabled}
                      placeholder="#0f172a"
                    />
                  </div>
                </Field>
              </div>

              {data.logoDataUrl && (
                <div className="p-4 rounded-lg bg-slate-50">
                  <p className="text-xs uppercase tracking-wider text-slate-500 font-semibold mb-2">Preview</p>
                  <div className="flex items-center gap-3 p-3 bg-white rounded-lg ring-1 ring-slate-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={data.logoDataUrl} alt="Logo" className="h-10 w-10 object-contain" />
                    <div>
                      <p className="font-semibold text-slate-950">{data.companyName}</p>
                      <p className="text-xs text-slate-500">{data.tagline}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === "organization" && (
            <div className="space-y-6">
              <SectionTitle icon={Building2} title="Organization Details" description="Contact and legal information" />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Field label="Street Address">
                    <TextArea
                      rows={2}
                      value={data.address || ""}
                      onChange={(e) => update("address", e.target.value)}
                      disabled={disabled}
                    />
                  </Field>
                </div>
                <Field label="City">
                  <TextInput value={data.city || ""} onChange={(e) => update("city", e.target.value)} disabled={disabled} />
                </Field>
                <Field label="Region / State">
                  <TextInput value={data.region || ""} onChange={(e) => update("region", e.target.value)} disabled={disabled} />
                </Field>
                <Field label="Country">
                  <TextInput value={data.country || ""} onChange={(e) => update("country", e.target.value)} disabled={disabled} />
                </Field>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Phone">
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <TextInput
                      className="pl-9"
                      value={data.phone || ""}
                      onChange={(e) => update("phone", e.target.value)}
                      disabled={disabled}
                    />
                  </div>
                </Field>
                <Field label="Email">
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <TextInput
                      className="pl-9"
                      value={data.email || ""}
                      onChange={(e) => update("email", e.target.value)}
                      disabled={disabled}
                    />
                  </div>
                </Field>
                <Field label="Website">
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <TextInput
                      className="pl-9"
                      value={data.website || ""}
                      onChange={(e) => update("website", e.target.value)}
                      disabled={disabled}
                    />
                  </div>
                </Field>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Tax ID / TIN">
                  <TextInput value={data.taxId || ""} onChange={(e) => update("taxId", e.target.value)} disabled={disabled} />
                </Field>
                <Field label="Registration Number">
                  <TextInput value={data.registrationNumber || ""} onChange={(e) => update("registrationNumber", e.target.value)} disabled={disabled} />
                </Field>
              </div>
            </div>
          )}

          {activeTab === "inspection" && (
            <div className="space-y-6">
              <SectionTitle icon={FileText} title="Inspection Defaults" description="Workflow rules and default values" />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Certificate Validity (months)">
                  <TextInput
                    type="number"
                    min={1}
                    max={24}
                    value={data.certificateValidityMonths}
                    onChange={(e) => update("certificateValidityMonths", parseInt(e.target.value) || 6)}
                    disabled={disabled}
                  />
                </Field>
                <Field label="Re-inspection Grace Period (days)">
                  <TextInput
                    type="number"
                    min={0}
                    max={90}
                    value={data.reinspectionGraceDays}
                    onChange={(e) => update("reinspectionGraceDays", parseInt(e.target.value) || 14)}
                    disabled={disabled}
                  />
                </Field>
              </div>

              <div className="space-y-3">
                <Toggle
                  label="Require Supervisor Approval"
                  description="Inspections must be approved by a supervisor before certificate is issued"
                  checked={data.requireSupervisorApproval}
                  onChange={(v) => update("requireSupervisorApproval", v)}
                  disabled={disabled}
                />
                <Toggle
                  label="Require GPS Capture"
                  description="Force inspectors to capture GPS coordinates for every inspection"
                  checked={data.requireGpsCapture}
                  onChange={(v) => update("requireGpsCapture", v)}
                  disabled={disabled}
                />
                <Toggle
                  label="Require Digital Signature"
                  description="Inspector and supervisor must sign digitally on every inspection"
                  checked={data.requireDigitalSignature}
                  onChange={(v) => update("requireDigitalSignature", v)}
                  disabled={disabled}
                />
              </div>
            </div>
          )}

          {activeTab === "certificate" && (
            <div className="space-y-6">
              <SectionTitle icon={FileText} title="Certificate Governance" description="Formal document text, verification notice, and validity controls" />

              <Field label="Certificate Header" hint="Optional controlled statement shown beneath the certificate title">
                <TextArea
                  rows={3}
                  value={data.certificateHeader || ""}
                  onChange={(e) => update("certificateHeader", e.target.value)}
                  disabled={disabled}
                />
              </Field>

              <Field label="Certificate Footer" hint="Controlled legal/verification notice shown at the bottom of issued certificates">
                <TextArea
                  rows={3}
                  value={data.certificateFooter || ""}
                  onChange={(e) => update("certificateFooter", e.target.value)}
                  disabled={disabled}
                />
              </Field>

              <Field label="Application Footer Text" hint="Appears in the sidebar of the application">
                <TextInput
                  value={data.footerText || ""}
                  onChange={(e) => update("footerText", e.target.value)}
                  disabled={disabled}
                />
              </Field>
            </div>
          )}

          {activeTab === "security" && (
            <div className="space-y-6">
              <SectionTitle icon={Shield} title="Security Policy" description="Enterprise password, lockout, and session standards" />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Session Timeout (minutes)">
                  <TextInput
                    type="number"
                    min={5}
                    value={data.sessionTimeoutMinutes}
                    onChange={(e) => update("sessionTimeoutMinutes", parseInt(e.target.value) || 480)}
                    disabled={disabled}
                  />
                </Field>
                <Field label="Max Failed Login Attempts">
                  <TextInput
                    type="number"
                    min={1}
                    max={20}
                    value={data.maxFailedAttempts}
                    onChange={(e) => update("maxFailedAttempts", parseInt(e.target.value) || 5)}
                    disabled={disabled}
                  />
                </Field>
                <Field label="Lockout Duration (minutes)">
                  <TextInput
                    type="number"
                    min={1}
                    value={data.lockoutDurationMinutes}
                    onChange={(e) => update("lockoutDurationMinutes", parseInt(e.target.value) || 15)}
                    disabled={disabled}
                  />
                </Field>
              </div>

              <div>
                <p className="text-sm font-medium text-slate-700 mb-3">Password Requirements</p>
                <div className="space-y-3">
                  <Field label="Minimum Length">
                    <TextInput
                      type="number"
                      min={10}
                      max={64}
                      value={data.passwordMinLength}
                      onChange={(e) => update("passwordMinLength", parseInt(e.target.value) || 12)}
                      disabled={disabled}
                    />
                  </Field>
                  <Toggle
                    label="Require Uppercase Letter"
                    description="Password must contain at least one uppercase letter"
                    checked={data.passwordRequireUppercase}
                    onChange={(v) => update("passwordRequireUppercase", v)}
                    disabled={disabled}
                  />
                  <Toggle
                    label="Require Number"
                    description="Password must contain at least one digit"
                    checked={data.passwordRequireNumber}
                    onChange={(v) => update("passwordRequireNumber", v)}
                    disabled={disabled}
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === "notifications" && (
            <div className="space-y-6">
              <SectionTitle icon={Bell} title="Notification Policy" description="Policy flags and reminder lead time; external delivery providers must be configured separately" />

              <div className="space-y-3">
                <Toggle
                  label="Email Notifications"
                  description="Enable email-delivery policy after an approved SMTP/email provider is configured and tested"
                  checked={data.emailNotificationsEnabled}
                  onChange={(v) => update("emailNotificationsEnabled", v)}
                  disabled={disabled}
                />
                <Toggle
                  label="SMS Notifications"
                  description="Enable SMS-delivery policy only after an approved SMS gateway is configured and tested"
                  checked={data.smsNotificationsEnabled}
                  onChange={(v) => update("smsNotificationsEnabled", v)}
                  disabled={disabled}
                />
              </div>

              <Field label="Reminder Lead Time (days)" hint="Policy lead time for reminder generation; delivery depends on configured channels">
                <TextInput
                  type="number"
                  min={1}
                  max={90}
                  value={data.reminderDaysBefore}
                  onChange={(e) => update("reminderDaysBefore", parseInt(e.target.value) || 30)}
                  disabled={disabled}
                />
              </Field>
            </div>
          )}
        </Card>

        {/* Status message */}
        {status && (
          <div
            className={`rounded-lg px-4 py-3 text-sm flex items-start gap-2 ${
              status.ok
                ? "bg-emerald-50 border border-emerald-200 text-emerald-900"
                : "bg-red-50 border border-red-200 text-red-900"
            }`}
          >
            {status.ok ? (
              <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
            ) : (
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
            )}
            <span>{status.message}</span>
          </div>
        )}

        {/* Save button */}
        {canEdit && (
          <div className="sticky bottom-4 flex items-center justify-end gap-2 bg-white rounded-2xl p-4 shadow-lg ring-1 ring-slate-200">
            <Button
              variant="secondary"
              onClick={() => setData(settings)}
              disabled={pending}
            >
              Reset
            </Button>
            <Button onClick={save} disabled={pending}>
              {pending ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</>
              ) : (
                <><Save className="h-4 w-4" /> Save Changes</>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function SectionTitle({ icon: Icon, title, description }: { icon: typeof Building2; title: string; description: string }) {
  return (
    <div className="flex items-start gap-3 pb-4 border-b border-slate-200">
      <div className="h-10 w-10 rounded-xl bg-slate-100 text-slate-700 grid place-items-center shrink-0">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
        <p className="text-sm text-slate-500">{description}</p>
      </div>
    </div>
  );
}

function Toggle({
  label,
  description,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4 p-3 rounded-lg hover:bg-slate-50">
      <div className="flex-1">
        <p className="text-sm font-medium text-slate-900">{label}</p>
        {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        onClick={() => !disabled && onChange(!checked)}
        disabled={disabled}
        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors ${
          checked ? "bg-emerald-600" : "bg-slate-300"
        } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
      >
        <span
          className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform mt-0.5 ${
            checked ? "translate-x-5 ml-0.5" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}
