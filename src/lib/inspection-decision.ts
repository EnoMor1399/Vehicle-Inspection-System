export type InspectionOverallResult = "pass" | "conditional_pass" | "reinspection_required" | "fail";
export type InspectionSmokeResult = "pass" | "fail" | "na";

export type InspectionDecisionInput = {
  failCount: number;
  majorCount: number;
  criticalCount: number;
  smokeTest: InspectionSmokeResult;
};

export type InspectionDecisionGuidance = {
  passAllowed: boolean;
  conditionalPassAllowed: boolean;
  recommendedResult: InspectionOverallResult;
  message: string;
};

export function getInspectionDecisionGuidance(input: InspectionDecisionInput): InspectionDecisionGuidance {
  const failCount = Math.max(0, input.failCount);
  const majorCount = Math.max(0, input.majorCount);
  const criticalCount = Math.max(0, input.criticalCount);
  const smokeFailed = input.smokeTest === "fail";

  const passAllowed = failCount === 0 && !smokeFailed;
  const conditionalPassAllowed = criticalCount === 0;

  if (criticalCount > 0) {
    return {
      passAllowed,
      conditionalPassAllowed,
      recommendedResult: "reinspection_required",
      message: `${criticalCount} critical defect${criticalCount === 1 ? "" : "s"} remain. Re-inspection Required or Fail must be used until the critical defect is resolved.`,
    };
  }

  if (smokeFailed) {
    return {
      passAllowed,
      conditionalPassAllowed,
      recommendedResult: "reinspection_required",
      message: "The smoke/emissions test failed. Re-inspection Required is recommended until the emissions defect is corrected.",
    };
  }

  if (majorCount > 0) {
    return {
      passAllowed,
      conditionalPassAllowed,
      recommendedResult: "reinspection_required",
      message: `${majorCount} major defect${majorCount === 1 ? "" : "s"} remain. Re-inspection Required is recommended before the vehicle is cleared.`,
    };
  }

  if (failCount > 0) {
    return {
      passAllowed,
      conditionalPassAllowed,
      recommendedResult: "conditional_pass",
      message: `${failCount} failed checklist item${failCount === 1 ? "" : "s"} remain. PASS is unavailable; Conditional Pass is recommended for minor defects, or choose a stricter result.`,
    };
  }

  return {
    passAllowed,
    conditionalPassAllowed,
    recommendedResult: "pass",
    message: "No failed checklist or emissions items remain. PASS is available.",
  };
}
