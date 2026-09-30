import { describe, expect, it } from "vitest";
import { POST_CATEGORIES, type PostCategory } from "@/lib/post-types";

describe("post categories", () => {
  it("defines the required categories: blog, patch_notes, announcement, news", () => {
    const required: PostCategory[] = ["blog", "patch_notes", "announcement", "news"];
    for (const cat of required) {
      expect(POST_CATEGORIES[cat]).toBeDefined();
      expect(POST_CATEGORIES[cat].label).toBeTruthy();
      expect(POST_CATEGORIES[cat].description).toBeTruthy();
      expect(POST_CATEGORIES[cat].badgeClass).toBeTruthy();
    }
  });

  it("has distinct labels for each category", () => {
    const labels = Object.values(POST_CATEGORIES).map((c) => c.label);
    const unique = new Set(labels);
    expect(unique.size).toBe(labels.length);
  });
});
