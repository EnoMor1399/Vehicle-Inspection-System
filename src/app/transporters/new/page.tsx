import TransporterFormPage from "../[id]/edit/page";

export const dynamic = "force-dynamic";

export default function NewTransporterPage() {
  return <TransporterFormPage params={Promise.resolve({})} />;
}
