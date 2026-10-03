import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { LANDING, SITE } from "@/lib/content";
import { TOKEN_HEX } from "@/lib/brand";

export const alt = `${SITE.company.name} — ${LANDING.meta.title}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

function getLogoDataUrl() {
  try {
    const file = readFileSync(join(process.cwd(), "public/brand/desker-mark.png"));
    return `data:image/png;base64,${file.toString("base64")}`;
  } catch {
    return null;
  }
}

const logoDataUrl = getLogoDataUrl();

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
          background: `linear-gradient(135deg, ${TOKEN_HEX.paper} 0%, ${TOKEN_HEX["accent-soft"]} 100%)`,
          color: TOKEN_HEX.ink,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          {logoDataUrl ? (
            <img
              src={logoDataUrl}
              alt=""
              width="56"
              height="56"
              style={{ width: 56, height: 56, objectFit: "contain" }}
            />
          ) : (
            <div style={{ width: 56, height: 56, borderRadius: 28, background: "#B4D0ED" }} />
          )}
          <div style={{ fontSize: 34, fontWeight: 700 }}>{SITE.company.name}</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 60, fontWeight: 700, lineHeight: 1.1, letterSpacing: -1.5, maxWidth: 1000 }}>
            {LANDING.hero.headline}
          </div>
          <div style={{ fontSize: 28, color: TOKEN_HEX["ink-muted"], maxWidth: 960, lineHeight: 1.35 }}>{LANDING.meta.description}</div>
        </div>
        <div style={{ fontSize: 22, color: TOKEN_HEX["ink-subtle"] }}>{SITE.company.siteUrl.replace(/^https?:\/\//, "")}</div>
      </div>
    ),
    size,
  );
}
