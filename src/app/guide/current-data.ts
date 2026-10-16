import { GUIDE_SECTIONS as BASE_GUIDE_SECTIONS, type GuideSection } from "./data";

type GuideSubsection = GuideSection["subsections"][number];

type SectionPatch = {
  replacements?: Record<string, GuideSubsection>;
  append?: GuideSubsection[];
};

function patchSection(section: GuideSection, patch: SectionPatch): GuideSection {
  const replacements = patch.replacements ?? {};
  const subsections = section.subsections.map((subsection) => replacements[subsection.id] ?? subsection);
  const existingIds = new Set(subsections.map((subsection) => subsection.id));

  for (const subsection of patch.append ?? []) {
    if (!existingIds.has(subsection.id)) subsections.push(subsection);
  }

  return { ...section, subsections };
}

const DRIVER_TRAINING_SECTION: GuideSection = {
  id: "driver-training",
  title: "Driver Training & Assessment",
  icon: "🎓",
  subsections: [
    {
      id: "training-overview",
      title: "Department Workspace",
      content:
        "Driver Training & Assessment manages the training lifecycle from request intake and scheduling through participants, evidence, assessment, independent review, certification, compliance, and analytics. Access is limited to users assigned to the Driver Training system or authorized cross-system administrators.",
      tips: [
        "Use the Driver Training navigation bar inside the department instead of looking for every workspace in the global sidebar",
        "Overview summarizes the department; Operations groups Requests, Sessions, and Participants; Assessments groups the assessment workspace, Review queue, and Certificates",
        "Analytics is available as a direct tab, while More contains Programme and Safety & assurance workspaces",
      ],
    },
    {
      id: "training-services",
      title: "Approved Training Services",
      content:
        "The department provides six approved service lines: Defensive Driving Training, Driving Proficiency Test, HAZMAT (Hydrocarbons) Training, Off-Road Driving Training, Forklift Operator Safety Training, and Vehicle Safety Inspection Training.",
      tips: [
        "Select the correct service when creating requests and sessions because curriculum, readiness, accreditation, and reporting can be service-specific",
        "Do not create substitute service names when an approved service already covers the work",
      ],
    },
    {
      id: "training-operations",
      title: "Requests, Sessions & Participants",
      content:
        "The Operations menu controls the operational flow from a training request into a scheduled session and participant record.",
      steps: [
        "Open Operations → Requests to record or review training demand",
        "Complete the required review and authorization steps before scheduling where the workflow requires them",
        "Use Operations → Sessions to manage approved training delivery dates, instructors, capacity, and session status",
        "Use Operations → Participants to review enrolled people and open the participant dossier",
        "Keep attendance, evidence, assessment, development, and compliance records linked to the correct participant and session",
      ],
      warnings: [
        "Do not bypass commercial authorization, readiness, accreditation, safety, or other governance controls when the selected workflow requires them",
      ],
    },
    {
      id: "training-assessments",
      title: "Assessments & Independent Review",
      content:
        "The assessment workspace records structured competency evidence. Trainer submission does not by itself complete certification: where independent review is required, an authorized reviewer must approve the assessment before certificate eligibility is unlocked.",
      steps: [
        "Open Assessments → Assessment workspace",
        "Select the correct participant and training context",
        "Complete the quantitative, qualitative, and critical-safety assessment controls",
        "Submit the assessment for review",
        "An authorized independent reviewer opens Assessments → Review queue and records the review decision",
        "After an approved review, continue to certificate eligibility and issuance if all other requirements are satisfied",
      ],
      warnings: [
        "The original assessor should not approve their own assessment except through the controlled, audited administrator override where that override is explicitly permitted",
        "Critical safety findings can override an otherwise strong numerical score",
      ],
    },
    {
      id: "training-certificates",
      title: "Certificates & Verification",
      content:
        "Training certificates are controlled records. Issuance depends on completion and assessment governance, and authorized managers can revoke a certificate with a recorded reason when required.",
      steps: [
        "Open Assessments → Certificates",
        "Confirm the participant is eligible for issuance",
        "Review certificate dates and status before issuing or printing",
        "Use the public training verification page when a third party needs to validate a certificate code",
      ],
      tips: [
        "Public training certificate verification is available at /verify/training/[code]",
        "Revocation and renewal history should be preserved rather than replacing prior certificate evidence",
      ],
    },
    {
      id: "training-programme",
      title: "Programme Management",
      content:
        "More → Programme contains Commercials, Development, Curriculum, Instructors, Logistics, Communications, and Training users. These workspaces manage the supporting controls around training delivery.",
      tips: [
        "Use Curriculum to maintain approved programme content and review dates",
        "Use Instructors and Logistics to confirm qualified personnel and usable resources before delivery",
        "Use Development to track competency gaps and evidence-based follow-up actions",
        "Communications prepares governed messages; external delivery should not be assumed unless an approved provider is connected and tested",
      ],
    },
    {
      id: "training-assurance",
      title: "Safety & Assurance",
      content:
        "More → Safety & assurance contains Safety, Accreditation, Readiness, Evidence, Quality, and Compliance. These workspaces provide the controls used to determine whether training can proceed and whether outcomes are adequately supported.",
      steps: [
        "Review Safety for risk assessments, incidents, and stop-work controls",
        "Review Accreditation for current regulatory or service-specific evidence",
        "Use Readiness to confirm required delivery controls before the session starts",
        "Use Evidence to maintain attendance and supporting records",
        "Use Quality for feedback, findings, corrective actions, and verified closure",
        "Use Compliance to manage renewal, licence, reassessment, and other controlled follow-up cases",
      ],
    },
    {
      id: "training-analytics",
      title: "Training Analytics",
      content:
        "Driver Training Analytics summarizes authorized training operations, outcomes, certificate status, renewal signals, and related performance indicators for decision support.",
      tips: [
        "Use Analytics from the Driver Training navigation bar",
        "Export only data you are authorized to handle",
        "Use the operational workspaces to investigate individual records behind an aggregate metric",
      ],
    },
  ],
};

const UPDATED_SECTIONS: Record<string, SectionPatch> = {
  "getting-started": {
    replacements: {
      welcome: {
        id: "welcome",
        title: "Welcome to RSL VIMS",
        content:
          "Road Safety Limited Vehicle Inspection Management System (VIMS) centralizes vehicle inspection operations, daily pre-trip checks, transporter and vehicle records, reporting, governed Driver Training & Assessment workflows, and supporting administration in one secure web platform.",
        tips: [
          "VIMS is responsive across desktop, tablet, and mobile devices",
          "The Progressive Web App (PWA) shell can be installed for app-like access, but protected records and transactions still require connectivity",
          "Use the User Guide search to find a module or workflow quickly",
          "Do not rely on closing an unfinished form as a way to save work; submit or complete the controlled workflow while connected",
        ],
      },
      navigation: {
        id: "navigation",
        title: "Understanding the Interface",
        content:
          "The global sidebar is role-aware and groups Operations, Departments, Intelligence, Administration, and Access & Support. Driver Training & Assessment has its own compact department navigation for its specialist workspaces.",
        tips: [
          "On mobile, open the main menu to access global modules",
          "The active page is highlighted so you can confirm your current workspace",
          "Inside Driver Training, use Overview, Operations, Assessments, Analytics, and More",
          "Use the appearance control to switch between Day, Night, or Auto display modes when available to your account",
          "Use browser Back carefully on unfinished forms; verify the record was submitted before leaving a transaction",
        ],
      },
    },
  },
  inspections: {
    replacements: {
      "biannual-overview": {
        id: "biannual-overview",
        title: "Comprehensive Inspection Overview",
        content:
          "The comprehensive vehicle inspection uses a guided 16-step A–P workflow. Section A captures vehicle/inspection identification, sections B–O contain the technical checklist, and Section P is the controlled final decision and submission step.",
        tips: [
          "A and P are dedicated workflow steps, not ordinary checklist sections",
          "Sections B–O cover documentation, vehicle condition, safety systems, underbody, and emissions checks",
          "The recorded defects and severities constrain which final results can be selected",
        ],
      },
      "complete-checklist": {
        id: "complete-checklist",
        title: "Completing the A–P Inspection Workflow",
        content:
          "Use the guided inspection controls to move from Section A through Section P. Technical checklist responses are recorded in sections B–O as Pass, Fail, or N/A, with defect evidence added where required.",
        steps: [
          "Complete Section A vehicle and inspection identification details",
          "Use Next to move into Section B and continue sequentially through Section O, or use the section navigator when you need to review another step",
          "For each checklist item, select Pass, Fail, or N/A as appropriate",
          "For failed items, select the applicable severity and add clear remarks",
          "Attach photo evidence where it helps document the defect",
          "Use the progress indicator and sticky Previous/Next controls to confirm where you are in the 16-step workflow",
          "Continue to Section P only after reviewing the technical sections",
          "Submit the inspection from the final decision step after completing the required decision and signature controls",
        ],
        tips: [
          "Previous and Next follow the canonical A → P order",
          "Section navigation can be used to review earlier information before final submission",
          "Photos are resized/compressed in the browser before they are stored as inspection evidence",
        ],
        warnings: [
          "Moving between steps does not mean an unfinished inspection has been safely submitted; maintain connectivity and complete the final controlled submission",
        ],
      },
      "inspection-sections": {
        id: "inspection-sections",
        title: "The 16 Inspection Steps",
        content:
          "A - Vehicle / Inspection Identification; B - Documentation; C - Exterior Inspection; D - Tire Inspection; E - Brake Inspection; F - Steering and Suspension; G - Engine Inspection; H - Transmission; I - Electrical System; J - Lighting; K - Visibility; L - Interior Inspection; M - Safety Equipment; N - Underbody Inspection; O - Emissions; P - Final Decision.",
      },
      "final-decision": {
        id: "final-decision",
        title: "Final Decision & Submission",
        content:
          "Section P is the final controlled step. Review the recorded checklist and defect summary before selecting an allowed result. The system can restrict Pass or Conditional Pass when the recorded evidence requires a stricter outcome.",
        steps: [
          "Review the section summaries and outstanding defects",
          "Review the recommended/allowed result based on checklist failures, defect severity, and other inspection evidence",
          "Select the permitted overall result: Pass, Conditional Pass, Re-inspection Required, or Fail",
          "Add the required inspector and supervisor remarks",
          "Set the next inspection or re-inspection dates where applicable",
          "Capture the required digital signatures",
          "Submit the inspection from Section P",
        ],
        warnings: [
          "Critical defects can prevent Pass and Conditional Pass",
          "Do not submit a more favorable result than the recorded inspection evidence allows",
        ],
      },
    },
    append: [
      {
        id: "photo-evidence",
        title: "Capturing Photo Evidence",
        content:
          "Inspection photo controls support the browser camera, the device's native camera, and ordinary image upload so inspectors have a practical fallback on desktop and mobile devices.",
        steps: [
          "Choose Add Photo beside the relevant evidence area",
          "Choose Take Photo to use the in-browser camera, Open Device Camera to invoke the device camera directly, or Upload from Device to select an existing image",
          "Allow camera permission when the browser asks for it",
          "If more than one camera is available, use Switch Camera to change between available views",
          "Capture the evidence photo, then preview it to confirm the inspection item is visible",
          "Remove and retake a photo when it is unclear or attached to the wrong item",
          "If browser camera access fails, use Open Device Camera or Upload from Device as the fallback",
        ],
        tips: [
          "The native camera input prefers the rear/environment camera on supported mobile devices",
          "Press Escape to close an open camera or image preview on keyboard-equipped devices",
          "The file selector is reset after a selection so the same file can be selected again if needed",
        ],
        warnings: [
          "Only attach evidence that is relevant to the inspection record and within the system evidence limits",
        ],
      },
      {
        id: "inspection-scheduling",
        title: "Inspection Scheduling & Capacity",
        content:
          "Operations → Inspection Scheduling manages appointment booking separately from completed inspection evidence. The workspace balances station capacity, supports inspector assignment and tracks the controlled flow from Scheduled through Confirmed, Checked In and In Progress before the A–P inspection is opened.",
        steps: [
          "Open Operations → Inspection Scheduling",
          "Choose the vehicle, active inspection station, appointment date/time and expected duration",
          "Set the appointment type and operational priority",
          "Assign an inspector immediately or leave the booking unassigned for later operational allocation",
          "Confirm the appointment before arrival",
          "Mark the vehicle Checked In when it reaches the station",
          "Choose Begin to move the appointment into active service",
          "Open the A–P inspection from the in-progress appointment",
          "Submit the completed inspection; VIMS links the new inspection record and closes the appointment automatically",
        ],
        tips: [
          "Today’s station-capacity cards compare active bookings with each station’s configured daily capacity",
          "VIMS prevents a second active booking for the same vehicle on the same date",
          "Cancelled and no-show appointments do not consume station capacity",
          "The scheduling record remains separate from the inspection result so pass/fail analytics are not distorted by future bookings",
        ],
      },
    ],
  },
  reports: {
    replacements: {
      "reports-overview": {
        id: "reports-overview",
        title: "Reports & Analytics Dashboard",
        content:
          "Reports & Analytics presents role-authorized operational KPIs, inspection trends, fleet/compliance measures, recent reportable records, and export actions in a responsive executive reporting workspace.",
        tips: [
          "Use the KPI cards and charts for aggregate monitoring and the operational list pages for record-level investigation",
          "Export controls adapt to smaller screens and announce progress to assistive technology",
        ],
      },
      "export-reports": {
        id: "export-reports",
        title: "Exporting Reports",
        content:
          "The Reports page supports period-aware PDF, Excel, CSV, Print, and Email Report actions. Users can export the current month, previous month, current year, previous year, a specific month, a specific year, a custom start/end date range, or all available inspection history. Spreadsheet exports neutralize formula-like cell values before writing them to help prevent spreadsheet formula execution.",
        steps: [
          "Open Reports & Analytics and locate the Export Report panel",
          "Choose the reporting period: a preset, a specific month, a specific year, a custom date range, or All time",
          "Confirm the human-readable selected period shown above the export buttons",
          "Choose PDF for a formatted inspection report covering the selected period",
          "Choose Excel for a workbook with selected-period summary metrics and inspection detail",
          "Choose CSV for UTF-8-compatible selected-period summary and tabular inspection detail",
          "Choose Print to open a printable report generated from the selected period",
          "Choose Email Report to prepare a selected-period summary in your configured email client",
        ],
        tips: [
          "Custom periods require both a start date and an end date, and the start date cannot be later than the end date",
          "Selected-period summary metrics use all matching records even when very large detail exports are capped for client performance",
          "Excel columns use bounded sizing for improved readability",
          "CSV output includes UTF-8 compatibility for common spreadsheet applications",
          "Email Report opens the local/default email client; it is not a claim that VIMS has sent a server-side email",
          "Wait for the export action status to complete before starting another export",
        ],
      },
    },
    append: [
      {
        id: "compliance-centre",
        title: "Compliance Centre",
        content:
          "The Compliance Centre combines existing VIMS obligations into one action-oriented view. It surfaces vehicle insurance, roadworthy and road-fund expiries; active transporter insurance and permit expiries; controlled document expiries; and failed, conditional or re-inspection outcomes.",
        steps: [
          "Open Intelligence → Compliance Centre",
          "Review the four top risk counters for vehicles, transporters, documents and inspection outcomes",
          "Work the vehicle lifecycle queue from the earliest overdue or upcoming obligation",
          "Review transporter insurance and business-permit obligations",
          "Open the controlled document registry for expiring source records",
          "Open individual inspections from the outcome queue to resolve failures, conditional outcomes or re-inspection requirements",
        ],
        tips: [
          "The expiry queues use a 60-day forward horizon and prioritize the nearest recorded obligation",
          "The module reuses existing VIMS records rather than maintaining a separate compliance database",
          "Use Reports & Analytics for aggregate trends and Compliance Centre for action queues",
        ],
      },
    ],
  },
  settings: {
    replacements: {
      branding: {
        id: "branding",
        title: "Branding & Logo",
        content:
          "Administrators can update approved organization branding used throughout the system. Logo input is restricted to bounded safe raster image data rather than active image formats.",
        steps: [
          "Navigate to Settings",
          "Upload an approved PNG or JPG/JPEG logo within the displayed size limits",
          "Enter the company name and short name",
          "Set the approved tagline and brand colors",
          "Review the appearance before saving",
          "Save changes",
        ],
        warnings: [
          "Active SVG image content is rejected by the current security policy",
          "Use approved organization artwork only",
        ],
      },
    },
  },
  apps: {
    replacements: {
      "apps-overview": {
        id: "apps-overview",
        title: "Available Platforms",
        content:
          "RSL VIMS is delivered as a responsive web application and installable Progressive Web App (PWA) for supported mobile and desktop browsers. The App Access page detects the current device/browser and provides either a direct Install VIMS action or the correct manual installation steps.",
        tips: [
          "Use Access & Support → App Access to install VIMS",
          "The interface adapts automatically across phones, tablets, laptops and desktop monitors",
          "The installed PWA launches in an app-like window while continuing to use the secure online VIMS application",
        ],
      },
      "offline-mode": {
        id: "offline-mode",
        title: "Offline & Connectivity Behavior",
        content:
          "The installed PWA can present a secure offline shell, but authenticated inspection records are not cached for offline editing and the current release does not perform background record synchronization. Protected transactions require an active connection.",
        warnings: [
          "Inspection creation, edits, photo uploads, submissions, approvals, and authenticated record access require connectivity",
          "Do not close an unfinished inspection expecting it to synchronize automatically later",
          "After connectivity returns, verify the server record state before repeating a submission or upload",
        ],
      },
    },
    append: [
      {
        id: "install-mobile",
        title: "Installing VIMS on Android, iPhone & iPad",
        content:
          "The App Access page provides mobile installation guidance that adapts to the detected device and browser.",
        steps: [
          "Open Access & Support → App Access",
          "On Android Chrome or a supported Chromium browser, choose Install VIMS when the button is available; otherwise open the browser menu and choose Install app or Add to Home screen",
          "On iPhone or iPad, open VIMS in Safari, tap Share, choose Add to Home Screen, confirm the name RSL VIMS, and tap Add",
          "Launch VIMS from the new app icon and sign in normally",
        ],
        tips: [
          "On iPhone/iPad, Safari provides the most reliable Add to Home Screen workflow",
          "Installation adds an app launcher; it does not remove the requirement for a live connection to protected VIMS records",
        ],
      },
      {
        id: "install-desktop",
        title: "Installing VIMS on Windows, macOS & Linux",
        content:
          "Supported desktop browsers can install VIMS into a dedicated app window. The App Access page detects the current desktop platform and shows the appropriate route.",
        steps: [
          "Open Access & Support → App Access",
          "On Windows with Microsoft Edge, use Install VIMS or Settings and more → Apps → Install this site as an app",
          "On Windows, macOS or Linux with Chrome/Chromium, use Install VIMS, the address-bar install icon, or the browser menu → Install VIMS",
          "On supported macOS Safari versions, choose File → Add to Dock",
          "Confirm the installation, then launch VIMS from the operating system app launcher, Dock, Start menu, taskbar or desktop shortcut",
        ],
        tips: [
          "If Firefox does not offer desktop PWA installation, use a current Chrome, Edge or Chromium browser for the installed-app experience",
          "Installed VIMS receives production web updates without requiring users to download a separate application package",
        ],
      },
    ],
  },
  troubleshooting: {
    replacements: {
      "faq-offline": {
        id: "faq-offline",
        title: "Offline or Connectivity Problems",
        content:
          "VIMS does not currently synchronize protected records in the background. If connectivity is lost during protected work, restore the connection and verify the server-side record before continuing.",
        steps: [
          "Confirm the device has a stable internet connection",
          "Keep any visible unsent information available while reconnecting when possible",
          "Reconnect and refresh the page if the application reports that protected operations are unavailable",
          "Check whether the inspection, upload, or transaction already exists before repeating it",
          "Contact support if the server record state is unclear or the same operation repeatedly fails",
        ],
      },
      "faq-export": {
        id: "faq-export",
        title: "Export Problems",
        steps: [
          "Check that the browser allows downloads for the VIMS site",
          "Verify sufficient device storage space",
          "Use CSV when you need a simple tabular fallback",
          "If Email Report does not open, confirm that a default email application is configured on the device",
          "For a failed export, retry once after refreshing the Reports page and contact support if the issue persists",
        ],
      },
    },
  },
};

export const GUIDE_SECTIONS: GuideSection[] = BASE_GUIDE_SECTIONS.flatMap((section) => {
  const updatedSection = UPDATED_SECTIONS[section.id]
    ? patchSection(section, UPDATED_SECTIONS[section.id])
    : section;

  if (section.id === "daily-inspections") {
    return [updatedSection, DRIVER_TRAINING_SECTION];
  }

  return [updatedSection];
});
