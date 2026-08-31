export function sanitizeTelemetryUrl(input?: string): string | undefined {
  if (!input) return undefined;
  const value = input.trim();
  if (!value) return undefined;

  try {
    const absolute = new URL(value);
    if (absolute.protocol !== "http:" && absolute.protocol !== "https:") return undefined;
    return `${absolute.origin}${absolute.pathname}`.slice(0, 2000);
  } catch {
    if (!value.startsWith("/")) return undefined;
    try {
      const relative = new URL(value, "https://vims.invalid");
      return relative.pathname.slice(0, 2000);
    } catch {
      return undefined;
    }
  }
}
