/**
 * A failed run always has a way forward: the retry route starts a fresh run
 * (or, when only the sending failed, puts the same send back in Needs you),
 * marks the failure handled, and the roster's status for that agent offers the
 * retry in the first place. Real route handlers; only the session is faked.
 * Needs DATABASE_URL; no model key.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";

const session = vi.hoisted(() => ({ user: { id: "", email: "" } }));
vi.mock("@/lib/auth", () => ({ currentUser: vi.fn(async () => session.user) }));
vi.mock("@/lib/jobs/client", () => ({ inngest: { send: vi.fn(async () => undefined) } }));

import { POST as retry } from "@/app/api/action-items/[actionItemId]/retry/route";
import { GET as listAgents } from "@/app/api/agents/route";

const prisma = new PrismaClient();
const stamp = Date.now().toString(36);
let orgId: string;
let slug: string;
let agentId: string;

beforeAll(async () => {
  const user = await prisma.user.create({ data: { email: `rec-${stamp}@example.com`, passwordHash: "x" } });
  session.user = { id: user.id, email: user.email };
  slug = `rec-${stamp}`;
  const org = await prisma.organization.create({
    data: {
      name: "Recovery",
      slug,
      memberships: { create: { userId: user.id, role: "owner" } },
      projects: { create: { name: "Recovery", slug } },
    },
    include: { projects: true },
  });
  orgId = org.id;
  const agent = await prisma.agent.create({
    data: {
      projectId: org.projects[0]!.id,
      name: "Sol",
      jobTitle: "Researcher",
      personality: "Plain.",
      responsibilities: [],
      allowedTools: [],
      status: "published",
    },
  });
  agentId = agent.id;
});

afterAll(async () => {
  await prisma.organization.deleteMany({ where: { id: orgId } });
  await prisma.user.deleteMany({ where: { email: `rec-${stamp}@example.com` } });
  await prisma.$disconnect();
});

const call = (id: string) =>
  retry(new Request(`http://localhost/api/action-items/${id}/retry`, { method: "POST" }), {
    params: Promise.resolve({ actionItemId: id }),
  });

describe("recovering from a failed run", () => {
  it("shows the failure on the roster with a retry, then retries it and clears the flag", async () => {
    const failed = await prisma.actionItem.create({
      data: {
        organizationId: orgId,
        agentId,
        type: "scope_run",
        trigger: "manual",
        payload: { instruction: "Research the warranty market" },
        status: "failed",
        error: "The model timed out.",
        completedAt: new Date(),
      },
    });
    await prisma.issue.create({
      data: { agentId, actionItemId: failed.id, source: "agent", type: "failure", summary: "Run failed" },
    });

    const roster = (await (await listAgents(new Request(`http://localhost/api/agents?project=${slug}`))).json()) as {
      id: string;
      health?: { headline: string; actions: { kind: string }[] };
    }[];
    const health = roster.find((agent) => agent.id === agentId)!.health!;
    expect(health.headline).toBe("Last run failed");
    expect(health.actions[0]!.kind).toBe("retry");

    const response = await call(failed.id);
    expect(response.status).toBe(200);
    const { id, resend } = (await response.json()) as { id: string; resend: boolean };
    expect(resend).toBe(false);
    const fresh = await prisma.actionItem.findUniqueOrThrow({ where: { id } });
    expect((fresh.payload as { instruction?: string }).instruction).toBe("Research the warranty market");
    expect(await prisma.issue.count({ where: { actionItemId: failed.id, status: "open" } })).toBe(0);
    // The failure stays on the record.
    expect((await prisma.actionItem.findUniqueOrThrow({ where: { id: failed.id } })).status).toBe("failed");
  });

  it("puts a failed send back in Needs you instead of redoing the work", async () => {
    const failed = await prisma.actionItem.create({
      data: {
        organizationId: orgId,
        agentId,
        type: "scope_run",
        trigger: "schedule",
        payload: {},
        status: "failed",
        error: "Slack is not connected.",
        approvedAt: new Date(),
        pendingAction: { tool: "slack_post_message", input: { channel: "#news", text: "Hello" } },
        completedAt: new Date(),
      },
    });
    const response = await call(failed.id);
    const { id, resend } = (await response.json()) as { id: string; resend: boolean };
    expect(resend).toBe(true);
    const copy = await prisma.actionItem.findUniqueOrThrow({ where: { id } });
    expect(copy.status).toBe("needs_approval");
    expect(copy.pendingAction).toMatchObject({ tool: "slack_post_message" });
  });

  it("refuses to retry anything that has not failed", async () => {
    const done = await prisma.actionItem.create({
      data: { organizationId: orgId, agentId, type: "scope_run", trigger: "manual", payload: {}, status: "done" },
    });
    expect((await call(done.id)).status).toBe(409);
  });
});
