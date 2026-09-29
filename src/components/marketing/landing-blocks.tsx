import Link from "next/link";
import Image, { type StaticImageData } from "next/image";
import approvalShot from "../../../public/product/approval.png";
import boundariesShot from "../../../public/product/boundaries.png";
import threadShot from "../../../public/product/handoff-thread.png";
import activityShot from "../../../public/product/activity.png";
import {
  ArrowRight,
  FileLock,
  Hand,
  NotebookPen,
  Quote,
  ScrollText,
  Stamp,
  CalendarClock,
  Check,
  ChevronDown,
  CircleCheckBig,
  FileUp,
  X,
} from "lucide-react";
import { LANDING_ICONS, TEMPLATES, type PRODUCT_SHOTS } from "@/lib/content";

type ProductShot = (typeof PRODUCT_SHOTS)[number];
import { StickyNote } from "@/components/marketing/desk-notes";
import { AgentAvatar } from "@/components/ui/avatar";
import { LiveApproval, LiveHandoff, LiveLimits } from "@/components/marketing/live-product";
import { PromiseDoodle, type PromiseDoodleId } from "@/components/marketing/promise-doodles";
import { BrandLogo, type BrandLogoId } from "@/components/marketing/brand-logos";
import { cn } from "@/lib/utils";

/**
 * The parts of the landing page that are pure markup and CSS: the steps, the trust grid, the roles, the numbers and the FAQ. No
 * client code, so they read identically to a crawler and to a browser with
 * scripts off.
 */

/* --- Icons ------------------------------------------------------------------ */

const ICONS: Record<(typeof LANDING_ICONS)[number], React.ComponentType<{ className?: string }>> = {
  upload: FileUp,
  calendar: CalendarClock,
  approve: CircleCheckBig,
  // The promises, each as the thing itself: a draft in a notebook, the
  // owner's stamp, a quotation, the record, a locked file, a raised hand.
  draft: NotebookPen,
  person: Stamp,
  source: Quote,
  log: ScrollText,
  lock: FileLock,
  handoff: Hand,
};

function LandingIcon({ icon, className }: { icon: (typeof LANDING_ICONS)[number]; className?: string }) {
  const Icon = ICONS[icon];
  return <Icon className={className} aria-hidden />;
}

/* --- Trust strip ------------------------------------------------------------ */

/**
 * What the product is built on: the providers' own marks, in the page's ink
 * tone. An item without a mark falls back to its name, so a new provider is
 * a content change even before anyone draws a logo.
 */
export function TrustStrip({
  label,
  items,
  tone = "default",
  className,
}: {
  label: string;
  items: readonly { name: string; logo?: BrandLogoId }[];
  tone?: "default" | "sky";
  className?: string;
}) {
  const isSky = tone === "sky";
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 text-center sm:flex-row sm:justify-center sm:gap-6",
        className,
      )}
    >
      <p
        className={cn(
          "text-xs font-semibold",
          isSky ? "text-[var(--sky-ink)]/75" : "eyebrow sd-rise",
        )}
      >
        {label}
      </p>
      <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
        {items.map((item) => (
          <li
            key={item.name}
            className={cn(
              "flex items-center gap-2",
              isSky ? "text-[var(--sky-ink)]" : "text-ink-muted",
            )}
          >
            {item.logo ? <BrandLogo id={item.logo} className="size-5 shrink-0" /> : null}
            <span className="text-base font-semibold tracking-tight">{item.name}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* --- How it works ------------------------------------------------------------ */

export function Steps({
  items,
}: {
  items: readonly { icon: (typeof LANDING_ICONS)[number]; title: string; body: string }[];
}) {
  return (
    <ol className="sd-stagger relative grid gap-10 md:grid-cols-3 md:gap-8">
      {/* The rail joining the three numbers, behind them, from md up. */}
      <span aria-hidden className="sd-draw absolute left-[16.7%] right-[16.7%] top-6 hidden h-px bg-accent-line md:block" />
      {items.map((step, index) => (
        <li key={step.title} className="relative flex flex-col items-center text-center">
          <span className="relative flex size-12 items-center justify-center rounded-full border border-accent-line bg-surface text-accent shadow-xs">
            <LandingIcon icon={step.icon} className="size-5" />
            <span className="sd-pop absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-accent text-xs text-accent-fg">
              {index + 1}
            </span>
          </span>
          <h3 className="mt-5 text-lg font-semibold tracking-tight text-ink">{step.title}</h3>
          <p className="mt-2 max-w-xs text-base leading-relaxed text-ink-muted">{step.body}</p>
        </li>
      ))}
    </ol>
  );
}

/* --- Trust & control --------------------------------------------------------- */

/**
 * The six promises, pinned to the desk as a board rather than laid out as a
 * table: the middle column sits a little lower, each note has its own colour
 * and a barely-there angle, and each carries a small drawing of the promise
 * (promise-doodles.tsx) above its title. A sky note would vanish into the
 * band's sky wash, so the colours run lemon, mint, coral, lilac.
 */
const PROMISE_NOTES = [
  { tone: "lemon", tilt: -1.2 },
  { tone: "mint", tilt: 0.8 },
  { tone: "coral", tilt: -0.6 },
  { tone: "lilac", tilt: 1 },
  { tone: "lemon", tilt: -0.8 },
  { tone: "mint", tilt: 1.2 },
] as const;

const DOODLE_FOR: Partial<Record<(typeof LANDING_ICONS)[number], PromiseDoodleId>> = {
  draft: "draft",
  person: "person",
  source: "source",
  log: "log",
  lock: "lock",
  handoff: "handoff",
};

export function TrustGrid({
  items,
}: {
  items: readonly { icon: (typeof LANDING_ICONS)[number]; title: string; body: string }[];
}) {
  return (
    <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8 lg:[&>li:nth-child(3n+2)]:translate-y-8">
      {items.map((item, index) => {
        const note = PROMISE_NOTES[index % PROMISE_NOTES.length]!;
        const doodle = DOODLE_FOR[item.icon];
        return (
          <li key={item.title} className="sd-rise">
            <StickyNote tone={note.tone} tilt={note.tilt} settle={false} soft className="note-plain note-fold relative h-full px-6 pb-7 pt-6">
              {doodle ? (
                <PromiseDoodle id={doodle} className="size-16" />
              ) : (
                <LandingIcon icon={item.icon} className="size-8" />
              )}
              <h3 className="mt-4 text-lg font-bold tracking-tight">{item.title}</h3>
              <p className="mt-1.5 text-base leading-relaxed">{item.body}</p>
            </StickyNote>
          </li>
        );
      })}
    </ul>
  );
}

const SHOT_FILES: Record<ProductShot, StaticImageData> = {
  approval: approvalShot,
  boundaries: boundariesShot,
  "handoff-thread": threadShot,
  activity: activityShot,
};

/** A screenshot of the running product, framed like a window and never cropped. */
export function ProductShotImage({ image, alt, className, sizes }: { image: ProductShot; alt: string; className?: string; sizes: string }) {
  return (
    <Image
      src={SHOT_FILES[image]}
      alt={alt}
      sizes={sizes}
      placeholder="blur"
      className={cn("h-auto w-full rounded-panel border border-line bg-surface shadow-md", className)}
    />
  );
}

/**
 * The trust promises, shown rather than claimed: real screenshots of the
 * approval card, an agent's limits and a hand-off in the Audit log. Retaken
 * with scripts/product-shots.mjs whenever those screens change.
 */
export function TrustShots({ shots }: { shots: { image: ProductShot; title: string; body: string }[] }) {
  return (
    <ul className="space-y-14 lg:space-y-20">
      {shots.map((shot, index) => (
        <li key={shot.image}>
          <figure className="grid items-center gap-6 lg:grid-cols-12 lg:gap-12">
            {/* The product itself, live: every button in it works. A
                screenshot stands in only where no live piece exists. */}
            <div className={cn("sd-rise min-w-0 lg:col-span-7", index % 2 === 1 && "lg:order-last")}>
              {shot.image === "approval" ? (
                <LiveApproval />
              ) : shot.image === "boundaries" ? (
                <LiveLimits />
              ) : shot.image === "handoff-thread" ? (
                <LiveHandoff />
              ) : (
                <ProductShotImage image={shot.image} alt={shot.title} sizes="(min-width: 1024px) 640px, 100vw" />
              )}
            </div>
            <figcaption className="lg:col-span-5">
              <span className="block text-xl font-bold tracking-tight text-ink">{shot.title}</span>
              <span className="mt-2 block text-base leading-relaxed text-ink-muted">{shot.body}</span>
            </figcaption>
          </figure>
        </li>
      ))}
    </ul>
  );
}

/* --- Roles ------------------------------------------------------------------- */

/** Every role, from the same records the wizard and showcase use. One card each. */
/** Who fills each role at ABC Inc., as the demo cast them. */
const ROLE_STAFF: Record<string, readonly [string, string]> = {
  "customer-support": ["Mia", "mia"],
  "client-onboarding": ["Ivy", "ivy"],
  researcher: ["Sol", "sol"],
  marketer: ["Nova", "nova"],
  secretary: ["Kai", "kai"],
  "dev-support": ["Ada", "ada"],
  "sales-development": ["Leo", "leo-leads"],
  "people-ops": ["Rae", "rae"],
};
const ROLE_TONES = ["lemon", "sky", "mint", "coral", "lilac", "mint", "lemon", "sky"] as const;
const ROLE_TILTS = [-1.2, 0.9, -0.5, 1.3, -1, 0.6, 1.1, -0.7];

/**
 * The roles as a roster pinned to the desk: a note per role, in the person
 * who does it at ABC Inc. - their face, their name, the job - rather than a
 * grid of icon cards. Each note opens that role's run on the showcase.
 */
export function RoleGrid({ cta }: { cta: string }) {
  return (
    <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
      {TEMPLATES.map((role, index) => {
        const [name, seed] = ROLE_STAFF[role.id] ?? [role.name, role.id];
        return (
          <li key={role.id} className="sd-rise">
            <Link href={`/showcase#${role.id}`} className="group block h-full rounded-sm focus-visible:outline-offset-4">
              <StickyNote
                tone={ROLE_TONES[index % ROLE_TONES.length]!}
                tilt={ROLE_TILTS[index % ROLE_TILTS.length]!}
                settle={false}
                soft
                className="relative flex h-full flex-col px-5 pb-5 pt-6"
              >
                <span className="flex items-center gap-3">
                  <AgentAvatar name={name} seed={seed} size="lg" />
                  <span>
                    <span className="block font-hand text-hand-cta font-bold leading-none">{name}</span>
                    <span className="mt-1 block text-sm font-semibold">{role.name}</span>
                  </span>
                </span>
                <span className="mt-3 text-sm leading-relaxed">{role.pitch}</span>
                <span className="mt-auto flex items-center gap-1.5 pt-4 text-sm font-semibold text-accent">
                  {cta}
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
                </span>
              </StickyNote>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/* --- Comparison: Desker vs Generic AI -------------------------------------- */

interface ComparisonItem {
  dimension: string;
  generic: string;
  desker: string;
}

/**
 * The difference, as two pieces of paper side by side: a plain grey scrap
 * for the chat assistant, and a lemon note for your staff, each answering the
 * same five questions. On a phone they stack, chat first.
 */
export function ComparisonTable({
  competitorLabel,
  deskerLabel,
  items,
}: {
  competitorLabel: string;
  deskerLabel: string;
  items: readonly ComparisonItem[];
}) {
  return (
    <div className="mx-auto grid max-w-5xl items-start gap-8 md:grid-cols-2 md:gap-10">
      <div className="sd-rise note note-plain relative rotate-[-0.8deg] rounded-sm bg-surface-2 p-6 text-ink-muted sm:p-7">
        <p className="font-hand text-hand-cta font-bold text-ink-muted">{competitorLabel}</p>
        <dl className="mt-4 space-y-4">
          {items.map((item) => (
            <div key={item.dimension}>
              <dt className="text-xs font-semibold text-ink-muted">{item.dimension}</dt>
              <dd className="mt-1 flex gap-2.5 text-base leading-relaxed">
                <X className="mt-1 size-4 shrink-0 text-ink-subtle" aria-hidden />
                {item.generic}
              </dd>
            </div>
          ))}
        </dl>
      </div>
      <StickyNote tone="lemon" tilt={1} settle={false} className="sd-rise relative p-6 sm:p-7">
        <p className="font-hand text-hand-cta font-bold">{deskerLabel}</p>
        <dl className="mt-4 space-y-4">
          {items.map((item) => (
            <div key={item.dimension}>
              <dt className="text-xs font-semibold">{item.dimension}</dt>
              <dd className="mt-1 flex gap-2.5 text-base font-medium leading-relaxed">
                <Check className="mt-1 size-4 shrink-0 text-positive" aria-hidden />
                {item.desker}
              </dd>
            </div>
          ))}
        </dl>
      </StickyNote>
    </div>
  );
}

/* --- Testimonials -------------------------------------------------------------- */

/** Real quotes only. The page renders this only when content enables it. */
export function Testimonials({ items }: { items: readonly { quote: string; name: string; title: string }[] }) {
  return (
    <ul className="sd-stagger grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <li key={item.name}>
          <figure className="flex h-full flex-col rounded-panel border border-line bg-surface p-6 shadow-xs">
            <blockquote className="text-base leading-relaxed text-ink">&ldquo;{item.quote}&rdquo;</blockquote>
            <figcaption className="mt-auto pt-5 text-sm">
              <span className="font-semibold text-ink">{item.name}</span>
              <span className="text-ink-muted"> · {item.title}</span>
            </figcaption>
          </figure>
        </li>
      ))}
    </ul>
  );
}

/* --- FAQ ------------------------------------------------------------------------- */

/** Native disclosure, so it opens without JavaScript and works from the keyboard. */
/**
 * The FAQ as a notepad: a pale sky sheet with a margin rule, each question a
 * line on it. Native disclosure, so it opens without JavaScript and works
 * from the keyboard.
 */
export function Faq({ items }: { items: readonly { q: string; a: string }[] }) {
  return (
    <StickyNote tone="sky" tilt={0.4} settle={false} soft className="note-plain sd-rise relative px-5 py-3 sm:px-8">
      <div className="divide-y divide-note-ink/10">
        {items.map((item, index) => (
          <details key={item.q} className="group" open={index === 0}>
            <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between gap-6 rounded-md py-4 text-lg font-semibold tracking-tight transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
              <span>{item.q}</span>
              <ChevronDown className="size-4 shrink-0 opacity-60 transition-transform duration-300 group-open:rotate-180" aria-hidden />
            </summary>
            <p className="max-w-[36rem] pb-6 text-base leading-relaxed">{item.a}</p>
          </details>
        ))}
      </div>
    </StickyNote>
  );
}
