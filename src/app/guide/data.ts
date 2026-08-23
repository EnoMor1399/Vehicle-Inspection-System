export interface GuideSection {
  id: string;
  title: string;
  icon: string;
  subsections: {
    id: string;
    title: string;
    content?: string;
    steps?: string[];
    tips?: string[];
    warnings?: string[];
    roles?: string[];
  }[];
}

export const GUIDE_SECTIONS: GuideSection[] = [
  {
    id: "getting-started",
    title: "Getting Started",
    icon: "🚀",
    subsections: [
      {
        id: "welcome",
        title: "Welcome to RSL VIMS",
        content: "Road Safety Limited Vehicle Inspection Management System (VIMS) is an enterprise-grade platform that digitizes, automates, and centralizes the entire vehicle inspection lifecycle. It replaces manual Excel-based processes with a modern, secure, and scalable solution.",
        tips: [
          "VIMS is accessible from any device: desktop, tablet, or mobile phone",
          "Install the Progressive Web App (PWA) for offline access",
          "The system automatically saves your progress during inspections",
        ],
      },
      {
        id: "login",
        title: "Logging In",
        content: "Access the system at your organization's URL. Use your assigned email and password to sign in.",
        steps: [
          "Navigate to the login page",
          "Enter your email address",
          "Enter your password",
          "Click 'Sign In'",
          "You will be redirected to the Dashboard",
        ],
        tips: [
          "Development demo accounts are disabled in production builds",
          "Check 'Remember me' to stay signed in for 30 days",
          "After 5 failed attempts, your account locks for 15 minutes",
        ],
        warnings: [
          "Never share your password with other users",
          "Sign out when using a shared computer",
        ],
      },
      {
        id: "navigation",
        title: "Understanding the Interface",
        content: "The main interface has a sidebar for navigation, a top toolbar for quick actions, and a central content area. The sidebar contains all modules organized by function.",
        tips: [
          "On mobile, tap the menu icon (☰) to open the sidebar",
          "The active module is highlighted in the sidebar",
          "The system remembers your last visited page",
          "Use browser back/forward buttons safely — state is preserved",
        ],
      },
      {
        id: "roles",
        title: "User Roles & Permissions",
        content: "Your access level depends on your assigned role. Each role has specific permissions for viewing, creating, editing, and approving records.",
        steps: [
          "Super Administrator: Full system access, can manage all settings and users",
          "Administrator: Can manage most settings, users, and all operational data",
          "Operations Manager: Oversees daily operations across stations",
          "Supervisor: Reviews and approves inspections",
          "Inspector: Performs vehicle inspections",
          "Data Entry Officer: Imports data and manages records",
          "Auditor: Read-only access to reports and audit logs",
          "Compliance Officer: Monitors compliance and generates reports",
          "Viewer: Read-only access to operational data",
          "Transporter User: Portal access for transport company staff",
        ],
      },
    ],
  },
  {
    id: "dashboard",
    title: "Dashboard",
    icon: "📊",
    subsections: [
      {
        id: "overview",
        title: "Executive Dashboard",
        content: "The Dashboard provides a real-time overview of your inspection operations with KPIs, trend charts, and quick access to key actions.",
        tips: [
          "KPI cards show totals, pass rates, and alerts at a glance",
          "The 12-month trend chart visualizes pass vs fail patterns",
          "Station comparison shows performance across all locations",
          "Click any chart element to drill down into details",
        ],
      },
      {
        id: "daily-checks-widget",
        title: "Today's Pre-Trip Inspections",
        content: "The dashboard widget shows today's daily pre-trip inspections, indicating which vehicles are cleared to depart and which are grounded.",
        steps: [
          "Review the 'Cleared' or 'Grounded' status for each vehicle",
          "Click on any inspection to view full details",
          "Use 'Start Today's Inspection' for vehicles not yet checked",
        ],
      },
      {
        id: "alerts",
        title: "Expiry Alerts",
        content: "The dashboard highlights certificates expiring within 30 days, upcoming inspections, and pending re-inspections requiring attention.",
        warnings: [
          "Vehicles with expired certificates cannot be legally operated",
          "Address alerts promptly to maintain fleet compliance",
        ],
      },
    ],
  },
  {
    id: "vehicles",
    title: "Vehicle Management",
    icon: "🚗",
    subsections: [
      {
        id: "view-vehicles",
        title: "Viewing Vehicles",
        content: "The Vehicles page displays all registered vehicles with status indicators, last inspection results, and linked transporter information.",
        tips: [
          "Status badges show: Active (green), Failed (red), Under Inspection (blue), Suspended (red)",
          "Use the search bar to find vehicles by registration number",
          "Filter by status to focus on specific vehicle groups",
        ],
      },
      {
        id: "add-vehicle",
        title: "Adding a New Vehicle",
        content: "Register new vehicles with comprehensive details including identification, specifications, ownership, and compliance documents.",
        steps: [
          "Click 'Add Vehicle' button in the top right",
          "Enter registration number (required, must be unique)",
          "Fill in make, model, body type, and category",
          "Add VIN, chassis number, and engine number",
          "Select fuel type and transmission",
          "Link to transporter if applicable",
          "Enter ownership and insurance details",
          "Add expiry dates for insurance, roadworthy, and road fund",
          "Click 'Save'",
        ],
        warnings: [
          "Registration number must be unique across the system",
          "Expiry dates trigger automatic notifications before expiry",
        ],
      },
      {
        id: "vehicle-details",
        title: "Vehicle Detail View",
        content: "The vehicle detail page shows complete information including inspection history, linked documents, and expiry countdown.",
        tips: [
          "Expiry dates show days remaining with color coding",
          "Inspection history lists all past inspections with results",
          "Use 'Start Inspection' to begin a new inspection",
          "Edit button allows updating vehicle information",
        ],
      },
      {
        id: "export-vehicles",
        title: "Exporting Vehicle Data",
        content: "Export the vehicle registry to CSV, Excel, PDF, or JSON formats for reporting or backup.",
        steps: [
          "Click the 'Export' dropdown button",
          "Select your preferred format",
          "File downloads automatically to your device",
        ],
      },
    ],
  },
  {
    id: "transporters",
    title: "Transporter Management",
    icon: "🚚",
    subsections: [
      {
        id: "view-transporters",
        title: "Viewing Transporters",
        content: "Transporters are displayed as cards showing company info, fleet size, and compliance rate with progress bars.",
        tips: [
          "Compliance rate is calculated from all inspections",
          "Fleet size shows total vehicles linked to the transporter",
          "Click any card to view detailed profile",
        ],
      },
      {
        id: "add-transporter",
        title: "Adding a Transporter",
        content: "Register transport companies with full contact details, documentation, and insurance information.",
        steps: [
          "Click 'Add Transporter' button",
          "Enter company name (required)",
          "Add registration number and TIN",
          "Fill in contact person and details",
          "Add GPS address and physical address",
          "Enter insurance information and expiry",
          "Upload company documents",
          "Click 'Save'",
        ],
      },
      {
        id: "transporter-profile",
        title: "Transporter Profile",
        content: "The profile page shows fleet overview, compliance metrics, document library, and complete inspection history.",
        tips: [
          "Fleet Overview lists all vehicles with latest inspection status",
          "Documents tab shows uploaded certificates and permits",
          "Inspection History provides chronological view of all inspections",
          "Compliance Score gives quick health assessment",
        ],
      },
      {
        id: "soft-delete",
        title: "Soft Delete & Archive",
        content: "Transporters are soft-deleted rather than permanently removed, preserving historical data and audit trails.",
        tips: [
          "Deleted transporters can be restored by administrators",
          "Vehicles linked to deleted transporters remain in the system",
          "Archive action marks inactive transporters without deletion",
        ],
      },
    ],
  },
  {
    id: "inspections",
    title: "Bi-Annual Inspections",
    icon: "🔍",
    subsections: [
      {
        id: "biannual-overview",
        title: "Comprehensive Inspection Overview",
        content: "Bi-annual inspections are thorough evaluations performed every 6 months covering 16 sections (A-P) with 150+ inspection items. They determine roadworthiness certification.",
        tips: [
          "Bi-annual inspections are distinct from daily pre-trip checks",
          "Results determine 6-month roadworthiness certification",
          "Inspector and supervisor signatures are required for certification",
        ],
      },
      {
        id: "start-inspection",
        title: "Starting a New Inspection",
        content: "Begin inspections from the Inspections page or directly from a vehicle's detail page.",
        steps: [
          "Click 'New Inspection' button",
          "Select the vehicle to inspect",
          "Enter inspection date and time",
          "Confirm inspector name (auto-filled)",
          "Select inspection station",
          "Choose inspection template (Bus, Truck, Tanker, etc.)",
          "Capture GPS location (if required)",
          "Click 'Start Inspection'",
        ],
      },
      {
        id: "complete-checklist",
        title: "Completing the Checklist",
        content: "Navigate through 16 sections, marking each item as Pass, Fail, or N/A. Failed items require severity classification and remarks.",
        steps: [
          "Work through sections A to P sequentially",
          "For each item, click Pass (✓), Fail (✗), or N/A (-)",
          "For failed items: select severity (Minor/Major/Critical)",
          "Add inspector remarks explaining the defect",
          "Capture photos as evidence for failed items",
          "Use 'Mark all pass' for sections with no issues",
          "Progress bar shows completion status",
        ],
        tips: [
          "Auto-save protects against accidental page closure",
          "Use the section navigation on the left to jump between sections",
          "Photos are compressed automatically to save storage",
        ],
      },
      {
        id: "inspection-sections",
        title: "The 16 Inspection Sections",
        content: "A - Vehicle Identification, B - Documentation, C - Exterior, D - Tires, E - Brakes, F - Steering & Suspension, G - Engine, H - Transmission, I - Electrical, J - Lighting, K - Visibility, L - Interior, M - Safety Equipment, N - Underbody, O - Emissions, P - Final Decision",
      },
      {
        id: "final-decision",
        title: "Final Decision & Certification",
        content: "Section P captures the overall result, remarks, signatures, and certificate details.",
        steps: [
          "Review all section summaries",
          "Select overall result: Pass, Conditional Pass, Re-inspection Required, or Fail",
          "Add inspector remarks",
          "Add supervisor remarks (if applicable)",
          "Set next inspection date",
          "Set re-inspection date (if required)",
          "Capture inspector digital signature",
          "Capture supervisor digital signature (if required)",
          "Submit inspection",
        ],
      },
      {
        id: "certificate",
        title: "Inspection Certificate",
        content: "Upon completion, a professional certificate is generated with QR code verification, official seals, and security features.",
        tips: [
          "Certificates can be printed or downloaded as PDF",
          "QR codes allow public verification at /verify/[id]",
          "Share certificates via email or messaging apps",
          "Certificates include laurel wreath decoration for passes",
        ],
      },
    ],
  },
  {
    id: "daily-inspections",
    title: "Daily Pre-Trip Inspections",
    icon: "☀️",
    subsections: [
      {
        id: "daily-overview",
        title: "Daily Inspection Protocol",
        content: "Daily pre-trip inspections must be completed before each vehicle leaves the yard. They focus on critical roadworthiness items to ensure daily safety.",
        tips: [
          "Daily inspections are separate from bi-annual inspections",
          "Must be completed before each trip",
          "Results determine trip clearance (Cleared/Grounded)",
          "Critical failures automatically ground the vehicle",
        ],
      },
      {
        id: "daily-checklist",
        title: "Daily Checklist Categories",
        content: "The daily checklist covers 9 categories: Tires & Wheels, Brakes, Lights & Signals, Fluid Levels, Visibility, Safety & Controls, Emergency Equipment, Documentation, and Exterior & General.",
      },
      {
        id: "perform-daily",
        title: "Performing a Daily Inspection",
        content: "Drivers or inspectors perform daily checks before departure.",
        steps: [
          "Navigate to 'Daily Pre-Trip' in sidebar",
          "Click 'New Daily Check'",
          "Select vehicle",
          "Enter driver name and date",
          "Enter odometer reading",
          "Add trip purpose and route (optional)",
          "Complete all 9 checklist categories",
          "For failed items: add notes and photos",
          "Sign the driver attestation",
          "Submit inspection",
        ],
      },
      {
        id: "trip-clearance",
        title: "Understanding Trip Clearance",
        content: "The system automatically determines if a vehicle is cleared to depart based on inspection results.",
        steps: [
          "Cleared (green): All critical items passed, vehicle may depart",
          "Defect Noted (amber): Minor issues, vehicle may depart but monitor",
          "Grounded (red): Critical failures in brakes, lights, or tires - vehicle must not depart",
        ],
        warnings: [
          "Grounded vehicles must be repaired before departing",
          "Allowing a grounded vehicle to depart is a serious compliance violation",
        ],
      },
      {
        id: "supervisor-review",
        title: "Supervisor Review",
        content: "Supervisors can review and approve daily inspections, especially those with defects noted.",
        tips: [
          "Approve button appears for supervisors on non-passed inspections",
          "Add supervisor notes during approval",
          "Approved inspections are flagged in the audit trail",
        ],
      },
    ],
  },
  {
    id: "documents",
    title: "Document Management",
    icon: "📄",
    subsections: [
      {
        id: "documents-overview",
        title: "Document Library",
        content: "Central repository for all vehicle and transporter documents with version tracking, expiry monitoring, and preview/download capabilities.",
      },
      {
        id: "upload-document",
        title: "Uploading Documents",
        content: "Upload documents from the Documents page or directly from vehicle/transporter profiles.",
        steps: [
          "Click 'Upload Document' button",
          "Select document type (Insurance, Registration, etc.)",
          "Link to vehicle or transporter",
          "Choose file from your device",
          "Set expiry date if applicable",
          "Add version notes",
          "Click 'Upload'",
        ],
      },
      {
        id: "preview-download",
        title: "Preview & Download",
        content: "Preview documents directly in the browser or download to your device.",
        tips: [
          "Eye icon opens preview in new tab",
          "Download icon saves file to your device",
          "PDFs and images preview inline",
          "All downloads are tracked in audit log",
        ],
      },
      {
        id: "expiry-monitoring",
        title: "Expiry Monitoring",
        content: "The system tracks expiry dates and provides alerts 30 days before expiry.",
        tips: [
          "Documents are color-coded: Green (valid), Amber (expiring soon), Red (expired)",
          "Expired documents appear at the top of the list",
          "Automatic notifications sent to relevant users",
        ],
      },
    ],
  },
  {
    id: "import-export",
    title: "Import & Export",
    icon: "📥",
    subsections: [
      {
        id: "import-overview",
        title: "Data Import Wizard",
        content: "Import vehicles, transporters, and inspections from Excel, CSV, or JSON files with column mapping and validation.",
      },
      {
        id: "import-steps",
        title: "Import Process",
        steps: [
          "Navigate to 'Import / Export' in sidebar",
          "Select entity type (Vehicles, Transporters, Inspections)",
          "Upload your file (XLSX, XLS, CSV)",
          "Map columns to system fields (auto-suggested)",
          "Preview data and review validation errors",
          "Click 'Import' to process valid rows",
          "Review import summary with success/failure counts",
        ],
        tips: [
          "Download sample template from the Import page",
          "Auto-mapping matches column names intelligently",
          "Invalid rows are skipped with detailed error messages",
          "Import history shows all past imports with rollback option",
        ],
        warnings: [
          "Duplicate registration numbers are rejected",
          "Large imports (>1000 rows) may take several minutes",
        ],
      },
      {
        id: "export-data",
        title: "Exporting Data",
        content: "Export data from any list view in CSV, Excel, PDF, or JSON format.",
        steps: [
          "Go to the page you want to export (Vehicles, Transporters, etc.)",
          "Click the 'Export' dropdown button",
          "Select format: CSV, Excel, PDF, or JSON",
          "File downloads automatically",
        ],
        tips: [
          "Excel exports include auto-sized columns",
          "PDF exports include titles and timestamps",
          "JSON exports are useful for API integrations",
        ],
      },
      {
        id: "rollback",
        title: "Rollback Imports",
        content: "Administrators can rollback completed imports to undo accidental data entry.",
        warnings: [
          "Rollback permanently deletes imported records",
          "Cannot rollback if imported records have been modified",
        ],
      },
    ],
  },
  {
    id: "reports",
    title: "Reports & Analytics",
    icon: "📈",
    subsections: [
      {
        id: "reports-overview",
        title: "Analytics Dashboard",
        content: "Comprehensive analytics with 7+ chart types, filters, and export options for data-driven decision making.",
      },
      {
        id: "chart-types",
        title: "Available Charts",
        content: "Pass vs Fail Trend, Station Comparison, Transporter Performance, Common Defects, Vehicle Categories, Inspector Productivity, and Regional Compliance Heat Map.",
        tips: [
          "Hover over chart elements for detailed tooltips",
          "Click legend items to toggle data series",
          "Use filters to focus on specific time periods or stations",
        ],
      },
      {
        id: "export-reports",
        title: "Exporting Reports",
        content: "Export complete reports with summary statistics and charts to PDF, Excel, CSV, or email.",
        steps: [
          "Apply desired filters",
          "Click export button (PDF, Excel, CSV)",
          "Or click 'Email Report' to send summary via email",
          "Use 'Print' for hard copies",
        ],
      },
      {
        id: "filters",
        title: "Report Filters",
        content: "Filter reports by date range, region, station, transporter, vehicle, inspector, and result status.",
        tips: [
          "Filters apply to all charts simultaneously",
          "Clear filters to reset to full dataset",
          "Save frequent filter combinations as presets",
        ],
      },
    ],
  },
  {
    id: "notifications",
    title: "Notifications",
    icon: "🔔",
    subsections: [
      {
        id: "notifications-overview",
        title: "Notification Center",
        content: "Central hub for all system notifications including inspection reminders, certificate expiries, failed inspections, and system alerts.",
      },
      {
        id: "notification-types",
        title: "Notification Types",
        content: "Inspection Due, Certificate Expiring, Inspection Failed, Re-inspection Due, Document Expiry, Monthly Summary, and System notifications.",
        tips: [
          "Unread notifications show amber dot",
          "Click notification to navigate to related record",
          "Mark all read to clear unread indicators",
        ],
      },
      {
        id: "channels",
        title: "Delivery Channels",
        content: "Notifications are delivered via in-app, email, and SMS based on user preferences and notification type.",
        tips: [
          "Critical alerts (failed inspections) use all channels",
          "Configure preferences in Settings",
          "Push notifications work on mobile devices with PWA",
        ],
      },
    ],
  },
  {
    id: "users",
    title: "User Management",
    icon: "👥",
    subsections: [
      {
        id: "users-overview",
        title: "Managing Users",
        content: "Administrators can view, create, edit, and deactivate user accounts with role assignments and station linking.",
        roles: ["Super Administrator", "Administrator"],
      },
      {
        id: "create-user",
        title: "Creating Users",
        steps: [
          "Navigate to 'Users & Roles'",
          "Click 'Invite User'",
          "Enter name, email, and phone",
          "Select role from the 10 available roles",
          "Assign to inspection station",
          "Set initial password or send invite email",
          "Configure custom permissions if needed",
          "Click 'Create User'",
        ],
      },
      {
        id: "permissions",
        title: "Permission Matrix",
        content: "The permission matrix shows what each role can do across all modules. Custom permissions can override role defaults for specific users.",
        tips: [
          "View matrix on Users page",
          "Custom permissions take precedence over role defaults",
          "Audit log records all permission changes",
        ],
      },
    ],
  },
  {
    id: "locations",
    title: "Inspection Stations",
    icon: "🏢",
    subsections: [
      {
        id: "stations-overview",
        title: "Station Management",
        content: "Manage multiple inspection stations with details including location, capacity, equipment, and assigned inspectors.",
      },
      {
        id: "station-cards",
        title: "Station Cards",
        content: "Each station card shows name, code, region, manager, contact info, inspector count, inspection volume, and capacity.",
        tips: [
          "Equipment badges show available inspection tools",
          "Capacity shows daily maximum inspections",
          "Click card to view station details",
        ],
      },
    ],
  },
  {
    id: "settings",
    title: "System Settings",
    icon: "⚙️",
    subsections: [
      {
        id: "settings-overview",
        title: "Administration Settings",
        content: "Configure system-wide settings including branding, organization details, inspection rules, and security policies.",
        roles: ["Super Administrator", "Administrator"],
      },
      {
        id: "branding",
        title: "Branding & Logo",
        content: "Upload your company logo, set company name, tagline, and brand colors used throughout the system and certificates.",
        steps: [
          "Navigate to Settings",
          "Upload logo (PNG, JPG, or SVG, max 2MB)",
          "Enter company name and short name",
          "Set tagline",
          "Choose theme and accent colors",
          "Save changes",
        ],
      },
      {
        id: "organization",
        title: "Organization Details",
        content: "Set address, contact information, tax ID, and registration number shown on certificates and reports.",
      },
      {
        id: "inspection-defaults",
        title: "Inspection Defaults",
        content: "Configure certificate validity period, re-inspection grace period, and required features like supervisor approval and GPS capture.",
      },
      {
        id: "certificate-design",
        title: "Certificate Design",
        content: "Customize certificate header text, footer disclaimers, and application footer shown on all generated certificates.",
      },
      {
        id: "security",
        title: "Security Policy",
        content: "Set session timeout, password requirements (length, uppercase, numbers), and account lockout policies.",
      },
      {
        id: "notifications-settings",
        title: "Notification Settings",
        content: "Enable email and SMS notifications, set reminder lead times for certificate expiries.",
      },
    ],
  },
  {
    id: "powerbi",
    title: "Power BI Integration",
    icon: "📊",
    subsections: [
      {
        id: "powerbi-overview",
        title: "DirectQuery Connector",
        content: "Connect Microsoft Power BI directly to VIMS using our OData v4 compliant endpoint for live dashboard building.",
      },
      {
        id: "powerbi-setup",
        title: "Setting Up Power BI",
        steps: [
          "Open Power BI Desktop",
          "Click 'Get Data' → 'OData Feed'",
          "Enter URL: https://your-domain/api/v1/powerbi",
          "In Advanced options, add header: X-API-Key: your-api-key",
          "Select datasets (Inspections, Vehicles, etc.)",
          "Click 'Load' to import schema",
          "Build your reports and dashboards",
        ],
        tips: [
          "Contact administrator for API key",
          "Power BI auto-discovers schema from $metadata endpoint",
          "DirectQuery mode keeps data always fresh",
        ],
      },
      {
        id: "datasets",
        title: "Available Datasets",
        content: "Inspections, Vehicles, Transporters, Stations, Defects, Documents, Audit Logs, and Users - all with full field documentation.",
      },
    ],
  },
  {
    id: "rfid",
    title: "RFID Scanning",
    icon: "📡",
    subsections: [
      {
        id: "rfid-overview",
        title: "RFID Vehicle Scanner",
        content: "Scan vehicle RFID tags for instant identification, enabling quick vehicle lookup and inspection start.",
      },
      {
        id: "rfid-use",
        title: "Using RFID Scanner",
        steps: [
          "Navigate to 'RFID Scanner' in sidebar",
          "Focus the input field",
          "Scan RFID tag with hardware reader (acts as keyboard)",
          "Or manually enter tag/VIN/registration",
          "Click 'Scan' or press Enter",
          "View vehicle details and start inspection",
        ],
        tips: [
          "Hardware scanners automatically input tag data",
          "Use 'Simulate Scanner' for testing without hardware",
          "Quick actions: View Vehicle or Start Inspection",
        ],
      },
    ],
  },
  {
    id: "predictive",
    title: "Predictive Maintenance",
    icon: "🔮",
    subsections: [
      {
        id: "predictive-overview",
        title: "AI-Powered Predictions",
        content: "Machine learning analyzes inspection history to predict when vehicles are likely to fail, enabling proactive maintenance.",
      },
      {
        id: "risk-levels",
        title: "Risk Levels",
        content: "Vehicles are classified as Critical (red), Warning (amber), Monitor (blue), or Healthy (green) based on risk score.",
        tips: [
          "Critical vehicles need maintenance within 30 days",
          "Warning vehicles should be serviced within 90 days",
          "Monitor vehicles have minor trends to watch",
          "Healthy vehicles have no concerning patterns",
        ],
      },
      {
        id: "at-risk-components",
        title: "At-Risk Components",
        content: "The system identifies specific components likely to fail based on historical inspection patterns.",
      },
    ],
  },
  {
    id: "apps",
    title: "Mobile Apps",
    icon: "📱",
    subsections: [
      {
        id: "apps-overview",
        title: "Available Platforms",
        content: "RSL VIMS is available as iOS app, Android app, Progressive Web App (PWA), and desktop web app.",
      },
      {
        id: "pwa-install",
        title: "Installing PWA",
        steps: [
          "Open VIMS in Chrome, Edge, or Safari",
          "Click 'Install App' button when prompted",
          "Or use browser menu: 'Install app' or 'Add to Home Screen'",
          "Confirm installation",
          "Launch from home screen for app-like experience",
        ],
        tips: [
          "PWA works offline with auto-sync when reconnected",
          "Updates automatically without app store",
          "Full-screen experience without browser chrome",
        ],
      },
      {
        id: "offline-mode",
        title: "Offline Capabilities",
        content: "Continue inspections, capture photos, and view cached data while offline. All changes sync automatically when connection returns.",
        warnings: [
          "Some features require connection (e.g., certificate verification)",
          "Sync happens automatically when online",
        ],
      },
    ],
  },
  {
    id: "portal",
    title: "Transporter Portal",
    icon: "🚛",
    subsections: [
      {
        id: "portal-overview",
        title: "Transporter Self-Service",
        content: "Transporter portal users can view their fleet, compliance status, and upcoming expiries without full system access.",
        roles: ["Transporter User"],
      },
      {
        id: "portal-features",
        title: "Portal Features",
        content: "Fleet overview, compliance rate, expiring certificates, recent inspections, and vehicle status.",
        tips: [
          "Read-only access to own fleet data",
          "Cannot modify records",
          "Request changes through your station contact",
        ],
      },
    ],
  },
  {
    id: "api",
    title: "API Documentation",
    icon: "🔌",
    subsections: [
      {
        id: "api-overview",
        title: "REST API",
        content: "Comprehensive REST API for integrating VIMS with external systems including ERP, fleet management, and reporting tools.",
      },
      {
        id: "authentication",
        title: "API Authentication",
        content: "All API calls require X-API-Key header or Bearer token. Contact administrator for API key issuance.",
        tips: [
          "API keys can be scoped (read, write, inspect)",
          "Keys can be revoked if compromised",
          "Rate limit: 1000 requests per minute",
        ],
      },
      {
        id: "endpoints",
        title: "Available Endpoints",
        content: "Vehicles, Transporters, Inspections, Locations, Stats, AI Defect Detection, Predictive Maintenance, RFID, Power BI OData, and Webhooks.",
      },
    ],
  },
  {
    id: "audit",
    title: "Audit Trail",
    icon: "📜",
    subsections: [
      {
        id: "audit-overview",
        title: "Immutable Audit Log",
        content: "Every action is recorded: create, update, delete, approve, login, logout, import, export. Records cannot be modified or deleted.",
      },
      {
        id: "audit-details",
        title: "Audit Record Details",
        content: "Each record includes timestamp, user, action type, entity type, entity ID, summary, and before/after snapshots.",
        tips: [
          "Search by user, entity, or action",
          "Filter by date range",
          "Export audit log for compliance reporting",
        ],
      },
    ],
  },
  {
    id: "troubleshooting",
    title: "Troubleshooting & FAQ",
    icon: "❓",
    subsections: [
      {
        id: "faq-login",
        title: "Login Issues",
        content: "Common login problems and solutions.",
        steps: [
          "Account locked? Wait 15 minutes or contact administrator",
          "Forgot password? Use 'Forgot password' link",
          "Invalid credentials? Verify caps lock and keyboard language",
          "No access? Contact administrator to verify role assignment",
        ],
      },
      {
        id: "faq-performance",
        title: "Performance Issues",
        content: "If the system is slow, try these steps.",
        steps: [
          "Clear browser cache",
          "Disable browser extensions",
          "Use modern browser (Chrome, Edge, Firefox, Safari)",
          "Check internet connection",
          "For large imports, process in batches",
        ],
      },
      {
        id: "faq-offline",
        title: "Offline Sync Issues",
        content: "If offline data isn't syncing.",
        steps: [
          "Verify internet connection is active",
          "Check browser console for errors (F12)",
          "Refresh the page",
          "Re-install PWA if persistent",
          "Contact support if data appears lost",
        ],
      },
      {
        id: "faq-export",
        title: "Export Problems",
        steps: [
          "Check browser allows downloads",
          "Verify sufficient disk space",
          "For large exports, try CSV format",
          "PDF exports may be slow for large datasets",
        ],
      },
      {
        id: "contact-support",
        title: "Contacting Support",
        content: "For issues not covered in this guide, contact your system administrator or RSL support team.",
        tips: [
          "Include screenshot of error",
          "Note the time the issue occurred",
          "Provide your user role and station",
          "Describe steps to reproduce the issue",
        ],
      },
    ],
  },
];
