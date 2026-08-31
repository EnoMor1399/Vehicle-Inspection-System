export type InspectionOutcome = "pass" | "conditional_pass" | "reinspection_required" | "fail";
export type InspectionWorkflow =
  | "draft"
  | "scheduled"
  | "in_progress"
  | "completed"
  | "approved"
  | "failed"
  | "reinspection"
  | "archived";

export type InspectionVehicleStatus = "under_inspection" | "passed" | "failed";

type InspectionItemLike = {
  name: string;
  result: "pass" | "fail" | "na";
  severity?: "minor" | "major" | "critical";
};

type InspectionSectionLike = {
  items: InspectionItemLike[];
};

export type InspectionOutcomeAssessment = {
  ok: boolean;
  failedCount: number;
  criticalFailedCount: number;
  failedNames: string[];
  criticalFailedNames: string[];
  message?: string;
};

export function assessInspectionOutcome(
  overallResult: InspectionOutcome,
  sections: InspectionSectionLike[]
): InspectionOutcomeAssessment {
  const failedItems = sections.flatMap((section) => section.items).filter((item) => item.result === "fail");
  const criticalItems = failedItems.filter((item) => item.severity === "critical");
  const base = {
    failedCount: failedItems.length,
    criticalFailedCount: criticalItems.length,
    failedNames: failedItems.map((item) => item.name).slice(0, 25),
    criticalFailedNames: criticalItems.map((item) => item.name).slice(0, 25),
  };

  if (overallResult === "pass" && failedItems.length > 0) {
    return {
      ok: false,
      ...base,
      message: "A PASS result cannot contain failed inspection items",
    };
  }

  if (overallResult === "conditional_pass" && criticalItems.length > 0) {
    return {
      ok: false,
      ...base,
      message: "A conditional pass cannot be issued while critical defects remain",
    };
  }

  return { ok: true, ...base };
}

export function deriveVehicleStatusAfterInspection(
  overallResult: InspectionOutcome,
  workflowStatus: InspectionWorkflow,
  requireSupervisorApproval: boolean
): InspectionVehicleStatus | null {
  if (workflowStatus === "draft" || workflowStatus === "scheduled" || workflowStatus === "archived") {
    return null;
  }

  if (workflowStatus === "in_progress" || workflowStatus === "reinspection") {
    return "under_inspection";
  }

  if (workflowStatus === "failed" || overallResult === "fail") {
    return "failed";
  }

  if (overallResult === "pass") {
    if (workflowStatus === "approved" || !requireSupervisorApproval) return "passed";
    return "under_inspection";
  }

  return "under_inspection";
}
