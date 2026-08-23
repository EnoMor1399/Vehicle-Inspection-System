// Daily Pre-Trip Inspection checklist
// Separate from bi-annual comprehensive inspection - focused on roadworthiness for the day's trip.

import type { DailyChecklistCategory } from "@/db/schema";

export const DAILY_CHECKLIST: DailyChecklistCategory[] = [
  {
    category: "Tires & Wheels",
    icon: "tire",
    items: [
      { name: "Front Left tire pressure & condition", result: "pass" },
      { name: "Front Right tire pressure & condition", result: "pass" },
      { name: "Rear Left tire pressure & condition", result: "pass" },
      { name: "Rear Right tire pressure & condition", result: "pass" },
      { name: "Tire tread depth (minimum 1.6mm)", result: "pass" },
      { name: "Spare tire condition & tools", result: "pass" },
      { name: "Wheel nuts tight & secure", result: "pass" },
    ],
  },
  {
    category: "Brakes",
    icon: "brake",
    items: [
      { name: "Brake pedal feel & travel", result: "pass" },
      { name: "Parking brake engages firmly", result: "pass" },
      { name: "Brake fluid level (between min/max)", result: "pass" },
      { name: "No unusual brake noise on test", result: "pass" },
      { name: "Air brake pressure builds normally (if equipped)", result: "na" },
    ],
  },
  {
    category: "Lights & Signals",
    icon: "light",
    items: [
      { name: "Headlights (low beam)", result: "pass" },
      { name: "Headlights (high beam)", result: "pass" },
      { name: "Tail lights", result: "pass" },
      { name: "Brake lights", result: "pass" },
      { name: "Left indicator", result: "pass" },
      { name: "Right indicator", result: "pass" },
      { name: "Hazard warning lights", result: "pass" },
      { name: "Reverse lights", result: "pass" },
      { name: "Number plate light", result: "pass" },
    ],
  },
  {
    category: "Fluid Levels",
    icon: "fluid",
    items: [
      { name: "Engine oil level (between min/max)", result: "pass" },
      { name: "Coolant level (between min/max)", result: "pass" },
      { name: "Power steering fluid", result: "pass" },
      { name: "Windshield washer fluid", result: "pass" },
      { name: "No visible fluid leaks under vehicle", result: "pass" },
    ],
  },
  {
    category: "Visibility",
    icon: "visibility",
    items: [
      { name: "Windshield clean, no cracks in wiper sweep", result: "pass" },
      { name: "All mirrors intact & properly adjusted", result: "pass" },
      { name: "Windshield wipers operational", result: "pass" },
      { name: "Washer jets spray correctly", result: "pass" },
    ],
  },
  {
    category: "Safety & Controls",
    icon: "safety",
    items: [
      { name: "Horn operational", result: "pass" },
      { name: "Steering responsive, no excessive play", result: "pass" },
      { name: "Seat belts functional (driver & passengers)", result: "pass" },
      { name: "Dashboard warning lights (none lit)", result: "pass" },
      { name: "Speedometer & gauges working", result: "pass" },
      { name: "Doors open & close securely", result: "pass" },
    ],
  },
  {
    category: "Emergency Equipment",
    icon: "emergency",
    items: [
      { name: "Fire extinguisher present, pressure gauge in green", result: "pass" },
      { name: "First aid kit present & complete", result: "pass" },
      { name: "Warning triangle / reflective triangles", result: "pass" },
      { name: "Reflective vest accessible", result: "pass" },
      { name: "Wheel chocks (heavy vehicles)", result: "na" },
    ],
  },
  {
    category: "Documentation",
    icon: "document",
    items: [
      { name: "Vehicle registration document present", result: "pass" },
      { name: "Insurance certificate valid", result: "pass" },
      { name: "Roadworthy certificate current", result: "pass" },
      { name: "Road fund license displayed", result: "pass" },
      { name: "Driver license valid", result: "pass" },
    ],
  },
  {
    category: "Exterior & General",
    icon: "vehicle",
    items: [
      { name: "Body panels secure, no loose parts", result: "pass" },
      { name: "Number plates clean & legible", result: "pass" },
      { name: "Exhaust secure, no unusual smoke", result: "pass" },
      { name: "Cargo secured (if carrying load)", result: "na" },
      { name: "Walk-around check complete (no damage)", result: "pass" },
    ],
  },
];

export function buildDefaultDailyChecklist(): DailyChecklistCategory[] {
  return DAILY_CHECKLIST.map((cat) => ({
    category: cat.category,
    icon: cat.icon,
    items: cat.items.map((it) => ({ ...it })),
  }));
}

export function summarizeDailyChecklist(checklist: DailyChecklistCategory[]): {
  total: number;
  passed: number;
  failed: number;
  na: number;
  passRate: number;
} {
  let total = 0, passed = 0, failed = 0, na = 0;
  for (const cat of checklist) {
    for (const it of cat.items) {
      total++;
      if (it.result === "pass") passed++;
      else if (it.result === "fail") failed++;
      else na++;
    }
  }
  const denominator = total - na;
  return {
    total, passed, failed, na,
    passRate: denominator > 0 ? Math.round((passed / denominator) * 100) : 0,
  };
}
