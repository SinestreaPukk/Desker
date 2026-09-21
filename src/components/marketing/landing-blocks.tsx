import Link from "next/link";
import { Check, ChevronDown, CircleCheck, FileSearch, Lock, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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

/* --- The roles bento ------------------------------------------------------- */

/**
 * The two roles that get a tile of their own, and what shows inside it.
 *
 * Eight identical cards told a reader that all eight are the same thing in
 * eight flavours, which is the opposite of the pitch. Two of them are the
 * ones people arrive wanting - somebody to answer clients, somebody to post -
 * so those two get the room and a glimpse of the actual work, and the other
 * six stay compact. The four-column grid comes out exactly square: the wide
 * tile is two rows, the marketer's is two columns, and the rest fill the
 * last row.
 */
const FEATURED = {
  "customer-support": "sm:col-span-2 lg:row-span-2",
  marketer: "sm:col-span-2",
} as const;

/** Mia, mid-answer. No buttons: the whole tile is already a link. */
function MiniChat() {
  return (
    <span className="mt-6 flex flex-col gap-2 rounded-lg border border-line bg-paper p-3" aria-hidden>
      <span className="ml-auto max-w-[82%] rounded-panel rounded-br-md bg-accent px-3 py-2 text-xs leading-relaxed text-accent-fg">
        Is the drill still under warranty?
      </span>
      <span className="max-w-[90%] rounded-panel rounded-tl-md border border-line bg-surface px-3 py-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-soft-fg">
          <FileSearch className="size-3" aria-hidden />
          returns-policy.pdf
        </span>
        <span className="mt-1.5 block text-xs leading-relaxed text-ink">
          Power tools carry 24 months, so this is a warranty claim rather than a return.
        </span>
      </span>
    </span>
  );
}

/** Nova's draft, waiting. The buttons are a picture of buttons. */
function MiniDraft() {
  return (
    <span className="flex flex-col rounded-lg border border-line bg-paper p-3" aria-hidden>
      <span className="flex items-center justify-between gap-2">
        <span className="meta whitespace-nowrap">Draft · LinkedIn</span>
        <Badge tone="warning">Needs approval</Badge>
      </span>
      <span className="mt-2 block text-xs leading-relaxed text-ink">
        Every tool we sell now carries a lifetime warranty. Not 24 months. Lifetime.
      </span>
      <span className="mt-3 flex items-center gap-1.5">
        <span className="inline-flex h-7 items-center gap-1.5 rounded-md bg-accent px-2.5 text-xs font-medium text-accent-fg">
          <Check className="size-3" aria-hidden />
          Approve
        </span>
        <span className="inline-flex h-7 items-center rounded-md px-2.5 text-xs font-medium text-ink-muted">
          Edit
        </span>
      </span>
    </span>
  );
}

/** Every role, from the same records the wizard and showcase use. */
export function RoleGrid() {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {TEMPLATES.map((role) => {
        const span = FEATURED[role.id as keyof typeof FEATURED];
        const wide = role.id === "marketer";
        return (
          <li key={role.id} className={span}>
            <Link
              href={`/showcase#${role.id}`}
              className="lift flex h-full flex-col rounded-panel border border-line bg-surface p-5 hover:border-accent-line hover:shadow-md"
            >
              <span className={cn("flex flex-1 flex-col", wide && "gap-5 sm:flex-row sm:items-center")}>
                <span className={cn("flex flex-col", wide && "sm:flex-1")}>
                  <span className="flex size-10 items-center justify-center rounded-full bg-accent-soft text-accent-soft-fg">
                    <TemplateIcon icon={role.icon} className="size-4" />
                  </span>
                  <span className="mt-4 text-lg font-semibold tracking-tight text-ink">{role.name}</span>
                  <span className="mt-1 text-sm text-ink-muted">{role.jobTitle}</span>
                  <span className="mt-3 text-sm leading-relaxed text-ink-muted">{role.pitch}</span>
                </span>
                {wide ? <span className="sm:flex-1">{<MiniDraft />}</span> : null}
              </span>
              {span && !wide ? <MiniChat /> : null}
            </Link>
          </li>
        );
      })}
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
