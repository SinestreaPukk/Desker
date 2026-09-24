import Link from "next/link";
import {
  ArrowRight,
  BookOpenCheck,
  CalendarClock,
  Check,
  ChevronDown,
  CircleCheckBig,
  FilePen,
  FileUp,
  LifeBuoy,
  LockKeyhole,
  ScrollText,
  UserCheck,
  X,
} from "lucide-react";
import { LANDING_ICONS, TEMPLATES } from "@/lib/content";
import { TemplateIcon } from "@/components/marketing/template-icon";
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
 * What the product is built on: the providers' own marks, in the page's ink
 * tone. An item without a mark falls back to its name, so a new provider is
 * a content change even before anyone draws a logo.
 */
export function TrustStrip({
  label,
  items,
}: {
  label: string;
  items: readonly { name: string; logo?: BrandLogoId }[];
}) {
  return (
    <div className="flex flex-col items-center gap-4 text-center sm:flex-row sm:justify-center sm:gap-8">
      <p className="eyebrow sd-rise">{label}</p>
      <ul className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
        {items.map((item) => (
          <li key={item.name} className="flex items-center gap-2 text-ink-muted">
            {item.logo ? <BrandLogo id={item.logo} className="size-6" /> : null}
            <span className="text-lg font-semibold tracking-tight">{item.name}</span>
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
            <span className="sd-pop absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-accent font-mono text-xs text-accent-fg">
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
    <ul className="sd-stagger grid gap-px overflow-hidden rounded-panel border border-accent-fg/15 bg-accent-fg/15 sm:grid-cols-2 lg:grid-cols-3">
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
    <div className="sd-rise rounded-panel border border-accent-fg/15 bg-accent-fg/[0.06] p-4" aria-hidden>
      <p className="meta text-accent-fg/80">Audit log · today</p>
      <ol className="sd-stagger mt-3 space-y-2.5">
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
    <ul className="sd-stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {TEMPLATES.map((role) => (
        <li key={role.id}>
          <Link
            href={`/showcase#${role.id}`}
            className="group lift flex h-full flex-col rounded-panel border border-line bg-surface p-5 shadow-xs hover:border-accent-line hover:shadow-md"
          >
            <span className="flex size-11 items-center justify-center rounded-2xl bg-accent-soft text-accent-soft-fg transition-all duration-200 group-hover:scale-110 group-hover:bg-accent group-hover:text-accent-fg group-hover:shadow-sm">
              <TemplateIcon icon={role.icon} className="size-6" />
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

/* --- Comparison: Desker vs Generic AI -------------------------------------- */

export interface ComparisonItem {
  dimension: string;
  generic: string;
  desker: string;
}

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
    <div className="sd-stagger mx-auto max-w-4xl">
      {/* Desktop view (table) */}
      <div className="hidden overflow-hidden rounded-panel border border-line bg-surface shadow-xs md:block">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-line bg-surface-2/60 text-xs font-semibold uppercase tracking-wider text-ink-muted">
              <th scope="col" className="w-[26%] px-6 py-4">Capability</th>
              <th scope="col" className="w-[37%] px-6 py-4 text-ink-subtle">{competitorLabel}</th>
              <th scope="col" className="w-[37%] border-l border-line bg-accent-soft/40 px-6 py-4 text-accent">
                <span className="flex items-center gap-2">
                  <span className="font-bold">{deskerLabel}</span>
                  <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-accent-fg">
                    24/7
                  </span>
                </span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line text-sm">
            {items.map((item) => (
              <tr key={item.dimension} className="transition-colors hover:bg-surface-2/40">
                <th scope="row" className="align-top px-6 py-4 font-semibold text-ink">
                  {item.dimension}
                </th>
                <td className="align-top px-6 py-4 leading-relaxed text-ink-muted">
                  <div className="flex items-start gap-2.5">
                    <X className="mt-0.5 size-4 shrink-0 text-ink-subtle" aria-hidden />
                    <span>{item.generic}</span>
                  </div>
                </td>
                <td className="align-top border-l border-line bg-accent-soft/15 px-6 py-4 font-medium leading-relaxed text-ink">
                  <div className="flex items-start gap-2.5">
                    <Check className="mt-0.5 size-4 shrink-0 text-positive" aria-hidden />
                    <span>{item.desker}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile view (cards per capability) */}
      <div className="space-y-4 md:hidden">
        {items.map((item) => (
          <div key={item.dimension} className="rounded-panel border border-line bg-surface p-5 shadow-xs">
            <h3 className="text-base font-semibold text-ink">{item.dimension}</h3>
            <div className="mt-3.5 space-y-2.5 text-sm">
              <div className="rounded-lg bg-surface-2/70 p-3">
                <p className="text-[11px] font-medium uppercase tracking-wider text-ink-subtle">{competitorLabel}</p>
                <div className="mt-1.5 flex items-start gap-2 text-ink-muted leading-relaxed">
                  <X className="mt-0.5 size-3.5 shrink-0 text-ink-subtle" aria-hidden />
                  <span>{item.generic}</span>
                </div>
              </div>
              <div className="rounded-lg border border-accent-line bg-accent-soft/30 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-accent">{deskerLabel}</p>
                  <span className="rounded-full bg-accent px-1.5 py-0.2 text-[9px] font-semibold text-accent-fg">24/7</span>
                </div>
                <div className="mt-1.5 flex items-start gap-2 font-medium text-ink leading-relaxed">
                  <Check className="mt-0.5 size-3.5 shrink-0 text-positive" aria-hidden />
                  <span>{item.desker}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
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
    <dl className="sd-stagger grid gap-4 sm:grid-cols-3">
      {items.map((item) => (
        <div
          key={item.label}
          className={cn(
            "rounded-panel border bg-surface p-6 text-center",
            item.value === null ? "border-dashed border-line-strong" : "border-line shadow-xs",
          )}
        >
          <dd className="sd-pop text-display font-medium tracking-tight text-accent">{item.value ?? "—"}</dd>
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
export function Faq({ items }: { items: readonly { q: string; a: string }[] }) {
  return (
    <div className="sd-stagger divide-y divide-line border-y border-line">
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
