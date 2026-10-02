"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowRight, CalendarDays, Check, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Panel, PanelBody } from "@/components/ui/panel";
import { FormError } from "@/components/ui/states";
import { SampleRun } from "@/components/first-run/sample-run";
import { BoundariesCard } from "@/components/builder/boundaries-card";
import { ContextQuestions } from "@/components/builder/context-questions";
import { browserTimezone } from "@/components/builder/scope-of-work-form";
import { useAgents, useCreateAgent } from "@/hooks/use-admin-data";
import { useIntegrations, useOAuthProviders, useProjectContext, useSaveProjectContext } from "@/hooks/use-work-data";
import { api, errorMessage } from "@/lib/api-client";
import { randomAgentName } from "@/lib/agent-fields";
import { templateById } from "@/lib/content";
import { FIRST_RUN, type FirstRun } from "@/lib/first-run";
import { agentFromTemplate, scopeFromTemplate } from "@/lib/hire-from-template";
import { connectorById } from "@/lib/integrations/catalog";
import { answeredCount, contextQuestions, type ContextAnswers } from "@/lib/work/context";
import { cn } from "@/lib/utils";

/**
 * The first thing a new space sees: one named workflow and what it produces,
 * a sample run of it on example data that the owner steps through, then the
 * few steps that make it real - their own policy or calendar, the one
 * connection that matters, and a first real run. The role catalog is one
 * link away, not the front door.
 */
export function StartView({ project }: { project: string }) {
  const run = FIRST_RUN;
  const toSetup = () => document.getElementById("setup")?.scrollIntoView({ block: "start" });

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8 sm:py-10">
      <header>
        <p className="eyebrow">Your first run</p>
        <h1 className="mt-1 text-xl font-bold tracking-tight text-ink">{run.name}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted">
          {run.result} Step through it once on example data, then set it up with your own calendar.
        </p>
      </header>

      <Panel>
        <PanelBody className="pt-5">
          <SampleRun
            run={run}
            footer={
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={toSetup}>
                  Set it up with your own calendar
                  <ArrowDown aria-hidden />
                </Button>
                <Button asChild variant="ghost">
                  <Link href={`/p/${project}/agents/new`}>See every role instead</Link>
                </Button>
              </div>
            }
          />
        </PanelBody>
      </Panel>

      <section id="setup" className="scroll-mt-4 space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold text-ink">Make it yours</h2>
            <p className="text-sm text-ink-muted">Three steps. Nothing goes out without your approval.</p>
          </div>
          <Link href={`/p/${project}/agents/new`} className="text-sm font-medium text-accent hover:underline">
            Or pick a different role
          </Link>
        </div>
        <WeekSetup project={project} run={run} />
      </section>
    </div>
  );
}

/** The agent the first run is built on: found by its role, or hired from it on first use. */
function useWedgeAgent(project: string, run: FirstRun) {
  const client = useQueryClient();
  const agents = useAgents(project);
  const create = useCreateAgent(project);
  const template = templateById(run.templateId)!;
  // The switched-on one first, when there is more than one of the role.
  const matching = (agents.data ?? []).filter((row) => row.templateId === run.templateId);
  const agent = matching.find((row) => row.status === "published") ?? matching[0] ?? null;
  // A second click before the list refetches must not hire a second one - nor
  // a retry after its settings failed to save: the agent exists by then.
  const creating = React.useRef<Promise<string> | null>(null);
  const created = React.useRef<string | null>(null);

  function ensure(): Promise<string> {
    if (agent) return Promise.resolve(agent.id);
    creating.current ??= (async () => {
      created.current ??= (await create.mutateAsync(agentFromTemplate(template, randomAgentName()))).id;
      await api(`/api/agents/${created.current}/scope`, {
        method: "PUT",
        body: JSON.stringify(scopeFromTemplate(template, browserTimezone())),
      });
      return created.current;
    })().catch((error) => {
      creating.current = null;
      throw error;
    });
    return creating.current;
  }

  async function switchOn(agentId: string) {
    await api(`/api/agents/${agentId}`, { method: "PATCH", body: JSON.stringify({ status: "published" }) });
    await client.invalidateQueries({ queryKey: ["agents"] });
  }

  return { agent, ensure, switchOn, loading: agents.isPending };
}

function Step({
  number,
  title,
  done,
  children,
}: {
  number: number;
  title: string;
  done: boolean;
  children: React.ReactNode;
}) {
  return (
    <Panel>
      <PanelBody className="space-y-3 pt-4">
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
              done ? "bg-positive-soft text-positive" : "bg-accent-soft text-accent-soft-fg",
            )}
          >
            {done ? <Check className="size-3.5" aria-label="Done" /> : number}
          </span>
          <h3 className="flex-1 text-sm font-semibold text-ink">{title}</h3>
          {done ? <Badge tone="positive">Done</Badge> : null}
        </div>
        {children}
      </PanelBody>
    </Panel>
  );
}

/** What connecting does, said before the button - so its value is seen, not assumed. */
function ConnectionPromise({ run }: { run: FirstRun }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="rounded-lg border border-accent-line bg-accent-soft/40 p-3">
        <p className="eyebrow mb-1.5">Connected, it will</p>
        <ul className="space-y-1 text-sm text-ink">
          {run.connection.withIt.map((line) => (
            <li key={line} className="flex gap-2">
              <Check className="mt-0.5 size-3.5 shrink-0 text-positive" aria-hidden />
              {line}
            </li>
          ))}
        </ul>
      </div>
      <div className="rounded-lg border border-line bg-surface-2/60 p-3">
        <p className="eyebrow mb-1.5">Not connected yet</p>
        <p className="text-sm text-ink-muted">{run.connection.without}</p>
      </div>
    </div>
  );
}

/** The four core answers, saved on their own so the owner can stop halfway through the setup. */
function AboutStep({ project, number }: { project: string; number: number }) {
  const context = useProjectContext(project);
  const save = useSaveProjectContext(project);
  const questions = contextQuestions().core;
  const [answers, setAnswers] = React.useState<ContextAnswers | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const value = answers ?? context.data?.answers ?? {};
  const saved = context.data ? context.data.answered === context.data.total : false;
  const answered = answeredCount(value, questions);

  return (
    <Step number={number} title="Tell it about you" done={saved && !answers}>
      <p className="text-sm text-ink-muted">
        Four short answers every assistant reads first, so it sounds like you.
      </p>
      <FormError message={error} />
      <ContextQuestions questions={questions} value={value} onChange={setAnswers} idPrefix="start" />
      {answers ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button
            size="sm"
            disabled={answered < questions.length}
            loading={save.isPending}
            onClick={async () => {
              setError(null);
              try {
                await save.mutateAsync(value);
                setAnswers(null);
              } catch (caught) {
                setError(errorMessage(caught));
              }
            }}
          >
            Save answers
          </Button>
          <span className="text-xs text-ink-muted" aria-live="polite">
            {answered} of {questions.length} answered{answered < questions.length ? " - all four are needed" : ""}
          </span>
        </div>
      ) : null}
    </Step>
  );
}

// --- personal: the weekly plan from your calendar ---------------------------

function WeekSetup({ project, run }: { project: string; run: FirstRun }) {
  const router = useRouter();
  const wedge = useWedgeAgent(project, run);
  const context = useProjectContext(project);
  const integrations = useIntegrations(project);
  const providers = useOAuthProviders();
  const calendar = (integrations.data ?? []).find(
    (row) => run.connection.connectors.includes(row.type) && row.state !== "disconnected",
  );
  const grounded = context.data ? context.data.answered === context.data.total : false;
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [runId, setRunId] = React.useState<string | null>(null);
  const returnTo = `/p/${project}/start#setup`;
  const agentHref = wedge.agent ? `/p/${project}/agents/${wedge.agent.id}` : null;

  async function planNow() {
    setError(null);
    setBusy(true);
    try {
      const agentId = await wedge.ensure();
      if (wedge.agent?.status !== "published") await wedge.switchOn(agentId);
      const started = await api<{ id: string; error: string | null }>(`/api/agents/${agentId}/scope/run`, {
        method: "POST",
        body: JSON.stringify({
          instruction:
            "Plan my week ahead from my calendar, as you will every Sunday: clashes, free time and what's coming up, and suggest a fix for any clash with calendar_reschedule. My email isn't needed for this.",
        }),
      });
      if (started.error) setError(started.error);
      else setRunId(started.id);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <Step number={1} title="Connect your calendar" done={Boolean(calendar)}>
        <ConnectionPromise run={run} />
        {calendar ? (
          <p className="flex items-center gap-2 text-sm text-ink">
            <CalendarDays className="size-4 text-accent" aria-hidden />
            {calendar.name} is connected{calendar.summary ? ` (${calendar.summary})` : ""}.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {run.connection.connectors.map((id) => {
              const connector = connectorById(id);
              if (!connector?.oauthProvider || !providers.data?.[connector.oauthProvider]) return null;
              return (
                <Button key={id} asChild size="sm" variant={id === run.connection.connectors[0] ? "primary" : "secondary"}>
                  <a
                    href={`/api/integrations/oauth/${id}/start?project=${encodeURIComponent(project)}&returnTo=${encodeURIComponent(returnTo)}`}
                  >
                    Connect {connector.name}
                  </a>
                </Button>
              );
            })}
            <p className="w-full text-xs text-ink-muted">
              It asks for your calendar only. You can disconnect it any time under Integrations.
            </p>
          </div>
        )}
      </Step>

      <AboutStep project={project} number={2} />

      <Step number={3} title="Plan your week now" done={Boolean(runId)}>
        <FormError message={error} />
        {wedge.agent ? (
          <BoundariesCard
            agentId={wedge.agent.id}
            escalationRule={null}
            onEdit={() => router.push(agentHref!)}
            onRules={() => router.push(agentHref!)}
          />
        ) : null}
        {runId ? (
          <div className="space-y-2 rounded-lg border border-positive-line bg-positive-soft/40 p-3.5 text-sm text-ink">
            <p className="font-medium">
              Your plan is being written. Any calendar change it suggests waits for you in Needs you. From now on it
              arrives every Sunday evening.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm">
                <Link href={`/p/${project}/work/${runId}`}>
                  Read the plan
                  <ArrowRight aria-hidden />
                </Link>
              </Button>
              <Button asChild size="sm" variant="ghost">
                <Link href={`/p/${project}/needs-you`}>Open Needs you</Link>
              </Button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm text-ink-muted">
              It reads next week, writes the plan and suggests any fix - changes wait for you. Then it does this every
              Sunday at 18:00.
            </p>
            <Button disabled={!grounded || !calendar} loading={busy} onClick={() => void planNow()}>
              <Play aria-hidden />
              Plan my week
            </Button>
            {!calendar ? (
              <p className="text-xs text-ink-muted">Connect your calendar above first - the plan is built from it.</p>
            ) : !grounded ? (
              <p className="text-xs text-ink-muted">Answer the four questions above first.</p>
            ) : null}
          </>
        )}
      </Step>
    </div>
  );
}
