"use client";

import * as React from "react";
import {
  FileText,
  FileUp,
  Loader2,
  Search,
  Trash2,
} from "lucide-react";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import {
  Panel,
  PanelBody,
  PanelDescription,
  PanelHeader,
  PanelTitle,
} from "@/components/ui/panel";
import { EmptyState, ErrorState, FormError, Skeleton } from "@/components/ui/states";
import {
  useDeleteDocument,
  useDocuments,
  useUploadDocument,
} from "@/hooks/use-admin-data";
import { api, errorMessage } from "@/lib/api-client";
import { ACCEPTED_EXTENSIONS } from "@/lib/rag/extract-shared";
import { cn, formatBytes } from "@/lib/utils";

export function DocumentsPanel({ agentId }: { agentId: string }) {
  const { data: documents, isPending, error, refetch } = useDocuments(agentId);
  const upload = useUploadDocument(agentId);
  const remove = useDeleteDocument(agentId);

  const [dragging, setDragging] = React.useState(false);
  const [uploadError, setUploadError] = React.useState<string | null>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  async function handleFiles(files: FileList | File[]) {
    setUploadError(null);
    for (const file of Array.from(files)) {
      try {
        await upload.mutateAsync(file);
      } catch (caught) {
        setUploadError(errorMessage(caught));
        break;
      }
    }
  }

  return (
    <Panel>
      <PanelHeader>
        <div>
          <PanelTitle>Company context</PanelTitle>
          <PanelDescription>
            Documents this agent can search while answering. Everything is chunked
            and indexed - the agent quotes what it finds rather than guessing.
          </PanelDescription>
        </div>
      </PanelHeader>

      <PanelBody className="space-y-4">
        <div
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            if (event.dataTransfer.files.length) void handleFiles(event.dataTransfer.files);
          }}
          className={cn(
            "rounded-xl border border-dashed p-6 text-center transition-colors",
            dragging
              ? "border-accent bg-accent-soft"
              : "border-line-strong bg-surface-2/50",
          )}
        >
          <FileUp className="mx-auto size-5 text-ink-subtle" aria-hidden />
          <p className="mt-2 text-sm text-ink">
            Drop files here, or{" "}
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="font-medium text-accent underline underline-offset-2 hover:text-accent-hover"
            >
              browse
            </button>
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            {ACCEPTED_EXTENSIONS.join(", ")} · up to 20 MB each
          </p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPTED_EXTENSIONS.join(",")}
            className="sr-only"
            onChange={(event) => {
              if (event.target.files?.length) void handleFiles(event.target.files);
              event.target.value = "";
            }}
          />
        </div>

        {upload.isPending ? (
          <p className="flex items-center gap-2 text-[0.8125rem] text-ink-muted">
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
            Uploading…
          </p>
        ) : null}

        <FormError message={uploadError} />

        {isPending ? (
          <div className="space-y-2">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-14 w-full" />
          </div>
        ) : error ? (
          <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />
        ) : documents!.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="No context yet"
            description="Upload a policy, a product sheet, or an FAQ. Without it, this agent can only answer from its persona."
            className="py-10"
          />
        ) : (
          <ul className="divide-y divide-line rounded-xl border border-line">
            {documents!.map((document) => (
              <li
                key={document.id}
                className="flex items-start gap-3 p-3 first:rounded-t-xl last:rounded-b-xl"
              >
                <FileText
                  className="mt-0.5 size-4 shrink-0 text-ink-subtle"
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.8125rem] font-medium text-ink">
                    {document.filename}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <StatusBadge status={document.status} />
                    <span className="meta">{formatBytes(document.sizeBytes)}</span>
                    {document.status === "ready" ? (
                      <span className="meta">{document.chunkCount} chunks</span>
                    ) : null}
                  </div>
                  {document.error ? (
                    <p role="alert" className="mt-1.5 text-xs text-danger">
                      {document.error}
                    </p>
                  ) : null}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={`Remove ${document.filename}`}
                  loading={remove.isPending && remove.variables === document.id}
                  onClick={() => remove.mutate(document.id)}
                >
                  <Trash2 aria-hidden />
                </Button>
              </li>
            ))}
          </ul>
        )}

        <RetrievalTester
          agentId={agentId}
          disabled={!documents?.some((document) => document.status === "ready")}
        />
      </PanelBody>
    </Panel>
  );
}

interface SearchResponse {
  query: string;
  backend: string;
  results: {
    id: string;
    filename: string;
    chunkIndex: number;
    content: string;
    score: number;
  }[];
}

/**
 * Shows exactly what `search_company_context` would return for a query. Being
 * able to check retrieval before publishing is the difference between "the
 * agent is wrong" and "the document never indexed".
 */
function RetrievalTester({
  agentId,
  disabled,
}: {
  agentId: string;
  disabled: boolean;
}) {
  const [query, setQuery] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [response, setResponse] = React.useState<SearchResponse | null>(null);

  async function run(event: React.FormEvent) {
    event.preventDefault();
    if (!query.trim()) return;
    setPending(true);
    setError(null);
    try {
      setResponse(
        await api<SearchResponse>(
          `/api/agents/${agentId}/search?q=${encodeURIComponent(query.trim())}`,
        ),
      );
    } catch (caught) {
      setError(errorMessage(caught));
      setResponse(null);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="rounded-xl border border-line bg-surface-2/50 p-4">
      <h3 className="text-[0.8125rem] font-semibold text-ink">Test retrieval</h3>
      <p className="mt-1 text-xs leading-relaxed text-ink-muted">
        Search the indexed documents the way the agent will.
      </p>

      <form onSubmit={run} className="mt-3 flex gap-2">
        <label htmlFor="retrieval-query" className="sr-only">
          Retrieval test query
        </label>
        <Input
          id="retrieval-query"
          value={query}
          disabled={disabled}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={
            disabled ? "Upload a document first" : "e.g. what is the return window?"
          }
          className="h-9"
        />
        <Button type="submit" size="sm" loading={pending} disabled={disabled || !query.trim()}>
          <Search aria-hidden />
          Search
        </Button>
      </form>

      <FormError message={error} />

      {response ? (
        <div className="mt-3 space-y-2">
          <p className="meta">
            {response.results.length} result(s) · {response.backend} embeddings
          </p>
          {response.results.length === 0 ? (
            <p className="text-[0.8125rem] text-ink-muted">
              Nothing matched. The agent would tell the client it doesn&apos;t have that
              information.
            </p>
          ) : (
            <ul className="space-y-2">
              {response.results.map((result) => (
                <li
                  key={result.id}
                  className="rounded-lg border border-line bg-surface p-2.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-xs font-medium text-ink">
                      {result.filename}
                    </span>
                    <Badge tone="neutral" className="shrink-0 font-mono">
                      {result.score.toFixed(4)}
                    </Badge>
                  </div>
                  <p className="mt-1.5 line-clamp-3 text-xs leading-relaxed text-ink-muted">
                    {result.content}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
