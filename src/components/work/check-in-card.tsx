"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, Clock, HeartPulse, Mail, TriangleAlert, Users } from "lucide-react";
import { toast } from "sonner";
import { AgentAvatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Note } from "@/components/ui/note";
import { EmptyState, ErrorState, LoadingRows } from "@/components/ui/states";
import { useAgents } from "@/hooks/use-admin-data";
import { useCheckIns, useDecideSuggestion, useRunScope, useSetCheckInRead } from "@/hooks/use-work-data";
import { errorMessage } from "@/lib/api-client";
import type { ProjectCheckInDto } from "@/lib/work/types";
import { formatDateTime, formatRelativeTime, formatTime } from "@/lib/utils";

const BULLET = {
  heads_up: { icon: TriangleAlert, className: "text-warning", label: "Needs attention" },
  pending: { icon: Clock, className: "text-accent", label: "Waiting on you" },
  done: { icon: CheckCircle2, className: "text-positive", label: "Done" },
} as const;
const HEALTH: Record<string, string> = { positive: "text-positive", accent: "text-accent", warning: "text-warning", danger: "text-danger", neutral: "text-ink-muted" };

function checkInPeriod(start: string, end: string) {
  const from = new Date(start);
  const to = new Date(end);
  const options = { day: "numeric", month: "short" } as const;
  return from.toDateString() === to.toDateString()
    ? `${to.toLocaleDateString(undefined, options)} · ${formatTime(to)}`
    : `${from.toLocaleDateString(undefined, options)} – ${to.toLocaleDateString(undefined, options)}`;
}

function Followup({ suggestion, project, agents }: {
  suggestion: ProjectCheckInDto["suggestions"][number];
  project: string;
  agents: NonNullable<ReturnType<typeof useAgents>["data"]>;
}) {
  const decide = useDecideSuggestion();
  const teammates = agents.filter((agent) => agent.status === "published" && agent.id !== suggestion.agentId);
  const [chosen, setChosen] = React.useState("");
  const targetId = chosen && teammates.some((agent) => agent.id === chosen) ? chosen : teammates[0]?.id ?? "";
  const target = teammates.find((agent) => agent.id === targetId);
  const run = useRunScope(targetId || suggestion.agentId);
  const busy = decide.isPending || run.isPending;

  async function snooze() {
    try {
      await decide.mutateAsync({ suggestionId: suggestion.id, status: "snoozed", snoozeDays: 7 });
      toast("Snoozed for a week", { description: "It returns to Needs you when the week is up." });
    } catch (caught) { toast.error(errorMessage(caught)); }
  }

  async function delegate() {
    if (!target) return;
    const instruction = `Follow up on this suggestion from ${suggestion.agentName}: ${suggestion.summary}. Reason: ${suggestion.rationale}. Suggested next step: ${suggestion.proposal}`.slice(0, 2000);
    try {
      await run.mutateAsync(instruction);
    } catch (caught) { toast.error(errorMessage(caught)); return; }
    try {
      await decide.mutateAsync({ suggestionId: suggestion.id, status: "delegated" });
      toast.success(`Follow-up sent to ${target.name}`);
    } catch (caught) {
      toast.error(`The task started, but the suggestion is still open: ${errorMessage(caught)}`);
    }
  }

  return <li className="space-y-2 border-t border-line px-4 py-3 first:border-t-0">
    <div className="flex items-center gap-2 text-xs text-ink-muted"><AgentAvatar name={suggestion.agentName} seed={suggestion.agentId} size="sm" /><span>{suggestion.agentName} suggested</span>{!suggestion.pending ? <Badge tone="neutral">{suggestion.status === "snoozed" ? "Snoozed" : suggestion.status === "delegated" ? "Delegated" : "Handled"}</Badge> : null}</div>
    <p className="text-sm font-medium text-ink">{suggestion.summary}</p>
    <p className="text-sm text-ink-muted">{suggestion.proposal}</p>
    {suggestion.pending ? <div className="flex flex-wrap items-center gap-2 pt-1">
      <Button size="sm" variant="secondary" disabled={busy} onClick={() => void snooze()}><Clock aria-hidden />Snooze 7 days</Button>
      {teammates.length ? <>
        <Select value={targetId} onValueChange={setChosen}>
          <SelectTrigger className="h-8 w-44" aria-label="Choose an agent for this follow-up"><SelectValue placeholder="Choose an agent" /></SelectTrigger>
          <SelectContent>{teammates.map((agent) => <SelectItem key={agent.id} value={agent.id}>{agent.name} · {agent.jobTitle}</SelectItem>)}</SelectContent>
        </Select>
        <Button size="sm" loading={busy} disabled={!targetId || !suggestion.pending} onClick={() => void delegate()}><Users aria-hidden />Delegate follow-up</Button>
      </> : <span className="text-xs text-ink-subtle">No other published agent is available to take this follow-up.</span>}
    </div> : null}
    {suggestion.actionItemId ? <Link href={`/p/${project}/work/${suggestion.actionItemId}`} className="inline-block text-xs text-accent hover:underline">See the run behind this</Link> : null}
  </li>;
}

function CheckInCard({ checkIn, project, agents }: { checkIn: ProjectCheckInDto; project: string; agents: NonNullable<ReturnType<typeof useAgents>["data"]> }) {
  const setRead = useSetCheckInRead();
  const unread = !checkIn.readAt;
  async function markRead() {
    try { await setRead.mutateAsync({ checkInId: checkIn.id, read: unread }); }
    catch (caught) { toast.error(errorMessage(caught)); }
  }
  const healthChanges = checkIn.agentHealth.filter((agent) => agent.changed);
  return <Note tone="lemon">
    <div className="flex items-start gap-3 px-4 py-3">
      <span className={unread ? "mt-2 size-2 shrink-0 rounded-full bg-accent" : "mt-2 size-2 shrink-0"} aria-label={unread ? "Unread" : undefined} role={unread ? "img" : undefined} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <h2 className="text-sm font-semibold text-ink">{checkIn.project.name}</h2>
          <span className="text-xs text-ink-muted">{checkIn.cadence === "daily" ? "Daily check-in" : "Weekly check-in"} · {checkInPeriod(checkIn.periodStart, checkIn.periodEnd)}</span>
        </div>
        <p className="mt-1 text-sm font-medium text-ink">{checkIn.headline}</p>
      </div>
      <Button variant="ghost" size="sm" onClick={() => void markRead()} loading={setRead.isPending}>{unread ? "Mark read" : "Mark unread"}</Button>
    </div>

    <ul className="space-y-2 border-t border-line px-4 py-3">
      {checkIn.bullets.map((bullet, index) => {
        const look = BULLET[bullet.kind];
        const Icon = look.icon;
        return <li key={index} className="flex items-start gap-2.5 text-sm text-ink"><Icon className={`mt-0.5 size-4 shrink-0 ${look.className}`} aria-hidden /><span className="sr-only">{look.label}: </span><span>{bullet.text}</span></li>;
      })}
    </ul>

    {healthChanges.length ? <section className="border-t border-line px-4 py-3" aria-label="Agent health changes">
      <h3 className="flex items-center gap-2 text-xs font-semibold text-ink"><HeartPulse className="size-3.5 text-accent" aria-hidden />Agent health changes</h3>
      <ul className="mt-2 space-y-2">{healthChanges.map((agent) => <li key={agent.agentId} className="flex items-start gap-2.5 text-sm">
        <AgentAvatar name={agent.agentName} src={agent.avatarUrl} seed={agent.agentId} size="sm" />
        <div className="min-w-0 flex-1"><p className="font-medium text-ink">{agent.agentName} <span className="font-normal text-ink-muted">{agent.previousHeadline ? `${agent.previousHeadline} → ` : "New issue · "}</span><span className={HEALTH[agent.tone]}>{agent.headline}</span></p><p className="text-xs leading-relaxed text-ink-muted">{agent.detail}</p></div>
        <Link href={`/p/${project}/agents/${agent.agentId}`} className="text-xs text-accent hover:underline">View</Link>
      </li>)}</ul>
    </section> : null}

    {checkIn.suggestions.length ? <section className="border-t border-line" aria-label="Suggestions needing follow-up">
      <h3 className="px-4 pt-3 text-xs font-semibold text-ink">Follow-ups</h3>
      <ul className="mt-1">{checkIn.suggestions.map((suggestion) => <Followup key={suggestion.id} suggestion={suggestion} project={project} agents={agents} />)}</ul>
    </section> : null}

    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-line px-4 py-2 text-xs text-ink-muted">
      <span>{checkIn.stats.completed} completed</span>
      {checkIn.stats.awaitingApproval ? <><span aria-hidden>·</span><Link href={`/p/${project}/needs-you`} className="text-accent hover:underline">{checkIn.stats.awaitingApproval} waiting in Needs you</Link></> : null}
      {checkIn.stats.failed ? <><span aria-hidden>·</span><span>{checkIn.stats.failed} failed</span></> : null}
      <span aria-hidden>·</span><span title={formatDateTime(checkIn.createdAt)}>{formatTime(checkIn.createdAt)} · {formatRelativeTime(checkIn.createdAt)}</span>
      {checkIn.emailedAt ? <><span aria-hidden>·</span><span className="inline-flex items-center gap-1"><Mail className="size-3" aria-hidden />Emailed</span></> : checkIn.emailError ? <><span aria-hidden>·</span><span className="text-warning">Not emailed: {checkIn.emailError}</span></> : null}
      <span aria-hidden>·</span><Link href={`/p/${project}/work`} className="text-accent hover:underline">See all work</Link>
    </div>
  </Note>;
}

export function CheckInList({ project, status = "all" }: { project: string; status?: string }) {
  const query = useCheckIns({ project, status: status === "read" || status === "unread" ? status : "all" });
  const agents = useAgents(project);
  if (query.isPending || agents.isPending) return <LoadingRows count={2} />;
  if (query.error) return <ErrorState message={errorMessage(query.error)} onRetry={() => void query.refetch()} retrying={query.isRefetching} />;
  if (!query.data?.length) return <EmptyState icon={Mail} title="No check-ins yet" description="Your project check-in brings completed work, approvals, failures, and agent health changes into one short update." />;
  return <div className="space-y-3">{query.data.map((checkIn) => <CheckInCard key={checkIn.id} checkIn={checkIn} project={project} agents={agents.data ?? []} />)}</div>;
}
