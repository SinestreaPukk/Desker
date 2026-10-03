/**
 * An agent hired straight from a role template, with no wizard in between:
 * what the first run creates when the owner says "set this up for real".
 * The same fields the wizard would send, untouched - everything stays
 * editable on the agent's page afterwards.
 */
import type { AgentTemplate } from "@/lib/site/content";
import { AGENT_CONTEXT_QUESTIONS } from "@/lib/work/context";

export function agentFromTemplate(template: AgentTemplate, name: string) {
  return {
    name,
    jobTitle: template.jobTitle,
    department: template.team,
    templateId: template.id,
    avatarUrl: "",
    personality: template.personality,
    responsibilities: template.responsibilities,
    allowedTools: template.allowedTools,
    escalationRule: template.escalationRule,
    status: "draft" as const,
  };
}

/** Its scope of work: the template's goals, tools and schedule, draft-only. */
export function scopeFromTemplate(template: AgentTemplate, timezone: string) {
  const cron = template.defaultTriggerType === "cron" ? (template.defaultCron ?? "0 9 * * 1") : null;
  return {
    contextAnswers: template.defaultContext ? { [AGENT_CONTEXT_QUESTIONS[0]!.id]: template.defaultContext } : {},
    objectives: template.defaultObjectives ?? [],
    documentIds: [],
    triggerType: cron ? "cron" : (template.defaultTriggerType ?? "manual"),
    cron,
    timezone,
    enabled: true,
    autonomy: "draft_only" as const,
    toolAutonomy: null,
    tools: template.workTools,
  };
}
