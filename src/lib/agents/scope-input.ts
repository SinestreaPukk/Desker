import type { ScopeDto } from "@/lib/work/scope";
import type { ScopeInputPayload } from "@/lib/work/validation";

/** A saved scope as the input the save endpoint takes, so one setting can change and the rest stay. */
export function scopeToInput(scope: ScopeDto): ScopeInputPayload {
  return {
    context: scope.context,
    contextAnswers: scope.contextAnswers,
    objectives: scope.objectives,
    documentIds: scope.documentIds,
    triggerType: scope.triggerType,
    cron: scope.cron,
    timezone: scope.timezone,
    enabled: scope.enabled,
    autonomy: scope.autonomy,
    toolAutonomy: scope.toolAutonomy,
    tools: scope.tools,
    digestCadence: scope.digestCadence,
    digestEmail: scope.digestEmail,
    digestRecipients: scope.digestRecipients,
  };
}
