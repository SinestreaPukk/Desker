"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Check, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AgentAvatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Panel } from "@/components/ui/panel";
import { DecisionStamp, type StampKind } from "@/components/ui/decision-stamp";
import {
  useApproveActionItem,
  useRejectActionItem,
  useReopenActionItem,
  useSaveRule,
  useUpdateDraft,
} from "@/hooks/use-work-data";
import { errorMessage } from "@/lib/api-client";
import type { ActionItemDto } from "@/lib/work/serialize";
import { TRIGGER_LABELS, type GatedToolId } from "@/lib/work/types";
import { formatDateTime, formatRelativeTime, safeHttpUrl } from "@/lib/utils";

/**
 * What each outbound action is called on the card, its button and its toasts -
 * one table, so an approval reads the same whatever is being approved.
 */
const PENDING_COPY: Record<GatedToolId, { verb: string; noun: string; approve: string; going: string }> = {
  publish_post: { verb: "publish a post", noun: "post", approve: "Approve and publish", going: "publishing" },
  send_email: { verb: "send an email", noun: "email", approve: "Approve and send", going: "sending" },
  calendar_create_event: {
    verb: "add a calendar event",
    noun: "event",
    approve: "Approve and add to calendar",
    going: "adding",
  },
  calendar_reschedule: { verb: "move a calendar event", noun: "change", approve: "Approve and move it", going: "moving" },
  calendar_cancel_event: { verb: "cancel a calendar event", noun: "cancellation", approve: "Approve and cancel it", going: "cancelling" },
  tasks_write: { verb: "change your to-do list", noun: "reminder", approve: "Approve and add it", going: "adding" },
  phone_send: { verb: "text or call someone", noun: "message", approve: "Approve and send", going: "sending" },
  inbox_reply: { verb: "reply in an email thread", noun: "reply", approve: "Approve and send", going: "sending" },
  slack_post_message: { verb: "post to Slack", noun: "message", approve: "Approve and post", going: "posting" },
  github_write: { verb: "change GitHub", noun: "change", approve: "Approve and apply", going: "applying" },
  social_manage: { verb: "change a social post", noun: "change", approve: "Approve and apply", going: "applying" },
};

const SOCIAL_NAMES: Record<string, string> = { linkedin: "LinkedIn", facebook: "Facebook", instagram: "Instagram", x: "X", threads: "Threads" };

const GITHUB_HEADLINE: Record<string, (input: Record<string, unknown>) => string> = {
  commit_files: (i) => `Commit to ${String(i.branch)}${i.pull_request ? " and open a pull request" : ""}`,
  open_pull_request: (i) => `Open a pull request: ${String(i.head)} → ${String(i.base ?? "default branch")}`,
  review_pull_request: (i) => `${i.event === "APPROVE" ? "Approve" : i.event === "REQUEST_CHANGES" ? "Request changes on" : "Review"} pull request #${String(i.number)}`,
  merge_pull_request: (i) => `Merge pull request #${String(i.number)} (${String(i.method ?? "squash")})`,
  create_issue: () => "Open an issue",
  comment: (i) => `Comment on #${String(i.number)}`,
  update_issue: (i) => `${i.state === "closed" ? "Close" : i.state === "open" ? "Reopen" : "Edit"} #${String(i.number)}`,
};

/** A GitHub change as it would land: every file in full, so nothing is approved unseen. */
function GithubPreview({ input }: { input: Record<string, unknown> }) {
  const files = Array.isArray(input.files) ? (input.files as { path: string; content?: string; delete?: boolean }[]) : [];
  const pull = input.pull_request as { title?: string; body?: string } | undefined;
  const body = typeof input.body === "string" ? input.body : "";
  return (
    <>
      <p className="font-semibold text-ink">{GITHUB_HEADLINE[String(input.action)]?.(input) ?? String(input.action)}</p>
      <p className="mt-0.5 font-mono text-xs text-ink-muted">{String(input.repo)}</p>
      {typeof input.title === "string" ? <p className="mt-2 font-medium text-ink">{input.title}</p> : null}
      {typeof input.message === "string" ? <p className="mt-2 text-ink">Commit: {input.message}</p> : null}
      {files.length > 0 ? (
        <ul className="mt-2 space-y-1">
          {files.map((file) => (
            <li key={file.path}>
              {file.delete ? (
                <p className="font-mono text-xs text-danger">Delete {file.path}</p>
              ) : (
                <details>
                  <summary className="cursor-pointer font-mono text-xs text-ink">{file.path}</summary>
                  <pre className="mt-1 max-h-72 overflow-auto rounded-md border border-line bg-surface p-2 text-xs">{file.content}</pre>
                </details>
              )}
            </li>
          ))}
        </ul>
      ) : null}
      {pull?.title ? <p className="mt-2 text-ink">Pull request: {pull.title}</p> : null}
      {body || pull?.body ? <p className="mt-2 whitespace-pre-wrap text-ink">{body || pull?.body}</p> : null}
    </>
  );
}

/** The event or message exactly as it would go out: there is no draft to show for these. */
function ActionPreview({ tool, input }: { tool: GatedToolId; input: Record<string, unknown> }) {
  const text = (key: string) => (typeof input[key] === "string" ? (input[key] as string) : "");
  const when = (key: string) => (text(key) ? formatDateTime(text(key)) : "");
  return (
    <div className="rounded-lg border border-line bg-surface-2/60 p-3.5 text-sm">
      {tool === "phone_send" ? (
        <>
          <p className="font-semibold text-ink">
            {input.kind === "call" ? "Call" : "Text"} {text("to")}
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-ink">{text("message")}</p>
          <p className="mt-1 text-xs text-ink-muted">{input.kind === "call" ? "The call reads this aloud once, then hangs up." : "Sent as an SMS from your Desker number."}</p>
        </>
      ) : tool === "tasks_write" ? (
        <>
          <p className="font-semibold text-ink">{input.action === "complete" ? "Mark a task done" : text("title")}</p>
          {text("due") ? <p className="mt-0.5 text-xs text-ink-muted">Due {when("due")}</p> : null}
        </>
      ) : tool === "calendar_cancel_event" ? (
        <>
          <p className="font-semibold text-ink">Cancel: {text("title")}</p>
          <p className="mt-0.5 text-xs text-ink-muted">
            {input.whole_series === true ? "Every occurrence is cancelled." : "Only this occurrence is cancelled."} Attendees are told.
          </p>
        </>
      ) : tool === "calendar_reschedule" ? (
        <>
          <p className="font-semibold text-ink">
            Move to {when("start")} – {when("end")}
          </p>
          <p className="mt-0.5 text-xs text-ink-muted">
            {input.whole_series === true ? "Every occurrence moves by the same amount." : "Only this occurrence moves."}
          </p>
        </>
      ) : tool === "calendar_create_event" ? (
        <>
          <p className="font-semibold text-ink">{text("summary")}</p>
          <p className="mt-0.5 text-xs text-ink-muted">
            {when("start")} – {when("end")}
          </p>
          {Array.isArray(input.attendees) && input.attendees.length > 0 ? (
            <p className="mt-1 text-xs text-ink-muted">Invites: {(input.attendees as string[]).join(", ")}</p>
          ) : null}
          {text("description") ? <p className="mt-2 whitespace-pre-wrap text-ink">{text("description")}</p> : null}
        </>
      ) : tool === "github_write" ? (
        <GithubPreview input={input} />
      ) : tool === "social_manage" ? (
        <>
          <p className="font-semibold text-ink">
            {input.action === "delete" ? "Delete" : "Edit"} a post on {SOCIAL_NAMES[text("platform")] ?? text("platform")}
          </p>
          <p className="mt-0.5 font-mono text-xs text-ink-muted">Post {text("post_id")}</p>
          {input.action === "edit" ? (
            <p className="mt-2 whitespace-pre-wrap text-ink">{text("text")}</p>
          ) : (
            <p className="mt-2 text-ink-muted">It will be removed from the network. This can&apos;t be undone.</p>
          )}
        </>
      ) : (
        <>
          <p className="text-xs text-ink-muted">To {text("channel")}</p>
          <p className="mt-1 whitespace-pre-wrap text-ink">{text("text")}</p>
        </>
      )}
    </div>
  );
}

/**
 * One thing waiting on a person: what the agent wants to send, shown in full,
 * editable in place, with the three decisions that exist - approve, edit and
 * approve, or reject. Rendered only in Needs you, the one place a decision is made.
 */
export function ApprovalCard({ item, project }: { item: ActionItemDto; project: string }) {
  const approve = useApproveActionItem();
  const reject = useRejectActionItem();
  const reopen = useReopenActionItem();
  const update = useUpdateDraft();
  const runHref = `/p/${project}/work/${item.id}`;
  const onRunPage = usePathname() === runHref;
  const [note, setNote] = React.useState<string | null>(null);
  const [editing, setEditing] = React.useState(false);
  const [rejecting, setRejecting] = React.useState(false);
  const [reason, setReason] = React.useState("");
  // The correction loop: a rejection's reason, or what an edit changed, can
  // become a rule the agent follows from now on - offered, never assumed.
  const [keepRule, setKeepRule] = React.useState(true);
  const [teach, setTeach] = React.useState<string | null>(null);
  const saveRule = useSaveRule(item.agent.id);
  // The decision lands as a stamp on the card for a moment before the card
  // leaves the queue - the same stamp as the public site's demos.
  const [stamp, setStamp] = React.useState<StampKind | null>(null);

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
      // They corrected it: ask whether the agent should remember why.
      if (edit.body.trim() !== (draft.body ?? "").trim() || edit.title.trim() !== (draft.title ?? "").trim()) setTeach("");
    } catch (caught) {
      setNote(errorMessage(caught));
    }
  }

  async function keep(text: string, source: "rejection" | "edit") {
    await saveRule.mutateAsync({ text: text.trim(), source, actionItemId: item.id });
    toast.success(`${item.agent.name} will remember that`, {
      description: `Saved as a rule. See, reword or remove it on ${item.agent.name}'s page, under Profile.`,
    });
  }

  const copy = pending ? PENDING_COPY[pending.tool] : null;
  const what = copy?.noun ?? "draft";

  async function decide(verb: "approve" | "reject") {
    setNote(null);
    setStamp(verb === "reject" ? "rejected" : pending?.tool === "publish_post" ? "published" : "sent");
    if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      await new Promise((resolve) => window.setTimeout(resolve, 650));
    }
    try {
      if (verb === "approve") {
        await approve.mutateAsync({ id: item.id });
        toast.success(`Approved - ${copy?.going ?? "sending"} the ${what} now`, {
          description: `You approved ${item.agent.name}'s ${what}. Whether it arrived shows on the run and in the Audit log.`,
        });
      } else {
        await reject.mutateAsync({ id: item.id, reason: reason.trim() });
        if (keepRule && reason.trim().length >= 5) {
          await keep(reason, "rejection").catch((caught) => toast.error(`The rule wasn't saved: ${errorMessage(caught)}`));
        }
        toast("Rejected - nothing was sent", {
          description: reason.trim() ? `Reason: ${reason.trim()}` : `${item.agent.name}'s ${what} was not sent.`,
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
      setStamp(null);
      setNote(errorMessage(caught));
      toast.error(errorMessage(caught));
      throw caught;
    }
  }

  if (!pending) return null;

  return (
    <Panel className="relative overflow-hidden shadow-sm">
      {stamp ? <DecisionStamp kind={stamp} className="right-6 top-20 z-10" /> : null}
      <div className="flex items-start gap-3 border-b border-warning-line/60 bg-warning-soft/40 px-4 py-3.5">
        <div className="shrink-0 rounded-full ring-1 ring-warning-line">
          <AgentAvatar name={item.agent.name} src={item.agent.avatarUrl} seed={item.agent.id} size="sm" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-ink">
            <span className="font-semibold">{item.agent.name}</span> wants to{" "}
            <span className="font-semibold">
              {PENDING_COPY[pending.tool].verb}
            </span>
            <span className="text-ink-muted">
              {" "}
              · from a {(TRIGGER_LABELS[item.trigger] ?? item.trigger).toLowerCase()} run ·{" "}
              <span title={formatDateTime(item.awaitingSince ?? item.createdAt)}>
                {formatRelativeTime(item.awaitingSince ?? item.createdAt)}
              </span>
            </span>
          </p>
          <p className="mt-0.5 text-xs text-ink-muted">Nothing goes out until you approve it.</p>
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
              {pending.tool === "publish_post" && typeof pending.input.platform === "string" ? (
                <p className="text-xs text-ink-muted">
                  Posts to {SOCIAL_NAMES[pending.input.platform] ?? pending.input.platform}
                  {typeof pending.input.account === "string" ? ` (${pending.input.account})` : ""} as soon as you approve
                </p>
              ) : null}
              {pending.tool === "publish_post" && typeof pending.input.image_url === "string" && safeHttpUrl(pending.input.image_url) ? (
                // eslint-disable-next-line @next/next/no-img-element -- any https image the post will carry; not ours to optimise
                <img
                  src={safeHttpUrl(pending.input.image_url)!}
                  alt="The image posted with it"
                  className="mt-2 max-h-48 rounded-lg border border-line object-contain"
                />
              ) : null}
              <p className="mt-0.5 text-sm font-semibold text-ink">{draft.title}</p>
              <pre className="mt-2 max-h-[28rem] overflow-auto whitespace-pre-wrap rounded-lg border border-line/80 bg-surface-2/70 p-4 font-sans text-sm leading-relaxed text-ink">
                {draft.body}
              </pre>
              <p className="mt-1.5 text-xs text-ink-muted">Written by AI, which can make mistakes. Check it before you approve.</p>
            </div>
          )
        ) : pending.tool === "calendar_create_event" ||
          pending.tool === "calendar_reschedule" ||
          pending.tool === "calendar_cancel_event" ||
          pending.tool === "tasks_write" ||
          pending.tool === "phone_send" ||
          pending.tool === "slack_post_message" ||
          pending.tool === "github_write" ||
          pending.tool === "social_manage" ? (
          <ActionPreview tool={pending.tool} input={pending.input} />
        ) : (
          <pre className="whitespace-pre-wrap rounded-lg border border-line bg-surface-2/60 p-3.5 font-mono text-xs text-ink">
            {JSON.stringify(pending.input, null, 2)}
          </pre>
        )}

        {teach !== null ? (
          <div className="space-y-2 rounded-lg border border-accent-line bg-accent-soft/30 p-3">
            <p className="text-sm font-medium text-ink">
              You changed {item.agent.name}&apos;s draft. Should it do this differently from now on?
            </p>
            <Textarea
              rows={2}
              aria-label={`What ${item.agent.name} should do differently`}
              value={teach}
              onChange={(e) => setTeach(e.target.value)}
              placeholder="Keep emails under 120 words and sign off with my first name."
            />
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                loading={saveRule.isPending}
                disabled={teach.trim().length < 5}
                onClick={() =>
                  void keep(teach, "edit")
                    .then(() => setTeach(null))
                    .catch((caught) => toast.error(errorMessage(caught)))
                }
              >
                Save as a rule
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setTeach(null)}>
                Just this once
              </Button>
            </div>
          </div>
        ) : null}

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
          <details className="rounded-lg border border-line bg-surface-2/40 p-3">
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
          description={`Nothing is sent.${draft ? ` ${item.agent.name} keeps the draft.` : ""} You can undo for a moment afterwards.`}
          confirmLabel="Reject"
          onConfirm={() => decide("reject")}
        >
          <Field label="Why? Optional - it goes in the audit trail" htmlFor={`reason-${item.id}`}>
            <Input
              id={`reason-${item.id}`}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Too salesy - never mention discounts in posts."
              autoFocus
            />
          </Field>
          {reason.trim().length >= 5 ? (
            <label htmlFor={`keep-${item.id}`} className="mt-3 flex cursor-pointer items-start gap-2.5 text-sm text-ink">
              <Checkbox
                id={`keep-${item.id}`}
                checked={keepRule}
                onCheckedChange={(next) => setKeepRule(next === true)}
                className="mt-0.5"
              />
              <span>
                Save this as a rule for {item.agent.name}, so it doesn&apos;t happen again.
                <span className="block text-xs text-ink-muted">It shows on {item.agent.name}&apos;s page, where you can reword or remove it.</span>
              </span>
            </label>
          ) : null}
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
              {copy!.approve}
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
            {onRunPage ? null : (
              <Link
                href={runHref}
                className="ml-auto flex min-h-[44px] items-center text-xs font-medium text-accent hover:underline sm:min-h-0"
              >
                Full run details
              </Link>
            )}
          </div>
        )}
        {note ? <p className="text-xs text-danger">{note}</p> : null}
      </div>
    </Panel>
  );
}
