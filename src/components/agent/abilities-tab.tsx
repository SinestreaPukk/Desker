"use client";

import * as React from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { useIntegrations, useSaveScope, useScope } from "@/hooks/use-work-data";
import { ABILITIES, enabledAbilities, toolsFor } from "@/lib/agents/abilities";
import { scopeToInput } from "@/lib/agents/scope-input";
import { errorMessage } from "@/lib/shared/api-client";

/** What it may do. Each switch saves at once; anything that leaves still waits for your yes. */
export function AbilitiesTab({ agentId, project }: { agentId: string; project: string }) {
  const scope = useScope(agentId);
  const connections = useIntegrations(project);
  const save = useSaveScope(agentId);
  const [choice, setChoice] = React.useState<Set<string> | null>(null);

  if (scope.isPending) return <Skeleton className="h-72" />;
  if (scope.error || !scope.data) return <ErrorState message={errorMessage(scope.error)} onRetry={() => void scope.refetch()} />;

  const on = choice ?? enabledAbilities(scope.data.tools);
  const connected = new Set((connections.data ?? []).filter((row) => row.state !== "disconnected").map((row) => row.type));

  async function toggle(id: string, enabled: boolean) {
    const next = new Set(on);
    if (enabled) next.add(id);
    else next.delete(id);
    setChoice(next);
    try {
      await save.mutateAsync({ ...scopeToInput(scope.data!), tools: toolsFor(next) });
    } catch (caught) {
      setChoice(on);
      toast.error(errorMessage(caught));
    }
  }

  return (
    <div>
      <p className="mb-4 text-ink-muted">Anything that leaves your hands waits for your yes.</p>
      <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
        {ABILITIES.map((ability) => {
          const missing = on.has(ability.id) && ability.needs && !ability.needs.some((type) => connected.has(type));
          return (
            <li key={ability.id} className="flex items-center gap-4 px-4 py-3.5">
              <div className="min-w-0 flex-1">
                <label htmlFor={`ability-${ability.id}`} className="block font-medium text-ink">
                  {ability.label}
                </label>
                <p className="text-sm text-ink-muted">
                  {ability.hint}
                  {missing ? (
                    <>
                      {" "}
                      <Link href={`/p/${project}/integrations`} className="font-medium text-accent hover:underline">
                        Connect {ability.needsLabel}
                      </Link>
                    </>
                  ) : null}
                </p>
              </div>
              <Switch id={`ability-${ability.id}`} checked={on.has(ability.id)} onCheckedChange={(checked) => void toggle(ability.id, checked)} />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
