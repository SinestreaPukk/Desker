import type { MetadataRoute } from "next";
import { BRAND, TOKEN_HEX } from "@/lib/brand";
import { SITE } from "@/lib/content";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${BRAND.name} — ${SITE.company.tagline}`,
    short_name: BRAND.name,
    description: SITE.company.description,
    start_url: "/",
    display: "standalone",
    background_color: TOKEN_HEX.paper,
    theme_color: TOKEN_HEX.paper,
    icons: [
      {
        src: "/icon-48.png",
        sizes: "48x48",
        type: "image/png",
      },
      {
        src: "/icon-96.png",
        sizes: "96x96",
        type: "image/png",
      },
      {
        src: "/icon-144.png",
        sizes: "144x144",
        type: "image/png",
      },
      {
        src: "/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
