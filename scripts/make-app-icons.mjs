#!/usr/bin/env node
/**
 * The favicon set, from the brand mark: the `d` in white on the accent, with
 * a corner radius that reads as an app icon at 16px and 180px alike.
 *
 *   node scripts/make-app-icons.mjs
 *
 * Writes src/app/icon.png (512, what browsers and Google use),
 * src/app/apple-icon.png (180) and src/app/favicon.ico (16/32/48) - Next
 * picks all three up by convention and emits the <link> tags.
 */
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const script = `
import sys
from PIL import Image, ImageDraw

mark = Image.open(sys.argv[1]).convert("RGBA")
# The source mask tops out below full opacity; stretch it so the ink is white.
alpha_src = mark.getchannel("A")
peak = max(alpha_src.getextrema()[1], 1)
alpha_src = alpha_src.point(lambda a: min(255, round(a * 255 / peak)))
accent = (24, 0, 173)  # #1800AD, the accent as drawn in the artwork

def icon(size):
    radius = round(size * 0.22)
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(img).rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=accent + (255,))
    # The mark's alpha becomes white ink, sized to leave a clear margin.
    glyph = round(size * 0.62)
    alpha = alpha_src.resize((glyph, glyph), Image.LANCZOS)
    ink = Image.new("RGBA", (glyph, glyph), (255, 255, 255, 255))
    ink.putalpha(alpha)
    offset = ((size - glyph) // 2, (size - glyph) // 2)
    img.alpha_composite(ink, offset)
    return img

out = sys.argv[2]
icon(512).save(f"{out}/icon.png")
icon(180).save(f"{out}/apple-icon.png")
icon(48).save(f"{out}/favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
print("  icon.png 512  apple-icon.png 180  favicon.ico 16/32/48")
`;

execFileSync("python3", ["-c", script, join(root, "public/brand/desker-mark.png"), join(root, "src/app")], {
  stdio: "inherit",
});
