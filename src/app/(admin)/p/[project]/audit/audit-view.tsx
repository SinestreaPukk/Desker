"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BookOpen,
  CalendarClock,
  Download,
  History,
  Mail,
  Megaphone,
  PencilLine,
  Search,
  Settings2,
  ShieldCheck,
  StickyNote,
  UserRound,
  UsersRound,
  Workflow,
  X,
} from "lucide-react";
import { Page, PageBody, PageHeader, PageToolbar } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Panel } from "@/components/ui/panel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState, ErrorState, LoadingRows } from "@/components/ui/states";
import { useAgents } from "@/hooks/use-admin-data";
import { api, errorMessage } from "@/lib/api-client";
import type { AuditEntryDto } from "@/app/api/audit/route";
import { cn, formatDateTime } from "@/lib/utils";
import {
  actorWords,
  dayHeading,
  describeAuditEntry,
  timeOfDay,
  type AuditIcon,
  type AuditTone,
} from "@/lib/audit-copy";

function buildQuery(params: Record<string, string>): string {
  const search = new URLSearchParams(
    Object.entries(params).filter(([, value]) => value && value !== "all"),
  ).toString();
  return search ? `?${search}` : "";
}

/**
 * Every recorded action as a day-by-day timeline: what an agent did, what a
 * person decided, what a schedule started - each in a sentence, with the raw
 * row one disclosure away. Filters narrow it; Export gives the same rows as
 * CSV, unchanged, for anyone who needs the machine-readable version.
 */
export function AuditView({
  project,
  initialAgentId,
  initialThread,
}: {
  project: string;
  initialAgentId: string;
  initialThread: string;
}) {
  const [agentId, setAgentId] = React.useState(initialAgentId);
  // One hand-off between agents, oldest first so it reads as the story it is.
  const [thread, setThread] = React.useState(initialThread);
  const [actorType, setActorType] = React.useState("all");
  const [action, setAction] = React.useState("");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const agents = useAgents(project);

  const params = React.useMemo(
    () => ({ project, agentId, actorType, action: action.trim(), from, to: to ? `${to}T23:59:59` : "", thread }),
    [project, agentId, actorType, action, from, to, thread],
  );
  const query = useQuery({
    queryKey: ["audit", params],
    queryFn: () => api<AuditEntryDto[]>(`/api/audit${buildQuery(params)}`),
  });

  const exportHref = `/api/audit${buildQuery({ ...params, format: "csv" })}`;

  return (
    <Page>
      <PageHeader
        title="Audit log"
        description={`Everything your agents did and everything a person decided, ${thread ? "in the order it happened" : "newest first"}. Nothing here can be edited or deleted.`}
        actions={
          <Button asChild variant="secondary" size="sm">
            <a href={exportHref} download>
              <Download aria-hidden />
              Export CSV
            </a>
          </Button>
        }
      />

      <PageToolbar>
        <div className="flex flex-wrap items-center gap-3">
          <label htmlFor="audit-agent" className="sr-only">
            Agent
          </label>
          <Select value={agentId} onValueChange={setAgentId}>
            <SelectTrigger id="audit-agent" className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All agents</SelectItem>
              {(agents.data ?? []).map((agent) => (
                <SelectItem key={agent.id} value={agent.id}>
                  {agent.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <label htmlFor="audit-actor" className="sr-only">
            Actor
          </label>
          <Select value={actorType} onValueChange={setActorType}>
            <SelectTrigger id="audit-actor" className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Anyone</SelectItem>
              <SelectItem value="agent">Agents</SelectItem>
              <SelectItem value="user">People</SelectItem>
              <SelectItem value="schedule">Schedules</SelectItem>
              <SelectItem value="system">System</SelectItem>
            </SelectContent>
          </Select>
          <label htmlFor="audit-action" className="sr-only">
            Action
          </label>
          <Input
            id="audit-action"
            value={action}
            onChange={(e) => setAction(e.target.value)}
            placeholder="What happened…"
            className="w-48"
          />
          {/* These two were labelled sr-only, which left a sighted reader two
              identical empty date boxes with nothing to say which end of the
              range each one is. The other controls in this row name
              themselves through their value; these cannot. */}
          <label htmlFor="audit-from" className="text-sm text-ink-muted">
            From
          </label>
          <Input id="audit-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-[9.5rem]" />
          <label htmlFor="audit-to" className="text-sm text-ink-muted">
            To
          </label>
          <Input id="audit-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-[9.5rem]" />
        </div>
      </PageToolbar>

      <PageBody>
        {thread ? (
          <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-accent-line/70 bg-accent-soft/50 px-4 py-3">
            <UsersRound className="size-4 shrink-0 text-accent-soft-fg" aria-hidden />
            <p className="min-w-0 flex-1 text-sm text-ink">
              One hand-off between your agents, from the first ask to the last reply.
            </p>
            <Button variant="ghost" size="sm" onClick={() => setThread("")}>
              <X aria-hidden />
              Show everything
            </Button>
          </div>
        ) : null}
        {query.isPending ? (
          <LoadingRows count={6} />
        ) : query.error ? (
          <ErrorState message={errorMessage(query.error)} onRetry={() => void query.refetch()} />
        ) : query.data.length === 0 ? (
          <EmptyState
            icon={History}
            title="Nothing recorded in this range"
            description="Every task an agent runs, everything it looks up or writes, and every decision a person makes is recorded here as it happens."
          />
        ) : (
          <Timeline entries={query.data} onThread={thread ? undefined : setThread} />
        )}
      </PageBody>
    </Page>
  );
}

const TONE_CLASS: Record<AuditTone, string> = {
  neutral: "border-line bg-surface-2 text-ink-muted",
  accent: "border-accent-line/70 bg-accent-soft text-accent-soft-fg",
  positive: "border-positive-line/70 bg-positive-soft text-positive",
  warning: "border-warning-line/70 bg-warning-soft text-warning",
  danger: "border-danger-line/70 bg-danger-soft text-danger",
};

const ICONS: Record<AuditIcon, typeof Search> = {
  research: Search,
  documents: BookOpen,
  draft: PencilLine,
  send: Mail,
  publish: Megaphone,
  approval: ShieldCheck,
  person: UserRound,
  task: Workflow,
  schedule: CalendarClock,
  settings: Settings2,
  note: StickyNote,
};

/**
 * The log as a day-by-day timeline: what happened, in words, at what time.
 * The row behind it - the verb, the target, the payload - is one disclosure
 * away for whoever needs it, and nobody else has to read it.
 */
function Timeline({ entries, onThread }: { entries: AuditEntryDto[]; onThread?: (id: string) => void }) {
  const now = new Date();
  const days: { heading: string; rows: AuditEntryDto[] }[] = [];
  for (const entry of entries) {
    const heading = dayHeading(entry.at, now);
    const last = days.at(-1);
    if (last?.heading === heading) last.rows.push(entry);
    else days.push({ heading, rows: [entry] });
  }

  return (
    <div className="space-y-5">
      {days.map((day) => (
        <section key={day.heading}>
          <h2 className="meta mb-2 px-1">{day.heading}</h2>
          <Panel className="divide-y divide-line">
            {day.rows.map((entry) => (
              <AuditRow key={entry.id} entry={entry} onThread={onThread} />
            ))}
          </Panel>
        </section>
      ))}
    </div>
  );
}

function AuditRow({ entry, onThread }: { entry: AuditEntryDto; onThread?: (id: string) => void }) {
  const described = describeAuditEntry(entry);
  const Icon = ICONS[described.icon];
  const hasPayload = entry.metadata && Object.keys(entry.metadata).length > 0;

  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <span
        aria-hidden
        className={cn(
          "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border [&_svg]:size-4",
          TONE_CLASS[described.tone],
        )}
      >
        <Icon />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-sm text-ink">{described.title}</p>
        {described.detail ? (
          <p className="mt-0.5 text-xs leading-relaxed text-ink-muted">{described.detail}</p>
        ) : null}
        <p className="mt-1 text-xs text-ink-subtle">
          {actorWords(entry)}
          {entry.threadId && onThread ? (
            <>
              {" · "}
              <button
                type="button"
                onClick={() => onThread(entry.threadId!)}
                className="font-medium text-accent hover:underline"
              >
                Part of a hand-off - follow it
              </button>
            </>
          ) : null}
        </p>

        {hasPayload ? (
          <details className="mt-1.5">
            <summary className="cursor-pointer text-xs text-ink-subtle hover:text-ink">
              View technical details
            </summary>
            <dl className="mt-1.5 space-y-1 rounded-md border border-line bg-surface-2/60 p-2.5 text-xs">
              <div className="flex gap-2">
                <dt className="text-ink-subtle">Event</dt>
                <dd className="font-mono text-ink">{entry.action}</dd>
              </div>
              {entry.targetType ? (
                <div className="flex gap-2">
                  <dt className="text-ink-subtle">Target</dt>
                  <dd className="font-mono text-ink">
                    {entry.targetType} {entry.targetId ?? ""}
                  </dd>
                </div>
              ) : null}
              <div className="flex gap-2">
                <dt className="text-ink-subtle">Recorded</dt>
                <dd className="text-ink">{formatDateTime(entry.at, { withSeconds: true })}</dd>
              </div>
              <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap break-all font-mono text-meta text-ink-muted">
                {JSON.stringify(entry.metadata, null, 2)}
              </pre>
            </dl>
          </details>
        ) : null}
      </div>

      <time
        className="shrink-0 whitespace-nowrap text-xs tabular-nums text-ink-muted"
        dateTime={entry.at}
        title={formatDateTime(entry.at, { withSeconds: true })}
      >
        {timeOfDay(entry.at)}
      </time>
    </div>
  );
}
