#!/usr/bin/env node
/**
 * Generates the full favicon set from the transparent mascot brand mark:
 *   node scripts/make-app-icons.mjs
 *
 * Writes:
 *   public/favicon.ico (16/32/48)
 *   public/icon.png (512)
 *   public/icon-48.png (48 - Google Search multiple of 48)
 *   public/icon-96.png (96 - Google Search multiple of 48)
 *   public/icon-144.png (144 - Google Search multiple of 48)
 *   public/icon-192.png (192 - Google Search / PWA)
 *   public/apple-icon.png (180)
 *   public/apple-touch-icon.png (180)
 */
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const script = `
import sys
from PIL import Image, ImageDraw

mark = Image.open(sys.argv[1]).convert("RGBA")
pub_dir = sys.argv[2]

# 1. Multiples of 48px square for Google Search & Web Manifest
for sz in [48, 96, 144, 192]:
    resized = mark.resize((sz, sz), Image.LANCZOS)
    resized.save(f"{pub_dir}/icon-{sz}.png", optimize=True)

# 2. 512x512 standard icon
icon_512 = mark.resize((512, 512), Image.LANCZOS)
icon_512.save(f"{pub_dir}/icon.png", optimize=True)

# 3. Apple touch icon (180x180) with rounded paper background
apple_size = 180
apple_img = Image.new("RGBA", (apple_size, apple_size), (0, 0, 0, 0))
draw = ImageDraw.Draw(apple_img)
draw.rounded_rectangle((0, 0, apple_size - 1, apple_size - 1), radius=round(apple_size * 0.22), fill=(248, 250, 253, 255))
glyph_size = round(apple_size * 0.82)
glyph = mark.resize((glyph_size, glyph_size), Image.LANCZOS)
offset = ((apple_size - glyph_size) // 2, (apple_size - glyph_size) // 2)
apple_img.alpha_composite(glyph, offset)
apple_img.save(f"{pub_dir}/apple-icon.png", optimize=True)
apple_img.save(f"{pub_dir}/apple-touch-icon.png", optimize=True)

# 4. Multi-resolution ICO (16, 32, 48)
icon_48 = mark.resize((48, 48), Image.LANCZOS)
icon_48.save(f"{pub_dir}/favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)])

print("Generated icons in public/:")
print("  public/icon-[48,96,144,192].png (Google Search multiples of 48)")
print("  public/icon.png (512)")
print("  public/apple-icon.png & public/apple-touch-icon.png (180)")
print("  public/favicon.ico (16, 32, 48)")
`;

execFileSync("python3", ["-c", script, join(root, "public/brand/desker-mark.png"), join(root, "public")], {
  stdio: "inherit",
});


