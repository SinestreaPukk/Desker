#!/usr/bin/env node
/**
 * The product screenshots on the landing page, taken from the running app.
 *
 *   npm run dev                       # in another terminal
 *   node scripts/product-shots.mjs    # writes public/product/*.png
 *
 * Stages one sample scene in the demo workspace (see seed-demo.mjs) - an
 * Assistant handing a post to the Marketer, the post waiting for approval,
 * an email sent after approval - then signs in as the demo owner and captures
 * the real screens. Rerunning replaces the scene, so the shots always show
 * the current UI. Local only: it writes to whatever DATABASE_URL points at.
 */
import "./load-env.mjs";
import { mkdirSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { chromium } from "playwright";

const BASE = process.env.SHOTS_URL ?? "http://localhost:3000";
const email = process.env.DEMO_EMAIL ?? "demo@northwind.example";
const password = process.env.DEMO_PASSWORD ?? "demo-password-2026";
const OUT = "public/product";

const prisma = new PrismaClient();
const at = (minutesAgo) => new Date(Date.now() - minutesAgo * 60_000);

async function stageScene() {
  const owner = await prisma.user.findUniqueOrThrow({ where: { email } });
  const membership = await prisma.membership.findFirstOrThrow({ where: { userId: owner.id } });
  const organizationId = membership.organizationId;
  const project = await prisma.project.findFirstOrThrow({ where: { organizationId }, orderBy: { createdAt: "asc" } });
  const sam = await prisma.agent.findFirstOrThrow({ where: { projectId: project.id, jobTitle: "Content Marketer" } });

  // Replace the previous scene: Ava and everything she started.
  const previous = await prisma.agent.findMany({ where: { projectId: project.id, name: "Ava" }, select: { id: true } });
  const oldRuns = await prisma.actionItem.findMany({
    where: { OR: [{ agentId: { in: previous.map((a) => a.id) } }, { agentId: sam.id, type: "colleague_delegation" }] },
    select: { id: true },
  });
  await prisma.auditLog.deleteMany({ where: { targetId: { in: oldRuns.map((r) => r.id) } } });
  await prisma.actionItem.deleteMany({ where: { id: { in: oldRuns.map((r) => r.id) } } });
  await prisma.agent.deleteMany({ where: { id: { in: previous.map((a) => a.id) } } });

  const ava = await prisma.agent.create({
    data: {
      projectId: project.id,
      name: "Ava",
      jobTitle: "Executive Assistant",
      department: "Operations",
      personality: "Calm, organised and discreet.",
      responsibilities: ["Draft emails and replies for approval", "Schedule follow-ups so nothing is dropped"],
      escalationRule: "Escalate if a request involves money, a legal commitment, or agreeing to a date on someone's behalf.",
      allowedTools: ["escalate_to_human"],
      status: "published",
      scopeOfWork: {
        create: {
          objectives: ["Follow up on meeting notes and incoming requests"],
          documentIds: [],
          autonomy: "draft_only",
          toolAutonomy: { slack_post_message: "auto" },
          tools: [
            "search_documents", "draft_content", "suggest_opportunity", "delegate_to_colleague", "send_email",
            "schedule_followup", "calendar_list_events", "calendar_create_event", "slack_post_message", "escalate_to_human",
          ],
        },
      },
    },
  });

  const log = (minutesAgo, actorId, action, targetId, metadata) =>
    prisma.auditLog.create({
      data: { organizationId, actorType: actorId === owner.id ? "user" : "agent", actorId, action, targetType: "action_item", targetId, metadata, createdAt: at(minutesAgo) },
    });
  const tool = (minutesAgo, agentId, runId, name, input, result, gated = false) =>
    log(minutesAgo, agentId, "tool.called", runId, { tool: name, ok: true, gated, trigger: "manual", input, result });

  // Yesterday: an email Ava wrote, approved by the owner, sent.
  const email1 = await prisma.actionItem.create({
    data: {
      organizationId, agentId: ava.id, type: "scope_run", trigger: "manual", status: "done", payload: {},
      headline: "Sent the supplier the revised delivery dates",
      summary: "Drafted a reply to Hartley Timber confirming the revised delivery dates. You approved it and it was sent.",
      approvedById: owner.id, approvedAt: at(1300), createdAt: at(1340), startedAt: at(1340), completedAt: at(1299),
    },
  });
  await tool(1338, ava.id, email1.id, "send_email", { to: ["orders@hartley.example"], subject: "Revised delivery dates" }, "Queued for approval.", true);
  await log(1300, owner.id, "action_item.approved", email1.id, {});
  await log(1299, ava.id, "send_email.delivered", email1.id, { tool: "send_email", detail: "Delivered to orders@hartley.example" });

  // This morning: Ava follows up on the team meeting and hands the announcement to Sam.
  const run = await prisma.actionItem.create({
    data: {
      organizationId, agentId: ava.id, type: "scope_run", trigger: "manual", status: "done",
      payload: { objective: "Follow up on Monday's team meeting" },
      headline: "Followed up on Monday's team meeting",
      summary: "Sent the three owners their action items as drafts for your approval, and asked Sam to announce the new opening hours to customers.",
      createdAt: at(95), startedAt: at(95), completedAt: at(88),
    },
  });
  const handoff = await prisma.actionItem.create({
    data: {
      organizationId, agentId: sam.id, type: "colleague_delegation", trigger: "delegation", parentId: run.id,
      status: "needs_approval", awaitingSince: at(80), createdAt: at(89), startedAt: at(88),
      payload: {
        objective: "Announce the new opening hours (Mon-Sat 8:00-18:00 from 3 March) to customers",
        context: "Agreed in Monday's meeting. Keep it short and friendly; mention Saturday mornings are new.",
        delegatedByAgentId: ava.id, delegatedByAgentName: "Ava",
      },
      headline: "Drafted the opening-hours post for your approval",
      summary: "Ava asked me to announce the new opening hours. I wrote a short post for the website and it is waiting for your approval.",
    },
  });
  const draft = await prisma.draft.create({
    data: {
      organizationId, agentId: sam.id, actionItemId: handoff.id, kind: "blog_post",
      title: "We're open on Saturday mornings",
      body: "From Monday 3 March we're open Monday to Saturday, 8:00 to 18:00.\n\nSaturday mornings are new: pick up an order, get a tool sharpened, or just come and ask a question.\n\nSee you soon - the Northwind team",
    },
  });
  await prisma.actionItem.update({
    where: { id: handoff.id },
    data: { pendingAction: { tool: "publish_post", input: { draft_id: draft.id }, draftId: draft.id, note: "For the website news page." } },
  });

  await tool(94, ava.id, run.id, "search_documents", { query: "meeting notes 24 February" }, "2 relevant passage(s)");
  await tool(92, ava.id, run.id, "draft_content", { kind: "email", title: "Your action items from Monday" }, "Draft saved.");
  await tool(89, ava.id, run.id, "delegate_to_colleague", { colleague_id: sam.id, task: "Announce the new opening hours to customers" }, `Delegated task to Sam (Content Marketer) as task ${handoff.id}.`);
  await log(88, ava.id, "action_item.done", run.id, { summary: "Followed up on Monday's team meeting" });
  await tool(86, sam.id, handoff.id, "draft_content", { kind: "blog_post", title: "We're open on Saturday mornings" }, "Draft saved.");
  await tool(81, sam.id, handoff.id, "publish_post", { draft_id: draft.id }, "Queued for approval.", true);
  await log(80, sam.id, "action_item.needs_approval", handoff.id, {});

  return { project: project.slug, avaId: ava.id, runId: run.id };
}

async function capture({ project, avaId, runId }) {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1280, height: 860 }, deviceScaleFactor: 2, colorScheme: "light" });

  await page.goto(`${BASE}/login`);
  await page.fill("#email", email);
  await page.fill("#password", password);
  await Promise.all([page.waitForURL((url) => !url.pathname.startsWith("/login")), page.click("button[type=submit]")]);

  // The dense screens at 1024, the narrowest desktop layout: they are shown
  // about 640px wide on the landing page and their text has to stay readable.
  // (Narrower brings in the phone's top bar, which covers the content.)
  const shoot = async (path, selector, file, width = 1280) => {
    await page.setViewportSize({ width, height: 1600 }); // tall enough that nothing scrolls under a sticky bar
    await page.goto(`${BASE}${path}`);
    const target = page.locator(selector).first();
    await target.waitFor();
    await page.waitForTimeout(600); // let entrance motion settle
    await target.screenshot({ path: `${OUT}/${file}`, animations: "disabled" });
    console.log(`[product-shots] ${file}`);
  };

  await shoot(`/p/${project}/inbox?tab=approvals`, "div.overflow-hidden:has-text('Nothing goes out until you approve it.')", "approval.png", 1024);
  await shoot(`/p/${project}/agents/${avaId}`, "section[aria-labelledby=boundaries-title]", "boundaries.png");
  // The thread itself, banner to last row: without the filters above it or
  // the empty page below.
  await page.setViewportSize({ width: 1024, height: 1600 });
  await page.goto(`${BASE}/p/${project}/audit?thread=${runId}`);
  const banner = page.locator("div:has(> p:has-text('One hand-off between'))").first();
  await banner.waitFor();
  await page.waitForTimeout(600);
  const top = await banner.boundingBox();
  const last = await page.locator("#admin-main section:has(h2)").last().boundingBox();
  await page.screenshot({
    path: `${OUT}/handoff-thread.png`,
    clip: { x: top.x, y: top.y, width: top.width, height: last.y + last.height - top.y },
    animations: "disabled",
  });
  console.log("[product-shots] handoff-thread.png");
  await shoot(`/p/${project}/roster`, "section[aria-label^='Last']", "activity.png");
  await browser.close();
}

try {
  await capture(await stageScene());
} finally {
  await prisma.$disconnect();
}
