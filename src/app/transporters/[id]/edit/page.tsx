import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PageHeader, Card, Button, Field, TextInput, TextArea, Select } from "@/components/ui";
import { getTransporterDetail, updateTransporter, deleteTransporter, createTransporter } from "../../server";
import { canEditTransporters, getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function TransporterFormPage({ params }: { params: Promise<{ id?: string }> }) {
  const user = await getCurrentUser();
  if (!canEditTransporters(user)) {
    return (
      <div className="p-10"><Card className="p-8"><p className="text-slate-700">You do not have permission to manage transporters.</p></Card></div>
    );
  }
  const { id } = await params;
  const editing = !!id;
  let existing = null;
  if (editing) {
    const detail = await getTransporterDetail(id!);
    if (!detail) notFound();
    existing = detail.transporter;
  }

  async function submitAction(formData: FormData) {
    "use server";
    const data = {
      companyName: String(formData.get("companyName") || ""),
      registrationNumber: String(formData.get("registrationNumber") || ""),
      tinNumber: String(formData.get("tinNumber") || ""),
      gpsAddress: String(formData.get("gpsAddress") || ""),
      contactPerson: String(formData.get("contactPerson") || ""),
      mobile: String(formData.get("mobile") || ""),
      email: String(formData.get("email") || ""),
      physicalAddress: String(formData.get("physicalAddress") || ""),
      region: String(formData.get("region") || ""),
      district: String(formData.get("district") || ""),
      insuranceCompany: String(formData.get("insuranceCompany") || ""),
      insuranceExpiry: String(formData.get("insuranceExpiry") || ""),
    };
    if (editing) {
      await updateTransporter(id!, data);
      redirect(`/transporters/${id}`);
    } else {
      const res = await createTransporter(data);
      redirect(`/transporters/${res.id}`);
    }
  }

  async function deleteAction() {
    "use server";
    if (editing) {
      await deleteTransporter(id!);
      redirect("/transporters");
    }
  }

  return (
    <div className="p-6 lg:p-10">
      <Link href={editing ? `/transporters/${id}` : "/transporters"} className="inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 mb-4">
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      <PageHeader
        eyebrow={editing ? "Edit Transporter" : "New Transporter"}
        title={editing ? existing!.companyName : "Register New Transporter"}
        description="Company profile, contact details and fleet insurance information."
      />

      <form action={submitAction}>
        <Card className="p-6 space-y-6">
          <section>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-3">Company Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Company Name" required><TextInput name="companyName" required defaultValue={existing?.companyName || ""} /></Field>
              <Field label="Registration Number"><TextInput name="registrationNumber" defaultValue={existing?.registrationNumber || ""} /></Field>
              <Field label="TIN Number"><TextInput name="tinNumber" defaultValue={existing?.tinNumber || ""} /></Field>
              <Field label="GPS Digital Address"><TextInput name="gpsAddress" placeholder="e.g. GA-123-4567" defaultValue={existing?.gpsAddress || ""} /></Field>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-3">Contact</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Contact Person"><TextInput name="contactPerson" defaultValue={existing?.contactPerson || ""} /></Field>
              <Field label="Mobile Number"><TextInput name="mobile" defaultValue={existing?.mobile || ""} /></Field>
              <Field label="Email"><TextInput name="email" type="email" defaultValue={existing?.email || ""} /></Field>
              <Field label="Region">
                <Select name="region" defaultValue={existing?.region || ""}>
                  <option value="">Select region</option>
                  {["Greater Accra","Ashanti","Western","Eastern","Central","Northern","Volta","Bono","Upper East","Upper West"].map((r) => <option key={r} value={r}>{r}</option>)}
                </Select>
              </Field>
              <div className="md:col-span-2"><Field label="Physical Address"><TextArea name="physicalAddress" rows={2} defaultValue={existing?.physicalAddress || ""} /></Field></div>
              <Field label="District"><TextInput name="district" defaultValue={existing?.district || ""} /></Field>
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-3">Insurance</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Insurance Company"><TextInput name="insuranceCompany" defaultValue={existing?.insuranceCompany || ""} /></Field>
              <Field label="Insurance Expiry"><TextInput name="insuranceExpiry" type="date" defaultValue={existing?.insuranceExpiry || ""} /></Field>
            </div>
          </section>

          <div className="flex items-center gap-3 pt-4 border-t border-slate-200">
            <Button type="submit">{editing ? "Save Changes" : "Create Transporter"}</Button>
            <Link href={editing ? `/transporters/${id}` : "/transporters"}><Button variant="secondary" type="button">Cancel</Button></Link>
            {editing && <Button variant="danger" formAction={deleteAction} type="submit" className="ml-auto">Delete Transporter</Button>}
          </div>
        </Card>
      </form>
    </div>
  );
}
