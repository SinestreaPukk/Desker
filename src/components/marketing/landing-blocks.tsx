import Image, { type StaticImageData } from "next/image";
import approvalShot from "../../../public/product/approval.png";
import boundariesShot from "../../../public/product/boundaries.png";
import threadShot from "../../../public/product/handoff-thread.png";
import activityShot from "../../../public/product/activity.png";
import {
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
  Building,
  Lock,
  UserRound,
} from "lucide-react";
import { LANDING_ICONS, type PRODUCT_SHOTS } from "@/lib/content";

type ProductShot = (typeof PRODUCT_SHOTS)[number];
import { StickyNote } from "@/components/marketing/desk-notes";
import { AgentAvatar } from "@/components/ui/avatar";
import { LiveApproval, LiveHandoff, LiveLimits } from "@/components/marketing/live-product";
import { PromiseDoodle, type PromiseDoodleId } from "@/components/marketing/promise-doodles";
import { BrandLogo, type BrandLogoId } from "@/components/marketing/brand-logos";
import { CONNECTORS, CONNECTOR_CATEGORIES } from "@/lib/integrations/catalog";
import { CHANNEL_KINDS, CHANNELS, type ChannelKind } from "@/lib/messaging/prefs";
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
  className,
}: {
  label: string;
  items: readonly { name: string; logo?: BrandLogoId }[];
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 text-center sm:flex-row sm:justify-center sm:gap-6",
        className,
      )}
    >
      <p className="eyebrow text-xs font-semibold">
        {label}
      </p>
      <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
        {items.map((item) => (
          <li
            key={item.name}
            className="flex items-center gap-2 text-ink-muted"
          >
            {item.logo ? <BrandLogo id={item.logo} className="size-5 shrink-0" /> : null}
            <span className="text-base font-semibold tracking-tight">{item.name}</span>
          </li>
        ))}
      </ul>
    </div>
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
          <li key={item.title}>
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
            <div className={cn("min-w-0 lg:col-span-7", index % 2 === 1 && "lg:order-last")}>
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

import { RoleGrid } from "@/components/marketing/role-grid";
import { ROLE_STAFF } from "@/components/marketing/role-staff";
export { ROLE_STAFF, RoleGrid };

/* --- Two desks: business and personal ------------------------------------- */

interface Desk {
  label: string;
  title: string;
  body: string;
  points: readonly string[];
}

/**
 * The two things Desker is for, as two notes on one desk: the business on
 * sky, your life on mint, each with three of its people. The wall between
 * them is the line under both - the promise that nothing crosses.
 */
export function Desks({ business, personal, wall }: { business: Desk; personal: Desk; wall: string }) {
  const desks = [
    { desk: business, tone: "sky", tilt: -0.8, Icon: Building, roles: ["researcher", "marketer", "customer-support"] },
    { desk: personal, tone: "mint", tilt: 0.7, Icon: UserRound, roles: ["money-manager", "personal-assistant", "career-coach"] },
  ] as const;
  return (
    <div>
      <div className="grid gap-6 md:grid-cols-2 md:gap-8">
        {desks.map(({ desk, tone, tilt, Icon, roles }) => (
          <StickyNote key={desk.label} tone={tone} tilt={tilt} settle={false} className="flex flex-col px-6 pb-6 pt-7 sm:px-8">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <Icon className="size-4" aria-hidden />
              {desk.label}
            </p>
            <h3 className="mt-3 font-hand text-hand-cta font-bold leading-tight text-balance">{desk.title}</h3>
            <p className="mt-3 text-base leading-relaxed">{desk.body}</p>
            <ul className="mt-4 space-y-2 text-sm">
              {desk.points.map((point) => (
                <li key={point} className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {point}
                </li>
              ))}
            </ul>
            <span className="mt-auto flex items-center gap-3 pt-6">
              <span className="flex -space-x-2" aria-hidden>
                {roles.map((id) => {
                  const [name, seed] = ROLE_STAFF[id] ?? [id, id];
                  return <AgentAvatar key={id} name={name} seed={seed} size="md" className="ring-2 ring-paper" />;
                })}
              </span>
              <span className="text-sm">
                {roles.map((id) => ROLE_STAFF[id]?.[0]).join(", ")} and more
              </span>
            </span>
          </StickyNote>
        ))}
      </div>
      <p className="mx-auto mt-8 flex max-w-2xl items-center justify-center gap-2 text-center text-sm font-medium text-ink">
        <Lock className="size-4 shrink-0 text-accent" aria-hidden />
        {wall}
      </p>
    </div>
  );
}

/* --- Testimonials -------------------------------------------------------------- */

/** Real quotes only. The page renders this only when content enables it. */
export function Testimonials({ items }: { items: readonly { quote: string; name: string; title: string }[] }) {
  return (
    <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
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
    <StickyNote tone="sky" tilt={0.4} settle={false} soft className="note-plain relative px-5 py-3 sm:px-8">
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

/* --- Integrations ----------------------------------------------------------- */

/**
 * What it connects to, read from the connector catalog and the alert
 * channels themselves, so the page can't promise an app that isn't there.
 * Planned ones are named once, as coming.
 */
export function Integrations({ liveChannels }: { liveChannels: readonly ChannelKind[] }) {
  const columns = [
    {
      label: "Alerts to you",
      names: CHANNEL_KINDS.filter((kind) => liveChannels.includes(kind)).map((kind) => CHANNELS[kind].name),
    },
    ...CONNECTOR_CATEGORIES.map((category) => ({
      label: category.label,
      names: CONNECTORS.filter((c) => c.category === category.id && c.status === "available").map((c) => c.name),
    })),
  ].filter((column) => column.names.length > 0);
  const shown = new Set(columns.flatMap((column) => column.names));
  const coming = [
    ...CHANNEL_KINDS.filter((kind) => !liveChannels.includes(kind)).map((kind) => CHANNELS[kind].name),
    ...CONNECTORS.filter((c) => c.status === "planned").map((c) => c.name),
  ].filter((name) => !shown.has(name));
  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {columns.map((column) => (
          <section key={column.label} className="rounded-panel border border-line bg-surface p-5 shadow-xs">
            <h3 className="text-sm font-semibold text-ink">{column.label}</h3>
            <ul className="mt-3 flex flex-wrap gap-2">
              {column.names.map((name) => (
                <li key={name} className="rounded-lg border border-line bg-paper px-3 py-1.5 text-sm text-ink">
                  {name}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      {coming.length ? (
        <p className="mt-6 text-center text-sm text-ink-muted">
          <span className="font-medium text-ink">On the way:</span> {coming.join(", ")}.
        </p>
      ) : null}
    </div>
  );
}
