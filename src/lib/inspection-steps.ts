import { INSPECTION_SECTIONS } from "@/lib/sections";

export const INSPECTION_IDENTIFICATION_STEP = "A";
export const INSPECTION_FINAL_DECISION_STEP = "P";

export function getInspectionStepOrder(): string[] {
  return [
    INSPECTION_IDENTIFICATION_STEP,
    ...INSPECTION_SECTIONS.map((section) => section.code),
    INSPECTION_FINAL_DECISION_STEP,
  ];
}

export function getAdjacentInspectionStep(
  activeStep: string,
  direction: -1 | 1,
): string | null {
  const steps = getInspectionStepOrder();
  const activeIndex = steps.indexOf(activeStep);
  if (activeIndex === -1) return null;

  const nextIndex = activeIndex + direction;
  if (nextIndex < 0 || nextIndex >= steps.length) return null;
  return steps[nextIndex];
}
