import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The type scale in globals.css resets Tailwind's sizes, so a removed step
 * like `text-2xl` silently does nothing and an arbitrary `text-[10px]` walks
 * around the scale. Both happened; this keeps them from coming back.
 */
const ALLOWED = new Set(["meta", "xs", "sm", "base", "lg", "xl", "large-title", "display", "hero", "title"]);

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : path.endsWith(".tsx") ? [path] : [];
  });
}

describe("type scale", () => {
  it("uses only sizes the scale defines", () => {
    const offenders: string[] = [];
    for (const path of files("src")) {
      const source = readFileSync(path, "utf8");
      for (const match of source.matchAll(/(?<![\w-])(?:[a-z0-9]+:)*text-(\[\d[^\]]*\]|\d?xl|2xs)(?![\w-])/g)) {
        const step = match[1]!;
        // Relative sizes (inline code at 0.85em) scale with the text around them, which is on the scale.
        const relative = /^\[[\d.]+em\]$/.test(step);
        if (!ALLOWED.has(step) && !relative) offenders.push(`${path}: text-${step}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
