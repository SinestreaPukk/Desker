#!/usr/bin/env node
/**
 * Derives the brand assets from the source artwork (Desker.png).
 *
 * Produces alpha-only PNGs: every ink pixel becomes opaque black, the white
 * page becomes transparent. The app then paints them with CSS `mask-image`
 * plus a themed `background-color`, so one asset renders in any colour and the
 * light and dark themes cannot drift apart the way two exported PNGs would.
 *
 *   node scripts/make-brand-assets.mjs
 */
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
mkdirSync(join(root, "public", "brand"), { recursive: true });

// Delegates the pixel work to Python/Pillow, which is present on any machine
// that can run the rest of the toolchain and avoids adding an image dependency
// to the app itself.
const script = `
import sys
from PIL import Image
import numpy as np

src = Image.open(sys.argv[1]).convert("RGB")
a = np.asarray(src).astype(int)

# Coverage: 0 on the white page, 1 on solid ink, fractional on the antialiased
# edge - so the mask keeps the curve quality of the original artwork.
lum = a.sum(axis=2) / 765.0
alpha = np.clip((1.0 - lum) / 0.92, 0.0, 1.0)

def emit(box, out, pad_ratio=0.0, square=False, source=None):
    x0, y0, x1, y1 = box
    crop = (alpha if source is None else source)[y0:y1, x0:x1]
    h, w = crop.shape
    if square:
        side = max(h, w)
        canvas = np.zeros((side, side))
        canvas[(side - h) // 2:(side - h) // 2 + h, (side - w) // 2:(side - w) // 2 + w] = crop
        crop = canvas
        h = w = side
    if pad_ratio:
        pad = int(round(max(h, w) * pad_ratio))
        padded = np.zeros((h + pad * 2, w + pad * 2))
        padded[pad:pad + h, pad:pad + w] = crop
        crop = padded
    img = Image.fromarray((crop * 255).astype("uint8"), mode="L")
    rgba = Image.new("RGBA", img.size, (0, 0, 0, 255))
    rgba.putalpha(img)
    rgba.save(out)
    print(f"  {out}  {img.size[0]}x{img.size[1]}")

# The 'd' is isolated by connected component rather than by a measured column:
# the wordmark is tightly kerned, so any vertical cut through it also clips the
# neighbouring 'e' and the tagline beneath. The 'd' owns the topmost ink pixel
# because its ascender is the tallest thing in the artwork.
from scipy import ndimage

solid = alpha > 0.5
labels, _ = ndimage.label(solid)
ys, xs = np.nonzero(solid)
top = ys.min()
mark = labels == labels[top, xs[ys == top][0]]
my, mx = np.nonzero(mark)

# Mask the mark crop to that component alone, so the neighbouring glyphs that
# fall inside its bounding box are not carried along.
isolated = np.where(mark, alpha, 0.0)
emit((mx.min(), my.min(), mx.max() + 1, my.max() + 1), sys.argv[2],
     pad_ratio=0.08, square=True, source=isolated)

# Full lockup: everything, exactly as drawn.
emit((xs.min(), ys.min(), xs.max() + 1, ys.max() + 1), sys.argv[3])

# Wordmark: the lockup without the tagline, for placements too small to render
# "Agentic AI Platform" legibly (it is only ~18% of the lockup height, so below
# roughly 64px it turns to mush).
#
# The tagline cannot be cropped off with a horizontal cut because the 'd'
# descends past it, so its glyphs are dropped by component instead: everything
# sitting below the baseline gap, excluding the 'd' itself.
column = solid[:, int(solid.shape[1] * 0.42):]
rows = np.nonzero(column.sum(axis=1) > 0)[0]
gap_end = None
prev = rows[0]
for y in rows[1:]:
    if y - prev > 3:
        gap_end = y
    prev = y

wordmark = alpha.copy()
if gap_end is not None:
    # Clear the whole band below the baseline gap, except the 'd', which
    # descends through it. Dilating the 'd' first keeps its antialiased edge -
    # clearing by component label alone leaves a halo of soft pixels behind,
    # because those sit below the threshold that defined the components.
    keep = ndimage.binary_dilation(mark, iterations=3)
    band = np.zeros_like(wordmark, dtype=bool)
    band[gap_end:, :] = True
    wordmark[band & ~keep] = 0.0

wy, wx = np.nonzero(wordmark > 0.01)
emit((wx.min(), wy.min(), wx.max() + 1, wy.max() + 1), sys.argv[4], source=wordmark)
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
  ],
  { stdio: "inherit" },
);
