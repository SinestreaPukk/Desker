import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/content";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // The product itself is private; only the public site is for crawlers.
      { userAgent: "*", allow: ["/", "/beta", "/contact", "/terms", "/privacy"], disallow: ["/p/", "/api/", "/login", "/signup"] },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
