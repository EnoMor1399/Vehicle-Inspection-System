import { authenticateApiRequest, json, apiError } from "@/lib/api-auth";
import { db } from "@/db";
import { sql } from "drizzle-orm";

// Power BI DirectQuery-compatible OData v4 endpoint
// Supports: service document, $metadata, $filter, $select, $orderby, $top, $skip, $count, $format

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://vims.rsl.gh";

export async function GET(request: Request) {
  const auth = await authenticateApiRequest({ scopes: ["read"], permission: "reports" });
  if (!auth.ok) return apiError(auth.status, auth.message);

  const url = new URL(request.url);
  const path = url.searchParams.get("path") || "";
  const format = url.searchParams.get("$format") || url.searchParams.get("format") || "json";

  // Service document (root)
  if (!path || path === "/") {
    return jsonResponse({
      "@odata.context": `${BASE_URL}/api/v1/powerbi/$metadata`,
      value: [
        { name: "Inspections", kind: "EntitySet", url: "Inspections" },
        { name: "Vehicles", kind: "EntitySet", url: "Vehicles" },
        { name: "Transporters", kind: "EntitySet", url: "Transporters" },
        { name: "Stations", kind: "EntitySet", url: "Stations" },
        { name: "Defects", kind: "EntitySet", url: "Defects" },
        { name: "Documents", kind: "EntitySet", url: "Documents" },
        { name: "AuditLogs", kind: "EntitySet", url: "AuditLogs" },
        { name: "Users", kind: "EntitySet", url: "Users" },
      ],
    }, format);
  }

  // Parse path: e.g., "Inspections", "Vehicles", "Inspections?$filter=..."
  const [entityName, queryString] = path.split("?");
  const entity = entityName.toLowerCase();

  // Parse query options
  const opts = parseQueryOptions(url.searchParams, queryString);

  const loaders: Record<string, () => Promise<any>> = {
    inspections: () => loadInspections(opts),
    vehicles: () => loadVehicles(opts),
    transporters: () => loadTransporters(opts),
    stations: () => loadStations(opts),
    defects: () => loadDefects(opts),
    documents: () => loadDocuments(opts),
    auditlogs: () => loadAuditLogs(opts),
    users: () => loadUsers(opts),
  };

  const loader = loaders[entity];
  if (!loader) {
    return apiError(404, `Entity '${entityName}' not found. Available: ${Object.keys(loaders).map(k => capitalize(k)).join(", ")}`);
  }

  const result = await loader();
  return jsonResponse({
    "@odata.context": `${BASE_URL}/api/v1/powerbi/$metadata#${entityName}`,
    "@odata.count": opts.count ? result.total : undefined,
    value: result.data,
    ...(result.data.length === (opts.top || 100) && result.total > (opts.top || 100) + (opts.skip || 0)
      ? { "@odata.nextLink": `${BASE_URL}/api/v1/powerbi?path=${entityName}?$skip=${(opts.skip || 0) + (opts.top || 100)}&$top=${opts.top || 100}` }
      : {}),
  }, format);
}

function parseQueryOptions(params: URLSearchParams, queryString?: string) {
  const opts: any = {
    top: parseInt(params.get("$top") || "100"),
    skip: parseInt(params.get("$skip") || "0"),
    filter: params.get("$filter") || "",
    select: params.get("$select") || "",
    orderby: params.get("$orderby") || "",
    count: params.get("$count") === "true",
  };
  // Parse additional from queryString
  if (queryString) {
    const extra = new URLSearchParams(queryString);
    if (extra.get("$top")) opts.top = parseInt(extra.get("$top")!);
    if (extra.get("$skip")) opts.skip = parseInt(extra.get("$skip")!);
    if (extra.get("$filter")) opts.filter = extra.get("$filter");
    if (extra.get("$select")) opts.select = extra.get("$select");
    if (extra.get("$orderby")) opts.orderby = extra.get("$orderby");
    if (extra.get("$count") === "true") opts.count = true;
  }
  return opts;
}

function buildWhereClause(filter: string, allowedFields: Record<string, string>): string {
  if (!filter) return "";
  // Simple OData filter parser — supports eq, ne, gt, lt, ge, le, and, or
  // Maps OData field names to SQL column names
  let sql_filter = filter;
  for (const [odata, sqlCol] of Object.entries(allowedFields)) {
    sql_filter = sql_filter.replace(new RegExp(`\\b${odata}\\b`, "g"), sqlCol);
  }
  // Convert OData operators to SQL
  sql_filter = sql_filter
    .replace(/\beq\b/g, "=")
    .replace(/\bne\b/g, "!=")
    .replace(/\bgt\b/g, ">")
    .replace(/\blt\b/g, "<")
    .replace(/\bge\b/g, ">=")
    .replace(/\ble\b/g, "<=")
    .replace(/\band\b/gi, "AND")
    .replace(/\bor\b/gi, "OR");
  return `WHERE ${sql_filter}`;
}

function buildOrderBy(orderby: string, allowedFields: Record<string, string>): string {
  if (!orderby) return "";
  let sql_order = orderby;
  for (const [odata, sqlCol] of Object.entries(allowedFields)) {
    sql_order = sql_order.replace(new RegExp(`\\b${odata}\\b`, "g"), sqlCol);
  }
  sql_order = sql_order.replace(/\bdesc\b/gi, "DESC").replace(/\basc\b/gi, "ASC");
  return `ORDER BY ${sql_order}`;
}

async function loadInspections(opts: any) {
  const fields: Record<string, string> = {
    InspectionNumber: "i.inspection_number",
    InspectionDate: "i.inspection_date",
    OverallResult: "i.overall_result",
    WorkflowStatus: "i.workflow_status",
    InspectorName: "i.inspector_name",
    VehicleRegistration: "v.registration_number",
    VehicleMake: "v.make",
    VehicleModel: "v.model",
    TransporterName: "t.company_name",
    StationName: "l.name",
    StationRegion: "l.region",
  };
  const where = buildWhereClause(opts.filter, fields);
  const orderBy = buildOrderBy(opts.orderby || "i.inspection_date desc", fields);
  const select = opts.select ? buildSelectClause(opts.select, fields) : `
      i.id, i.inspection_number as "InspectionNumber", i.inspection_date as "InspectionDate",
      i.overall_result as "OverallResult", i.workflow_status as "WorkflowStatus",
      i.inspector_name as "InspectorName", i.station as "Station",
      i.service_brake_efficiency as "ServiceBrakeEfficiency",
      i.parking_brake_efficiency as "ParkingBrakeEfficiency",
      i.smoke_test as "SmokeTest", i.opacity_test as "OpacityTest",
      i.total_photos as "TotalPhotos", i.template_type as "TemplateType",
      i.next_inspection_date as "NextInspectionDate",
      i.reinspection_date as "ReinspectionDate",
      v.registration_number as "VehicleRegistration", v.make as "VehicleMake",
      v.model as "VehicleModel", v.body_type as "VehicleBodyType",
      v.category as "VehicleCategory", v.manufacturing_year as "VehicleYear",
      v.fuel_type as "VehicleFuelType",
      t.company_name as "TransporterName", t.region as "TransporterRegion",
      l.name as "StationName", l.region as "StationRegion"
  `;
  const rows = await query(sql.raw(`
    SELECT ${select}
    FROM inspections i
    INNER JOIN vehicles v ON v.id = i.vehicle_id
    LEFT JOIN transporters t ON t.id = v.transporter_id
    LEFT JOIN locations l ON l.id = i.location_id
    ${where}
    ${orderBy}
    LIMIT ${opts.top} OFFSET ${opts.skip}
  `));
  const countRow = await queryOne(sql.raw(`SELECT count(*)::int as c FROM inspections i INNER JOIN vehicles v ON v.id = i.vehicle_id LEFT JOIN transporters t ON t.id = v.transporter_id LEFT JOIN locations l ON l.id = i.location_id ${where}`));
  return { data: rows, total: countRow?.c || 0 };
}

async function loadVehicles(opts: any) {
  const fields: Record<string, string> = {
    RegistrationNumber: "v.registration_number",
    Make: "v.make", Model: "v.model", Status: "v.status",
    Category: "v.category", VehicleClass: "v.vehicle_class",
    FuelType: "v.fuel_type", ManufacturingYear: "v.manufacturing_year",
  };
  const where = buildWhereClause(opts.filter, fields);
  const orderBy = buildOrderBy(opts.orderby || "v.created_at desc", fields);
  const rows = await query(sql.raw(`
    SELECT v.id, v.registration_number as "RegistrationNumber",
      v.make as "Make", v.model as "Model", v.body_type as "BodyType",
      v.category as "Category", v.vehicle_class as "VehicleClass",
      v.colour as "Colour", v.manufacturing_year as "ManufacturingYear",
      v.fuel_type as "FuelType", v.transmission as "Transmission",
      v.seating_capacity as "SeatingCapacity", v.gross_weight as "GrossWeight",
      v.number_of_axles as "NumberOfAxles", v.odometer_reading as "OdometerReading",
      v.status as "Status", v.insurance_expiry as "InsuranceExpiry",
      v.roadworthy_expiry as "RoadworthyExpiry", v.road_fund_expiry as "RoadFundExpiry",
      v.vin as "VIN", v.chassis_number as "ChassisNumber",
      t.company_name as "TransporterName", t.region as "TransporterRegion",
      (SELECT count(*) FROM inspections i WHERE i.vehicle_id = v.id) as "TotalInspections",
      (SELECT count(*) FROM inspections i WHERE i.vehicle_id = v.id AND i.overall_result = 'pass') as "PassCount",
      (SELECT count(*) FROM inspections i WHERE i.vehicle_id = v.id AND i.overall_result = 'fail') as "FailCount"
    FROM vehicles v
    LEFT JOIN transporters t ON t.id = v.transporter_id
    ${where}
    ${orderBy}
    LIMIT ${opts.top} OFFSET ${opts.skip}
  `));
  const countRow = await queryOne(sql.raw(`SELECT count(*)::int as c FROM vehicles v ${where}`));
  return { data: rows, total: countRow?.c || 0 };
}

async function loadTransporters(opts: any) {
  const fields: Record<string, string> = {
    CompanyName: "t.company_name", Region: "t.region", District: "t.district",
  };
  const where = buildWhereClause(opts.filter, fields) || "WHERE t.deleted_at IS NULL";
  const orderBy = buildOrderBy(opts.orderby || "t.company_name", fields);
  const rows = await query(sql.raw(`
    SELECT t.id, t.company_name as "CompanyName", t.registration_number as "RegistrationNumber",
      t.tin_number as "TIN", t.region as "Region", t.district as "District",
      t.contact_person as "ContactPerson", t.mobile as "Mobile", t.email as "Email",
      t.insurance_company as "InsuranceCompany", t.insurance_expiry as "InsuranceExpiry",
      (SELECT count(*) FROM vehicles v WHERE v.transporter_id = t.id) as "FleetSize",
      (SELECT count(*) FROM vehicles v INNER JOIN inspections i ON i.vehicle_id = v.id WHERE v.transporter_id = t.id AND i.overall_result = 'pass') as "PassCount",
      (SELECT count(*) FROM vehicles v INNER JOIN inspections i ON i.vehicle_id = v.id WHERE v.transporter_id = t.id AND i.overall_result = 'fail') as "FailCount"
    FROM transporters t
    ${where}
    ${orderBy}
    LIMIT ${opts.top} OFFSET ${opts.skip}
  `));
  const countRow = await queryOne(sql.raw(`SELECT count(*)::int as c FROM transporters t WHERE t.deleted_at IS NULL`));
  return { data: rows, total: countRow?.c || 0 };
}

async function loadStations(opts: any) {
  const rows = await query(sql.raw(`
    SELECT l.id, l.name as "Name", l.code as "Code", l.region as "Region",
      l.district as "District", l.address as "Address", l.phone as "Phone",
      l.email as "Email", l.capacity as "Capacity", l.status as "Status",
      (SELECT count(*) FROM users u WHERE u.location_id = l.id) as "InspectorCount",
      (SELECT count(*) FROM inspections i WHERE i.location_id = l.id) as "InspectionCount",
      (SELECT count(*) FROM inspections i WHERE i.location_id = l.id AND i.overall_result = 'pass') as "PassCount",
      (SELECT count(*) FROM inspections i WHERE i.location_id = l.id AND i.overall_result = 'fail') as "FailCount"
    FROM locations l
    ORDER BY l.name
    LIMIT ${opts.top} OFFSET ${opts.skip}
  `));
  const countRow = await queryOne(sql.raw(`SELECT count(*)::int as c FROM locations`));
  return { data: rows, total: countRow?.c || 0 };
}

async function loadDefects(opts: any) {
  const rows = await query(sql.raw(`
    SELECT i.inspection_number as "InspectionNumber",
      i.inspection_date as "InspectionDate",
      i.overall_result as "InspectionResult",
      v.registration_number as "VehicleRegistration",
      v.make as "VehicleMake", v.model as "VehicleModel",
      sec->>'section' as "SectionCode",
      sec->>'title' as "SectionTitle",
      item->>'name' as "ItemName",
      item->>'result' as "Result",
      item->>'severity' as "Severity",
      item->>'remarks' as "Remarks",
      jsonb_array_length(coalesce(item->'photos', '[]'::jsonb)) as "PhotoCount"
    FROM inspections i
    INNER JOIN vehicles v ON v.id = i.vehicle_id,
    jsonb_array_elements(i.section_data) as sec,
    jsonb_array_elements(sec->'items') as item
    WHERE item->>'result' = 'fail'
    ORDER BY i.inspection_date DESC
    LIMIT ${opts.top} OFFSET ${opts.skip}
  `));
  const countRow = await queryOne(sql.raw(`
    SELECT count(*)::int as c
    FROM inspections i, jsonb_array_elements(i.section_data) as sec, jsonb_array_elements(sec->'items') as item
    WHERE item->>'result' = 'fail'
  `));
  return { data: rows, total: countRow?.c || 0 };
}

async function loadDocuments(opts: any) {
  const rows = await query(sql.raw(`
    SELECT d.id, d.name as "Name", d.type as "Type",
      d.owner_type as "OwnerType", d.owner_id as "OwnerId",
      d.mime_type as "MimeType", d.size_bytes as "SizeBytes",
      d.version as "Version", d.expiry_date as "ExpiryDate",
      d.created_at as "CreatedAt", u.name as "UploadedBy"
    FROM documents d
    LEFT JOIN users u ON u.id = d.uploaded_by
    ORDER BY d.created_at DESC
    LIMIT ${opts.top} OFFSET ${opts.skip}
  `));
  const countRow = await queryOne(sql.raw(`SELECT count(*)::int as c FROM documents`));
  return { data: rows, total: countRow?.c || 0 };
}

async function loadAuditLogs(opts: any) {
  const rows = await query(sql.raw(`
    SELECT a.id, a.action as "Action", a.entity_type as "EntityType",
      a.entity_id as "EntityId", a.entity_label as "EntityLabel",
      a.summary as "Summary", a.user_name as "UserName",
      a.ip_address as "IPAddress", a.created_at as "CreatedAt"
    FROM audit_logs a
    ORDER BY a.created_at DESC
    LIMIT ${opts.top} OFFSET ${opts.skip}
  `));
  const countRow = await queryOne(sql.raw(`SELECT count(*)::int as c FROM audit_logs`));
  return { data: rows, total: countRow?.c || 0 };
}

async function loadUsers(opts: any) {
  const rows = await query(sql.raw(`
    SELECT u.id, u.name as "Name", u.email as "Email", u.role as "Role",
      u.is_active as "IsActive", u.last_login_at as "LastLoginAt",
      u.created_at as "CreatedAt", l.name as "StationName"
    FROM users u
    LEFT JOIN locations l ON l.id = u.location_id
    ORDER BY u.name
    LIMIT ${opts.top} OFFSET ${opts.skip}
  `));
  const countRow = await queryOne(sql.raw(`SELECT count(*)::int as c FROM users`));
  return { data: rows, total: countRow?.c || 0 };
}

function buildSelectClause(select: string, fields: Record<string, string>): string {
  const cols = select.split(",").map((s) => s.trim());
  return cols.map((c) => {
    const sqlCol = fields[c];
    return sqlCol ? `${sqlCol} as "${c}"` : c;
  }).join(", ");
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Helper: extract rows from db.execute result (pg driver returns { rows: [...] })
async function query(sqlText: any): Promise<any[]> {
  const result = await db.execute(sqlText);
  return (result as any).rows || [];
}

async function queryOne(sqlText: any): Promise<any> {
  const rows = await query(sqlText);
  return rows[0] || null;
}

function jsonResponse(data: any, format: string) {
  if (format === "xml") {
    return new Response(odataToAtomXml(data), {
      headers: { "Content-Type": "application/atom+xml;type=feed;charset=utf-8" },
    });
  }
  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json;odata.metadata=minimal;odata.streaming=true",
      "OData-Version": "4.0",
    },
  });
}

function odataToAtomXml(data: any): string {
  const items = (data.value || []).map((item: any) => {
    const props = Object.entries(item).map(([k, v]) => `<d:${k}>${escapeXml(String(v ?? ""))}</d:${k}>`).join("");
    return `<entry><content type="application/xml"><m:properties>${props}</m:properties></content></entry>`;
  }).join("");
  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:d="http://schemas.microsoft.com/ado/2007/08/dataservices" xmlns:m="http://schemas.microsoft.com/ado/2007/08/dataservices/metadata">
${items}
</feed>`;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
