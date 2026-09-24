/**
 * The performance budget, enforced where it is cheapest to enforce: at the
 * import.
 *
 * The landing page's animation library is the single biggest optional
 * dependency in the product, and the way it ends up on an app screen is never
 * deliberate - somebody reuses a marketing component for its look, and the
 * roster quietly starts downloading Motion. These rules fail that at the
 * moment it is written rather than in a Lighthouse run three weeks later.
 *
 * The transferred-bytes budget itself lives in tests/e2e/budget.spec.ts, which
 * measures what a browser actually downloads.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC = path.resolve(__dirname, "../../src");

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return walk(full);
    return /\.(ts|tsx)$/.test(full) ? [full] : [];
  });
}

const FILES = walk(SRC).map((file) => ({
  path: path.relative(SRC, file),
  source: readFileSync(file, "utf8"),
}));

function importers(pattern: RegExp): string[] {
  return FILES.filter(({ source }) =>
    source
      .split("\n")
      .some((line) => /^\s*import\s|import\(/.test(line) && pattern.test(line)),
  ).map(({ path: file }) => file);
}

/** Everything the public site owns. Nothing else may reach into it. */
function isMarketing(file: string): boolean {
  return file.startsWith("components/marketing/") || file.startsWith("app/(marketing)/");
}

describe("the animation library stays on the public site", () => {
  it("is imported in exactly one place, and that place is lazy", () => {
    const motionImporters = importers(/from\s+["']motion(\/|["'])/);
    expect(motionImporters).toEqual(["components/marketing/motion-lazy.tsx"]);

    // And the only way in is a dynamic import, so it is its own chunk.
    const reveal = FILES.find((file) => file.path === "components/marketing/reveal.tsx")!;
    expect(reveal.source).toContain('import("./motion-lazy")');
    expect(reveal.source).not.toMatch(/^import .*motion-lazy/m);
  });

  it("is never pulled in by an app screen", () => {
    const offenders = importers(/motion-lazy|marketing\/reveal/).filter(
      (file) => !isMarketing(file),
    );
    expect(offenders, "app code must not import the landing page's motion wrappers").toEqual([]);
  });

  it("keeps the whole marketing folder out of the signed-in app", () => {
    const allowed = new Set([
      // Static SVG scenery and an icon map: no dependencies of their own, so
      // reusing them costs the app nothing.
      "marketing/night-sky.tsx",
      "marketing/template-icon.tsx",
      "marketing/glass-button.tsx",
    ]);
    const offenders = FILES.filter(
      ({ path: file }) => file.startsWith("app/(admin)/") || file === "components/admin-shell.tsx",
    ).flatMap(({ path: file, source }) => {
      const matches = [...source.matchAll(/from\s+["']@\/components\/(marketing\/[\w-]+)["']/g)];
      return matches
        .map((match) => `${match[1]}.tsx`)
        .filter((imported) => !allowed.has(imported))
        .map((imported) => `${file} imports ${imported}`);
    });
    expect(offenders).toEqual([]);
  });
});

describe("heavy server-only libraries stay on the server", () => {
  it("never reach a client component", () => {
    const heavy = /from\s+["'](pdf-parse|mammoth|@prisma\/client|stripe|@anthropic-ai\/sdk|openai)["']/;
    const offenders = FILES.filter(
      ({ source }) => source.startsWith('"use client"') && heavy.test(source),
    ).map(({ path: file }) => file);
    // Type-only imports are fine and are stripped; this catches value imports.
    expect(offenders).toEqual([]);
  });
});
