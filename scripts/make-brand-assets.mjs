#!/usr/bin/env node
/**
 * Derives the brand assets from the source artwork (Desker.png):
 * Removes background, centers the circular mascot, and creates:
 * - public/brand/desker-mark.png (1024x1024 transparent RGBA)
 * - public/brand/desker-mark.svg (vector wrapper)
 * - public/brand/desker-lockup.png (mascot + Desker wordmark)
 * - public/brand/desker-wordmark.png (wordmark)
 *
 *   node scripts/make-brand-assets.mjs
 */
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
mkdirSync(join(root, "public", "brand"), { recursive: true });

const script = `
import sys
import base64
from PIL import Image, ImageDraw, ImageFont
import numpy as np

src_path = sys.argv[1]
mark_out = sys.argv[2]
lockup_out = sys.argv[3]
wordmark_out = sys.argv[4]
svg_out = sys.argv[5]

img = Image.open(src_path)
arr = np.array(img).astype(float)

# Circle centroid and radius
cx, cy = 978.18, 993.20
R = 953.0
pad = 15
side = int(2 * (R + pad))
half = side / 2.0

y_coords = np.arange(side) - half
x_coords = np.arange(side) - half
X, Y = np.meshgrid(x_coords, y_coords)
dist = np.sqrt(X**2 + Y**2)

src_x = np.clip(np.round(X + cx).astype(int), 0, arr.shape[1] - 1)
src_y = np.clip(np.round(Y + cy).astype(int), 0, arr.shape[0] - 1)

cropped_rgb = arr[src_y, src_x, :3]

# Anti-aliased alpha
edge_width = 1.6
alpha = np.clip((R + edge_width / 2.0 - dist) / edge_width, 0.0, 1.0)

# Matting to remove white halo
fg_rgb = np.zeros_like(cropped_rgb)
for c in range(3):
    fg_rgb[:, :, c] = np.where(alpha > 0.01, np.clip((cropped_rgb[:, :, c] - (1.0 - alpha) * 254.0) / np.maximum(alpha, 0.01), 0, 255), 0)

rgba = np.dstack([fg_rgb, alpha * 255]).astype("uint8")
full_mark = Image.fromarray(rgba, mode="RGBA")

# 1. desker-mark.png (1024x1024)
mark_1024 = full_mark.resize((1024, 1024), Image.LANCZOS)
mark_1024.save(mark_out, optimize=True)
print(f"  {mark_out}  1024x1024")

# 2. SVG
with open(mark_out, "rb") as f:
    b64 = base64.b64encode(f.read()).decode("utf-8")
with open(svg_out, "w") as f:
    f.write(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="100%" height="100%"><image href="data:image/png;base64,{b64}" width="1024" height="1024" /></svg>')
print(f"  {svg_out}")

# 3. desker-lockup.png (1734x722)
lockup = Image.new("RGBA", (1734, 722), (0, 0, 0, 0))
mark_h = 560
mark_w = 560
mark_resized = mark_1024.resize((mark_w, mark_h), Image.LANCZOS)
lockup.alpha_composite(mark_resized, (70, (722 - mark_h) // 2))

draw = ImageDraw.Draw(lockup)
try:
    font_title = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 240)
    font_sub = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 68)
except Exception:
    font_title = ImageFont.load_default()
    font_sub = ImageFont.load_default()

ink = (30, 42, 69, 255)
ink_muted = (86, 98, 122, 255)

text_x = 700
text_y = 145
draw.text((text_x, text_y), "Desker", font=font_title, fill=ink)
draw.text((text_x + 8, text_y + 280), "Agentic AI Platform", font=font_sub, fill=ink_muted)
lockup.save(lockup_out, optimize=True)
print(f"  {lockup_out}  1734x722")

# 4. desker-wordmark.png (1616x720)
wordmark = Image.new("RGBA", (1616, 720), (0, 0, 0, 0))
mark_size = 520
mark_wordmark = mark_1024.resize((mark_size, mark_size), Image.LANCZOS)
wordmark.alpha_composite(mark_wordmark, (60, (720 - mark_size) // 2))
draw_wm = ImageDraw.Draw(wordmark)
try:
    font_wm = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 260)
except Exception:
    font_wm = ImageFont.load_default()
draw_wm.text((650, (720 - 260) // 2 - 30), "Desker", font=font_wm, fill=ink)
wordmark.save(wordmark_out, optimize=True)
print(f"  {wordmark_out}  1616x720")
`;

console.log("brand assets:");
execFileSync(
  "python3",
  [
    "-c",
    script,
    join(root, "Desker.png"),
    join(root, "public", "brand", "desker-mark.png"),
    join(root, "public", "brand", "desker-lockup.png"),
    join(root, "public", "brand", "desker-wordmark.png"),
    join(root, "public", "brand", "desker-mark.svg"),
  ],
  { stdio: "inherit" },
);
