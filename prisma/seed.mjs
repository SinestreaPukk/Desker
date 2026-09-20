/**
 * Development seed.
 *
 * Creates one admin who owns one organisation with one project, one fully
 * configured published agent in it, and writes the sample context document to
 * samples/ so there is something real to upload. Idempotent: safe to re-run.
 *
 *   npm run db:seed
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

const prisma = new PrismaClient();

const ADMIN_EMAIL = process.env.SEED_EMAIL ?? "admin@example.com";
const ADMIN_PASSWORD = process.env.SEED_PASSWORD ?? "password123";

const RETURN_POLICY = `# Northwind Supply Co. - Returns and Refunds Policy

## Return window
Unused items may be returned within 30 days of delivery for a full refund.
Items returned between 31 and 60 days receive store credit only. After 60 days
we cannot accept a return.

## Condition
Items must be in their original packaging with all accessories. Items showing
wear beyond normal inspection are refused and returned to the customer at their
expense.

## Refund timing
Refunds are issued to the original payment method within 5 business days of the
warehouse receiving the item. Bank processing adds a further 3 to 5 days.

## Shipping costs
Return shipping is free for faulty or incorrectly shipped items. For
change-of-mind returns the customer pays return postage, deducted from the
refund at a flat $8.50 within the continental US.

## Exceptions
Clearance items marked "final sale" cannot be returned. Custom-cut cable and
bulk fastener orders over 500 units are non-returnable once the order enters
production.

## Damaged on arrival
Report damage within 48 hours of delivery with photographs. We ship a
replacement immediately and arrange collection of the damaged item at no cost.

## Warranty
Power tools carry a 24-month manufacturer warranty. Hand tools carry a lifetime
warranty against manufacturing defects, which does not cover normal wear,
misuse, or damage from use outside the tool's rated purpose.
`;

async function main() {
  const admin = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {},
    create: {
      email: ADMIN_EMAIL,
      name: "Demo Admin",
      passwordHash: await bcrypt.hash(ADMIN_PASSWORD, 12),
    },
  });
  console.log(`admin:  ${admin.email} / ${ADMIN_PASSWORD}`);

  // The admin's organisation and its first project. A user with no membership
  // can reach nothing, so the seed mirrors what sign-up does.
  let membership = await prisma.membership.findFirst({
    where: { userId: admin.id },
    orderBy: { createdAt: "asc" },
    select: { organizationId: true },
  });
  if (!membership) {
    const organization = await prisma.organization.create({
      data: {
        name: "Northwind Supply Co.",
        slug: `northwind-${Date.now().toString(36)}`,
        memberships: { create: { userId: admin.id, role: "owner" } },
      },
    });
    membership = { organizationId: organization.id };
    console.log(`org:    ${organization.name} (${organization.id})`);
  }

  let project = await prisma.project.findFirst({
    where: { organizationId: membership.organizationId },
    orderBy: { createdAt: "asc" },
  });
  if (!project) {
    project = await prisma.project.create({
      data: {
        name: "Default project",
        slug: `default-${Date.now().toString(36)}`,
        organizationId: membership.organizationId,
      },
    });
  }
  console.log(`project: ${project.name} (/p/${project.slug})`);

  await mkdir(join(process.cwd(), "samples"), { recursive: true });
  const samplePath = join(process.cwd(), "samples", "northwind-returns.md");
  await writeFile(samplePath, RETURN_POLICY, "utf8");
  console.log(`sample: ${samplePath}`);

  const existing = await prisma.agent.findFirst({
    where: { name: "Mia", projectId: project.id },
  });
  if (existing) {
    console.log(`agent:  Mia already seeded (${existing.id})`);
    console.log(`chat:   /c/${existing.id}`);
    return;
  }

  const agent = await prisma.agent.create({
    data: {
      projectId: project.id,
      name: "Mia",
      jobTitle: "Customer Support Lead",
      department: "Customer Experience",
      personality:
        "Warm but efficient. Answers in two or three sentences, never uses corporate " +
        "filler, and says plainly when something isn't possible rather than hedging. " +
        "Takes a reported problem seriously the first time it is mentioned, and never " +
        "asks a client to repeat themselves.",
      responsibilities: [
        "Answer questions about orders, shipping and returns",
        "Help clients find the right product",
        "Collect enough detail on a bug for engineering to reproduce it",
        "Record feature requests clients raise",
      ],
      allowedTools: [
        "search_company_context",
        "log_issue",
        "log_suggestion",
        "escalate_to_human",
      ],
      escalationRule:
        "Escalate if the client is angry or upset, asks for a refund over $200, " +
        "mentions legal action, or asks for an exception to policy.",
      welcomeMessage:
        "Hi, I'm Mia. Ask me anything about your order, a return, or how something works.",
      status: "published",
      modelProvider: "anthropic",
    },
  });

  console.log(`agent:  Mia (${agent.id})`);
  console.log(`chat:   /c/${agent.id}`);
  console.log("");
  console.log("Next: sign in, open Mia, and upload samples/northwind-returns.md");
  console.log("under 'Company context' so her answers are grounded.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
