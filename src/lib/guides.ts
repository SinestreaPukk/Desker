/**
 * The guides, read in two places from one source.
 *
 * `content/guides/*.ts` holds one short markdown document per task. The help
 * panel inside the app and the public /guides pages both read this module, so
 * a guide exists exactly once and the two copies cannot drift apart. Nothing
 * here touches the filesystem: the content is imported like the rest of
 * `content/`, which keeps it available to a client component (the help panel
 * searches offline) and to the static marketing pages alike.
 *
 * No server imports for the same reason.
 */
import { GUIDE_SOURCES } from "../../content/guides";

interface GuideSection {
  /** Slugified heading; the anchor a contextual link points at. */
  id: string;
  heading: string;
  /** The markdown under that heading, without the heading itself. */
  body: string;
}

export interface Guide {
  slug: string;
  title: string;
  summary: string;
  /** Rounded reading time, in minutes. Every guide is meant to be one or two. */
  minutes: number;
  body: string;
  /** The intro before the first heading, if there is one. */
  intro: string;
  sections: GuideSection[];
  wordCount: number;
}

/** A heading's anchor: lower case, words joined by hyphens. */
export function headingId(heading: string): string {
  return heading
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

function countWords(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

/** Splits a body on its `##` headings. Deeper headings stay inside a section. */
export function splitSections(body: string): { intro: string; sections: GuideSection[] } {
  const lines = body.split("\n");
  const intro: string[] = [];
  const sections: GuideSection[] = [];
  let current: { heading: string; lines: string[] } | null = null;

  for (const line of lines) {
    const match = /^##\s+(.+?)\s*$/.exec(line);
    if (match) {
      if (current) {
        sections.push({
          id: headingId(current.heading),
          heading: current.heading,
          body: current.lines.join("\n").trim(),
        });
      }
      current = { heading: match[1]!, lines: [] };
      continue;
    }
    (current ? current.lines : intro).push(line);
  }
  if (current) {
    sections.push({
      id: headingId(current.heading),
      heading: current.heading,
      body: current.lines.join("\n").trim(),
    });
  }
  return { intro: intro.join("\n").trim(), sections };
}

function toGuide(source: (typeof GUIDE_SOURCES)[number]): Guide {
  const { intro, sections } = splitSections(source.body);
  return {
    slug: source.slug,
    title: source.title,
    summary: source.summary,
    minutes: source.minutes,
    body: source.body,
    intro,
    sections,
    wordCount: countWords(source.body),
  };
}

export const GUIDES: Guide[] = GUIDE_SOURCES.map(toGuide);

export function guideBySlug(slug: string): Guide | null {
  return GUIDES.find((guide) => guide.slug === slug) ?? null;
}

export function sectionById(guide: Guide, id: string | null | undefined): GuideSection | null {
  if (!id) return null;
  return guide.sections.find((section) => section.id === id) ?? null;
}

// --- search -----------------------------------------------------------------

interface GuideMatch {
  guide: Guide;
  /** The best-matching section, when the hit was inside one. */
  section: GuideSection | null;
  /** A line from the guide with the query in it, for the result row. */
  snippet: string;
  score: number;
}

/** Markdown stripped back to the words, for matching and for snippets. */
export function plainText(markdown: string): string {
  return markdown
    .replace(/`([^`]*)`/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_>#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function snippetFor(text: string, terms: string[]): string {
  const plain = plainText(text);
  const lower = plain.toLowerCase();
  const at = terms
    .map((term) => lower.indexOf(term))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0];
  if (at === undefined) return plain.slice(0, 140);
  const start = Math.max(0, at - 60);
  const cut = plain.slice(start, start + 160).trim();
  return `${start > 0 ? "…" : ""}${cut}${start + 160 < plain.length ? "…" : ""}`;
}

/**
 * Ranked guides for a query. Title and summary hits outrank body hits, and a
 * hit inside a section carries that section so the panel can open at it
 * rather than at the top of a page the reader then has to scan.
 */
export function searchGuides(query: string, guides: Guide[] = GUIDES): GuideMatch[] {
  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length > 1);
  if (terms.length === 0) return [];

  const matches: GuideMatch[] = [];
  for (const guide of guides) {
    const title = guide.title.toLowerCase();
    const summary = guide.summary.toLowerCase();
    let score = 0;
    for (const term of terms) {
      if (title.includes(term)) score += 8;
      if (summary.includes(term)) score += 4;
    }

    let best: { section: GuideSection; score: number } | null = null;
    for (const section of guide.sections) {
      const heading = section.heading.toLowerCase();
      const body = plainText(section.body).toLowerCase();
      let sectionScore = 0;
      for (const term of terms) {
        if (heading.includes(term)) sectionScore += 5;
        if (body.includes(term)) sectionScore += 2;
      }
      if (sectionScore > 0 && (!best || sectionScore > best.score))
        best = { section, score: sectionScore };
    }
    if (best) score += best.score;

    const introHit = terms.some((term) => plainText(guide.intro).toLowerCase().includes(term));
    if (introHit) score += 1;

    if (score > 0) {
      matches.push({
        guide,
        section: best?.section ?? null,
        snippet: snippetFor(best?.section.body ?? (guide.intro || guide.summary), terms),
        score,
      });
    }
  }
  return matches.sort((a, b) => b.score - a.score || a.guide.title.localeCompare(b.guide.title));
}

// --- contextual links -------------------------------------------------------

/**
 * Where a "?" next to a control points. Named rather than typed at the call
 * site so a renamed heading breaks in one place - and so every contextual
 * link in the product can be listed and checked.
 */
export type HelpTopic =
  | "escalationRule"
  | "flowView"
  | "trust"
  | "projectContext"
  | "agentContext"
  | "draftFromDocuments"
  | "digest"
  | "webhookTrigger"
  | "integrationSecret"
  | "approvals";

export const HELP_TOPICS: Record<HelpTopic, { slug: string; section: string }> = {
  escalationRule: { slug: "approvals", section: "escalation-rules" },
  flowView: { slug: "personal-routines", section: "see-it-as-a-flow" },
  trust: { slug: "approvals", section: "extending-trust" },
  projectContext: { slug: "about-you", section: "the-four-questions" },
  agentContext: { slug: "about-you", section: "each-assistants-own-brief" },
  draftFromDocuments: { slug: "about-you", section: "draft-it-from-a-document" },
  digest: { slug: "personal-space", section: "your-two-minutes-a-day" },
  webhookTrigger: { slug: "personal-routines", section: "when-it-runs" },
  integrationSecret: { slug: "integrations", section: "keys-and-secrets" },
  approvals: { slug: "approvals", section: "your-three-options" },
};

export function helpTopic(topic: HelpTopic) {
  return HELP_TOPICS[topic];
}
