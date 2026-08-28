import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader, Card, Button, Field, TextInput, Select } from "@/components/ui";
import { getVehicleDetail, updateVehicle, decommissionVehicle, createVehicle, VehicleFormData } from "../../server";
import { canEditVehicles, getCurrentUser } from "@/lib/auth";
import { db } from "@/db";
import { transporters } from "@/db/schema";
import { isNull, asc } from "drizzle-orm";

export const dynamic = "force-dynamic";

function toForm(v: VehicleFormData): FormData {
  const fd = new FormData();
  Object.entries(v).forEach(([k, val]) => {
    if (val !== undefined && val !== null) fd.append(k, String(val));
  });
  return fd;
}

function parseForm(fd: FormData): VehicleFormData {
  const get = (k: string) => {
    const v = fd.get(k);
    return v === null ? "" : String(v);
  };
  return {
    transporterId: get("transporterId") || null,
    registrationNumber: get("registrationNumber"),
    oldRegistrationNumber: get("oldRegistrationNumber"),
    make: get("make"),
    model: get("model"),
    variant: get("variant"),
    bodyType: get("bodyType"),
    category: get("category"),
    vehicleClass: get("vehicleClass"),
    colour: get("colour"),
    manufacturingYear: get("manufacturingYear"),
    countryOfManufacture: get("countryOfManufacture"),
    engineNumber: get("engineNumber"),
    chassisNumber: get("chassisNumber"),
    vin: get("vin"),
    fuelType: get("fuelType") as any,
    transmission: get("transmission") as any,
    engineCapacity: get("engineCapacity"),
    seatingCapacity: get("seatingCapacity"),
    grossWeight: get("grossWeight"),
    netWeight: get("netWeight"),
    numberOfAxles: get("numberOfAxles"),
    odometerReading: get("odometerReading"),
    ownerName: get("ownerName"),
    ownerContact: get("ownerContact"),
    insuranceCompany: get("insuranceCompany"),
    policyNumber: get("policyNumber"),
    insuranceExpiry: get("insuranceExpiry"),
    roadworthyExpiry: get("roadworthyExpiry"),
    roadFundExpiry: get("roadFundExpiry"),
    status: get("status") as any,
  };
}

export default async function VehicleFormPage({ params }: { params: Promise<{ id?: string }> }) {
  const user = await getCurrentUser();
  if (!canEditVehicles(user)) {
    return <div className="p-10"><Card className="p-8"><p className="text-slate-700">You do not have permission to manage vehicles.</p></Card></div>;
  }

  const { id } = await params;
  const editing = !!id;
  let existing = null;
  if (editing) {
    const d = await getVehicleDetail(id!);
    if (!d) notFound();
    existing = d.vehicle;
  }

  const transporterList = await db
    .select({ id: transporters.id, companyName: transporters.companyName })
    .from(transporters)
    .where(isNull(transporters.deletedAt))
    .orderBy(asc(transporters.companyName));

  async function submitAction(formData: FormData) {
    "use server";
    const data = parseForm(formData);
    if (editing) {
      await updateVehicle(id!, data);
      redirect(`/vehicles/${id}`);
    } else {
      const res = await createVehicle(data);
      redirect(`/vehicles/${res.id}`);
    }
  }

  async function decommissionAction() {
    "use server";
    if (editing) {
      await decommissionVehicle(id!);
      redirect("/vehicles");
    }
  }

  const v = existing;

  return (
    <div className="p-6 lg:p-10">
      <Link href={editing ? `/vehicles/${id}` : "/vehicles"} className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 mb-4">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      <PageHeader
        eyebrow={editing ? "Edit Vehicle" : "New Vehicle"}
        title={editing ? `${v!.make} ${v!.model || ""} — ${v!.registrationNumber}` : "Register New Vehicle"}
        description="Capture full vehicle details including ownership, documents and compliance dates."
      />

      <form action={submitAction}>
        <Card className="p-6 space-y-6">
          <Section title="Basic Details">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Registration Number" required><TextInput name="registrationNumber" required defaultValue={v?.registrationNumber} /></Field>
              <Field label="Old Registration"><TextInput name="oldRegistrationNumber" defaultValue={v?.oldRegistrationNumber || ""} /></Field>
              <Field label="Transporter">
                <Select name="transporterId" defaultValue={v?.transporterId || ""}>
                  <option value="">Unassigned</option>
                  {transporterList.map((t) => <option key={t.id} value={t.id}>{t.companyName}</option>)}
                </Select>
              </Field>
              <Field label="Make" required><TextInput name="make" required defaultValue={v?.make} /></Field>
              <Field label="Model"><TextInput name="model" defaultValue={v?.model || ""} /></Field>
              <Field label="Variant"><TextInput name="variant" defaultValue={v?.variant || ""} /></Field>
              <Field label="Body Type">
                <Select name="bodyType" defaultValue={v?.bodyType || ""}>
                  <option value="">Select</option>
                  {["Bus","Minibus","Truck","Tractor","Tanker","Trailer","Saloon","SUV","Pickup","Van"].map((b) => <option key={b} value={b}>{b}</option>)}
                </Select>
              </Field>
              <Field label="Category">
                <Select name="category" defaultValue={v?.category || ""}>
                  <option value="">Select</option>
                  {["Passenger","Freight","Hazardous","Private","Commercial"].map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              </Field>
              <Field label="Class">
                <Select name="vehicleClass" defaultValue={v?.vehicleClass || ""}>
                  <option value="">Select</option>
                  {["Light","Medium","Heavy"].map((c) => <option key={c} value={c}>{c}</option>)}
                </Select>
              </Field>
              <Field label="Colour"><TextInput name="colour" defaultValue={v?.colour || ""} /></Field>
              <Field label="Manufacturing Year"><TextInput name="manufacturingYear" type="number" defaultValue={v?.manufacturingYear?.toString() || ""} /></Field>
              <Field label="Country of Manufacture"><TextInput name="countryOfManufacture" defaultValue={v?.countryOfManufacture || ""} /></Field>
              <Field label="Status">
                <Select name="status" defaultValue={v?.status || "active"}>
                  <option value="active">Active</option>
                  <option value="under_inspection">Under Inspection</option>
                  <option value="passed">Passed Inspection</option>
                  <option value="failed">Failed Inspection</option>
                  <option value="suspended">Suspended</option>
                  <option value="decommissioned">Decommissioned</option>
                </Select>
              </Field>
            </div>
          </Section>

          <Section title="Technical Specifications">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Engine Number"><TextInput name="engineNumber" defaultValue={v?.engineNumber || ""} /></Field>
              <Field label="Chassis Number"><TextInput name="chassisNumber" defaultValue={v?.chassisNumber || ""} /></Field>
              <Field label="VIN"><TextInput name="vin" defaultValue={v?.vin || ""} /></Field>
              <Field label="Fuel Type">
                <Select name="fuelType" defaultValue={v?.fuelType || ""}>
                  <option value="">Select</option>
                  <option value="petrol">Petrol</option>
                  <option value="diesel">Diesel</option>
                  <option value="electric">Electric</option>
                  <option value="hybrid">Hybrid</option>
                  <option value="cng">CNG</option>
                  <option value="lpg">LPG</option>
                </Select>
              </Field>
              <Field label="Transmission">
                <Select name="transmission" defaultValue={v?.transmission || ""}>
                  <option value="">Select</option>
                  <option value="manual">Manual</option>
                  <option value="automatic">Automatic</option>
                  <option value="cvt">CVT</option>
                  <option value="semi-automatic">Semi-Automatic</option>
                </Select>
              </Field>
              <Field label="Engine Capacity (cc)"><TextInput name="engineCapacity" type="number" defaultValue={v?.engineCapacity?.toString() || ""} /></Field>
              <Field label="Seating Capacity"><TextInput name="seatingCapacity" type="number" defaultValue={v?.seatingCapacity?.toString() || ""} /></Field>
              <Field label="Gross Weight (kg)"><TextInput name="grossWeight" defaultValue={v?.grossWeight || ""} /></Field>
              <Field label="Net Weight (kg)"><TextInput name="netWeight" defaultValue={v?.netWeight || ""} /></Field>
              <Field label="Number of Axles"><TextInput name="numberOfAxles" type="number" defaultValue={v?.numberOfAxles?.toString() || ""} /></Field>
              <Field label="Odometer Reading (km)"><TextInput name="odometerReading" type="number" defaultValue={v?.odometerReading?.toString() || ""} /></Field>
            </div>
          </Section>

          <Section title="Ownership & Insurance">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Owner Name"><TextInput name="ownerName" defaultValue={v?.ownerName || ""} /></Field>
              <Field label="Owner Contact"><TextInput name="ownerContact" defaultValue={v?.ownerContact || ""} /></Field>
              <Field label="Insurance Company"><TextInput name="insuranceCompany" defaultValue={v?.insuranceCompany || ""} /></Field>
              <Field label="Policy Number"><TextInput name="policyNumber" defaultValue={v?.policyNumber || ""} /></Field>
              <Field label="Insurance Expiry"><TextInput name="insuranceExpiry" type="date" defaultValue={v?.insuranceExpiry || ""} /></Field>
              <Field label="Roadworthy Expiry"><TextInput name="roadworthyExpiry" type="date" defaultValue={v?.roadworthyExpiry || ""} /></Field>
              <Field label="Road Fund Expiry"><TextInput name="roadFundExpiry" type="date" defaultValue={v?.roadFundExpiry || ""} /></Field>
            </div>
          </Section>

          <div className="flex items-center gap-3 pt-4 border-t border-slate-200">
            <Button type="submit">{editing ? "Save Changes" : "Create Vehicle"}</Button>
            <Link href={editing ? `/vehicles/${id}` : "/vehicles"}><Button variant="secondary" type="button">Cancel</Button></Link>
            {editing && <Button variant="danger" formAction={decommissionAction} type="submit" className="ml-auto">Decommission Vehicle</Button>}
          </div>
        </Card>
      </form>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-3">{title}</h3>
      {children}
    </section>
  );
}
