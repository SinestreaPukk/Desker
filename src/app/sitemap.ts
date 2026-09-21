import type { MetadataRoute } from "next";
import { TEMPLATES, absoluteUrl } from "@/lib/content";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: absoluteUrl("/"), lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: absoluteUrl("/showcase"), lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    ...TEMPLATES.map((t) => ({ url: absoluteUrl(`/showcase#${t.id}`), lastModified: now, priority: 0.6 })),
    { url: absoluteUrl("/contact"), lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: absoluteUrl("/terms"), lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    { url: absoluteUrl("/privacy"), lastModified: now, changeFrequency: "yearly", priority: 0.2 },
  ];
}
