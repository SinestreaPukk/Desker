import "server-only";
import { prisma } from "@/lib/platform/db";
import { STARTER_TRIGGER_RULES } from "./starter-rules";
import { validTimeZone } from "@/lib/shared/local-time";
import { linePush, replyMessages } from "@/lib/messaging/line";
import { addTeamMessage } from "@/lib/agents/team";
import type { TriggerRuleDto, TriggerUrgency, TriggerChannel, TriggerRuleConfig } from "./types";

export async function ensureStarterRules(projectId: string): Promise<void> {
  const existing = await prisma.triggerRule.findMany({
    where: { projectId },
    select: { name: true },
  });

  const existingNames = new Set(existing.map((r) => r.name));

  for (const starter of STARTER_TRIGGER_RULES) {
    if (!existingNames.has(starter.name)) {
      await prisma.triggerRule.create({
        data: {
          projectId,
          name: starter.name,
          description: starter.description,
          kind: starter.kind,
          config: starter.config as object,
          enabled: true,
        },
      });
    }
  }
}

export async function listTriggerRules(projectId: string): Promise<TriggerRuleDto[]> {
  await ensureStarterRules(projectId);
  const rows = await prisma.triggerRule.findMany({
    where: { projectId },
    orderBy: { createdAt: "asc" },
  });

  return rows.map((r) => ({
    id: r.id,
    projectId: r.projectId,
    name: r.name,
    description: r.description,
    kind: r.kind as "time" | "event" | "condition",
    config: r.config as TriggerRuleConfig,
    enabled: r.enabled,
    feedback: r.feedback as TriggerRuleDto["feedback"],
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));
}

export async function updateTriggerRule(
  projectId: string,
  input: {
    ruleName: string;
    enabled?: boolean;
    time?: string;
    quietHoursStart?: string;
    quietHoursEnd?: string;
    description?: string;
    addSuppressedTopic?: string;
  },
): Promise<TriggerRuleDto> {
  await ensureStarterRules(projectId);
  const rule = await prisma.triggerRule.findUnique({
    where: { projectId_name: { projectId, name: input.ruleName } },
  });

  if (!rule) throw new Error(`Trigger rule "${input.ruleName}" not found.`);

  const config = { ...(rule.config as TriggerRuleConfig) };
  if (input.time) config.time = input.time;
  if (input.quietHoursStart) config.quietHoursStart = input.quietHoursStart;
  if (input.quietHoursEnd) config.quietHoursEnd = input.quietHoursEnd;

  if (input.addSuppressedTopic) {
    const topics = new Set(config.suppressedTopics ?? []);
    topics.add(input.addSuppressedTopic.toLowerCase());
    config.suppressedTopics = Array.from(topics);
  }

  const updated = await prisma.triggerRule.update({
    where: { id: rule.id },
    data: {
      ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
      ...(input.description ? { description: input.description } : {}),
      config: config as object,
      updatedAt: new Date(),
    },
  });

  return {
    id: updated.id,
    projectId: updated.projectId,
    name: updated.name,
    description: updated.description,
    kind: updated.kind as "time" | "event" | "condition",
    config: updated.config as TriggerRuleConfig,
    enabled: updated.enabled,
    feedback: updated.feedback as TriggerRuleDto["feedback"],
    createdAt: updated.createdAt.toISOString(),
    updatedAt: updated.updatedAt.toISOString(),
  };
}

export function isWithinQuietHours(
  now: Date,
  timeZone = "UTC",
  start = "22:00",
  end = "07:00",
): boolean {
  try {
    const formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone: validTimeZone(timeZone),
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    const current = formatter.format(now); // e.g. "23:15"
    if (start <= end) {
      return current >= start && current <= end;
    }
    // Overnight window, e.g. 22:00 to 07:00
    return current >= start || current <= end;
  } catch {
    return false;
  }
}

export async function determineChannel(userId: string, projectId: string): Promise<TriggerChannel> {
  const [lastLineMessage, lastAppMessage] = await Promise.all([
    prisma.messageChannel.findFirst({
      where: { userId, kind: "line", enabled: true },
      select: { createdAt: true },
    }),
    prisma.teamMessage.findFirst({
      where: { projectId, userId },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    }),
  ]);

  if (!lastLineMessage) return "app";
  if (!lastAppMessage) return "line";

  return lastLineMessage.createdAt > lastAppMessage.createdAt ? "line" : "app";
}

export interface TriggerEvaluationOptions {
  projectId: string;
  organizationId: string;
  userId: string;
  ruleName: string;
  urgency: TriggerUrgency;
  topic?: string;
  content: string;
  timeZone?: string;
  force?: boolean;
}

export async function evaluateAndFireTrigger(options: TriggerEvaluationOptions): Promise<{
  fired: boolean;
  decision: "fired" | "suppressed";
  reason: string;
  channel?: TriggerChannel;
}> {
  const { projectId, userId, ruleName, urgency, topic, content, timeZone = "UTC", force } = options;
  await ensureStarterRules(projectId);

  const rule = await prisma.triggerRule.findUnique({
    where: { projectId_name: { projectId, name: ruleName } },
  });

  const now = new Date();
  const dateKey = now.toISOString().slice(0, 10);
  const dedupeKey = `${ruleName}:${projectId}:${dateKey}`;

  // 1. Check enabled
  if (rule && !rule.enabled && !force) {
    const reason = `Suppressed: rule "${ruleName}" is disabled by user preference.`;
    await logExecution(projectId, ruleName, "suppressed", reason, urgency, null, dedupeKey);
    return { fired: false, decision: "suppressed", reason };
  }

  // 2. Check suppressed topic
  const config = (rule?.config as TriggerRuleConfig) ?? {};
  if (topic && config.suppressedTopics?.some((t) => topic.toLowerCase().includes(t))) {
    const reason = `Suppressed: topic "${topic}" was muted by user.`;
    await logExecution(projectId, ruleName, "suppressed", reason, urgency, null, dedupeKey);
    return { fired: false, decision: "suppressed", reason };
  }

  // 3. Deduplication check (survives restarts)
  if (!force) {
    const alreadyFired = await prisma.triggerExecutionLog.findUnique({
      where: { dedupeKey },
    });
    if (alreadyFired && alreadyFired.decision === "fired") {
      const reason = `Suppressed: trigger "${ruleName}" already fired on ${dateKey}.`;
      return { fired: false, decision: "suppressed", reason };
    }
  }

  // 4. Quiet hours check
  const quietStart = config.quietHoursStart || "22:00";
  const quietEnd = config.quietHoursEnd || "07:00";
  if (urgency !== "now" && !force && isWithinQuietHours(now, timeZone, quietStart, quietEnd)) {
    const reason = `Suppressed: within quiet hours (${quietStart} to ${quietEnd}). Batched for next active brief.`;
    await logExecution(projectId, ruleName, "suppressed", reason, urgency, null, dedupeKey);
    return { fired: false, decision: "suppressed", reason };
  }

  // 5. Per-day cap check
  const maxPerDay = config.maxPerDay || 5;
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const firedTodayCount = await prisma.triggerExecutionLog.count({
    where: {
      projectId,
      decision: "fired",
      createdAt: { gte: startOfDay },
    },
  });

  if (urgency !== "now" && !force && firedTodayCount >= maxPerDay) {
    const reason = `Suppressed: per-day notification cap reached (${firedTodayCount}/${maxPerDay}).`;
    await logExecution(projectId, ruleName, "suppressed", reason, urgency, null, dedupeKey);
    return { fired: false, decision: "suppressed", reason };
  }

  // 6. Select channel by urgency and where user last replied
  const channel = await determineChannel(userId, projectId);

  // 7. Deliver message to exactly one channel (never duplicate)
  let delivered = false;
  if (channel === "line") {
    const lineChan = await prisma.messageChannel.findFirst({
      where: { userId, kind: "line", enabled: true },
      select: { target: true, senderKey: true },
    });
    if (lineChan && lineChan.target) {
      await linePush(lineChan.target, replyMessages(content));
      delivered = true;
    }
  }

  if (!delivered) {
    // Deliver to web chat thread
    const thread = await prisma.teamThread.findFirst({
      where: { projectId },
      orderBy: { updatedAt: "desc" },
      select: { id: true },
    });
    if (thread) {
      await addTeamMessage({
        projectId,
        threadId: thread.id,
        content,
      });
    }
  }

  // 8. Log firing
  const reason = `Fired: ${urgency} alert via ${channel}.`;
  await logExecution(projectId, ruleName, "fired", reason, urgency, channel, dedupeKey, content);

  return { fired: true, decision: "fired", reason, channel };
}

async function logExecution(
  projectId: string,
  ruleName: string,
  decision: "fired" | "suppressed",
  reason: string,
  urgency: TriggerUrgency,
  channel: TriggerChannel | null,
  dedupeKey: string,
  messageSent?: string,
) {
  await prisma.triggerExecutionLog.upsert({
    where: { dedupeKey },
    create: {
      projectId,
      ruleName,
      decision,
      reason,
      urgency,
      channel,
      messageSent: messageSent ?? null,
      dedupeKey,
    },
    update: {
      decision,
      reason,
      urgency,
      channel,
      messageSent: messageSent ?? null,
    },
  }).catch((err) => console.warn("[trigger] log error", err));
}

export async function whyDidYouMessage(projectId: string): Promise<string> {
  const lastFired = await prisma.triggerExecutionLog.findFirst({
    where: { projectId, decision: "fired" },
    orderBy: { createdAt: "desc" },
  });

  if (!lastFired) {
    return "I haven't sent any proactive messages to this workspace recently.";
  }

  return `I messaged you because the "${lastFired.ruleName}" trigger fired (${lastFired.reason}) on channel ${lastFired.channel || "app"}.`;
}

export async function whyDidntYouMessage(projectId: string, ruleName?: string): Promise<string> {
  const where: { projectId: string; decision: string; ruleName?: string } = {
    projectId,
    decision: "suppressed",
  };
  if (ruleName) where.ruleName = ruleName;

  const lastSuppressed = await prisma.triggerExecutionLog.findFirst({
    where,
    orderBy: { createdAt: "desc" },
  });

  if (!lastSuppressed) {
    return "No notifications have been suppressed recently.";
  }

  return `I didn't message you because: ${lastSuppressed.reason}`;
}

export async function recordFeedback(
  projectId: string,
  ruleName: string,
  action: "dismissed" | "ignored" | "accepted",
): Promise<{ offerReduction: boolean; message?: string }> {
  const rule = await prisma.triggerRule.findUnique({
    where: { projectId_name: { projectId, name: ruleName } },
  });
  if (!rule) return { offerReduction: false };

  const fb = (rule.feedback as Record<string, number> | null) ?? {};
  const dismissedCount = (fb.dismissedCount ?? 0) + (action === "dismissed" ? 1 : 0);
  const ignoredCount = (fb.ignoredCount ?? 0) + (action === "ignored" ? 1 : 0);

  const offerReduction = dismissedCount >= 3 || ignoredCount >= 5;
  const proposedAdjustment = offerReduction
    ? `Offer to reduce or turn off "${ruleName}" notifications.`
    : undefined;

  await prisma.triggerRule.update({
    where: { id: rule.id },
    data: {
      feedback: {
        dismissedCount,
        ignoredCount,
        proposedAdjustment,
      },
    },
  });

  return {
    offerReduction,
    message: offerReduction
      ? `You have dismissed several alerts from "${ruleName}". Would you like me to turn them down?`
      : undefined,
  };
}
