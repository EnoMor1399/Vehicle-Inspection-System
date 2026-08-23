import VehicleFormPage from "../[id]/edit/page";

export const dynamic = "force-dynamic";

export default function NewVehiclePage() {
  return <VehicleFormPage params={Promise.resolve({})} />;
}
