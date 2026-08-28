import { db } from "@/db";
import {
  users,
  transporters,
  vehicles,
  inspections,
  auditLogs,
  documents,
  locations,
  notifications,
  importJobs,
} from "@/db/schema";
import { eq, sql } from "drizzle-orm";
import { newId } from "./utils";
import { buildDefaultSectionData } from "./sections";
import { hashPassword } from "./password";

export async function seedIfEmpty() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Demo seed data is disabled in production");
  }
  // Always ensure system settings exist
  const { systemSettings } = await import("@/db/schema");
  const [existingSettings] = await db.select().from(systemSettings);
  if (!existingSettings) {
    await db.insert(systemSettings).values({
      id: newId(),
      companyName: "Road Safety Limited",
      companyShortName: "RSL",
      tagline: "Vehicle Inspection Management System",
      themeColor: "#039703",
      accentColor: "#026b02",
      address: "15 Independence Avenue",
      city: "Accra",
      region: "Greater Accra",
      country: "Ghana",
      phone: "+233 30 221 1000",
      email: "info@rsl.gh",
      website: "https://rsl.gh",
      taxId: "TIN-000000-000",
      registrationNumber: "RSL-GH-2020",
      certificateHeader: "Vehicle Safety & Roadworthiness Assessment",
      certificateFooter: "This certificate is electronically generated and can be verified at the URL shown in the QR code.",
      footerText: "© 2026 Road Safety Limited. All rights reserved.",
    });
  }

  const [userCount] = await db.select({ n: sql<number>`count(*)::int` }).from(users);
  if (userCount && userCount.n > 0) return;

  // Locations (inspection stations)
  const locAccra = newId();
  const locKumasi = newId();
  const locTema = newId();
  const locTakoradi = newId();
  const locWa = newId();
  await db.insert(locations).values([
    {
      id: locAccra, name: "Accra Central Station", code: "ACC-01",
      region: "Greater Accra", district: "Ayawaso West",
      address: "Independence Ave, Accra", gpsAddress: "GA-123-4567",
      phone: "+233 30 221 1000", email: "accra@rsl.gh",
      managerName: "Kwame Boateng", capacity: 120,
      equipment: ["Brake Tester", "Emission Analyzer", "Pit Lift", "Headlamp Tester", "Wheel Aligner"],
    },
    {
      id: locKumasi, name: "Kumasi Station", code: "KSI-02",
      region: "Ashanti", district: "Kumasi Metro",
      address: "Kejetia, Kumasi", gpsAddress: "AK-445-2190",
      phone: "+233 32 202 4400", email: "kumasi@rsl.gh",
      managerName: "Ama Serwaa", capacity: 80,
      equipment: ["Brake Tester", "Emission Analyzer", "Pit Lift"],
    },
    {
      id: locTema, name: "Tema Station", code: "TMA-03",
      region: "Greater Accra", district: "Tema Metro",
      address: "Tema Harbour Road", gpsAddress: "TT-881-2241",
      phone: "+233 30 321 5500", email: "tema@rsl.gh",
      managerName: "Yaw Mensah", capacity: 100,
      equipment: ["Brake Tester", "Emission Analyzer", "Heavy Vehicle Pit"],
    },
    {
      id: locTakoradi, name: "Takoradi Station", code: "TKD-04",
      region: "Western", district: "Sekondi-Takoradi",
      address: "Market Circle, Takoradi", gpsAddress: "WR-220-1140",
      phone: "+233 31 202 3300", email: "takoradi@rsl.gh",
      managerName: "Efua Amissah", capacity: 60,
      equipment: ["Brake Tester", "Emission Analyzer"],
    },
    {
      id: locWa, name: "WAQL Station", code: "WA-05",
      region: "Upper West", district: "Wa Municipal",
      address: "Wa Township", gpsAddress: "UW-110-2201",
      phone: "+233 39 202 1100", email: "wa@rsl.gh",
      managerName: "Ibrahim Tanko", capacity: 40,
      equipment: ["Brake Tester", "Emission Analyzer"],
    },
  ]);

  // Users (10 roles represented) — development-only demo accounts
  const adminId = newId();
  const superAdminId = newId();
  const opsManagerId = newId();
  const supervisorId = newId();
  const inspectorId = newId();
  const inspector2Id = newId();
  const dataEntryId = newId();
  const auditorId = newId();
  const complianceId = newId();
  const viewerId = newId();
  const transporterUserId = newId();

  const demoPassword = process.env.DEMO_PASSWORD || "Demo-Only@2026!";
  const demoPasswordHash = await hashPassword(demoPassword);

  await db.insert(users).values([
    { id: superAdminId, name: "Dr. Emmanuel Owusu", email: "ceo@rsl.gh", role: "super_admin", passwordHash: demoPasswordHash, locationId: locAccra, permissions: { "*": true } },
    { id: adminId, name: "Akosua Boateng", email: "akosua@rsl.gh", role: "admin", passwordHash: demoPasswordHash, locationId: locAccra },
    { id: opsManagerId, name: "Kofi Asante", email: "kofi@rsl.gh", role: "operations_manager", passwordHash: demoPasswordHash, locationId: locAccra },
    { id: supervisorId, name: "Grace Owusu", email: "grace@rsl.gh", role: "supervisor", passwordHash: demoPasswordHash, locationId: locAccra },
    { id: inspectorId, name: "John Mensah", email: "john@rsl.gh", role: "inspector", passwordHash: demoPasswordHash, locationId: locAccra },
    { id: inspector2Id, name: "Ama Darko", email: "ama@rsl.gh", role: "inspector", passwordHash: demoPasswordHash, locationId: locKumasi },
    { id: dataEntryId, name: "Yaw Boateng", email: "yaw@rsl.gh", role: "data_entry", passwordHash: demoPasswordHash, locationId: locTema },
    { id: auditorId, name: "Nana Adjei", email: "nana@rsl.gh", role: "auditor", passwordHash: demoPasswordHash, locationId: locAccra },
    { id: complianceId, name: "Efua Sutherland", email: "efua@rsl.gh", role: "compliance_officer", passwordHash: demoPasswordHash, locationId: locAccra },
    { id: viewerId, name: "Kwame Ansah", email: "kwame@rsl.gh", role: "viewer", passwordHash: demoPasswordHash, locationId: locAccra },
    { id: transporterUserId, name: "Daniel Acheampong", email: "daniel@metromass.gh", role: "transporter_user", passwordHash: demoPasswordHash },
  ]);

  // Transporters
  const t1 = newId(), t2 = newId(), t3 = newId(), t4 = newId();
  await db.insert(transporters).values([
    {
      id: t1, companyName: "Metro Mass Transit Ltd", registrationNumber: "MMT-GH-2014",
      tinNumber: "TIN-99821-441", gpsAddress: "GA-123-4567", contactPerson: "Daniel Acheampong",
      mobile: "+233 24 445 1122", email: "ops@metromass.gh", physicalAddress: "Ring Road Central, Accra",
      region: "Greater Accra", district: "Ayawaso West", insuranceCompany: "SIC Insurance",
      insuranceExpiry: "2026-12-31", businessPermit: "BP-2024-001", permitExpiry: "2026-12-31",
    },
    {
      id: t2, companyName: "VIP Transport", registrationNumber: "VIP-GH-2008",
      tinNumber: "TIN-44190-331", gpsAddress: "AK-445-2190", contactPerson: "Fatima Ibrahim",
      mobile: "+233 20 112 9988", email: "fleet@viptransport.gh", physicalAddress: "Kejetia, Kumasi",
      region: "Ashanti", district: "Kumasi Metro", insuranceCompany: "Enterprise Insurance",
      insuranceExpiry: "2026-06-15", businessPermit: "BP-2024-012", permitExpiry: "2026-06-15",
    },
    {
      id: t3, companyName: "Gold Coast Haulage", registrationNumber: "GCH-2020",
      tinNumber: "TIN-77884-110", gpsAddress: "TT-881-2241", contactPerson: "Samuel Addo",
      mobile: "+233 27 770 5543", email: "dispatch@gc-haulage.gh", physicalAddress: "Tema Harbour",
      region: "Greater Accra", district: "Tema Metro", insuranceCompany: "Hollard Ghana",
      insuranceExpiry: "2026-09-30",
    },
    {
      id: t4, companyName: "Western Express", registrationNumber: "WX-2019",
      tinNumber: "TIN-55667-220", gpsAddress: "WR-331-2018", contactPerson: "Kwabena Owusu",
      mobile: "+233 26 553 2201", email: "fleet@westernexpress.gh",
      region: "Western", district: "Sekondi-Takoradi", insuranceCompany: "Star Assurance",
      insuranceExpiry: "2026-07-22",
    },
  ]);

  // Explicit tenant link for the demo transporter portal account.
  await db.update(users).set({ transporterId: t1 }).where(eq(users.id, transporterUserId));

  // Vehicles
  const v1 = newId(), v2 = newId(), v3 = newId(), v4 = newId(), v5 = newId(), v6 = newId(), v7 = newId(), v8 = newId();
  await db.insert(vehicles).values([
    { id: v1, transporterId: t1, registrationNumber: "GT-1234-22", make: "Volvo", model: "9700", bodyType: "Bus", category: "Passenger", vehicleClass: "Heavy", colour: "Red", manufacturingYear: 2020, fuelType: "diesel", transmission: "automatic", seatingCapacity: 56, grossWeight: "18000", numberOfAxles: 2, odometerReading: 185000, insuranceCompany: "SIC Insurance", policyNumber: "SIC-BUS-2241", insuranceExpiry: "2026-11-30", roadworthyExpiry: "2026-08-15", roadFundExpiry: "2026-12-31", status: "active" },
    { id: v2, transporterId: t1, registrationNumber: "GT-5567-20", make: "MAN", model: "Lion's Coach", bodyType: "Bus", category: "Passenger", vehicleClass: "Heavy", colour: "White", manufacturingYear: 2018, fuelType: "diesel", transmission: "automatic", seatingCapacity: 52, odometerReading: 312000, status: "failed" },
    { id: v3, transporterId: t2, registrationNumber: "AS-9921-19", make: "Mercedes-Benz", model: "Travego", bodyType: "Bus", category: "Passenger", vehicleClass: "Heavy", colour: "Silver", manufacturingYear: 2019, fuelType: "diesel", transmission: "automatic", seatingCapacity: 54, odometerReading: 244000, status: "active" },
    { id: v4, transporterId: t3, registrationNumber: "TT-3311-21", make: "Scania", model: "R500", bodyType: "Truck", category: "Freight", vehicleClass: "Heavy", colour: "Blue", manufacturingYear: 2021, fuelType: "diesel", transmission: "manual", grossWeight: "44000", numberOfAxles: 4, odometerReading: 156000, status: "active" },
    { id: v5, transporterId: t3, registrationNumber: "TT-7720-17", make: "MAN", model: "TGX", bodyType: "Tanker", category: "Hazardous", vehicleClass: "Heavy", colour: "Yellow", manufacturingYear: 2017, fuelType: "diesel", transmission: "manual", grossWeight: "48000", numberOfAxles: 5, odometerReading: 412000, status: "under_inspection" },
    { id: v6, transporterId: t2, registrationNumber: "GR-1122-22", make: "Toyota", model: "Hiace", bodyType: "Minibus", category: "Passenger", vehicleClass: "Light", colour: "White", manufacturingYear: 2022, fuelType: "diesel", transmission: "manual", seatingCapacity: 15, odometerReading: 86000, status: "passed" },
    { id: v7, transporterId: t4, registrationNumber: "WR-4401-20", make: "Iveco", model: "Stralis", bodyType: "Truck", category: "Freight", vehicleClass: "Heavy", colour: "Red", manufacturingYear: 2020, fuelType: "diesel", transmission: "manual", grossWeight: "40000", numberOfAxles: 4, odometerReading: 278000, status: "active" },
    { id: v8, transporterId: t4, registrationNumber: "WR-5588-18", make: "DAF", model: "XF", bodyType: "Trailer", category: "Freight", vehicleClass: "Heavy", colour: "Green", manufacturingYear: 2018, fuelType: "diesel", transmission: "manual", grossWeight: "42000", numberOfAxles: 5, odometerReading: 360000, status: "suspended" },
  ]);

  // Inspections across 3 months, varied results and stations
  // Demo evidence photo (placeholder SVG data URL representing brake pad wear)
  const demoBrakePhoto = {
    id: "demo-brake-1",
    dataUrl: "data:image/svg+xml;base64," + Buffer.from(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'><rect fill='%23dc2626' width='400' height='300'/><text x='50%' y='45%' text-anchor='middle' fill='white' font-size='24' font-family='Arial' font-weight='bold'>BRAKE PAD WEAR</text><text x='50%' y='58%' text-anchor='middle' fill='white' font-size='16' font-family='Arial'>Below minimum thickness</text><text x='50%' y='80%' text-anchor='middle' fill='white' font-size='12' font-family='Arial' opacity='0.7'>Evidence captured during inspection</text></svg>`).toString("base64"),
    takenAt: "2026-04-15T10:35:00Z",
  };
  const demoRustPhoto = {
    id: "demo-rust-1",
    dataUrl: "data:image/svg+xml;base64," + Buffer.from(`<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'><rect fill='%23ea580c' width='400' height='300'/><text x='50%' y='45%' text-anchor='middle' fill='white' font-size='24' font-family='Arial' font-weight='bold'>BODY RUST</text><text x='50%' y='58%' text-anchor='middle' fill='white' font-size='16' font-family='Arial'>Rear wheel arches</text><text x='50%' y='80%' text-anchor='middle' fill='white' font-size='12' font-family='Arial' opacity='0.7'>Extensive corrosion visible</text></svg>`).toString("base64"),
    takenAt: "2026-04-15T10:38:00Z",
  };

  const passData = buildDefaultSectionData();
  const failData = buildDefaultSectionData().map((s) => {
    if (s.section === "E") {
      return { ...s, items: s.items.map((it) =>
        it.name === "Brake Pads" ? { ...it, result: "fail" as const, severity: "critical" as const, remarks: "Worn below minimum thickness", photos: [demoBrakePhoto] }
        : it.name === "Parking Brake" ? { ...it, result: "fail" as const, severity: "major" as const, remarks: "Efficiency below 50%" }
        : it
      )};
    }
    if (s.section === "C") {
      return { ...s, items: s.items.map((it) =>
        it.name === "Rust" ? { ...it, result: "fail" as const, severity: "major" as const, remarks: "Extensive rust on rear wheel arches", photos: [demoRustPhoto] }
        : it
      )};
    }
    return s;
  });
  const condData = buildDefaultSectionData().map((s) => {
    if (s.section === "M") {
      return { ...s, items: s.items.map((it) =>
        it.name === "First Aid Kit" ? { ...it, result: "fail" as const, severity: "minor" as const, remarks: "Kit incomplete — replenish within 7 days" }
        : it
      )};
    }
    return s;
  });

  const inspRows = [
    { id: newId(), number: "RSL-INS-2026-0001", vehicleId: v1, locationId: locAccra, date: new Date("2026-04-10T09:15:00"), inspectorId, inspectorName: "John Mensah", supervisorId, supervisorName: "Grace Owusu", data: passData, sEff: "92.40", pEff: "88.10", smoke: "pass" as const, noise: "74.50", opacity: "1.20", result: "pass" as const, next: "2026-10-10", wf: "completed" as const },
    { id: newId(), number: "RSL-INS-2026-0002", vehicleId: v2, locationId: locAccra, date: new Date("2026-04-15T10:30:00"), inspectorId, inspectorName: "John Mensah", data: failData, sEff: "45.20", pEff: "38.00", smoke: "fail" as const, noise: "86.20", opacity: "4.80", result: "fail" as const, reinspect: "2026-05-15", wf: "failed" as const },
    { id: newId(), number: "RSL-INS-2026-0003", vehicleId: v3, locationId: locKumasi, date: new Date("2026-05-20T11:00:00"), inspectorId: inspector2Id, inspectorName: "Ama Darko", supervisorId, supervisorName: "Grace Owusu", data: condData, sEff: "81.50", pEff: "79.00", smoke: "pass" as const, result: "conditional_pass" as const, next: "2026-11-20", wf: "approved" as const },
    { id: newId(), number: "RSL-INS-2026-0004", vehicleId: v4, locationId: locTema, date: new Date("2026-05-25T14:20:00"), inspectorId, inspectorName: "John Mensah", data: passData, sEff: "90.10", pEff: "85.50", smoke: "pass" as const, opacity: "1.60", result: "pass" as const, next: "2026-11-25", wf: "completed" as const },
    { id: newId(), number: "RSL-INS-2026-0005", vehicleId: v6, locationId: locKumasi, date: new Date("2026-06-05T08:45:00"), inspectorId: inspector2Id, inspectorName: "Ama Darko", data: passData, sEff: "88.00", pEff: "86.00", smoke: "pass" as const, result: "pass" as const, next: "2026-12-05", wf: "completed" as const },
    { id: newId(), number: "RSL-INS-2026-0006", vehicleId: v7, locationId: locTakoradi, date: new Date("2026-06-12T10:00:00"), inspectorId, inspectorName: "John Mensah", data: passData, sEff: "87.00", pEff: "84.00", smoke: "pass" as const, result: "pass" as const, next: "2026-12-12", wf: "completed" as const },
    { id: newId(), number: "RSL-INS-2026-0007", vehicleId: v8, locationId: locTakoradi, date: new Date("2026-06-18T15:30:00"), inspectorId, inspectorName: "John Mensah", data: failData, sEff: "42.00", pEff: "35.00", smoke: "fail" as const, result: "fail" as const, reinspect: "2026-07-18", wf: "failed" as const },
    { id: newId(), number: "RSL-INS-2026-0008", vehicleId: v1, locationId: locAccra, date: new Date("2026-07-10T09:15:00"), inspectorId, inspectorName: "John Mensah", supervisorId, supervisorName: "Grace Owusu", data: passData, sEff: "91.20", pEff: "87.80", smoke: "pass" as const, result: "pass" as const, next: "2027-01-10", wf: "approved" as const },
    { id: newId(), number: "RSL-INS-2026-0009", vehicleId: v5, locationId: locTema, date: new Date("2026-07-25T14:20:00"), inspectorId, inspectorName: "John Mensah", data: passData, sEff: "89.50", pEff: "86.10", smoke: "pass" as const, opacity: "1.80", result: "pass" as const, next: "2027-01-25", wf: "in_progress" as const },
  ];

  // Demo attached document (small PDF placeholder)
  const demoBrakeReport = {
    id: "demo-doc-brake",
    name: "Brake-Test-Report-2026-04-15.pdf",
    dataUrl: "data:application/pdf;base64,JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCA2MTIgNzkyXSAvQ29udGVudHMgNCAwIFIgL1Jlc291cmNlcyA8PCAvRm9udCA8PCAvRjEgNSAwIFIgPj4gPj4gPj4KZW5kb2JqCjQgMCBvYmoKPDwgL0xlbmd0aCA0NCA+PgpzdHJlYW0KQlQKL0YxIDE4IFRmCjEwMCA3MDAgVGQKKEJyYWtlIFRlc3QgUmVwb3J0KSBUagpFVAplbmRzdHJlYW0KZW5kb2JqCjUgMCBvYmoKPDwgL1R5cGUgL0ZvbnQgL1N1YnR5cGUgL1R5cGUxIC9CYXNlRm9udCAvSGVsdmV0aWNhID4+CmVuZG9iagp4cmVmCjAgNgowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMDkgMDAwMDAgbiAKMDAwMDAwMDA1MiAwMDAwMCBuIAowMDAwMDAwMTAxIDAwMDAwIG4gCjAwMDAwMDAyMDAgMDAwMDAgbiAKMDAwMDAwMDI5NCAwMDAwMCBuIAp0cmFpbGVyCjw8IC9TaXplIDYgL1Jvb3QgMSAwIFIgPj4Kc3RhcnR4cmVmCjM3NAolJUVPRgo=",
    type: "application/pdf",
    size: 24500,
  };

  for (const r of inspRows) {
    const totalPhotos = (r.data as any[]).reduce(
      (sum: number, s: any) => sum + s.items.reduce((iSum: number, it: any) => iSum + (it.photos?.length || 0), 0),
      0
    );
    const attachedDocuments = r.result === "fail" ? [demoBrakeReport] : [];
    await db.insert(inspections).values({
      id: r.id, inspectionNumber: r.number, vehicleId: r.vehicleId, locationId: r.locationId,
      inspectionDate: r.date, inspectorId: r.inspectorId, inspectorName: r.inspectorName,
      supervisorId: r.supervisorId, supervisorName: r.supervisorName,
      station: undefined, odometerReading: null,
      workflowStatus: r.wf, sectionData: r.data,
      serviceBrakeEfficiency: r.sEff, parkingBrakeEfficiency: r.pEff,
      smokeTest: r.smoke, noiseLevel: r.noise || null, opacityTest: r.opacity || null,
      overallResult: r.result, inspectorRemarks: r.result === "pass" ? "Vehicle in good mechanical condition." : "Defects require attention. Photo evidence captured.",
      supervisorRemarks: r.result === "pass" ? "Approved for continued operation." : null,
      nextInspectionDate: r.next || null, reinspectionDate: r.reinspect || null,
      status: r.wf === "completed" || r.wf === "approved" ? "completed" : "pending",
      templateType: "bus",
      totalPhotos,
      attachedDocuments,
    });
  }

  // Audit logs
  await db.insert(auditLogs).values([
    { id: newId(), userId: adminId, userName: "Akosua Boateng", action: "create", entityType: "vehicle", entityId: v1, entityLabel: "GT-1234-22", summary: "Created vehicle GT-1234-22", createdAt: new Date("2026-03-01T08:10:00") },
    { id: newId(), userId: inspectorId, userName: "John Mensah", action: "inspect", entityType: "inspection", entityId: inspRows[0].id, entityLabel: inspRows[0].number, summary: "Completed inspection — PASS", createdAt: new Date("2026-04-10T10:05:00") },
    { id: newId(), userId: inspectorId, userName: "John Mensah", action: "inspect", entityType: "inspection", entityId: inspRows[1].id, entityLabel: inspRows[1].number, summary: "Completed inspection — FAIL (brake & body defects)", createdAt: new Date("2026-04-15T11:30:00") },
    { id: newId(), userId: supervisorId, userName: "Grace Owusu", action: "approve", entityType: "inspection", entityId: inspRows[2].id, entityLabel: inspRows[2].number, summary: "Approved conditional pass", createdAt: new Date("2026-05-20T12:45:00") },
    { id: newId(), userId: adminId, userName: "Akosua Boateng", action: "update", entityType: "vehicle", entityId: v1, entityLabel: "GT-1234-22", summary: "Updated odometer reading to 185,000 km", createdAt: new Date("2026-07-26T11:32:00") },
    { id: newId(), userId: dataEntryId, userName: "Yaw Boateng", action: "import", entityType: "import_job", entityId: null, entityLabel: "legacy_vehicles.xlsx", summary: "Imported 245 historical vehicle records", createdAt: new Date("2026-03-15T14:20:00") },
    { id: newId(), userId: superAdminId, userName: "Dr. Emmanuel Owusu", action: "login", entityType: "user", entityId: superAdminId, entityLabel: "ceo@rsl.gh", summary: "Logged in from 197.234.12.10", createdAt: new Date("2026-07-01T07:55:00") },
    { id: newId(), userId: complianceId, userName: "Efua Sutherland", action: "export", entityType: "report", entityId: null, entityLabel: "Q2 Compliance Report", summary: "Exported quarterly compliance report as PDF", createdAt: new Date("2026-07-02T09:10:00") },
  ]);

  // Documents
  await db.insert(documents).values([
    { id: newId(), ownerType: "transporter", ownerId: t1, name: "Company Registration Certificate", type: "company", url: "/documents/metro-mass-registration.pdf", mimeType: "application/pdf", sizeBytes: 245000, uploadedBy: adminId },
    { id: newId(), ownerType: "transporter", ownerId: t1, name: "Fleet Insurance Policy", type: "insurance", url: "/documents/sic-policy.pdf", mimeType: "application/pdf", sizeBytes: 512000, expiryDate: "2026-11-30", uploadedBy: adminId },
    { id: newId(), ownerType: "transporter", ownerId: t1, name: "Business Permit 2024", type: "permit", url: "/documents/metro-mass-permit.pdf", mimeType: "application/pdf", sizeBytes: 180000, expiryDate: "2026-12-31", uploadedBy: adminId },
    { id: newId(), ownerType: "vehicle", ownerId: v1, name: "Roadworthy Certificate", type: "roadworthy", url: "/documents/gt-1234-22-rwc.pdf", mimeType: "application/pdf", expiryDate: "2026-08-15", uploadedBy: adminId },
    { id: newId(), ownerType: "vehicle", ownerId: v1, name: "Insurance Certificate", type: "insurance", url: "/documents/gt-1234-22-insurance.pdf", mimeType: "application/pdf", expiryDate: "2026-11-30", uploadedBy: adminId },
    { id: newId(), ownerType: "vehicle", ownerId: v2, name: "Road Fund License", type: "road_fund", url: "/documents/gt-5567-20-rf.pdf", mimeType: "application/pdf", expiryDate: "2026-07-15", uploadedBy: adminId },
  ]);

  // Notifications
  const now = new Date();
  const inDays = (d: number) => {
    const x = new Date(now); x.setDate(x.getDate() + d);
    return x.toISOString().slice(0, 10);
  };
  await db.insert(notifications).values([
    { id: newId(), userId: transporterUserId, type: "certificate_expiring", title: "Roadworthy expiring soon", message: "Vehicle GT-1234-22 roadworthy certificate expires in 15 days.", entityType: "vehicle", entityId: v1, dueDate: inDays(15), channel: "email", sentAt: now },
    { id: newId(), userId: transporterUserId, type: "inspection_due", title: "Inspection due", message: "Vehicle AS-9921-19 is due for periodic inspection.", entityType: "vehicle", entityId: v3, dueDate: inDays(7), channel: "in_app" },
    { id: newId(), userId: opsManagerId, type: "inspection_failed", title: "Vehicle failed inspection", message: "GT-5567-20 failed inspection with critical brake defects.", entityType: "inspection", entityId: inspRows[1].id, dueDate: now.toISOString().slice(0, 10), channel: "email", sentAt: now },
    { id: newId(), userId: complianceId, type: "reinspection_due", title: "Re-inspection overdue", message: "WR-5588-18 re-inspection window is closing.", entityType: "vehicle", entityId: v8, dueDate: inDays(3), channel: "sms" },
    { id: newId(), userId: adminId, type: "document_expiry", title: "Document expiry alert", message: "3 transporter documents expire this month.", channel: "in_app", dueDate: inDays(5) },
    { id: newId(), userId: superAdminId, type: "monthly_summary", title: "Monthly Summary — June", message: "156 inspections completed, 89% pass rate.", channel: "email", sentAt: now },
  ]);

  // Import jobs
  await db.insert(importJobs).values([
    { id: newId(), fileName: "legacy_vehicles.xlsx", fileType: "xlsx", entityType: "vehicles", status: "completed", totalRows: 245, validRows: 238, invalidRows: 7, importedRows: 238, createdBy: dataEntryId, createdAt: new Date("2026-03-15T14:15:00"), completedAt: new Date("2026-03-15T14:20:00") },
    { id: newId(), fileName: "transporters_2025.csv", fileType: "csv", entityType: "transporters", status: "completed", totalRows: 48, validRows: 48, invalidRows: 0, importedRows: 48, createdBy: dataEntryId, createdAt: new Date("2026-03-20T09:10:00"), completedAt: new Date("2026-03-20T09:12:00") },
    { id: newId(), fileName: "inspections_q1.xlsx", fileType: "xlsx", entityType: "inspections", status: "failed", totalRows: 120, validRows: 118, invalidRows: 2, importedRows: 0, errors: [{ row: 45, field: "vin", message: "Invalid VIN format" }, { row: 91, field: "inspection_date", message: "Date in the future" }], createdBy: dataEntryId, createdAt: new Date("2026-04-02T11:30:00") },
  ]);

  console.log("✓ Seeded enterprise RSL demo data");
  await seedApiKeysInternal();
  await seedDailyInspections({
    v1, v2, v3, v4, v5, v6, v7, v8,
    inspectorId, supervisorId,
  });
}

async function seedDailyInspections(ids: {
  v1: string; v2: string; v3: string; v4: string;
  v5: string; v6: string; v7: string; v8: string;
  inspectorId: string; supervisorId: string;
}) {
  const { dailyInspections } = await import("@/db/schema");
  const { buildDefaultDailyChecklist } = await import("./daily-checklist");
  const [existing] = await db.select().from(dailyInspections).limit(1);
  if (existing) return;

  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  const passAll = () => buildDefaultDailyChecklist();
  const withDefects = (count: number) => {
    const list = buildDefaultDailyChecklist();
    let added = 0;
    for (const cat of list) {
      for (const it of cat.items) {
        if (added >= count) break;
        if (it.result === "pass" && added < count) {
          it.result = "fail";
          it.notes = "Minor issue noted during walk-around";
          added++;
        }
      }
    }
    return list;
  };
  const withCriticalDefect = () => {
    const list = buildDefaultDailyChecklist();
    const brakes = list.find((c) => c.category === "Brakes");
    if (brakes) {
      brakes.items[0].result = "fail";
      brakes.items[0].notes = "Pedal travels too far — requires immediate service";
    }
    return list;
  };

  const rows = [
    { vehicleId: ids.v1, date: today, checklist: passAll(), status: "passed" as const, clearedForTrip: true, driver: "Samuel Owusu", purpose: "Accra → Kumasi passenger route", passed: 55, total: 55, failed: 0 },
    { vehicleId: ids.v3, date: today, checklist: withDefects(1), status: "defect_noted" as const, clearedForTrip: true, driver: "Kwame Mensah", purpose: "Local delivery", passed: 54, total: 55, failed: 1 },
    { vehicleId: ids.v4, date: today, checklist: withCriticalDefect(), status: "failed" as const, clearedForTrip: false, driver: "Isaac Boateng", purpose: "Tema port run", passed: 54, total: 55, failed: 1 },
    { vehicleId: ids.v6, date: yesterday, checklist: passAll(), status: "passed" as const, clearedForTrip: true, driver: "Abena Sarpong", purpose: "Morning passenger run", passed: 55, total: 55, failed: 0 },
    { vehicleId: ids.v7, date: yesterday, checklist: withDefects(2), status: "defect_noted" as const, clearedForTrip: true, driver: "Yaw Antwi", purpose: "Takoradi freight", passed: 53, total: 55, failed: 2 },
  ];

  for (const r of rows) {
    await db.insert(dailyInspections).values({
      id: newId(),
      vehicleId: r.vehicleId,
      driverId: ids.inspectorId,
      driverName: r.driver,
      inspectionDate: r.date,
      startTime: new Date(`${r.date}T06:30:00`),
      completedAt: new Date(`${r.date}T06:45:00`),
      odometer: Math.floor(Math.random() * 50000) + 100000,
      tripPurpose: r.purpose,
      status: r.status,
      checklist: r.checklist,
      totalItems: r.total,
      passedItems: r.passed,
      failedItems: r.failed,
      criticalDefects: r.status === "failed" ? [{ item: "Brakes: Brake pedal feel & travel", notes: "Pedal travels too far" }] : [],
      clearedForTrip: r.clearedForTrip,
      supervisorReview: r.date === yesterday,
      supervisorId: r.date === yesterday ? ids.supervisorId : null,
    });
  }
  console.log("✓ Seeded demo daily inspections");
}

async function seedApiKeysInternal() {
  const { apiKeys } = await import("@/db/schema");
  const [apiExisting] = await db.select().from(apiKeys).limit(1);
  if (apiExisting) return;
  const [admin] = await db.select().from(users).where(eq(users.role, "admin"));
  if (!admin) return;
  const { issueApiKey } = await import("@/lib/api-keys");
  const issued = await issueApiKey({
    userId: admin.id,
    name: "Development Integration Key",
    scopes: ["read", "write", "inspect"],
  });
  console.log(`✓ Seeded development API key (shown once): ${issued.raw}`);
}
