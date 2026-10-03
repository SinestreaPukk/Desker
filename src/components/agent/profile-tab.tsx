"use client";

import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { useUpdateAgent } from "@/hooks/use-admin-data";
import { useProjectContext, useSaveProjectContext } from "@/hooks/use-work-data";
import { errorMessage } from "@/lib/shared/api-client";

/** What the assistant picks up from chat, in the owner's words. Shown only once it has something. */
const NOTICED: [id: string, label: string][] = [
  ["goals", "What you want help with"],
  ["tone", "How to talk to you"],
  ["never", "What never to do"],
  ["week", "Your week"],
  ["money", "Money"],
  ["people", "People who matter"],
  ["preferences", "Likes and dislikes"],
  ["voice", "How you write online"],
];

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
  const noticed = NOTICED.filter(([id]) => (answers[id] ?? "").trim() || id in edits);

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

      <Field label="About you" htmlFor="about" hint="Who you are, where you are, what matters. It adds to this as you chat.">
        <Textarea
          value={value("about")}
          onChange={(event) => set("about", event.target.value)}
          rows={5}
          placeholder="I'm Maya, a designer in Bangkok. I live with Sam and I'm saving for a flat."
        />
      </Field>

      {noticed.length > 0 ? (
        <section aria-labelledby="noticed" className="space-y-4 rounded-lg border border-line bg-surface p-4">
          <div>
            <h2 id="noticed" className="text-sm font-semibold text-ink">
              Noticed from your chats
            </h2>
            <p className="text-sm text-ink-muted">Fix anything that is wrong.</p>
          </div>
          {noticed.map(([id, label]) => (
            <Field key={id} label={label} htmlFor={`noticed-${id}`}>
              <Textarea value={value(id)} onChange={(event) => set(id, event.target.value)} rows={2} className="min-h-16" />
            </Field>
          ))}
        </section>
      ) : null}

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
