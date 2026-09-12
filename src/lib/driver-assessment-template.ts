export type DriverAssessmentCriterion = {
  id: string;
  label: string;
};

export type DriverAssessmentSection = {
  id: string;
  title: string;
  description: string;
  criteria: readonly DriverAssessmentCriterion[];
};

export type DriverAssessmentSectionScore = {
  score: number;
  maximum: number;
  percentage: number | null;
  ratedCriteria: number;
};

export type DriverAssessmentClassification =
  | "excellent"
  | "very_good"
  | "satisfactory"
  | "needs_improvement"
  | "unsatisfactory";

export type DriverAssessmentRecommendation =
  | "highly_competent"
  | "competent"
  | "competent_with_development_needs"
  | "requires_coaching"
  | "requires_retraining"
  | "not_yet_competent"
  | "unsafe_pending_corrective_action";

export const DRIVER_ASSESSMENT_RATINGS = [1, 2, 3, 4, 5] as const;

export const DRIVER_ASSESSMENT_RATING_LABELS: Record<number, string> = {
  1: "Unsatisfactory",
  2: "Needs improvement",
  3: "Satisfactory",
  4: "Good",
  5: "Excellent",
};

export const DRIVER_ASSESSMENT_SECTIONS: readonly DriverAssessmentSection[] = [
  {
    id: "pre_drive",
    title: "Pre-Driving Inspection & Vehicle Readiness",
    description: "Preparation, roadworthiness checks and safe setup before movement.",
    criteria: [
      { id: "pre_trip_inspection", label: "Conducts a systematic pre-trip inspection" },
      { id: "tyres_wheels_pressure", label: "Checks tyres, wheels and tyre pressure" },
      { id: "lights_indicators_reflectors", label: "Checks lights, indicators and reflectors" },
      { id: "mirrors_windscreen", label: "Checks mirrors and windscreen condition" },
      { id: "brakes_parking_brake", label: "Checks brakes and parking brake" },
      { id: "fluid_levels", label: "Checks relevant vehicle fluid levels" },
      { id: "seatbelts_safety_equipment", label: "Checks seat belts and required safety equipment" },
      { id: "visible_defects", label: "Identifies visible vehicle defects" },
      { id: "vehicle_documents", label: "Confirms required vehicle documents are available" },
      { id: "seat_steering_mirrors", label: "Adjusts seat, steering and mirrors correctly before moving" },
    ],
  },
  {
    id: "safe_driving",
    title: "Safe Driving Practices",
    description: "Core defensive-driving behaviours and protection of all road users.",
    criteria: [
      { id: "seatbelt_use", label: "Uses seat belt correctly" },
      { id: "following_distance", label: "Maintains a safe following distance" },
      { id: "appropriate_speed", label: "Maintains appropriate speed for road conditions" },
      { id: "continuous_scanning", label: "Scans the road environment continuously" },
      { id: "early_hazard_identification", label: "Identifies hazards early" },
      { id: "anticipates_road_users", label: "Anticipates actions of other road users" },
      { id: "mirror_use", label: "Uses mirrors frequently and appropriately" },
      { id: "blind_spot_checks", label: "Checks blind spots before manoeuvres" },
      { id: "lane_position", label: "Maintains safe lane position" },
      { id: "defensive_techniques", label: "Demonstrates defensive-driving techniques" },
      { id: "avoids_aggression", label: "Avoids aggressive driving behaviour" },
      { id: "concentration", label: "Maintains concentration while driving" },
      { id: "avoids_distraction", label: "Avoids unnecessary distractions" },
      { id: "adverse_conditions", label: "Adjusts driving to weather and road conditions" },
      { id: "vulnerable_road_users", label: "Interacts safely with pedestrians, cyclists and motorcycles" },
    ],
  },
  {
    id: "traffic_regulations",
    title: "Traffic Regulations & Road Knowledge",
    description: "Knowledge and practical application of traffic laws, signs and right-of-way rules.",
    criteria: [
      { id: "road_signs_markings", label: "Understands road signs and markings" },
      { id: "speed_limits", label: "Obeys posted and statutory speed limits" },
      { id: "traffic_lights_signals", label: "Obeys traffic lights and signals" },
      { id: "right_of_way", label: "Understands and applies right-of-way rules" },
      { id: "lane_discipline", label: "Uses correct lane discipline" },
      { id: "overtaking_rules", label: "Understands overtaking rules" },
      { id: "pedestrian_crossings", label: "Observes pedestrian crossings and associated duties" },
      { id: "parking_stopping_rules", label: "Understands parking and stopping restrictions" },
      { id: "roundabout_procedure", label: "Uses correct roundabout procedure" },
      { id: "transport_regulations", label: "Complies with applicable road transport regulations" },
    ],
  },
  {
    id: "vehicle_handling",
    title: "Vehicle Control & Handling",
    description: "Smooth, accurate and stable control of the assigned vehicle.",
    criteria: [
      { id: "safe_start", label: "Starts the vehicle safely" },
      { id: "smooth_acceleration", label: "Demonstrates smooth acceleration" },
      { id: "controlled_braking", label: "Demonstrates controlled braking" },
      { id: "steering_control", label: "Uses steering correctly" },
      { id: "vehicle_positioning", label: "Maintains appropriate vehicle positioning" },
      { id: "low_speed_control", label: "Controls the vehicle smoothly at low speed" },
      { id: "bends_corners", label: "Handles bends and corners safely" },
      { id: "gear_selection", label: "Selects appropriate gear where applicable" },
      { id: "clutch_control", label: "Demonstrates correct clutch control where applicable" },
      { id: "reversing", label: "Reverses safely and accurately" },
      { id: "parking", label: "Parks the vehicle safely and accurately" },
      { id: "inclines_declines", label: "Controls the vehicle on inclines and declines" },
      { id: "vehicle_stability", label: "Maintains vehicle stability during manoeuvres" },
      { id: "vehicle_dimensions", label: "Demonstrates awareness of vehicle dimensions" },
      { id: "passenger_load_control", label: "Controls the vehicle safely when carrying passengers or loads" },
    ],
  },
  {
    id: "hazard_decision",
    title: "Observation, Hazard Awareness & Decision-Making",
    description: "Situational awareness, planning and safe decisions under changing conditions.",
    criteria: [
      { id: "developing_hazards", label: "Identifies developing hazards" },
      { id: "hazard_response", label: "Responds appropriately to hazards" },
      { id: "junction_observation", label: "Maintains adequate observation at junctions" },
      { id: "pressure_decisions", label: "Makes safe decisions under pressure" },
      { id: "advance_planning", label: "Plans manoeuvres in advance" },
      { id: "safe_gaps", label: "Selects safe gaps when joining traffic" },
      { id: "changing_conditions", label: "Recognises changing road conditions" },
      { id: "situational_awareness", label: "Maintains effective situational awareness" },
      { id: "avoids_risk_taking", label: "Avoids unnecessary risk-taking" },
      { id: "unexpected_events", label: "Responds appropriately to unexpected situations" },
    ],
  },
  {
    id: "speed_braking",
    title: "Braking, Following Distance & Speed Management",
    description: "Speed selection, stopping distance and smooth braking control.",
    criteria: [
      { id: "stopping_distance", label: "Maintains sufficient stopping distance" },
      { id: "adaptive_following", label: "Adjusts following distance according to conditions" },
      { id: "progressive_braking", label: "Brakes progressively and smoothly" },
      { id: "avoids_harsh_braking", label: "Avoids unnecessary harsh braking" },
      { id: "hazard_approach_speed", label: "Approaches hazards at an appropriate speed" },
      { id: "bend_speed", label: "Controls speed correctly on bends" },
      { id: "slope_speed", label: "Controls speed correctly on slopes" },
      { id: "junction_pedestrian_speed", label: "Reduces speed appropriately near pedestrians and junctions" },
      { id: "braking_distance_awareness", label: "Demonstrates awareness of braking distance" },
      { id: "avoids_excess_speed", label: "Avoids excessive or unsafe speed" },
    ],
  },
  {
    id: "manoeuvring",
    title: "Overtaking, Lane Changes & Manoeuvring",
    description: "Safe observation, signalling and positioning during higher-risk manoeuvres.",
    criteria: [
      { id: "overtake_conditions", label: "Assesses road conditions before overtaking" },
      { id: "manoeuvre_mirrors", label: "Checks mirrors before manoeuvring" },
      { id: "manoeuvre_blind_spots", label: "Checks blind spots before manoeuvring" },
      { id: "timely_signalling", label: "Signals correctly and in good time" },
      { id: "safe_clearance", label: "Maintains safe clearance during manoeuvres" },
      { id: "safe_lane_return", label: "Returns safely to the appropriate lane" },
      { id: "prohibited_overtaking", label: "Avoids overtaking in prohibited or unsafe areas" },
      { id: "smooth_lane_changes", label: "Changes lanes smoothly and predictably" },
      { id: "overtaking_patience", label: "Demonstrates patience when overtaking is unsafe" },
      { id: "pre_manoeuvre_position", label: "Positions the vehicle correctly before manoeuvres" },
    ],
  },
  {
    id: "communication",
    title: "Communication & Interaction With Other Road Users",
    description: "Clear signalling, courtesy and professional communication with road users and passengers.",
    criteria: [
      { id: "indicator_use", label: "Uses indicators correctly" },
      { id: "clear_intentions", label: "Communicates driving intentions clearly" },
      { id: "horn_use", label: "Uses the horn appropriately" },
      { id: "responds_to_signals", label: "Responds appropriately to signals from other road users" },
      { id: "courtesy_patience", label: "Shows courtesy and patience" },
      { id: "avoids_confrontation", label: "Avoids confrontational behaviour" },
      { id: "passenger_client_communication", label: "Communicates professionally with passengers or clients" },
      { id: "trainer_instructions", label: "Listens to and follows trainer instructions" },
      { id: "vehicle_problem_reporting", label: "Communicates vehicle problems clearly" },
      { id: "respectful_behaviour", label: "Demonstrates respectful road-user behaviour" },
    ],
  },
  {
    id: "professional_conduct",
    title: "Driver Attitude & Professional Conduct",
    description: "Judgement, composure, accountability and professional behaviour.",
    criteria: [
      { id: "safety_attitude", label: "Demonstrates a responsible attitude toward safety" },
      { id: "calm_under_pressure", label: "Remains calm under pressure" },
      { id: "accepts_correction", label: "Accepts correction positively" },
      { id: "patience", label: "Demonstrates patience" },
      { id: "good_judgement", label: "Shows good judgement" },
      { id: "professional_risk_avoidance", label: "Avoids unnecessary risk-taking" },
      { id: "confidence_balance", label: "Demonstrates confidence without overconfidence" },
      { id: "professionalism", label: "Maintains professional conduct" },
      { id: "passenger_consideration", label: "Shows consideration for passengers and other road users" },
      { id: "decision_accountability", label: "Takes responsibility for driving decisions" },
    ],
  },
  {
    id: "fatigue_distraction",
    title: "Fatigue, Distraction & Personal Safety Management",
    description: "Fitness to drive, concentration and control of distraction-related risks.",
    criteria: [
      { id: "fatigue_risk", label: "Understands risks associated with fatigue" },
      { id: "reduced_concentration", label: "Recognises signs of reduced concentration" },
      { id: "rest_requirements", label: "Understands appropriate rest requirements" },
      { id: "mobile_phone", label: "Avoids mobile-phone distraction" },
      { id: "other_distractions", label: "Avoids eating and other distracting activities while driving" },
      { id: "journey_focus", label: "Maintains focus throughout the journey" },
      { id: "substance_medication", label: "Understands effects of alcohol, drugs and medication on driving" },
      { id: "fitness_to_drive", label: "Demonstrates appropriate personal fitness to drive" },
    ],
  },
  {
    id: "eco_driving",
    title: "Fuel-Efficient & Vehicle-Friendly Driving",
    description: "Efficient driving techniques that protect fuel, equipment and operating cost.",
    criteria: [
      { id: "progressive_acceleration", label: "Accelerates progressively" },
      { id: "engine_revving", label: "Avoids excessive engine revving" },
      { id: "efficient_gears", label: "Selects gears efficiently" },
      { id: "traffic_flow_anticipation", label: "Anticipates traffic flow to reduce unnecessary braking" },
      { id: "idling", label: "Avoids unnecessary idling" },
      { id: "cruising_speed", label: "Maintains an efficient cruising speed" },
      { id: "wear_reduction", label: "Operates the vehicle in a manner that reduces wear and tear" },
      { id: "environmental_practice", label: "Demonstrates environmentally responsible driving practices" },
    ],
  },
  {
    id: "emergency_response",
    title: "Emergency & Incident Response",
    description: "Knowledge of breakdown, collision, fire and emergency-response procedures.",
    criteria: [
      { id: "collision_procedure", label: "Understands procedures following a collision" },
      { id: "scene_security", label: "Knows how to secure an incident scene" },
      { id: "emergency_contacts", label: "Understands emergency contact procedures" },
      { id: "breakdown_response", label: "Knows how to respond to a vehicle breakdown" },
      { id: "fire_safety", label: "Demonstrates awareness of fire-safety procedures" },
      { id: "emergency_braking", label: "Understands emergency-braking principles" },
      { id: "incident_reporting", label: "Knows the organisation's incident-reporting requirements" },
      { id: "mechanical_failure", label: "Demonstrates appropriate response to tyre or mechanical failure" },
    ],
  },
] as const;

export const DRIVER_ASSESSMENT_CRITICAL_VIOLATIONS = [
  { id: "dangerous_speeding", label: "Dangerous speeding" },
  { id: "ignored_traffic_signal", label: "Ignoring a traffic signal" },
  { id: "unsafe_overtaking", label: "Unsafe overtaking" },
  { id: "failure_to_yield", label: "Failure to yield" },
  { id: "seatbelt_violation", label: "Failure to wear a seat belt" },
  { id: "mobile_phone_use", label: "Mobile-phone use while driving" },
  { id: "preventable_collision", label: "Collision or preventable contact" },
  { id: "loss_of_control", label: "Serious loss of vehicle control" },
  { id: "dangerous_following", label: "Dangerous following distance" },
  { id: "failure_to_stop", label: "Failure to stop when instructed" },
  { id: "reckless_aggressive", label: "Reckless or aggressive driving" },
  { id: "vulnerable_user_violation", label: "Serious pedestrian or cyclist safety violation" },
] as const;

export const DRIVER_ASSESSMENT_TOTAL_CRITERIA = DRIVER_ASSESSMENT_SECTIONS.reduce(
  (total, section) => total + section.criteria.length,
  0,
);

export const DRIVER_ASSESSMENT_MAX_SCORE = DRIVER_ASSESSMENT_TOTAL_CRITERIA * 5;

export function calculateDriverAssessment(
  ratings: Record<string, number | null | undefined>,
): {
  sectionScores: Record<string, DriverAssessmentSectionScore>;
  score: number;
  maximum: number;
  percentage: number | null;
  ratedCriteria: number;
  classification: DriverAssessmentClassification | null;
} {
  const sectionScores: Record<string, DriverAssessmentSectionScore> = {};
  let score = 0;
  let maximum = 0;
  let ratedCriteria = 0;

  for (const section of DRIVER_ASSESSMENT_SECTIONS) {
    let sectionScore = 0;
    let sectionMaximum = 0;
    let sectionRatedCriteria = 0;

    for (const criterion of section.criteria) {
      const value = ratings[criterion.id];
      if (typeof value !== "number" || !Number.isInteger(value) || value < 1 || value > 5) continue;
      sectionScore += value;
      sectionMaximum += 5;
      sectionRatedCriteria += 1;
    }

    sectionScores[section.id] = {
      score: sectionScore,
      maximum: sectionMaximum,
      percentage: sectionMaximum > 0 ? Math.round((sectionScore / sectionMaximum) * 10_000) / 100 : null,
      ratedCriteria: sectionRatedCriteria,
    };
    score += sectionScore;
    maximum += sectionMaximum;
    ratedCriteria += sectionRatedCriteria;
  }

  const percentage = maximum > 0 ? Math.round((score / maximum) * 10_000) / 100 : null;
  const classification = percentage === null
    ? null
    : percentage >= 90
      ? "excellent"
      : percentage >= 80
        ? "very_good"
        : percentage >= 70
          ? "satisfactory"
          : percentage >= 60
            ? "needs_improvement"
            : "unsatisfactory";

  return { sectionScores, score, maximum, percentage, ratedCriteria, classification };
}

export function deriveDriverAssessmentOutcome(overallPercentage: number, criticalViolationCount: number) {
  if (criticalViolationCount > 0) {
    return {
      result: "not_yet_competent" as const,
      riskLevel: "critical" as const,
      finalRecommendation: "unsafe_pending_corrective_action" as DriverAssessmentRecommendation,
    };
  }
  if (overallPercentage >= 90) {
    return {
      result: "competent" as const,
      riskLevel: "low" as const,
      finalRecommendation: "highly_competent" as DriverAssessmentRecommendation,
    };
  }
  if (overallPercentage >= 80) {
    return {
      result: "competent" as const,
      riskLevel: "low" as const,
      finalRecommendation: "competent" as DriverAssessmentRecommendation,
    };
  }
  if (overallPercentage >= 70) {
    return {
      result: "competent" as const,
      riskLevel: "medium" as const,
      finalRecommendation: "competent_with_development_needs" as DriverAssessmentRecommendation,
    };
  }
  if (overallPercentage >= 60) {
    return {
      result: "not_yet_competent" as const,
      riskLevel: "medium" as const,
      finalRecommendation: "requires_coaching" as DriverAssessmentRecommendation,
    };
  }
  return {
    result: "not_yet_competent" as const,
    riskLevel: "high" as const,
    finalRecommendation: "requires_retraining" as DriverAssessmentRecommendation,
  };
}

export function formatAssessmentRecommendation(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}
