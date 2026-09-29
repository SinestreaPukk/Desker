/**
 * The guides are content, so these tests are mostly about the promises made
 * about them: one source, two-minute reads, and every contextual "?" in the
 * product pointing at a heading that actually exists.
 */
import { describe, expect, it } from "vitest";
import {
  GUIDES,
  HELP_TOPICS,
  PERSONAL_HELP_TOPICS,
  guideBySlug,
  guidesFor,
  headingId,
  plainText,
  searchGuides,
  sectionById,
  splitSections,
} from "@/lib/guides";

/** 400 words is about two minutes at a normal reading speed. */
const TWO_MINUTES = 500;

describe("the guides themselves", () => {
  it("covers the tasks an owner gets stuck on", () => {
    const slugs = GUIDES.map((guide) => guide.slug);
    for (const expected of [
      "hire-an-agent",
      "project-context",
      "scope-of-work",
      "approvals",
      "insights",
      "integrations",
      "personal-space",
      "about-you",
      "personal-routines",
      "money-manager",
      "personal-privacy",
    ]) {
      expect(slugs).toContain(expected);
    }
  });

  it("gives a personal space its own tutorial, free of business setup", () => {
    const personal = guidesFor("personal");
    const business = guidesFor("business");
    expect(personal.map((g) => g.slug)).toContain("personal-space");
    expect(personal.map((g) => g.slug)).not.toContain("hire-an-agent");
    expect(business.map((g) => g.slug)).not.toContain("personal-space");
    for (const guide of personal.filter((g) => g.audience === "personal")) {
      const text = plainText(guide.body).toLowerCase();
      for (const word of ["job title", "company context", "organisation", "hire"]) {
        expect(text, `${guide.slug} mentions "${word}"`).not.toContain(word);
      }
    }
  });

  it("stays inside a two-minute read", () => {
    for (const guide of GUIDES) {
      expect(guide.wordCount, `${guide.slug} is too long`).toBeLessThanOrEqual(TWO_MINUTES);
      expect(guide.wordCount).toBeGreaterThan(120);
      expect(guide.minutes).toBeLessThanOrEqual(2);
    }
  });

  it("has a unique slug, a summary and headings to link to", () => {
    expect(new Set(GUIDES.map((guide) => guide.slug)).size).toBe(GUIDES.length);
    for (const guide of GUIDES) {
      expect(guide.title.length).toBeGreaterThan(5);
      expect(guide.summary.length).toBeGreaterThan(20);
      expect(guide.sections.length).toBeGreaterThanOrEqual(3);
      expect(new Set(guide.sections.map((section) => section.id)).size).toBe(guide.sections.length);
    }
  });

  it("is written as how-to, not as a feature tour", () => {
    for (const guide of GUIDES) {
      const text = plainText(guide.body).toLowerCase();
      // The words a tour uses about itself.
      expect(text).not.toContain("in this guide we will");
      expect(text).not.toContain("welcome to");
    }
  });
});

describe("splitting a body into sections", () => {
  it("keeps the intro apart and takes ## as the boundary", () => {
    const { intro, sections } = splitSections(
      "Opening line.\n\n## First thing\n\nBody one.\n\n### Deeper\n\nStill one.\n\n## Second thing\n\nBody two.",
    );
    expect(intro).toBe("Opening line.");
    expect(sections.map((section) => section.heading)).toEqual(["First thing", "Second thing"]);
    // A deeper heading belongs to the section it sits in, not its own.
    expect(sections[0]!.body).toContain("### Deeper");
    expect(sections[1]!.body).toBe("Body two.");
  });

  it("gives every heading an anchor a link can use", () => {
    expect(headingId("Extending trust")).toBe("extending-trust");
    expect(headingId("View as flow")).toBe("view-as-flow");
    expect(headingId("Keys & secrets!")).toBe("keys-secrets");
  });
});

describe("the contextual links", () => {
  it("every one points at a guide and a heading that exist, in both kinds of space", () => {
    for (const [topic, target] of [...Object.entries(HELP_TOPICS), ...Object.entries(PERSONAL_HELP_TOPICS)]) {
      const guide = guideBySlug(target.slug);
      expect(guide, `${topic} points at a missing guide`).not.toBeNull();
      expect(
        sectionById(guide!, target.section),
        `${topic} points at a missing heading: ${target.section}`,
      ).not.toBeNull();
    }
  });
});

describe("searching the guides", () => {
  it("finds the guide by its subject and opens it at the right heading", () => {
    const [top] = searchGuides("escalation");
    expect(top?.guide.slug).toBe("approvals");
    expect(top?.section?.id).toBe("escalation-rules");
    expect(top?.snippet.toLowerCase()).toContain("escalat");
  });

  it("ranks a title hit above a passing mention", () => {
    const results = searchGuides("insights");
    expect(results[0]?.guide.slug).toBe("insights");
  });

  it("matches the words on the screen, not just our headings", () => {
    expect(searchGuides("webhook").map((match) => match.guide.slug)).toContain("integrations");
    expect(searchGuides("draft only").length).toBeGreaterThan(0);
  });

  it("returns nothing for an empty or one-character query", () => {
    expect(searchGuides("")).toEqual([]);
    expect(searchGuides("  ")).toEqual([]);
    expect(searchGuides("a")).toEqual([]);
  });

  it("returns nothing rather than everything when there is no match", () => {
    expect(searchGuides("kubernetes helm chart")).toEqual([]);
  });
});

describe("markdown, stripped for matching", () => {
  it("drops the syntax and keeps the words", () => {
    expect(plainText("**Bold** and `code` and [a link](/somewhere)")).toBe(
      "Bold and code and a link",
    );
  });
});
