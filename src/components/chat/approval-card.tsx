"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { api, errorMessage } from "@/lib/shared/api-client";
import { previewPending } from "@/lib/work/pending-preview";
import type { ActionItemDto } from "@/lib/work/serialize";

/**
 * Anything that would leave your hands waits for a yes, right in the chat:
 * what it is about to do, in plain lines, with Approve and Decline.
 * Shows nothing once the task is no longer waiting on you.
 */
export function ApprovalCard({ actionItemId }: { actionItemId: string }) {
  const client = useQueryClient();
  const key = ["action-item", actionItemId];
  const item = useQuery({
    queryKey: key,
    queryFn: () => api<ActionItemDto>(`/api/action-items/${actionItemId}`),
    refetchInterval: (query) => (query.state.data?.status === "needs_approval" ? 5_000 : false),
  });
  const decide = useMutation({
    mutationFn: (decision: "approve" | "reject") =>
      api<ActionItemDto>(`/api/action-items/${actionItemId}/${decision}`, { method: "POST", body: decision === "reject" ? JSON.stringify({}) : undefined }),
    onSuccess: (next, decision) => {
      client.setQueryData(key, next);
      toast.success(decision === "approve" ? "Approved. On it." : "Okay, I won't do that.");
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  if (!item.data || item.data.status !== "needs_approval" || !item.data.pendingAction) return null;
  const { verb, lines } = previewPending(item.data.pendingAction, null);
  return (
    <div className="mt-3 rounded-lg border border-line p-4" style={{ background: "color-mix(in oklch, var(--note-lemon) 45%, var(--surface))" }}>
      <p className="font-semibold text-ink">{verb}</p>
      <div className="mt-1 space-y-1 text-sm text-ink">
        {lines.filter(Boolean).map((line) => (
          <p key={line} className="whitespace-pre-wrap">
            {line}
          </p>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <Button size="sm" onClick={() => decide.mutate("approve")} loading={decide.isPending && decide.variables === "approve"} disabled={decide.isPending}>
          Approve
        </Button>
        <Button size="sm" variant="secondary" onClick={() => decide.mutate("reject")} loading={decide.isPending && decide.variables === "reject"} disabled={decide.isPending}>
          Decline
        </Button>
      </div>
    </div>
  );
}
