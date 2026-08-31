export interface FleetReadinessInput {
  total: number;
  active: number;
  passed: number;
  decommissioned: number;
}

export interface FleetReadinessResult {
  readyVehicles: number;
  eligibleVehicles: number;
  fleetReadinessRate: number;
}

function safeCount(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

export function calculateFleetReadiness(input: FleetReadinessInput): FleetReadinessResult {
  const total = safeCount(input.total);
  const decommissioned = Math.min(total, safeCount(input.decommissioned));
  const eligibleVehicles = Math.max(0, total - decommissioned);
  const readyVehicles = Math.min(
    eligibleVehicles,
    safeCount(input.active) + safeCount(input.passed)
  );
  const fleetReadinessRate = eligibleVehicles > 0
    ? Math.round((readyVehicles / eligibleVehicles) * 100)
    : 0;

  return { readyVehicles, eligibleVehicles, fleetReadinessRate };
}
