import test from "node:test";
import assert from "node:assert/strict";
import { inspectionCreateSchema } from "../src/lib/api-schemas";

const vehicleId = "11111111-1111-4111-8111-111111111111";
const jpegDataUrl = "data:image/jpeg;base64,/9j/AA==";

function inspectionWithItems(items: unknown[]) {
  return {
    vehicleId,
    overallResult: "pass",
    workflowStatus: "completed",
    sectionData: [{ section: "B", title: "Braking", items }],
  };
}

function passingItem(overrides: Record<string, unknown> = {}) {
  return {
    name: "Service brake",
    result: "pass",
    photos: [{ id: "photo-1", dataUrl: jpegDataUrl, takenAt: "2026-09-02T10:00:00.000Z" }],
    ...overrides,
  };
}

test("inspection evidence accepts supported base64 image data URLs", () => {
  const parsed = inspectionCreateSchema.safeParse(inspectionWithItems([passingItem()]));
  assert.equal(parsed.success, true);
});

test("inspection evidence rejects unsupported or active image formats", () => {
  const svg = passingItem({
    photos: [{
      id: "photo-svg",
      dataUrl: "data:image/svg+xml;base64,PHN2Zz48c2NyaXB0PmFsZXJ0KDEpPC9zY3JpcHQ+PC9zdmc+",
      takenAt: "2026-09-02T10:00:00.000Z",
    }],
  });
  assert.equal(inspectionCreateSchema.safeParse(inspectionWithItems([svg])).success, false);
});

test("inspection evidence limits photos per checklist item", () => {
  const photos = Array.from({ length: 6 }, (_, index) => ({
    id: `photo-${index}`,
    dataUrl: jpegDataUrl,
    takenAt: "2026-09-02T10:00:00.000Z",
  }));
  const parsed = inspectionCreateSchema.safeParse(inspectionWithItems([passingItem({ photos })]));
  assert.equal(parsed.success, false);
});

test("inspection evidence limits aggregate photos across the inspection", () => {
  const items = Array.from({ length: 11 }, (_, itemIndex) => ({
    name: `Item ${itemIndex}`,
    result: "pass",
    photos: Array.from({ length: 5 }, (_, photoIndex) => ({
      id: `photo-${itemIndex}-${photoIndex}`,
      dataUrl: jpegDataUrl,
      takenAt: "2026-09-02T10:00:00.000Z",
    })),
  }));
  const parsed = inspectionCreateSchema.safeParse(inspectionWithItems(items));
  assert.equal(parsed.success, false);
  if (!parsed.success) {
    assert.ok(parsed.error.issues.some((issue) => issue.message.includes("50 photos")));
  }
});

test("inspection payload limits checklist section count", () => {
  const section = {
    section: "B",
    title: "Braking",
    items: [{ name: "Service brake", result: "pass" }],
  };
  const parsed = inspectionCreateSchema.safeParse({
    vehicleId,
    overallResult: "pass",
    workflowStatus: "completed",
    sectionData: Array.from({ length: 21 }, (_, index) => ({ ...section, section: `S${index}` })),
  });
  assert.equal(parsed.success, false);
});
