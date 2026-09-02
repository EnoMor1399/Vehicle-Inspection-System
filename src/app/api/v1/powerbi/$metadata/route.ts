import { authenticateApiRequest } from "@/lib/api-auth";
import { hasPermission } from "@/lib/auth";

// OData v4 $metadata endpoint. The schema intentionally mirrors the exact
// least-privilege fields exposed by the Power BI data endpoint.

type PropertyDefinition = {
  name: string;
  type: string;
  nullable?: boolean;
};

type EntityDefinition = {
  setName: string;
  typeName: string;
  keys: string[];
  properties: PropertyDefinition[];
  permission?: string;
};

const ENTITIES: EntityDefinition[] = [
  {
    setName: "Inspections",
    typeName: "Inspection",
    keys: ["id"],
    properties: [
      { name: "id", type: "Edm.String", nullable: false },
      { name: "InspectionNumber", type: "Edm.String" },
      { name: "InspectionDate", type: "Edm.DateTimeOffset" },
      { name: "OverallResult", type: "Edm.String" },
      { name: "WorkflowStatus", type: "Edm.String" },
      { name: "VehicleRegistration", type: "Edm.String" },
      { name: "InspectorName", type: "Edm.String" },
      { name: "TransporterName", type: "Edm.String" },
      { name: "StationName", type: "Edm.String" },
    ],
  },
  {
    setName: "PreTripInspections",
    typeName: "PreTripInspection",
    keys: ["id"],
    properties: [
      { name: "id", type: "Edm.String", nullable: false },
      { name: "InspectionDate", type: "Edm.Date" },
      { name: "Status", type: "Edm.String" },
      { name: "ClearedForTrip", type: "Edm.Boolean" },
      { name: "VehicleRegistration", type: "Edm.String" },
      { name: "DriverName", type: "Edm.String" },
      { name: "PassedItems", type: "Edm.Int32" },
      { name: "FailedItems", type: "Edm.Int32" },
      { name: "TransporterName", type: "Edm.String" },
    ],
  },
  {
    setName: "Vehicles",
    typeName: "Vehicle",
    keys: ["id"],
    properties: [
      { name: "id", type: "Edm.String", nullable: false },
      { name: "RegistrationNumber", type: "Edm.String" },
      { name: "Make", type: "Edm.String" },
      { name: "Model", type: "Edm.String" },
      { name: "Status", type: "Edm.String" },
      { name: "Category", type: "Edm.String" },
      { name: "TransporterName", type: "Edm.String" },
      { name: "InsuranceExpiry", type: "Edm.Date" },
      { name: "RoadworthyExpiry", type: "Edm.Date" },
      { name: "TotalInspections", type: "Edm.Int32" },
    ],
  },
  {
    setName: "Transporters",
    typeName: "Transporter",
    keys: ["id"],
    properties: [
      { name: "id", type: "Edm.String", nullable: false },
      { name: "CompanyName", type: "Edm.String" },
      { name: "Region", type: "Edm.String" },
      { name: "District", type: "Edm.String" },
      { name: "FleetSize", type: "Edm.Int32" },
      { name: "PassCount", type: "Edm.Int32" },
      { name: "FailCount", type: "Edm.Int32" },
    ],
  },
  {
    setName: "Stations",
    typeName: "Station",
    keys: ["id"],
    properties: [
      { name: "id", type: "Edm.String", nullable: false },
      { name: "Name", type: "Edm.String" },
      { name: "Code", type: "Edm.String" },
      { name: "Region", type: "Edm.String" },
      { name: "Capacity", type: "Edm.Int32" },
      { name: "InspectionCount", type: "Edm.Int32" },
      { name: "PassCount", type: "Edm.Int32" },
      { name: "FailCount", type: "Edm.Int32" },
    ],
  },
  {
    setName: "Defects",
    typeName: "Defect",
    keys: ["InspectionNumber", "SectionCode", "ItemName"],
    properties: [
      { name: "InspectionNumber", type: "Edm.String", nullable: false },
      { name: "InspectionDate", type: "Edm.DateTimeOffset" },
      { name: "VehicleRegistration", type: "Edm.String" },
      { name: "SectionCode", type: "Edm.String", nullable: false },
      { name: "ItemName", type: "Edm.String", nullable: false },
      { name: "Severity", type: "Edm.String" },
      { name: "PhotoCount", type: "Edm.Int32" },
    ],
  },
  {
    setName: "Documents",
    typeName: "Document",
    keys: ["id"],
    permission: "documents",
    properties: [
      { name: "id", type: "Edm.String", nullable: false },
      { name: "Name", type: "Edm.String" },
      { name: "Type", type: "Edm.String" },
      { name: "OwnerType", type: "Edm.String" },
      { name: "ExpiryDate", type: "Edm.Date" },
      { name: "Version", type: "Edm.Int32" },
      { name: "UploadedBy", type: "Edm.String" },
    ],
  },
  {
    setName: "AuditLogs",
    typeName: "AuditLog",
    keys: ["id"],
    permission: "audit",
    properties: [
      { name: "id", type: "Edm.String", nullable: false },
      { name: "Action", type: "Edm.String" },
      { name: "EntityType", type: "Edm.String" },
      { name: "UserName", type: "Edm.String" },
      { name: "Summary", type: "Edm.String" },
      { name: "IPAddress", type: "Edm.String" },
      { name: "CreatedAt", type: "Edm.DateTimeOffset" },
    ],
  },
  {
    setName: "Users",
    typeName: "User",
    keys: ["id"],
    permission: "users",
    properties: [
      { name: "id", type: "Edm.String", nullable: false },
      { name: "Name", type: "Edm.String" },
      { name: "Email", type: "Edm.String" },
      { name: "Role", type: "Edm.String" },
      { name: "IsActive", type: "Edm.Boolean" },
      { name: "LastLoginAt", type: "Edm.DateTimeOffset" },
      { name: "StationName", type: "Edm.String" },
    ],
  },
];

export async function GET() {
  const auth = await authenticateApiRequest({ scopes: ["read"], permission: "reports" });
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: auth.message }), {
      status: auth.status,
      headers: { "Content-Type": "application/json", "Cache-Control": "private, no-store" },
    });
  }

  const entities = ENTITIES.filter((entity) => !entity.permission || hasPermission(auth.user, entity.permission));
  const entityTypes = entities.map(renderEntityType).join("\n");
  const entitySets = entities
    .map((entity) => `        <EntitySet Name="${entity.setName}" EntityType="RSL.VIMS.${entity.typeName}"/>`)
    .join("\n");

  const edmx = `<?xml version="1.0" encoding="utf-8"?>
<edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx">
  <edmx:DataServices>
    <Schema Namespace="RSL.VIMS" xmlns="http://docs.oasis-open.org/odata/ns/edm">
${entityTypes}
      <EntityContainer Name="VIMSContainer">
${entitySets}
      </EntityContainer>
    </Schema>
  </edmx:DataServices>
</edmx:Edmx>`;

  return new Response(edmx, {
    headers: {
      "Content-Type": "application/xml;charset=utf-8",
      "OData-Version": "4.0",
      "Cache-Control": "private, no-store",
    },
  });
}

function renderEntityType(entity: EntityDefinition): string {
  const keys = entity.keys.map((key) => `<PropertyRef Name="${key}"/>`).join("");
  const properties = entity.properties
    .map((property) => `        <Property Name="${property.name}" Type="${property.type}"${property.nullable === false ? ' Nullable="false"' : ""}/>`)
    .join("\n");

  return `      <EntityType Name="${entity.typeName}">
        <Key>${keys}</Key>
${properties}
      </EntityType>`;
}
