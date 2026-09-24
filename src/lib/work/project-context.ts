/**
 * The project's shared context: read, saved and composed in one place.
 *
 * It is the same mechanism as an agent's own context (lib/work/context.ts) at
 * a different scope - typed once for the whole project, inherited by every
 * agent in it, so hiring a third agent does not mean describing the company a
 * third time.
 */
import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import {
  ALL_PROJECT_CONTEXT_QUESTIONS,
  PROJECT_CONTEXT_QUESTIONS,
  answeredCount,
  answersFor,
  composeContext,
  toContextAnswers,
  type ContextAnswers,
} from "./context";

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
}

export async function readProjectContext(project: {
  id: string;
  slug: string;
  name: string;
  context: string;
  contextAnswers: unknown;
}): Promise<ProjectContextDto> {
  const answers = answersFor(project.contextAnswers, project.context, ALL_PROJECT_CONTEXT_QUESTIONS);
  const documentCount = await prisma.document.count({
    where: { status: "ready", agent: { projectId: project.id } },
  });
  return {
    projectId: project.id,
    slug: project.slug,
    name: project.name,
    answers,
    context: project.context,
    answered: answeredCount(answers, PROJECT_CONTEXT_QUESTIONS),
    total: PROJECT_CONTEXT_QUESTIONS.length,
    documentCount,
  };
}

export async function saveProjectContext(
  project: { id: string; organizationId: string },
  input: ContextAnswers,
  userId: string,
): Promise<ProjectContextDto> {
  const answers = toContextAnswers(input, ALL_PROJECT_CONTEXT_QUESTIONS);
  const context = composeContext(answers, ALL_PROJECT_CONTEXT_QUESTIONS);
  const updated = await prisma.project.update({
    where: { id: project.id },
    data: { context, contextAnswers: answers as Prisma.InputJsonValue },
    select: { id: true, slug: true, name: true, context: true, contextAnswers: true },
  });

  await audit({
    organizationId: project.organizationId,
    actorType: "user",
    actorId: userId,
    action: "project.context_updated",
    targetType: "project",
    targetId: project.id,
    metadata: { answered: answeredCount(answers, PROJECT_CONTEXT_QUESTIONS) },
  });

  return readProjectContext(updated);
}
