import { Fragment } from "react";
import { Users } from "lucide-react";
import { AgentAvatar } from "@/components/ui/avatar";
import { TypingIndicator } from "@/components/chat/chat-thread";
import type { ActionItemDto, CollabAgent } from "@/lib/work/serialize";
import type { ActionStatus } from "@/lib/work/types";

/**
 * Agents working together, read as the short group chat it is: the ask from
 * one, the answer from the other. Built from the hand-off records, so it shows
 * exactly what was passed on - not a paraphrase of it.
 */
export function TeamChat({ item }: { item: ActionItemDto }) {
  const { askedBy, handoffs } = item.collab;
  if (!askedBy && handoffs.length === 0) return null;

  return (
    <section aria-label="Team chat" className="rounded-lg border border-line bg-surface p-3.5">
      <h4 className="eyebrow mb-3 flex items-center gap-1.5">
        <Users className="size-3.5" aria-hidden />
        Team chat
      </h4>
      <ol className="space-y-3">
        {askedBy ? (
          <>
            <Message agent={askedBy.agent} text={askedBy.task} note={askedBy.context} />
            <Message agent={item.agent} text={replyFor(item.status, item.headline ?? item.summary)} working={isWorking(item.status)} />
          </>
        ) : null}
        {handoffs.map((handoff) => (
          <Fragment key={handoff.id}>
            <Message agent={item.agent} text={`@${handoff.agent.name} ${handoff.task}`} />
            <Message agent={handoff.agent} text={replyFor(handoff.status, handoff.reply)} working={isWorking(handoff.status)} />
          </Fragment>
        ))}
      </ol>
    </section>
  );
}

function Message({
  agent,
  text,
  note,
  working = false,
}: {
  agent: CollabAgent;
  text: string;
  note?: string;
  working?: boolean;
}) {
  return (
    <li className="flex items-start gap-2.5">
      <AgentAvatar name={agent.name} src={agent.avatarUrl} seed={agent.id} size="sm" className="shrink-0" />
      <div className="min-w-0">
        <p className="mb-1 text-xs font-semibold text-ink">{agent.name}</p>
        {working ? (
          <TypingIndicator agentName={agent.name} />
        ) : (
          <div className="rounded-panel rounded-tl-md border border-line bg-surface-2/60 px-3.5 py-2.5 text-sm leading-relaxed text-ink">
            <p className="whitespace-pre-wrap">{text}</p>
            {note ? (
              <details className="mt-1.5 text-xs text-ink-muted">
                <summary className="cursor-pointer">What they passed along</summary>
                <p className="mt-1 whitespace-pre-wrap">{note}</p>
              </details>
            ) : null}
          </div>
        )}
      </div>
    </li>
  );
}

function isWorking(status: ActionStatus): boolean {
  return status === "queued" || status === "in_progress";
}

function replyFor(status: ActionStatus, reply: string | null): string {
  if (status === "failed") return reply ?? "I couldn't finish this one.";
  if (status === "needs_approval") return reply ?? "Done - it's waiting for your approval.";
  return reply ?? "Done.";
}
