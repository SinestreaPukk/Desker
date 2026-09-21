import Link from "next/link";
import { ChevronDown, CircleCheck, Lock, ShieldCheck } from "lucide-react";
import { TEMPLATES, type TRUST_ICONS } from "@/lib/content";
import { TemplateIcon } from "@/components/marketing/template-icon";
import { cn } from "@/lib/utils";

/**
 * The parts of the landing page that are pure markup and CSS: the sky's
 * horizon, the role cards and the FAQ. No client code, so they read
 * identically to a crawler and to a browser with scripts off.
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

const TRUST_GLYPH = {
  shield: ShieldCheck,
  approval: CircleCheck,
  lock: Lock,
} satisfies Record<(typeof TRUST_ICONS)[number], React.ComponentType<{ className?: string }>>;

/**
 * The line under the hero's buttons.
 *
 * A B2B buyer's first objection to an AI employee is "will it do something on
 * its own?", and the answers were all buried in the FAQ at the bottom of the
 * page. Each claim here is one the FAQ makes in the same words - no logos, no
 * counts, nothing we cannot show.
 */
export function TrustLine({
  items,
  className,
}: {
  items: readonly { icon: (typeof TRUST_ICONS)[number]; label: string }[];
  className?: string;
}) {
  return (
    <ul className={cn("flex flex-wrap items-center justify-center gap-x-6 gap-y-2", className)}>
      {items.map((item) => {
        const Glyph = TRUST_GLYPH[item.icon];
        return (
          <li key={item.label} className="inline-flex items-center gap-2 text-sm text-[var(--sky-ink)]">
            <Glyph className="size-4 shrink-0 opacity-70" aria-hidden />
            {item.label}
          </li>
        );
      })}
    </ul>
  );
}

/** Every role, from the same records the wizard and showcase use. */
export function RoleGrid() {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {TEMPLATES.map((role) => (
        <li key={role.id}>
          <Link
            href={`/showcase#${role.id}`}
            className="lift flex h-full flex-col rounded-panel border border-line bg-surface p-5 hover:border-accent-line hover:shadow-md"
          >
            <span className="flex size-10 items-center justify-center rounded-full bg-accent-soft text-accent-soft-fg">
              <TemplateIcon icon={role.icon} className="size-4" />
            </span>
            <span className="mt-4 text-lg font-semibold tracking-tight text-ink">{role.name}</span>
            <span className="mt-1 text-sm text-ink-muted">{role.jobTitle}</span>
            <span className="mt-3 text-sm leading-relaxed text-ink-muted">{role.pitch}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

/** Native disclosure, so it opens without JavaScript. */
export function Faq({ items }: { items: readonly { q: string; a: string }[] }) {
  return (
    <div className="divide-y divide-line border-y border-line">
      {items.map((item, index) => (
        <details key={item.q} className="group" open={index === 0}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-5 text-lg font-medium tracking-tight text-ink [&::-webkit-details-marker]:hidden">
            {item.q}
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
