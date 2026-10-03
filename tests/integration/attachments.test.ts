import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const stamp = Date.now().toString(36);
let organizationId: string;
let projectId: string;
let agentId: string;

beforeAll(async () => {
  const org = await prisma.organization.create({
    data: { name: `Att ${stamp}`, slug: `att-${stamp}`, projects: { create: { name: "Att", slug: `att-project-${stamp}` } } },
    include: { projects: true },
  });
  organizationId = org.id;
  projectId = org.projects[0]!.id;
  const agent = await prisma.agent.create({
    data: { projectId, name: "A", jobTitle: "x", personality: "x", responsibilities: [], allowedTools: [], status: "published" },
  });
  agentId = agent.id;
});

afterAll(async () => {
  await prisma.organization.delete({ where: { id: organizationId } }).catch(() => {});
  await prisma.$disconnect();
});

describe("receiveAttachment", () => {
  it("keeps a text document in the assistant's files and offers next steps", async () => {
    const { receiveAttachment } = await import("@/lib/life/attachments");
    const reply = await receiveAttachment({ organizationId, projectId }, agentId, {
      name: "trip-plan.txt",
      type: "text/plain",
      data: Buffer.from("Day 1: Chiang Mai. Day 2: Pai. Budget 30000 THB."),
    });
    expect(reply.text).toMatch(/Saved trip-plan\.txt/);
    expect(reply.nextSteps).toContain("Summarise it");
    const doc = await prisma.document.findFirstOrThrow({ where: { agentId } });
    expect(doc.filename).toBe("trip-plan.txt");
    expect(doc.error ?? "").toBe("");
    expect(["pending", "ready"]).toContain(doc.status);
  });

  it("turns away what it cannot read, and needs an assistant for documents", async () => {
    const { receiveAttachment } = await import("@/lib/life/attachments");
    expect((await receiveAttachment({ organizationId, projectId }, agentId, { name: "clip.mp4", type: "video/mp4", data: Buffer.from("x") })).text).toMatch(/photos, PDFs/);
    expect((await receiveAttachment({ organizationId, projectId }, null, { name: "a.txt", type: "text/plain", data: Buffer.from("hello") })).text).toMatch(/Switch your assistant on/);
  });
});
