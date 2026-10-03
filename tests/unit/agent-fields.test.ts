import { describe, expect, it } from "vitest";
import {
  RANDOM_AGENT_NAMES,
  randomAgentName,
  parseLines,
  toStringArray,
} from "@/lib/agents/agent-fields";

describe("agent-fields", () => {
  it("includes all 29 curated random agent names without duplicates", () => {
    const expectedNames = [
      "Bright",
      "Moon",
      "John",
      "Purk",
      "Grace",
      "Vann",
      "Tim",
      "Sunny",
      "Jay",
      "Ken",
      "Haley",
      "Sofia",
      "Beep",
      "Rory",
      "Bryson",
      "Dustin",
      "James",
      "Tom",
      "Kevin",
      "Lindsay",
      "Cindy",
      "Nico",
      "Gebby",
      "Charles",
      "Max",
      "Christopher",
      "Nelly",
      "Patrick",
      "Jane",
    ];

    expect(RANDOM_AGENT_NAMES).toHaveLength(29);
    expect([...RANDOM_AGENT_NAMES]).toEqual(expectedNames);
    const unique = new Set(RANDOM_AGENT_NAMES);
    expect(unique.size).toBe(29);
  });

  it("randomAgentName returns a valid name from the curated list", () => {
    for (let i = 0; i < 50; i++) {
      const name = randomAgentName();
      expect(RANDOM_AGENT_NAMES).toContain(name);
    }
  });

  it("parseLines and toStringArray handle empty and multi-line inputs", () => {
    expect(parseLines("• First\n- Second\nThird")).toEqual([
      "First",
      "Second",
      "Third",
    ]);
    expect(parseLines("")).toEqual([]);

    expect(toStringArray(["a", "b", " ", 123, null])).toEqual(["a", "b"]);
    expect(toStringArray(null)).toEqual([]);
  });
});
