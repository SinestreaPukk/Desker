import "server-only";
import { prisma } from "@/lib/platform/db";

/**
 * A hand-off thread: the run one agent started, and every run a colleague
 * carried out because of it. The lineage is `parentId` on a
 * `colleague_delegation` run - the same link the Work view's team chat reads -
 * so the Audit log and the run page tell the same story.
 *
 * Chains are short (a task is handed on at most twice), so walking them one
 * level per query stays cheap.
 */
const HANDOFF = "colleague_delegation";

type Link = { id: string; type: string; parentId: string | null };

/** Every run in the thread `actionItemId` belongs to, starting with the one that began it. */
export async function threadOf(actionItemId: string): Promise<string[]> {
  let root = actionItemId;
  for (;;) {
    const row = await prisma.actionItem.findUnique({ where: { id: root }, select: { type: true, parentId: true } });
    if (!row || row.type !== HANDOFF || !row.parentId) break;
    root = row.parentId;
  }
  const ids = [root];
  let frontier = [root];
  while (frontier.length > 0) {
    const children = await prisma.actionItem.findMany({
      where: { parentId: { in: frontier }, type: HANDOFF },
      select: { id: true },
      orderBy: { createdAt: "asc" },
    });
    frontier = children.map((child) => child.id);
    ids.push(...frontier);
  }
  return ids;
}

/** For each run that is part of a hand-off, the run its thread began with. Runs outside one are left out. */
export async function threadRoots(ids: string[]): Promise<Map<string, string>> {
  const roots = new Map<string, string>();
  if (ids.length === 0) return roots;

  const [rows, askers] = await Promise.all([
    prisma.actionItem.findMany({ where: { id: { in: ids } }, select: { id: true, type: true, parentId: true } }),
    prisma.actionItem.findMany({
      where: { parentId: { in: ids }, type: HANDOFF },
      select: { parentId: true },
    }),
  ]);
  const known = new Map<string, Link>(rows.map((row) => [row.id, row]));
  const handedOn = new Set(askers.map((row) => row.parentId));

  const unseenParents = (links: Link[]) =>
    [...new Set(links.filter((l) => l.type === HANDOFF && l.parentId && !known.has(l.parentId)).map((l) => l.parentId!))];
  let missing = unseenParents(rows);
  while (missing.length > 0) {
    const more = await prisma.actionItem.findMany({
      where: { id: { in: missing } },
      select: { id: true, type: true, parentId: true },
    });
    for (const row of more) known.set(row.id, row);
    missing = unseenParents(more);
  }

  for (const row of rows) {
    const delegated = row.type === HANDOFF && row.parentId !== null;
    if (!delegated && !handedOn.has(row.id)) continue;
    let node = row;
    while (node.type === HANDOFF && node.parentId && known.has(node.parentId)) node = known.get(node.parentId)!;
    roots.set(row.id, node.id);
  }
  return roots;
}
