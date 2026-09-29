"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRightLeft, ChevronRight } from "lucide-react";
import {
  InsightCollaborationIcon,
  InsightTasksRunIcon,
  InsightTelemetryEmptyIcon,
  InsightTimeSavedIcon,
  InsightCostIcon,
} from "@/components/icons/insights-icons";
import { Page, PageBody, PageHeader, PageToolbar } from "@/components/page-header";
import { AgentAvatar } from "@/components/ui/avatar";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Note, type NoteTone } from "@/components/ui/note";
import { SectionTab } from "@/components/ui/section-tab";
import { Panel } from "@/components/ui/panel";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, ErrorState, LoadingKpis, LoadingRows } from "@/components/ui/states";
import { useAnalytics } from "@/hooks/use-admin-data";
import { errorMessage } from "@/lib/api-client";
import { formatDateTime, formatRelativeTime, formatTime } from "@/lib/utils";
import {
  costCaption,
  formatHours,
  humanDuration,
  tasksCaption,
  timeSaved,
} from "@/lib/insight-copy";

/** One headline figure. The line stays on one line; the fuller reading is the tooltip. */
const STAT_TONES: Record<string, NoteTone> = {
  "Tasks done on their own": "mint",
  "Tokens used": "sky",
  "Hours saved for your team": "lemon",
  "Collaboration between agents": "lilac",
};

function StatCard({
  label,
  icon: Icon,
  value,
  line,
  hint,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  value: string;
  line: string;
  hint: string;
}) {
  return (
    // Health-style: the category in the tint, the number large, one quiet line.
    <Note tone={STAT_TONES[label] ?? "sky"} className="p-5 text-note-ink" title={hint}>
      <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
        <Icon className="size-4 shrink-0" />
        {label}
      </p>
      <p className="mt-3 font-display text-display font-bold leading-none tracking-tight text-ink tabular-nums">{value}</p>
      <p className="mt-2 truncate text-sm">{line}</p>
    </Note>
  );
}

function InsightHeading({ title, description }: { title: string; description: string }) {
  return (
    <div className="px-1">
      <h2>
        <SectionTab>{title}</SectionTab>
      </h2>
      <p className="mt-0.5 max-w-2xl text-sm text-ink-muted">{description}</p>
    </div>
  );
}

function money(value: number | null): string {
  if (value === null) return "—";
  return value < 0.01 && value > 0 ? "<$0.01" : `$${value.toFixed(2)}`;
}

export function InsightsView({ project }: { project: string }) {
  const [days, setDays] = React.useState("30");
  const { data, isPending, error, refetch, isRefetching } = useAnalytics(project, Number(days));

  const saved = React.useMemo(() => {
    if (!data) return { hours: 0, caption: "" };
    return timeSaved(data.totals.conversations, data.work.totals.done);
  }, [data]);

  const totalTokens = React.useMemo(() => {
    if (!data) return 0;
    return data.work.totals.inputTokens + data.work.totals.outputTokens;
  }, [data]);

  return (
    <Page>
      <PageHeader
        title="Insights"
        description="Executive summary of your autonomous AI workforce: tasks done on their own, tokens used, time saved and multi-agent collaboration."
      />

      <PageToolbar>
        {/* Three fixed choices: a segmented control, not a dropdown. */}
        <Tabs value={days} onValueChange={setDays}>
          <TabsList aria-label="Time range">
            <TabsTrigger value="7">7 days</TabsTrigger>
            <TabsTrigger value="30">30 days</TabsTrigger>
            <TabsTrigger value="90">90 days</TabsTrigger>
          </TabsList>
        </Tabs>
      </PageToolbar>

      <PageBody className="space-y-6">
        {isPending ? (
          <>
            <LoadingKpis />
            <LoadingRows count={3} />
          </>
        ) : error ? (
          <ErrorState
            message={errorMessage(error)}
            onRetry={() => void refetch()}
            retrying={isRefetching}
          />
        ) : data!.work.totals.runs === 0 && totalTokens === 0 ? (
          <EmptyState
            icon={InsightTelemetryEmptyIcon}
            title="Nothing to measure yet"
            description="Insights populate once your published agents run autonomous tasks on a schedule, trigger workflows, or collaborate with each other."
            action={
              <Button asChild variant="secondary">
                <Link href={`/p/${project}/roster`}>Go to the roster</Link>
              </Button>
            }
          />
        ) : (
          <>
            {/* Four figures, two across until there is room for four: each card is a
                label, a number and one short line; the longer reading is its tooltip. */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-4">
              <StatCard
                label="Tasks done on their own"
                icon={InsightTasksRunIcon}
                value={data!.work.totals.runs.toLocaleString()}
                line={`${data!.work.totals.done} done · ${data!.work.totals.failed} stopped · ${data!.work.totals.awaiting} waiting`}
                hint={tasksCaption({
                  runs: data!.work.totals.runs,
                  previousRuns: data!.previous.runs,
                  done: data!.work.totals.done,
                  failed: data!.work.totals.failed,
                  awaiting: data!.work.totals.awaiting,
                  days: data!.days,
                })}
              />
              <StatCard
                label="Tokens used"
                icon={InsightCostIcon}
                value={totalTokens.toLocaleString()}
                line={`About ${money(data!.work.totals.costUsd)} · ${data!.work.totals.inputTokens.toLocaleString()} in / ${data!.work.totals.outputTokens.toLocaleString()} out`}
                hint={costCaption({
                  costUsd: data!.work.totals.costUsd,
                  runs: data!.work.totals.runs,
                  conversations: data!.totals.conversations,
                  unpricedModels: data!.work.totals.unpricedModels,
                  days: data!.days,
                })}
              />
              <StatCard
                label="Hours saved for your team"
                icon={InsightTimeSavedIcon}
                value={formatHours(saved.hours)}
                line={
                  data!.work.totals.approvalTurnaroundMs === null
                    ? "Estimate from finished work"
                    : `Estimate · you decide in ${humanDuration(data!.work.totals.approvalTurnaroundMs)}`
                }
                hint={saved.caption}
              />
              <StatCard
                label="Collaboration between agents"
                icon={InsightCollaborationIcon}
                value={data!.collab.total.toLocaleString()}
                line={`${data!.collab.delegations} task handoffs · ${data!.collab.transfers} chat transfers`}
                hint="Autonomous tasks and client inquiries routed between specialized team members."
              />
            </div>

            {/* Collaboration between agents: heading above its group, as a native settings list. */}
            <section className="space-y-2">
              <InsightHeading
                title="Collaboration between agents"
                description="Work handed off between specialised roles: research delegated to analysts, copy requests to marketers, and customer transfers."
              />
              <Panel className="overflow-hidden">
                {data!.collab.handoffs.length === 0 ? (
                  <EmptyState
                    icon={InsightCollaborationIcon}
                    title="No agent collaborations recorded in this window"
                    description="When an agent uses delegate_to_colleague during an autonomous run, or transfers a client conversation to a specialist on your roster, their teamwork is logged here."
                    className="py-8"
                  />
                ) : (
                  <ul className="divide-y divide-line/70">
                    {data!.collab.handoffs.map((handoff) => (
                      <li key={handoff.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5">
                            <AgentAvatar
                              name={handoff.fromAgent.name}
                              src={handoff.fromAgent.avatarUrl}
                              seed={handoff.fromAgent.id}
                              size="sm"
                            />
                            <span className="text-xs font-medium text-ink">{handoff.fromAgent.name}</span>
                          </div>

                          <ArrowRightLeft className="size-3.5 text-ink-subtle" aria-hidden />

                          <div className="flex items-center gap-1.5">
                            <AgentAvatar
                              name={handoff.toAgent.name}
                              src={handoff.toAgent.avatarUrl}
                              seed={handoff.toAgent.id}
                              size="sm"
                            />
                            <span className="text-xs font-medium text-ink">{handoff.toAgent.name}</span>
                          </div>

                          <Badge tone={handoff.type === "delegation" ? "accent" : "neutral"} className="ml-1 text-meta">
                            {handoff.type === "delegation" ? "Delegated task" : "Transferred chat"}
                          </Badge>
                        </div>

                        <div className="min-w-0 flex-1 px-2 sm:max-w-md">
                          <p className="truncate text-xs text-ink">{handoff.summary}</p>
                        </div>

                        <div className="flex items-center gap-3 text-right">
                          <StatusBadge status={handoff.status} />
                          <span className="meta text-xs" title={formatDateTime(handoff.createdAt)}>
                            {formatTime(handoff.createdAt)} · {formatRelativeTime(handoff.createdAt)}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </Panel>
            </section>

            {/* What each agent did on its own */}
            <section className="space-y-2">
              <InsightHeading
                title="What each agent did on its own"
                description={`Autonomous work in the last ${days} days: tasks, how they ended, what waits on you, tokens and cost.`}
              />
              <Panel className="overflow-hidden px-4 py-3">
                {data!.work.agents.length === 0 ? (
                  <EmptyState
                    icon={InsightTelemetryEmptyIcon}
                    title="No autonomous work yet"
                    description="Give an agent a scope of work with a schedule, webhook, or initiate a run to see independent activity here."
                    className="py-8"
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[50rem] text-left text-sm">
                      <thead>
                        <tr className="border-b border-line">
                          <th scope="col" className="pb-2 pr-3 meta font-medium">Agent</th>
                          <th scope="col" className="pb-2 px-3 meta font-medium text-right">Tasks</th>
                          <th scope="col" className="pb-2 px-3 meta font-medium text-right">Finished</th>
                          <th scope="col" className="pb-2 px-3 meta font-medium text-right">Stopped</th>
                          <th scope="col" className="pb-2 px-3 meta font-medium text-right">Waiting on you</th>
                          <th scope="col" className="pb-2 px-3 meta font-medium text-right">You decide in</th>
                          <th scope="col" className="pb-2 px-3 meta font-medium text-right">Tokens used</th>
                          <th scope="col" className="pb-2 pl-3 meta font-medium text-right">Cost</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {data!.work.agents.map((agent) => {
                          const agentTokens = agent.inputTokens + agent.outputTokens;
                          return (
                            <tr key={agent.id} className="transition-colors hover:bg-surface-2/60">
                              <td className="py-2.5 pr-3">
                                <Link
                                  href={`/p/${project}/agents/${agent.id}`}
                                  className="flex items-center gap-2.5 hover:underline"
                                >
                                  <AgentAvatar
                                    name={agent.name}
                                    src={agent.avatarUrl}
                                    seed={agent.id}
                                    size="sm"
                                  />
                                  <span className="min-w-0">
                                    <span className="block truncate font-medium text-ink">{agent.name}</span>
                                    <span className="block truncate text-xs text-ink-muted">{agent.jobTitle}</span>
                                  </span>
                                </Link>
                              </td>
                              <td className="py-2.5 px-3 text-right tabular-nums">{agent.runs}</td>
                              <td className="py-2.5 px-3 text-right tabular-nums text-positive">{agent.done}</td>
                              <td className={`py-2.5 px-3 text-right tabular-nums ${agent.failed > 0 ? "text-danger" : ""}`}>
                                {agent.failed}
                              </td>
                              <td className="py-2.5 px-3 text-right tabular-nums">{agent.awaiting}</td>
                              <td className="py-2.5 px-3 text-right tabular-nums text-ink-muted">
                                {humanDuration(agent.approvalTurnaroundMs)}
                              </td>
                              <td className="py-2.5 px-3 text-right tabular-nums text-ink-muted font-mono text-xs">
                                {agentTokens.toLocaleString()}
                              </td>
                              <td className="py-2.5 pl-3 text-right tabular-nums font-medium text-ink">
                                {money(agent.costUsd)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </Panel>
            </section>

            {/* The one way into the detailed view: a plain row, like a settings link. */}
            <Panel className="overflow-hidden">
              <Link
                href={`/p/${project}/insights/detailed`}
                className="flex items-center gap-4 px-4 py-3.5 transition-colors hover:bg-surface-2/70 active:bg-surface-2"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-ink">Detailed insights</span>
                  <span className="mt-0.5 block text-sm text-ink-muted">
                    Document retrieval hit rates, questions your documents cannot answer, unhelpful replies and model pricing.
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-ink-subtle" aria-hidden />
              </Link>
            </Panel>
          </>
        )}
      </PageBody>
    </Page>
  );
}
