import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  CalendarClock,
  ChevronDown,
  CircleCheckBig,
  FilePen,
  FileUp,
  LifeBuoy,
  LockKeyhole,
  ScrollText,
  UserCheck,
} from "lucide-react";
import { LANDING_ICONS, TEMPLATES } from "@/lib/content";
import { TemplateIcon } from "@/components/marketing/template-icon";
import { cn } from "@/lib/utils";

/**
 * The parts of the landing page that are pure markup and CSS: the sky's
 * horizon, the steps, the trust grid, the roles, the numbers and the FAQ. No
 * client code, so they read identically to a crawler and to a browser with
 * scripts off.
 */

/** Drifting clouds across the lower half of the sky. Decorative; CSS only. */
export function Clouds({ className }: { className?: string }) {
  return (
    <div className={cn("clouds", className)} aria-hidden>
      <i />
      <i />
      <i />
      <i />
      <i />
    </div>
  );
}

/**
 * The horizon: three sunrise ribbons rising behind the product and
 * dissolving into the paper ground. Colours are the --ribbon-* tokens.
 */
export function Horizon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 1440 420"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden
      className={cn("block h-full w-full pointer-events-none", className)}
    >
      <defs>
        {(["far", "mid", "near"] as const).map((ribbon) => (
          <linearGradient key={ribbon} id={`ribbon-${ribbon}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={`var(--ribbon-${ribbon}-start)`} />
            <stop offset="50%" stopColor={`var(--ribbon-${ribbon}-mid)`} />
            <stop offset="100%" stopColor={`var(--ribbon-${ribbon}-end)`} />
          </linearGradient>
        ))}
        <linearGradient id="ribbon-haze" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--paper)" stopOpacity="0" />
          <stop offset="100%" stopColor="var(--paper)" stopOpacity="1" />
        </linearGradient>
      </defs>

      <path
        fill="url(#ribbon-far)"
        opacity="0.75"
        d="M0 250 C 300 170, 600 330, 900 240 S 1300 160, 1440 220 L1440 420 L0 420 Z"
      />
      <path
        fill="url(#ribbon-mid)"
        opacity="0.85"
        d="M0 300 C 280 230, 560 360, 860 290 S 1260 230, 1440 300 L1440 420 L0 420 Z"
      />
      <path
        fill="url(#ribbon-near)"
        opacity="0.9"
        d="M0 350 C 320 300, 640 400, 980 340 S 1320 320, 1440 360 L1440 420 L0 420 Z"
      />
      {/* Haze at the foot, dissolving into the paper */}
      <rect x="0" y="300" width="1440" height="120" fill="url(#ribbon-haze)" />
    </svg>
  );
}

/* --- Icons ------------------------------------------------------------------ */

const ICONS: Record<(typeof LANDING_ICONS)[number], React.ComponentType<{ className?: string }>> = {
  upload: FileUp,
  calendar: CalendarClock,
  approve: CircleCheckBig,
  draft: FilePen,
  person: UserCheck,
  source: BookOpenCheck,
  log: ScrollText,
  lock: LockKeyhole,
  handoff: LifeBuoy,
};

export function LandingIcon({ icon, className }: { icon: (typeof LANDING_ICONS)[number]; className?: string }) {
  const Icon = ICONS[icon];
  return <Icon className={className} aria-hidden />;
}

/* --- Trust strip ------------------------------------------------------------ */

/**
 * What the product is built on, as names. TODO: real logos only - provider
 * wordmarks need their brand permission, and customer logos need a customer.
 */
export function TrustStrip({ label, items }: { label: string; items: readonly string[] }) {
  return (
    <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:justify-center sm:gap-6">
      <p className="eyebrow">{label}</p>
      <ul className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
        {items.map((item) => (
          <li key={item} className="text-lg font-semibold tracking-tight text-ink-muted">
            {item}
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
    <ol className="relative grid gap-10 md:grid-cols-3 md:gap-8">
      {/* The rail joining the three numbers, behind them, from md up. */}
      <span aria-hidden className="absolute left-[16.7%] right-[16.7%] top-6 hidden h-px bg-accent-line md:block" />
      {items.map((step, index) => (
        <li key={step.title} className="relative flex flex-col items-center text-center">
          <span className="relative flex size-12 items-center justify-center rounded-full border border-accent-line bg-surface text-accent shadow-xs">
            <LandingIcon icon={step.icon} className="size-5" />
            <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-accent font-mono text-xs text-accent-fg">
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

export function TrustGrid({
  items,
}: {
  items: readonly { icon: (typeof LANDING_ICONS)[number]; title: string; body: string }[];
}) {
  return (
    <ul className="grid gap-px overflow-hidden rounded-panel border border-accent-fg/15 bg-accent-fg/15 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <li key={item.title} className="bg-accent p-6">
          <span className="flex size-10 items-center justify-center rounded-lg bg-accent-fg/10 text-accent-fg">
            <LandingIcon icon={item.icon} className="size-5" />
          </span>
          <h3 className="mt-4 text-lg font-semibold tracking-tight text-accent-fg">{item.title}</h3>
          <p className="mt-2 text-base leading-relaxed text-accent-fg/85">{item.body}</p>
        </li>
      ))}
    </ul>
  );
}

/** A slice of the audit log: the promise above, as the record shows it. A picture. */
export function AuditTrail() {
  const rows = [
    { time: "09:00", who: "Nova", what: "drafted a post · waiting for approval" },
    { time: "09:12", who: "You", what: "edited the draft" },
    { time: "09:13", who: "You", what: "approved · published" },
    { time: "10:41", who: "Mia", what: "escalated a refund question to you" },
  ];
  return (
    <div className="rounded-panel border border-accent-fg/15 bg-accent-fg/[0.06] p-4" aria-hidden>
      <p className="meta text-accent-fg/80">Audit log · today</p>
      <ol className="mt-3 space-y-2.5">
        {rows.map((row) => (
          <li key={row.time} className="flex items-baseline gap-3 text-sm">
            <span className="font-mono text-xs text-accent-fg/70">{row.time}</span>
            <span className="text-accent-fg">
              <span className="font-semibold">{row.who}</span> <span className="text-accent-fg/85">{row.what}</span>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* --- Roles ------------------------------------------------------------------- */

/** Every role, from the same records the wizard and showcase use. One card each. */
export function RoleGrid({ cta }: { cta: string }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {TEMPLATES.map((role) => (
        <li key={role.id}>
          <Link
            href={`/showcase#${role.id}`}
            className="group lift flex h-full flex-col rounded-panel border border-line bg-surface p-5 shadow-xs hover:border-accent-line hover:shadow-md"
          >
            <span className="flex size-10 items-center justify-center rounded-full bg-accent-soft text-accent-soft-fg">
              <TemplateIcon icon={role.icon} className="size-4" />
            </span>
            <span className="mt-4 text-lg font-semibold tracking-tight text-ink">{role.name}</span>
            <span className="mt-2 text-sm leading-relaxed text-ink-muted">{role.pitch}</span>
            <span className="mt-auto flex items-center justify-between pt-5 text-sm font-medium text-accent">
              <span>{cta}</span>
              <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden />
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/* --- Outcomes ------------------------------------------------------------------ */

type Metric = { label: string; value: string | null; todo?: string };

/** The section shows in production only once every value is measured. */
export function metricsReady(items: readonly Metric[]): boolean {
  return items.every((item) => item.value !== null);
}

export function MetricTiles({ items }: { items: readonly Metric[] }) {
  return (
    <dl className="grid gap-4 sm:grid-cols-3">
      {items.map((item) => (
        <div
          key={item.label}
          className={cn(
            "rounded-panel border bg-surface p-6 text-center",
            item.value === null ? "border-dashed border-line-strong" : "border-line shadow-xs",
          )}
        >
          {/* Key numbers are an ember moment - in the ink tone, which is the one that reads. */}
          <dd className="text-display font-medium tracking-tight text-ember-ink">{item.value ?? "—"}</dd>
          <dt className="mt-2 text-sm text-ink-muted">{item.label}</dt>
          {item.value === null ? (
            <p className="mt-3 font-mono text-xs text-danger">TODO: {item.todo ?? "measure this"}</p>
          ) : null}
        </div>
      ))}
    </dl>
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
export function Faq({ items }: { items: readonly { q: string; a: string }[] }) {
  return (
    <div className="divide-y divide-line border-y border-line">
      {items.map((item, index) => (
        <details key={item.q} className="group" open={index === 0}>
          <summary className="flex min-h-[48px] cursor-pointer list-none items-center justify-between gap-6 rounded-md py-4 text-lg font-medium tracking-tight text-ink transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 [&::-webkit-details-marker]:hidden">
            <span>{item.q}</span>
            <ChevronDown
              className="size-4 shrink-0 text-ink-subtle transition-transform duration-300 group-open:rotate-180"
              aria-hidden
            />
          </summary>
          <p className="max-w-2xl pb-6 text-base leading-relaxed text-ink-muted">{item.a}</p>
        </details>
      ))}
    </div>
  );
}
