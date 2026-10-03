/**
 * The project's shared context: read, saved and composed in one place.
 *
 * It is the same mechanism as an agent's own context (lib/work/context.ts) at
 * a different scope - typed once for the whole project, inherited by every
 * agent in it, so hiring a third agent does not mean describing yourself a
 * third time.
 */
import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/platform/db";
import { HttpError } from "@/lib/platform/http-error";
import { audit } from "@/lib/platform/audit";
import {
  answeredCount,
  contextQuestions,
  hasCoreContext,
  answersFor,
  composeContext,
  toContextAnswers,
  type ContextAnswers,
} from "./context";

type ProjectRow = {
  id: string;
  slug: string;
  name: string;
  context: string;
  contextAnswers: unknown;
};

export interface ProjectContextDto {
  projectId: string;
  slug: string;
  name: string;
  answers: ContextAnswers;
  /** The composed string every agent in the project inherits. */
  context: string;
  /** Core questions answered, out of `total`; the optional ones are not counted. */
  answered: number;
  total: number;
  /** Ready documents across the project, which is what a draft can read. */
  documentCount: number;
  /** When the assistant last changed each answer from something said in chat (ISO), by question id. */
  learnedAt: Record<string, string>;
}

export async function readProjectContext(project: ProjectRow): Promise<ProjectContextDto> {
  const questions = contextQuestions();
  const answers = answersFor(project.contextAnswers, project.context, questions.all);
  const documentCount = await prisma.document.count({
    where: { status: "ready", agent: { projectId: project.id } },
  });
  // What the assistant has picked up from chat, newest change per answer.
  const learnedAt: Record<string, string> = {};
  const learned = await prisma.auditLog.findMany({
    where: { action: "project.context_learned", targetType: "project", targetId: project.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: { createdAt: true, metadata: true },
  });
  for (const entry of learned) {
    const fields = (entry.metadata as { fields?: unknown } | null)?.fields;
    for (const field of Array.isArray(fields) ? fields : []) {
      if (typeof field === "string" && !(field in learnedAt)) learnedAt[field] = entry.createdAt.toISOString();
    }
  }
  return {
    projectId: project.id,
    slug: project.slug,
    name: project.name,
    answers,
    context: project.context,
    answered: answeredCount(answers, questions.core),
    total: questions.core.length,
    documentCount,
    learnedAt,
  };
}

export async function saveProjectContext(
  project: { id: string; organizationId: string },
  input: ContextAnswers,
  userId: string,
): Promise<ProjectContextDto> {
  const questions = contextQuestions();
  const answers = toContextAnswers(input, questions.all);
  const context = composeContext(answers, questions.all);
  const updated = await prisma.project.update({
    where: { id: project.id },
    data: { context, contextAnswers: answers as Prisma.InputJsonValue },
    select: {
      id: true,
      slug: true,
      name: true,
      context: true,
      contextAnswers: true,
    },
  });

  await audit({
    organizationId: project.organizationId,
    actorType: "user",
    actorId: userId,
    action: "project.context_updated",
    targetType: "project",
    targetId: project.id,
    metadata: { answered: answeredCount(answers, questions.core) },
  });

  return readProjectContext(updated);
}

/**
 * Refuses to switch an assistant on before the person is
 * described. An agent published without it works blind - the gap this closes.
 */
export async function assertProjectGrounded(projectId: string): Promise<void> {
  const project = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    select: { context: true, contextAnswers: true },
  });
  if (!hasCoreContext(project)) {
    throw new HttpError(
      409,
      "Write a few lines about you first, then switch it on.",
    );
  }
}
