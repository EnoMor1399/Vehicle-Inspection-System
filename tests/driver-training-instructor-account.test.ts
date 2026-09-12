import test from "node:test";
import assert from "node:assert/strict";
import {
  canManageTraining,
  canManageTrainingUsers,
  canReviewTrainingAssessments,
  canViewTraining,
} from "../src/lib/training-access";

test("Instructor Account receives operational Driver Training privileges", () => {
  const instructor = {
    role: "instructor",
    permissions: {
      vehicle_inspection: false,
      training: true,
      training_manage: true,
      training_assessment_review: false,
    },
  };

  assert.equal(canViewTraining(instructor), true);
  assert.equal(canManageTraining(instructor), true);
  assert.equal(canReviewTrainingAssessments(instructor), false);
  assert.equal(canManageTrainingUsers(instructor), false);
});

test("Instructor Account remains outside independent review governance", () => {
  assert.equal(
    canReviewTrainingAssessments({
      role: "instructor",
      permissions: { training: true, training_manage: true },
    }),
    false,
  );
});
