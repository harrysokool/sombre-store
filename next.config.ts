import type { NextConfig } from "next";

// Baseline, framework-agnostic security headers applied to every response.
// Intentionally excludes Content-Security-Policy and Strict-Transport-Security
// for now: CSP needs per-app tuning, and HSTS waits until the production HTTPS
// domain is live.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "no-referrer" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        // Matches every route, including the root path.
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
