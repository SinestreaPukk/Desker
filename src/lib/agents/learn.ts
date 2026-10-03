/**
 * The assistant keeps the "About you" answers current as you talk to it.
 *
 * After each exchange, one small model call reads the answers as they stand and
 * what was just said, and returns revised answers only for what is genuinely
 * new and lasting (a new job, a preference, a person, a goal). The revision is
 * written back to the same fields the owner edits in the agent's settings, so
 * there is one source of truth and every correction stays theirs to make.
 */
import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/platform/db";
import { env } from "@/lib/platform/env";
import { audit } from "@/lib/platform/audit";
import { getProvider } from "@/lib/llm/provider";
import { parseModelJson } from "@/lib/work/model-json";
import { answersFor, composeContext, contextQuestions, toContextAnswers, type ContextAnswers, type ContextQuestion } from "@/lib/work/context";

const MAX_ANSWER = 1500;
/** An exchange this short ("ok", "thanks", "remind me at 5") carries nothing worth keeping. */
const MIN_MESSAGE = 25;

const PROMPT = `You keep a short profile of a person up to date for their personal assistant.
You are given the profile as it stands (JSON, one text field per topic), then one exchange between the person and the assistant.
Return the fields that need to change because the PERSON told you something new and lasting about themselves: who they are, where they live, their goals, people in their life, preferences, routine, money basics, how they like to be spoken to, limits.
Rules:
- Only what the person said, never what the assistant said or guessed. Ignore one-off requests, questions, moods and anything temporary.
- Return the COMPLETE new text for each changed field: keep every existing fact that is still true, add the new one, replace a fact the person corrected. Write one short plain fact per line, so each can be forgotten on its own.
- Never store passwords, account or card numbers, ID numbers, health diagnoses or anything that reads like a secret.
- If nothing needs to change, return {"updates": {}}.
Reply with JSON only: {"updates": {"<field id>": "<complete new text>"}}`;

/** Which of the model's proposed rewrites to accept. Pure, so the guards are tested. */
export function acceptUpdates(current: ContextAnswers, proposed: unknown, questions: readonly ContextQuestion[]): ContextAnswers {
  if (!proposed || typeof proposed !== "object" || Array.isArray(proposed)) return {};
  const accepted: ContextAnswers = {};
  for (const { id } of questions) {
    const value = (proposed as Record<string, unknown>)[id];
    if (typeof value !== "string") continue;
    const next = value.trim().slice(0, MAX_ANSWER);
    const old = current[id]?.trim() ?? "";
    if (!next || next === old) continue;
    // A rewrite that throws most of the old answer away is a mistake, not a correction.
    if (old.length > 80 && next.length < old.length * 0.6) continue;
    accepted[id] = next;
  }
  return accepted;
}

/** Reads one exchange and updates the person's profile. Never throws: the reply has already gone out. */
export async function learnFromChat(input: {
  projectId: string;
  organizationId: string;
  userText: string;
  agent: { id: string; modelProvider: string; model: string | null };
  reply: string;
}): Promise<void> {
  const { projectId, organizationId, userText, agent, reply } = input;
  if (userText.trim().length < MIN_MESSAGE || (!env.hasAnthropicKey && !env.hasOpenAiKey)) return;
  try {
    const questions = contextQuestions().all;
    const project = await prisma.project.findUnique({ where: { id: projectId }, select: { context: true, contextAnswers: true } });
    if (!project) return;
    const current = answersFor(project.contextAnswers, project.context, questions);
    const provider = await getProvider(agent.modelProvider);
    const turn = await provider.complete({
      billing: { organizationId, agentId: agent.id },
      systemPrompt: PROMPT,
      messages: [
        {
          role: "user",
          content: `Fields: ${questions.map((q) => `${q.id} = ${q.label}`).join("; ")}\n\nProfile now:\n${JSON.stringify(current)}\n\nThe person said:\n${userText.slice(0, 2000)}\n\nThe assistant replied:\n${reply.slice(0, 1000)}`,
        },
      ],
      tools: [],
      model: agent.model,
      maxTokens: 900,
    });
    const updates = acceptUpdates(current, parseModelJson(turn.message.content)?.updates, questions);
    const changed = Object.keys(updates);
    if (changed.length === 0) return;
    // Re-read so an edit the owner made while the model was thinking is not overwritten.
    const latest = await prisma.project.findUnique({ where: { id: projectId }, select: { context: true, contextAnswers: true } });
    if (!latest) return;
    const answers = toContextAnswers({ ...answersFor(latest.contextAnswers, latest.context, questions), ...updates }, questions);
    await prisma.project.update({
      where: { id: projectId },
      data: { context: composeContext(answers, questions), contextAnswers: answers as Prisma.InputJsonValue },
    });
    await audit({
      organizationId,
      actorType: "agent",
      actorId: agent.id,
      action: "project.context_learned",
      targetType: "project",
      targetId: projectId,
      metadata: { fields: changed },
    });
  } catch (error) {
    console.error("[learn] could not update the profile", error);
  }
}
