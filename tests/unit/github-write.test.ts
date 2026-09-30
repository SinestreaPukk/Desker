import { describe, expect, it } from "vitest";
import { forbiddenPath, repoName } from "@/lib/integrations/providers";

describe("GitHub write guards", () => {
  it("keeps agents out of workflow files and out of the repository", () => {
    expect(forbiddenPath(".github/workflows/ci.yml")).toBe(true);
    expect(forbiddenPath("/.github/workflows/deploy.yml")).toBe(true);
    expect(forbiddenPath("src/../../etc/passwd")).toBe(true);
    expect(forbiddenPath(".github/ISSUE_TEMPLATE/bug.md")).toBe(false);
    expect(forbiddenPath("src/app/page.tsx")).toBe(false);
  });

  it("reads a repository as owner/name and nothing else", () => {
    expect(repoName("acme/app")).toBe("acme/app");
    expect(repoName("https://github.com/acme/app.git")).toBe("acme/app");
    expect(repoName("../../etc")).toBeNull();
    expect(repoName("../etc")).toBeNull();
    expect(repoName("acme/app/issues")).toBeNull();
    expect(repoName(undefined)).toBeNull();
  });
});
