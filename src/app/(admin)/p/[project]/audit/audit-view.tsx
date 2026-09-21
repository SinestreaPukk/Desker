"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { Download, ScrollText } from "lucide-react";
import { Page, PageBody, PageHeader, PageToolbar } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
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
import { formatRelativeTime } from "@/lib/utils";

const ACTOR_TONE: Record<string, "neutral" | "accent" | "positive" | "warning"> = {
  user: "accent",
  agent: "positive",
  schedule: "warning",
  system: "neutral",
};

function buildQuery(params: Record<string, string>): string {
  const search = new URLSearchParams(
    Object.entries(params).filter(([, value]) => value && value !== "all"),
  ).toString();
  return search ? `?${search}` : "";
}

/**
 * Every recorded action, newest first: what an agent did with which tool and
 * what came back, what a person approved or changed, what a schedule started.
 * Filters narrow it; Export gives the same rows as CSV.
 */
export function AuditView({ project, initialAgentId }: { project: string; initialAgentId: string }) {
  const [agentId, setAgentId] = React.useState(initialAgentId);
  const [actorType, setActorType] = React.useState("all");
  const [action, setAction] = React.useState("");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const agents = useAgents(project);

  const params = React.useMemo(
    () => ({ project, agentId, actorType, action: action.trim(), from, to: to ? `${to}T23:59:59` : "" }),
    [project, agentId, actorType, action, from, to],
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
        description="Everything your agents did, tool by tool, and everything a person decided. Nothing here can be edited."
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
            placeholder="Action, e.g. tool.called"
            className="w-48"
          />
          <label htmlFor="audit-from" className="sr-only">
            From
          </label>
          <Input id="audit-from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-40" />
          <label htmlFor="audit-to" className="sr-only">
            To
          </label>
          <Input id="audit-to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-40" />
        </div>
      </PageToolbar>

      <PageBody>
        {query.isPending ? (
          <LoadingRows count={6} />
        ) : query.error ? (
          <ErrorState message={errorMessage(query.error)} onRetry={() => void query.refetch()} />
        ) : query.data.length === 0 ? (
          <EmptyState
            icon={ScrollText}
            title="No entries match"
            description="Sign-ups, project changes, every tool an agent calls, and every approval are recorded here as they happen."
          />
        ) : (
          <Panel className="overflow-x-auto">
            <table className="w-full min-w-[56rem] table-fixed text-left text-sm">
              <thead>
                <tr className="border-b border-line">
                  <th scope="col" className="w-20 px-3 py-2 meta font-medium">When</th>
                  <th scope="col" className="w-40 px-3 py-2 meta font-medium">Who</th>
                  <th scope="col" className="w-64 px-3 py-2 meta font-medium">Action</th>
                  <th scope="col" className="w-44 px-3 py-2 meta font-medium">Target</th>
                  <th scope="col" className="px-3 py-2 meta font-medium">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {query.data.map((entry) => (
                  <AuditRow key={entry.id} entry={entry} />
                ))}
              </tbody>
            </table>
          </Panel>
        )}
      </PageBody>
    </Page>
  );
}

function AuditRow({ entry }: { entry: AuditEntryDto }) {
  const meta = entry.metadata ?? {};
  const tool = typeof meta.tool === "string" ? meta.tool : null;
  const ok = typeof meta.ok === "boolean" ? meta.ok : null;
  const detail =
    typeof meta.result === "string"
      ? meta.result
      : typeof meta.summary === "string"
        ? meta.summary
        : typeof meta.reason === "string"
          ? meta.reason
          : typeof meta.error === "string"
            ? meta.error
            : null;
  return (
    <tr className="align-top">
      <td className="whitespace-nowrap px-3 py-2 text-ink-muted" title={entry.at}>
        {formatRelativeTime(entry.at)}
      </td>
      <td className="whitespace-nowrap px-3 py-2">
        <Badge tone={ACTOR_TONE[entry.actorType] ?? "neutral"} className="mr-1.5">
          {entry.actorType}
        </Badge>
        <span className="text-ink">{entry.actorName ?? entry.actorId ?? "—"}</span>
      </td>
      <td className="px-3 py-2">
        <code className="font-mono text-xs text-ink">{entry.action}</code>
        {tool ? (
          <span className={`ml-1.5 font-mono text-xs ${ok === false ? "text-danger" : "text-ink-muted"}`}>
            {tool}
            {ok === false ? " ✗" : ""}
            {meta.gated ? " · gated" : ""}
          </span>
        ) : null}
      </td>
      <td className="px-3 py-2 text-xs text-ink-muted">
        {entry.targetType ? `${entry.targetType} ${entry.targetId?.slice(-6) ?? ""}` : "—"}
        {typeof meta.trigger === "string" ? ` · ${meta.trigger}` : ""}
      </td>
      <td className="max-w-md px-3 py-2">
        {meta.input && typeof meta.input === "object" ? (
          <pre className="mb-1 whitespace-pre-wrap break-all font-mono text-xs text-ink-muted">
            {JSON.stringify(meta.input)}
          </pre>
        ) : null}
        {detail ? <p className="line-clamp-3 whitespace-pre-wrap text-xs text-ink">{detail}</p> : null}
      </td>
    </tr>
  );
}
