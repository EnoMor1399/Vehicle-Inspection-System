import packageJson from "../../package.json";

/**
 * Source-controlled application release identity.
 *
 * Runtime environment variables must not override the deployed code version;
 * package.json remains the single source of truth for the semantic version.
 * Deployment-provided Git metadata is used only to identify the exact build.
 */
export const RELEASE_VERSION = packageJson.version;

const gitShaPattern = /^[0-9a-f]{7,64}$/i;

export function resolveReleaseCommit(
  env: Record<string, string | undefined> = process.env,
): string | null {
  for (const candidate of [env.VERCEL_GIT_COMMIT_SHA, env.GITHUB_SHA]) {
    const normalized = candidate?.trim();
    if (normalized && gitShaPattern.test(normalized)) {
      return normalized.toLowerCase().slice(0, 12);
    }
  }
  return null;
}

export const RELEASE_COMMIT = resolveReleaseCommit();
export const RELEASE_ID = RELEASE_COMMIT
  ? `${RELEASE_VERSION}+${RELEASE_COMMIT}`
  : RELEASE_VERSION;
