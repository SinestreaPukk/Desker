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
import { EmptyState, ErrorState, LoadingRows } from "@/components/ui/states";
import { useAnalytics } from "@/hooks/use-admin-data";
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
        <p className="text-[0.8125rem] text-ink-muted">
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
          <LoadingRows count={3} />
        ) : error ? (
          <ErrorState
            message={errorMessage(error)}
            onRetry={() => void refetch()}
            retrying={isRefetching}
          />
        ) : (
          <>
            <dl className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
              <Stat label="Conversations" value={data!.totals.conversations} />
              <Stat
                label="Escalated"
                value={data!.totals.escalated}
                hint={
                  data!.totals.conversations > 0
                    ? percent(data!.totals.escalated / data!.totals.conversations)
                    : undefined
                }
              />
              <Stat
                label="Issues logged"
                value={data!.totals.issues}
                hint={`${data!.totals.suggestions} suggestions`}
              />
              <Stat
                label="Rated helpful"
                value={data!.totals.ratedUp}
                hint={
                  data!.totals.ratedUp + data!.totals.ratedDown > 0
                    ? `${percent(
                        data!.totals.ratedUp /
                          (data!.totals.ratedUp + data!.totals.ratedDown),
                      )} of ${data!.totals.ratedUp + data!.totals.ratedDown} rated`
                    : "no ratings yet"
                }
              />
              <Stat
                label="Searches"
                value={data!.totals.searches}
                hint={
                  data!.totals.searches > 0
                    ? `${percent(
                        1 - data!.totals.searchMisses / data!.totals.searches,
                      )} found something`
                    : undefined
                }
              />
            </dl>

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
                  <ul className="divide-y divide-line rounded-xl border border-line">
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
                          <p className="text-[0.8125rem] text-ink">
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
                  <ul className="divide-y divide-line rounded-xl border border-line">
                    {data!.dislikedReplies.map((item) => (
                      <li key={item.messageId} className="flex items-start gap-3 p-3">
                        <ThumbsDown
                          className="mt-0.5 size-4 shrink-0 text-danger"
                          aria-hidden
                        />
                        <div className="min-w-0 flex-1 space-y-1">
                          {item.question ? (
                            <p className="text-[0.8125rem] font-medium text-ink">
                              &ldquo;{item.question}&rdquo;
                            </p>
                          ) : null}
                          <p className="line-clamp-2 text-[0.8125rem] leading-relaxed text-ink-muted">
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
                                  <span className="block truncate text-[0.8125rem] font-medium text-ink">
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

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <Panel className="p-4">
      <dt className="meta">{label}</dt>
      <dd className="mt-1 text-2xl font-semibold tabular-nums text-ink">{value}</dd>
      {hint ? <dd className="mt-0.5 text-xs text-ink-muted">{hint}</dd> : null}
    </Panel>
  );
}
