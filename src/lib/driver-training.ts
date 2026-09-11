export type DriverTrainingService = {
  id: string;
  title: string;
  summary: string;
  focusAreas: string[];
  outcomes: string[];
};

export const DRIVER_TRAINING_DEPARTMENT = {
  name: "Driver Training & Assessment Services",
  shortName: "Driver Training & Assessment",
  description:
    "Specialized driver, vehicle, and equipment safety training designed to improve operator competence, reduce accidents, strengthen compliance, and enhance operational efficiency.",
  purpose:
    "The department combines practical safety training and competence assessment to help organizations strengthen professional driving standards, protect people and equipment, and build a stronger safety culture.",
} as const;

export const DRIVER_TRAINING_SERVICES: readonly DriverTrainingService[] = [
  {
    id: "defensive-driving",
    title: "Defensive Driving Training",
    summary:
      "Develops drivers’ hazard awareness and safe-driving judgement while strengthening everyday vehicle-operation discipline.",
    focusAreas: [
      "Hazard awareness and anticipation",
      "Safe driving techniques",
      "Fatigue management",
      "Speed control",
      "Vehicle inspection skills",
      "Fuel-efficient driving habits",
      "Road-safety policy compliance",
    ],
    outcomes: [
      "Reduce accidents and vehicle damage",
      "Reduce downtime and maintenance costs",
      "Support lower operational and insurance exposure",
      "Strengthen professional driving behaviour",
    ],
  },
  {
    id: "driving-proficiency-test",
    title: "Driving Proficiency Test",
    summary:
      "Assesses a driver’s competence, safety awareness, vehicle handling, and overall driving performance using a structured qualification approach.",
    focusAreas: [
      "Driver competence",
      "Safety awareness",
      "Vehicle handling",
      "Driving performance",
      "Qualification and recruitment support",
      "High-risk driver identification",
    ],
    outcomes: [
      "Support safer recruitment and driver qualification",
      "Identify coaching and retraining needs",
      "Improve fleet-safety decisions",
      "Strengthen compliance evidence",
    ],
  },
  {
    id: "hazmat-hydrocarbons",
    title: "HAZMAT (Hydrocarbons) Training",
    summary:
      "Equips bulk vehicle and petroleum transport operators with essential knowledge for the safe handling and transport of hazardous hydrocarbon products.",
    focusAreas: [
      "Safe handling of hydrocarbon products",
      "Bulk and petroleum transport safety",
      "Hazard recognition",
      "Emergency response",
      "Environmental protection",
      "Regulatory compliance",
      "Emergency preparedness",
    ],
    outcomes: [
      "Improve hazardous-material transport safety",
      "Strengthen emergency preparedness",
      "Support environmental protection",
      "Improve regulatory compliance",
    ],
  },
  {
    id: "off-road-driving",
    title: "Off-Road Driving Training",
    summary:
      "Builds practical skills for safely operating vehicles on difficult terrain and in demanding industrial and field environments.",
    focusAreas: [
      "Difficult-terrain navigation",
      "Vehicle control and terrain assessment",
      "Rollover-risk reduction",
      "Mining and construction operations",
      "Oil and gas field operations",
      "Agriculture and forestry operations",
      "Security and logistics operations",
    ],
    outcomes: [
      "Reduce rollovers and off-road accidents",
      "Reduce vehicle damage and downtime",
      "Protect equipment in difficult operating conditions",
      "Lower avoidable maintenance costs",
    ],
  },
  {
    id: "forklift-operator-safety",
    title: "Forklift Operator Safety Training",
    summary:
      "Trains forklift operators to use equipment safely and efficiently while managing workplace and operational risks.",
    focusAreas: [
      "Safe forklift operation",
      "Equipment-control competence",
      "Workplace hazard awareness",
      "Operational-risk reduction",
      "Efficient material handling",
      "Regulatory compliance",
    ],
    outcomes: [
      "Reduce workplace injuries",
      "Reduce equipment damage",
      "Improve operator competence and productivity",
      "Strengthen operational compliance",
    ],
  },
  {
    id: "vehicle-safety-inspection",
    title: "Vehicle Safety Inspection Training",
    summary:
      "Trains fleet personnel, supervisors, and safety officers to conduct effective pre-trip and post-trip vehicle safety inspections.",
    focusAreas: [
      "Pre-trip vehicle inspections",
      "Post-trip vehicle inspections",
      "Early defect identification",
      "Inspection reporting discipline",
      "Preventive-maintenance support",
      "Fleet safety supervision",
    ],
    outcomes: [
      "Identify defects earlier",
      "Support preventive maintenance",
      "Reduce breakdowns and accidents",
      "Reduce operational downtime",
    ],
  },
] as const;

export const DRIVER_TRAINING_OUTCOMES = [
  "Improved safety",
  "Higher operator professionalism",
  "Stronger compliance",
  "Better equipment protection",
  "Greater operational efficiency",
  "A stronger organizational safety culture",
] as const;
