import { describe, expect, it } from "vitest";
import { CORE_TOOLS, enabledAbilities, toolsFor } from "@/lib/agents/abilities";

describe("abilities", () => {
  it("always keeps the core tools, and only the chosen groups on top", () => {
    const tools = toolsFor(new Set(["web", "calendar"]));
    expect(tools).toEqual(expect.arrayContaining([...CORE_TOOLS, "web_research", "calendar_create_event"]));
    expect(tools).not.toContain("send_email");
    expect(toolsFor(new Set())).toEqual([...CORE_TOOLS]);
  });

  it("reads a stored list back, and treats null as everything", () => {
    expect([...enabledAbilities(toolsFor(new Set(["email", "money"])))].sort()).toEqual(["email", "money"]);
    expect(enabledAbilities(null).size).toBeGreaterThan(5);
  });
});

describe("defaults", () => {
  it("start with only what needs no connected app", async () => {
    const { defaultAbilities, ABILITIES } = await import("@/lib/agents/abilities");
    const on = defaultAbilities();
    expect(on.has("web")).toBe(true);
    expect(on.has("email")).toBe(false);
    expect([...on].every((id) => !ABILITIES.find((a) => a.id === id)!.needs)).toBe(true);
  });
});
