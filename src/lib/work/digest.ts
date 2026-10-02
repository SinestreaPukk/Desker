/**
 * The digest: an agent's own account of the last week (or day), unprompted.
 *
 * A run summary answers "what happened in that task". A digest answers the
 * question an owner actually has - "what has this agent been doing, and is
 * anything waiting on me?" - without them opening anything. It is generated on
 * a schedule, lands in the Inbox's Updates tab, and optionally goes out by
 * email.
 *
 * Short by construction: at most a handful of bullets, ordered by what needs a
 * decision rather than by everything the agent touched. A period with nothing
 * in it produces no digest at all - silence is the correct update when nothing
 * happened, and an owner who gets an empty digest stops reading the real ones.
 */
import { localIso, validTimeZone } from "@/lib/local-time";
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
import { optOutFor, splitOptedOut } from "@/lib/email-optout";
import { deliverEmail, parseRecipients, resolveEmail } from "./integrations";
import {
  isDigestBulletKind,
  isDigestCadence,
  type DigestBullet,
  type DigestCadence,
  type DigestStats,
} from "./types";

/** How many lines an owner will actually read. */
export const MAX_DIGEST_BULLETS = 6;

/**
 * When each cadence fires, in the scope's own timezone. Morning, because a
 * digest is something you read before deciding what your day looks like.
 */
export function digestCron(cadence: DigestCadence): string | null {
  switch (cadence) {
    case "daily":
      return "0 8 * * *";
    case "weekly":
      return "0 8 * * 1";
    default:
      return null;
  }
}

const CADENCE_MS: Record<Exclude<DigestCadence, "off">, number> = {
  daily: 24 * 60 * 60_000,
  weekly: 7 * 24 * 60 * 60_000,
};

/**
 * The window a digest covers: from the end of the last one, or one cadence
 * back for the first. Capped at four cadences so an agent that was paused for
 * a month does not come back with a quarter's worth of history.
 */
export function digestWindow(
  cadence: Exclude<DigestCadence, "off">,
  periodEnd: Date,
  lastDigestAt: Date | null,
): { periodStart: Date; periodEnd: Date } {
  const span = CADENCE_MS[cadence];
  const earliest = new Date(periodEnd.getTime() - span * 4);
  const start = lastDigestAt && lastDigestAt > earliest ? lastDigestAt : new Date(periodEnd.getTime() - span);
  return { periodStart: start, periodEnd };
}

// --- what a period contained ------------------------------------------------

interface DigestFacts {
  agentName: string;
  jobTitle: string;
  cadence: Exclude<DigestCadence, "off">;
  periodStart: Date;
  periodEnd: Date;
  /** The owner's zone: every time the digest's writer sees is in it. */
  timeZone?: string;
  runs: {
    id: string;
    status: string;
    headline: string | null;
    summary: string | null;
    error: string | null;
    createdAt: Date;
  }[];
  awaiting: { id: string; headline: string | null; tool: string | null; since: Date }[];
  suggestions: { summary: string; proposal: string }[];
  drafts: number;
}

function statsOf(facts: DigestFacts): DigestStats {
  return {
    runs: facts.runs.length,
    completed: facts.runs.filter((run) => run.status === "done").length,
    failed: facts.runs.filter((run) => run.status === "failed").length,
    awaitingApproval: facts.awaiting.length,
    drafts: facts.drafts,
    suggestions: facts.suggestions.length,
  };
}

/** Nothing ran, nothing is waiting, nothing was suggested: no digest is owed. */
function isEmpty(facts: DigestFacts): boolean {
  return facts.runs.length === 0 && facts.awaiting.length === 0 && facts.suggestions.length === 0;
}

async function gather(
  agentId: string,
  cadence: Exclude<DigestCadence, "off">,
  window: { periodStart: Date; periodEnd: Date },
  agent: { name: string; jobTitle: string },
  timeZone: string,
): Promise<DigestFacts> {
  const [runs, awaiting, suggestions, drafts] = await Promise.all([
    prisma.actionItem.findMany({
      where: { agentId, createdAt: { gte: window.periodStart, lte: window.periodEnd } },
      orderBy: { createdAt: "asc" },
      take: 50,
      select: {
        id: true,
        status: true,
        headline: true,
        summary: true,
        error: true,
        createdAt: true,
      },
    }),
    // Anything still waiting on a person counts, however old: an approval
    // forgotten two weeks ago is exactly what a digest is for.
    prisma.actionItem.findMany({
      where: { agentId, status: "needs_approval" },
      orderBy: { awaitingSince: "asc" },
      take: 10,
      select: { id: true, headline: true, pendingAction: true, awaitingSince: true, createdAt: true },
    }),
    prisma.suggestion.findMany({
      where: {
        agentId,
        OR: [{ status: "open" }, { status: "snoozed", snoozedUntil: { lte: window.periodEnd } }],
      },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { summary: true, proposal: true },
    }),
    prisma.draft.count({
      where: { agentId, createdAt: { gte: window.periodStart, lte: window.periodEnd } },
    }),
  ]);

  return {
    agentName: agent.name,
    jobTitle: agent.jobTitle,
    cadence,
    periodStart: window.periodStart,
    periodEnd: window.periodEnd,
    timeZone,
    runs,
    awaiting: awaiting.map((item) => ({
      id: item.id,
      headline: item.headline,
      tool: (item.pendingAction as { tool?: string } | null)?.tool ?? null,
      since: item.awaitingSince ?? item.createdAt,
    })),
    suggestions,
    drafts,
  };
}

// --- writing it -------------------------------------------------------------

const SYSTEM_PROMPT = `You write the update an AI worker sends its employer at the end of a period.

You are given everything that worker did in the window: its tasks with its own summaries, anything still waiting for the owner's decision, and the recommendations it has raised. Turn that into one short update.

Reply with one JSON object and nothing else:
{
  "headline": "under 70 characters: what the period amounted to",
  "bullets": [{ "kind": "heads_up" | "pending" | "done", "text": "one sentence" }]
}

Rules:
- At most ${MAX_DIGEST_BULLETS} bullets. Fewer is better. Never pad to reach a number.
- Order by what the owner has to act on: "heads_up" (a decision, a failure, a recommendation) first, then "pending" (waiting on them or still running), then "done".
- Group, do not enumerate. "Wrote four posts about the warranty launch" beats four bullets.
- Say what changed and what it means, never what tool ran. The owner does not know what web_research is.
- Write as the worker, first person, past tense, plain English. No markdown, no emoji, no preamble.
- Plain words: write for a busy owner who knows nothing about the topic. Everyday words, short sentences (under 20 words), no jargon, acronyms or marketing speak. If a technical term cannot be avoided, explain it in a few words.
- If everything simply ran as expected, say so in one bullet and stop.`;

function factsToPrompt(facts: DigestFacts): string {
  const zone = validTimeZone(facts.timeZone);
  const lines = [
    `Worker: ${facts.agentName}, ${facts.jobTitle}.`,
    `Period: ${localIso(facts.periodStart, zone)} to ${localIso(facts.periodEnd, zone)} (${facts.cadence}, the owner's time zone ${zone}). Say any time in that zone.`,
  ];
  lines.push(
    facts.runs.length > 0
      ? "Tasks in this period:\n" +
          facts.runs
            .map(
              (run) =>
                `- [${run.status}] ${run.headline ?? "task"}: ${clamp(run.summary ?? run.error ?? "no account written", 400)}`,
            )
            .join("\n")
      : "No tasks ran in this period.",
  );
  if (facts.awaiting.length > 0) {
    lines.push(
      "Waiting for the owner's decision:\n" +
        facts.awaiting
          .map(
            (item) =>
              `- ${item.tool === "send_email" ? "an email to send" : "a post to publish"}, waiting since ${localIso(item.since, zone)}: ${item.headline ?? "no headline"}`,
          )
          .join("\n"),
    );
  }
  if (facts.suggestions.length > 0) {
    lines.push(
      "Recommendations you have already raised and the owner has not answered:\n" +
        facts.suggestions.map((s) => `- ${s.summary} -> ${s.proposal}`).join("\n"),
    );
  }
  if (facts.drafts > 0) lines.push(`Drafts written in this period: ${facts.drafts}.`);
  return lines.join("\n\n");
}

function toBullets(source: unknown): DigestBullet[] {
  if (!Array.isArray(source)) return [];
  const bullets: DigestBullet[] = [];
  for (const entry of source) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    const text = stringField(record, "text");
    if (!text) continue;
    bullets.push({
      kind: isDigestBulletKind(record.kind) ? record.kind : "done",
      text: clamp(text, 240),
    });
  }
  const order: Record<DigestBullet["kind"], number> = { heads_up: 0, pending: 1, done: 2 };
  return bullets.sort((a, b) => order[a.kind] - order[b.kind]).slice(0, MAX_DIGEST_BULLETS);
}

/** The digest the data alone supports, when no model is configured or the call fails. */
export function fallbackDigest(facts: DigestFacts): { headline: string; bullets: DigestBullet[] } {
  const stats = statsOf(facts);
  const bullets: DigestBullet[] = [];

  for (const suggestion of facts.suggestions.slice(0, 2)) {
    bullets.push({ kind: "heads_up", text: `${suggestion.summary} I suggest: ${suggestion.proposal}` });
  }
  if (stats.failed > 0) {
    const first = facts.runs.find((run) => run.status === "failed");
    bullets.push({
      kind: "heads_up",
      text: `${stats.failed} task${stats.failed === 1 ? "" : "s"} failed${first?.error ? `: ${clamp(first.error, 140)}` : "."}`,
    });
  }
  if (stats.awaitingApproval > 0) {
    bullets.push({
      kind: "pending",
      text: `${stats.awaitingApproval} thing${stats.awaitingApproval === 1 ? " is" : "s are"} waiting for your approval in Needs you. Nothing goes out until you decide.`,
    });
  }
  if (stats.completed > 0) {
    bullets.push({
      kind: "done",
      text: `I finished ${stats.completed} task${stats.completed === 1 ? "" : "s"}${stats.drafts > 0 ? ` and wrote ${stats.drafts} draft${stats.drafts === 1 ? "" : "s"}` : ""}.`,
    });
  }
  const latest = facts.runs.filter((run) => run.summary).at(-1);
  if (latest?.summary && bullets.length < MAX_DIGEST_BULLETS) {
    bullets.push({ kind: "done", text: clamp(latest.summary, 240) });
  }
  if (bullets.length === 0) {
    bullets.push({ kind: "done", text: "Nothing needed doing in this period." });
  }

  const headline =
    stats.failed > 0
      ? `${stats.completed} done, ${stats.failed} failed`
      : stats.awaitingApproval > 0
        ? `${stats.completed} done, ${stats.awaitingApproval} waiting on you`
        : stats.completed > 0
          ? `${stats.completed} task${stats.completed === 1 ? "" : "s"} finished`
          : "A quiet period";

  return { headline, bullets: bullets.slice(0, MAX_DIGEST_BULLETS) };
}

async function askForDigest(
  facts: DigestFacts,
  billing: { organizationId: string; agentId: string },
  model: { provider: string; name: string | null },
): Promise<{ headline: string; bullets: DigestBullet[] } | null> {
  if (!env.hasAnthropicKey && !env.hasOpenAiKey) return null;
  const messages: ChatMessage[] = [{ role: "user", content: factsToPrompt(facts) }];
  try {
    const provider = await getProvider(model.provider);
    const turn = await provider.complete({
      billing,
      systemPrompt: SYSTEM_PROMPT,
      messages,
      tools: [],
      model: model.name,
      maxTokens: 900,
    });
    const parsed = parseModelJson(turn.message.content);
    const bullets = toBullets(parsed?.bullets);
    if (bullets.length === 0) return null;
    return { headline: clamp(stringField(parsed, "headline") || "Your update", 80), bullets };
  } catch (error) {
    console.error("[work/digest] model call failed", error);
    return null;
  }
}

// --- delivery ---------------------------------------------------------------

function digestText(
  agentName: string,
  headline: string,
  bullets: DigestBullet[],
  link: string | null,
): string {
  const label: Record<DigestBullet["kind"], string> = {
    heads_up: "Needs you",
    pending: "Waiting",
    done: "Done",
  };
  return [
    `${agentName}: ${headline}`,
    "",
    ...bullets.map((bullet) => `- [${label[bullet.kind]}] ${bullet.text}`),
    "",
    link ? `Open Needs you: ${link}` : "",
  ]
    .join("\n")
    .trim();
}

/** Who gets the email: the addresses on the scope, or the organisation's owners and admins. */
async function digestRecipients(organizationId: string, configured: string | null): Promise<string[]> {
  const explicit = parseRecipients(configured ?? "");
  if (explicit.length > 0) return explicit;
  const memberships = await prisma.membership.findMany({
    where: { organizationId, role: { in: ["owner", "admin"] } },
    select: { user: { select: { email: true } } },
    take: 10,
  });
  return parseRecipients(memberships.map((m) => m.user.email).join(","));
}

// --- generation -------------------------------------------------------------

interface GenerateDigestOptions {
  /** The moment the digest is for. Defaults to now. */
  periodEnd?: Date;
  /** Generate even when the period is empty - what "Send me one now" means. */
  force?: boolean;
}

/**
 * Builds and stores one digest for an agent. Returns null when the agent has
 * digests turned off, or when the period held nothing worth sending.
 */
export async function generateDigest(
  agentId: string,
  options: GenerateDigestOptions = {},
): Promise<{ id: string; headline: string } | null> {
  const scope = await prisma.scopeOfWork.findUnique({
    where: { agentId },
    select: {
      digestCadence: true,
      digestEmail: true,
      digestRecipients: true,
      lastDigestAt: true,
      createdAt: true,
      timezone: true,
      agent: {
        select: {
          id: true,
          name: true,
          jobTitle: true,
          modelProvider: true,
          model: true,
          project: { select: { slug: true, organizationId: true } },
        },
      },
    },
  });
  if (!scope) return null;

  const configured = isDigestCadence(scope.digestCadence) ? scope.digestCadence : "weekly";
  // "Send me one now" on an agent with digests off still produces one: the
  // cadence is what "off" turns off, not the button. Such a digest covers a
  // week, the same window the default schedule would have used.
  if (configured === "off" && !options.force) return null;
  const cadence: Exclude<DigestCadence, "off"> = configured === "off" ? "weekly" : configured;

  const periodEnd = options.periodEnd ?? new Date();
  const window = digestWindow(cadence, periodEnd, scope.lastDigestAt);
  const agent = scope.agent;
  const organizationId = agent.project.organizationId;

  const facts = await gather(agentId, cadence, window, agent, validTimeZone(scope.timezone));
  if (isEmpty(facts) && !options.force) {
    // Nothing to say. Move the window on so the next digest does not re-cover
    // this silence, and write nothing.
    await prisma.scopeOfWork.update({ where: { agentId }, data: { lastDigestAt: periodEnd } });
    return null;
  }

  const written =
    (await askForDigest(facts, { organizationId, agentId }, {
      provider: agent.modelProvider,
      name: agent.model,
    })) ?? fallbackDigest(facts);

  let digest;
  try {
    digest = await prisma.digest.create({
      data: {
        organizationId,
        agentId,
        cadence,
        periodStart: window.periodStart,
        periodEnd: window.periodEnd,
        headline: written.headline,
        bullets: written.bullets as unknown as Prisma.InputJsonValue,
        stats: statsOf(facts) as unknown as Prisma.InputJsonValue,
        actionItemIds: facts.runs.map((run) => run.id) as unknown as Prisma.InputJsonValue,
      },
      select: { id: true, headline: true },
    });
  } catch (error) {
    // Two schedulers raced for the same period; the first one's digest stands.
    if ((error as { code?: string }).code === "P2002") return null;
    throw error;
  }

  await prisma.scopeOfWork.update({ where: { agentId }, data: { lastDigestAt: periodEnd } });

  if (scope.digestEmail) {
    await emailDigest({
      digestId: digest.id,
      organizationId,
      agentName: agent.name,
      headline: written.headline,
      bullets: written.bullets,
      recipients: scope.digestRecipients,
      link: env.appUrl ? `${env.appUrl}/p/${agent.project.slug}/needs-you` : null,
    });
  }

  notifyInBackground({
    kind: "digest",
    title: `${agent.name}'s ${cadence} digest: ${written.headline}`,
    body: written.bullets.map((bullet) => `• ${bullet.text}`).join("\n"),
    agentName: agent.name,
    path: `/p/${agent.project.slug}/needs-you`,
    organizationId,
    peopleOnly: true,
  });
  publishAdminEvent({ type: "digest.created", agentId, digestId: digest.id });
  await audit({
    organizationId,
    actorType: "agent",
    actorId: agentId,
    action: "digest.created",
    targetType: "digest",
    targetId: digest.id,
    metadata: { cadence, headline: written.headline, bullets: written.bullets.length },
  });
  return digest;
}

async function emailDigest(input: {
  digestId: string;
  organizationId: string;
  agentName: string;
  headline: string;
  bullets: DigestBullet[];
  recipients: string | null;
  link: string | null;
}): Promise<void> {
  const [to, config] = await Promise.all([
    digestRecipients(input.organizationId, input.recipients),
    resolveEmail(input.organizationId),
  ]);
  const problem = !config
    ? "No email provider is connected, so the digest stayed under Work → Digests."
    : to.length === 0
      ? "No valid recipient address, so the digest stayed under Work → Digests."
      : null;
  if (problem || !config) {
    await prisma.digest.update({ where: { id: input.digestId }, data: { emailError: problem } });
    return;
  }

  // The same opt-out as agent email: whoever unsubscribed stops getting these.
  const { allowed } = await splitOptedOut(input.organizationId, to);
  if (allowed.length === 0) {
    await prisma.digest.update({
      where: { id: input.digestId },
      data: { emailError: "Every recipient unsubscribed, so the digest stayed under Work → Digests." },
    });
    return;
  }
  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: input.organizationId },
    select: { id: true, name: true },
  });
  const optOut = optOutFor(organization, allowed);
  const delivery = await deliverEmail(config, {
    to: allowed,
    subject: `${input.agentName}: ${input.headline}`,
    text: digestText(input.agentName, input.headline, input.bullets, input.link) + optOut.footer,
    headers: optOut.headers,
  });
  await prisma.digest.update({
    where: { id: input.digestId },
    data: delivery.ok
      ? { emailedAt: new Date(), emailError: null }
      : { emailError: clamp(delivery.detail, 300) },
  });
}

/**
 * Called by the scheduler. Every agent whose digest cadence has come round
 * since its last one gets exactly one digest. A missed tick is caught up on
 * the next pass; an outage never replays every period it slept through.
 */
export async function runDueDigests(now = new Date()): Promise<string[]> {
  const scopes = await prisma.scopeOfWork.findMany({
    where: { digestCadence: { not: "off" } },
    select: { agentId: true, digestCadence: true, timezone: true, lastDigestAt: true, createdAt: true },
  });

  const generated: string[] = [];
  for (const scope of scopes) {
    if (!isDigestCadence(scope.digestCadence) || scope.digestCadence === "off") continue;
    const cron = digestCron(scope.digestCadence);
    if (!cron) continue;
    const due = previousFire(cron, scope.timezone, now);
    if (!due) continue;
    const floor = scope.lastDigestAt ?? scope.createdAt;
    if (due <= floor) continue;

    try {
      const digest = await generateDigest(scope.agentId, { periodEnd: due });
      if (digest) generated.push(digest.id);
    } catch (error) {
      // One agent's digest must not stop the rest of the tenant's.
      console.error(`[work/digest] digest failed for agent ${scope.agentId}`, error);
      await prisma.scopeOfWork
        .update({ where: { agentId: scope.agentId }, data: { lastDigestAt: due } })
        .catch(() => {});
    }
  }
  return generated;
}
