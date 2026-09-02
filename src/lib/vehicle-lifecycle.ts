export type VehicleStatus =
  | "active"
  | "under_inspection"
  | "failed"
  | "passed"
  | "suspended"
  | "decommissioned";

const INSPECTION_DERIVED = new Set<VehicleStatus>([
  "under_inspection",
  "failed",
  "passed",
]);

export type VehicleStatusDecision =
  | { ok: true }
  | { ok: false; message: string };

export function validateGenericVehicleStatusTransition(
  current: VehicleStatus,
  requested: VehicleStatus
): VehicleStatusDecision {
  if (requested === current) return { ok: true };

  if (current === "decommissioned") {
    return {
      ok: false,
      message: "A decommissioned vehicle cannot be reactivated through the generic vehicle API",
    };
  }

  if (INSPECTION_DERIVED.has(requested)) {
    return {
      ok: false,
      message: `Vehicle status '${requested}' is controlled by the inspection workflow`,
    };
  }

  if (INSPECTION_DERIVED.has(current) && requested !== "decommissioned") {
    return {
      ok: false,
      message: `Vehicle status '${current}' can only change through the inspection workflow or decommissioning`,
    };
  }

  // Administrative lifecycle changes may move active/suspended vehicles between
  // those states, and any non-decommissioned vehicle may be decommissioned.
  return { ok: true };
}

export function isInspectionDerivedVehicleStatus(status: VehicleStatus): boolean {
  return INSPECTION_DERIVED.has(status);
}
