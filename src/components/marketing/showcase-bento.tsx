import { CalendarClock, FileSearch, Globe } from "lucide-react";
import { AgentAvatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/badge";
import { LiveApproval } from "@/components/marketing/live-product";
import { cn } from "@/lib/utils";

/**
 * The product, as a bento. The hero's reel already plays each agent's whole
 * scene, so the tiles here never replay one: the approvals inbox - the one
 * scene the reel does not have - gets the big tile, and each agent gets a
 * single finished artifact of its work. Pictures, not controls: every visual
 * is inert.
 */

type Demo = "support" | "marketer" | "researcher" | "sales" | "assistant" | "approval" | "money" | "life";
type Item = { label: string; title: string; body: string; demo: Demo };

const AGENT: Partial<Record<Demo, { name: string; seed: string }>> = {
  marketer: { name: "Nova", seed: "nova" },
  support: { name: "Mia", seed: "mia" },
  researcher: { name: "Sol", seed: "sol" },
  sales: { name: "Leo", seed: "leo-leads" },
  assistant: { name: "Kai", seed: "kai" },
  money: { name: "Penny", seed: "penny" },
  life: { name: "Juno", seed: "juno" },
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
  sales: "",
  assistant: "sm:col-span-2 lg:col-span-1",
  money: "",
  life: "sm:col-span-2 lg:col-span-1",
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
            {/* The approvals window is live - approve, edit, reject all
                work; the small pieces of work in the other tiles are pictures. */}
            {item.demo === "approval" ? (
              <div className="mt-5 flex flex-1 flex-col">
                <Artifact demo={item.demo} />
              </div>
            ) : (
              <div className="mt-5 flex flex-1 flex-col justify-end" inert>
                <Artifact demo={item.demo} />
              </div>
            )}
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
        <div className="mat flex flex-1 flex-col justify-center rounded-lg sm:p-5">
          <LiveApproval
            agent="Nova"
            seed="nova"
            action="publish a post"
            where="Website news"
            done="Published to"
            heading="Monday's post"
            initialText="A drill that quits in month 23 is still ours to fix. Every power tool we sell carries a 24-month warranty, and a claim takes one email."
            why="Sol's Friday brief showed two competitors moved on warranty. I wrote this week's post from it."
          />
        </div>
      );
    case "marketer":
      return <MiniDraft />;
    case "support":
      return <MiniAnswer />;
    case "researcher":
      return <MiniSources />;
    case "sales":
      return <MiniLeads />;
    case "assistant":
      return <MiniInvite />;
    case "money":
      return <MiniMoney />;
    case "life":
      return <MiniBirthday />;
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
        A drill that quits in month 23 is still ours to fix. 24 months, one email to claim.
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
    "Tailspin Tools launches the Pro line",
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
            <span className="flex size-5 shrink-0 items-center justify-center rounded-sm bg-accent-soft text-xs font-semibold text-accent-soft-fg">
              {index + 1}
            </span>
            <span className="truncate text-ink">{title}</span>
          </li>
        ))}
      </ol>
    </Mini>
  );
}

/** Leo's leads, each with its reason, and the intros waiting for you. */
function MiniLeads() {
  const leads = [
    ["Hale & Sons", "Two new sites this year"],
    ["Crane Joinery", "Buys drills each spring"],
  ] as const;
  return (
    <Mini>
      <ul className="space-y-1.5">
        {leads.map(([name, why]) => (
          <li key={name} className="flex items-center gap-2">
            <span className="flex gap-0.5" aria-hidden>
              {[1, 2, 3].map((dot) => (
                <span key={dot} className="size-1.5 rounded-full bg-positive" />
              ))}
            </span>
            <span className="font-medium text-ink">{name}</span>
            <span className="truncate text-xs text-ink-muted">{why}</span>
          </li>
        ))}
      </ul>
      <span className="mt-2 flex items-center justify-between gap-2 border-t border-line pt-2">
        <span className="text-xs text-ink-muted">5 intro emails drafted</span>
        <StatusBadge status="needs_approval" />
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

/** Penny's check-in: the month, added up, and the one thing to do about it. */
function MiniMoney() {
  const rows = [
    ["Rent", 18000],
    ["Eating out", 4900],
    ["Groceries", 3250],
  ] as const;
  return (
    <Mini className="space-y-2">
      <span className="flex items-center justify-between gap-2">
        <span className="meta whitespace-nowrap">March · 46 transactions</span>
        <span className="text-xs font-semibold text-ink tabular-nums">฿28,697</span>
      </span>
      {rows.map(([label, amount]) => (
        <span key={label} className="grid grid-cols-[5.5rem_1fr] items-center gap-2 text-xs">
          <span className="truncate text-ink-muted">{label}</span>
          <span className="h-1.5 overflow-hidden rounded-full bg-surface-2">
            <span className="block h-full rounded-full bg-accent" style={{ width: `${(amount / 18000) * 100}%` }} />
          </span>
        </span>
      ))}
      <span className="block text-xs text-ink">Disney+ ฿289 a month, unused since June: cancel?</span>
    </Mini>
  );
}

/** Juno's proposal: an hour for the gift, before the day. */
function MiniBirthday() {
  return (
    <Mini className="flex items-center gap-3">
      <span className="flex size-10 shrink-0 flex-col items-center justify-center rounded-md border border-line bg-surface leading-none">
        <span className="meta">Wed</span>
        <span className="mt-0.5 text-base font-semibold text-ink">18</span>
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-medium text-ink">Gift shopping for Sam</span>
        <span className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-muted">
          <CalendarClock className="size-3.5" aria-hidden />
          Birthday Thursday · added when you approve
        </span>
      </span>
    </Mini>
  );
}
