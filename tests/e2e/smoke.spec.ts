import { expect, test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { currentProjectSlug } from "./helpers";

/**
 * The path every other phase depends on staying intact: hire an agent from a
 * role template, publish it, have its scope of work produce a task, approve
 * what the task wants to send, and read the digest the agent writes about
 * itself. If this suite is green, the product's spine is intact; if it is
 * red, something in the last six phases has been taken out from under it.
 *
 * Written to run with or without a model key. Where a real run would need one
 * - a task that gets far enough to ask for approval - the record is seeded
 * directly, because what is being smoke-tested there is the approval path
 * (the card, the route, the state machine), not the model.
 */
test.describe.configure({ mode: "serial" });

const prisma = new PrismaClient();
const stamp = Date.now().toString(36);
const AGENT = `Smoke ${stamp}`;

let project: string;
let agentId: string;

test.afterAll(async () => {
  await prisma.$disconnect();
});

test("hire an agent from a role template", async ({ page }) => {
  project = await currentProjectSlug(page);
  await page.goto(`/p/${project}/agents/new`);

  await page.getByRole("button", { name: /Content marketer|Marketer/ }).first().click();
  await page.getByRole("button", { name: "Continue" }).click();

  await page.getByLabel("Name").fill(AGENT);
  await page.getByRole("button", { name: "Continue" }).click();
  // The template fills the personality; nothing more is needed to continue.
  await expect(page.getByLabel("Personality and tone")).not.toHaveValue("");
  await page.getByRole("button", { name: "Continue" }).click();
  // The optional connections step: skipped.
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("button", { name: "Create agent" }).click();

  // Not /agents/new: that is the wizard this test just came from, and it
  // matches a lazier pattern.
  await expect(page).toHaveURL(/\/p\/[^/]+\/agents\/(?!new)[^/?]+/, { timeout: 30_000 });
  agentId = page.url().split("?")[0]!.split("/").pop()!;
  expect(agentId).toBeTruthy();
  await expect(page.getByRole("heading", { name: AGENT }).first()).toBeVisible();
});

test("publish it", async ({ page }) => {
  await page.goto(`/p/${project}/agents/${agentId}`);
  await page.getByRole("button", { name: "Publish", exact: true }).click();
  await expect(page.getByRole("button", { name: "Unpublish" })).toBeVisible({ timeout: 20_000 });

  // Published means reachable: the public link answers without a session.
  const response = await page.request.get(`/c/${agentId}`);
  expect(response.status()).toBe(200);
});

test("its scope of work produces a task", async ({ page }) => {
  await page.goto(`/p/${project}/agents/${agentId}`);
  await page.getByRole("button", { name: /Work & schedule/ }).first().click();

  await page
    .getByLabel(/What should this agent know about the work/)
    .fill("We sell hand tools to tradespeople. This quarter is about the lifetime warranty.");
  await page.getByLabel("Objectives").fill("Write one short note about the warranty");
  await page.getByRole("button", { name: /Save scope/ }).click();
  // Run now sits in the schedule strip and in the panel footer; the footer
  // one waits for the save, which is what this checks.
  await expect(page.getByRole("button", { name: /Run now/ }).last()).toBeEnabled({ timeout: 20_000 });

  await page.getByRole("button", { name: /Run now/ }).last().click();

  // A task exists either way; with a model key it also gets somewhere. What
  // matters here is that pressing Run now creates a run and the Work page
  // shows it rather than staying empty.
  await page.goto(`/p/${project}/work?agentId=${agentId}`);
  await expect(page.getByText(AGENT).first()).toBeVisible({ timeout: 30_000 });

  const run = await prisma.actionItem.findFirst({
    where: { agentId },
    orderBy: { createdAt: "desc" },
  });
  expect(run, "pressing Run now must create a task").not.toBeNull();
  // How far the run then gets depends on a model and a job runtime, neither of
  // which this environment has - that path is covered by the live integration
  // test. What this suite guards is that the button still makes a task and the
  // Work page still shows it.
});

test("approve what a task wants to send", async ({ page }) => {
  const agent = await prisma.agent.findUniqueOrThrow({
    where: { id: agentId },
    include: { project: true },
  });

  // The record a draft-only run leaves behind when it reaches publish_post.
  const draft = await prisma.draft.create({
    data: {
      organizationId: agent.project.organizationId,
      agentId,
      kind: "social_caption",
      title: `Lifetime warranty ${stamp}`,
      body: "Every hand tool we sell is covered for life. No receipt, no argument.",
    },
  });
  const item = await prisma.actionItem.create({
    data: {
      organizationId: agent.project.organizationId,
      agentId,
      type: "publish_post",
      trigger: "manual",
      status: "needs_approval",
      awaitingSince: new Date(),
      payload: {},
      summary: "Wrote one short caption about the lifetime warranty and queued it for you.",
      headline: "Drafted a warranty caption",
      pendingAction: { tool: "publish_post", draftId: draft.id, input: { draft_id: draft.id } },
      drafts: { connect: { id: draft.id } },
    },
  });

  await page.goto(`/p/${project}/inbox`);
  await page.getByRole("tab", { name: /Approvals/ }).click();

  // The card shows what it wants to send, not a status code.
  await expect(page.getByText(`Lifetime warranty ${stamp}`)).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: /^Approve/ }).first().click();

  await expect
    .poll(async () => (await prisma.actionItem.findUnique({ where: { id: item.id } }))?.status, {
      timeout: 30_000,
      message: "approving must move the item out of the queue",
    })
    .not.toBe("needs_approval");
});

test("read the digest the agent writes about itself", async ({ page }) => {
  const response = await page.request.post(`/api/agents/${agentId}/digest`);
  expect(response.ok()).toBe(true);

  await expect
    .poll(async () => prisma.digest.count({ where: { agentId } }), {
      timeout: 60_000,
      message: "requesting an update must write one",
    })
    .toBeGreaterThan(0);

  await page.goto(`/p/${project}/inbox`);
  await page.getByRole("tab", { name: /Updates/ }).click();

  const digest = await prisma.digest.findFirstOrThrow({
    where: { agentId },
    orderBy: { createdAt: "desc" },
  });
  await expect(page.getByText(digest.headline).first()).toBeVisible({ timeout: 20_000 });
  // It reads as an update, not as a row of counters.
  await expect(page.getByText(AGENT).first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Mark read" }).first()).toBeVisible();
});
