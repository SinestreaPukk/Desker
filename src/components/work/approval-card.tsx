"use client";

import * as React from "react";
import Link from "next/link";
import { Check, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AgentAvatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Panel } from "@/components/ui/panel";
import {
  useApproveActionItem,
  useRejectActionItem,
  useReopenActionItem,
  useUpdateDraft,
} from "@/hooks/use-work-data";
import { errorMessage } from "@/lib/api-client";
import type { ActionItemDto } from "@/lib/work/serialize";
import { TRIGGER_LABELS } from "@/lib/work/types";
import { formatRelativeTime, safeHttpUrl } from "@/lib/utils";

/**
 * One thing waiting on a person: what the agent wants to send, shown in full,
 * editable in place, with the three decisions that exist - approve, edit and
 * approve, or reject. Used by the Inbox's Approvals tab and the Work page.
 */
export function ApprovalCard({ item, project }: { item: ActionItemDto; project: string }) {
  const approve = useApproveActionItem();
  const reject = useRejectActionItem();
  const reopen = useReopenActionItem();
  const update = useUpdateDraft();
  const [note, setNote] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState(false);
  const [rejecting, setRejecting] = React.useState(false);
  const [reason, setReason] = React.useState("");

  const pending = item.pendingAction;
  const draft = pending?.draftId ? item.drafts.find((d) => d.id === pending.draftId) : null;
  const isEmail = pending?.tool === "send_email";
  const [edit, setEdit] = React.useState({
    title: draft?.title ?? "",
    body: draft?.body ?? "",
    to: isEmail ? ((pending?.input.to as string[] | undefined)?.join(", ") ?? "") : "",
  });

  const busy = approve.isPending || reject.isPending || update.isPending;

  async function saveEdit() {
    if (!draft) return;
    setNote(null);
    try {
      await update.mutateAsync({
        id: draft.id,
        title: edit.title.trim(),
        body: edit.body.trim(),
        ...(isEmail ? { to: edit.to.trim() } : {}),
      });
      setEditing(false);
    } catch (caught) {
      setNote(errorMessage(caught));
    }
  }

  const what = pending?.tool === "publish_post" ? "post" : "email";

  async function decide(verb: "approve" | "reject") {
    setNote(null);
    try {
      if (verb === "approve") {
        await approve.mutateAsync({ id: item.id });
        toast.success(`Approved - sending the ${what} now`, {
          description: `${item.agent.name}'s ${what} is on its way. Delivery shows under Work.`,
        });
      } else {
        await reject.mutateAsync({ id: item.id, reason: reason.trim() });
        toast("Rejected - nothing was sent", {
          description: reason.trim() ? `Reason: ${reason.trim()}` : `${item.agent.name}'s ${what} stays a draft.`,
          action: {
            label: "Undo",
            onClick: () => {
              reopen
                .mutateAsync({ id: item.id })
                .then(() => toast.success("Back in the approvals queue"))
                .catch((caught) => toast.error(errorMessage(caught)));
            },
          },
        });
      }
    } catch (caught) {
      setNote(errorMessage(caught));
      toast.error(errorMessage(caught));
      throw caught;
    }
  }

  if (!pending) return null;

  return (
    <Panel className="overflow-hidden shadow-sm">
      <div className="flex items-start gap-3 border-b border-warning-line/60 bg-warning-soft/40 px-4 py-3.5">
        <div className="shrink-0 rounded-full ring-1 ring-warning-line">
          <AgentAvatar name={item.agent.name} src={item.agent.avatarUrl} seed={item.agent.id} size="sm" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-ink">
            <span className="font-semibold">{item.agent.name}</span> wants to{" "}
            <span className="font-semibold">
              {pending.tool === "publish_post" ? "publish a post" : "send an email"}
            </span>
            <span className="text-ink-muted">
              {" "}
              · from a {(TRIGGER_LABELS[item.trigger] ?? item.trigger).toLowerCase()} run ·{" "}
              {formatRelativeTime(item.awaitingSince ?? item.createdAt)}
            </span>
          </p>
          {pending.note ? <p className="mt-0.5 text-xs text-ink-muted">{pending.note}</p> : null}
          {item.escalatedAt ? (
            <p className="mt-1 text-xs text-danger">
              Escalated by the agent: {item.escalationReason}
            </p>
          ) : null}
        </div>
        <Badge tone="warning">Needs approval</Badge>
      </div>

      <div className="space-y-3 px-4 py-4">
        {draft ? (
          editing ? (
            <div className="space-y-3">
              {isEmail ? (
                <Field label="To" htmlFor={`to-${item.id}`}>
                  <Input
                    id={`to-${item.id}`}
                    value={edit.to}
                    onChange={(e) => setEdit({ ...edit, to: e.target.value })}
                  />
                </Field>
              ) : null}
              <Field label={isEmail ? "Subject" : "Title"} htmlFor={`title-${item.id}`}>
                <Input
                  id={`title-${item.id}`}
                  value={edit.title}
                  onChange={(e) => setEdit({ ...edit, title: e.target.value })}
                />
              </Field>
              <Field label="Body" htmlFor={`body-${item.id}`}>
                <Textarea
                  id={`body-${item.id}`}
                  rows={10}
                  value={edit.body}
                  onChange={(e) => setEdit({ ...edit, body: e.target.value })}
                />
              </Field>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => void saveEdit()} disabled={busy}>
                  Save changes
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={busy}>
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div>
              {isEmail ? (
                <p className="text-xs text-ink-muted">
                  To: {(pending.input.to as string[] | undefined)?.join(", ")}
                </p>
              ) : null}
              <p className="mt-0.5 text-sm font-semibold text-ink">{draft.title}</p>
              <pre className="mt-2 max-h-[28rem] overflow-auto whitespace-pre-wrap rounded-xl border border-line/80 bg-surface-2/70 p-4 font-sans text-sm leading-relaxed text-ink shadow-2xs">
                {draft.body}
              </pre>
            </div>
          )
        ) : (
          <pre className="whitespace-pre-wrap rounded-xl border border-line bg-surface-2/60 p-3.5 font-mono text-xs text-ink">
            {JSON.stringify(pending.input, null, 2)}
          </pre>
        )}

        {/* Why this is in front of you, in the agent's own words, before the
            detail of how it got there. */}
        {item.summary ? (
          <section>
            <h4 className="eyebrow mb-1">Why {item.agent.name} is asking</h4>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{item.summary}</p>
          </section>
        ) : null}

        {item.report && item.report !== item.summary ? (
          <details>
            <summary className="eyebrow cursor-pointer">The agent&apos;s full report</summary>
            <pre className="mt-2 whitespace-pre-wrap font-sans text-sm leading-relaxed text-ink-muted">
              {item.report}
            </pre>
          </details>
        ) : null}

        {item.findings && item.findings.length > 0 ? (
          <details className="rounded-xl border border-line bg-surface-2/40 p-3">
            <summary className="eyebrow cursor-pointer text-ink">
              Research sources &amp; citations ({item.findings.length})
            </summary>
            <div className="mt-2 space-y-3">
              {item.findings.map((finding, idx) => (
                <div key={idx} className="space-y-1 text-xs">
                  <p className="font-medium text-ink">{finding.query}</p>
                  <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-ink-muted">
                    {finding.findings}
                  </pre>
                  {finding.sources.length > 0 ? (
                    <ul className="space-y-0.5 pt-1">
                      {finding.sources.map((source, sIdx) => {
                        const href = safeHttpUrl(source.url);
                        return (
                          <li key={sIdx} className="truncate">
                            {href ? (
                              <a
                                href={href}
                                target="_blank"
                                rel="noreferrer"
                                className="text-accent hover:underline"
                              >
                                {source.title || source.url}
                              </a>
                            ) : (
                              <span className="text-ink-muted">{source.title || source.url}</span>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  ) : null}
                </div>
              ))}
            </div>
          </details>
        ) : null}

        <ConfirmDialog
          open={rejecting}
          onOpenChange={setRejecting}
          title={`Reject this ${what}?`}
          description={`Nothing is sent. ${item.agent.name} keeps the draft, and you can undo for a moment afterwards.`}
          confirmLabel="Reject"
          onConfirm={() => decide("reject")}
        >
          <Field label="Why? Optional - it goes in the audit trail" htmlFor={`reason-${item.id}`}>
            <Input
              id={`reason-${item.id}`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Tone is off for this audience."
              autoFocus
            />
          </Field>
        </ConfirmDialog>
        {(
          <div className="flex flex-wrap items-center gap-2.5 pt-2 sm:gap-3">
            <Button
              size="md"
              onClick={() => void decide("approve")}
              disabled={busy || editing}
              className="min-h-[44px] px-4 font-semibold shadow-xs hover:shadow-sm sm:min-h-0 sm:h-9"
            >
              <Check className="size-4" aria-hidden />
              Approve and send
            </Button>
            {draft ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => setEditing(true)}
                disabled={busy || editing}
                className="min-h-[44px] sm:min-h-0"
              >
                <Pencil className="size-3.5" aria-hidden />
                Edit
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="secondary"
              onClick={() => setRejecting(true)}
              disabled={busy || editing}
              className="min-h-[44px] hover:border-danger-line hover:bg-danger-soft/40 hover:text-danger sm:min-h-0"
            >
              <X className="size-3.5" aria-hidden />
              Reject
            </Button>
            <Link
              href={`/p/${project}/work?agentId=${item.agent.id}`}
              className="ml-auto flex min-h-[44px] items-center text-xs font-medium text-accent hover:underline sm:min-h-0"
            >
              Full run details
            </Link>
          </div>
        )}
        {note ? <p className="text-xs text-danger">{note}</p> : null}
      </div>
    </Panel>
  );
}
