import { Bug, CalendarClock, FileSearch, Globe } from "lucide-react";
import { AgentAvatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/badge";
import { ApprovalScene, Frame } from "@/components/marketing/hero-stage";
import { cn } from "@/lib/utils";

/**
 * The product, as a bento. The hero's reel already plays each agent's whole
 * scene, so the tiles here never replay one: the approvals inbox - the one
 * scene the reel does not have - gets the big tile, and each agent gets a
 * single finished artifact of its work. Pictures, not controls: every visual
 * is inert.
 */

type Demo = "support" | "marketer" | "researcher" | "dev-support" | "assistant" | "approval";
type Item = { label: string; title: string; body: string; demo: Demo };

const AGENT: Partial<Record<Demo, { name: string; seed: string }>> = {
  marketer: { name: "Nova", seed: "nova" },
  support: { name: "Mia", seed: "mia" },
  researcher: { name: "Sol", seed: "sol" },
  "dev-support": { name: "Ada", seed: "ada" },
  assistant: { name: "Kai", seed: "kai" },
};

/**
 * Where each tile sits. On lg: approvals is 2x2 with two tiles stacked beside
 * it, then a row of three. On sm: approvals full width, then pairs, the last
 * tile full width so the grid never ends on a hole.
 */
const PLACE: Record<Demo, string> = {
  approval: "sm:col-span-2 lg:row-span-2",
  marketer: "",
  support: "",
  researcher: "",
  "dev-support": "",
  assistant: "sm:col-span-2 lg:col-span-1",
};

export function ShowcaseBento({ items }: { items: readonly Item[] }) {
  return (
    <ul className="sd-stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <li key={item.demo} className={cn("flex", PLACE[item.demo])}>
          <article className="flex w-full flex-col rounded-panel border border-line bg-surface p-5 shadow-xs sm:p-6">
            <p className="flex items-center gap-2">
              {AGENT[item.demo] ? (
                <AgentAvatar name={AGENT[item.demo]!.name} seed={AGENT[item.demo]!.seed} size="sm" />
              ) : null}
              <span className="eyebrow text-accent">{item.label}</span>
            </p>
            <h3 className="mt-3 text-xl font-semibold tracking-tight text-balance text-ink">{item.title}</h3>
            <p className="mt-2 text-base leading-relaxed text-ink-muted">{item.body}</p>
            {/* The approvals window fills its tall tile; the minis sit at the foot of theirs. */}
            <div className={cn("mt-5 flex flex-1 flex-col", item.demo !== "approval" && "justify-end")} inert>
              <Artifact demo={item.demo} />
            </div>
          </article>
        </li>
      ))}
    </ul>
  );
}

function Artifact({ demo }: { demo: Demo }) {
  switch (demo) {
    case "approval":
      return (
        <div className="mat flex flex-1 flex-col justify-center rounded-lg p-3 sm:p-5">
          <Frame title="Inbox · Approvals">
            <ApprovalScene beat={2} />
          </Frame>
        </div>
      );
    case "marketer":
      return <MiniDraft />;
    case "support":
      return <MiniAnswer />;
    case "researcher":
      return <MiniSources />;
    case "dev-support":
      return <MiniTicket />;
    case "assistant":
      return <MiniInvite />;
  }
}

/** The card every mini artifact sits in: a small piece of the product. */
function Mini({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-lg border border-line bg-paper p-3 text-sm", className)} aria-hidden>
      {children}
    </div>
  );
}

/** Nova's draft, queued. No buttons: the approvals tile owns that moment. */
function MiniDraft() {
  return (
    <Mini>
      <span className="flex items-center justify-between gap-2">
        <span className="meta whitespace-nowrap">Draft · Monday 09:00</span>
        <StatusBadge status="needs_approval" />
      </span>
      <span className="mt-2 block leading-relaxed text-ink">
        Every tool we sell now carries a lifetime warranty. Not 24 months. Lifetime.
      </span>
    </Mini>
  );
}

/** Mia's answer with the document it came from. */
function MiniAnswer() {
  return (
    <Mini className="space-y-2">
      <span className="ml-auto block w-fit max-w-[85%] rounded-panel rounded-br-md bg-accent px-3 py-1.5 text-accent-fg">
        Is the drill still under warranty?
      </span>
      <span className="block rounded-panel rounded-tl-md border border-line bg-surface px-3 py-2">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-soft-fg">
          <FileSearch className="size-3" aria-hidden />
          returns-policy.pdf
        </span>
        <span className="mt-1.5 block leading-relaxed text-ink">
          Power tools carry 24 months, so this is a warranty claim, not a return.
        </span>
      </span>
    </Mini>
  );
}

/** Sol's brief, as its sources. */
function MiniSources() {
  const sources = [
    "Fabrikam moves to a 36-month warranty",
    "Northwind Tools launches the Pro line",
    "Contoso Hardware Q3 update",
  ];
  return (
    <Mini>
      <span className="flex items-center gap-1.5 text-xs text-ink-muted">
        <Globe className="size-3.5" aria-hidden />
        Friday brief · 3 sources
      </span>
      <ol className="sd-stagger mt-2 space-y-1.5">
        {sources.map((title, index) => (
          <li key={title} className="flex items-center gap-2">
            <span className="flex size-5 shrink-0 items-center justify-center rounded-sm bg-accent-soft font-mono text-xs text-accent-soft-fg">
              {index + 1}
            </span>
            <span className="truncate text-ink">{title}</span>
          </li>
        ))}
      </ol>
    </Mini>
  );
}

/** Ada's bug report, as engineering receives it. */
function MiniTicket() {
  return (
    <Mini>
      <span className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 text-xs text-ink-muted">
          <Bug className="size-3.5" aria-hidden />
          Issue · engineering
        </span>
        <StatusBadge status="open" />
      </span>
      <span className="mt-2 block font-medium text-ink">POST /v1/agents fails without project</span>
      <span className="mt-1.5 block font-mono text-xs leading-relaxed text-ink-muted">
        1. create agent · 2. omit project · 3. TypeError
      </span>
    </Mini>
  );
}

/** Kai's proposed meeting, not yet sent. */
function MiniInvite() {
  return (
    <Mini className="flex items-center gap-3">
      <span className="flex size-10 shrink-0 flex-col items-center justify-center rounded-md border border-line bg-surface leading-none">
        <span className="meta">Thu</span>
        <span className="mt-0.5 text-base font-semibold text-ink">10</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium text-ink">Follow-up with Dana</span>
        <span className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-muted">
          <CalendarClock className="size-3.5" aria-hidden />
          Proposed · sends when you approve
        </span>
      </span>
    </Mini>
  );
}
