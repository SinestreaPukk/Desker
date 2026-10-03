"use client";

import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { useSaveScope, useScope } from "@/hooks/use-work-data";
import { scopeToInput } from "@/lib/agents/scope-input";
import { errorMessage } from "@/lib/shared/api-client";
import { parseLines } from "@/lib/agents/agent-fields";

const WHEN = [
  { id: "off", label: "Only when I ask", cron: null },
  { id: "daily", label: "Every morning, 8:00", cron: "0 8 * * *" },
  { id: "weekdays", label: "Weekday mornings, 8:00", cron: "0 8 * * 1-5" },
  { id: "monday", label: "Monday morning, 8:00", cron: "0 8 * * 1" },
  { id: "sunday", label: "Sunday evening, 18:00", cron: "0 18 * * 0" },
] as const;

/** A routine: what it should do, and when. Times are in your time zone. */
export function ScheduleTab({ agentId }: { agentId: string }) {
  const scope = useScope(agentId);
  const save = useSaveScope(agentId);
  const [when, setWhen] = React.useState<string | null>(null);
  const [todo, setTodo] = React.useState<string | null>(null);

  if (scope.isPending) return <Skeleton className="h-56" />;
  if (scope.error || !scope.data) return <ErrorState message={errorMessage(scope.error)} onRetry={() => void scope.refetch()} />;

  const stored = scope.data;
  const storedWhen = stored.triggerType === "cron" ? (WHEN.find((option) => option.cron === stored.cron)?.id ?? "custom") : "off";
  const whenValue = when ?? storedWhen;
  const todoValue = todo ?? stored.objectives.join("\n");
  const dirty = when !== null || todo !== null;

  async function onSave() {
    const preset = WHEN.find((option) => option.id === whenValue);
    try {
      await save.mutateAsync({
        ...scopeToInput(stored),
        objectives: parseLines(todoValue),
        ...(whenValue === "custom"
          ? {}
          : {
              triggerType: preset?.cron ? "cron" : "manual",
              cron: preset?.cron ?? null,
              timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
            }),
      });
      setWhen(null);
      setTodo(null);
      toast.success("Saved");
    } catch (caught) {
      toast.error(errorMessage(caught));
    }
  }

  return (
    <div className="space-y-6">
      <Field label="When" htmlFor="when">
        <Select value={whenValue} onValueChange={setWhen}>
          <SelectTrigger id="when">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {WHEN.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.label}
              </SelectItem>
            ))}
            {storedWhen === "custom" ? <SelectItem value="custom">Custom schedule (keep)</SelectItem> : null}
          </SelectContent>
        </Select>
      </Field>

      <Field label="What it should do" htmlFor="todo" hint="One job per line.">
        <Textarea
          value={todoValue}
          onChange={(event) => setTodo(event.target.value)}
          rows={5}
          placeholder={"Read next week's calendar and tell me about clashes\nList bills due in the next two weeks"}
        />
      </Field>

      {dirty ? (
        <div className="sticky bottom-4 flex justify-end">
          <Button onClick={() => void onSave()} loading={save.isPending} className="shadow-md">
            Save
          </Button>
        </div>
      ) : null}
    </div>
  );
}
