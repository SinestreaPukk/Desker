import Link from "next/link";
import {
  Calendar,
  Code,
  FileText,
  Inbox,
  Lock,
  ScrollText,
  Sparkles,
  Users,
  Check,
} from "lucide-react";
import { AgentAvatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/badge";
import { TEMPLATES, type BENTO_ICONS, type LANDING } from "@/lib/content";
import { TemplateIcon } from "@/components/marketing/template-icon";
import { cn } from "@/lib/utils";

/**
 * The parts of the landing page that are pure markup and CSS: the aurora
 * behind the hero, the activity marquee and the bento grid. No client code,
 * so they read identically to a crawler and to a browser with scripts off.
 */

/** Three drifting blobs and a grain overlay. Decorative; sits behind content. */
export function Aurora() {
  return (
    <>
      <div className="aurora" aria-hidden>
        <i />
        <i />
        <i />
      </div>
      <div className="grain" aria-hidden />
    </>
  );
}

/** Auto-scrolling ticker; the list is doubled so the loop has no seam. */
export function Marquee({ label, items }: { label: string; items: readonly string[] }) {
  const list = (hidden: boolean) => (
    <ul aria-hidden={hidden || undefined}>
      {items.map((item) => (
        <li
          key={item}
          className="flex shrink-0 items-center gap-2 rounded-full border border-[var(--stage-line)] bg-[var(--stage-surface)] px-4 py-2 text-sm text-[var(--stage-muted)]"
        >
          <span className="size-1.5 rounded-full bg-[var(--glow-text-a)]" aria-hidden />
          {item}
        </li>
      ))}
    </ul>
  );
  return (
    <section aria-label={label} className="stage">
      <div className="mx-auto max-w-6xl px-4 pb-6 sm:px-6">
        <p className="mb-4 font-mono text-xs uppercase tracking-wider text-[var(--stage-muted)]">{label}</p>
      </div>
      <div className="marquee pb-14">
        {list(false)}
        {list(true)}
      </div>
    </section>
  );
}

const ICONS = {
  inbox: Inbox,
  users: Users,
  calendar: Calendar,
  "file-text": FileText,
  scroll: ScrollText,
  code: Code,
  lock: Lock,
  sparkles: Sparkles,
} satisfies Record<(typeof BENTO_ICONS)[number], React.ComponentType<{ className?: string }>>;

const SPAN = {
  lg: "md:col-span-2 md:row-span-2",
  tall: "md:row-span-2",
  wide: "md:col-span-2",
  sm: "",
} as const;

type BentoCard = (typeof LANDING)["bento"]["cards"][number];

/** Asymmetric grid: sizes come from the content file, the layout from here. */
export function Bento({ cards }: { cards: readonly BentoCard[] }) {
  return (
    <ul className="grid auto-rows-[minmax(11rem,auto)] gap-4 md:grid-cols-3">
      {cards.map((card) => {
        const Icon = ICONS[card.icon];
        return (
          <li
            key={card.title}
            className={cn(
              "lift group relative flex flex-col overflow-hidden rounded-panel border border-line bg-surface p-6",
              "hover:border-accent-line hover:shadow-md",
              SPAN[card.size],
            )}
          >
            {/* Signature glow, only on hover, only here. */}
            <span
              aria-hidden
              className="pointer-events-none absolute -right-16 -top-16 size-40 rounded-full bg-accent opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-20"
            />
            <span className="flex size-10 items-center justify-center rounded-md bg-accent-soft text-accent-soft-fg transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:-rotate-6">
              <Icon className="size-4.5" aria-hidden />
            </span>
            <h3 className="mt-4 text-lg font-semibold tracking-tight text-ink">{card.title}</h3>
            <p className="mt-1.5 max-w-prose text-base leading-relaxed text-ink-muted">{card.body}</p>
            {card.demo === "approval" ? <ApprovalDemo /> : null}
            {card.demo === "roles" ? <RolesDemo /> : null}
          </li>
        );
      })}
    </ul>
  );
}

/** A real approval row, at rest. */
function ApprovalDemo() {
  return (
    <div className="mt-auto pt-6">
      <div className="rounded-panel border border-line bg-paper p-4 shadow-xs">
        <div className="flex items-start gap-3">
          <AgentAvatar name="Kai" seed="kai" size="sm" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-ink">Kai wants to send an email</p>
              <StatusBadge status="needs_approval" />
            </div>
            <p className="mt-1 truncate text-xs text-ink-muted">To: dana@northwind.example · Re: pricing for 40 seats</p>
          </div>
        </div>
        <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-ink">
          Thanks for the detail on the rollout. For 40 seats the Growth plan fits: every role, unlimited
          teammates, and a 2,000-run budget. I&apos;ve attached the one-page summary you asked for.
        </p>
        <div className="mt-3 flex items-center gap-2 text-xs">
          <span className="inline-flex items-center gap-1 rounded-md bg-accent px-2.5 py-1.5 font-medium text-accent-fg">
            <Check className="size-3" aria-hidden />
            Approve
          </span>
          <span className="rounded-md px-2.5 py-1.5 font-medium text-ink-muted">Edit</span>
          <span className="rounded-md px-2.5 py-1.5 font-medium text-ink-muted">Reject</span>
        </div>
      </div>
    </div>
  );
}

/** Every role from the same records the wizard and showcase use. */
function RolesDemo() {
  return (
    <ul className="mt-5 space-y-1.5">
      {TEMPLATES.map((role) => (
        <li key={role.id}>
          <Link
            href={`/showcase#${role.id}`}
            className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm text-ink transition-colors hover:bg-accent-soft hover:text-accent-soft-fg"
          >
            <TemplateIcon icon={role.icon} className="size-3.5 text-accent" />
            {role.name}
          </Link>
        </li>
      ))}
    </ul>
  );
}
