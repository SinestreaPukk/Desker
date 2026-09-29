"use client";

/**
 * Pieces of the product, live on the public page in place of screenshots:
 * the approval card, an agent's limits, and a hand-off thread. Every control
 * works - approve, edit, reject, undo, the switches, the details - on local
 * state only; nothing is sent anywhere. Built from the app's own components,
 * so they look like the product because they are it.
 */
import * as React from "react";
import { Check, ChevronRight, FileText, Mail, Pencil, Send, ShieldCheck, Undo2, UserRound, X } from "lucide-react";
import { AgentAvatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { DecisionStamp } from "@/components/ui/decision-stamp";
import { cn } from "@/lib/utils";

/** A product window: a quiet title bar in sentence case, then the content. */
export function LiveFrame({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("window overflow-hidden text-left", className)}>
      <div className="flex items-center gap-2 border-b border-line bg-surface-2/60 px-4 py-2.5">
        <span className="flex gap-1.5" aria-hidden>
          <i className="size-2.5 rounded-full bg-line-strong/40" />
          <i className="size-2.5 rounded-full bg-line-strong/40" />
          <i className="size-2.5 rounded-full bg-line-strong/40" />
        </span>
        <span className="text-xs font-semibold text-ink-muted">{title}</span>
      </div>
      <div className="bg-paper p-2.5 text-ink sm:p-5">{children}</div>
    </div>
  );
}

/* --- Approval ------------------------------------------------------------------ */

type Decision = "waiting" | "published" | "rejected";

export function LiveApproval({
  agent = "Kai",
  seed = "kai",
  action = "send an email",
  heading = "Re: quote for 40 drills",
  initialText = "Thanks for the detail on the site fit-out. For 40 drills we can do the trade price, each with the 24-month warranty. The one-page quote is attached.",
  where = "Dana at Litware",
  done = "Sent to",
  why = "You asked me to follow up Thursday's meeting. This is the follow-up, with the quote from your notes.",
  framed = true,
}: {
  agent?: string;
  seed?: string;
  /** What the agent wants to do: "publish a post", "send an email". */
  action?: string;
  heading?: string;
  initialText?: string;
  /** Where it goes: a page, or a person. */
  where?: string;
  /** How the outcome is said: "Published to", "Sent to". */
  done?: string;
  why?: string;
  framed?: boolean;
}) {
  const [decision, setDecision] = React.useState<Decision>("waiting");
  const [editing, setEditing] = React.useState(false);
  const [text, setText] = React.useState(initialText);
  const [draft, setDraft] = React.useState(initialText);
  const sends = action.startsWith("send");
  const status = decision === "waiting" ? "needs_approval" : decision === "published" ? (sends ? "sent" : "published") : decision;

  const card = (
    <div className="relative overflow-hidden rounded-panel border border-line bg-surface">
      {decision !== "waiting" ? (
        <DecisionStamp kind={decision === "rejected" ? "rejected" : sends ? "sent" : "published"} className="right-5 top-20" />
      ) : null}
      <div className="flex flex-wrap items-start gap-x-3 gap-y-2 border-b border-warning-line/60 bg-warning-soft/60 px-4 py-3">
        <AgentAvatar name={agent} seed={seed} size="sm" />
        <p className="min-w-0 flex-1 basis-44 text-sm">
          <span className="font-semibold text-ink">
            {agent} wants to {action}
          </span>
          <span className="block text-xs text-ink-muted">To {where}. Nothing goes out until you approve it.</span>
        </p>
        <StatusBadge status={status} />
      </div>
      <div className="space-y-3 p-4">
        <p className="text-sm font-semibold text-ink">{heading}</p>
        {editing ? (
          <textarea
            aria-label={sends ? "Email text" : "Post text"}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            rows={4}
            className="w-full resize-none rounded-lg border border-line-strong/60 bg-surface px-3 py-2 text-sm leading-relaxed text-ink focus-visible:border-accent"
          />
        ) : (
          <p className="rounded-lg border border-line bg-paper px-3 py-2.5 text-sm leading-relaxed text-ink">{text}</p>
        )}
        <p className="text-xs leading-relaxed text-ink-muted">
          <span className="font-semibold text-ink">Why {agent} is asking: </span>
          {why}
        </p>

        {/* The decision, and the way back from it. */}
        <div className="flex min-h-9 flex-wrap items-center gap-2" aria-live="polite">
          {decision === "waiting" && !editing ? (
            <>
              <Button size="sm" onClick={() => setDecision("published")}>
                <Check aria-hidden />
                Approve and {action.split(" ")[0]}
              </Button>
              <Button size="sm" variant="secondary" onClick={() => { setDraft(text); setEditing(true); }}>
                <Pencil aria-hidden />
                Edit
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setDecision("rejected")}>
                <X aria-hidden />
                Reject
              </Button>
            </>
          ) : null}
          {editing ? (
            <>
              <Button size="sm" onClick={() => { setText(draft); setEditing(false); }}>
                Save changes
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
                Cancel
              </Button>
            </>
          ) : null}
          {decision !== "waiting" ? (
            <>
              <span className="text-sm text-ink">
                {decision === "published"
                  ? `${done} ${where}, and logged in the audit trail. (A demo: nothing was sent.)`
                  : `Rejected. ${agent} won't send it.`}
              </span>
              <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setDecision("waiting")}>
                <Undo2 aria-hidden />
                Reset demo
              </Button>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
  return framed ? <LiveFrame title="Inbox · Approvals">{card}</LiveFrame> : card;
}

/* --- Limits ---------------------------------------------------------------------- */

const LIMITS = [
  { id: "docs", label: "Read your documents and Sol's briefs", on: true },
  { id: "drafts", label: "Write drafts for you to review", on: true },
  { id: "slack", label: "Post to your team's Slack", on: false },
  { id: "publish", label: "Publish posts", on: false },
  { id: "email", label: "Send emails", on: false },
] as const;

export function LiveLimits() {
  const [on, setOn] = React.useState<Record<string, boolean>>(
    Object.fromEntries(LIMITS.map((limit) => [limit.id, limit.on])),
  );
  return (
    <LiveFrame title="Roster · Nova · Limits">
      <div className="flex items-center gap-2">
        <ShieldCheck className="size-4 text-accent" aria-hidden />
        <p className="text-sm font-semibold text-ink">What Nova does on her own</p>
      </div>
      <ul className="mt-3 overflow-hidden rounded-panel border border-line bg-surface">
        {LIMITS.map((limit) => {
          const id = `limit-${limit.id}`;
          return (
            <li key={limit.id} className="flex items-center gap-3 border-b border-line/70 px-4 py-2.5 last:border-b-0">
              <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer">
                <span className="block text-sm text-ink">{limit.label}</span>
                <span className={cn("block text-xs", on[limit.id] ? "text-positive" : "text-ink-muted")}>
                  {on[limit.id] ? "On its own" : "Asks you first"}
                </span>
              </label>
              <Switch
                id={id}
                checked={on[limit.id]}
                onCheckedChange={(value) => setOn((current) => ({ ...current, [limit.id]: value }))}
              />
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs leading-relaxed text-ink-muted">
        <span className="font-semibold text-ink">It stops and asks you when</span> a request involves money, a legal
        commitment, or agreeing to a date on someone&apos;s behalf.
      </p>
    </LiveFrame>
  );
}

/* --- Hand-off thread ------------------------------------------------------------- */

const THREAD = [
  { who: "Sol", seed: "sol", time: "Fri 16:02", icon: FileText, title: "Read 14 pages from three competitors", detail: "Web research · 14 pages read · 3 sources kept, each with its link", handoff: false },
  { who: "Sol", seed: "sol", time: "Fri 16:20", icon: Mail, title: "Wrote the competitor brief and emailed it to you", detail: "Saved as a document · every claim numbered to its source", handoff: false },
  { who: "Sol", seed: "sol", time: "Fri 16:21", icon: UserRound, title: "Handed the brief to Nova", detail: "Asked Nova: lead Monday's post with how easy a claim is", handoff: true },
  { who: "Nova", seed: "nova", time: "Mon 08:40", icon: Pencil, title: "Drafted \"A claim takes one email\"", detail: "Saved as a draft · nothing was published", handoff: true },
  { who: "Nova", seed: "nova", time: "Mon 08:52", icon: Send, title: "Queued the post for your approval", detail: "Waits in your Inbox until you decide", handoff: true },
] as const;

export function LiveHandoff() {
  const [onlyHandoff, setOnlyHandoff] = React.useState(true);
  const rows = onlyHandoff ? THREAD.filter((row) => row.handoff) : THREAD;
  return (
    <LiveFrame title="Audit log · Hand-off">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-accent-line/60 bg-accent-soft/50 px-3 py-2 text-xs text-ink">
        <UserRound className="size-3.5 text-accent-soft-fg" aria-hidden />
        One hand-off between your agents, from the first ask to the last reply.
        <button
          type="button"
          onClick={() => setOnlyHandoff((value) => !value)}
          className="ml-auto inline-flex min-h-8 items-center rounded-full px-3 font-semibold text-accent hover:bg-accent-soft pointer-coarse:min-h-11"
          aria-pressed={!onlyHandoff}
        >
          {onlyHandoff ? "Show everything" : "Only the hand-off"}
        </button>
      </div>
      <ol className="mt-3 overflow-hidden rounded-panel border border-line bg-surface">
        {rows.map((row) => {
          const Icon = row.icon;
          return (
            <li key={row.time} className="border-b border-line/70 last:border-b-0">
              <details className="group">
                <summary className="flex cursor-pointer list-none items-start gap-3 px-4 py-2.5 hover:bg-surface-2/50 [&::-webkit-details-marker]:hidden">
                  <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-muted">
                    <Icon className="size-3.5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm text-ink">{row.title}</span>
                    <span className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-muted">
                      <AgentAvatar name={row.who} seed={row.seed} size="sm" className="size-4" />
                      {row.who} · {row.time}
                    </span>
                  </span>
                  <ChevronRight className="mt-1.5 size-4 shrink-0 text-ink-subtle transition-transform group-open:rotate-90" aria-hidden />
                </summary>
                <p className="mx-4 mb-3 ml-14 rounded-md bg-surface-2 px-3 py-2 text-xs text-ink-muted">{row.detail}</p>
              </details>
            </li>
          );
        })}
      </ol>
    </LiveFrame>
  );
}
