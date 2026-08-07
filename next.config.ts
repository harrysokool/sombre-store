import type { NextConfig } from "next";
import type { RemotePattern } from "next/dist/shared/lib/image-config";

// Baseline, framework-agnostic security headers applied to every response.
// Intentionally excludes Content-Security-Policy and Strict-Transport-Security
// for now: CSP needs per-app tuning, and HSTS waits until the production HTTPS
// domain is live. When CSP does arrive, img-src will need the Supabase host
// derived below.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "no-referrer" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

// Only the public object endpoint of the product image bucket. Anything else on
// the Supabase host — another bucket, the REST API, a signed URL endpoint — is
// deliberately excluded.
const PRODUCT_IMAGE_PATHNAME = "/storage/v1/object/public/product-images/**";

/**
 * The one remote source `next/image` may load a product image from.
 *
 * Derived from NEXT_PUBLIC_SUPABASE_URL rather than hardcoded, so the project
 * reference never appears here and every environment points at its own backend.
 * Protocol and port come from the same URL, which keeps a local Supabase stack
 * on http://127.0.0.1:54321 working without a second code path.
 *
 * Returns nothing when the variable is missing or unparseable. That fails
 * closed: no remote image is permitted, and the local paths under public/ that
 * every product uses today keep working untouched.
 */
function getSupabaseImagePatterns(): RemotePattern[] {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();

  if (!supabaseUrl) {
    return [];
  }

  let parsed: URL;

  try {
    parsed = new URL(supabaseUrl);
  } catch {
    console.warn(
      "NEXT_PUBLIC_SUPABASE_URL is not a valid URL, so no remote product images will be allowed.",
    );
    return [];
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return [];
  }

  return [
    {
      protocol: parsed.protocol === "http:" ? "http" : "https",
      hostname: parsed.hostname,
      // An empty string means "no port", which is what the hosted project uses.
      port: parsed.port,
      pathname: PRODUCT_IMAGE_PATHNAME,
    },
  ];
}

const nextConfig: NextConfig = {
  images: {
    remotePatterns: getSupabaseImagePatterns(),
    // Left off deliberately. SVG is XML that can carry script, and the upload
    // path refuses it for the same reason.
    dangerouslyAllowSVG: false,
  },
  experimental: {
    // Server Actions cap request bodies at 1 MB by default, which a 4 MB image
    // plus its multipart overhead would exceed. Every "use server" file in this
    // project lives under /admin behind the admin gate, so the wider ceiling is
    // not a public entry point.
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },
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
