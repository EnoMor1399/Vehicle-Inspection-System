// Pure navigation map shared by the sidebar and scoped oversight pages.
// A Super Admin's selected organization is NOT an authenticated tenant change.
// Operational links stay within protected, read-only /platform/oversight/:id routes.
export const SCOPED_NAV_SECTIONS = {
  "/vehicles": "vehicles",
  "/transporters": "transporters",
  "/inspections": "inspections",
  "/daily-inspections": "daily-inspections",
  "/schedule": "scheduling",
  "/locations": "stations",
  "/driver-training": "training",
  "/reports": "reports",
  "/compliance": "compliance",
  "/predictive": "maintenance-risk",
  "/powerbi": "powerbi",
  "/rfid": "rfid",
  "/users": "users",
  "/documents": "documents",
  "/import": "import-export",
  "/settings": "settings",
  "/organization/account": "settings",
  "/audit": "audit",
  "/notifications": "notifications",
  "/portal": "transporter-portal",
} as const;

export type ScopedSection = (typeof SCOPED_NAV_SECTIONS)[keyof typeof SCOPED_NAV_SECTIONS];

export const SCOPED_SECTION_DETAILS: Record<ScopedSection, {
  title: string;
  description: string;
  inventoryKind?: "vehicle" | "station" | "equipment" | "rfid" | "transporter" | "document" | "training";
}> = {
  vehicles: { title: "Vehicles", description: "The selected organization's registered vehicle inventory.", inventoryKind: "vehicle" },
  transporters: { title: "Transporters", description: "Transporter companies registered with the selected organization.", inventoryKind: "transporter" },
  inspections: { title: "Inspections", description: "Scoped inspection outcomes and workflow history." },
  "daily-inspections": { title: "Daily Pre-Trip", description: "Scoped pre-trip inspection and vehicle clearance records." },
  scheduling: { title: "Inspection Scheduling", description: "Scoped inspection appointment and scheduled work." },
  stations: { title: "Stations", description: "Inspection stations and available equipment.", inventoryKind: "station" },
  training: { title: "Driver Training & Assessment", description: "The selected organization's training sessions.", inventoryKind: "training" },
  reports: { title: "Reports & Analytics", description: "Organization-specific operational totals and safety indicators." },
  compliance: { title: "Compliance Centre", description: "Scoped inspection concerns and vehicle compliance expiries." },
  "maintenance-risk": { title: "Maintenance Risk", description: "Inspection failure indicators for the selected organization's vehicles." },
  powerbi: { title: "Power BI", description: "Scoped reporting totals and the safely restricted Power BI integration boundary." },
  rfid: { title: "RFID Operations", description: "RFID tags registered under the selected organization.", inventoryKind: "rfid" },
  users: { title: "Vehicle Inspection Users", description: "Scoped staff account, role and access statuses." },
  documents: { title: "Documents", description: "Scoped document metadata, without protected file contents.", inventoryKind: "document" },
  "import-export": { title: "Import / Export", description: "Scoped import history and read-only inventory previews." },
  settings: { title: "Settings", description: "Organization status and links to the protected platform company settings." },
  audit: { title: "Audit Log", description: "Organization-specific administrator and system activity." },
  notifications: { title: "Notifications", description: "Organization-specific security alerts and platform change notices." },
  "transporter-portal": { title: "Transporter Portal", description: "Scoped transporter inventory without impersonating a subscriber.", inventoryKind: "transporter" },
};

export function isScopedSection(value: string): value is ScopedSection {
  return Object.prototype.hasOwnProperty.call(SCOPED_SECTION_DETAILS, value);
}

export function scopedOrganizationHref(organizationId: string, href: string): string {
  const base = `/platform/oversight/${encodeURIComponent(organizationId)}`;
  if (href === "/") return base;
  const section = SCOPED_NAV_SECTIONS[href as keyof typeof SCOPED_NAV_SECTIONS];
  return section ? `${base}/section/${section}` : href;
}
