/**
 * The support desk's closed loop, end to end without a model: a customer
 * message arrives at the intake address and starts the Support workflow
 * (once, however often it is resent); when the approved reply is delivered,
 * the helpdesk is told the ticket was answered, with a signature it can
 * check. Email delivery and the helpdesk are faked at the network edge.
 * Needs DATABASE_URL and VAULT_KEY.
 */
import { createHmac } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { PrismaClient } from "@prisma/client";

vi.mock("@/lib/jobs/client", () => ({ inngest: { send: vi.fn(async () => undefined) } }));
vi.mock("@/lib/work/integrations", async (original) => ({
  ...(await original<typeof import("@/lib/work/integrations")>()),
  resolveEmail: vi.fn(async () => ({ provider: "resend", apiKey: "re_test", from: "help@acme.example" })),
  deliverEmail: vi.fn(async () => ({ ok: true, status: 200, detail: "Delivered (200)" })),
}));

import { POST as intake } from "@/app/api/intake/[token]/route";
import { executeApprovedAction, inlineSteps } from "@/lib/work/runner";
import { seal } from "@/lib/vault";

const prisma = new PrismaClient();
const stamp = Date.now().toString(36);
const token = `tok-${stamp}`;
let orgId: string;
let agentId: string;

beforeAll(async () => {
  const org = await prisma.organization.create({
    data: {
      name: "Acme",
      slug: `si-${stamp}`,
      mailingAddress: "1 High St, Leeds",
      projects: { create: { name: "Acme", slug: `si-${stamp}` } },
    },
    include: { projects: true },
  });
  orgId = org.id;
  const agent = await prisma.agent.create({
    data: {
      projectId: org.projects[0]!.id,
      name: "Mia",
      jobTitle: "Customer Support Lead",
      personality: "Warm.",
      responsibilities: [],
      allowedTools: [],
      status: "published",
    },
  });
  agentId = agent.id;
  await prisma.supportInbox.create({
    data: {
      organizationId: orgId,
      projectId: org.projects[0]!.id,
      agentId,
      token,
      callbackUrl: "https://helpdesk.example/hooks/desker",
      callbackSecret: seal("shh"),
    },
  });
});

afterAll(async () => {
  await prisma.organization.deleteMany({ where: { id: orgId } });
  await prisma.$disconnect();
  vi.restoreAllMocks();
});

const send = (body: unknown, type = "application/json") =>
  intake(
    new Request(`http://localhost/api/intake/${token}`, {
      method: "POST",
      headers: { "content-type": type },
      body: type === "application/json" ? JSON.stringify(body) : String(body),
    }),
    { params: Promise.resolve({ token }) },
  );

describe("the support inbox", () => {
  it("answers a ticket once, and tells the helpdesk when the approved reply went out", async () => {
    const first = await send({ from: "Jo <jo@example.com>", subject: "Returns", message: "Can I return it after 40 days?", id: "T-1" });
    expect(first.status).toBe(202);
    const { id } = (await first.json()) as { id: string };
    // The helpdesk retries the same delivery: nothing new starts.
    const again = await send({ from: "jo@example.com", message: "Can I return it after 40 days?", id: "T-1" });
    expect(((await again.json()) as { duplicate?: boolean }).duplicate).toBe(true);

    const run = await prisma.actionItem.findUniqueOrThrow({ where: { id } });
    expect(run.agentId).toBe(agentId);
    const payload = run.payload as { instruction: string; intake: { ticketId: string; email: string }; workflow: { id: string } };
    expect(payload.workflow.id).toBe("question-to-answer");
    expect(payload.intake).toMatchObject({ ticketId: "T-1", email: "jo@example.com" });
    expect(payload.instruction).toContain("Reply by email to jo@example.com.");

    // The agent drafted a reply and the owner approved it in Needs you.
    const draft = await prisma.draft.create({
      data: { organizationId: orgId, agentId, actionItemId: id, kind: "email", title: "Re: Returns", body: "Yes - within 60 days, unopened." },
    });
    await prisma.actionItem.update({
      where: { id },
      data: {
        status: "approved",
        approvedAt: new Date(),
        pendingAction: { tool: "send_email", draftId: draft.id, input: { to: ["jo@example.com"], subject: "Re: Returns" } },
      },
    });

    const calls: { url: string; body: string; signature: string | null }[] = [];
    const realFetch = globalThis.fetch;
    vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
      if (String(url).startsWith("https://helpdesk.example")) {
        calls.push({ url: String(url), body: String(init?.body), signature: new Headers(init?.headers).get("x-desker-signature") });
        return new Response("ok");
      }
      return realFetch(url, init);
    });

    expect(await executeApprovedAction(id, inlineSteps)).toBe("done");
    expect(calls).toHaveLength(1);
    const report = JSON.parse(calls[0]!.body) as { event: string; ticketId: string; reply: string };
    expect(report).toMatchObject({ event: "ticket.answered", ticketId: "T-1", reply: "Yes - within 60 days, unopened." });
    expect(calls[0]!.signature).toBe(`sha256=${createHmac("sha256", "shh").update(calls[0]!.body).digest("hex")}`);
  });

  it("takes a plain website form, and says what is missing from a bad one", async () => {
    expect((await send("email=sam%40example.com&message=Where+is+my+order%3F", "application/x-www-form-urlencoded")).status).toBe(202);
    const bad = await send({ message: "No address" });
    expect(bad.status).toBe(422);
    expect(((await bad.json()) as { error: string }).error).toMatch(/email address/);
  });

  it("answers 404 for an unknown address", async () => {
    const response = await intake(new Request("http://localhost/api/intake/nope", { method: "POST", body: "{}" }), {
      params: Promise.resolve({ token: "nope" }),
    });
    expect(response.status).toBe(404);
  });
});
