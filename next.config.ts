import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  // Produces .next/standalone for a small production container image. Vercel
  // builds its own serverless output and breaks on standalone mode, so it is
  // skipped there - Vercel sets the VERCEL variable during builds.
  ...(process.env.VERCEL ? {} : { output: "standalone" as const }),
  reactStrictMode: true,
  serverExternalPackages: ["pdf-parse", "mammoth"],
  outputFileTracingIncludes: {
    "/api/**": ["./node_modules/.prisma/client/**"],
  },
  async redirects() {
    // One address: www.desker.dev forwards to desker.dev, path and all.
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.desker.dev" }],
        destination: "https://desker.dev/:path*",
        permanent: true,
      },
    ];
  },
  async headers() {
    // Defence in depth: nothing here is meant to be framed or called cross-origin.
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "off" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
          { key: "X-Frame-Options", value: "DENY" },
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
