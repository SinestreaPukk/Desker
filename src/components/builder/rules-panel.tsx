"use client";

import * as React from "react";
import Link from "next/link";
import { GraduationCap, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { Panel, PanelBody, PanelDescription, PanelHeader, PanelTitle } from "@/components/ui/panel";
import { FormError } from "@/components/ui/states";
import { useAgentRules, useRemoveRule, useSaveRule } from "@/hooks/use-work-data";
import { errorMessage } from "@/lib/api-client";
import type { AgentRuleDto } from "@/lib/work/rules";
import { formatDateTime, formatRelativeTime } from "@/lib/utils";

const FROM: Record<AgentRuleDto["source"], string> = {
  rejection: "From a draft you rejected",
  edit: "From a draft you edited",
  manual: "Added by hand",
};

/**
 * The corrections an agent has been asked to remember, in the open: each one
 * says where it came from, and can be reworded or removed. The agent reads
 * them before everything it does; every change is in the Audit log.
 */
export function RulesPanel({ agentId, agentName, project }: { agentId: string; agentName: string; project: string }) {
  const rules = useAgentRules(agentId);
  const save = useSaveRule(agentId);
  const remove = useRemoveRule(agentId);
  const [editing, setEditing] = React.useState<{ id?: string; text: string } | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function submit() {
    if (!editing) return;
    setError(null);
    try {
      await save.mutateAsync({ id: editing.id, text: editing.text });
      toast.success(editing.id ? "Rule reworded" : "Rule saved", { description: `${agentName} follows it from the next run.` });
      setEditing(null);
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  const list = rules.data ?? [];
  return (
    <Panel>
      <PanelHeader>
        <div>
          <PanelTitle>
            <GraduationCap className="mr-1.5 inline size-4 text-accent" aria-hidden />
            Rules from your corrections
          </PanelTitle>
          <PanelDescription>
            When you reject or edit {agentName}&apos;s work you can save what to do differently. It reads every rule here
            before everything it does. Reword or remove one any time.
          </PanelDescription>
        </div>
        {editing ? null : (
          <Button size="sm" variant="secondary" onClick={() => setEditing({ text: "" })}>
            <Plus aria-hidden />
            Add a rule
          </Button>
        )}
      </PanelHeader>
      <PanelBody className="space-y-3">
        {list.length === 0 && !editing ? (
          <p className="text-sm text-ink-muted">
            No rules yet. The next time you reject or edit one of {agentName}&apos;s drafts, you&apos;ll be asked if it
            should remember the correction.
          </p>
        ) : null}
        <ul className="space-y-2">
          {list.map((rule) =>
            editing?.id === rule.id ? null : (
              <li key={rule.id} className="flex items-start gap-3 rounded-lg border border-line bg-surface px-3.5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink">{rule.text}</p>
                  <p className="meta mt-1">
                    {FROM[rule.source]}
                    {rule.actionItemId ? (
                      <>
                        {" · "}
                        <Link href={`/p/${project}/work/${rule.actionItemId}`} className="text-accent hover:underline">
                          the run
                        </Link>
                      </>
                    ) : null}
                    {" · "}
                    <span title={formatDateTime(rule.updatedAt)}>{formatRelativeTime(rule.createdAt)}</span>
                  </p>
                </div>
                <Button size="icon-sm" variant="ghost" aria-label="Reword this rule" onClick={() => setEditing({ id: rule.id, text: rule.text })}>
                  <Pencil aria-hidden />
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Remove this rule"
                  loading={remove.isPending && remove.variables === rule.id}
                  onClick={() =>
                    remove.mutate(rule.id, {
                      onSuccess: () => toast(`${agentName} no longer follows that rule`),
                      onError: (caught) => toast.error(errorMessage(caught)),
                    })
                  }
                >
                  <Trash2 aria-hidden />
                </Button>
              </li>
            ),
          )}
        </ul>
        {editing ? (
          <div className="space-y-2 rounded-lg border border-accent-line bg-accent-soft/30 p-3">
            <FormError message={error} />
            <Field label={editing.id ? "Reword the rule" : "New rule"} htmlFor="rule-text">
              <Textarea
                id="rule-text"
                rows={2}
                autoFocus
                value={editing.text}
                onChange={(event) => setEditing({ ...editing, text: event.target.value })}
                placeholder="Keep emails under 120 words and sign off with my first name."
              />
            </Field>
            <div className="flex gap-2">
              <Button size="sm" onClick={() => void submit()} loading={save.isPending} disabled={editing.text.trim().length < 5}>
                Save rule
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setEditing(null)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : null}
      </PanelBody>
    </Panel>
  );
}
