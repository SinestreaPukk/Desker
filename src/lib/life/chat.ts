/**
 * One conversation, any entry point. The web chat and LINE both call
 * planChat + runChat, so the same router, context and agents answer in both,
 * and the history lives in the same thread store.
 */
import "server-only";
import { prisma } from "@/lib/db";
import { addTeamMessage, runMeetingTurn, teamOf, type TeamAgent } from "@/lib/team";
import { clamp } from "@/lib/work/model-json";
import { readLife } from "./read";
import { negotiate } from "./negotiate";
import { answerGeneral } from "./research";
import { renderLife } from "./context";
import { planChat, type Plan } from "./router";

export const EVERYDAY_THREAD = "Everyday chat";

interface ChatCtx {
  projectId: string;
  organizationId: string;
  threadId: string;
  userId: string;
}

/** Carries out a plan. Writes the replies into the thread; never throws. */
export async function runChat(plan: Plan, text: string, team: TeamAgent[], ctx: ChatCtx): Promise<void> {
  if (plan.route === "research") {
    const speaker = plan.responders[0]!;
    try {
      const answer = await answerGeneral({ question: text, life: renderLife(await readLife(ctx.projectId)), organizationId: ctx.organizationId, agent: speaker });
      await addTeamMessage({ projectId: ctx.projectId, threadId: ctx.threadId, agentId: speaker.id, content: answer.reply });
    } catch (error) {
      console.error("[life] research answer failed", error);
      await addTeamMessage({ projectId: ctx.projectId, threadId: ctx.threadId, agentId: speaker.id, content: "Sorry, I couldn't look that up just now. Please try again." });
    }
    return;
  }
  if (plan.route !== "engine") return runMeetingTurn({ responders: plan.responders, team, ...ctx });
  const speaker = plan.responders[0]!;
  try {
    const result = await negotiate({ life: await readLife(ctx.projectId), organizationId: ctx.organizationId, projectId: ctx.projectId, text, team });
    const who = result.positions.filter((p) => p.stance !== "ok").map((p) => p.role);
    const body = who.length ? `${result.reply}\n\n(Weighed by: ${who.join(", ")})` : result.reply;
    await addTeamMessage({ projectId: ctx.projectId, threadId: ctx.threadId, agentId: speaker.id, content: clamp(body, 4000) });
  } catch (error) {
    console.error("[life] negotiation failed", error);
    await addTeamMessage({ projectId: ctx.projectId, threadId: ctx.threadId, agentId: speaker.id, content: "Sorry, I couldn't work that through just now. Please try again." });
  }
}

/** A person's personal space: the project the shared runtime keeps their assistants in. */
export async function personalSpace(userId: string) {
  const m = await prisma.membership.findFirst({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: { organizationId: true, organization: { select: { projects: { orderBy: { createdAt: "asc" }, take: 1, select: { id: true } } } } },
  });
  const projectId = m?.organization.projects[0]?.id;
  return m && projectId ? { organizationId: m.organizationId, projectId } : null;
}

/**
 * A whole turn, start to finish, for channels that wait for the answer (LINE).
 * One thread per channel, so the conversation continues across messages.
 */
export interface Said {
  /** The agent speaking, or null for the system. */
  agent: string | null;
  text: string;
}

export async function chatTurn(userId: string, text: string): Promise<Said[]> {
  const space = await personalSpace(userId);
  if (!space) return [{ agent: null, text: "Your space isn't set up yet. Open Desker Personal once to finish setup." }];
  const team = await teamOf(space.projectId);
  if (team.length === 0) return [{ agent: null, text: "No assistant is switched on yet. Open Desker Personal and hire one from the Roster." }];
  // One shared thread for every messaging app, so LINE, Telegram and the alerts the system sends are one conversation, visible in the web chat too.
  const title = EVERYDAY_THREAD;
  const thread =
    (await prisma.teamThread.findFirst({ where: { projectId: space.projectId, title }, select: { id: true } })) ??
    (await prisma.teamThread.create({ data: { projectId: space.projectId, title }, select: { id: true } }));
  const ctx = { ...space, threadId: thread.id, userId };
  const since = new Date();
  await addTeamMessage({ projectId: space.projectId, threadId: thread.id, userId, authorName: "You", content: text });
  await runChat(await planChat({ text, team, threadId: thread.id, organizationId: space.organizationId }), text, team, ctx);
  const replies = await prisma.teamMessage.findMany({ where: { threadId: thread.id, agentId: { not: null }, createdAt: { gte: since } }, orderBy: { createdAt: "asc" }, select: { content: true, agent: { select: { name: true } } } });
  return replies.length ? replies.map((r) => ({ agent: r.agent?.name ?? null, text: r.content })) : [{ agent: null, text: "I'm on it." }];
}

/** The same turn as one string, for apps that take a single message. */
export async function chatOnce(userId: string, text: string, _channel: string): Promise<string> {
  const said = await chatTurn(userId, text);
  return said.map((s) => (s.agent && said.length > 1 ? `${s.agent}: ${s.text}` : s.text)).join("\n\n");
}
