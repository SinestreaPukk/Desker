import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // Produces .next/standalone for a small production container image. Vercel
  // builds its own serverless output and breaks on standalone mode, so it is
  // skipped there - Vercel sets the VERCEL variable during builds.
  ...(process.env.VERCEL ? {} : { output: "standalone" as const }),
  outputFileTracingIncludes: {
    "/api/**": ["./node_modules/.prisma/client/**"],
  },
  async headers() {
    // Defence in depth for the admin app. The embed routes are exempt from
    // the frame rule below because being framed is their whole purpose.
    const baseline = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-DNS-Prefetch-Control", value: "off" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
      { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
    ];
    return [
      {
        // Everything except the embeddable widget and its loader.
        source: "/((?!embed/|embed\\.js).*)",
        headers: [...baseline, { key: "X-Frame-Options", value: "DENY" }],
      },
      {
        // The embed loader is fetched cross-origin by third-party sites.
        source: "/embed.js",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Cache-Control", value: "public, max-age=300" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
      {
        // The widget iframe must be embeddable anywhere; the admin app must not.
        source: "/embed/:agentId",
        headers: [{ key: "Content-Security-Policy", value: "frame-ancestors *" }],
      },
      {
        source: "/api/chat/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type" },
          { key: "Access-Control-Allow-Methods", value: "GET,POST,OPTIONS" },
        ],
      },
    ];
  },
};

// Source maps are uploaded only when a Sentry auth token is present (CI /
// Vercel); locally the wrapper is inert apart from injecting the client init.
export default withSentryConfig(nextConfig, {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  widenClientFileUpload: true,
  disableLogger: true,
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
});
