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
import { runBrowserTask } from "./agent";

interface Delivery {
  ok: boolean;
  status: number;
  detail: string;
}

export async function runBrowserAction(actionItemId: string, organizationId: string, action: PendingAction): Promise<Delivery> {
  const item = await prisma.actionItem.findUnique({
    where: { id: actionItemId },
    select: { agentId: true, agent: { select: { projectId: true, project: { select: { context: true, contextAnswers: true } } } } },
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
