import { authenticateApiRequest, apiError } from "@/lib/api-auth";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { hasPermission } from "@/lib/auth";

// Power BI DirectQuery-compatible OData v4 endpoint
// Supports: service document, $metadata, $filter, $select, $orderby, $top, $skip, $count, $format

export async function GET(request: Request) {
  const auth = await authenticateApiRequest({ scopes: ["read"], permission: "reports" });
  if (!auth.ok) return apiError(auth.status, auth.message);

  const url = new URL(request.url);
  const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || url.origin).replace(/\/$/, "");
  const path = url.searchParams.get("path") || "";
  const format = url.searchParams.get("$format") || url.searchParams.get("format") || "json";

  const allowedEntities = [
    "Inspections",
    "PreTripInspections",
    "Vehicles",
    "Transporters",
    "Stations",
    "Defects",
    ...(hasPermission(auth.user, "documents") ? ["Documents"] : []),
    ...(hasPermission(auth.user, "audit") ? ["AuditLogs"] : []),
    ...(hasPermission(auth.user, "users") ? ["Users"] : []),
  ];

  if (!path || path === "/") {
    return jsonResponse({
      "@odata.context": `${baseUrl}/api/v1/powerbi/$metadata`,
      value: allowedEntities.map((name) => ({ name, kind: "EntitySet", url: name })),
    }, format);
  }

  const [entityName, queryString] = path.split("?");
  const entity = entityName.toLowerCase();
  if (!allowedEntities.some((name) => name.toLowerCase() === entity)) {
    return apiError(403, `Entity '${entityName}' is not available for this credential`);
  }

  try {
    const opts = parseQueryOptions(url.searchParams, queryString);
    const loaders: Record<string, () => Promise<any>> = {
      inspections: () => loadInspections(opts),
      pretripinspections: () => loadPreTripInspections(opts),
      vehicles: () => loadVehicles(opts),
      transporters: () => loadTransporters(opts),
      stations: () => loadStations(opts),
      defects: () => loadDefects(opts),
      documents: () => loadDocuments(opts),
      auditlogs: () => loadAuditLogs(opts),
      users: () => loadUsers(opts),
    };

    const loader = loaders[entity];
    if (!loader) return apiError(404, `Entity '${entityName}' not found`);

    const result = await loader();
    return jsonResponse({
      "@odata.context": `${baseUrl}/api/v1/powerbi/$metadata#${entityName}`,
      "@odata.count": opts.count ? result.total : undefined,
      value: result.data,
      ...(result.data.length === opts.top && result.total > opts.top + opts.skip
        ? { "@odata.nextLink": `${baseUrl}/api/v1/powerbi?path=${encodeURIComponent(entityName)}&$skip=${opts.skip + opts.top}&$top=${opts.top}` }
        : {}),
    }, format);
  } catch (error) {
    return apiError(400, error instanceof Error ? error.message : "Invalid OData query");
  }
}

type QueryOptions = {
  top: number;
  skip: number;
  filter: string;
  select: string;
  orderby: string;
  count: boolean;
};

function boundedInteger(value: string | null, fallback: number, min: number, max: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) throw new Error("Invalid pagination value");
  return Math.min(max, Math.max(min, parsed));
}

function parseQueryOptions(params: URLSearchParams, queryString?: string): QueryOptions {
  const extra = queryString ? new URLSearchParams(queryString) : new URLSearchParams();
  const read = (key: string) => extra.get(key) ?? params.get(key);
  return {
    top: boundedInteger(read("$top"), 100, 1, 500),
    skip: boundedInteger(read("$skip"), 0, 0, 100000),
    filter: read("$filter") || "",
    select: read("$select") || "",
    orderby: read("$orderby") || "",
    count: read("$count") === "true",
  };
}

const ODATA_OPERATOR: Record<string, string> = {
  eq: "=",
  ne: "!=",
  gt: ">",
  lt: "<",
  ge: ">=",
  le: "<=",
};

function safeSqlLiteral(raw: string): string {
  const value = raw.trim();
  if (/^-?\d+(?:\.\d+)?$/.test(value)) return value;
  if (/^(true|false)$/i.test(value)) return value.toLowerCase();
  if (/^null$/i.test(value)) return "NULL";
  if (/^'(?:[^']|'')*'$/.test(value)) {
    const inner = value.slice(1, -1).replace(/''/g, "'");
    return `'${inner.replace(/'/g, "''")}'`;
  }
  throw new Error("Unsupported OData filter value");
}

function buildWhereClause(filter: string, allowedFields: Record<string, string>, baseCondition?: string): string {
  const trimmed = filter.trim();
  if (!trimmed) return baseCondition ? `WHERE ${baseCondition}` : "";
  if (/[;]|--|\/\*/.test(trimmed)) throw new Error("Unsupported OData filter syntax");

  const tokens = trimmed.split(/\s+(and|or)\s+/i);
  const expressions: string[] = [];
  for (let index = 0; index < tokens.length; index += 2) {
    const condition = tokens[index].trim();
    const match = condition.match(/^([A-Za-z][A-Za-z0-9_]*)\s+(eq|ne|gt|lt|ge|le)\s+(.+)$/i);
    if (!match) throw new Error("Unsupported OData filter expression");
    const [, fieldName, operatorName, rawValue] = match;
    const sqlField = allowedFields[fieldName];
    if (!sqlField) throw new Error(`Filtering by '${fieldName}' is not allowed`);
    const operator = ODATA_OPERATOR[operatorName.toLowerCase()];
    const literal = safeSqlLiteral(rawValue);
    expressions.push(`${sqlField} ${operator} ${literal}`);
    if (index + 1 < tokens.length) {
      const connector = tokens[index + 1].toUpperCase();
      if (connector !== "AND" && connector !== "OR") throw new Error("Unsupported OData connector");
      expressions.push(connector);
    }
  }

  const clause = `(${expressions.join(" ")})`;
  return `WHERE ${baseCondition ? `${baseCondition} AND ` : ""}${clause}`;
}

function buildOrderBy(orderby: string, allowedFields: Record<string, string>, fallbackField: string): string {
  const raw = orderby.trim() || fallbackField;
  const items = raw.split(",").map((item) => item.trim()).filter(Boolean);
  if (items.length > 4) throw new Error("Too many order-by fields");
  const clauses = items.map((item) => {
    const match = item.match(/^([A-Za-z][A-Za-z0-9_]*)(?:\s+(asc|desc))?$/i);
    if (!match) throw new Error("Unsupported OData order-by expression");
    const sqlField = allowedFields[match[1]];
    if (!sqlField) throw new Error(`Ordering by '${match[1]}' is not allowed`);
    return `${sqlField} ${(match[2] || "asc").toUpperCase()}`;
  });
  return `ORDER BY ${clauses.join(", ")}`;
}

function buildSelectClause(select: string, fields: Record<string, string>): string {
  const cols = select.split(",").map((s) => s.trim()).filter(Boolean);
  if (!cols.length) throw new Error("At least one select field is required");
  if (cols.length > 30) throw new Error("Too many selected fields");
  return cols.map((field) => {
    const sqlCol = fields[field];
    if (!sqlCol) throw new Error(`Selecting '${field}' is not allowed`);
    return `${sqlCol} as "${field}"`;
  }).join(", ");
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
  const orderBy = buildOrderBy(opts.orderby, fields, "InspectionDate desc");
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

async function loadPreTripInspections(opts: any) {
  const fields: Record<string, string> = {
    InspectionDate: "d.inspection_date",
    Status: "d.status",
    ClearedForTrip: "d.cleared_for_trip",
    DriverName: "d.driver_name",
    VehicleRegistration: "v.registration_number",
    VehicleMake: "v.make",
    VehicleModel: "v.model",
    TransporterName: "t.company_name",
    TransporterRegion: "t.region",
  };
  const where = buildWhereClause(opts.filter, fields);
  const orderBy = buildOrderBy(opts.orderby, fields, "InspectionDate desc");
  const select = opts.select ? buildSelectClause(opts.select, fields) : `
      d.id,
      d.inspection_date as "InspectionDate",
      d.start_time as "StartTime",
      d.completed_at as "CompletedAt",
      d.driver_name as "DriverName",
      d.odometer as "Odometer",
      d.trip_purpose as "TripPurpose",
      d.route_description as "RouteDescription",
      d.status as "Status",
      d.total_items as "TotalItems",
      d.passed_items as "PassedItems",
      d.failed_items as "FailedItems",
      d.cleared_for_trip as "ClearedForTrip",
      d.supervisor_review as "SupervisorReview",
      d.notes as "Notes",
      v.registration_number as "VehicleRegistration",
      v.make as "VehicleMake",
      v.model as "VehicleModel",
      t.company_name as "TransporterName",
      t.region as "TransporterRegion"
  `;
  const rows = await query(sql.raw(`
    SELECT ${select}
    FROM daily_inspections d
    INNER JOIN vehicles v ON v.id = d.vehicle_id
    LEFT JOIN transporters t ON t.id = v.transporter_id
    ${where}
    ${orderBy}
    LIMIT ${opts.top} OFFSET ${opts.skip}
  `));
  const countRow = await queryOne(sql.raw(`
    SELECT count(*)::int as c
    FROM daily_inspections d
    INNER JOIN vehicles v ON v.id = d.vehicle_id
    LEFT JOIN transporters t ON t.id = v.transporter_id
    ${where}
  `));
  return { data: rows, total: countRow?.c || 0 };
}

async function loadVehicles(opts: any) {
  const fields: Record<string, string> = {
    RegistrationNumber: "v.registration_number",
    Make: "v.make", Model: "v.model", Status: "v.status",
    Category: "v.category", VehicleClass: "v.vehicle_class",
    FuelType: "v.fuel_type", ManufacturingYear: "v.manufacturing_year",
    TransporterRegion: "t.region",
  };
  const where = buildWhereClause(opts.filter, fields);
  const orderBy = buildOrderBy(opts.orderby, fields, "RegistrationNumber asc");
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
  const countRow = await queryOne(sql.raw(`SELECT count(*)::int as c FROM vehicles v LEFT JOIN transporters t ON t.id = v.transporter_id ${where}`));
  return { data: rows, total: countRow?.c || 0 };
}

async function loadTransporters(opts: any) {
  const fields: Record<string, string> = {
    CompanyName: "t.company_name", Region: "t.region", District: "t.district",
  };
  const where = buildWhereClause(opts.filter, fields, "t.deleted_at IS NULL");
  const orderBy = buildOrderBy(opts.orderby, fields, "CompanyName asc");
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
  const countRow = await queryOne(sql.raw(`SELECT count(*)::int as c FROM transporters t ${where}`));
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
