// One-off: folds every space's agents into its oldest one (the assistant).
// Responsibilities and work tools are unioned; documents, rules, chat lines and
// runs move over; the others are deleted. Run: node scripts/merge-agents.mjs [--apply]
import "../load-env.mjs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const apply = process.argv.includes("--apply");
const union = (...lists) => [...new Set(lists.flatMap((l) => (Array.isArray(l) ? l : [])))];
const MOVE = ["document", "agentRule", "teamMessage", "actionItem", "draft", "issue", "suggestion"];

for (const { projectId } of await prisma.agent.groupBy({ by: ["projectId"], _count: true, having: { projectId: { _count: { gt: 1 } } } })) {
  const agents = await prisma.agent.findMany({ where: { projectId }, orderBy: { createdAt: "asc" }, include: { scopeOfWork: true } });
  const [keep, ...rest] = agents;
  console.log(`${projectId}: keep ${keep.name}, merge ${rest.map((a) => a.name).join(", ")}`);
  if (!apply) continue;
  const ids = rest.map((a) => a.id);
  await prisma.$transaction(async (tx) => {
    for (const model of MOVE) await tx[model].updateMany({ where: { agentId: { in: ids } }, data: { agentId: keep.id } });
    await tx.agent.update({ where: { id: keep.id }, data: { responsibilities: union(keep.responsibilities, ...rest.map((a) => a.responsibilities)).slice(0, 12), allowedTools: union(keep.allowedTools, ...rest.map((a) => a.allowedTools)) } });
    const scopes = [keep, ...rest].map((a) => a.scopeOfWork).filter(Boolean);
    // null tools means every tool, so any null keeps the lot.
    if (keep.scopeOfWork && scopes.every((s) => Array.isArray(s.tools))) await tx.scopeOfWork.update({ where: { agentId: keep.id }, data: { tools: union(...scopes.map((s) => s.tools)) } });
    await tx.agent.deleteMany({ where: { id: { in: ids } } });
  });
}
console.log(apply ? "merged" : "dry run: pass --apply to merge");
await prisma.$disconnect();
