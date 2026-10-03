import { describe, expect, it } from "vitest";
import { isPublicPath } from "@/lib/site/public-routes";

describe("isPublicPath", () => {
  it("recognizes marketing landing pages as public routes", () => {
    expect(isPublicPath("/")).toBe(true);
    expect(isPublicPath("/beta")).toBe(true);
    expect(isPublicPath("/contact")).toBe(true);
    expect(isPublicPath("/privacy")).toBe(true);
    expect(isPublicPath("/terms")).toBe(true);
    expect(isPublicPath("/blog")).toBe(true);
    expect(isPublicPath("/blog/welcome")).toBe(true);
  });

  it("recognizes guide pages as public routes so they render in light theme", () => {
    expect(isPublicPath("/guides")).toBe(true);
    expect(isPublicPath("/guides/hire-an-agent")).toBe(true);
    expect(isPublicPath("/guides/personal-space")).toBe(true);
  });

  it("recognizes auth pages as public routes", () => {
    expect(isPublicPath("/login")).toBe(true);
    expect(isPublicPath("/signup")).toBe(true);
    expect(isPublicPath("/forgot-password")).toBe(true);
    expect(isPublicPath("/reset-password")).toBe(true);
    expect(isPublicPath("/unsubscribe")).toBe(true);
  });

  it("does not treat app internal routes as public", () => {
    expect(isPublicPath("/p/project-slug/roster")).toBe(false);
    expect(isPublicPath("/p/project-slug/work")).toBe(false);
    expect(isPublicPath("/c/agent-id")).toBe(false);
  });

  it("handles empty or null paths safely", () => {
    expect(isPublicPath("")).toBe(false);
    expect(isPublicPath(null)).toBe(false);
    expect(isPublicPath(undefined)).toBe(false);
  });
});
