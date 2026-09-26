"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  InsightConversationsIcon,
  InsightDislikedReplyIcon,
  InsightEscalationIcon,
  InsightHelpfulIcon,
  InsightKnowledgeRetrievalIcon,
  InsightMissedQueryIcon,
  InsightNoGapsIcon,
  InsightTelemetryEmptyIcon,
} from "@/components/icons/insights-icons";
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
import { useAnalytics } from "@/hooks/use-admin-data";
import { errorMessage } from "@/lib/api-client";
import { cn, formatRelativeTime } from "@/lib/utils";
import {
  conversationsCaption,
  escalationCaption,
  helpfulCaption,
  searchesCaption,
} from "@/lib/insight-copy";

function percent(value: number | null): string {
  return value === null ? "—" : `${Math.round(value * 100)}%`;
}

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

function money(value: number | null): string {
  if (value === null) return "—";
  return value < 0.01 && value > 0 ? "<$0.01" : `$${value.toFixed(2)}`;
}

export function DetailedInsightsView({ project }: { project: string }) {
  const [days, setDays] = React.useState("30");
  const { data, isPending, error, refetch, isRefetching } = useAnalytics(project, Number(days));

  return (
    <Page>
      <PageHeader
        title="Detailed Insights"
        description="Deep diagnostics on document retrieval gaps, unhelpful client replies, client escalation rates, and technical model telemetry."
      />

      <PageToolbar>
        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm">
            <Link href={`/p/${project}/insights`} className="inline-flex items-center gap-1.5">
              <ArrowLeft className="size-4" aria-hidden />
              Back to Insights Overview
            </Link>
          </Button>
        </div>
        <div className="w-40">
          <label htmlFor="detailed-range" className="sr-only">
            Time range
          </label>
          <Select value={days} onValueChange={setDays}>
            <SelectTrigger id="detailed-range">
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
        ) : data!.totals.conversations === 0 && data!.work.totals.runs === 0 ? (
          <EmptyState
            icon={InsightTelemetryEmptyIcon}
            title="No detailed data to display yet"
            description="Detailed telemetry fills in once clients interact with published agents or autonomous tasks are executed."
            action={
              <Button asChild variant="secondary">
                <Link href={`/p/${project}/insights`}>Return to Insights</Link>
              </Button>
            }
          />
        ) : (
          <>
            {/* Top diagnostic KPIs for client engagement & knowledge coverage */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Panel className="flex flex-col p-4 transition-all hover:border-line-strong hover:shadow-xs">
                <div className="flex items-center justify-between gap-2">
                  <p className="meta font-semibold">Answered from documents</p>
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-accent-line/70 bg-accent-soft text-accent-soft-fg shadow-2xs">
                    <InsightKnowledgeRetrievalIcon className="size-4" />
                  </span>
                </div>
                <div className="mt-3">
                  <p className="text-2xl font-bold tabular-nums text-ink">
                    {(data!.totals.searches - data!.totals.searchMisses).toLocaleString()}
                  </p>
                  <p className="mt-1 text-xs text-ink-muted">
                    {searchesCaption(data!.totals.searches, data!.totals.searchMisses)}
                  </p>
                </div>
              </Panel>

              <Panel className="flex flex-col p-4 transition-all hover:border-line-strong hover:shadow-xs">
                <div className="flex items-center justify-between gap-2">
                  <p className="meta font-semibold">Client conversations</p>
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-line bg-surface-2 text-ink-muted shadow-2xs">
                    <InsightConversationsIcon className="size-4" />
                  </span>
                </div>
                <div className="mt-3">
                  <p className="text-2xl font-bold tabular-nums text-ink">
                    {data!.totals.conversations.toLocaleString()}
                  </p>
                  <p className="mt-1 text-xs text-ink-muted">
                    {conversationsCaption({
                      conversations: data!.totals.conversations,
                      previousConversations: data!.previous.conversations,
                      escalated: data!.totals.escalated,
                      days: data!.days,
                    })}
                  </p>
                </div>
              </Panel>

              <Panel className="flex flex-col p-4 transition-all hover:border-line-strong hover:shadow-xs">
                <div className="flex items-center justify-between gap-2">
                  <p className="meta font-semibold">Handed to a person</p>
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-danger-line/70 bg-danger-soft text-danger shadow-2xs">
                    <InsightEscalationIcon className="size-4" />
                  </span>
                </div>
                <div className="mt-3">
                  <p className="text-2xl font-bold tabular-nums text-ink">
                    {data!.totals.escalated.toLocaleString()}
                  </p>
                  <p className="mt-1 text-xs text-ink-muted">
                    {escalationCaption(data!.totals.escalated, data!.totals.conversations)}
                  </p>
                </div>
              </Panel>

              <Panel className="flex flex-col p-4 transition-all hover:border-line-strong hover:shadow-xs">
                <div className="flex items-center justify-between gap-2">
                  <p className="meta font-semibold">Client satisfaction</p>
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-md border border-positive-line/70 bg-positive-soft text-positive shadow-2xs">
                    <InsightHelpfulIcon className="size-4" />
                  </span>
                </div>
                <div className="mt-3">
                  <p className="text-2xl font-bold tabular-nums text-ink">
                    {percent(
                      data!.totals.ratedUp + data!.totals.ratedDown > 0
                        ? data!.totals.ratedUp / (data!.totals.ratedUp + data!.totals.ratedDown)
                        : null,
                    )}
                  </p>
                  <p className="mt-1 text-xs text-ink-muted">
                    {helpfulCaption(data!.totals.ratedUp, data!.totals.ratedDown)}
                  </p>
                </div>
              </Panel>
            </div>

            {/* Questions your documents can't answer (Content gaps) */}
            <Panel>
              <PanelHeader>
                <div>
                  <PanelTitle>Questions your documents can&apos;t answer</PanelTitle>
                  <PanelDescription>
                    Searches that returned zero results, sorted by frequency. Each item highlights
                    a document or company policy worth uploading.
                  </PanelDescription>
                </div>
              </PanelHeader>
              <PanelBody>
                {data!.contentGaps.length === 0 ? (
                  <EmptyState
                    icon={InsightNoGapsIcon}
                    title="No knowledge gaps found"
                    description="Every context search your agents ran in this window found relevant document passages."
                    className="border-0 bg-transparent py-8"
                  />
                ) : (
                  <ul className="divide-y divide-line rounded-lg border border-line">
                    {data!.contentGaps.map((gap) => (
                      <li
                        key={`${gap.agentName}:${gap.query}`}
                        className="flex items-start gap-3 p-3"
                      >
                        <InsightMissedQueryIcon
                          className="mt-0.5 size-4 shrink-0 text-ink-subtle"
                          aria-hidden
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-ink">
                            &ldquo;{gap.query}&rdquo;
                          </p>
                          <p className="mt-1 meta text-xs text-ink-muted">
                            {gap.agentName} · last asked {formatRelativeTime(gap.lastAskedAt)}
                          </p>
                        </div>
                        <Badge tone={gap.misses > 2 ? "danger" : "warning"}>
                          {gap.misses} misses
                        </Badge>
                      </li>
                    ))}
                  </ul>
                )}
              </PanelBody>
            </Panel>

            {/* Replies clients marked unhelpful (Disliked replies) */}
            {data!.dislikedReplies.length > 0 ? (
              <Panel>
                <PanelHeader>
                  <div>
                    <PanelTitle>Replies clients marked unhelpful</PanelTitle>
                    <PanelDescription>
                      Customer questions that received a thumbs-down, with the agent&apos;s answer.
                    </PanelDescription>
                  </div>
                </PanelHeader>
                <PanelBody>
                  <ul className="divide-y divide-line rounded-lg border border-line">
                    {data!.dislikedReplies.map((item) => (
                      <li key={item.messageId} className="flex items-start gap-3 p-3">
                        <InsightDislikedReplyIcon
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
                          <p className="meta text-xs">
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

            {/* How each agent is doing with clients */}
            <Panel>
              <PanelHeader>
                <div>
                  <PanelTitle>How each agent is doing with clients</PanelTitle>
                  <PanelDescription>
                    Client conversations, escalations, knowledge look-ups, and ratings per agent.
                  </PanelDescription>
                </div>
              </PanelHeader>
              <PanelBody>
                {data!.agents.length === 0 ? (
                  <EmptyState
                    icon={InsightTelemetryEmptyIcon}
                    title="No client interaction metrics yet"
                    description="Metrics populate once published agents engage with clients."
                    className="py-8"
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[42rem] text-left text-sm">
                      <thead>
                        <tr className="border-b border-line">
                          <th scope="col" className="pb-2 pr-3 meta font-medium">Agent</th>
                          <th scope="col" className="pb-2 px-3 meta font-medium text-right">Conversations</th>
                          <th scope="col" className="pb-2 px-3 meta font-medium text-right">Needed a person</th>
                          <th scope="col" className="pb-2 px-3 meta font-medium text-right">Raised</th>
                          <th scope="col" className="pb-2 px-3 meta font-medium text-right">Look-ups</th>
                          <th scope="col" className="pb-2 px-3 meta font-medium text-right">Answered from documents</th>
                          <th scope="col" className="pb-2 pl-3 meta font-medium text-right">Helpful rating</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-line">
                        {data!.agents.map((agent) => (
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
                                  rateTone(agent.escalationRate, "escalation") === "danger" && "text-danger",
                                  rateTone(agent.escalationRate, "escalation") === "warning" && "text-warning",
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
                                  rateTone(agent.retrievalHitRate, "retrieval") === "danger" && "text-danger",
                                  rateTone(agent.retrievalHitRate, "retrieval") === "warning" && "text-warning",
                                )}
                              >
                                {percent(agent.retrievalHitRate)}
                              </span>
                            </td>
                            <td className="pl-3 text-right">
                              <span
                                className={cn(
                                  "tabular-nums",
                                  rateTone(agent.satisfaction, "retrieval") === "danger" && "text-danger",
                                  rateTone(agent.satisfaction, "retrieval") === "warning" && "text-warning",
                                )}
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

            {/* Model & Token Reconciliation */}
            <Panel>
              <PanelHeader>
                <div>
                  <PanelTitle>Model &amp; Token Reconciliation</PanelTitle>
                  <PanelDescription>
                    Breakdown of LLM tokens consumed per agent across billing periods and model providers.
                  </PanelDescription>
                </div>
              </PanelHeader>
              <PanelBody>
                <div className="rounded-lg border border-line bg-surface-2/40 p-4 text-xs text-ink-muted">
                  <p className="font-medium text-ink">
                    {(data!.work.totals.inputTokens + data!.work.totals.outputTokens).toLocaleString()} total tokens{" "}
                    (Input: {data!.work.totals.inputTokens.toLocaleString()} · Output: {data!.work.totals.outputTokens.toLocaleString()})
                  </p>
                  <p className="mt-1 text-ink-subtle">
                    Periods:{" "}
                    {data!.work.totals.periods.length === 1
                      ? data!.work.totals.periods[0]
                      : `${data!.work.totals.periods[0]} to ${data!.work.totals.periods.at(-1)}`}
                    {data!.work.totals.unpricedModels.length > 0
                      ? ` · No published price for ${data!.work.totals.unpricedModels.join(", ")}`
                      : ""}
                  </p>
                  <div className="mt-3 divide-y divide-line/60 border-t border-line/60 pt-2">
                    {data!.work.agents.map((agent) => (
                      <div key={agent.id} className="flex items-center justify-between py-1.5">
                        <span className="font-medium text-ink">{agent.name}</span>
                        <div className="flex items-center gap-4 text-right tabular-nums">
                          <span>{(agent.inputTokens + agent.outputTokens).toLocaleString()} tokens</span>
                          <span className="font-medium text-ink">{money(agent.costUsd)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </PanelBody>
            </Panel>
          </>
        )}
      </PageBody>
    </Page>
  );
}
