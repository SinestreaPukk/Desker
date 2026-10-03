"use client";

import * as React from "react";
import { FileText, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { useDeleteDocument, useDocuments, useUploadDocument } from "@/hooks/use-admin-data";
import { useAgentRules, useRemoveRule, useSaveRule } from "@/hooks/use-work-data";
import { errorMessage } from "@/lib/shared/api-client";
import { ACCEPTED_EXTENSIONS } from "@/lib/rag/extract-shared";

const ACCEPT = ACCEPTED_EXTENSIONS.join(",");

/** Files it can read, and rules it keeps. */
export function KnowledgeTab({ agentId }: { agentId: string }) {
  return (
    <div className="space-y-10">
      <Files agentId={agentId} />
      <Rules agentId={agentId} />
    </div>
  );
}

function Files({ agentId }: { agentId: string }) {
  const documents = useDocuments(agentId);
  const upload = useUploadDocument(agentId);
  const remove = useDeleteDocument(agentId);
  const input = React.useRef<HTMLInputElement>(null);

  async function pick(files: FileList | null) {
    for (const file of Array.from(files ?? [])) {
      try {
        await upload.mutateAsync(file);
      } catch (caught) {
        toast.error(`${file.name}: ${errorMessage(caught)}`);
      }
    }
    if (input.current) input.current.value = "";
  }

  return (
    <section aria-labelledby="files">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 id="files" className="text-lg font-semibold text-ink">
            Files
          </h2>
          <p className="text-sm text-ink-muted">Statements, plans, a CV. It reads these when it needs them.</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => input.current?.click()} loading={upload.isPending}>
          <Upload aria-hidden />
          Add file
        </Button>
        <input ref={input} type="file" accept={ACCEPT} multiple hidden onChange={(event) => void pick(event.target.files)} />
      </div>

      {documents.isPending ? (
        <Skeleton className="h-16" />
      ) : documents.error ? (
        <ErrorState message={errorMessage(documents.error)} onRetry={() => void documents.refetch()} />
      ) : documents.data.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-sm text-ink-muted">No files yet.</p>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
          {documents.data.map((document) => (
            <li key={document.id} className="flex items-center gap-3 px-4 py-3">
              <FileText className="size-4 shrink-0 text-ink-subtle" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-ink">{document.filename}</p>
                {document.status === "failed" ? (
                  <p className="text-sm text-danger">{document.error ?? "Could not read this file."}</p>
                ) : document.status === "pending" ? (
                  <p className="text-sm text-ink-muted">Reading…</p>
                ) : null}
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${document.filename}`}
                onClick={() => remove.mutate(document.id, { onError: (caught) => toast.error(errorMessage(caught)) })}
              >
                <Trash2 aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Rules({ agentId }: { agentId: string }) {
  const rules = useAgentRules(agentId);
  const save = useSaveRule(agentId);
  const remove = useRemoveRule(agentId);
  const [text, setText] = React.useState("");

  async function add(event: React.FormEvent) {
    event.preventDefault();
    if (!text.trim()) return;
    try {
      await save.mutateAsync({ text: text.trim() });
      setText("");
    } catch (caught) {
      toast.error(errorMessage(caught));
    }
  }

  return (
    <section aria-labelledby="rules">
      <h2 id="rules" className="text-lg font-semibold text-ink">
        Rules
      </h2>
      <p className="mb-3 text-sm text-ink-muted">Things it always does. Tell it in chat and it adds them here.</p>

      <form onSubmit={add} className="mb-3 flex gap-2">
        <Input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Keep emails under 120 words"
          aria-label="New rule"
          maxLength={500}
        />
        <Button type="submit" variant="secondary" disabled={!text.trim()} loading={save.isPending}>
          <Plus aria-hidden />
          Add
        </Button>
      </form>

      {rules.isPending ? (
        <Skeleton className="h-16" />
      ) : rules.error ? (
        <ErrorState message={errorMessage(rules.error)} onRetry={() => void rules.refetch()} />
      ) : rules.data.length === 0 ? null : (
        <ul className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
          {rules.data.map((rule) => (
            <li key={rule.id} className="flex items-start gap-3 px-4 py-3">
              <p className="min-w-0 flex-1 text-ink">{rule.text}</p>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Remove rule"
                onClick={() => remove.mutate(rule.id, { onError: (caught) => toast.error(errorMessage(caught)) })}
              >
                <Trash2 aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
