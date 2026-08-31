import type { NextConfig } from "next";

const isProduction = process.env.NODE_ENV === "production";
const configuredOrigins = (process.env.ALLOWED_ORIGINS || "localhost:3000")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean)
  .map((value) => {
    try { return new URL(value.includes("://") ? value : `https://${value}`).host; }
    catch { return value; }
  });

const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  "form-action 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline'",
  "connect-src 'self' https:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
].join("; ");

const securityHeaders = [
  { key: "X-DNS-Prefetch-Control", value: "on" },
  ...(isProduction ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }] : []),
  { key: "X-XSS-Protection", value: "0" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(self), payment=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
  { key: "Origin-Agent-Cluster", value: "?1" },
  { key: "Content-Security-Policy", value: csp },
];

const nextConfig: NextConfig = {
  // Next 16.3.x + Vercel's build adapter does not emit the root NFT files that
  // standalone packaging expects. Vercel does not consume the standalone output,
  // so retain it only for Docker/self-hosted builds.
  output: process.env.VERCEL ? undefined : "standalone",
  poweredByHeader: false,
  compress: true,
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
  experimental: {
    serverActions: {
      allowedOrigins: configuredOrigins,
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
