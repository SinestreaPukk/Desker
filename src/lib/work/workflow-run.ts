/**
 * Running the named workflows (workflows.ts): start one, move it on when a
 * step finishes, and read back where each one is.
 *
 * A step is an ordinary run. The first starts like any manual run; each later
 * one is created as a hand-off (`colleague_delegation`) from the step before,
 * carrying that step's results - so it shows in the hand-off thread, the team
 * chat and the Audit log like any other hand-off, and nothing is tracked
 * twice. The runner calls advanceWorkflow() whenever a run finishes.
 */
import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { canStartRun } from "@/lib/billing/limits";
import { HttpError } from "@/lib/http-error";
import { dispatchRun, startRun } from "./scope";
import { currentStep, stepState, workflowById, type StepState, type WorkflowTag } from "./workflows";

// ponytail: the newest 400 runs in a project hold every recent workflow; a WorkflowRun table if history must go further back.
const RECENT = 400;

export function workflowTag(payload: unknown): WorkflowTag | null {
  const tag = (payload as { workflow?: WorkflowTag } | null)?.workflow;
  return tag && typeof tag.id === "string" && Array.isArray(tag.agents) ? tag : null;
}

export async function startWorkflow(input: {
  workflowId: string;
  projectId: string;
  organizationId: string;
  text: string;
  agentIds: string[];
  /** Who started it: a person, or (for the support inbox) an outside system. */
  userId: string | null;
  /** An outside sender's extras: kept on the first step's payload, e.g. the ticket. */
  extra?: Record<string, unknown>;
  /** Unique per outside message, so a sender retrying a delivery never starts two. */
  dedupeKey?: string;
}): Promise<{ id: string } | null> {
  const workflow = workflowById(input.workflowId);
  if (!workflow) throw new HttpError(404, "That workflow does not exist.");
  if (!workflow.input.optional && !input.text.trim()) {
    throw new HttpError(422, `${workflow.input.label} - it needs something to work on.`);
  }
  if (input.agentIds.length !== workflow.steps.length) {
    throw new HttpError(422, `Choose an agent for each of the ${workflow.steps.length} steps.`);
  }
  const agents = await prisma.agent.findMany({
    where: { id: { in: input.agentIds }, projectId: input.projectId },
    select: { id: true, name: true, status: true },
  });
  for (const [index, agentId] of input.agentIds.entries()) {
    const agent = agents.find((row) => row.id === agentId);
    if (!agent) throw new HttpError(422, `Step ${index + 1} needs an agent from this project.`);
    if (agent.status !== "published") throw new HttpError(422, `${agent.name} isn't switched on yet - publish it first.`);
  }

  const tag: WorkflowTag = { id: workflow.id, rootId: null, step: 0, agents: input.agentIds, input: input.text };
  const run = await startRun({
    agentId: input.agentIds[0]!,
    trigger: input.userId ? "manual" : "webhook",
    payload: { instruction: workflow.steps[0]!.instruction(input.text), workflow: tag, ...(input.extra ?? {}) },
    dedupeKey: input.dedupeKey,
    actor: input.userId ? { type: "user", id: input.userId } : { type: "system" },
  });
  // A duplicate delivery of the same outside message: already started once.
  if (!run) return null;
  await audit({
    organizationId: input.organizationId,
    actorType: input.userId ? "user" : "system",
    actorId: input.userId,
    action: "workflow.started",
    targetType: "action_item",
    targetId: run.id,
    metadata: { workflow: workflow.id, name: workflow.name, steps: workflow.steps.length },
  });
  return { id: run.id };
}

/** What a finished step hands the next one: its account, then what it found. */
function handoverContext(result: unknown): string {
  const data = (result as { summary?: string; findings?: { query: string; findings: string }[] } | null) ?? {};
  const findings = (data.findings ?? []).map((finding) => `On "${finding.query}":\n${finding.findings}`).join("\n\n");
  return [data.summary ?? "", findings ? `What it found:\n${findings}` : ""].filter(Boolean).join("\n\n").slice(0, 8000);
}

/**
 * When a workflow step finishes, starts the next one with its results. Safe
 * to call for any run and more than once: it does nothing for a run that is
 * not a finished workflow step, or whose next step already exists.
 */
export async function advanceWorkflow(actionItemId: string): Promise<void> {
  const item = await prisma.actionItem.findUnique({
    where: { id: actionItemId },
    select: {
      id: true,
      status: true,
      organizationId: true,
      agentId: true,
      payload: true,
      result: true,
      agent: { select: { name: true } },
    },
  });
  const tag = item ? workflowTag(item.payload) : null;
  const workflow = tag ? workflowById(tag.id) : null;
  if (!item || !tag || !workflow || item.status !== "done") return;
  const next = tag.step + 1;
  if (next >= workflow.steps.length || next >= tag.agents.length) return;

  const already = await prisma.actionItem.count({ where: { parentId: item.id, type: "colleague_delegation" } });
  if (already > 0) return;

  const nextAgent = await prisma.agent.findFirst({
    where: { id: tag.agents[next]!, status: "published" },
    select: { id: true },
  });
  const allowed = await canStartRun(item.organizationId);
  if (!nextAgent || !allowed.allowed) {
    await prisma.issue.create({
      data: {
        agentId: item.agentId,
        actionItemId: item.id,
        source: "agent",
        type: "failure",
        severity: "medium",
        summary: `The "${workflow.name}" workflow stopped before "${workflow.steps[next]!.title}"`,
        details: nextAgent ? allowed.reason : "The agent for the next step was switched off or removed.",
      },
    });
    return;
  }

  const step = await prisma.actionItem.create({
    data: {
      organizationId: item.organizationId,
      agentId: nextAgent.id,
      type: "colleague_delegation",
      trigger: "delegation",
      parentId: item.id,
      payload: {
        objective: workflow.steps[next]!.instruction(tag.input),
        context: handoverContext(item.result),
        delegatedByAgentId: item.agentId,
        delegatedByAgentName: item.agent.name,
        workflow: { ...tag, rootId: tag.rootId ?? item.id, step: next },
      } as Prisma.InputJsonValue,
    },
    select: { id: true },
  });
  await dispatchRun(step.id, item.organizationId);
}

export interface WorkflowRunView {
  rootId: string;
  workflowId: string;
  name: string;
  input: string;
  startedAt: string;
  current: number;
  steps: {
    title: string;
    roleLabel: string;
    agent: { id: string; name: string; avatarUrl: string | null } | null;
    runId: string | null;
    state: StepState;
  }[];
}

/** Every recent workflow in the project, each with where its work is now. */
export async function workflowRuns(projectId: string): Promise<WorkflowRunView[]> {
  const [runs, agents] = await Promise.all([
    prisma.actionItem.findMany({
      where: { agent: { projectId } },
      orderBy: { createdAt: "desc" },
      take: RECENT,
      select: {
        id: true,
        status: true,
        payload: true,
        createdAt: true,
        _count: { select: { issues: { where: { status: "open" } } } },
      },
    }),
    prisma.agent.findMany({ where: { projectId }, select: { id: true, name: true, avatarUrl: true } }),
  ]);

  const byRoot = new Map<string, { tag: WorkflowTag; items: typeof runs }>();
  for (const run of runs) {
    const tag = workflowTag(run.payload);
    if (!tag) continue;
    const rootId = tag.rootId ?? run.id;
    const entry = byRoot.get(rootId) ?? { tag, items: [] };
    if (!tag.rootId) entry.tag = tag;
    entry.items.push(run);
    byRoot.set(rootId, entry);
  }

  const views: WorkflowRunView[] = [];
  for (const [rootId, { tag, items }] of byRoot) {
    const workflow = workflowById(tag.id);
    const root = items.find((item) => item.id === rootId);
    if (!workflow || !root) continue;
    const steps = workflow.steps.map((step, index) => {
      // The newest run for a step wins: a retried step replaces the failed one.
      const run = items.find((item) => workflowTag(item.payload)?.step === index) ?? null;
      const agent = agents.find((row) => row.id === tag.agents[index]) ?? null;
      return {
        title: step.title,
        roleLabel: step.roleLabel,
        agent,
        runId: run?.id ?? null,
        state: stepState(run?.status ?? null, (run?._count.issues ?? 0) > 0),
      };
    });
    views.push({
      rootId,
      workflowId: workflow.id,
      name: workflow.name,
      input: tag.input,
      startedAt: root.createdAt.toISOString(),
      current: currentStep(steps.map((step) => step.state)),
      steps,
    });
  }
  return views.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}
