// Defines the 16 inspection sections (A-P) used across the system.
// Each section has a list of default checklist items. Results are stored
// in the `inspections.section_data` JSONB column.

export type SectionDef = {
  code: string;
  title: string;
  items: string[];
};

export const INSPECTION_SECTIONS: SectionDef[] = [
  {
    code: "B",
    title: "Documentation",
    items: [
      "Registration Certificate",
      "Insurance Certificate",
      "Roadworthy Certificate",
      "Road Fund",
      "Fire Extinguisher Expiry",
      "Reflective Triangle",
      "First Aid Box",
      "Vehicle Permit",
      "Transport License",
    ],
  },
  {
    code: "C",
    title: "Exterior Inspection",
    items: [
      "Body Condition",
      "Rust",
      "Doors",
      "Door Locks",
      "Bonnet",
      "Boot",
      "Windscreen",
      "Windows",
      "Side Mirrors",
      "Rear View Mirror",
      "Number Plates",
      "Mudguards",
      "Bumpers",
      "Fuel Tank",
      "Tow Hitch",
      "Exhaust Pipe",
    ],
  },
  {
    code: "D",
    title: "Tire Inspection",
    items: [
      "Front Left Tread Depth",
      "Front Left Inflation",
      "Front Left Sidewall",
      "Front Right Tread Depth",
      "Front Right Inflation",
      "Front Right Sidewall",
      "Rear Left Tread Depth",
      "Rear Left Inflation",
      "Rear Left Sidewall",
      "Rear Right Tread Depth",
      "Rear Right Inflation",
      "Rear Right Sidewall",
      "Spare Tire",
      "Wheel Nuts",
      "Wheel Bearings",
      "Wheel Alignment",
    ],
  },
  {
    code: "E",
    title: "Brake Inspection",
    items: [
      "Brake Pedal",
      "Parking Brake",
      "Brake Pads",
      "Brake Shoes",
      "Brake Disc",
      "Brake Drum",
      "Brake Lines",
      "Brake Hoses",
      "Brake Fluid",
      "ABS Warning",
      "Service Brake Efficiency",
      "Parking Brake Efficiency",
    ],
  },
  {
    code: "F",
    title: "Steering and Suspension",
    items: [
      "Steering Wheel Free Play",
      "Steering Rack",
      "Power Steering",
      "Shock Absorbers",
      "Springs",
      "Ball Joints",
      "Bushings",
      "Tie Rod Ends",
      "Wheel Alignment",
    ],
  },
  {
    code: "G",
    title: "Engine Inspection",
    items: [
      "Engine Mount",
      "Engine Oil",
      "Oil Leakage",
      "Coolant",
      "Belts",
      "Battery",
      "Alternator",
      "Starter Motor",
      "Air Filter",
      "Fuel Filter",
      "Turbo",
      "Radiator",
      "Hoses",
    ],
  },
  {
    code: "H",
    title: "Transmission",
    items: [
      "Gearbox",
      "Clutch",
      "Differential",
      "Drive Shaft",
      "Universal Joint",
      "CV Joint",
    ],
  },
  {
    code: "I",
    title: "Electrical System",
    items: [
      "Battery",
      "Horn",
      "Starter",
      "Alternator",
      "Wiring",
      "Dashboard Warning Lights",
      "Reverse Alarm",
    ],
  },
  {
    code: "J",
    title: "Lighting",
    items: [
      "Headlights",
      "High Beam",
      "Low Beam",
      "Fog Lights",
      "Tail Lights",
      "Brake Lights",
      "Number Plate Light",
      "Reverse Light",
      "Indicators",
      "Hazard Lights",
      "Reflectors",
    ],
  },
  {
    code: "K",
    title: "Visibility",
    items: [
      "Windscreen",
      "Windscreen Wipers",
      "Washer Pump",
      "Mirrors",
      "Defogger",
    ],
  },
  {
    code: "L",
    title: "Interior Inspection",
    items: [
      "Driver Seat",
      "Passenger Seats",
      "Seat Belts",
      "Dashboard",
      "Speedometer",
      "Odometer",
      "Gauges",
      "Air Conditioning",
      "Heater",
      "Floor Condition",
      "Emergency Exit",
    ],
  },
  {
    code: "M",
    title: "Safety Equipment",
    items: [
      "Fire Extinguisher",
      "First Aid Kit",
      "Wheel Chocks",
      "Reflective Triangle",
      "Reflective Tape",
      "Warning Sign",
      "Emergency Hammer",
      "Seat Belt Cutter",
      "Spill Kit",
    ],
  },
  {
    code: "N",
    title: "Underbody Inspection",
    items: [
      "Chassis Frame",
      "Cross Members",
      "Engine Mounts",
      "Gearbox Mounts",
      "Suspension Components",
      "Axles",
      "Differential",
      "Propeller Shaft",
      "Universal Joints",
      "Fuel Tank",
      "Fuel Lines",
      "Brake Lines",
      "Brake Hoses",
      "Air Brake Chambers",
      "Exhaust System",
      "Catalytic Converter",
      "Leaf Springs",
      "Shock Absorbers",
      "Wheel Bearings",
      "Steering Linkages",
      "Stabilizer Bar",
      "Rust and Corrosion",
      "Oil Leaks",
      "Coolant Leaks",
      "Hydraulic Leaks",
      "Structural Cracks",
    ],
  },
  {
    code: "O",
    title: "Emissions",
    items: ["Smoke Test", "Noise Level", "Exhaust Emission", "Opacity Test"],
  },
];

export function buildDefaultSectionData(): { section: string; title: string; items: { name: string; result: "pass" | "fail" | "na"; severity?: "minor" | "major" | "critical"; remarks?: string }[] }[] {
  return INSPECTION_SECTIONS.map((s) => ({
    section: s.code,
    title: s.title,
    items: s.items.map((name) => ({ name, result: "pass" as const })),
  }));
}

export function summarizeSection(section: {
  items: { name: string; result: "pass" | "fail" | "na"; severity?: "minor" | "major" | "critical"; remarks?: string }[];
}): { pass: number; fail: number; na: number; critical: number; major: number; minor: number } {
  let pass = 0,
    fail = 0,
    na = 0,
    critical = 0,
    major = 0,
    minor = 0;
  for (const it of section.items) {
    if (it.result === "pass") pass++;
    else if (it.result === "fail") fail++;
    else na++;
    if (it.result === "fail") {
      if (it.severity === "critical") critical++;
      else if (it.severity === "major") major++;
      else minor++;
    }
  }
  return { pass, fail, na, critical, major, minor };
}
