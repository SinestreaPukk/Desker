/**
 * Where someone lands when they go into a space: its first run while it is
 * brand new (nothing described, nobody hired), its Roster after that.
 * Used by the front door.
 */
import "server-only";
import { prisma } from "@/lib/db";
import { hasCoreContext } from "@/lib/work/context";

interface EntryProject {
  id: string;
  slug: string;
  context: string | null;
  contextAnswers: unknown;
}

export async function entryPath(project: EntryProject): Promise<string> {
  const fresh =
    !hasCoreContext(project) &&
    (await prisma.agent.count({ where: { projectId: project.id } })) === 0;
  return fresh ? `/p/${project.slug}/start` : `/p/${project.slug}/roster`;
}
