/**
 * Every agent and issue route must treat another organisation's
 * records as if they did not exist. Calls the real route handlers as a
 * signed-in outsider and expects a 404 each time, with nothing changed.
 * Needs DATABASE_URL; no model key.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";

// The session is the only thing faked: the route handlers and their checks are real.
const session = vi.hoisted(() => ({ user: { id: "", email: "" } }));
vi.mock("@/lib/auth/auth", () => ({ currentUser: vi.fn(async () => session.user) }));
vi.mock("@/lib/jobs/client", () => ({ inngest: { send: vi.fn(async () => undefined) } }));

const prisma = new PrismaClient();
const stamp = Date.now().toString(36);
let ownerOrgId: string;
let outsiderOrgId: string;
let outsiderProjectId: string;
let agentId: string;
let conversationId: string;
let issueId: string;

beforeAll(async () => {
  const owner = await prisma.user.create({ data: { email: `rt-owner-${stamp}@example.com`, passwordHash: "x" } });
  const outsider = await prisma.user.create({ data: { email: `rt-outsider-${stamp}@example.com`, passwordHash: "x" } });
  const ownerOrg = await prisma.organization.create({
    data: {
      name: "Owner org",
      slug: `rt-owner-${stamp}`,
      memberships: { create: { userId: owner.id, role: "owner" } },
      projects: { create: { name: "Owner", slug: `rt-owner-project-${stamp}` } },
    },
    include: { projects: true },
  });
  const outsiderOrg = await prisma.organization.create({
    data: {
      name: "Outsider org",
      slug: `rt-outsider-${stamp}`,
      memberships: { create: { userId: outsider.id, role: "owner" } },
      projects: { create: { name: "Outsider", slug: `rt-outsider-project-${stamp}` } },
    },
    include: { projects: true },
  });
  ownerOrgId = ownerOrg.id;
  outsiderOrgId = outsiderOrg.id;
  outsiderProjectId = outsiderOrg.projects[0]!.id;

  const agent = await prisma.agent.create({
    data: {
      projectId: ownerOrg.projects[0]!.id,
      name: "Private",
      jobTitle: "Assistant",
      personality: "",
      responsibilities: [],
      allowedTools: [],
    },
  });
  agentId = agent.id;
  const conversation = await prisma.conversation.create({ data: { agentId, clientSessionId: `rt-${stamp}` } });
  conversationId = conversation.id;
  const issue = await prisma.issue.create({ data: { agentId, conversationId, type: "issue", summary: "Private" } });
  issueId = issue.id;

  session.user = { id: outsider.id, email: outsider.email };
});

afterAll(async () => {
  await prisma.organization.deleteMany({ where: { id: { in: [ownerOrgId, outsiderOrgId] } } });
  await prisma.user.deleteMany({ where: { email: { endsWith: `-${stamp}@example.com` } } });
  await prisma.$disconnect();
});

const json = (body: unknown) =>
  new Request("http://test", { method: "POST", body: JSON.stringify(body), headers: { "content-type": "application/json" } });
const agent = () => ({ params: Promise.resolve({ agentId }) });

describe("another organisation's records are invisible", () => {
  it("agent routes", async () => {
    const agentRoute = await import("@/app/api/agents/[agentId]/route");
    const documents = await import("@/app/api/agents/[agentId]/documents/route");
    const search = await import("@/app/api/agents/[agentId]/search/route");
    const prompt = await import("@/app/api/agents/[agentId]/prompt/route");
    const duplicate = await import("@/app/api/agents/[agentId]/duplicate/route");

    expect((await agentRoute.DELETE(new Request("http://test"), agent())).status).toBe(404);
    expect((await documents.GET(new Request("http://test"), agent())).status).toBe(404);
    expect((await search.GET(new Request("http://test?q=anything"), agent())).status).toBe(404);
    expect((await prompt.GET(new Request("http://test"), agent())).status).toBe(404);
    expect((await duplicate.POST(json({ projectId: outsiderProjectId }), agent())).status).toBe(404);

    expect(await prisma.agent.count({ where: { id: agentId } })).toBe(1);
    expect(await prisma.agent.count({ where: { projectId: outsiderProjectId } })).toBe(0);
  });

  it("issue routes", async () => {
    const issue = await import("@/app/api/issues/[issueId]/route");
    expect((await issue.PATCH(json({ status: "resolved" }), { params: Promise.resolve({ issueId }) })).status).toBe(404);
    expect((await prisma.issue.findUniqueOrThrow({ where: { id: issueId } })).status).toBe("open");
  });
});
