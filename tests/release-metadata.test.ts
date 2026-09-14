import test from "node:test";
import assert from "node:assert/strict";
import { resolveReleaseCommit } from "../src/lib/version";

test("release metadata prefers the Vercel deployment commit", () => {
  assert.equal(
    resolveReleaseCommit({
      VERCEL_GIT_COMMIT_SHA: "ABCDEF1234567890abcdef1234567890abcdef12",
      GITHUB_SHA: "1111111111111111111111111111111111111111",
    }),
    "abcdef123456",
  );
});

test("release metadata falls back to the GitHub Actions commit", () => {
  assert.equal(
    resolveReleaseCommit({
      GITHUB_SHA: "1234567890abcdef1234567890abcdef12345678",
    }),
    "1234567890ab",
  );
});

test("release metadata rejects malformed commit identifiers", () => {
  assert.equal(resolveReleaseCommit({ VERCEL_GIT_COMMIT_SHA: "not-a-sha" }), null);
  assert.equal(resolveReleaseCommit({ GITHUB_SHA: "1234" }), null);
});

test("release metadata skips a malformed Vercel value and uses a valid GitHub fallback", () => {
  assert.equal(
    resolveReleaseCommit({
      VERCEL_GIT_COMMIT_SHA: "invalid",
      GITHUB_SHA: "fedcba9876543210fedcba9876543210fedcba98",
    }),
    "fedcba987654",
  );
});
