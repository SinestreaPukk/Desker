/**
 * The public site's content, read from /content and validated once.
 *
 * A typo in a key or a missing field fails here with the file and the field
 * named, at build time - a content editor sees "landing.json: hero.headline
 * is required", never a blank hero in production.
 */
import { z } from "zod";
import { BRAND_LOGO_IDS } from "@/components/marketing/brand-logos";
import site from "../../content/site.json";
import landing from "../../content/landing.json";
import showcase from "../../content/showcase.json";
import contact from "../../content/contact.json";
import templates from "../../content/templates.json";
import { PLAN_IDS } from "@/lib/billing/plans";
import { TOOL_IDS } from "@/lib/tools/registry";
import { WORK_TOOL_IDS } from "@/lib/work/tools";
import { SPACE_KINDS, type SpaceKind } from "@/lib/space";

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
  nav: z.array(link).max(6),
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

/** Glyphs the landing page may put beside a point. A closed set, so a new one is a decision. */
/** The screenshots in public/product, written by scripts/product-shots.mjs. */
export const PRODUCT_SHOTS = ["approval", "boundaries", "handoff-thread", "activity"] as const;

export const LANDING_ICONS = [
  "upload",
  "calendar",
  "approve",
  "draft",
  "person",
  "source",
  "log",
  "lock",
  "handoff",
] as const;

/** Section heading pattern used by every landing section: eyebrow, heading, intro. */
const sectionHead = {
  eyebrow: z.string().min(1).max(32),
  heading: z.string().min(1).max(64),
  intro: z.string().max(200).optional(),
};

const landingSchema = z.object({
  meta,
  hero: z.object({
    headline: z.string().min(1).max(60),
    subhead: z.string().max(200),
    primaryCta: link,
    secondaryCta: link,
    /** One line of reassurance under the buttons. */
    microcopy: z.string().max(90),
  }),
  /** "Built on" facts: the model providers, with their marks. */
  trustStrip: z.object({
    label: z.string(),
    items: z
      .array(z.object({ name: z.string().min(1).max(40), logo: z.enum(BRAND_LOGO_IDS).optional() }))
      .min(1)
      .max(6),
  }),
  /** Business and personal, side by side: the two things Desker is for. */
  desks: z.object({
    ...sectionHead,
    business: z.object({
      label: z.string().min(1).max(32),
      title: z.string().min(1).max(64),
      body: z.string().min(1).max(200),
      points: z.array(z.string().min(1).max(80)).min(2).max(4),
    }),
    personal: z.object({
      label: z.string().min(1).max(32),
      title: z.string().min(1).max(64),
      body: z.string().min(1).max(200),
      points: z.array(z.string().min(1).max(80)).min(2).max(4),
    }),
    /** The one line between them: what never crosses. */
    wall: z.string().min(1).max(120),
  }),
  steps: z.object({
    ...sectionHead,
    items: z
      .array(z.object({ icon: z.enum(LANDING_ICONS), title: z.string().min(1).max(40), body: z.string().min(1).max(120) }))
      .length(3),
  }),
  features: z.object({
    ...sectionHead,
    items: z
      .array(
        z.object({
          /** Short label above the title, e.g. the agent and role. */
          label: z.string().min(1).max(32),
          title: z.string().min(1).max(64),
          body: z.string().min(1).max(200),
          /** Which piece of the product the tile shows. */
          demo: z.enum(["support", "marketer", "researcher", "sales", "assistant", "approval", "money", "life"]),
        }),
      )
      .min(2)
      .max(8),
  }),
  trust: z.object({
    ...sectionHead,
    /** Real screenshots of the product (scripts/product-shots.mjs), not mock-ups. */
    shots: z
      .array(
        z.object({
          image: z.enum(PRODUCT_SHOTS),
          title: z.string().min(1).max(48),
          body: z.string().min(1).max(160),
        }),
      )
      .min(1)
      .max(4),
    items: z
      .array(z.object({ icon: z.enum(LANDING_ICONS), title: z.string().min(1).max(48), body: z.string().min(1).max(160) }))
      .min(3)
      .max(8),
  }),
  roles: z.object({
    ...sectionHead,
    cta: z.string().min(1).max(24),
    /** Headings over each audience's roles. */
    groups: z.object({ business: z.string().min(1).max(32), personal: z.string().min(1).max(32) }),
  }),
  comparison: z
    .object({
      ...sectionHead,
      competitorLabel: z.string().min(1).max(48),
      deskerLabel: z.string().min(1).max(48),
      items: z
        .array(
          z.object({
            dimension: z.string().min(1).max(48),
            generic: z.string().min(1).max(140),
            desker: z.string().min(1).max(140),
          }),
        )
        .min(3)
        .max(8),
    })
    .optional(),
  /** Real quotes only. Hidden until enabled with at least one item. */
  testimonials: z.object({
    enabled: z.boolean(),
    ...sectionHead,
    items: z.array(z.object({ quote: z.string().min(1), name: z.string().min(1), title: z.string().min(1) })),
  }),
  pricing: z.object({
    /** Off while there is nothing to buy yet: the section and its links are hidden. */
    enabled: z.boolean(),
    ...sectionHead,
    /** Which tier carries the emphasis. A decision, so it is written down. */
    popularPlan: z.enum(PLAN_IDS),
    popularLabel: z.string().min(1).max(24),
    footnote: z.string(),
    /** Under the cards, where the reader is deciding: the money reassurance. */
    reassurance: z.string().max(140).optional(),
    /** One real screenshot beside the plans: what every plan is watched by. */
    proof: z.object({ image: z.enum(PRODUCT_SHOTS), caption: z.string().min(1).max(160) }).optional(),
  }),
  faq: z.object({
    ...sectionHead,
    items: z.array(z.object({ q: z.string().min(1), a: z.string().min(1) })).min(3).max(12),
  }),
  cta: z.object({
    heading: z.string(),
    body: z.string(),
    button: link,
    secondary: link.optional(),
    microcopy: z.string().max(90).optional(),
  }),
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
    company: z.string(),
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
  "headset",
  "route",
  "search",
  "megaphone",
  "calendar",
  "code",
  "handshake",
  "users",
  "sparkles",
  "life-buoy",
  "compass",
  "file-search",
  "trending-up",
  "briefcase",
  "terminal",
  "target",
  "heart-handshake",
  // Personal roles
  "wallet",
  "calendar-heart",
  "at-sign",
  "rocket",
  "plane",
  "graduation-cap",
] as const;

const templateSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  /** Which kind of space hires this role: a business, or one person for their own life. */
  audience: z.enum(SPACE_KINDS).default("business"),
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

/** The roles a space of this kind can hire. */
export function templatesFor(kind: SpaceKind): AgentTemplate[] {
  return TEMPLATES.filter((t) => t.audience === kind);
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
