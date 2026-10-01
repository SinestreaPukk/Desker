/**
 * The team room: the owner writes once, the right agents answer.
 *
 * Who answers is decided per message. `@Name` picks those agents, `@everyone`
 * the whole team; otherwise one short model call reads the roster and picks
 * the one to three whose work it is. They reply in turn, each seeing what the
 * ones before said, so the room reads like a meeting rather than an echo.
 *
 * The room is for talking and handing out work, not doing it: an agent that
 * is asked for real work starts a task, which runs in Work with its full
 * tools, and says so here. When the task ends, the agent posts the result
 * back into the room (see postTaskResult).
 */
import "server-only";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { toStringArray } from "@/lib/agent-fields";
import { buildSystemPrompt } from "@/lib/agent-prompt";
import { getProvider } from "@/lib/llm/provider";
import { effectiveContext } from "@/lib/work/context";
import { spaceKind, type SpaceKind } from "@/lib/space";
import { rulesFor } from "@/lib/work/rules";
import { clamp, parseModelJson, stringField } from "@/lib/work/model-json";
import { RunRefused, startRun } from "@/lib/work/scope";
import { WORK_TOOL_IDS, WORK_TOOL_METADATA, scopeTools, type WorkToolId } from "@/lib/work/tools";
import { timeNote } from "@/lib/local-time";
import { safetyRules } from "@/lib/safety-rules";

const MAX_RESPONDERS = 3;
const HISTORY = 30;

export interface TeamAgent {
  id: string;
  name: string;
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
  jobTitle: true,
  department: true,
  personality: true,
  responsibilities: true,
  modelProvider: true,
  model: true,
  scopeOfWork: { select: { tools: true } },
} as const;

// Everyone's tasks can search, draft and hand off: what tells agents apart is the rest.
const COMMON = new Set<WorkToolId>(["search_documents", "draft_content", "schedule_followup", "delegate_to_colleague", "suggest_opportunity", "escalate_to_human"]);

/** What this agent's tasks can do that not every agent's can, in the owner's words. */
export function specialAbilities(agent: Pick<TeamAgent, "scopeOfWork">): string[] {
  const tools = agent.scopeOfWork ? scopeTools(agent.scopeOfWork.tools) : null;
  return (tools ?? [...WORK_TOOL_IDS]).filter((tool) => !COMMON.has(tool)).map((tool) => WORK_TOOL_METADATA[tool].label);
}

/** Everyone who can speak in the room: the project's published agents. */
export function teamOf(projectId: string): Promise<TeamAgent[]> {
  return prisma.agent.findMany({
    where: { projectId, status: "published" },
    select: agentSelect,
    orderBy: { name: "asc" },
  });
}

/** `@everyone` / `@team`, or the agents named with an @. Null when the message names nobody. */
export function mentioned(content: string, team: TeamAgent[]): TeamAgent[] | null {
  const lower = content.toLowerCase();
  if (/@(everyone|team|all)\b/.test(lower)) return team;
  const named = team.filter((agent) => lower.includes(`@${agent.name.toLowerCase()}`));
  return named.length > 0 ? named : null;
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

/** The chat as the model reads it: one line per message, oldest first. */
async function transcript(threadId: string): Promise<string> {
  const rows = await prisma.teamMessage.findMany({
    where: { threadId },
    orderBy: { createdAt: "desc" },
    take: HISTORY,
    select: { content: true, authorName: true, agent: { select: { name: true } } },
  });
  return rows
    .reverse()
    .map((row) => `${row.agent?.name ?? row.authorName ?? "Owner"}: ${clamp(row.content, 1200)}`)
    .join("\n\n");
}

const ROUTER_PROMPT = `You run a group chat between a person (the owner) and their AI team - staff at their business, or assistants in their personal life.
Given the team and the owner's latest message, pick who should answer: the one to three people whose work it is.
Pick one unless the message clearly spans several people's work, or asks for everyone's view.
Each person's "Can" list is what their tasks can actually do. When the message needs one of those abilities - a calendar, email, GitHub, Slack, the web, a statement - pick someone who has it, even over someone whose job title sounds closer.
Reply with JSON only: {"responders": ["Name", ...]}`;

/** Who answers a message that names nobody. Falls back to the first agent when no model is available. */
export async function chooseResponders(
  threadId: string,
  organizationId: string,
  team: TeamAgent[],
  content: string,
): Promise<TeamAgent[]> {
  if (team.length <= 1 || (!env.hasAnthropicKey && !env.hasOpenAiKey)) return team.slice(0, 1);
  const roster = team
    .map((agent) => {
      const can = specialAbilities(agent);
      return `- ${agent.name}, ${agent.jobTitle}: ${toStringArray(agent.responsibilities).slice(0, 4).join("; ")}. Can: ${can.length > 0 ? can.join(", ") : "search its documents and draft"}.`;
    })
    .join("\n");
  try {
    const provider = await getProvider(team[0]!.modelProvider);
    const turn = await provider.complete({
      billing: { organizationId },
      systemPrompt: ROUTER_PROMPT,
      messages: [
        {
          role: "user",
          content: `The team:\n${roster}\n\nThe meeting so far:\n${await transcript(threadId)}\n\nThe owner's latest message:\n${content}`,
        },
      ],
      tools: [],
      model: team[0]!.model,
      maxTokens: 100,
    });
    const names = parseModelJson(turn.message.content)?.responders;
    const picked = Array.isArray(names)
      ? team.filter((agent) => names.some((name) => String(name).toLowerCase() === agent.name.toLowerCase()))
      : [];
    return picked.length > 0 ? picked.slice(0, MAX_RESPONDERS) : team.slice(0, 1);
  } catch (error) {
    console.error("[team] choosing responders failed", error);
    return team.slice(0, 1);
  }
}

/**
 * What the agent can really do, so it neither claims tools it lacks nor
 * complains about ones it has: the chat itself has none, a task has the
 * agent's full set.
 */
function abilitiesSection(tools: string[], documents: string[]): string {
  const labels = tools
    .filter((tool): tool is WorkToolId => tool in WORK_TOOL_METADATA)
    .map((tool) => `- ${WORK_TOOL_METADATA[tool].label}: ${WORK_TOOL_METADATA[tool].blurb}`);
  return `## What you can do
In this chat you answer from what you know; you cannot look anything up here. A task can: it runs with your tools.
${labels.length > 0 ? `In a task you can:\n${labels.join("\n")}` : "No tools are switched on for your tasks yet."}
${documents.length > 0 ? `Documents uploaded to you: ${documents.join(", ")}.` : "No documents are uploaded to you yet."}

- If an answer needs fresh facts or your tools, offer to start a task. Do not say you cannot do something your tasks can do.
- If something you need is truly missing - a document, a tool, a connection - say exactly what the owner should add and where. Documents: Roster, open your page, Knowledge tab. Tools: Roster, your page, Work & schedule. Apps and accounts: Integrations. Never say "here": this chat cannot take files.`;
}

function roomSection(agent: TeamAgent, team: TeamAgent[], kind: SpaceKind): string {
  const others = team
    .filter((other) => other.id !== agent.id)
    .map((other) => {
      const can = specialAbilities(other);
      return `${other.name} (${other.jobTitle}${can.length > 0 ? `; their tasks can: ${can.join(", ")}` : ""})`;
    });
  return `## The team room
You are in a group chat with ${kind === "personal" ? "the person you work for (the owner)" : "the business owner"}${others.length > 0 ? ` and your colleagues ${others.join(", ")}` : ""}. The owner can ask anything or hand out work.

Reply with one JSON object and nothing else:
{"reply": "your message to the room", "task": null | "the task you are starting, written as an instruction to yourself", "handoff": null | "a colleague's name"}

- Be short and straight to the point: lead with the answer, usually in one or two short sentences. Plain everyday words.
- No paragraphs unless the question truly needs one. When you list things, use a short bullet list ("- " lines, at most four).
- No filler: do not restate the question, do not explain your reasoning unless asked, no greetings or sign-offs, no headings.
- Only speak to your own part. If a colleague already said it, do not repeat them; add only what is new, or say in a few words that you agree.
- Start a task only when the owner's latest message plainly asks you (or the team) to do work - research, writing, drafting, checking something - or says yes to work you offered. Then put a clear, complete instruction in "task" and say in "reply" that you are on it. The task runs in the background with your full tools; you will report back here.
- A question, an opinion or a plan is not a request for work: answer it, and if work would help, offer it ("Want me to…?") with "task": null. Wait for the owner's yes.
- Never start a task for work that is a colleague's.
- If the owner asks for work that needs something your tasks can't do but a colleague's can (a calendar, email, GitHub...), do not start it and do not offer to flag it: set "handoff" to that colleague's name and say in one short line that you are passing it to them. They pick it up straight away.
- Never claim to have done work you have not done.`;
}

/**
 * One agent's turn in the room. Posts the reply, and starts the task it asked
 * for when there is one. Never throws: a failed turn becomes a short line in
 * the room so the owner is not left waiting on a silence.
 */
export async function replyAs(input: {
  agent: TeamAgent;
  team: TeamAgent[];
  projectId: string;
  threadId: string;
  organizationId: string;
  userId: string;
}): Promise<TeamAgent | null> {
  const { agent, team, projectId, threadId, organizationId, userId } = input;
  let reply = "";
  let task = "";
  let handoff: TeamAgent | null = null;
  try {
    if (!env.hasAnthropicKey && !env.hasOpenAiKey) {
      reply = "I can't reply here yet: no AI model is set up for this workspace.";
    } else {
      const [project, scope, documents, rules] = await Promise.all([
        prisma.project.findUnique({
          where: { id: projectId },
          select: { context: true, organization: { select: { kind: true } } },
        }),
        prisma.scopeOfWork.findUnique({ where: { agentId: agent.id }, select: { context: true, tools: true, timezone: true } }),
        prisma.document.findMany({ where: { agentId: agent.id, status: "ready" }, select: { filename: true }, take: 30 }),
        rulesFor(agent.id),
      ]);
      const kind = spaceKind(project?.organization.kind);
      const systemPrompt = [
        buildSystemPrompt({
          name: agent.name,
          jobTitle: agent.jobTitle,
          department: agent.department,
          personality: agent.personality,
          responsibilities: toStringArray(agent.responsibilities),
          allowedTools: [],
          companyContext: effectiveContext({ projectContext: project?.context, agentContext: scope?.context, kind }),
          audience: "colleague",
          kind,
          rules,
        }),
        abilitiesSection(
          toStringArray(scope?.tools),
          documents.map((document) => document.filename),
        ),
        roomSection(agent, team, kind),
        timeNote(new Date(), scope?.timezone),
        safetyRules("owner"),
      ].join("\n\n");
      const provider = await getProvider(agent.modelProvider);
      const turn = await provider.complete({
        billing: { organizationId, agentId: agent.id },
        systemPrompt,
        messages: [{ role: "user", content: `The meeting so far:\n\n${await transcript(threadId)}\n\nYour turn, ${agent.name}.` }],
        tools: [],
        model: agent.model,
        maxTokens: 350,
      });
      const parsed = parseModelJson(turn.message.content);
      // A model that ignored the JSON still said something worth showing.
      reply = parsed ? stringField(parsed, "reply") : turn.message.content.trim();
      task = parsed ? stringField(parsed, "task") : "";
      const to = parsed ? stringField(parsed, "handoff").toLowerCase() : "";
      handoff = to ? (team.find((other) => other.id !== agent.id && other.name.toLowerCase() === to) ?? null) : null;
      // Passing it on and starting it yourself are one or the other.
      if (handoff) task = "";
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

  await addTeamMessage({ projectId, threadId, agentId: agent.id, content: clamp(reply || "…", 4000), actionItemId });
  return handoff;
}

/** Everyone picked answers in turn, so each sees what the ones before said. */
export async function runMeetingTurn(input: {
  responders: TeamAgent[];
  team: TeamAgent[];
  projectId: string;
  threadId: string;
  organizationId: string;
  userId: string;
}): Promise<void> {
  const spoke = new Set<string>();
  const passedTo: TeamAgent[] = [];
  for (const agent of input.responders) {
    spoke.add(agent.id);
    const handoff = await replyAs({ ...input, agent });
    if (handoff) passedTo.push(handoff);
  }
  // Whoever was handed the work answers next - once, so hand-offs never loop.
  for (const agent of passedTo) {
    if (spoke.has(agent.id)) continue;
    spoke.add(agent.id);
    await replyAs({ ...input, agent });
  }
}

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
