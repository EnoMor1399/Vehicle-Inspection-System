import { authenticateApiRequest, apiError } from "@/lib/api-auth";
import { db } from "@/db";
import { sql, type SQL } from "drizzle-orm";
import { hasPermission } from "@/lib/auth";

// Power BI-compatible OData v4 endpoint.
// Supports: service document, $metadata, $filter, $select, $orderby, $top, $skip, $count, $format.

const MAX_PATH_LENGTH = 4096;
const MAX_FILTER_LENGTH = 2000;
const MAX_SELECT_LENGTH = 1000;
const MAX_ORDERBY_LENGTH = 500;
const MAX_FILTER_CONDITIONS = 20;
const MAX_SELECTED_FIELDS = 30;
const MAX_ORDER_FIELDS = 4;

type Row = Record<string, unknown>;
type PageResult = { data: Row[]; total?: number; hasMore: boolean };

class ODataQueryError extends Error {}

function invalidQuery(message: string): never {
  throw new ODataQueryError(message);
}

function configuredPublicBaseUrl(): string {
  const configured = (process.env.NEXT_PUBLIC_APP_URL || "").trim();
  if (configured) {
    try {
      const url = new URL(configured);
      const allowedProtocol = url.protocol === "https:" || (process.env.NODE_ENV !== "production" && url.protocol === "http:");
      if (allowedProtocol && !url.username && !url.password) return url.origin;
    } catch {
      // Fall through to the safe environment-specific placeholder below.
    }
  }
  return process.env.NODE_ENV === "production"
    ? "https://your-vims-domain.example"
    : "http://localhost:3000";
}

function normalizeFormat(value: string): "json" | "xml" | null {
  const normalized = value.trim().toLowerCase();
  if (["json", "application/json"].includes(normalized)) return "json";
  if (["xml", "atom", "application/atom+xml"].includes(normalized)) return "xml";
  return null;
}

export async function GET(request: Request) {
  const auth = await authenticateApiRequest({ scopes: ["read"], permission: "reports" });
  if (!auth.ok) return apiError(auth.status, auth.message);

  const url = new URL(request.url);
  const baseUrl = configuredPublicBaseUrl();
  const path = url.searchParams.get("path") || "";
  if (path.length > MAX_PATH_LENGTH) return apiError(400, "Power BI path is too long");

  const requestedFormat = url.searchParams.get("$format") || url.searchParams.get("format") || "json";
  const format = normalizeFormat(requestedFormat);
  if (!format) return apiError(400, "Unsupported Power BI response format");

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

  const queryStart = path.indexOf("?");
  const entityName = (queryStart >= 0 ? path.slice(0, queryStart) : path).trim();
  const queryString = queryStart >= 0 ? path.slice(queryStart + 1) : undefined;
  if (!/^[A-Za-z][A-Za-z0-9]{0,63}$/.test(entityName)) {
    return apiError(400, "Invalid Power BI entity name");
  }

  const entity = entityName.toLowerCase();
  if (!allowedEntities.some((name) => name.toLowerCase() === entity)) {
    return apiError(403, `Entity '${entityName}' is not available for this credential`);
  }

  try {
    const opts = parseQueryOptions(url.searchParams, queryString);
    const loaders: Record<string, () => Promise<PageResult>> = {
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
      ...(result.hasMore ? { "@odata.nextLink": buildNextLink(baseUrl, entityName, opts) } : {}),
    }, format);
  } catch (error) {
    if (error instanceof ODataQueryError) return apiError(400, error.message);
    console.error("[powerbi] query execution failed");
    return apiError(500, "Unable to complete the Power BI query");
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
  if (value === null || value === "") return fallback;
  if (!/^\d+$/.test(value)) invalidQuery("Pagination values must be whole numbers");
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) {
    invalidQuery(`Pagination value must be between ${min} and ${max}`);
  }
  return parsed;
}

function boundedOption(value: string | null, maxLength: number, label: string): string {
  if (!value) return "";
  if (value.length > maxLength) invalidQuery(`${label} is too long`);
  return value;
}

function parseCount(value: string | null): boolean {
  if (value === null || value === "" || value === "false") return false;
  if (value === "true") return true;
  invalidQuery("$count must be true or false");
}

function parseQueryOptions(params: URLSearchParams, queryString?: string): QueryOptions {
  const extra = queryString ? new URLSearchParams(queryString) : new URLSearchParams();
  const read = (key: string) => extra.get(key) ?? params.get(key);
  return {
    top: boundedInteger(read("$top"), 100, 1, 500),
    skip: boundedInteger(read("$skip"), 0, 0, 100000),
    filter: boundedOption(read("$filter"), MAX_FILTER_LENGTH, "$filter"),
    select: boundedOption(read("$select"), MAX_SELECT_LENGTH, "$select"),
    orderby: boundedOption(read("$orderby"), MAX_ORDERBY_LENGTH, "$orderby"),
    count: parseCount(read("$count")),
  };
}

function buildNextLink(baseUrl: string, entityName: string, opts: QueryOptions): string {
  const next = new URL(`${baseUrl}/api/v1/powerbi`);
  next.searchParams.set("path", entityName);
  next.searchParams.set("$top", String(opts.top));
  next.searchParams.set("$skip", String(opts.skip + opts.top));
  if (opts.filter) next.searchParams.set("$filter", opts.filter);
  if (opts.select) next.searchParams.set("$select", opts.select);
  if (opts.orderby) next.searchParams.set("$orderby", opts.orderby);
  if (opts.count) next.searchParams.set("$count", "true");
  return next.toString();
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
  invalidQuery("Unsupported OData filter value");
}

function buildWhereClause(filter: string, allowedFields: Record<string, string>, baseCondition?: string): string {
  const trimmed = filter.trim();
  if (!trimmed) return baseCondition ? `WHERE ${baseCondition}` : "";
  if (/[;]|--|\/\*/.test(trimmed)) invalidQuery("Unsupported OData filter syntax");

  const tokens = trimmed.split(/\s+(and|or)\s+/i);
  const conditionCount = Math.ceil(tokens.length / 2);
  if (conditionCount > MAX_FILTER_CONDITIONS) invalidQuery("Too many OData filter conditions");

  const expressions: string[] = [];
  for (let index = 0; index < tokens.length; index += 2) {
    const condition = tokens[index].trim();
    const match = condition.match(/^([A-Za-z][A-Za-z0-9_]*)\s+(eq|ne|gt|lt|ge|le)\s+(.+)$/i);
    if (!match) invalidQuery("Unsupported OData filter expression");
    const [, fieldName, operatorName, rawValue] = match;
    const sqlField = allowedFields[fieldName];
    if (!sqlField) invalidQuery(`Filtering by '${fieldName}' is not allowed`);
    const operator = ODATA_OPERATOR[operatorName.toLowerCase()];
    const literal = safeSqlLiteral(rawValue);
    expressions.push(`${sqlField} ${operator} ${literal}`);
    if (index + 1 < tokens.length) {
      const connector = tokens[index + 1].toUpperCase();
      if (connector !== "AND" && connector !== "OR") invalidQuery("Unsupported OData connector");
      expressions.push(connector);
    }
  }

  const clause = `(${expressions.join(" ")})`;
  return `WHERE ${baseCondition ? `${baseCondition} AND ` : ""}${clause}`;
}

function buildOrderBy(orderby: string, allowedFields: Record<string, string>, fallbackField: string): string {
  const raw = orderby.trim() || fallbackField;
  const items = raw.split(",").map((item) => item.trim()).filter(Boolean);
  if (items.length > MAX_ORDER_FIELDS) invalidQuery("Too many order-by fields");
  const clauses = items.map((item) => {
    const match = item.match(/^([A-Za-z][A-Za-z0-9_]*)(?:\s+(asc|desc))?$/i);
    if (!match) invalidQuery("Unsupported OData order-by expression");
    const sqlField = allowedFields[match[1]];
    if (!sqlField) invalidQuery(`Ordering by '${match[1]}' is not allowed`);
    return `${sqlField} ${(match[2] || "asc").toUpperCase()}`;
  });
  return `ORDER BY ${clauses.join(", ")}`;
}

function buildSelectClause(select: string, fields: Record<string, string>): string {
  const cols = select.split(",").map((item) => item.trim()).filter(Boolean);
  if (!cols.length) invalidQuery("At least one select field is required");
  if (cols.length > MAX_SELECTED_FIELDS) invalidQuery("Too many selected fields");
  return cols.map((field) => {
    const sqlCol = fields[field];
    if (!sqlCol) invalidQuery(`Selecting '${field}' is not allowed`);
    return `${sqlCol} as "${field}"`;
  }).join(", ");
}

function selectedColumns(opts: QueryOptions, fields: Record<string, string>, defaults: string[]): string {
  return buildSelectClause(opts.select || defaults.join(","), fields);
}

async function finishPage(rows: Row[], opts: QueryOptions, countQuery: SQL): Promise<PageResult> {
  const hasMore = rows.length > opts.top;
  const data = hasMore ? rows.slice(0, opts.top) : rows;
  if (!opts.count) return { data, hasMore };

  const countRow = await queryOne(countQuery);
  const rawCount = countRow?.c;
  const total = typeof rawCount === "number" ? rawCount : Number(rawCount || 0);
  return { data, total: Number.isFinite(total) ? total : 0, hasMore };
}

async function loadInspections(opts: QueryOptions): Promise<PageResult> {
  const fields: Record<string, string> = {
    id: "i.id",
    InspectionNumber: "i.inspection_number",
    InspectionDate: "i.inspection_date",
    OverallResult: "i.overall_result",
    WorkflowStatus: "i.workflow_status",
    InspectorName: "i.inspector_name",
    VehicleRegistration: "v.registration_number",
    TransporterName: "t.company_name",
    StationName: "l.name",
  };
  const defaults = ["id", "InspectionNumber", "InspectionDate", "OverallResult", "WorkflowStatus", "VehicleRegistration", "InspectorName", "TransporterName", "StationName"];
  const where = buildWhereClause(opts.filter, fields);
  const orderBy = buildOrderBy(opts.orderby, fields, "InspectionDate desc");
  const select = selectedColumns(opts, fields, defaults);
  const rows = await query(sql.raw(`
    SELECT ${select}
    FROM inspections i
    INNER JOIN vehicles v ON v.id = i.vehicle_id
    LEFT JOIN transporters t ON t.id = v.transporter_id
    LEFT JOIN locations l ON l.id = i.location_id
    ${where}
    ${orderBy}
    LIMIT ${opts.top + 1} OFFSET ${opts.skip}
  `));
  return finishPage(
    rows,
    opts,
    sql.raw(`SELECT count(*)::int as c FROM inspections i INNER JOIN vehicles v ON v.id = i.vehicle_id LEFT JOIN transporters t ON t.id = v.transporter_id LEFT JOIN locations l ON l.id = i.location_id ${where}`)
  );
}

async function loadPreTripInspections(opts: QueryOptions): Promise<PageResult> {
  const fields: Record<string, string> = {
    id: "d.id",
    InspectionDate: "d.inspection_date",
    Status: "d.status",
    ClearedForTrip: "d.cleared_for_trip",
    DriverName: "d.driver_name",
    PassedItems: "d.passed_items",
    FailedItems: "d.failed_items",
    VehicleRegistration: "v.registration_number",
    TransporterName: "t.company_name",
  };
  const defaults = ["id", "InspectionDate", "Status", "ClearedForTrip", "VehicleRegistration", "DriverName", "PassedItems", "FailedItems", "TransporterName"];
  const where = buildWhereClause(opts.filter, fields);
  const orderBy = buildOrderBy(opts.orderby, fields, "InspectionDate desc");
  const select = selectedColumns(opts, fields, defaults);
  const rows = await query(sql.raw(`
    SELECT ${select}
    FROM daily_inspections d
    INNER JOIN vehicles v ON v.id = d.vehicle_id
    LEFT JOIN transporters t ON t.id = v.transporter_id
    ${where}
    ${orderBy}
    LIMIT ${opts.top + 1} OFFSET ${opts.skip}
  `));
  return finishPage(
    rows,
    opts,
    sql.raw(`SELECT count(*)::int as c FROM daily_inspections d INNER JOIN vehicles v ON v.id = d.vehicle_id LEFT JOIN transporters t ON t.id = v.transporter_id ${where}`)
  );
}

async function loadVehicles(opts: QueryOptions): Promise<PageResult> {
  const totalInspections = "(SELECT count(*) FROM inspections i WHERE i.vehicle_id = v.id)";
  const fields: Record<string, string> = {
    id: "v.id",
    RegistrationNumber: "v.registration_number",
    Make: "v.make",
    Model: "v.model",
    Status: "v.status",
    Category: "v.category",
    InsuranceExpiry: "v.insurance_expiry",
    RoadworthyExpiry: "v.roadworthy_expiry",
    TransporterName: "t.company_name",
    TotalInspections: totalInspections,
  };
  const defaults = ["id", "RegistrationNumber", "Make", "Model", "Status", "Category", "TransporterName", "InsuranceExpiry", "RoadworthyExpiry", "TotalInspections"];
  const where = buildWhereClause(opts.filter, fields);
  const orderBy = buildOrderBy(opts.orderby, fields, "RegistrationNumber asc");
  const select = selectedColumns(opts, fields, defaults);
  const rows = await query(sql.raw(`SELECT ${select} FROM vehicles v LEFT JOIN transporters t ON t.id = v.transporter_id ${where} ${orderBy} LIMIT ${opts.top + 1} OFFSET ${opts.skip}`));
  return finishPage(rows, opts, sql.raw(`SELECT count(*)::int as c FROM vehicles v LEFT JOIN transporters t ON t.id = v.transporter_id ${where}`));
}

async function loadTransporters(opts: QueryOptions): Promise<PageResult> {
  const fleetSize = "(SELECT count(*) FROM vehicles v WHERE v.transporter_id = t.id)";
  const passCount = "(SELECT count(*) FROM vehicles v INNER JOIN inspections i ON i.vehicle_id = v.id WHERE v.transporter_id = t.id AND i.overall_result = 'pass')";
  const failCount = "(SELECT count(*) FROM vehicles v INNER JOIN inspections i ON i.vehicle_id = v.id WHERE v.transporter_id = t.id AND i.overall_result = 'fail')";
  const fields: Record<string, string> = {
    id: "t.id",
    CompanyName: "t.company_name",
    Region: "t.region",
    District: "t.district",
    FleetSize: fleetSize,
    PassCount: passCount,
    FailCount: failCount,
  };
  const defaults = ["id", "CompanyName", "Region", "District", "FleetSize", "PassCount", "FailCount"];
  const where = buildWhereClause(opts.filter, fields, "t.deleted_at IS NULL");
  const orderBy = buildOrderBy(opts.orderby, fields, "CompanyName asc");
  const select = selectedColumns(opts, fields, defaults);
  const rows = await query(sql.raw(`SELECT ${select} FROM transporters t ${where} ${orderBy} LIMIT ${opts.top + 1} OFFSET ${opts.skip}`));
  return finishPage(rows, opts, sql.raw(`SELECT count(*)::int as c FROM transporters t ${where}`));
}

async function loadStations(opts: QueryOptions): Promise<PageResult> {
  const inspectionCount = "(SELECT count(*) FROM inspections i WHERE i.location_id = l.id)";
  const passCount = "(SELECT count(*) FROM inspections i WHERE i.location_id = l.id AND i.overall_result = 'pass')";
  const failCount = "(SELECT count(*) FROM inspections i WHERE i.location_id = l.id AND i.overall_result = 'fail')";
  const fields: Record<string, string> = {
    id: "l.id",
    Name: "l.name",
    Code: "l.code",
    Region: "l.region",
    Capacity: "l.capacity",
    InspectionCount: inspectionCount,
    PassCount: passCount,
    FailCount: failCount,
  };
  const defaults = ["id", "Name", "Code", "Region", "Capacity", "InspectionCount", "PassCount", "FailCount"];
  const where = buildWhereClause(opts.filter, fields);
  const orderBy = buildOrderBy(opts.orderby, fields, "Name asc");
  const select = selectedColumns(opts, fields, defaults);
  const rows = await query(sql.raw(`SELECT ${select} FROM locations l ${where} ${orderBy} LIMIT ${opts.top + 1} OFFSET ${opts.skip}`));
  return finishPage(rows, opts, sql.raw(`SELECT count(*)::int as c FROM locations l ${where}`));
}

async function loadDefects(opts: QueryOptions): Promise<PageResult> {
  const photoCount = "jsonb_array_length(coalesce(item->'photos', '[]'::jsonb))";
  const fields: Record<string, string> = {
    InspectionNumber: "i.inspection_number",
    InspectionDate: "i.inspection_date",
    VehicleRegistration: "v.registration_number",
    SectionCode: "sec->>'section'",
    ItemName: "item->>'name'",
    Severity: "item->>'severity'",
    PhotoCount: photoCount,
  };
  const defaults = ["InspectionNumber", "InspectionDate", "VehicleRegistration", "SectionCode", "ItemName", "Severity", "PhotoCount"];
  const where = buildWhereClause(opts.filter, fields, "item->>'result' = 'fail'");
  const orderBy = buildOrderBy(opts.orderby, fields, "InspectionDate desc");
  const select = selectedColumns(opts, fields, defaults);
  const from = `FROM inspections i INNER JOIN vehicles v ON v.id = i.vehicle_id, jsonb_array_elements(i.section_data) as sec, jsonb_array_elements(sec->'items') as item`;
  const rows = await query(sql.raw(`SELECT ${select} ${from} ${where} ${orderBy} LIMIT ${opts.top + 1} OFFSET ${opts.skip}`));
  return finishPage(rows, opts, sql.raw(`SELECT count(*)::int as c ${from} ${where}`));
}

async function loadDocuments(opts: QueryOptions): Promise<PageResult> {
  const fields: Record<string, string> = {
    id: "d.id",
    Name: "d.name",
    Type: "d.type",
    OwnerType: "d.owner_type",
    Version: "d.version",
    ExpiryDate: "d.expiry_date",
    UploadedBy: "u.name",
  };
  const defaults = ["id", "Name", "Type", "OwnerType", "ExpiryDate", "Version", "UploadedBy"];
  const where = buildWhereClause(opts.filter, fields);
  const orderBy = buildOrderBy(opts.orderby, fields, "Name asc");
  const select = selectedColumns(opts, fields, defaults);
  const rows = await query(sql.raw(`SELECT ${select} FROM documents d LEFT JOIN users u ON u.id = d.uploaded_by ${where} ${orderBy} LIMIT ${opts.top + 1} OFFSET ${opts.skip}`));
  return finishPage(rows, opts, sql.raw(`SELECT count(*)::int as c FROM documents d LEFT JOIN users u ON u.id = d.uploaded_by ${where}`));
}

async function loadAuditLogs(opts: QueryOptions): Promise<PageResult> {
  const fields: Record<string, string> = {
    id: "a.id",
    Action: "a.action",
    EntityType: "a.entity_type",
    Summary: "a.summary",
    UserName: "a.user_name",
    IPAddress: "a.ip_address",
    CreatedAt: "a.created_at",
  };
  const defaults = ["id", "Action", "EntityType", "UserName", "Summary", "IPAddress", "CreatedAt"];
  const where = buildWhereClause(opts.filter, fields);
  const orderBy = buildOrderBy(opts.orderby, fields, "CreatedAt desc");
  const select = selectedColumns(opts, fields, defaults);
  const rows = await query(sql.raw(`SELECT ${select} FROM audit_logs a ${where} ${orderBy} LIMIT ${opts.top + 1} OFFSET ${opts.skip}`));
  return finishPage(rows, opts, sql.raw(`SELECT count(*)::int as c FROM audit_logs a ${where}`));
}

async function loadUsers(opts: QueryOptions): Promise<PageResult> {
  const fields: Record<string, string> = {
    id: "u.id",
    Name: "u.name",
    Email: "u.email",
    Role: "u.role",
    IsActive: "u.is_active",
    LastLoginAt: "u.last_login_at",
    StationName: "l.name",
  };
  const defaults = ["id", "Name", "Email", "Role", "IsActive", "LastLoginAt", "StationName"];
  const where = buildWhereClause(opts.filter, fields);
  const orderBy = buildOrderBy(opts.orderby, fields, "Name asc");
  const select = selectedColumns(opts, fields, defaults);
  const rows = await query(sql.raw(`SELECT ${select} FROM users u LEFT JOIN locations l ON l.id = u.location_id ${where} ${orderBy} LIMIT ${opts.top + 1} OFFSET ${opts.skip}`));
  return finishPage(rows, opts, sql.raw(`SELECT count(*)::int as c FROM users u LEFT JOIN locations l ON l.id = u.location_id ${where}`));
}

async function query(sqlText: SQL): Promise<Row[]> {
  const result = await db.execute(sqlText);
  return ((result as { rows?: Row[] }).rows || []);
}

async function queryOne(sqlText: SQL): Promise<Row | null> {
  const rows = await query(sqlText);
  return rows[0] || null;
}

function jsonResponse(data: Record<string, unknown>, format: "json" | "xml") {
  if (format === "xml") {
    return new Response(odataToAtomXml(data), {
      headers: {
        "Content-Type": "application/atom+xml;type=feed;charset=utf-8",
        "OData-Version": "4.0",
        "Cache-Control": "private, no-store",
      },
    });
  }
  return new Response(JSON.stringify(data), {
    headers: {
      "Content-Type": "application/json;odata.metadata=minimal;odata.streaming=true",
      "OData-Version": "4.0",
      "Cache-Control": "private, no-store",
    },
  });
}

function odataToAtomXml(data: Record<string, unknown>): string {
  const values = Array.isArray(data.value) ? data.value : [];
  const items = values.map((item) => {
    if (!item || typeof item !== "object") return "";
    const props = Object.entries(item).map(([key, value]) => `<d:${key}>${escapeXml(String(value ?? ""))}</d:${key}>`).join("");
    return `<entry><content type="application/xml"><m:properties>${props}</m:properties></content></entry>`;
  }).join("");
  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom" xmlns:d="http://schemas.microsoft.com/ado/2007/08/dataservices" xmlns:m="http://schemas.microsoft.com/ado/2007/08/dataservices/metadata">
${items}
</feed>`;
}

function escapeXml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
