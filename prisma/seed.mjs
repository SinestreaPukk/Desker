/**
 * Development seed.
 *
 * Creates one person who owns a personal space with one project and one
 * published assistant in it. Idempotent: safe to re-run.
 *
 *   npm run db:seed
 */
// Must precede @prisma/client: it loads .env on import and sets
// DATABASE_URL, which would then win over .env.local.
import "../scripts/load-env.mjs";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const ADMIN_EMAIL = process.env.SEED_EMAIL ?? "admin@example.com";
const ADMIN_PASSWORD = process.env.SEED_PASSWORD ?? "password123";

async function main() {
  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {},
    create: {
      email: ADMIN_EMAIL,
      name: "Demo Person",
      passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 12),
    },
  });
  console.log(`user:   ${admin.email} / ${ADMIN_PASSWORD}`);

  // A user with no membership can reach nothing, so the seed mirrors what sign-up does.
  let membership = await prisma.membership.findFirst({
    where: { userId: admin.id },
    orderBy: { createdAt: "asc" },
    select: { organizationId: true },
  });
  if (!membership) {
    const organization = await prisma.organization.create({
      data: {
        name: "Demo's personal space",
        slug: `demo-${Date.now().toString(36)}`,
        memberships: { create: { userId: admin.id, role: "owner" } },
      },
    });
    membership = { organizationId: organization.id };
    console.log(`space:  ${organization.name} (${organization.id})`);
  }

  let project = await prisma.project.findFirst({
    where: { organizationId: membership.organizationId },
    orderBy: { createdAt: "asc" },
  });
  if (!project) {
    project = await prisma.project.create({
      data: {
        name: "Personal",
        slug: `personal-${Date.now().toString(36)}`,
        organizationId: membership.organizationId,
      },
    });
  }
  console.log(`project: ${project.name} (/p/${project.slug})`);

  const existing = await prisma.agent.findFirst({ where: { name: "Penny", projectId: project.id } });
  if (existing) {
    console.log(`agent:  Penny already seeded (${existing.id})`);
    return;
  }

  const agent = await prisma.agent.create({
    data: {
      projectId: project.id,
      name: "Penny",
      jobTitle: "Money Manager",
      personality:
        "Warm, clear and brief. Gives the answer first and the detail only when asked. " +
        "Never commits you to anything without checking.",
      responsibilities: [
        "Add up my spending from my statements",
        "Flag subscriptions I have stopped using",
        "Remind me before bills are due",
      ],
      allowedTools: ["search_documents"],
      status: "published",
      modelProvider: "anthropic",
    },
  });

  console.log(`agent:  Penny (${agent.id})`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
