import { isIP } from "node:net";

function isPrivateIPv4(host: string): boolean {
  const parts = host.split(".").map(Number);
  if (parts.length !== 4 || parts.some(Number.isNaN)) return false;
  const [a, b] = parts;
  return a === 10
    || a === 127
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || a === 0;
}

export function validateWebhookDestination(value: string): { ok: true; url: URL } | { ok: false; reason: string } {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, reason: "Webhook URL is invalid" };
  }

  if (!['https:', ...(process.env.NODE_ENV === 'production' ? [] : ['http:'])].includes(url.protocol)) {
    return { ok: false, reason: "Webhook URL must use HTTPS" };
  }
  if (url.username || url.password) return { ok: false, reason: "Webhook URL must not contain embedded credentials" };

  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local")) {
    return { ok: false, reason: "Webhook URL may not target a local host" };
  }
  const ipVersion = isIP(host);
  if (ipVersion === 4 && isPrivateIPv4(host)) return { ok: false, reason: "Webhook URL may not target a private network" };
  if (ipVersion === 6 && (host === "::1" || host.startsWith("fe80:") || host.startsWith("fc") || host.startsWith("fd"))) {
    return { ok: false, reason: "Webhook URL may not target a private network" };
  }
  return { ok: true, url };
}
