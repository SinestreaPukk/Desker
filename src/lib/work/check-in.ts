/** Project-wide daily or weekly owner check-ins. */
import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { audit } from "@/lib/audit";
import { publishAdminEvent } from "@/lib/events";
import { notifyInBackground } from "@/lib/notify";
import { getProvider, type ChatMessage } from "@/lib/llm/provider";
import { clamp, parseModelJson, stringField } from "./model-json";
import { previousFire } from "./scope";
import { checkInSettings } from "./check-in-settings";
import { agentStatusFacts } from "./agent-status-load";
import { describeAgentStatus } from "./agent-status";
import { deliverEmail, parseRecipients, resolveEmail } from "./integrations";
import { optOutFor, splitOptedOut } from "@/lib/email-optout";
import { localIso, validTimeZone } from "@/lib/local-time";
import { isDigestBulletKind, type DigestBullet, type DigestCadence, type CheckInAgentHealth, type ProjectCheckInStats } from "./types";

const MAX_BULLETS = 7;
const CADENCE_MS = { daily: 86_400_000, weekly: 7 * 86_400_000 } as const;
const CRON = { daily: "0 8 * * *", weekly: "0 8 * * 1" } as const;

type RunFact = { id: string; agentId: string; agentName: string; status: string; headline: string | null; summary: string | null; error: string | null };
type SuggestionFact = { id: string; agentId: string; agentName: string; actionItemId: string | null; summary: string; rationale: string; proposal: string };
interface CheckInFacts {
  projectId: string;
  projectName: string;
  projectSlug: string;
  organizationId: string;
  cadence: Exclude<DigestCadence, "off">;
  timezone: string;
  periodStart: Date;
  periodEnd: Date;
  agents: Array<{ id: string; name: string; jobTitle: string; avatarUrl: string | null; modelProvider: string; model: string | null }>;
  runs: RunFact[];
  awaiting: Array<{ id: string; agentName: string; headline: string | null; since: Date }>;
  suggestions: SuggestionFact[];
  drafts: number;
  agentHealth: CheckInAgentHealth[];
}

function asPreviousHealth(value: unknown): Map<string, { tone: string; headline: string }> {
  const result = new Map<string, { tone: string; headline: string }>();
  if (!Array.isArray(value)) return result;
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    if (typeof row.agentId === "string" && typeof row.tone === "string" && typeof row.headline === "string") {
      result.set(row.agentId, { tone: row.tone, headline: row.headline });
    }
  }
  return result;
}

function statsOf(facts: CheckInFacts): ProjectCheckInStats {
  return {
    runs: facts.runs.length,
    completed: facts.runs.filter((run) => run.status === "done").length,
    failed: facts.runs.filter((run) => run.status === "failed").length,
    awaitingApproval: facts.awaiting.length,
    drafts: facts.drafts,
    suggestions: facts.suggestions.length,
    healthChanges: facts.agentHealth.filter((agent) => agent.changed).length,
  };
}

async function gather(projectId: string, cadence: Exclude<DigestCadence, "off">, timezone: string, periodStart: Date, periodEnd: Date): Promise<CheckInFacts | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, name: true, slug: true, organizationId: true },
  });
  if (!project) return null;
  const scopes = await prisma.scopeOfWork.findMany({
    where: { agent: { projectId }, digestCadence: { not: "off" } },
    select: { agent: { select: { id: true, name: true, jobTitle: true, avatarUrl: true, modelProvider: true, model: true } } },
  });
  const agents = scopes.map((scope) => scope.agent);
  if (agents.length === 0) return null;
  const agentIds = agents.map((agent) => agent.id);
  const [runs, awaitingRows, suggestions, drafts, statuses, previous] = await Promise.all([
    prisma.actionItem.findMany({
      where: { agentId: { in: agentIds }, createdAt: { gte: periodStart, lte: periodEnd } },
      orderBy: { createdAt: "asc" }, take: 100,
      select: { id: true, agentId: true, status: true, headline: true, summary: true, error: true },
    }),
    prisma.actionItem.findMany({
      where: { agentId: { in: agentIds }, status: "needs_approval" },
      orderBy: { awaitingSince: "asc" }, take: 30,
      select: { id: true, agentId: true, headline: true, awaitingSince: true, createdAt: true },
    }),
    prisma.suggestion.findMany({
      where: { agentId: { in: agentIds }, OR: [{ status: "open" }, { status: "snoozed", snoozedUntil: { lte: periodEnd } }] },
      orderBy: { createdAt: "desc" }, take: 20,
      select: { id: true, agentId: true, actionItemId: true, summary: true, rationale: true, proposal: true },
    }),
    prisma.draft.count({ where: { agentId: { in: agentIds }, createdAt: { gte: periodStart, lte: periodEnd } } }),
    agentStatusFacts(projectId, project.organizationId),
    prisma.projectCheckIn.findFirst({
      where: { projectId, periodStart: { lt: periodStart } }, orderBy: { periodStart: "desc" }, select: { agentHealth: true },
    }),
  ]);
  const previousHealth = asPreviousHealth(previous?.agentHealth);
  const names = new Map(agents.map((agent) => [agent.id, agent.name]));
  timezone = validTimeZone(timezone);
  const agentHealth: CheckInAgentHealth[] = [];
  for (const agent of agents) {
    const statusFacts = statuses.get(agent.id);
    if (!statusFacts) continue;
    const status = describeAgentStatus(statusFacts, { project: project.slug, agentId: agent.id });
    const old = previousHealth.get(agent.id);
    const changed = old
      ? old.tone !== status.tone || old.headline !== status.headline
      : status.tone === "warning" || status.tone === "danger";
    agentHealth.push({
      agentId: agent.id, agentName: agent.name, avatarUrl: agent.avatarUrl,
      tone: status.tone, headline: status.headline, detail: clamp(status.detail, 220),
      changed, previousHeadline: old?.headline ?? null,
    });
  }
  return {
    projectId: project.id, projectName: project.name, projectSlug: project.slug,
    organizationId: project.organizationId, cadence, timezone, periodStart, periodEnd, agents,
    runs: runs.map((run) => ({ ...run, agentName: names.get(run.agentId) ?? "Agent" })),
    awaiting: awaitingRows.map((item) => ({ id: item.id, agentName: names.get(item.agentId) ?? "Agent", headline: item.headline, since: item.awaitingSince ?? item.createdAt })),
    suggestions: suggestions.map((item) => ({ ...item, agentName: names.get(item.agentId) ?? "Agent" })),
    drafts, agentHealth,
  };
}

function factsPrompt(facts: CheckInFacts): string {
  const zone = validTimeZone(facts.timezone);
  const lines = [
    `Project: ${facts.projectName}.`,
    `Period: ${localIso(facts.periodStart, zone)} to ${localIso(facts.periodEnd, zone)} (${facts.cadence}).`,
    `Agents on this check-in: ${facts.agents.map((agent) => `${agent.name} (${agent.jobTitle})`).join(", ")}.`,
    facts.runs.length ? "Work that changed in this period:\n" + facts.runs.map((run) => `- ${run.agentName} [${run.status}] ${run.headline ?? "task"}: ${clamp(run.summary ?? run.error ?? "No summary", 350)}`).join("\n") : "No runs changed in this period.",
  ];
  if (facts.awaiting.length) lines.push("Still needs the owner's decision (keep these visible):\n" + facts.awaiting.map((item) => `- ${item.agentName}: ${item.headline ?? "Approval needed"}, waiting since ${localIso(item.since, zone)}.`).join("\n"));
  if (facts.suggestions.length) lines.push("Open suggestions that can be snoozed or delegated:\n" + facts.suggestions.map((item) => `- ${item.agentName}: ${item.summary}. Proposed next step: ${item.proposal}`).join("\n"));
  const changes = facts.agentHealth.filter((agent) => agent.changed);
  if (changes.length) lines.push("Changes in agent health since the previous check-in:\n" + changes.map((agent) => `- ${agent.agentName}: ${agent.previousHeadline ? `${agent.previousHeadline} → ` : "New alert: "}${agent.headline}. ${agent.detail}`).join("\n"));
  if (facts.drafts) lines.push(`${facts.drafts} drafts were created in this period.`);
  return lines.join("\n\n");
}

function parseBullets(value: unknown): DigestBullet[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const row = entry as Record<string, unknown>;
    const text = stringField(row, "text");
    if (!text) return [];
    return [{ kind: isDigestBulletKind(row.kind) ? row.kind : "done", text: clamp(text, 240) }];
  }).slice(0, MAX_BULLETS);
}

function fallback(facts: CheckInFacts): { headline: string; bullets: DigestBullet[] } {
  const stats = statsOf(facts);
  const bullets: DigestBullet[] = [];
  if (stats.awaitingApproval) bullets.push({ kind: "pending", text: `${stats.awaitingApproval} item${stats.awaitingApproval === 1 ? " is" : "s are"} waiting for your approval in Needs you.` });
  for (const health of facts.agentHealth.filter((agent) => agent.changed).slice(0, 2)) {
    bullets.push({ kind: "heads_up", text: `${health.agentName}: ${health.previousHeadline ? `${health.previousHeadline} → ` : "Now "}${health.headline}. ${health.detail}` });
  }
  if (stats.failed) bullets.push({ kind: "heads_up", text: `${stats.failed} task${stats.failed === 1 ? " failed" : "s failed"}${facts.runs.find((run) => run.status === "failed")?.error ? `: ${clamp(facts.runs.find((run) => run.status === "failed")!.error!, 140)}` : "."}` });
  if (stats.suggestions) bullets.push({ kind: "heads_up", text: `${stats.suggestions} suggestion${stats.suggestions === 1 ? " is" : "s are"} ready for you to snooze or delegate below.` });
  if (stats.completed) bullets.push({ kind: "done", text: `The team completed ${stats.completed} task${stats.completed === 1 ? "" : "s"}${stats.drafts ? ` and wrote ${stats.drafts} draft${stats.drafts === 1 ? "" : "s"}` : ""}.` });
  if (!bullets.length) bullets.push({ kind: "done", text: "Nothing needed your attention this period." });
  const headline = stats.failed ? `${stats.completed} done · ${stats.failed} failed` : stats.awaitingApproval ? `${stats.completed} done · ${stats.awaitingApproval} waiting on you` : `${stats.completed} task${stats.completed === 1 ? "" : "s"} completed`;
  return { headline, bullets: bullets.slice(0, MAX_BULLETS) };
}

async function writeCheckIn(facts: CheckInFacts): Promise<{ headline: string; bullets: DigestBullet[] }> {
  const modelAgent = facts.agents[0]!;
  if (!env.hasAnthropicKey && !env.hasOpenAiKey) return fallback(facts);
  const systemPrompt = `You write a concise project check-in for a busy owner. Focus on what changed and what needs them.\nReturn only JSON: {"headline":"under 70 characters","bullets":[{"kind":"heads_up|pending|done","text":"one short sentence"}]}.\nUse at most ${MAX_BULLETS} bullets. Put failures, new health problems and decisions first; approvals second; completed work last. Group related work. Plain English, no jargon, no markdown. Never claim an approval or external action happened before the owner decided.`;
  try {
    const provider = await getProvider(modelAgent.modelProvider);
    const result = await provider.complete({
      billing: { organizationId: facts.organizationId, agentId: modelAgent.id },
      systemPrompt,
      messages: [{ role: "user", content: factsPrompt(facts) } satisfies ChatMessage],
      tools: [], model: modelAgent.model, maxTokens: 1100,
    });
    const parsed = parseModelJson(result.message.content);
    const bullets = parseBullets(parsed?.bullets);
    if (!bullets.length) return fallback(facts);
    return { headline: clamp(stringField(parsed, "headline") || "Your team check-in", 80), bullets };
  } catch (error) {
    console.error("[work/check-in] model call failed", error);
    return fallback(facts);
  }
}

async function emailCheckIn(input: { id: string; organizationId: string; projectName: string; headline: string; bullets: DigestBullet[]; configuredRecipients: string | null; projectSlug: string }) {
  const [mail, membership] = await Promise.all([
    resolveEmail(input.organizationId),
    input.configuredRecipients ? Promise.resolve([]) : prisma.membership.findMany({
      where: { organizationId: input.organizationId, role: { in: ["owner", "admin"] } },
      select: { user: { select: { email: true } } }, take: 10,
    }),
  ]);
  const to = parseRecipients(input.configuredRecipients ?? membership.map((row) => row.user.email).join(","));
  const error = !mail ? "No email provider is connected." : !to.length ? "No valid recipient address." : null;
  if (!mail || error) {
    await prisma.projectCheckIn.update({ where: { id: input.id }, data: { emailError: error } });
    return;
  }
  const { allowed } = await splitOptedOut(input.organizationId, to);
  if (!allowed.length) {
    await prisma.projectCheckIn.update({ where: { id: input.id }, data: { emailError: "All recipients have unsubscribed." } });
    return;
  }
  const organization = await prisma.organization.findUniqueOrThrow({ where: { id: input.organizationId }, select: { id: true, name: true } });
  const optOut = optOutFor(organization, allowed);
  const link = env.appUrl ? `${env.appUrl}/p/${input.projectSlug}/work?view=digests` : "";
  const labels = { heads_up: "Needs you", pending: "Waiting", done: "Done" } as const;
  const text = [input.projectName, input.headline, "", ...input.bullets.map((bullet) => `- [${labels[bullet.kind]}] ${bullet.text}`), "", "Open check-in: " + link, optOut.footer].join("\n");
  const result = await deliverEmail(mail, { to: allowed, subject: `${input.projectName}: ${input.headline}`, text, headers: optOut.headers });
  await prisma.projectCheckIn.update({ where: { id: input.id }, data: result.ok ? { emailedAt: new Date(), emailError: null } : { emailError: clamp(result.detail, 300) } });
}

export async function generateProjectCheckIn(projectId: string, options: { periodEnd?: Date; force?: boolean } = {}): Promise<{ id: string; headline: string } | null> {
  const [project, preferences] = await Promise.all([
    prisma.project.findUnique({ where: { id: projectId }, select: { id: true, organizationId: true, slug: true, name: true, createdAt: true, lastCheckInAt: true } }),
    checkInSettings(projectId),
  ]);
  if (!project || preferences.cadence === "off" && !options.force) return null;
  const cadence = preferences.cadence === "daily" ? "daily" : "weekly";
  const periodEnd = options.periodEnd ?? new Date();
  const window = { periodStart: project.lastCheckInAt ?? new Date(periodEnd.getTime() - CADENCE_MS[cadence]), periodEnd };
  const facts = await gather(projectId, cadence, preferences.timezone, window.periodStart, window.periodEnd);
  if (!facts) return null;
  const currentHealth = facts.agentHealth;
  const changedHealth = currentHealth.some((agent) => agent.changed);
  if (!options.force && facts.runs.length === 0 && facts.awaiting.length === 0 && facts.suggestions.length === 0 && !changedHealth && facts.drafts === 0) {
    await prisma.project.update({ where: { id: projectId }, data: { lastCheckInAt: periodEnd } });
    return null;
  }
  const written = await writeCheckIn(facts);
  const stats = statsOf(facts);
  let checkIn;
  try {
    checkIn = await prisma.projectCheckIn.create({
      data: {
        organizationId: project.organizationId, projectId, cadence,
        periodStart: window.periodStart, periodEnd,
        headline: written.headline,
        bullets: written.bullets as unknown as Prisma.InputJsonValue,
        stats: stats as unknown as Prisma.InputJsonValue,
        agentHealth: currentHealth as unknown as Prisma.InputJsonValue,
        actionItemIds: [...new Set([...facts.runs.map((run) => run.id), ...facts.awaiting.map((item) => item.id)])] as unknown as Prisma.InputJsonValue,
        suggestionIds: facts.suggestions.map((suggestion) => suggestion.id) as unknown as Prisma.InputJsonValue,
      }, select: { id: true, headline: true },
    });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") return null;
    throw error;
  }
  await prisma.project.update({ where: { id: projectId }, data: { lastCheckInAt: periodEnd } });
  if (preferences.email) await emailCheckIn({ id: checkIn.id, organizationId: project.organizationId, projectName: project.name, headline: written.headline, bullets: written.bullets, configuredRecipients: preferences.recipients || null, projectSlug: project.slug });
  notifyInBackground({ kind: "digest", title: `${project.name}: ${written.headline}`, body: written.bullets.map((bullet) => `• ${bullet.text}`).join("\n"), agentName: project.name, path: `/p/${project.slug}/work?view=digests`, organizationId: project.organizationId, peopleOnly: true });
  publishAdminEvent({ type: "checkin.created", projectId, checkInId: checkIn.id });
  await audit({ organizationId: project.organizationId, actorType: "agent", actorId: facts.agents[0]!.id, action: "project.checkin.created", targetType: "project_checkin", targetId: checkIn.id, metadata: { cadence, headline: written.headline, bullets: written.bullets.length, healthChanges: stats.healthChanges } });
  return checkIn;
}

export async function runDueCheckIns(now = new Date()): Promise<string[]> {
  const projects = await prisma.project.findMany({
    where: { agents: { some: { scopeOfWork: { is: { digestCadence: { not: "off" } } } } } },
    select: { id: true, createdAt: true, lastCheckInAt: true },
  });
  const generated: string[] = [];
  for (const project of projects) {
    const settings = await checkInSettings(project.id);
    if (settings.cadence === "off") continue;
    const due = previousFire(CRON[settings.cadence], settings.timezone, now);
    if (!due || due <= (project.lastCheckInAt ?? project.createdAt)) continue;
    try {
      const item = await generateProjectCheckIn(project.id, { periodEnd: due });
      if (item) generated.push(item.id);
    } catch (error) {
      console.error(`[work/check-in] failed for project ${project.id}`, error);
      await prisma.project.update({ where: { id: project.id }, data: { lastCheckInAt: due } }).catch(() => {});
    }
  }
  return generated;
}

export async function generateCheckInForAgent(agentId: string): Promise<{ id: string; headline: string } | null> {
  const agent = await prisma.agent.findUnique({ where: { id: agentId }, select: { projectId: true } });
  return agent ? generateProjectCheckIn(agent.projectId, { force: true }) : null;
}
