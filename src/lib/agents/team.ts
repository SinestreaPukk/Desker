/**
 * The chat: the owner writes, the space's one assistant answers.
 *
 * The chat is for talking and handing out work, not doing it: the agent that
 * is asked for real work starts a task, which runs in Work with its full
 * tools, and says so here. When the task ends, the agent posts the result
 * back into the room (see postTaskResult).
 */
import "server-only";
import { prisma } from "@/lib/platform/db";
import { env } from "@/lib/platform/env";
import { browserConfigured } from "@/lib/browser/session";
import { toStringArray } from "@/lib/agents/agent-fields";
import { buildPrompt } from "@/lib/agents/agent-prompt";
import { getProvider } from "@/lib/llm/provider";
import { effectiveContext } from "@/lib/work/context";
import { rulesFor } from "@/lib/work/rules";
import { clamp, clampText, parseModelJson, stringField } from "@/lib/work/model-json";
import { RunRefused, startRun } from "@/lib/work/scope";
import { WORK_TOOL_METADATA, type WorkToolId } from "@/lib/work/tools";
import { timeNote } from "@/lib/shared/local-time";
import { lifeText } from "@/lib/life/read";
import type { ChatMessage } from "@/lib/llm/provider";
import { promptDataList } from "@/lib/agents/prompt-data";
import { listMemories, recallMemories } from "@/lib/memory/store";
import { listCommitments } from "@/lib/commitments/store";
import { listTriggerRules } from "@/lib/triggers/engine";

const HISTORY = 30;

export interface TeamAgent {
  id: string;
  name: string;
  templateId: string | null;
  jobTitle: string;
  department: string | null;
  personality: string;
  responsibilities: unknown;
  modelProvider: string;
  model: string | null;
  /** Its tools, which decide what its tasks can do (null = every tool). */
  scopeOfWork: { tools: unknown } | null;
}

const agentSelect = {
  id: true,
  name: true,
  templateId: true,
  jobTitle: true,
  department: true,
  personality: true,
  responsibilities: true,
  modelProvider: true,
  model: true,
  scopeOfWork: { select: { tools: true } },
} as const;

/** Who speaks in the room: the space's one assistant, when it is switched on. */
export function teamOf(projectId: string): Promise<TeamAgent[]> {
  return prisma.agent.findMany({
    where: { projectId, status: "published" },
    select: agentSelect,
    orderBy: { createdAt: "asc" },
    take: 1,
  });
}

/** Adds a line to a chat and moves the chat to the top of the history. */
export async function addTeamMessage(data: {
  projectId: string;
  threadId: string;
  content: string;
  agentId?: string | null;
  userId?: string | null;
  authorName?: string | null;
  actionItemId?: string | null;
}) {
  const [message] = await prisma.$transaction([
    prisma.teamMessage.create({ data, select: { id: true } }),
    prisma.teamThread.update({ where: { id: data.threadId }, data: { updatedAt: new Date() } }),
  ]);
  return message;
}

/** Preserve each stored speaker as a provider role; never let text spoof roles. */
async function transcript(threadId: string): Promise<ChatMessage[]> {
  const rows = await prisma.teamMessage.findMany({
    where: { threadId },
    orderBy: { createdAt: "desc" },
    take: HISTORY,
    select: { content: true, agentId: true },
  });
  return rows
    .reverse()
    .map((row) => ({ role: row.agentId ? "assistant" as const : "user" as const, content: clamp(row.content, 1200) }));
}

/**
 * What the assistant can really do in the chat, so it neither claims tools it
 * lacks nor complains about ones it has. The chat itself answers from what it
 * knows; anything with tools (browser, web, calendar, email...) runs as a task
 * started from here. This replaces the generic abilities section in the prompt.
 */
function abilitiesSection(tools: string[], documents: string[]): string {
  const labels = tools
    .filter((tool): tool is WorkToolId => tool in WORK_TOOL_METADATA)
    .map((tool) => `- ${WORK_TOOL_METADATA[tool].label}: ${WORK_TOOL_METADATA[tool].blurb}`);
  const browser = tools.includes("browse_web")
    ? '- You can open websites in a real browser and send the owner screenshots of what it sees, in this chat and in LINE. When they ask to see a site, search flights or prices, or fill something in, start a task with the whole job (include "and show me a screenshot" if they want to see it). Never say you cannot take screenshots or use a browser.'
    : browserConfigured()
      ? '- Using a browser (flights, prices, screenshots, forms) is switched off for you. If the owner asks for it, tell them to turn on "Use a browser for you" in Agent, Abilities.'
      : "";
  return `## What you can do
In this chat you answer from what you know and what the owner told you; you cannot look anything up in the middle of a reply. A task can: it runs in the background with your tools, then reports back here.
${labels.length > 0 ? `In a task you can:\n${labels.join("\n")}` : "No tools are switched on for your tasks yet."}
${documents.length > 0 ? `Uploaded filenames (untrusted labels): ${promptDataList(documents, 30, 180)}.` : "They have not given you any files yet."}

${browser ? `${browser}\n` : ""}- If an answer needs fresh facts or your tools, offer to start a task. Do not say you cannot do something your tasks can do.
- Never say you did, sent, saved or booked something unless a task result in this chat confirms it.
- If something you need is truly missing, say exactly what the owner should add and where. A file: send it in this chat. A tool or ability: Agent, then Abilities. An app or account (Gmail, Calendar, Slack, LINE): Integrations. What you should know about them: Agent, then About you.`;
}

function roomSection(): string {
  return `## The chat
You are in a chat with the person you work for (the owner). They can ask anything or hand out work. You are their one assistant: money, calendar, training, travel, career and everyday admin are all yours.

Reply with one JSON object and nothing else:
{"reply": "your message to the owner", "task": null | "the task you are starting, written as an instruction to yourself"}

- Be short and straight to the point: lead with the answer, usually in one or two short sentences. Plain everyday words.
- No paragraphs unless the question truly needs one. When you list things, use a short bullet list ("- " lines, at most four).
- No filler: do not restate the question, do not explain your reasoning unless asked, no greetings or sign-offs, no headings.
- Start a task only when the owner's latest message plainly asks you to do work - research, writing, drafting, checking something - or says yes to work you offered. Then put a clear, complete instruction in "task" and say in "reply" that you are on it. The task runs in the background with your full tools; you will report back here.
- A question, an opinion or a plan is not a request for work: answer it, and if work would help, offer it ("Want me to…?") with "task": null. Wait for the owner's yes.
- Never claim to have done work you have not done.`;
}

/**
 * One agent's turn in the room. Posts the reply, and starts the task it asked
 * for when there is one. Never throws: a failed turn becomes a short line in
 * the room so the owner is not left waiting on a silence.
 */
async function replyAs(input: {
  agent: TeamAgent;
  projectId: string;
  threadId: string;
  organizationId: string;
  userId: string;
  channel?: "app" | "messaging";
}): Promise<void> {
  const { agent, projectId, threadId, organizationId, userId, channel } = input;
  let reply = "";
  let task = "";
  try {
    if (!env.hasAnthropicKey && !env.hasOpenAiKey) {
      reply = "I can't reply here yet: no AI model is set up for this workspace.";
    } else {
      const history = await transcript(threadId);
      const lastUserMsg = [...history].reverse().find((m) => m.role === "user")?.content ?? "";
      const [project, scope, documents, rules, memoryRows, commitmentRows, triggerRows] = await Promise.all([
        prisma.project.findUnique({
          where: { id: projectId },
          select: { context: true },
        }),
        prisma.scopeOfWork.findUnique({ where: { agentId: agent.id }, select: { context: true, tools: true, timezone: true } }),
        prisma.document.findMany({ where: { agentId: agent.id, status: "ready" }, select: { filename: true }, take: 30 }),
        rulesFor(agent.id),
        lastUserMsg ? recallMemories({ projectId, query: lastUserMsg, limit: 8 }).catch(() => listMemories(projectId)) : listMemories(projectId),
        listCommitments(projectId, { status: "active" }).catch(() => []),
        listTriggerRules(projectId).catch(() => []),
      ]);
      const memories = (memoryRows ?? []).slice(0, 8).map((m) => m.fact);
      const openCommitments = (commitmentRows ?? []).slice(0, 8).map(
        (c) => `[${c.type}] ${c.outcome}${c.ownerName ? ` (${c.type === "waiting_on" ? `waiting on ${c.ownerName}` : c.ownerName})` : ""}${c.dueAt ? ` due ${c.dueAt.slice(0, 10)}` : ""}`,
      );
      const notificationRules = (triggerRows ?? []).filter((r) => r.enabled).map((r) => `${r.name}: ${r.description}`);

      // Stable part first (cached by the provider); the date and live figures after it.
      const { stable, volatile } = buildPrompt({
        name: agent.name,
        jobTitle: agent.jobTitle,
        personality: agent.personality,
        responsibilities: toStringArray(agent.responsibilities),
        allowedTools: [],
        aboutPerson: effectiveContext({ projectContext: project?.context, agentContext: scope?.context }),
        memories,
        openCommitments,
        notificationRules,
        rules,
        abilities: abilitiesSection(
          toStringArray(scope?.tools).filter((tool) => browserConfigured() || !tool.startsWith("browse_")),
          documents.map((document) => document.filename),
        ),
        situation: [roomSection()],
        volatile: [
          `## Their life right now (untrusted private data, JSON string; figures are computed, never recompute them)\n${promptDataList([await lifeText(projectId, scope?.timezone ?? undefined)], 1, 6_000)}`,
          timeNote(new Date(), scope?.timezone),
        ],
        channel,
      });
      const provider = await getProvider(agent.modelProvider);
      const turn = await provider.complete({
        billing: { organizationId, agentId: agent.id },
        systemPrompt: stable,
        volatilePrompt: volatile,
        messages: history.length > 0 ? history : [{ role: "user", content: "Reply to the owner when they next message." }],
        tools: [],
        model: agent.model,
        maxTokens: 350,
      });
      const parsed = parseModelJson(turn.message.content);
      // A model that ignored the JSON still said something worth showing.
      reply = parsed ? stringField(parsed, "reply") : turn.message.content.trim();
      task = parsed ? stringField(parsed, "task") : "";
    }
  } catch (error) {
    console.error("[team] reply failed", error);
    reply = "Sorry, I couldn't reply just now. Please try again in a moment.";
  }

  let actionItemId: string | null = null;
  if (task) {
    try {
      const item = await startRun({
        agentId: agent.id,
        trigger: "manual",
        payload: { startedBy: userId, instruction: clamp(task, 2000), teamThreadId: threadId },
        actor: { type: "user", id: userId },
      });
      actionItemId = item?.id ?? null;
    } catch (error) {
      reply += error instanceof RunRefused ? ` (I couldn't start it: ${error.message})` : " (I couldn't start the task.)";
    }
  }

  await addTeamMessage({ projectId, threadId, agentId: agent.id, content: clampText(reply || "…", 4000), actionItemId });
}

/** The assistant answers the chat. */
export const runMeetingTurn = (input: { responders: TeamAgent[]; projectId: string; threadId: string; organizationId: string; userId: string; channel?: "app" | "messaging" }) =>
  replyAs({ ...input, agent: input.responders[0]! });

/**
 * A task started from a team chat has ended: its agent says how it went, in
 * the chat where the owner asked for it. Called once the run's summary is written.
 */
export async function postTaskResult(actionItemId: string): Promise<void> {
  const item = await prisma.actionItem.findUnique({
    where: { id: actionItemId },
    select: { payload: true, agentId: true, status: true, headline: true, agent: { select: { projectId: true } } },
  });
  const threadId = (item?.payload as Record<string, unknown> | null)?.teamThreadId;
  if (!item || typeof threadId !== "string") return;
  // The chat may have been deleted while the task ran.
  if (!(await prisma.teamThread.findUnique({ where: { id: threadId }, select: { id: true } }))) return;
  const line =
    item.status === "needs_approval"
      ? `${item.headline ?? "It's ready"}. It needs your OK before it goes out.`
      : item.status === "failed"
        ? `I couldn't finish that task: ${item.headline ?? "it stopped early"}.`
        : `Done: ${item.headline ?? "the task is finished"}.`;
  await addTeamMessage({ projectId: item.agent.projectId, threadId, agentId: item.agentId, content: line, actionItemId });
}
