// Fails when the written requirements have drifted from the code, so docs change with the code:
//  - every src/lib/<module> appears in docs/ARCHITECTURE.md
//  - every env var the code reads appears in .env.example (or is listed as platform-provided)
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const PLATFORM = new Set(["NODE_ENV", "VERCEL", "VERCEL_ENV", "VERCEL_URL", "NEXT_RUNTIME", "CI", "PORT", "npm_package_version", "NEXT_PHASE"]);
const problems = [];

const architecture = readFileSync("docs/ARCHITECTURE.md", "utf8");
for (const entry of readdirSync("src/lib")) {
  if (statSync(join("src/lib", entry)).isDirectory() && !architecture.includes(`src/lib/${entry}`)) {
    problems.push(`docs/ARCHITECTURE.md does not mention src/lib/${entry}. Add it to the subsystem map.`);
  }
}

const example = readFileSync(".env.example", "utf8");
const used = new Map();
(function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path);
    else if (/\.(ts|tsx|mjs)$/.test(entry)) {
      for (const m of readFileSync(path, "utf8").matchAll(/process\.env\.([A-Z][A-Z0-9_]+)/g)) if (!used.has(m[1])) used.set(m[1], path);
    }
  }
})("src");
for (const [name, file] of used) {
  if (!PLATFORM.has(name) && !example.includes(name)) problems.push(`${name} is read in ${file} but missing from .env.example.`);
}

if (problems.length) {
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log("docs in sync");
