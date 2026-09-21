"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ErrorState, Skeleton } from "@/components/ui/states";
import { usePromptPreview } from "@/hooks/use-admin-data";
import { errorMessage } from "@/lib/api-client";

/**
 * Shows the system prompt exactly as the runtime assembles it from the saved
 * configuration. A persona is prose in a textbox; this is what it turns into,
 * and it is the first thing to read when an agent behaves oddly.
 */
export function PromptPreviewDialog({
  agentId,
  open,
  onOpenChange,
  dirty,
}: {
  agentId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Unsaved edits are not in the preview; say so rather than mislead. */
  dirty: boolean;
}) {
  const { data, isPending, error, refetch } = usePromptPreview(agentId, open);
  const [copied, setCopied] = React.useState(false);

  async function copy() {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard can be refused; the text is selectable.
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogTitle>What this agent is told</DialogTitle>
        <DialogDescription>
          The system prompt, assembled from the saved configuration exactly as the
          runtime builds it. Tool definitions are sent alongside it.
          {dirty ? " You have unsaved edits — they are not reflected here yet." : ""}
        </DialogDescription>

        <div className="mt-4 space-y-3">
          {isPending ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : error ? (
            <ErrorState message={errorMessage(error)} onRetry={() => void refetch()} />
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap gap-1.5">
                  <Badge tone="neutral" className="font-mono">
                    ~{data!.approxTokens} tokens
                  </Badge>
                  {data!.tools.map((tool) => (
                    <Badge key={tool.name} tone="accent" className="font-mono">
                      {tool.name}
                    </Badge>
                  ))}
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={copy}>
                  {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
                  {copied ? "Copied" : "Copy"}
                </Button>
              </div>

              <pre className="max-h-[60vh] overflow-auto whitespace-pre-wrap rounded-lg border border-line bg-surface-2 p-4 font-mono text-xs leading-relaxed text-ink">
                {data!.prompt}
              </pre>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
