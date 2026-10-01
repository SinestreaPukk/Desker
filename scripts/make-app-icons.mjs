#!/usr/bin/env node
/**
 * Generates the favicon set from the transparent mascot brand mark:
 *   node scripts/make-app-icons.mjs
 *
 * Writes src/app/icon.png (512), src/app/apple-icon.png (180), and src/app/favicon.ico (16/32/48)
 */
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const script = `
import sys
from PIL import Image, ImageDraw

mark = Image.open(sys.argv[1]).convert("RGBA")
out = sys.argv[2]

# 1. Favicon PNG (512x512)
icon_512 = mark.resize((512, 512), Image.LANCZOS)
icon_512.save(f"{out}/icon.png", optimize=True)

# 2. Apple touch icon (180x180) with rounded paper background
apple_size = 180
apple_img = Image.new("RGBA", (apple_size, apple_size), (0, 0, 0, 0))
draw = ImageDraw.Draw(apple_img)
draw.rounded_rectangle((0, 0, apple_size - 1, apple_size - 1), radius=round(apple_size * 0.22), fill=(248, 250, 253, 255))
glyph_size = round(apple_size * 0.82)
glyph = mark.resize((glyph_size, glyph_size), Image.LANCZOS)
offset = ((apple_size - glyph_size) // 2, (apple_size - glyph_size) // 2)
apple_img.alpha_composite(glyph, offset)
apple_img.save(f"{out}/apple-icon.png", optimize=True)

# 3. Favicon ICO (16, 32, 48)
icon_48 = mark.resize((48, 48), Image.LANCZOS)
icon_48.save(f"{out}/favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])
print("  icon.png 512  apple-icon.png 180  favicon.ico 16/32/48")
`;

execFileSync("python3", ["-c", script, join(root, "public/brand/desker-mark.png"), join(root, "src/app")], {
  stdio: "inherit",
});
