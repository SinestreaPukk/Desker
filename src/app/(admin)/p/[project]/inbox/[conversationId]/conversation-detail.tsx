"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowLeftRight,
  Bug,
  CheckCircle2,
  Lightbulb,
  Send,
  StickyNote,
  ThumbsDown,
  ThumbsUp,
  Undo2,
  UserRound,
  TriangleAlert,
  UserRoundCheck,
  Wrench,
} from "lucide-react";
import { AgentAvatar } from "@/components/ui/avatar";
import { Badge, SeverityBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { FormError } from "@/components/ui/states";
import {
  Panel,
  PanelBody,
  PanelHeader,
  PanelTitle,
} from "@/components/ui/panel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState, ErrorState, LoadingRows } from "@/components/ui/states";
import { MessageText } from "@/components/chat/message-text";
import {
  type ConversationDetail,
  useAddNote,
  useConversation,
  useNotes,
  useSendReply,
  useSetConversationMode,
  useSetConversationStatus,
  useSetIssueStatus,
} from "@/hooks/use-admin-data";
import { errorMessage } from "@/lib/api-client";
import { toolLabel } from "@/hooks/use-chat-stream";
import { ISSUE_KINDS, issueKind } from "@/lib/issue-kinds";
import { cn, formatRelativeTime } from "@/lib/utils";

export function ConversationDetail({
  conversationId,
  project,
}: {
  conversationId: string;
  project: string;
}) {
  const { data, isPending, error, refetch, isRefetching } =
    useConversation(conversationId);
  const setConversationStatus = useSetConversationStatus();
  const setIssueStatus = useSetIssueStatus();

  const [showToolTurns, setShowToolTurns] = React.useState(false);

  if (isPending) {
    return (
      <div className="p-4 sm:p-6">
        <LoadingRows count={5} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 sm:p-6">
        <ErrorState
          message={errorMessage(error)}
          onRetry={() => void refetch()}
          retrying={isRefetching}
        />
      </div>
    );
  }

  const conversation = data!;
  const visible = conversation.messages.filter(
    (message) => showToolTurns || message.role !== "tool",
  );

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-line px-4 py-4 sm:px-6">
        <Button asChild variant="ghost" size="sm" className="-ml-2 mb-3">
          <Link href={`/p/${project}/inbox`}>
            <ArrowLeft aria-hidden />
            Inbox
          </Link>
        </Button>

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <AgentAvatar
              name={conversation.agent.name}
              src={conversation.agent.avatarUrl}
              seed={conversation.agent.id}
              size="lg"
            />
            <div>
              <h1 className="text-lg font-semibold text-ink">
                {conversation.agent.name}
              </h1>
              <p className="text-sm text-ink-muted">
                {conversation.agent.jobTitle}
              </p>
              <p className="mt-1 flex flex-wrap items-center gap-2 meta">
                <span>Started {formatRelativeTime(conversation.createdAt)}</span>
                {conversation.isPreview ? (
                  <Badge tone="neutral">Builder preview</Badge>
                ) : null}
                {conversation.originalAgent ? (
                  <Badge tone="accent">
                    <ArrowLeftRight aria-hidden />
                    Transferred from {conversation.originalAgent.name}
                  </Badge>
                ) : null}
                {conversation.mode === "human" ? (
                  <Badge tone="warning">
                    <UserRound aria-hidden />
                    You have this
                    {conversation.takenOverBy ? ` · ${conversation.takenOverBy}` : ""}
                  </Badge>
                ) : null}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <label htmlFor="conversation-status" className="sr-only">
              Conversation status
            </label>
            <div className="w-40">
              <Select
                value={conversation.status}
                onValueChange={(value) =>
                  setConversationStatus.mutate({
                    conversationId,
                    status: value as "open" | "escalated" | "resolved",
                  })
                }
              >
                <SelectTrigger id="conversation-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="escalated">Escalated</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </header>

      {/* items-start so a short transcript does not stretch its panel to the
          full viewport height and leave a field of empty card below it. */}
      <div className="grid flex-1 items-start gap-5 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        {/* Transcript */}
        <div className="min-w-0 space-y-5">
          {conversation.summary ? (
            <Panel className="border-accent-line bg-accent-soft/30">
              <PanelBody className="pt-5">
                <p className="meta mb-1.5">Summary</p>
                <p className="text-sm leading-relaxed text-ink">
                  {conversation.summary}
                </p>
              </PanelBody>
            </Panel>
          ) : null}

        <Panel className="min-w-0">
          <PanelHeader>
            <PanelTitle>Transcript</PanelTitle>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowToolTurns((value) => !value)}
              aria-pressed={showToolTurns}
            >
              <Wrench aria-hidden />
              {showToolTurns ? "Hide tool calls" : "Show tool calls"}
            </Button>
          </PanelHeader>

          <PanelBody>
            {visible.length === 0 ? (
              <p className="py-8 text-center text-sm text-ink-muted">
                No messages in this conversation.
              </p>
            ) : (
              <ol className="space-y-4">
                {visible.map((message) => (
                  <li key={message.id}>
                    <div className="mb-1 flex items-baseline gap-2">
                      <span
                        className={cn(
                          "text-xs font-semibold",
                          message.role === "user" && "text-ink",
                          message.role === "assistant" && "text-accent",
                          message.role === "human" && "text-warning",
                          message.role === "tool" && "text-ink-subtle",
                        )}
                      >
                        {message.role === "user"
                          ? "Client"
                          : message.role === "assistant"
                            ? conversation.agent.name
                            : message.role === "human"
                              ? `${message.authorName ?? "A colleague"} · you`
                              : "Tool result"}
                      </span>
                      <span className="meta">
                        {formatRelativeTime(message.createdAt)}
                      </span>
                      {message.rating === 1 ? (
                        <span className="inline-flex items-center gap-1 text-xs text-positive">
                          <ThumbsUp className="size-3" aria-hidden />
                          Client found this helpful
                        </span>
                      ) : message.rating === -1 ? (
                        <span className="inline-flex items-center gap-1 text-xs text-danger">
                          <ThumbsDown className="size-3" aria-hidden />
                          Client marked this unhelpful
                        </span>
                      ) : null}
                    </div>
                    <div
                      className={cn(
                        "space-y-2 rounded-lg border px-3.5 py-2.5 text-sm leading-relaxed",
                        message.role === "user" && "border-line bg-surface-2 text-ink",
                        message.role === "assistant" &&
                          "border-accent-line bg-accent-soft/30 text-ink",
                        message.role === "tool" &&
                          "border-dashed border-line bg-surface-2 font-mono text-xs text-ink-muted",
                      )}
                    >
                      {message.role === "tool" ? (
                        <ToolTurn content={message.content} />
                      ) : (
                        <MessageText content={message.content} />
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </PanelBody>

          <ReplyBox conversation={conversation} />
        </Panel>
        </div>

        {/* Raised items + private notes */}
        <div className="space-y-5">
          <NotesPanel conversationId={conversation.id} />
          <Panel>
            <PanelHeader>
              <PanelTitle>Raised in this conversation</PanelTitle>
            </PanelHeader>
            <PanelBody>
              {conversation.issues.length === 0 ? (
                <EmptyState
                  icon={CheckCircle2}
                  title="Nothing raised"
                  description="This agent didn't log an issue, record a suggestion, or escalate."
                  className="py-8"
                />
              ) : (
                <ul className="space-y-3">
                  {conversation.issues.map((issue) => {
                    const resolved = issue.status === "resolved";
                    const kind = ISSUE_KINDS[issueKind(issue.type)];
                    const Icon = {
                      bug: Bug,
                      lightbulb: Lightbulb,
                      handoff: UserRoundCheck,
                      alert: TriangleAlert,
                    }[kind.icon];
                    return (
                      <li
                        key={issue.id}
                        className={cn(
                          "rounded-lg border border-line p-3",
                          resolved && "opacity-70",
                        )}
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={kind.tone}>
                            <Icon aria-hidden />
                            {kind.label}
                          </Badge>
                          {issue.type === "escalation" ? null : (
                            <SeverityBadge severity={issue.severity} />
                          )}
                        </div>
                        <p className="mt-2 text-sm font-medium text-ink">
                          {issue.summary}
                        </p>
                        {issue.details ? (
                          <p className="mt-1 whitespace-pre-wrap text-xs leading-relaxed text-ink-muted">
                            {issue.details}
                          </p>
                        ) : null}
                        <Button
                          variant={resolved ? "ghost" : "secondary"}
                          size="sm"
                          className="mt-2.5"
                          loading={
                            setIssueStatus.isPending &&
                            setIssueStatus.variables?.issueId === issue.id
                          }
                          onClick={() =>
                            setIssueStatus.mutate({
                              issueId: issue.id,
                              status: resolved ? "open" : "resolved",
                            })
                          }
                        >
                          {resolved ? (
                            <>
                              <Undo2 aria-hidden />
                              Reopen
                            </>
                          ) : (
                            <>
                              <CheckCircle2 aria-hidden />
                              Mark resolved
                            </>
                          )}
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </PanelBody>
          </Panel>
        </div>
      </div>
    </div>
  );
}

/**
 * A colleague answering the client directly.
 *
 * This is the half of escalation that was missing: the agent could raise a
 * hand, but nobody could reply, so the client got "I've passed this to a
 * colleague" and then silence. What is typed here lands in their chat window.
 */
function ReplyBox({ conversation }: { conversation: ConversationDetail }) {
  const reply = useSendReply(conversation.id);
  const setMode = useSetConversationMode(conversation.id);
  const [text, setText] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const human = conversation.mode === "human";

  async function send() {
    const message = text.trim();
    if (!message) return;
    setError(null);
    try {
      await reply.mutateAsync({ message, takeOver: true });
      setText("");
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  if (conversation.isPreview) {
    return (
      <div className="border-t border-line px-5 py-3">
        <p className="text-xs text-ink-muted">
          This is a builder preview, so there is no client on the other end to
          reply to.
        </p>
      </div>
    );
  }

  return (
    <div className="border-t border-line bg-surface-2/40 p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-ink">
          {human ? "You are answering this client" : "Reply as a human"}
        </p>
        {human ? (
          <Button
            variant="ghost"
            size="sm"
            loading={setMode.isPending}
            onClick={() => setMode.mutate("agent")}
          >
            <Undo2 aria-hidden />
            Hand back to {conversation.agent.name}
          </Button>
        ) : null}
      </div>

      <FormError message={error} />

      <label htmlFor="human-reply" className="sr-only">
        Reply to the client
      </label>
      <Textarea
        id="human-reply"
        rows={3}
        value={text}
        disabled={reply.isPending}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          if (
            (event.metaKey || event.ctrlKey) &&
            event.key === "Enter" &&
            !event.nativeEvent.isComposing
          ) {
            event.preventDefault();
            void send();
          }
        }}
        placeholder={`Write to the client as yourself. They see this in the same chat window as ${conversation.agent.name}.`}
      />

      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="text-xs leading-relaxed text-ink-muted">
          {human
            ? `${conversation.agent.name} stays quiet until you hand it back.`
            : `Sending takes the conversation over — ${conversation.agent.name} stops answering until you hand it back.`}
        </p>
        <Button
          size="sm"
          loading={reply.isPending}
          disabled={!text.trim()}
          onClick={() => void send()}
          className="shrink-0"
        >
          <Send aria-hidden />
          Send
        </Button>
      </div>
    </div>
  );
}

/**
 * Private notes. Never shown to the client, never replayed to the model -
 * context for the next colleague who opens the conversation ("promised a
 * callback Tuesday", "check with finance before refunding").
 */
function NotesPanel({ conversationId }: { conversationId: string }) {
  const { data: notes, isPending } = useNotes(conversationId);
  const add = useAddNote(conversationId);
  const [draft, setDraft] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  async function submit() {
    const body = draft.trim();
    if (!body) return;
    setError(null);
    try {
      await add.mutateAsync(body);
      setDraft("");
    } catch (caught) {
      setError(errorMessage(caught));
    }
  }

  return (
    <Panel>
      <PanelHeader>
        <div>
          <PanelTitle className="flex items-center gap-2">
            <StickyNote className="size-4 text-ink-subtle" aria-hidden />
            Private notes
          </PanelTitle>
        </div>
        <Badge tone="neutral">Team only</Badge>
      </PanelHeader>
      <PanelBody className="space-y-3">
        {isPending ? (
          <p className="text-xs text-ink-muted">Loading…</p>
        ) : notes!.length === 0 ? (
          <p className="text-sm leading-relaxed text-ink-muted">
            Nothing yet. Leave context for whoever picks this up next — the
            client never sees it.
          </p>
        ) : (
          <ul className="space-y-2.5">
            {notes!.map((note) => (
              <li key={note.id} className="rounded-md border border-line bg-surface-2/50 p-3">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">
                  {note.body}
                </p>
                <p className="mt-1.5 meta">
                  {note.authorName} · {formatRelativeTime(note.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        )}

        <FormError message={error} />

        <label htmlFor="new-note" className="sr-only">
          Add a note
        </label>
        <Textarea
          id="new-note"
          rows={2}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
              event.preventDefault();
              void submit();
            }
          }}
          placeholder="Add a note for the team…"
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            variant="secondary"
            loading={add.isPending}
            disabled={!draft.trim()}
            onClick={() => void submit()}
          >
            Add note
          </Button>
        </div>
      </PanelBody>
    </Panel>
  );
}

/** Tool turns are stored as "tool_name: result" blocks; label them readably. */
function ToolTurn({ content }: { content: string }) {
  const blocks = content.split("\n\n");
  return (
    <>
      {blocks.map((block, index) => {
        const separator = block.indexOf(": ");
        const name = separator > 0 ? block.slice(0, separator) : null;
        const body = separator > 0 ? block.slice(separator + 2) : block;
        return (
          <div key={index} className={index > 0 ? "mt-2 border-t border-line pt-2" : ""}>
            {name ? (
              <p className="mb-1 font-sans text-xs font-semibold uppercase tracking-wide text-ink-subtle">
                {toolLabel(name)}
              </p>
            ) : null}
            <p className="line-clamp-[12] whitespace-pre-wrap">{body}</p>
          </div>
        );
      })}
    </>
  );
}
