"use client";

import * as React from "react";
import Link from "next/link";
import { FileQuestion, Search, ThumbsDown, TrendingUp } from "lucide-react";
import { Page, PageBody, PageHeader, PageToolbar } from "@/components/page-header";
import { AgentAvatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Panel,
  PanelBody,
  PanelDescription,
  PanelHeader,
  PanelTitle,
} from "@/components/ui/panel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { EmptyState, ErrorState, LoadingKpis, LoadingRows } from "@/components/ui/states";
import { useAnalytics, type AnalyticsResponse } from "@/hooks/use-admin-data";
import { errorMessage } from "@/lib/api-client";
import { cn, formatRelativeTime } from "@/lib/utils";

function percent(value: number | null): string {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

/** Escalation is bad above a threshold; retrieval is bad below one. */
function rateTone(
  value: number | null,
  kind: "escalation" | "retrieval",
): "neutral" | "positive" | "warning" | "danger" {
  if (value === null) return "neutral";
  if (kind === "escalation") {
    if (value >= 0.4) return "danger";
    if (value >= 0.2) return "warning";
    return "positive";
  }
  if (value < 0.5) return "danger";
  if (value < 0.75) return "warning";
  return "positive";
}

export function InsightsView({ project }: { project: string }) {
  const [days, setDays] = React.useState("30");
  const { data, isPending, error, refetch, isRefetching } = useAnalytics(project, Number(days));

  return (
    <Page>
      <PageHeader
        title="Insights"
        description="How your agents are doing, and what they keep being asked that your documents cannot answer."
      />

      {/* The range picker lives in the toolbar rather than the header, so this
          tab has the same two-row chrome as the roster and the inbox. */}
      <PageToolbar>
        <p className="text-sm text-ink-muted">
          Figures cover real client conversations only; builder previews are
          excluded.
        </p>
        <div className="w-40">
          <label htmlFor="range" className="sr-only">
            Time range
          </label>
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger id="range">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </PageToolbar>

      <PageBody className="space-y-5">
        {isPending ? (
          <>
            <LoadingKpis />
            <LoadingRows count={2} />
          </>
        ) : error ? (
          <ErrorState
            message={errorMessage(error)}
            onRetry={() => void refetch()}
            retrying={isRefetching}
          />
        ) : data!.totals.conversations === 0 && data!.work.totals.runs === 0 ? (
          <EmptyState
            icon={TrendingUp}
            title="Nothing to measure yet"
            description="Insights fill in once a published agent has talked to a client or run a task on its own. Conversations, escalations, ratings, tasks and cost per agent all land here."
            action={
              <Button asChild variant="secondary">
                <Link href={`/p/${project}/roster`}>Go to the roster</Link>
              </Button>
            }
          />
        ) : (
          <>
            <KpiRow
              lead={{
                label: "Client conversations",
                value: data!.totals.conversations,
                hint: `last ${data!.days} days`,
              }}
              stats={[
                {
                  label: "Escalated to a person",
                  value: data!.totals.escalated,
                  ratio: data!.totals.conversations > 0 ? data!.totals.escalated / data!.totals.conversations : null,
                  tone: "danger",
                },
                {
                  label: "Rated helpful",
                  value: data!.totals.ratedUp,
                  ratio:
                    data!.totals.ratedUp + data!.totals.ratedDown > 0
                      ? data!.totals.ratedUp / (data!.totals.ratedUp + data!.totals.ratedDown)
                      : null,
                  tone: "positive",
                  hint: data!.totals.ratedUp + data!.totals.ratedDown > 0 ? `of ${data!.totals.ratedUp + data!.totals.ratedDown} rated` : "no ratings yet",
                },
                {
                  label: "Issues logged",
                  value: data!.totals.issues,
                  hint: `${data!.totals.suggestions} suggestions`,
                },
                {
                  label: "Document searches",
                  value: data!.totals.searches,
                  ratio: data!.totals.searches > 0 ? 1 - data!.totals.searchMisses / data!.totals.searches : null,
                  tone: "accent",
                  hint: data!.totals.searches > 0 ? "found something" : undefined,
                },
              ]}
            />

            {/* Work: what the agents did on their own, and what it cost. -------- */}
            <WorkSection work={data!.work} days={data!.days} />

            {/* Content gaps first: it is the only panel here that tells an
                admin what to actually go and do. */}
            <Panel>
              <PanelHeader>
                <div>
                  <PanelTitle>Questions your documents can&apos;t answer</PanelTitle>
                  <PanelDescription>
                    Searches that came back empty, most asked first. Each one is a
                    document worth writing.
                  </PanelDescription>
                </div>
              </PanelHeader>
              <PanelBody>
                {data!.contentGaps.length === 0 ? (
                  <EmptyState
                    icon={FileQuestion}
                    title="No gaps found"
                    description="Every search your agents ran returned something. Upload more context as new topics come up."
                    className="py-10"
                  />
                ) : (
                  <ul className="divide-y divide-line rounded-lg border border-line">
                    {data!.contentGaps.map((gap) => (
                      <li
                        key={`${gap.agentName}:${gap.query}`}
                        className="flex items-start gap-3 p-3"
                      >
                        <Search
                          className="mt-0.5 size-4 shrink-0 text-ink-subtle"
                          aria-hidden
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-ink">
                            &ldquo;{gap.query}&rdquo;
                          </p>
                          <p className="mt-1 meta">
                            {gap.agentName} · last asked{" "}
                            {formatRelativeTime(gap.lastAskedAt)}
                          </p>
                        </div>
                        <Badge tone={gap.misses > 2 ? "danger" : "warning"}>
                          {gap.misses}×
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </PanelBody>
            </Panel>

            {data!.dislikedReplies.length > 0 ? (
              <Panel>
                <PanelHeader>
                  <div>
                    <PanelTitle>Replies clients marked unhelpful</PanelTitle>
                    <PanelDescription>
                      The question, and the answer that missed. Most recent first.
                    </PanelDescription>
                  </div>
                </PanelHeader>
                <PanelBody>
                  <ul className="divide-y divide-line rounded-lg border border-line">
                    {data!.dislikedReplies.map((item) => (
                      <li key={item.messageId} className="flex items-start gap-3 p-3">
                        <ThumbsDown
                          className="mt-0.5 size-4 shrink-0 text-danger"
                          aria-hidden
                        />
                        <div className="min-w-0 flex-1 space-y-1">
                          {item.question ? (
                            <p className="text-sm font-medium text-ink">
                              &ldquo;{item.question}&rdquo;
                            </p>
                          ) : null}
                          <p className="line-clamp-2 text-sm leading-relaxed text-ink-muted">
                            {item.reply}
                          </p>
                          <p className="meta">
                            {item.agentName} · {formatRelativeTime(item.ratedAt)} ·{" "}
                            <Link
                              href={`/p/${project}/inbox/${item.conversationId}`}
                              className="text-accent hover:underline"
                            >
                              View conversation
                            </Link>
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </PanelBody>
              </Panel>
            ) : null}

            <Panel>
              <PanelHeader>
                <div>
                  <PanelTitle>Per agent</PanelTitle>
                  <PanelDescription>
                    A high escalation rate or a low retrieval rate usually means
                    missing context, not a bad persona.
                  </PanelDescription>
                </div>
              </PanelHeader>
              <PanelBody>
                {data!.agents.length === 0 ? (
                  <EmptyState
                    icon={TrendingUp}
                    title="Nothing to measure yet"
                    description="Once clients start talking to a published agent, its numbers show up here."
                    className="py-10"
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[42rem] text-left text-sm">
                      <thead>
                        <tr className="border-b border-line">
                          <th scope="col" className="pb-2 pr-3 meta font-medium">
                            Agent
                          </th>
                          <th scope="col" className="pb-2 px-3 meta font-medium text-right">
                            Conversations
                          </th>
                          <th scope="col" className="pb-2 px-3 meta font-medium text-right">
                            Escalated
                          </th>
                          <th scope="col" className="pb-2 px-3 meta font-medium text-right">
                            Issues
                          </th>
                          <th scope="col" className="pb-2 px-3 meta font-medium text-right">
                            Searches
                          </th>
                          <th scope="col" className="pb-2 px-3 meta font-medium text-right">
                            Found
                          </th>
                          <th scope="col" className="pb-2 pl-3 meta font-medium text-right">
                            Helpful
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {data!.agents.map((agent) => (
                          <tr key={agent.id}>
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
                                  <span className="block truncate text-sm font-medium text-ink">
                                    {agent.name}
                                  </span>
                                  <span className="block truncate text-xs text-ink-muted">
                                    {agent.jobTitle}
                                  </span>
                                </span>
                              </Link>
                            </td>
                            <td className="px-3 text-right tabular-nums text-ink">
                              {agent.conversations}
                            </td>
                            <td className="px-3 text-right">
                              <span
                                className={cn(
                                  "tabular-nums",
                                  rateTone(agent.escalationRate, "escalation") === "danger" &&
                                    "text-danger",
                                  rateTone(agent.escalationRate, "escalation") === "warning" &&
                                    "text-warning",
                                )}
                              >
                                {percent(agent.escalationRate)}
                              </span>
                            </td>
                            <td className="px-3 text-right tabular-nums text-ink-muted">
                              {agent.issues}
                            </td>
                            <td className="px-3 text-right tabular-nums text-ink-muted">
                              {agent.searches}
                            </td>
                            <td className="px-3 text-right">
                              <span
                                className={cn(
                                  "tabular-nums",
                                  rateTone(agent.retrievalHitRate, "retrieval") === "danger" &&
                                    "text-danger",
                                  rateTone(agent.retrievalHitRate, "retrieval") === "warning" &&
                                    "text-warning",
                                )}
                              >
                                {percent(agent.retrievalHitRate)}
                              </span>
                            </td>
                            <td className="pl-3 text-right">
                              <span
                                className={cn(
                                  "tabular-nums",
                                  rateTone(agent.satisfaction, "retrieval") === "danger" &&
                                    "text-danger",
                                  rateTone(agent.satisfaction, "retrieval") === "warning" &&
                                    "text-warning",
                                )}
                                title={
                                  agent.satisfaction === null
                                    ? "No ratings yet"
                                    : `${agent.ratedUp} helpful, ${agent.ratedDown} not`
                                }
                              >
                                {percent(agent.satisfaction)}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </PanelBody>
            </Panel>
          </>
        )}
      </PageBody>
    </Page>
  );
}

function money(value: number | null): string {
  if (value === null) return "—";
  return value < 0.01 && value > 0 ? "<$0.01" : `$${value.toFixed(2)}`;
}

function duration(ms: number | null): string {
  if (ms === null) return "—";
  const minutes = ms / 60_000;
  if (minutes < 1) return "<1 min";
  if (minutes < 90) return `${Math.round(minutes)} min`;
  const hours = minutes / 60;
  if (hours < 36) return `${hours.toFixed(1)} h`;
  return `${(hours / 24).toFixed(1)} d`;
}

function WorkSection({ work, days }: { work: AnalyticsResponse["work"]; days: number }) {
  const { totals, agents } = work;
  const periodLabel =
    totals.periods.length === 1 ? totals.periods[0] : `${totals.periods[0]} to ${totals.periods.at(-1)}`;
  return (
    <>
      <KpiRow
        lead={{
          label: "Model cost",
          value: money(totals.costUsd),
          hint: `${periodLabel} · ${(totals.inputTokens + totals.outputTokens).toLocaleString()} tokens${
            totals.unpricedModels.length > 0 ? ` · no price for ${totals.unpricedModels.join(", ")}` : ""
          }`,
        }}
        stats={[
          { label: "Tasks run", value: totals.runs, hint: `last ${days} days` },
          {
            label: "Completed",
            value: totals.done,
            ratio: totals.runs > 0 ? totals.done / totals.runs : null,
            tone: "positive",
          },
          {
            label: "Failed",
            value: totals.failed,
            ratio: totals.runs > 0 ? totals.failed / totals.runs : null,
            tone: "danger",
            hint: totals.escalated > 0 ? `${totals.escalated} escalated by an agent` : undefined,
          },
          {
            label: "Awaiting approval",
            value: totals.awaiting,
            hint: `avg decision ${duration(totals.approvalTurnaroundMs)}`,
          },
        ]}
      />

      <Panel>
        <PanelHeader>
          <div>
            <PanelTitle>Work per agent</PanelTitle>
            <PanelDescription>
              Runs in the last {days} days; tokens and cost for the calendar month{totals.periods.length > 1 ? "s" : ""} they fall in.
              The cost column is what billing will meter.
            </PanelDescription>
          </div>
        </PanelHeader>
        <PanelBody>
          {agents.length === 0 ? (
            <EmptyState
              icon={TrendingUp}
              title="No autonomous work yet"
              description="Give an agent a scope of work with a schedule or webhook, or run one by hand, and its tasks and cost show up here."
              className="py-10"
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[48rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-line">
                    <th scope="col" className="pb-2 pr-3 meta font-medium">Agent</th>
                    <th scope="col" className="pb-2 px-3 meta font-medium text-right">Runs</th>
                    <th scope="col" className="pb-2 px-3 meta font-medium text-right">Done</th>
                    <th scope="col" className="pb-2 px-3 meta font-medium text-right">Failed</th>
                    <th scope="col" className="pb-2 px-3 meta font-medium text-right">Awaiting</th>
                    <th scope="col" className="pb-2 px-3 meta font-medium text-right">Avg decision</th>
                    <th scope="col" className="pb-2 px-3 meta font-medium text-right">Tokens</th>
                    <th scope="col" className="pb-2 px-3 meta font-medium text-right">Searches</th>
                    <th scope="col" className="pb-2 pl-3 meta font-medium text-right">Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {agents.map((agent) => (
                    <tr key={agent.id}>
                      <td className="py-2.5 pr-3">
                        <span className="font-medium text-ink">{agent.name}</span>
                        <span className="ml-2 text-xs text-ink-muted">{agent.jobTitle}</span>
                        {agent.escalated > 0 ? (
                          <span className="ml-2 text-xs text-danger">{agent.escalated} escalated</span>
                        ) : null}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums">{agent.runs}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums">{agent.done}</td>
                      <td className={`py-2.5 px-3 text-right tabular-nums ${agent.failed > 0 ? "text-danger" : ""}`}>{agent.failed}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums">{agent.awaiting}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-ink-muted">{duration(agent.approvalTurnaroundMs)}</td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-ink-muted">
                        {(agent.inputTokens + agent.outputTokens).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-right tabular-nums text-ink-muted">{agent.searches}</td>
                      <td className="py-2.5 pl-3 text-right tabular-nums font-medium text-ink">{money(agent.costUsd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </PanelBody>
      </Panel>
    </>
  );
}

/**
 * One KPI style for the whole dashboard: a lead card with the number that
 * matters most, and the numbers that explain it beside it - each with the
 * same slim ratio bar where a share is the point. No equally-sized tiles.
 */
function KpiRow({
  lead,
  stats,
}: {
  lead: { label: string; value: number | string; hint?: string };
  stats: {
    label: string;
    value: number | string;
    hint?: string;
    ratio?: number | null;
    tone?: "accent" | "positive" | "warning" | "danger";
  }[];
}) {
  return (
    <div className="grid gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <Panel className="flex flex-col justify-between p-5">
        <p className="meta">{lead.label}</p>
        <p className="mt-2 text-display font-semibold leading-none tracking-tight text-ink tabular-nums">
          {typeof lead.value === "number" ? lead.value.toLocaleString() : lead.value}
        </p>
        {lead.hint ? <p className="mt-3 text-sm text-ink-muted">{lead.hint}</p> : null}
      </Panel>
      <dl className="grid gap-3 sm:grid-cols-2">
        {stats.map((stat) => (
          <Panel key={stat.label} className="p-4">
            <dt className="meta">{stat.label}</dt>
            <dd className="mt-1 flex items-baseline gap-2">
              <span className="text-xl font-semibold tabular-nums text-ink">
                {typeof stat.value === "number" ? stat.value.toLocaleString() : stat.value}
              </span>
              {stat.ratio !== null && stat.ratio !== undefined ? (
                <span className="text-sm text-ink-muted">{percent(stat.ratio)}</span>
              ) : null}
            </dd>
            {stat.ratio !== null && stat.ratio !== undefined ? (
              <RatioBar value={stat.ratio} tone={stat.tone ?? "accent"} />
            ) : null}
            {stat.hint ? <dd className="mt-1 text-xs text-ink-muted">{stat.hint}</dd> : null}
          </Panel>
        ))}
      </dl>
    </div>
  );
}

const BAR_TONE = {
  accent: "bg-accent",
  positive: "bg-positive",
  warning: "bg-warning",
  danger: "bg-danger",
} as const;

/** The one chart shape here: a share of a whole, as a bar. */
function RatioBar({ value, tone }: { value: number; tone: keyof typeof BAR_TONE }) {
  const width = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3" aria-hidden>
      <div className={`h-full rounded-full ${BAR_TONE[tone]}`} style={{ width: `${width}%` }} />
    </div>
  );
}
