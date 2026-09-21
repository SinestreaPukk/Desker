import type { MetadataRoute } from "next";
import { absoluteUrl } from "@/lib/content";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // The product itself is private; only the public site is for crawlers.
      { userAgent: "*", allow: ["/", "/showcase", "/contact", "/terms", "/privacy"], disallow: ["/p/", "/api/", "/c/", "/embed/", "/invite/", "/login", "/signup"] },
    ],
    sitemap: absoluteUrl("/sitemap.xml"),
  };
}
