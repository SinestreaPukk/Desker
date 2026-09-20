import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Produces .next/standalone for a small production container image. Vercel
  // builds its own serverless output and breaks on standalone mode, so it is
  // skipped there - Vercel sets the VERCEL variable during builds.
  ...(process.env.VERCEL ? {} : { output: "standalone" as const }),
  outputFileTracingIncludes: {
    "/api/**": ["./node_modules/.prisma/client/**"],
  },
  async headers() {
    return [
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

export default nextConfig;
