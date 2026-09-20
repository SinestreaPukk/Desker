#!/usr/bin/env node
/**
 * Renders the desktop/app icon from the brand artwork.
 *
 * Composites the `d` mark, knocked out in white, onto a rounded square of the
 * brand indigo. Derived from public/brand/desker-mark.png rather than redrawn,
 * so the icon cannot drift away from the logo.
 *
 *   node scripts/make-icon.mjs [size] [outfile]
 */
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const size = Number(process.argv[2] ?? 1024);
const out = process.argv[3] ?? join(root, "src-tauri", "icons", "icon.png");
mkdirSync(dirname(out), { recursive: true });

const script = `
import sys
import numpy as np
from PIL import Image, ImageDraw

size = int(sys.argv[1])
mark_path, out = sys.argv[2], sys.argv[3]

BRAND = (0x18, 0x00, 0xAD)
KNOCKOUT = (0xFA, 0xFA, 0xFF)
SS = 4  # supersample, then downscale for a clean rounded edge

canvas = Image.new("RGBA", (size * SS, size * SS), (0, 0, 0, 0))
draw = ImageDraw.Draw(canvas)

# macOS expects the mark inset from the canvas rather than bleeding to the edge.
inset = int(size * SS * 0.055)
radius = int(size * SS * 0.225)
draw.rounded_rectangle(
    [inset, inset, size * SS - inset, size * SS - inset],
    radius=radius,
    fill=BRAND + (255,),
)

# The mark asset is an alpha mask; use it to knock the glyph out of the tile.
mark = Image.open(mark_path).split()[-1]
glyph = int(size * SS * 0.58)
mark = mark.resize((glyph, glyph), Image.LANCZOS)
ink = Image.new("RGBA", (glyph, glyph), KNOCKOUT + (255,))
offset = (size * SS - glyph) // 2
canvas.paste(ink, (offset, offset), mark)

canvas.resize((size, size), Image.LANCZOS).save(out)
print(f"wrote {out} ({size}x{size})")
`;

execFileSync(
  "python3",
  [
    "-c",
    script,
    String(size),
    join(root, "public", "brand", "desker-mark.png"),
    out,
  ],
  { stdio: "inherit" },
);
