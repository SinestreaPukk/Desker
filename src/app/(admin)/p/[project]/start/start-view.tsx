"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowRight, CalendarDays, Check, Inbox, Play, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Panel, PanelBody } from "@/components/ui/panel";
import { Textarea } from "@/components/ui/field";
import { FormError } from "@/components/ui/states";
import { SampleRun } from "@/components/first-run/sample-run";
import { BoundariesCard } from "@/components/builder/boundaries-card";
import { ContextQuestions } from "@/components/builder/context-questions";
import { browserTimezone } from "@/components/builder/scope-of-work-form";
import { SupportInboxForm } from "@/components/integrations/support-inbox-form";
import { useSpaceKind } from "@/components/space-kind";
import { keys, useAgents, useCreateAgent, useDocuments } from "@/hooks/use-admin-data";
import { useIntegrations, useOAuthProviders, useProjectContext, useSaveProjectContext } from "@/hooks/use-work-data";
import { api, errorMessage } from "@/lib/api-client";
import { randomAgentName } from "@/lib/agent-fields";
import { PLANS } from "@/lib/billing/plans";
import { templateById } from "@/lib/content";
import { firstRunFor, type FirstRun } from "@/lib/first-run";
import { agentFromTemplate, scopeFromTemplate } from "@/lib/hire-from-template";
import { ACCEPTED_EXTENSIONS } from "@/lib/rag/extract-shared";
import { connectorById } from "@/lib/integrations/catalog";
import { answeredCount, contextQuestionsFor, type ContextAnswers } from "@/lib/work/context";
import { workflowById } from "@/lib/work/workflows";
import { cn } from "@/lib/utils";

/**
 * The first thing a new space sees: one named workflow and what it produces,
 * a sample run of it on example data that the owner steps through, then the
 * few steps that make it real - their own policy or calendar, the one
 * connection that matters, and a first real run. The role catalog is one
 * link away, not the front door.
 */
export function StartView({ project }: { project: string }) {
  const kind = useSpaceKind();
  const run = firstRunFor(kind);
  const toSetup = () => document.getElementById("setup")?.scrollIntoView({ block: "start" });

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-8 sm:py-10">
      <header>
        <p className="eyebrow">Your first run</p>
        <h1 className="mt-1 text-xl font-bold tracking-tight text-ink">{run.name}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted">
          {run.result} Step through it once on example data, then set it up with your own{" "}
          {kind === "business" ? "policy" : "calendar"}.
        </p>
      </header>

      <Panel>
        <PanelBody className="pt-5">
          <SampleRun
            run={run}
            footer={
              <div className="flex flex-wrap items-center gap-2">
                <Button onClick={toSetup}>
                  Set it up with your own {kind === "business" ? "policy" : "calendar"}
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
        {kind === "business" ? <SupportSetup project={project} run={run} /> : <WeekSetup project={project} run={run} />}
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
  const agent = agents.data?.find((row) => row.templateId === run.templateId) ?? null;
  // A second click before the list refetches must not hire a second one.
  const creating = React.useRef<Promise<string> | null>(null);

  function ensure(): Promise<string> {
    if (agent) return Promise.resolve(agent.id);
    creating.current ??= (async () => {
      const created = await create.mutateAsync(agentFromTemplate(template, randomAgentName()));
      await api(`/api/agents/${created.id}/scope`, {
        method: "PUT",
        body: JSON.stringify(scopeFromTemplate(template, browserTimezone())),
      });
      return created.id;
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
  const kind = useSpaceKind();
  const context = useProjectContext(project);
  const save = useSaveProjectContext(project);
  const questions = contextQuestionsFor(kind).core;
  const [answers, setAnswers] = React.useState<ContextAnswers | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const value = answers ?? context.data?.answers ?? {};
  const saved = context.data ? context.data.answered === context.data.total : false;
  const answered = answeredCount(value, questions);

  return (
    <Step number={number} title={kind === "business" ? "Tell it about your business" : "Tell it about you"} done={saved && !answers}>
      <p className="text-sm text-ink-muted">
        Four short answers every {kind === "business" ? "agent" : "assistant"} reads first, so it sounds like you.
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

// --- business: support answered from your own policy ------------------------

function SupportSetup({ project, run }: { project: string; run: FirstRun }) {
  const router = useRouter();
  const wedge = useWedgeAgent(project, run);
  const context = useProjectContext(project);
  const documents = useDocuments(wedge.agent?.id ?? null);
  const hasPolicy = (documents.data ?? []).length > 0;
  const grounded = context.data ? context.data.answered === context.data.total : false;
  const live = wedge.agent?.status === "published";
  const [error, setError] = React.useState<string | null>(null);
  const [switching, setSwitching] = React.useState(false);
  const agentHref = wedge.agent ? `/p/${project}/agents/${wedge.agent.id}` : null;

  return (
    <div className="space-y-3">
      <PolicyStep wedge={wedge} done={hasPolicy} />
      <AboutStep project={project} number={2} />
      <Step number={3} title="Switch it on and try a real question" done={false}>
        <FormError message={error} />
        {!wedge.agent || !hasPolicy || !grounded ? (
          <p className="text-sm text-ink-muted">Add your policy and the four answers first - it answers from those.</p>
        ) : !live ? (
          <div className="space-y-3">
            <p className="text-sm text-ink-muted">
              {wedge.agent.name} is ready. Here is exactly what it will and won&apos;t do once it&apos;s on:
            </p>
            <BoundariesCard
              agentId={wedge.agent.id}
              escalationRule={null}
              onEdit={() => router.push(agentHref!)}
              onRules={() => router.push(agentHref!)}
            />
            <Button
              loading={switching}
              onClick={async () => {
                setError(null);
                setSwitching(true);
                try {
                  await wedge.switchOn(wedge.agent!.id);
                } catch (caught) {
                  setError(errorMessage(caught));
                } finally {
                  setSwitching(false);
                }
              }}
            >
              Switch {wedge.agent.name} on
            </Button>
          </div>
        ) : (
          <TryQuestion project={project} agentId={wedge.agent.id} agentName={wedge.agent.name} />
        )}
      </Step>

      <Panel>
        <PanelBody className="space-y-3 pt-4">
          <div className="flex items-center gap-2">
            <Inbox className="size-4 text-accent" aria-hidden />
            <h3 className="flex-1 text-sm font-semibold text-ink">Then: connect your {run.connection.name.toLowerCase()}</h3>
          </div>
          <ConnectionPromise run={run} />
          {live ? (
            <SupportInboxForm project={project} onDone={() => undefined} />
          ) : (
            <p className="text-xs text-ink-muted">Available once {wedge.agent?.name ?? "your support agent"} is switched on.</p>
          )}
          <CostNote project={project} />
        </PanelBody>
      </Panel>
    </div>
  );
}

/** Upload the policy, or paste it: pasted text is saved as a document like any other. */
function PolicyStep({
  wedge,
  done,
}: {
  wedge: ReturnType<typeof useWedgeAgent>;
  done: boolean;
}) {
  const client = useQueryClient();
  const documents = useDocuments(wedge.agent?.id ?? null);
  const [text, setText] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function upload(file: File) {
    setError(null);
    setBusy(true);
    try {
      const agentId = await wedge.ensure();
      const form = new FormData();
      form.append("file", file);
      await api(`/api/agents/${agentId}/documents`, { method: "POST", body: form });
      await client.invalidateQueries({ queryKey: keys.documents(agentId) });
      await client.invalidateQueries({ queryKey: ["agents"] });
      setText("");
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Step number={1} title="Give it your policy" done={done}>
      <p className="text-sm text-ink-muted">
        Returns, shipping, warranty, opening hours - whatever customers ask about. It answers only from what you give it,
        and hands you anything it doesn&apos;t cover.
      </p>
      <FormError message={error} />
      {(documents.data ?? []).length > 0 ? (
        <ul className="space-y-1 text-sm">
          {(documents.data ?? []).map((doc) => (
            <li key={doc.id} className="flex items-center gap-2 text-ink">
              <Check className="size-3.5 text-positive" aria-hidden />
              {doc.filename}
              {doc.status !== "ready" ? <span className="text-xs text-ink-muted">· reading it now</span> : null}
            </li>
          ))}
        </ul>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button asChild size="sm" variant="secondary" disabled={busy}>
          <label className="cursor-pointer">
            <Upload aria-hidden />
            Upload a file
            <input
              type="file"
              className="sr-only"
              accept={ACCEPTED_EXTENSIONS.join(",")}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void upload(file);
              }}
            />
          </label>
        </Button>
        <span className="text-xs text-ink-muted">or paste it:</span>
      </div>
      <Textarea
        aria-label="Paste your policy"
        rows={4}
        value={text}
        onChange={(event) => setText(event.target.value)}
        placeholder="Unopened items can be returned within 60 days of delivery for a full refund…"
      />
      {text.trim() ? (
        <Button
          size="sm"
          loading={busy}
          onClick={() => void upload(new File([text.trim()], "policy.txt", { type: "text/plain" }))}
        >
          Save as a document
        </Button>
      ) : null}
      <p className="text-xs text-ink-muted">
        Documents stay in this space, read only by its agents.
      </p>
    </Step>
  );
}

function TryQuestion({ project, agentId, agentName }: { project: string; agentId: string; agentName: string }) {
  const client = useQueryClient();
  const workflow = workflowById("question-to-answer")!;
  const [input, setInput] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [runId, setRunId] = React.useState<string | null>(null);

  if (runId) {
    return (
      <div className="space-y-2 rounded-lg border border-positive-line bg-positive-soft/40 p-3.5 text-sm text-ink">
        <p className="font-medium">
          {agentName} is on it. In a minute or so the reply waits for you in Needs you - or, if your policy doesn&apos;t
          settle it, the question comes to you instead.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm">
            <Link href={`/p/${project}/needs-you`}>
              Open Needs you
              <ArrowRight aria-hidden />
            </Link>
          </Button>
          <Button asChild size="sm" variant="ghost">
            <Link href={`/p/${project}/work/${runId}`}>Watch the run</Link>
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setRunId(null)}>
            Try another question
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <FormError message={error} />
      <Textarea
        aria-label={workflow.input.label}
        rows={3}
        value={input}
        onChange={(event) => setInput(event.target.value)}
        placeholder={workflow.input.placeholder}
      />
      <p className="text-xs text-ink-muted">
        A real question a customer asked you, with their email address. The reply is only drafted: it waits for you.
        Before you approve one, add your business&apos;s postal address under{" "}
        <Link href={`/p/${project}/organization`} className="font-medium text-accent hover:underline">
          Organisation
        </Link>{" "}
        - the law requires it on emails to customers.
      </p>
      <Button
        disabled={!input.trim()}
        loading={busy}
        onClick={async () => {
          setError(null);
          setBusy(true);
          try {
            const started = await api<{ id: string } | null>(`/api/workflows?project=${encodeURIComponent(project)}`, {
              method: "POST",
              body: JSON.stringify({ workflowId: workflow.id, input: input.trim(), agentIds: [agentId] }),
            });
            void client.invalidateQueries({ queryKey: ["action-items"] });
            setRunId(started?.id ?? null);
          } catch (caught) {
            setError(errorMessage(caught));
          } finally {
            setBusy(false);
          }
        }}
      >
        <Play aria-hidden />
        Answer it
      </Button>
    </div>
  );
}

/** The effort and cost side, said plainly next to the thing that costs. */
function CostNote({ project }: { project: string }) {
  const free = PLANS.free.limits;
  const starter = PLANS.starter;
  return (
    <p className="border-t border-line pt-3 text-xs leading-relaxed text-ink-muted">
      <span className="font-medium text-ink">What it costs to run:</span> each question answered is one run. Free during
      the beta. After it, the Free plan covers {free.actionItemsPerMonth} runs a month with one live agent; {starter.name}{" "}
      is ${starter.priceUsd} a month for {starter.limits.actionItemsPerMonth.toLocaleString("en-US")}. Teammates can
      review replies in Needs you at no extra cost -{" "}
      <Link href={`/p/${project}/organization`} className="font-medium text-accent hover:underline">
        invite one
      </Link>
      .
    </p>
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
