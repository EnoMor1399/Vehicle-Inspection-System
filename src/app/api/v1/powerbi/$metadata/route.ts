import { authenticateApiRequest } from "@/lib/api-auth";

// OData v4 $metadata endpoint — returns EDMX XML schema
// Power BI uses this to discover the data model

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://vims.rsl.gh";

export async function GET(request: Request) {
  const auth = await authenticateApiRequest({ scopes: ["read"], permission: "reports" });
  if (!auth.ok) {
    return new Response(JSON.stringify({ error: auth.message }), {
      status: auth.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  const edmx = `<?xml version="1.0" encoding="utf-8"?>
<edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx">
  <edmx:DataServices>
    <Schema Namespace="RSL.VIMS" xmlns="http://docs.oasis-open.org/odata/ns/edm">

      <EntityType Name="Inspection">
        <Key><PropertyRef Name="id"/></Key>
        <Property Name="id" Type="Edm.String" Nullable="false"/>
        <Property Name="InspectionNumber" Type="Edm.String"/>
        <Property Name="InspectionDate" Type="Edm.DateTimeOffset"/>
        <Property Name="OverallResult" Type="Edm.String"/>
        <Property Name="WorkflowStatus" Type="Edm.String"/>
        <Property Name="InspectorName" Type="Edm.String"/>
        <Property Name="Station" Type="Edm.String"/>
        <Property Name="ServiceBrakeEfficiency" Type="Edm.Decimal"/>
        <Property Name="ParkingBrakeEfficiency" Type="Edm.Decimal"/>
        <Property Name="SmokeTest" Type="Edm.String"/>
        <Property Name="OpacityTest" Type="Edm.Decimal"/>
        <Property Name="TotalPhotos" Type="Edm.Int32"/>
        <Property Name="TemplateType" Type="Edm.String"/>
        <Property Name="NextInspectionDate" Type="Edm.Date"/>
        <Property Name="ReinspectionDate" Type="Edm.Date"/>
        <Property Name="VehicleRegistration" Type="Edm.String"/>
        <Property Name="VehicleMake" Type="Edm.String"/>
        <Property Name="VehicleModel" Type="Edm.String"/>
        <Property Name="VehicleBodyType" Type="Edm.String"/>
        <Property Name="VehicleCategory" Type="Edm.String"/>
        <Property Name="VehicleYear" Type="Edm.Int32"/>
        <Property Name="VehicleFuelType" Type="Edm.String"/>
        <Property Name="TransporterName" Type="Edm.String"/>
        <Property Name="TransporterRegion" Type="Edm.String"/>
        <Property Name="StationName" Type="Edm.String"/>
        <Property Name="StationRegion" Type="Edm.String"/>
      </EntityType>

      <EntityType Name="Vehicle">
        <Key><PropertyRef Name="id"/></Key>
        <Property Name="id" Type="Edm.String" Nullable="false"/>
        <Property Name="RegistrationNumber" Type="Edm.String"/>
        <Property Name="Make" Type="Edm.String"/>
        <Property Name="Model" Type="Edm.String"/>
        <Property Name="BodyType" Type="Edm.String"/>
        <Property Name="Category" Type="Edm.String"/>
        <Property Name="VehicleClass" Type="Edm.String"/>
        <Property Name="Colour" Type="Edm.String"/>
        <Property Name="ManufacturingYear" Type="Edm.Int32"/>
        <Property Name="FuelType" Type="Edm.String"/>
        <Property Name="Transmission" Type="Edm.String"/>
        <Property Name="SeatingCapacity" Type="Edm.Int32"/>
        <Property Name="GrossWeight" Type="Edm.Decimal"/>
        <Property Name="NumberOfAxles" Type="Edm.Int32"/>
        <Property Name="OdometerReading" Type="Edm.Int32"/>
        <Property Name="Status" Type="Edm.String"/>
        <Property Name="InsuranceExpiry" Type="Edm.Date"/>
        <Property Name="RoadworthyExpiry" Type="Edm.Date"/>
        <Property Name="RoadFundExpiry" Type="Edm.Date"/>
        <Property Name="VIN" Type="Edm.String"/>
        <Property Name="ChassisNumber" Type="Edm.String"/>
        <Property Name="TransporterName" Type="Edm.String"/>
        <Property Name="TransporterRegion" Type="Edm.String"/>
        <Property Name="TotalInspections" Type="Edm.Int32"/>
        <Property Name="PassCount" Type="Edm.Int32"/>
        <Property Name="FailCount" Type="Edm.Int32"/>
      </EntityType>

      <EntityType Name="Transporter">
        <Key><PropertyRef Name="id"/></Key>
        <Property Name="id" Type="Edm.String" Nullable="false"/>
        <Property Name="CompanyName" Type="Edm.String"/>
        <Property Name="RegistrationNumber" Type="Edm.String"/>
        <Property Name="TIN" Type="Edm.String"/>
        <Property Name="Region" Type="Edm.String"/>
        <Property Name="District" Type="Edm.String"/>
        <Property Name="ContactPerson" Type="Edm.String"/>
        <Property Name="Mobile" Type="Edm.String"/>
        <Property Name="Email" Type="Edm.String"/>
        <Property Name="InsuranceCompany" Type="Edm.String"/>
        <Property Name="InsuranceExpiry" Type="Edm.Date"/>
        <Property Name="FleetSize" Type="Edm.Int32"/>
        <Property Name="PassCount" Type="Edm.Int32"/>
        <Property Name="FailCount" Type="Edm.Int32"/>
      </EntityType>

      <EntityType Name="Station">
        <Key><PropertyRef Name="id"/></Key>
        <Property Name="id" Type="Edm.String" Nullable="false"/>
        <Property Name="Name" Type="Edm.String"/>
        <Property Name="Code" Type="Edm.String"/>
        <Property Name="Region" Type="Edm.String"/>
        <Property Name="District" Type="Edm.String"/>
        <Property Name="Address" Type="Edm.String"/>
        <Property Name="Phone" Type="Edm.String"/>
        <Property Name="Email" Type="Edm.String"/>
        <Property Name="Capacity" Type="Edm.Int32"/>
        <Property Name="Status" Type="Edm.String"/>
        <Property Name="InspectorCount" Type="Edm.Int32"/>
        <Property Name="InspectionCount" Type="Edm.Int32"/>
        <Property Name="PassCount" Type="Edm.Int32"/>
        <Property Name="FailCount" Type="Edm.Int32"/>
      </EntityType>

      <EntityType Name="Defect">
        <Key><PropertyRef Name="InspectionNumber" PropertyRef2="ItemName"/></Key>
        <Property Name="InspectionNumber" Type="Edm.String"/>
        <Property Name="InspectionDate" Type="Edm.DateTimeOffset"/>
        <Property Name="InspectionResult" Type="Edm.String"/>
        <Property Name="VehicleRegistration" Type="Edm.String"/>
        <Property Name="VehicleMake" Type="Edm.String"/>
        <Property Name="VehicleModel" Type="Edm.String"/>
        <Property Name="SectionCode" Type="Edm.String"/>
        <Property Name="SectionTitle" Type="Edm.String"/>
        <Property Name="ItemName" Type="Edm.String"/>
        <Property Name="Result" Type="Edm.String"/>
        <Property Name="Severity" Type="Edm.String"/>
        <Property Name="Remarks" Type="Edm.String"/>
        <Property Name="PhotoCount" Type="Edm.Int32"/>
      </EntityType>

      <EntityType Name="Document">
        <Key><PropertyRef Name="id"/></Key>
        <Property Name="id" Type="Edm.String" Nullable="false"/>
        <Property Name="Name" Type="Edm.String"/>
        <Property Name="Type" Type="Edm.String"/>
        <Property Name="OwnerType" Type="Edm.String"/>
        <Property Name="OwnerId" Type="Edm.String"/>
        <Property Name="MimeType" Type="Edm.String"/>
        <Property Name="SizeBytes" Type="Edm.Int32"/>
        <Property Name="Version" Type="Edm.Int32"/>
        <Property Name="ExpiryDate" Type="Edm.Date"/>
        <Property Name="CreatedAt" Type="Edm.DateTimeOffset"/>
        <Property Name="UploadedBy" Type="Edm.String"/>
      </EntityType>

      <EntityType Name="AuditLog">
        <Key><PropertyRef Name="id"/></Key>
        <Property Name="id" Type="Edm.String" Nullable="false"/>
        <Property Name="Action" Type="Edm.String"/>
        <Property Name="EntityType" Type="Edm.String"/>
        <Property Name="EntityId" Type="Edm.String"/>
        <Property Name="EntityLabel" Type="Edm.String"/>
        <Property Name="Summary" Type="Edm.String"/>
        <Property Name="UserName" Type="Edm.String"/>
        <Property Name="IPAddress" Type="Edm.String"/>
        <Property Name="CreatedAt" Type="Edm.DateTimeOffset"/>
      </EntityType>

      <EntityType Name="User">
        <Key><PropertyRef Name="id"/></Key>
        <Property Name="id" Type="Edm.String" Nullable="false"/>
        <Property Name="Name" Type="Edm.String"/>
        <Property Name="Email" Type="Edm.String"/>
        <Property Name="Role" Type="Edm.String"/>
        <Property Name="IsActive" Type="Edm.Boolean"/>
        <Property Name="LastLoginAt" Type="Edm.DateTimeOffset"/>
        <Property Name="CreatedAt" Type="Edm.DateTimeOffset"/>
        <Property Name="StationName" Type="Edm.String"/>
      </EntityType>

      <EntityContainer Name="VIMSContainer">
        <EntitySet Name="Inspections" EntityType="RSL.VIMS.Inspection"/>
        <EntitySet Name="Vehicles" EntityType="RSL.VIMS.Vehicle"/>
        <EntitySet Name="Transporters" EntityType="RSL.VIMS.Transporter"/>
        <EntitySet Name="Stations" EntityType="RSL.VIMS.Station"/>
        <EntitySet Name="Defects" EntityType="RSL.VIMS.Defect"/>
        <EntitySet Name="Documents" EntityType="RSL.VIMS.Document"/>
        <EntitySet Name="AuditLogs" EntityType="RSL.VIMS.AuditLog"/>
        <EntitySet Name="Users" EntityType="RSL.VIMS.User"/>
      </EntityContainer>

    </Schema>
  </edmx:DataServices>
</edmx:Edmx>`;

  return new Response(edmx, {
    headers: {
      "Content-Type": "application/xml;charset=utf-8",
      "OData-Version": "4.0",
    },
  });
}
