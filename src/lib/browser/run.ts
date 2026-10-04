/**
 * Runs one browser tool call for the work runtime: gathers what the browser
 * agent may use (the saved details, what the owner wrote about themselves) and
 * turns its outcome into the delivery result the run records.
 */
import "server-only";
import { prisma } from "@/lib/platform/db";
import { listDetails } from "@/lib/life/details";
import { answersFor, contextQuestions } from "@/lib/work/context";
import type { PendingAction } from "@/lib/work/types";
import { addTeamMessage } from "@/lib/agents/team";
import { EVERYDAY_THREAD } from "@/lib/agents/team-dto";
import { messageUser } from "@/lib/messaging/send";
import { runBrowserTask, type Shot } from "./agent";

interface Delivery {
  ok: boolean;
  status: number;
  detail: string;
}

export async function runBrowserAction(actionItemId: string, organizationId: string, action: PendingAction): Promise<Delivery> {
  const item = await prisma.actionItem.findUnique({
    where: { id: actionItemId },
    select: { agentId: true, payload: true, agent: { select: { projectId: true, project: { select: { context: true, contextAnswers: true } } } } },
  });
  if (!item) return { ok: false, status: 0, detail: "The task no longer exists." };
  const { projectId, project } = item.agent;
  const commit = action.tool === "browse_commit";
  const goal = String(commit ? action.input.plan : action.input.goal ?? "");
  if (!goal.trim()) return { ok: false, status: 0, detail: "There was nothing to do in the browser." };
  const details = (await listDetails(projectId)).map((d) => `${d.label}: ${d.value}`).join("\n");
  const about = answersFor(project.contextAnswers, project.context, contextQuestions().all).about ?? "";

  const outcome = await runBrowserTask({
    organizationId,
    projectId,
    agentId: item.agentId,
    goal,
    // A plan the person approved, or a whole job they approved up front, may submit; a preparing run may not.
    allowCommit: commit || action.input.allow_commit === true,
    details,
    about,
  });
  // Asked for in a chat: show what the browser found and saw right there, pictures included.
  const threadId = (item.payload as Record<string, unknown> | null)?.teamThreadId;
  if (typeof threadId === "string" && outcome.status !== "commit_ready") {
    const content = chatText(outcome.summary, outcome.shots ?? []);
    await addTeamMessage({ projectId, threadId, agentId: item.agentId, content }).catch((error: unknown) => console.error("[browser] chat message not posted", error));
    // The everyday chat is the one LINE shares: send the findings and pictures there too.
    const startedBy = (item.payload as Record<string, unknown>).startedBy;
    const thread = await prisma.teamThread.findUnique({ where: { id: threadId }, select: { title: true } });
    if (typeof startedBy === "string" && thread?.title === EVERYDAY_THREAD) {
      await messageUser(startedBy, { title: "Browser", body: outcome.summary, markdown: content }).catch((error: unknown) => console.error("[browser] LINE message not sent", error));
    }
  }
  switch (outcome.status) {
    case "done":
    case "stopped":
      return { ok: true, status: 200, detail: outcome.summary };
    case "commit_ready":
      return { ok: true, status: 200, detail: `READY TO SUBMIT. ${outcome.summary}\nPLAN (pass this exactly to browse_commit): ${outcome.plan}` };
    case "needs_input":
      return { ok: true, status: 200, detail: `NEEDS YOU: ${outcome.summary}` };
    case "failed":
      return { ok: false, status: 0, detail: outcome.summary };
  }
}

/** The summary, then each picture as a markdown image the chat shows (see message-text.tsx). */
function chatText(summary: string, shots: Shot[]): string {
  const images = shots.map((shot) => `![${shot.caption.replace(/[\]\n]/g, " ")}](/api/browser/shot?key=${encodeURIComponent(shot.key)})`);
  return [summary.trim(), ...images].join("\n\n");
}
