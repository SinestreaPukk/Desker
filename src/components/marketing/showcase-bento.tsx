import { ArrowRight, CalendarClock, Instagram } from "lucide-react";
import { AgentAvatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/badge";
import type { FEATURE_DEMOS } from "@/lib/content";
import { cn } from "@/lib/utils";

/**
 * What it does, as a bento: each tile a small, inert picture of the real
 * product - the alert in a chat app, the team room, the 6am report, the
 * planned week, the statement added up. Pictures, not controls.
 */

type Demo = (typeof FEATURE_DEMOS)[number];
type Item = { label: string; title: string; body: string; demo: Demo };

const AGENT: Partial<Record<Demo, { name: string; seed: string }>> = {
  competitor: { name: "Vera", seed: "vera" },
  week: { name: "Juno", seed: "juno" },
  money: { name: "Penny", seed: "penny" },
};

/** On lg the alerts tile runs two rows tall beside two pairs; on sm it spans the width above them. */
const PLACE: Record<Demo, string> = {
  alerts: "sm:col-span-2 lg:col-span-1 lg:row-span-2",
  team: "",
  competitor: "",
  week: "",
  money: "",
};

export function ShowcaseBento({ items }: { items: readonly Item[] }) {
  return (
    <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
            <div className="mt-5 flex flex-1 flex-col justify-end" inert>
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
    case "alerts":
      return <MiniChatApp />;
    case "team":
      return <MiniTeam />;
    case "competitor":
      return <MiniReport />;
    case "week":
      return <MiniWeek />;
    case "money":
      return <MiniMoney />;
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

/** A chat app on a phone: the morning brief, an alert, and a reply. */
function MiniChatApp() {
  return (
    <div className="flex flex-1 flex-col gap-3" aria-hidden>
      <div className="mx-auto flex w-full max-w-xs flex-1 flex-col overflow-hidden rounded-[1.75rem] border border-line-strong bg-paper shadow-sm">
        <span className="flex items-center gap-2 border-b border-line bg-surface px-4 py-2.5">
          <span className="flex size-7 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-fg">D</span>
          <span className="text-sm font-semibold text-ink">Desker</span>
        </span>
        <span className="flex flex-1 flex-col justify-end gap-2.5 p-3 text-xs leading-relaxed">
          <Bubble time="07:30">
            <span className="block font-semibold">Good morning, Nok. Wednesday 1 October</span>
            <span className="mt-1.5 block">Today: 09:00 standup, 14:00 supplier call</span>
            <span className="block">Waiting on you: 2</span>
            <span className="block">Vera: Roastery Co&apos;s reel got 4x its usual likes</span>
          </Bubble>
          <Bubble time="10:12">
            <span className="block font-semibold">Needs your OK · Nok&apos;s Coffee</span>
            <span className="mt-1 block">Mia drafted a reply to a refund request.</span>
            <span className="mt-1 block text-accent">desker.dev/p/nok/work</span>
          </Bubble>
          <span className="ml-auto block w-fit rounded-panel rounded-br-md bg-accent px-3 py-1.5 text-accent-fg">news</span>
        </span>
      </div>
      <span className="flex flex-wrap justify-center gap-1.5">
        {["LINE", "Telegram", "Slack", "Discord", "Teams", "Email"].map((name) => (
          <span key={name} className="rounded-full border border-line bg-paper px-2.5 py-0.5 text-xs text-ink-muted">
            {name}
          </span>
        ))}
      </span>
    </div>
  );
}

function Bubble({ time, children }: { time: string; children: React.ReactNode }) {
  return (
    <span className="flex items-end gap-1.5">
      <span className="block max-w-[85%] rounded-panel rounded-bl-md border border-line bg-surface px-3 py-2 text-ink">{children}</span>
      <span className="meta shrink-0">{time}</span>
    </span>
  );
}

/** The team room: one question, the right agent answers, a colleague brought in. */
function MiniTeam() {
  return (
    <Mini className="space-y-2">
      <span className="ml-auto block w-fit max-w-[85%] rounded-panel rounded-br-md bg-accent px-3 py-1.5 text-accent-fg">
        Plan next week around the launch?
      </span>
      <span className="flex items-start gap-2">
        <AgentAvatar name="Kai" seed="kai" size="sm" />
        <span className="min-w-0">
          <span className="flex items-center gap-1 text-xs text-ink-muted">
            Kai <ArrowRight className="size-3" aria-hidden /> asked Nova for the post dates
          </span>
          <span className="mt-0.5 block leading-relaxed text-ink">Three focus blocks, launch review Thu 14:00. Waiting for your OK.</span>
        </span>
      </span>
    </Mini>
  );
}

/** Vera's 6am report, numbers first. */
function MiniReport() {
  const rows = [
    ["@roasteryco", "+312 followers · 2 new posts"],
    ["Best post", "Latte-art reel, 4x usual likes"],
    ["#specialtycoffee", "Short how-to reels lead"],
    ["You", "Reach 2,140, up 18%"],
  ] as const;
  return (
    <Mini>
      <span className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-xs text-ink-muted">
          <Instagram className="size-3.5" aria-hidden />
          Morning report · 06:04
        </span>
        <StatusBadge status="done" />
      </span>
      <dl className="mt-2 space-y-1">
        {rows.map(([label, value]) => (
          <span key={label} className="grid grid-cols-[7rem_1fr] gap-2 text-xs">
            <dt className="truncate font-medium text-ink">{label}</dt>
            <dd className="truncate text-ink-muted">{value}</dd>
          </span>
        ))}
      </dl>
    </Mini>
  );
}

/** Juno's proposed week: what goes where, waiting for a yes. */
function MiniWeek() {
  const blocks = [
    ["Mon", "09:00", "Deep work: tax return"],
    ["Wed", "18:00", "Gym, moved from Tuesday"],
    ["Thu", "12:00", "Gift shopping for Sam"],
  ] as const;
  return (
    <Mini className="space-y-1.5">
      {blocks.map(([day, time, what]) => (
        <span key={what} className="flex items-center gap-2.5">
          <span className="w-8 shrink-0 text-xs font-semibold text-ink">{day}</span>
          <span className="meta w-10 shrink-0">{time}</span>
          <span className="truncate text-ink">{what}</span>
        </span>
      ))}
      <span className="flex items-center justify-between gap-2 border-t border-line pt-2">
        <span className="flex items-center gap-1.5 text-xs text-ink-muted">
          <CalendarClock className="size-3.5" aria-hidden />
          Added to your calendar when you approve
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

