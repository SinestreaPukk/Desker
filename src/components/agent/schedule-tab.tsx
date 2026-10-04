"use client";

import * as React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Clock, Moon, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Note } from "@/components/ui/note";
import { Textarea } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { useRoutines, useSaveRoutines } from "@/hooks/use-work-data";
import { describeCadence } from "@/lib/work/cadence";
import { api, errorMessage } from "@/lib/shared/api-client";
import type { TriggerRuleDto } from "@/lib/triggers/types";

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
export function ScheduleTab({ agentId, project }: { agentId: string; project?: string }) {
  const routines = useRoutines(agentId);
  const save = useSaveRoutines(agentId);
  const [draft, setDraft] = React.useState<Row[] | null>(null);

  if (routines.isPending) return <Skeleton className="h-56" aria-busy aria-label="Loading" />;
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
    <div className="space-y-6">
      <div className="space-y-4">
        <p className="text-ink-muted">Jobs it does on its own, at the time you pick.</p>

        {rows.length === 0 ? (
          <Note tone="mint" className="px-5 py-8 text-center">
            <p className="font-hand text-xl text-note-ink">Nothing scheduled</p>
            <p className="mt-1 text-sm">Try: every weekday at 8, tell me about my day.</p>
          </Note>
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

      {project ? <ProactiveRulesSection project={project} /> : null}
    </div>
  );
}

function ProactiveRulesSection({ project }: { project: string }) {
  const client = useQueryClient();
  const queryKey = ["project-triggers", project];
  const query = useQuery({
    queryKey,
    queryFn: () => api<{ rules: TriggerRuleDto[] }>(`/api/projects/${project}/triggers`),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ ruleName, enabled }: { ruleName: string; enabled: boolean }) =>
      api<{ rule: TriggerRuleDto }>(`/api/projects/${project}/triggers`, {
        method: "PATCH",
        body: JSON.stringify({ ruleName, enabled }),
      }),
    onSuccess: (data) => {
      toast.success(`${data.rule.name.replace(/_/g, " ")} ${data.rule.enabled ? "enabled" : "disabled"}`);
      void client.invalidateQueries({ queryKey });
    },
    onError: (err) => toast.error(errorMessage(err)),
  });

  const rules = query.data?.rules ?? [];
  if (query.isPending) return <Skeleton className="h-40" />;
  if (query.error) return null;

  return (
    <div className="space-y-4 pt-6 border-t border-line">
      <div>
        <h3 className="text-sm font-semibold text-ink">Proactive Triggers & Quiet Hours</h3>
        <p className="text-xs text-ink-muted mt-0.5">
          The assistant starts conversations only when worth the interruption. You can also adjust these in chat anytime.
        </p>
      </div>

      <div className="space-y-3">
        {rules.map((rule) => (
          <div
            key={rule.id}
            className="flex items-center justify-between gap-4 rounded-lg border border-line bg-surface p-3.5 shadow-xs"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-ink capitalize">
                  {rule.name.replace(/_/g, " ")}
                </span>
                <Badge tone={rule.enabled ? "positive" : "neutral"} className="h-4 px-1.5 text-meta">
                  {rule.kind}
                </Badge>
                {rule.config.time ? (
                  <span className="inline-flex items-center gap-1 text-meta text-ink-muted">
                    <Clock className="size-3" aria-hidden />
                    {rule.config.time}
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-ink-muted mt-1">{rule.description}</p>
            </div>
            <Switch
              checked={rule.enabled}
              disabled={toggleMutation.isPending}
              onCheckedChange={(checked) =>
                toggleMutation.mutate({ ruleName: rule.name, enabled: checked })
              }
              aria-label={`Toggle ${rule.name}`}
            />
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-line/60 bg-surface-2/40 p-3 text-xs text-ink-muted flex items-start gap-2">
        <Moon className="size-4 text-accent shrink-0 mt-0.5" aria-hidden />
        <div>
          <span className="font-semibold text-ink">Quiet hours: 22:00 – 07:00</span>
          <p className="mt-0.5">
            During quiet hours, low-urgency notifications are suppressed and batched into your next morning brief. Only urgent items break through.
          </p>
        </div>
      </div>
    </div>
  );
}
