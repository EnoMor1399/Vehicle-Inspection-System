export function buildContentSecurityPolicy(nonce: string, production: boolean): string {
  if (!/^[A-Za-z0-9+/_=-]{16,128}$/.test(nonce)) {
    throw new Error("Invalid CSP nonce");
  }

  const directives = [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'self'",
    "form-action 'self'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    // Inline styles remain temporarily allowed because charting and legacy UI
    // components still emit style attributes. Script execution is nonce-only.
    "style-src 'self' 'unsafe-inline'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "script-src-attr 'none'",
    "connect-src 'self' https:",
    "media-src 'self' blob: data:",
    "frame-src 'self'",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
  ];

  if (production) directives.push("upgrade-insecure-requests");
  return directives.join("; ");
}
