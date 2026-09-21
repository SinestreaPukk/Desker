import { ImageResponse } from "next/og";
import { LANDING, SITE } from "@/lib/content";
import { BRAND } from "@/lib/brand";

export const alt = `${SITE.company.name} — ${LANDING.meta.title}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The preview card a shared link renders. Built from the same content file as the page. */
export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "linear-gradient(135deg, #fafaff 0%, #ecebff 100%)",
          color: "#1a1a2e",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: BRAND.color, display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: 36, fontWeight: 700 }}>
            d
          </div>
          <div style={{ fontSize: 34, fontWeight: 700 }}>{SITE.company.name}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 60, fontWeight: 700, lineHeight: 1.1, letterSpacing: -1.5, maxWidth: 1000 }}>
            {LANDING.hero.headline}
          </div>
          <div style={{ fontSize: 28, color: "#4a4a63", maxWidth: 960, lineHeight: 1.35 }}>{LANDING.meta.description}</div>
        </div>
        <div style={{ fontSize: 22, color: "#7a7a90" }}>{SITE.company.siteUrl.replace(/^https?:\/\//, "")}</div>
      </div>
    ),
    size,
  );
}
