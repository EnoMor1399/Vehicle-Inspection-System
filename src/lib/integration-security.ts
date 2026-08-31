import { isIP } from "node:net";

function normalizedHost(value: string): string {
  const lower = value.trim().toLowerCase().replace(/\.$/, "");
  return lower.startsWith("[") && lower.endsWith("]") ? lower.slice(1, -1) : lower;
}

function parseIPv4(host: string): number[] | null {
  const parts = host.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part))) return null;
  const bytes = parts.map(Number);
  return bytes.every((part) => part >= 0 && part <= 255) ? bytes : null;
}

function isNonPublicIPv4(host: string): boolean {
  const parts = parseIPv4(host);
  if (!parts) return false;
  const [a, b, c] = parts;

  return a === 0
    || a === 10
    || a === 127
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 0 && c === 0)
    || (a === 192 && b === 0 && c === 2)
    || (a === 192 && b === 168)
    || (a === 198 && (b === 18 || b === 19))
    || (a === 198 && b === 51 && c === 100)
    || (a === 203 && b === 0 && c === 113)
    || a >= 224;
}

function expandIPv6(host: string): number[] | null {
  let normalized = normalizedHost(host);
  if (!normalized.includes(":")) return null;

  const ipv4Match = normalized.match(/(?:^|:)(\d{1,3}(?:\.\d{1,3}){3})$/);
  if (ipv4Match) {
    const ipv4 = parseIPv4(ipv4Match[1]);
    if (!ipv4) return null;
    const encoded = `${((ipv4[0] << 8) | ipv4[1]).toString(16)}:${((ipv4[2] << 8) | ipv4[3]).toString(16)}`;
    normalized = normalized.slice(0, normalized.length - ipv4Match[1].length) + encoded;
  }

  const halves = normalized.split("::");
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - left.length - right.length;
  if ((halves.length === 1 && missing !== 0) || (halves.length === 2 && missing < 1)) return null;

  const values = [...left, ...Array(Math.max(0, missing)).fill("0"), ...right].map((part) => {
    if (!/^[0-9a-f]{1,4}$/i.test(part)) return Number.NaN;
    return Number.parseInt(part, 16);
  });
  return values.length === 8 && values.every(Number.isFinite) ? values : null;
}

function isNonPublicIPv6(host: string): boolean {
  const parts = expandIPv6(host);
  if (!parts) return false;
  const [first, second] = parts;

  if (parts.every((part) => part === 0)) return true; // unspecified
  if (parts.slice(0, 7).every((part) => part === 0) && parts[7] === 1) return true; // loopback
  if ((first & 0xfe00) === 0xfc00) return true; // unique-local fc00::/7
  if ((first & 0xffc0) === 0xfe80) return true; // link-local fe80::/10
  if ((first & 0xff00) === 0xff00) return true; // multicast
  if (first === 0x2001 && second === 0x0db8) return true; // documentation

  const ipv4Mapped = parts.slice(0, 5).every((part) => part === 0) && parts[5] === 0xffff;
  if (ipv4Mapped) {
    const ipv4 = [parts[6] >> 8, parts[6] & 0xff, parts[7] >> 8, parts[7] & 0xff].join(".");
    return isNonPublicIPv4(ipv4);
  }
  return false;
}

function isInternalHostname(host: string): boolean {
  const blockedExact = new Set([
    "localhost",
    "metadata.google.internal",
    "metadata.google",
    "instance-data",
  ]);
  if (blockedExact.has(host)) return true;

  const blockedSuffixes = [
    ".localhost",
    ".local",
    ".internal",
    ".lan",
    ".home",
    ".corp",
    ".svc",
    ".cluster.local",
  ];
  return blockedSuffixes.some((suffix) => host.endsWith(suffix));
}

export function validateWebhookDestination(value: string): { ok: true; url: URL } | { ok: false; reason: string } {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { ok: false, reason: "Webhook URL is invalid" };
  }

  const allowedProtocols = process.env.NODE_ENV === "production" ? ["https:"] : ["https:", "http:"];
  if (!allowedProtocols.includes(url.protocol)) {
    return { ok: false, reason: "Webhook URL must use HTTPS" };
  }
  if (url.username || url.password) return { ok: false, reason: "Webhook URL must not contain embedded credentials" };

  const host = normalizedHost(url.hostname);
  if (!host || isInternalHostname(host)) {
    return { ok: false, reason: "Webhook URL may not target a local or internal host" };
  }

  const ipVersion = isIP(host);
  if (ipVersion === 4 && isNonPublicIPv4(host)) {
    return { ok: false, reason: "Webhook URL may not target a non-public network" };
  }
  if (ipVersion === 6 && isNonPublicIPv6(host)) {
    return { ok: false, reason: "Webhook URL may not target a non-public network" };
  }

  // Strip fragments because they are never sent in HTTP requests and retaining
  // them can leak client-side data into stored integration configuration.
  url.hash = "";
  return { ok: true, url };
}
