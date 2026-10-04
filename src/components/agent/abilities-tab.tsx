"use client";

import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { useIntegrations, useSaveScope, useScope } from "@/hooks/use-work-data";
import { ABILITIES, enabledAbilities, toolsFor, type Ability } from "@/lib/agents/abilities";
import { scopeToInput } from "@/lib/agents/scope-input";
import { errorMessage } from "@/lib/shared/api-client";

/** What it may do. Abilities that need an app stay off until the app is connected. Each switch saves at once. */
export function AbilitiesTab({ agentId, project }: { agentId: string; project: string }) {
  const scope = useScope(agentId);
  const connections = useIntegrations(project);
  const save = useSaveScope(agentId);
  const [choice, setChoice] = React.useState<Set<string> | null>(null);

  if (scope.isPending || connections.isPending) return <Skeleton className="h-72" aria-busy aria-label="Loading" />;
  if (scope.error || !scope.data) return <ErrorState message={errorMessage(scope.error)} onRetry={() => void scope.refetch()} />;

  const connected = new Set((connections.data ?? []).filter((row) => row.state !== "disconnected").map((row) => row.type));
  const usable = (ability: Ability) => !ability.needs || ability.needs.some((type) => connected.has(type));
  // What is really on: switched on, and able to work.
  const on = new Set([...(choice ?? enabledAbilities(scope.data.tools))].filter((id) => usable(ABILITIES.find((a) => a.id === id)!)));

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

  const works = ABILITIES.filter((ability) => !ability.needs);
  const needs = ABILITIES.filter((ability) => ability.needs);

  return (
    <div className="space-y-8">
      <p className="text-ink-muted">Anything that leaves your hands waits for your yes.</p>

      <section aria-labelledby="works-now">
        <h2 id="works-now" className="mb-2 text-lg font-semibold text-ink">
          Works now
        </h2>
        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
          {works.map((ability) => (
            <Row
              key={ability.id}
              ability={ability}
              below={
                ability.id === "browser" && on.has("browser") ? (
                  <p className="mt-3 text-sm text-ink-muted">Each final browser submission waits for your approval.</p>
                ) : null
              }
            >
              <Switch id={`ability-${ability.id}`} checked={on.has(ability.id)} onCheckedChange={(checked) => void toggle(ability.id, checked)} />
            </Row>
          ))}
        </ul>
      </section>

      <section aria-labelledby="needs-app">
        <h2 id="needs-app" className="mb-2 text-lg font-semibold text-ink">
          Needs an app
        </h2>
        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
          {needs.map((ability) => (
            <Row key={ability.id} ability={ability}>
              {usable(ability) ? (
                <Switch id={`ability-${ability.id}`} checked={on.has(ability.id)} onCheckedChange={(checked) => void toggle(ability.id, checked)} />
              ) : (
                <Button asChild size="sm" variant="secondary">
                  <a href={`/p/${project}/integrations`}>Connect {ability.needsLabel}</a>
                </Button>
              )}
            </Row>
          ))}
        </ul>
      </section>
    </div>
  );
}

function Row({ ability, children, below }: { ability: Ability; children: React.ReactNode; below?: React.ReactNode }) {
  return (
    <li className="px-4 py-3.5">
      <div className="flex items-center gap-4">
        <div className="min-w-0 flex-1">
          <label htmlFor={`ability-${ability.id}`} className="block font-medium text-ink">
            {ability.label}
          </label>
          <p className="text-sm text-ink-muted">{ability.hint}</p>
        </div>
        {children}
      </div>
      {below}
    </li>
  );
}
