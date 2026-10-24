/**
 * Shared Paystack credential and checkout policy.
 *
 * A paused checkout must not prevent server-side verification of an already
 * initiated charge. The live approval flag applies to NEW checkout attempts,
 * not to signed webhook handling or reconciliation.
 */
export type PaystackMode = "test" | "live";

export type PaystackRuntimeSettings = {
  mode?: string | null;
  secretKey?: string | null;
  livePaymentsEnabled?: string | null;
};

export function validatedPaystackCredentials(input: PaystackRuntimeSettings): {
  secret: string;
  mode: PaystackMode;
} {
  const mode = input.mode?.trim();
  const secret = input.secretKey?.trim() || "";
  if (mode !== "test" && mode !== "live") {
    throw new Error("Paystack mode is not configured.");
  }
  const expectedPrefix = mode === "live" ? "sk_live_" : "sk_test_";
  if (!secret.startsWith(expectedPrefix) || secret.length <= expectedPrefix.length) {
    throw new Error("Paystack credentials do not match the selected environment.");
  }
  return { secret, mode };
}

export function approvedPaystackCheckout(input: PaystackRuntimeSettings) {
  const credentials = validatedPaystackCredentials(input);
  if (credentials.mode === "live" && input.livePaymentsEnabled !== "true") {
    throw new Error("Live Paystack checkout is disabled until explicitly approved.");
  }
  return credentials;
}
