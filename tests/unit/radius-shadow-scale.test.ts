import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * globals.css resets Tailwind's radius and shadow scales, so a removed step
 * (`rounded-xl`, `shadow-lg`) silently renders nothing: square corners and
 * missing shadows. Both happened; this keeps them from coming back.
 */
const RADIUS = new Set(["sm", "md", "lg", "panel", "full", "none"]);
const SHADOW = new Set(["xs", "sm", "md", "none"]);

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : path.endsWith(".tsx") ? [path] : [];
  });
}

describe("radius and shadow scales", () => {
  it("uses only steps the scales define", () => {
    const offenders: string[] = [];
    for (const path of files("src")) {
      const source = readFileSync(path, "utf8");
      // Only look inside string literals, where class names live; prose in comments says "rounded" too.
      for (const literal of source.matchAll(/"[^"\n]*"|`[^`]*`/g)) {
        for (const match of literal[0].matchAll(/(?<![\w-])(rounded|shadow)(?:-([trblse]{1,2}))?(?:-([a-z0-9]+))?(?![\w-])/g)) {
          const [token, kind, , step] = match;
          // shadow-<colour> utilities set a colour, not a size; flag only size names off the scale.
          if (kind === "shadow" && step && !SHADOW.has(step) && ["2xs", "lg", "xl", "2xl", "inner"].includes(step)) {
            offenders.push(`${path}: ${token}`);
          }
          if (kind === "rounded" && (!step || !RADIUS.has(step))) offenders.push(`${path}: ${token}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
