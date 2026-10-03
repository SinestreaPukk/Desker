"use client";

import * as React from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Note, type NoteTone } from "@/components/ui/note";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { Files, Rules } from "@/components/agent/files-rules";
import { useUpdateAgent } from "@/hooks/use-admin-data";
import { useProjectContext, useSaveProjectContext } from "@/hooks/use-work-data";
import { MEMORY_FIELDS } from "@/lib/agents/memory-fields";
import { errorMessage } from "@/lib/shared/api-client";
import { formatRelativeTime } from "@/lib/shared/utils";

const TONES: NoteTone[] = ["lemon", "sky", "mint", "coral", "lilac"];
const TILT = [-0.8, 0.6, -0.4, 0.8, -0.6];

/** Everything about you in one place: who you are, what it has learned, the files it reads, the rules it keeps. */
export function AboutTab({ agent, project }: { agent: { id: string; name: string }; project: string }) {
  const context = useProjectContext(project);
  const saveContext = useSaveProjectContext(project);
  const update = useUpdateAgent(agent.id);
  // Only what the person has changed. Everything else follows the server, so what it learns shows up on its own.
  const [edits, setEdits] = React.useState<Record<string, string>>({});
  const [name, setName] = React.useState<string | null>(null);

  if (context.isPending) return <Skeleton className="h-64" aria-busy aria-label="Loading" />;
  if (context.error || !context.data) return <ErrorState message={errorMessage(context.error)} onRetry={() => void context.refetch()} />;

  const { answers, learnedAt } = context.data;
  const value = (id: string) => edits[id] ?? answers[id] ?? "";
  const set = (id: string, text: string) => setEdits((current) => ({ ...current, [id]: text }));
  const known = MEMORY_FIELDS.filter((field) => (answers[field.id] ?? "").trim() || field.id in edits);
  const dirty = Object.keys(edits).length > 0 || (name !== null && name.trim() !== agent.name);
  const latest = Object.values(learnedAt).sort().at(-1);

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
    <div className="space-y-12">
      <section className="space-y-6" aria-label="About you">
        <Field label="Name" htmlFor="agent-name">
          <Input value={name ?? agent.name} onChange={(event) => setName(event.target.value)} maxLength={60} />
        </Field>
        <Field
          label="About you"
          htmlFor="about"
          hint={learnedAt.about ? `Updated from your chat ${formatRelativeTime(learnedAt.about)}.` : "Who you are, where you are, what matters. It adds to this as you chat."}
        >
          <Textarea
            value={value("about")}
            onChange={(event) => set("about", event.target.value)}
            rows={5}
            placeholder="I'm Maya, a designer in Bangkok. I live with Sam and I'm saving for a flat."
          />
        </Field>
      </section>

      <section aria-labelledby="learned">
        <h2 id="learned" className="text-lg font-semibold text-ink">
          What I&apos;ve learned
        </h2>
        <p className="mb-4 text-sm text-ink-muted">
          {latest ? `Last learned ${formatRelativeTime(latest)}. ` : ""}It adds to these as you talk. Fix anything that is wrong.
        </p>
        {known.length === 0 ? (
          <Note tone="lemon" className="px-5 py-8 text-center">
            <p className="font-hand text-xl text-note-ink">Nothing yet</p>
            <p className="mt-1 text-sm">Chat with it and what it learns about you is pinned here.</p>
          </Note>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2">
            {known.map((field, index) => (
              <li key={field.id}>
                <Note tone={TONES[index % TONES.length]!} tilt={TILT[index % TILT.length]} className="p-4">
                  <label htmlFor={`learned-${field.id}`} className="block text-sm font-semibold text-note-ink">
                    {field.label}
                  </label>
                  <textarea
                    id={`learned-${field.id}`}
                    value={value(field.id)}
                    onChange={(event) => set(field.id, event.target.value)}
                    rows={3}
                    className="mt-1 block min-h-16 w-full resize-y bg-transparent text-base leading-relaxed text-note-ink focus:outline-none"
                  />
                  <p className="mt-1 text-xs text-note-ink/70">
                    {learnedAt[field.id] ? `Learned ${formatRelativeTime(learnedAt[field.id]!)}` : "You wrote this"}
                  </p>
                </Note>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Files agentId={agent.id} />
      <Rules agentId={agent.id} />

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
