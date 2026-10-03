"use client";

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { useRoutines, useSaveRoutines } from "@/hooks/use-work-data";
import { describeCadence } from "@/lib/work/cadence";
import { errorMessage } from "@/lib/shared/api-client";

const WHEN = [
  { id: "daily", label: "Every morning, 8:00", cron: "0 8 * * *" },
  { id: "weekdays", label: "Weekday mornings, 8:00", cron: "0 8 * * 1-5" },
  { id: "monday", label: "Monday morning, 8:00", cron: "0 8 * * 1" },
  { id: "friday", label: "Friday afternoon, 16:00", cron: "0 16 * * 5" },
  { id: "sunday", label: "Sunday evening, 18:00", cron: "0 18 * * 0" },
] as const;

interface Row {
  key: string;
  id?: string;
  cron: string;
  timezone: string;
  instruction: string;
  enabled: boolean;
}

const zone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

/** Jobs it does on its own, each with its own time. Times are in your time zone. */
export function ScheduleTab({ agentId }: { agentId: string }) {
  const routines = useRoutines(agentId);
  const save = useSaveRoutines(agentId);
  const [draft, setDraft] = React.useState<Row[] | null>(null);

  if (routines.isPending) return <Skeleton className="h-56" />;
  if (routines.error || !routines.data) return <ErrorState message={errorMessage(routines.error)} onRetry={() => void routines.refetch()} />;

  const rows: Row[] = draft ?? routines.data.map((routine) => ({ ...routine, key: routine.id }));
  const change = (key: string, patch: Partial<Row>) => setDraft(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));
  const remove = (key: string) => setDraft(rows.filter((row) => row.key !== key));
  const add = () => setDraft([...rows, { key: crypto.randomUUID(), cron: WHEN[0].cron, timezone: zone(), instruction: "", enabled: true }]);
  const valid = rows.every((row) => row.instruction.trim());

  async function onSave() {
    try {
      await save.mutateAsync(
        rows.map((row) => ({ id: row.id, cron: row.cron, timezone: row.timezone, instruction: row.instruction.trim(), enabled: row.enabled })),
      );
      setDraft(null);
      toast.success("Saved");
    } catch (caught) {
      toast.error(errorMessage(caught));
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-ink-muted">Jobs it does on its own, at the time you pick.</p>

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line px-4 py-8 text-center text-sm text-ink-muted">No routines yet.</p>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => {
            const preset = WHEN.find((option) => option.cron === row.cron);
            return (
              <li key={row.key} className="space-y-3 rounded-lg border border-line bg-surface p-4">
                <div className="flex items-center gap-3">
                  <Select value={preset?.id ?? "custom"} onValueChange={(id) => change(row.key, { cron: WHEN.find((option) => option.id === id)?.cron ?? row.cron })}>
                    <SelectTrigger aria-label="When" className="flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WHEN.map((option) => (
                        <SelectItem key={option.id} value={option.id}>
                          {option.label}
                        </SelectItem>
                      ))}
                      {preset ? null : <SelectItem value="custom">{describeCadence(row.cron, row.timezone)}</SelectItem>}
                    </SelectContent>
                  </Select>
                  <Switch checked={row.enabled} onCheckedChange={(enabled) => change(row.key, { enabled })} aria-label="Routine on" />
                  <Button variant="ghost" size="icon-sm" aria-label="Remove routine" onClick={() => remove(row.key)}>
                    <Trash2 aria-hidden />
                  </Button>
                </div>
                <Textarea
                  value={row.instruction}
                  onChange={(event) => change(row.key, { instruction: event.target.value })}
                  rows={2}
                  className="min-h-16"
                  aria-label="What it should do"
                  placeholder="Read next week's calendar and tell me about clashes"
                  maxLength={500}
                />
              </li>
            );
          })}
        </ul>
      )}

      <Button variant="secondary" onClick={add} disabled={rows.length >= 10}>
        <Plus aria-hidden />
        Add a routine
      </Button>

      {draft ? (
        <div className="sticky bottom-4 flex justify-end">
          <Button onClick={() => void onSave()} loading={save.isPending} disabled={!valid} className="shadow-md">
            Save
          </Button>
        </div>
      ) : null}
    </div>
  );
}
