/**
 * The public site's content, read from /content and validated once.
 *
 * A typo in a key or a missing field fails here with the file and the field
 * named, at build time - a content editor sees "landing.json: hero.headline
 * is required", never a blank hero in production.
 */
import { z } from "zod";
import site from "../../content/site.json";
import landing from "../../content/landing.json";
import showcase from "../../content/showcase.json";
import contact from "../../content/contact.json";
import templates from "../../content/templates.json";
import { TOOL_IDS } from "@/lib/tools/registry";
import { WORK_TOOL_IDS } from "@/lib/work/tools";

const link = z.object({ label: z.string().min(1), href: z.string().min(1) });
const meta = z.object({ title: z.string().min(1).max(70), description: z.string().min(1).max(200) });

const siteSchema = z.object({
  company: z.object({
    name: z.string().min(1),
    legalName: z.string().min(1),
    tagline: z.string().min(1),
    description: z.string().min(1).max(300),
    email: z.string().email(),
    location: z.string(),
    siteUrl: z.string().url(),
    twitter: z.string(),
  }),
  nav: z.array(link).max(8),
  /** The header's call to action. */
  navCta: link,
  footer: z.object({
    blurb: z.string(),
    /** Heading of the column the layout fills with every role. */
    rolesHeading: z.string(),
    columns: z.array(z.object({ heading: z.string(), links: z.array(link) })).max(3),
    /** Profiles to link. Empty until the accounts exist. */
    social: z.array(link),
    legal: z.string(),
  }),
});

/** What the front door still reads: the share card and the showcase's closing call. */
const landingSchema = z.object({
  meta,
  hero: z.object({ headline: z.string().min(1).max(60) }),
  cta: z.object({ heading: z.string(), body: z.string(), button: link }),
});

const showcaseSchema = z.object({
  meta,
  heading: z.string(),
  intro: z.string(),
  exampleLabel: z.string(),
  cta: link,
});

const contactSchema = z.object({
  meta,
  heading: z.string(),
  intro: z.string(),
  form: z.object({
    name: z.string(),
    email: z.string(),
    message: z.string(),
    submit: z.string(),
    success: z.string(),
    error: z.string(),
  }),
  details: z.object({
    heading: z.string(),
    lines: z.array(z.string()),
    emailLabel: z.string(),
    hoursLabel: z.string(),
    hours: z.string(),
  }),
});

export const TEMPLATE_ICONS = [
  "wallet",
  "calendar-heart",
  "at-sign",
  "rocket",
  "plane",
  "dumbbell",
  "graduation-cap",
] as const;

const templateSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  icon: z.enum(TEMPLATE_ICONS),
  jobTitle: z.string().min(1),
  team: z.string(),
  pitch: z.string().min(1).max(220),
  /** One real run, for the showcase: what set it off, what it did, what it made. */
  work: z.object({
    trigger: z.string().min(1).max(60),
    task: z.string().min(1).max(60),
    steps: z.array(z.string().min(1).max(90)).min(2).max(4),
    output: z.object({ label: z.string().min(1).max(60), title: z.string().min(1).max(70), lines: z.array(z.string().min(1).max(90)).min(1).max(4) }),
    status: z.enum(["done", "needs_approval", "open"]),
  }),
  personality: z.string().min(10),
  welcomeMessage: z.string(),
  escalationRule: z.string(),
  responsibilities: z.array(z.string().min(1)).max(8),
  /** Further duties offered as unticked suggestions when hiring and editing. */
  moreResponsibilities: z.array(z.string().min(1).max(120)).max(8).default([]),
  allowedTools: z.array(z.enum(TOOL_IDS)),
  workTools: z.array(z.enum(WORK_TOOL_IDS)),
  /** Catalog connector ids that make this role more useful; offered, never required, when hiring. */
  suggestedIntegrations: z.array(z.string()).max(4).default([]),
  defaultObjectives: z.array(z.string().min(1)).optional(),
  defaultTriggerType: z.enum(["manual", "cron", "webhook"]).optional(),
  defaultCron: z.string().nullable().optional(),
  defaultContext: z.string().optional(),
});

const templatesSchema = z.object({ templates: z.array(templateSchema).min(1) }).superRefine((v, ctx) => {
  const ids = v.templates.map((t) => t.id);
  const dupe = ids.find((id, i) => ids.indexOf(id) !== i);
  if (dupe) ctx.addIssue({ code: "custom", message: `duplicate template id "${dupe}"` });
});

function load<T>(name: string, schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
    throw new Error(`content/${name}: ${issues}`);
  }
  return result.data;
}

export const SITE = load("site.json", siteSchema, site);
export const LANDING = load("landing.json", landingSchema, landing);
export const SHOWCASE = load("showcase.json", showcaseSchema, showcase);
export const CONTACT = load("contact.json", contactSchema, contact);
export const TEMPLATES = load("templates.json", templatesSchema, templates).templates;

export type AgentTemplate = (typeof TEMPLATES)[number];

export function templateById(id: string): AgentTemplate | undefined {
  return TEMPLATES.find((t) => t.id === id);
}

/**
 * Page metadata for a public page, from its content file. One place, so every
 * page carries the same Open Graph card: a page that spells out its own
 * `openGraph` object replaces the root's wholesale and silently loses the
 * image the shared link needs.
 */
export function pageMetadata({
  title,
  description,
  path,
  absoluteTitle = false,
}: {
  title: string;
  description: string;
  path: string;
  /** The landing page owns the whole title; other pages get the site suffix. */
  absoluteTitle?: boolean;
}) {
  const ogTitle = absoluteTitle ? title : `${title} · ${SITE.company.name}`;
  return {
    title: absoluteTitle ? { absolute: title } : title,
    description,
    alternates: { canonical: absoluteUrl(path) },
    openGraph: {
      title: ogTitle,
      description,
      url: absoluteUrl(path),
      siteName: SITE.company.name,
      type: "website" as const,
      images: [{ url: absoluteUrl("/opengraph-image"), width: 1200, height: 630, alt: ogTitle }],
    },
    twitter: { card: "summary_large_image" as const, title: ogTitle, description, images: [absoluteUrl("/opengraph-image")] },
  };
}

/** Absolute URL for metadata, from the configured site URL. */
export function absoluteUrl(path: string): string {
  return new URL(path, SITE.company.siteUrl).toString();
}
