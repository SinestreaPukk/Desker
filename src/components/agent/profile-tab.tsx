"use client";

import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { useUpdateAgent } from "@/hooks/use-admin-data";
import { useProjectContext, useSaveProjectContext } from "@/hooks/use-work-data";
import { errorMessage } from "@/lib/shared/api-client";
import { formatRelativeTime } from "@/lib/shared/utils";

export function ProfileTab({ agent, project }: { agent: { id: string; name: string }; project: string }) {
  const context = useProjectContext(project);
  const saveContext = useSaveProjectContext(project);
  const update = useUpdateAgent(agent.id);
  // Only what the person has changed. Everything else follows the server, so what the assistant learns shows up here.
  const [edits, setEdits] = React.useState<Record<string, string>>({});
  const [name, setName] = React.useState<string | null>(null);

  if (context.isPending) return <Skeleton className="h-64" />;
  if (context.error || !context.data) return <ErrorState message={errorMessage(context.error)} onRetry={() => void context.refetch()} />;

  const answers = context.data.answers;
  const value = (id: string) => edits[id] ?? answers[id] ?? "";
  const nameValue = name ?? agent.name;
  const dirty = Object.keys(edits).length > 0 || (name !== null && name.trim() !== agent.name);
  const set = (id: string, text: string) => setEdits((current) => ({ ...current, [id]: text }));

  async function save() {
    try {
      if (name !== null && name.trim() && name.trim() !== agent.name) await update.mutateAsync({ name: name.trim() });
      if (Object.keys(edits).length > 0) await saveContext.mutateAsync({ ...answers, ...edits });
      setEdits({});
      setName(null);
      toast.success("Saved");
    } catch (caught) {
      toast.error(errorMessage(caught));
    }
  }

  return (
    <div className="space-y-6">
      <Field label="Name" htmlFor="agent-name">
        <Input value={nameValue} onChange={(event) => setName(event.target.value)} maxLength={60} />
      </Field>

      <Field label="About you" htmlFor="about" hint={context.data.learnedAt.about ? `Updated from your chat ${formatRelativeTime(context.data.learnedAt.about)}.` : "Who you are, where you are, what matters. It adds to this as you chat."}>
        <Textarea
          value={value("about")}
          onChange={(event) => set("about", event.target.value)}
          rows={5}
          placeholder="I'm Maya, a designer in Bangkok. I live with Sam and I'm saving for a flat."
        />
      </Field>

      {dirty ? (
        <div className="sticky bottom-4 flex justify-end">
          <Button onClick={() => void save()} loading={saveContext.isPending || update.isPending} className="shadow-md">
            Save
          </Button>
        </div>
      ) : null}
    </div>
  );
}
