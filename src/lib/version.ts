import packageJson from "../../package.json";

/**
 * Source-controlled application release identity.
 *
 * Runtime environment variables must not override the deployed code version;
 * package.json is the single source of truth for release metadata.
 */
export const RELEASE_VERSION = packageJson.version;
