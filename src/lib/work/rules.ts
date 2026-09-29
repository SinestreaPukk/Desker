/**
 * Corrections an owner chose to keep, as instructions an agent reads before
 * everything it does. Created from a rejected or edited draft (or by hand),
 * always listed on the agent's page, and audited on every change.
 */
import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { HttpError } from "@/lib/http-error";

/** Enough to shape an agent; few enough that each one is still read. */
export const MAX_RULES = 30;

export const RULE_SOURCES = ["rejection", "edit", "manual"] as const;

export const ruleInputSchema = z.object({
  text: z
    .string()
    .trim()
    .min(5, "Say what it should do differently, in a sentence.")
    .max(400, "Keep a rule to one or two sentences - under 400 characters."),
  source: z.enum(RULE_SOURCES).default("manual"),
  actionItemId: z.string().max(64).optional(),
});

export interface AgentRuleDto {
  id: string;
  text: string;
  source: (typeof RULE_SOURCES)[number];
  actionItemId: string | null;
  createdAt: string;
  updatedAt: string;
}

export function toRuleDto(rule: {
  id: string;
  text: string;
  source: string;
  actionItemId: string | null;
  createdAt: Date;
  updatedAt: Date;
}): AgentRuleDto {
  return {
    id: rule.id,
    text: rule.text,
    source: (RULE_SOURCES as readonly string[]).includes(rule.source) ? (rule.source as AgentRuleDto["source"]) : "manual",
    actionItemId: rule.actionItemId,
    createdAt: rule.createdAt.toISOString(),
    updatedAt: rule.updatedAt.toISOString(),
  };
}

/** The texts a prompt reads, oldest first so the order never shifts under the agent. */
export async function rulesFor(agentId: string): Promise<string[]> {
  const rows = await prisma.agentRule.findMany({
    where: { agentId },
    orderBy: { createdAt: "asc" },
    select: { text: true },
  });
  return rows.map((row) => row.text);
}

export async function createRule(
  agent: { id: string; organizationId: string },
  input: z.infer<typeof ruleInputSchema>,
  userId: string,
): Promise<AgentRuleDto> {
  const count = await prisma.agentRule.count({ where: { agentId: agent.id } });
  if (count >= MAX_RULES) {
    throw new HttpError(409, `This agent already has ${MAX_RULES} saved rules. Remove or merge one before adding another.`);
  }
  const rule = await prisma.agentRule.create({
    data: {
      agentId: agent.id,
      text: input.text,
      source: input.source,
      actionItemId: input.actionItemId ?? null,
      createdById: userId,
    },
  });
  await audit({
    organizationId: agent.organizationId,
    actorType: "user",
    actorId: userId,
    action: "agent_rule.created",
    targetType: "agent",
    targetId: agent.id,
    metadata: { ruleId: rule.id, text: rule.text, source: rule.source, actionItemId: rule.actionItemId },
  });
  return toRuleDto(rule);
}
