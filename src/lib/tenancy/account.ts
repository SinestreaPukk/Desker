/**
 * A person's own data: everything, as one download, and all of it gone on
 * request. The privacy policy promises both; these are the two functions it
 * is promising.
 *
 * "Theirs" is the account itself plus every space they solely own. A business
 * someone else also owns is not theirs alone to export or erase: they get
 * their account's view of it (membership) and leaving it removes only them.
 */
import "server-only";
import { prisma } from "@/lib/platform/db";
import { storage } from "@/lib/platform/storage";
import { HttpError } from "@/lib/platform/http-error";

/** Spaces the user owns with no co-owner, split by whether anyone else is in them. */
async function ownership(userId: string) {
  const memberships = await prisma.membership.findMany({
    where: { userId },
    select: {
      role: true,
      organization: {
        select: {
          id: true,
          name: true,
          memberships: { select: { userId: true, role: true } },
        },
      },
    },
  });
  const sole = memberships.filter(
    (m) => m.role === "owner" && !m.organization.memberships.some((o) => o.userId !== userId && o.role === "owner"),
  );
  return {
    memberships,
    /** Solely owned and nobody else in it: erased with the account. */
    erasable: sole.filter((m) => m.organization.memberships.length === 1).map((m) => m.organization),
    /** Solely owned but shared with members: ownership must pass on first. */
    blocking: sole.filter((m) => m.organization.memberships.length > 1).map((m) => m.organization),
  };
}

/** Everything the user has in Desker, as plain JSON. No secrets, no password hash. */
export async function exportAccount(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      username: true,
      termsAcceptedAt: true,
      termsVersion: true,
      createdAt: true,
      feedback: { select: { kind: true, message: true, path: true, createdAt: true } },
    },
  });
  const { memberships, erasable, blocking } = await ownership(userId);
  const owned = [...erasable, ...blocking].map((org) => org.id);

  const spaces = await prisma.organization.findMany({
    where: { id: { in: owned } },
    select: {
      id: true,
      name: true,
      createdAt: true,
      projects: {
        select: {
          name: true,
          context: true,
          contextAnswers: true,
          createdAt: true,
          agents: {
            select: {
              name: true,
              jobTitle: true,
              personality: true,
              responsibilities: true,
              escalationRule: true,
              status: true,
              createdAt: true,
              scopeOfWork: { select: { context: true, contextAnswers: true, objectives: true, triggerType: true, cron: true } },
              rules: { select: { text: true, source: true, createdAt: true } },
              documents: {
                select: {
                  filename: true,
                  createdAt: true,
                  chunks: { select: { content: true }, orderBy: { chunkIndex: "asc" } },
                },
              },
              conversations: {
                select: {
                  createdAt: true,
                  messages: { select: { role: true, authorName: true, content: true, createdAt: true }, orderBy: { createdAt: "asc" } },
                },
              },
            },
          },
          teamThreads: {
            select: {
              title: true,
              createdAt: true,
              messages: { select: { authorName: true, content: true, createdAt: true }, orderBy: { createdAt: "asc" } },
            },
          },
        },
      },
      actionItems: { select: { trigger: true, status: true, headline: true, summary: true, result: true, createdAt: true } },
      drafts: { select: { kind: true, title: true, body: true, status: true, createdAt: true } },
      digests: { select: { headline: true, bullets: true, createdAt: true } },
      suggestions: { select: { summary: true, rationale: true, proposal: true, status: true, createdAt: true } },
      integrations: { select: { type: true, name: true, enabled: true, createdAt: true } },
      auditLogs: { select: { actorType: true, action: true, targetType: true, metadata: true, createdAt: true }, orderBy: { createdAt: "asc" } },
    },
  });

  return {
    exportedAt: new Date().toISOString(),
    note: "Everything Desker holds for your account and the spaces you own. Saved passwords for connected apps are left out on purpose.",
    account: user,
    memberships: memberships.map((m) => ({ space: m.organization.name, role: m.role })),
    spaces: spaces.map(({ projects, ...space }) => ({
      ...space,
      projects: projects.map(({ agents, ...project }) => ({
        ...project,
        agents: agents.map(({ documents, ...agent }) => ({
          ...agent,
          documents: documents.map(({ chunks, ...document }) => ({ ...document, text: chunks.map((c) => c.content).join("\n") })),
        })),
      })),
    })),
  };
}

/**
 * Deletes the account and every space it solely owns, files included.
 * Refuses while a space it owns has other members (someone must be left in
 * charge).
 */
export async function deleteAccount(userId: string): Promise<void> {
  const { erasable, blocking } = await ownership(userId);
  if (blocking.length > 0) {
    throw new HttpError(
      409,
      `You're the only owner of ${blocking.map((org) => org.name).join(", ")}, which has other people in it. Make one of them an owner, or remove them, before deleting your account.`,
    );
  }

  const ids = erasable.map((org) => org.id);
  const files = await prisma.document.findMany({
    where: { agent: { project: { organizationId: { in: ids } } } },
    select: { storageKey: true },
  });

  await prisma.$transaction([
    // Rows keyed by organisation without a relation do not cascade.
    prisma.feedback.deleteMany({ where: { OR: [{ userId }, { organizationId: { in: ids } }] } }),
    prisma.productEvent.deleteMany({ where: { OR: [{ userId }, { organizationId: { in: ids } }] } }),
    prisma.organization.deleteMany({ where: { id: { in: ids } } }),
    prisma.user.delete({ where: { id: userId } }),
  ]);

  // Files last: a failed delete above leaves them in place with their rows.
  for (const file of files) await storage.delete(file.storageKey).catch(() => undefined);
}
