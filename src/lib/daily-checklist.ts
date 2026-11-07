// VIMS Daily Pre-Trip & Pre-Loading Inspection Standard.
// Reference: supplied "PRE-LOADING INSPECTION CHECKLIST" (sections A–J).
// Measurements stated for bulk/tanker checks are client checklist criteria,
// not a declaration of nationwide statutory limits.

import type { DailyChecklistCategory, DailyInspectionVehicleType } from "@/db/schema";

type Item = { name: string; optional?: boolean };
const section = (category: string, icon: string, items: Item[]): DailyChecklistCategory => ({
  category, icon, items: items.map((item) => ({ ...item, result: "unchecked" as const })),
});
const required = (name: string): Item => ({ name });
const whereFitted = (name: string): Item => ({ name, optional: true });

// Base checklist: applies to ordinary road vehicles, trucks and trailers.
const BASE_SECTIONS: { category: string; icon: string; items: Item[] }[] = [
  { category: "B. Driver & Vehicle Documentation", icon: "document", items: [
    required("Driver's licence / permit valid for the vehicle class (A–F where applicable)"),
    required("Vehicle registration and chassis/VIN identification agree with documents"),
    required("Insurance certificate valid and applicable vehicle tax/permit current"),
    required("Roadworthiness certificate and required periodic/bi-annual inspection current"),
    whereFitted("Transporter/operator licence or special goods permit is valid where required"),
  ]},
  { category: "C. General / Physical Condition", icon: "vehicle", items: [
    required("Engine starts normally with key; no visible lubricant, fuel or hydraulic leaks"),
    required("Windscreen clear of defects affecting driver vision; assess against adopted fleet/client criteria (reference: crack 100 mm, bullseye 20 mm, star 30 mm, crater 5 mm, horseshoe 25 mm)"),
    required("Wiper blades and washer jets work; no torn or cracked blades"),
    required("Rear- and side-view mirrors present, intact, secure and adjustable"),
    required("Cabin handles and handholds firmly attached with no sharp edges"),
    required("Cabin and cargo/container interior clean; no exposed sharp edges or unsecured objects"),
    required("Driver seat adjustable, firmly secured and safe"),
    required("All occupied seats and three-point seat belts secure and functional where fitted"),
    required("Steering, doors, dashboard warnings and required gauges operate correctly"),
    required("Body panels, number plates, exhaust and ancillary fittings secured and undamaged"),
  ]},
  { category: "D. Electricals", icon: "light", items: [
    whereFitted("Battery master/isolation switch present, accessible and functional where required"),
    required("Battery secured; wiring/cables insulated with no bare conductors or loose contacts"),
    required("Headlamps, rear lamps, brake lamps, indicators, hazard lamps and number-plate light secure, clean and functional"),
    required("Mandatory lamp lenses/reflectors clean and intact; check applicable reflective-coating policy (reference: at least 70%)"),
    required("Horn works and reverse alarm operates where fitted"),
    whereFitted("Reverse light and side marker lights work where required"),
  ]},
  { category: "E. Fire Hazard & Emergency Controls", icon: "emergency", items: [
    required("Fire extinguishers appropriate for vehicle/load, securely mounted, accessible and serviceable"),
    required("Extinguisher inspection/service validity current; seals, hose, trigger, vessel and pressure indicator undamaged"),
    required("First-aid kit stocked and accessible"),
    required("Warning triangles and emergency roadside equipment available and serviceable"),
    whereFitted("Reflective high-visibility vest and emergency equipment accessible where required"),
  ]},
  { category: "F. Wheels / Tyres", icon: "tire", items: [
    required("No missing or loose wheel nuts, bolts or studs"),
    required("Tyre inflation and tread condition comply with applicable vehicle/client standard"),
    required("Steering-axle tyres free from prohibited retreads or tube tyres where client restrictions apply"),
    required("Tyre sidewalls free from deep cuts, bulges, exposed cords and damage (reference bulk criterion: 25 mm continuous / 5 mm deep)"),
    required("Rims undamaged: no cracks, unsafe welds or excessive corrosion"),
    whereFitted("Spare wheel meets applicable condition/tread limits and tools/jack are secure"),
  ]},
  { category: "G. Brakes", icon: "brake", items: [
    required("Service braking and parking brakes operational; brake action synchronized without pulling"),
    required("Brake hoses, pipes and couplings secure; no visible damage, leakage or chafing"),
    required("Brake warning indicators and brake fluid/air pressure within safe operating range"),
    whereFitted("Air brake pressure builds normally and no air leaks heard where equipped"),
  ]},
  { category: "General Mechanical & Fluids", icon: "fluid", items: [
    required("Engine oil, coolant, brake fluid and other relevant operating fluids at safe levels"),
    required("No fluid leaks under vehicle or around reservoirs, lines and wheel ends"),
    required("Suspension, steering linkages, underbody and exhaust secure and free of obvious hazards"),
    whereFitted("Power steering fluid and windscreen washer reservoir sufficient where fitted"),
  ]},
  { category: "Trip & Loading Readiness", icon: "safety", items: [
    required("Vehicle walk-around complete; no damage or unsecured external objects"),
    required("Load distribution, restraint and vehicle weight suitable for intended journey"),
    required("Destination/route, required permits and safe departure conditions confirmed"),
  ]},
];

const PRELOADING_COMMON: { category: string; icon: string; items: Item[] }[] = [
  { category: "Pre-Loading: Additional Fire & Bonding Controls", icon: "emergency", items: [
    whereFitted("Hot surfaces and exhaust shielded against accidental fuel leakage or spillage where carrying flammables"),
    whereFitted("Electrical bonding/earthing cable continuous, without joints or loose contacts where required for hazardous loading"),
  ]},
  { category: "H. Tractor–Trailer Coupling", icon: "vehicle", items: [
    required("Fifth-wheel/turntable coupling and safety lock positively engaged, secured and functional"),
    required("Trailer service/parking brakes and electrical/air connections connected and working"),
  ]},
  { category: "I. Bulk / Container / Flat Trailer", icon: "vehicle", items: [
    required("Handrails and steps firmly secured with anti-slip surfaces"),
    required("Walkway and compartment covers anti-slip, intact, securely fastened and without visible tray/bulk leakage"),
    required("Storage locker securely holds jack, tools, accessories and portable containers"),
    whereFitted("Container twist locks secure and functional where fitted"),
    required("Underrun guards present, secure and compatible with adopted fleet/client dimensional checks (reference: ≤300 mm between vertical members and lowest member ≤400 mm from ground)"),
    required("Front/side/rear warning reflectors and side lights fitted, visible and functional"),
  ]},
  { category: "J. Other Accessories", icon: "emergency", items: [
    required("T-bar, two suitable wheel stoppers/chocks and two warning triangles present and serviceable"),
  ]},
];

const BULK_TANKER_ONLY: { category: string; icon: string; items: Item[] }[] = [
  { category: "Bulk Tanker Calibration & Containment", icon: "document", items: [
    required("One appropriate 2 kg extinguisher in cabin and two appropriate 9 kg extinguishers outside, reachable without obstruction (reference bulk tanker pre-loading specification)"),
    required("All exterior extinguishers have valid service certification and no visible seal, hose, trigger or vessel damage"),
    required("Electrical bonding/earthing cable continuous, intact, without joints or loose contacts"),
    required("Hot surfaces and exhaust protected from potential fuel spillage or leakage"),
    required("Bulk identification matches tanker and loading documentation"),
    required("Bulk calibration certificate valid, capacity verified and expiry not passed"),
    required("Tanker compartment lids/manholes, seals, valves and outlets sound and secured"),
    required("Discharge hose(s) show no tears, cracks or damage causing leakage and use correct intact couplings"),
    required("Tyres including spare have minimum 4 mm tread under supplied tanker checklist specification"),
  ]},
];

export const DAILY_CHECKLIST: DailyChecklistCategory[] =
  BASE_SECTIONS.map(({ category, icon, items }) => section(category, icon, items));

export function buildDefaultDailyChecklist(
  vehicleType: DailyInspectionVehicleType = "general",
): DailyChecklistCategory[] {
  const specs = [...BASE_SECTIONS];
  if (vehicleType !== "general") {
    specs.push(...PRELOADING_COMMON);
    if (vehicleType === "bulk_tanker") specs.push(...BULK_TANKER_ONLY);
  }
  return specs.map(({ category, icon, items }) => section(category, icon, items));
}

export function summarizeDailyChecklist(checklist: DailyChecklistCategory[]) {
  let total = 0, passed = 0, failed = 0, na = 0, unchecked = 0;
  for (const category of checklist) {
    for (const item of category.items) {
      total++;
      if (item.result === "pass") passed++;
      else if (item.result === "fail") failed++;
      else if (item.result === "na") na++;
      else unchecked++;
    }
  }
  const applicable = total - na;
  return {
    total, passed, failed, na, unchecked,
    passRate: applicable > 0 ? Math.round((passed / applicable) * 100) : 0,
  };
}

export function validateCompletedDailyChecklist(
  checklist: DailyChecklistCategory[],
  vehicleType: DailyInspectionVehicleType,
) {
  const expected = buildDefaultDailyChecklist(vehicleType);
  if (!Array.isArray(checklist) || checklist.length !== expected.length) {
    throw new Error("The inspection checklist is missing required sections.");
  }
  let count = 0;
  for (let i = 0; i < expected.length; i++) {
    const actual = checklist[i];
    const template = expected[i];
    if (actual?.category !== template.category || !Array.isArray(actual.items) || actual.items.length !== template.items.length) {
      throw new Error("A required inspection section is missing or altered.");
    }
    for (let j = 0; j < template.items.length; j++) {
      const expectedItem = template.items[j], answer = actual.items[j];
      if (!answer || answer.name !== expectedItem.name) {
        throw new Error("The inspection checklist has missing or modified checks.");
      }
      if (!["pass", "fail", "na"].includes(answer.result)) {
        throw new Error("Record Pass, Fail or N/A for every checklist item before submitting.");
      }
      if (answer.notes && answer.notes.length > 1000) throw new Error("Checklist notes must not exceed 1,000 characters.");
      if (answer.result === "na" && (!expectedItem.optional || !answer.notes?.trim())) {
        throw new Error("N/A is allowed only for optional equipment and requires an explanation.");
      }
      if (answer.result === "fail" && !answer.notes?.trim()) {
        throw new Error("Describe each failed item before submitting the inspection.");
      }
      count++;
    }
  }
  return count;
}
