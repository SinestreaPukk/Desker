/**
 * The audit log, in sentences.
 *
 * Every row is a fact worth keeping - `tool.called` with `{"tool":"web_research"}`
 * is exactly what happened - and none of it is readable by the person who has
 * to answer "what did this thing do on Tuesday?". This turns each row into an
 * event and a plain description; the row itself is still there, one disclosure
 * away, for whoever wants the payload.
 *
 * Pure and shared so the timeline and its tests read the same strings.
 */

interface AuditLike {
  action: string;
  actorType: string;
  actorName?: string | null;
  targetType?: string | null;
  metadata?: Record<string, unknown> | null;
}

export type AuditTone = "neutral" | "accent" | "positive" | "warning" | "danger";

/** Which of the small icon set the timeline draws beside the row. */
export type AuditIcon =
  | "research"
  | "documents"
  | "draft"
  | "send"
  | "publish"
  | "approval"
  | "person"
  | "task"
  | "schedule"
  | "settings"
  | "billing"
  | "note";

interface AuditDescription {
  /** The event, as a short phrase: "Researched competitor pricing". */
  title: string;
  /** One line under it, or null when the title says everything. */
  detail: string | null;
  tone: AuditTone;
  icon: AuditIcon;
}

function article(word: string): string {
  return /^[aeiou]/i.test(word) ? "an" : "a";
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Trimmed to length, with the markdown a model writes taken back out of it. */
function clip(value: string, max = 90): string {
  const clean = value
    .replace(/^---+$/gm, " ")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/[*_`>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return clean.length <= max ? clean : `${clean.slice(0, max - 1).trimEnd()}…`;
}

const TRIGGER_WORDS: Record<string, string> = {
  schedule: "on its schedule",
  webhook: "because an event arrived",
  manual: "because someone pressed Run now",
  followup: "as a follow-up it had queued",
};

/** What a tool call did, said as the thing rather than as the tool. */
function describeToolCall(meta: Record<string, unknown>): AuditDescription {
  const tool = text(meta.tool) ?? "something";
  const input = (meta.input ?? {}) as Record<string, unknown>;
  const ok = meta.ok !== false;
  const gated = meta.gated === true;
  const result = text(meta.result);

  const failed = (title: string): AuditDescription => ({
    title,
    detail: result ? `It did not work: ${clip(result, 140)}` : "It did not work.",
    tone: "danger",
    icon: "note",
  });

  switch (tool) {
    case "web_research": {
      const query = text(input.query);
      if (!ok) return failed(query ? `Tried to research ${clip(query, 60)}` : "Tried to research the web");
      return {
        title: query ? `Researched ${clip(query, 70)}` : "Researched the web",
        detail: text(input.focus) ? `Focused on ${clip(String(input.focus), 90)}.` : null,
        tone: "neutral",
        icon: "research",
      };
    }
    case "search_documents":
    // Earlier names of the same tool, still in the log.
    case "search_context":
    case "search_company_context": {
      const query = text(input.query);
      if (!ok) return failed("Tried to look something up in your documents");
      return {
        title: query ? `Looked up ${clip(query, 70)} in your documents` : "Searched your documents",
        detail: null,
        tone: "neutral",
        icon: "documents",
      };
    }
    case "review_spending": {
      if (!ok) return failed("Tried to add up your statements");
      return {
        title: "Added up your statements",
        detail: "Totals, categories and recurring charges, worked out from the uploaded CSV files. Only the totals were shared with the model.",
        tone: "neutral",
        icon: "documents",
      };
    }
    case "draft_content": {
      const title = text(input.title);
      const kind = text(input.kind)?.replace(/_/g, " ") ?? "something";
      if (!ok) return failed("Tried to write a draft");
      return {
        title: title ? `Drafted “${clip(title, 70)}”` : `Drafted ${article(kind)} ${kind}`,
        detail: `Saved as ${article(kind)} ${kind}. Nothing was sent.`,
        tone: "neutral",
        icon: "draft",
      };
    }
    case "publish_post":
      if (!ok) return failed("Tried to publish a post");
      return gated
        ? {
            title: "Queued a post for your approval",
            detail: "It waits in Needs you. Nothing has been published.",
            tone: "warning",
            icon: "approval",
          }
        : { title: "Published a post", detail: null, tone: "positive", icon: "publish" };
    case "send_email":
      if (!ok) return failed("Tried to send an email");
      return gated
        ? {
            title: "Queued an email for your approval",
            detail: "It waits in Needs you. Nothing has been sent.",
            tone: "warning",
            icon: "approval",
          }
        : { title: "Sent an email", detail: null, tone: "positive", icon: "send" };
    case "calendar_create_event": {
      if (!ok) return failed("Tried to add a calendar event");
      const summary = text(input.summary);
      return gated
        ? {
            title: "Queued a calendar event for your approval",
            detail: `${summary ? `${clip(summary, 80)}. ` : ""}It waits in Needs you. Nothing is on the calendar yet.`,
            tone: "warning",
            icon: "approval",
          }
        : { title: "Added a calendar event", detail: summary ? clip(summary, 120) : null, tone: "positive", icon: "schedule" };
    }
    case "calendar_reschedule":
      if (!ok) return failed("Tried to move a calendar event");
      return gated
        ? { title: "Queued moving a calendar event for your approval", detail: "It waits in Needs you. Nothing has moved yet.", tone: "warning", icon: "approval" }
        : { title: "Moved a calendar event", detail: null, tone: "positive", icon: "schedule" };
    case "inbox_read":
      if (!ok) return failed("Tried to read the inbox");
      return { title: text(input.thread_id) ? "Read an email thread" : "Checked the inbox", detail: null, tone: "neutral", icon: "documents" };
    case "inbox_reply":
      if (!ok) return failed("Tried to reply to an email");
      return gated
        ? { title: "Drafted a reply for your approval", detail: "It sits as a draft in the thread, in your own mailbox. It waits in Needs you; nothing has been sent.", tone: "warning", icon: "approval" }
        : { title: "Replied to an email", detail: null, tone: "positive", icon: "send" };
    case "slack_post_message":
      if (!ok) return failed("Tried to post to Slack");
      return gated
        ? {
            title: "Queued a Slack message for your approval",
            detail: "It waits in Needs you. Nothing has been posted.",
            tone: "warning",
            icon: "approval",
          }
        : { title: "Posted to Slack", detail: text(input.channel) ? `In ${text(input.channel)}.` : null, tone: "positive", icon: "send" };
    case "suggest_opportunity": {
      if (!ok) return failed("Tried to raise a suggestion");
      const title = text(input.title);
      return {
        title: "Raised a suggestion in Needs you",
        detail: title ? clip(title, 120) : null,
        tone: "accent",
        icon: "note",
      };
    }
    case "calendar_list_events":
      return ok
        ? { title: "Checked the calendar", detail: null, tone: "neutral", icon: "schedule" }
        : failed("Tried to check the calendar");
    case "github_read":
      return ok ? { title: "Read from GitHub", detail: null, tone: "neutral", icon: "research" } : failed("Tried to read from GitHub");
    case "github_write":
      if (!ok) return failed("Tried to change GitHub");
      return gated
        ? { title: "Queued a GitHub change for your approval", detail: "It waits in Needs you. Nothing has changed on GitHub yet.", tone: "warning", icon: "approval" }
        : { title: "Changed GitHub", detail: text(input.repo) ? `In ${text(input.repo)}.` : null, tone: "positive", icon: "send" };
    case "schedule_followup": {
      const objective = text(input.objective);
      return {
        title: "Queued itself a follow-up task",
        detail: objective ? clip(objective, 120) : null,
        tone: "neutral",
        icon: "schedule",
      };
    }
    case "delegate_to_colleague": {
      if (!ok) return failed("Tried to hand work to a colleague");
      const colleague = result?.match(/^Delegated task to (.+?) \(/)?.[1] ?? "a colleague";
      const task = text(input.task);
      return {
        title: `Handed work to ${colleague}`,
        detail: task ? clip(task, 140) : null,
        tone: "accent",
        icon: "person",
      };
    }
    case "escalate_to_human": {
      const reason = text(input.reason) ?? text(input.summary);
      return {
        title: "Asked for a person",
        detail: reason ? clip(reason, 140) : "It could not finish this part safely on its own.",
        tone: "danger",
        icon: "person",
      };
    }
    default:
      return {
        title: ok ? `Used ${tool.replace(/_/g, " ")}` : `Tried to use ${tool.replace(/_/g, " ")}`,
        detail: result ? clip(result, 140) : null,
        tone: ok ? "neutral" : "danger",
        icon: "note",
      };
  }
}

const FAILED_DELIVERY: Record<string, string> = {
  publish_post: "A post could not be published",
  send_email: "An email could not be sent",
  calendar_create_event: "A calendar event could not be added",
  calendar_reschedule: "A calendar event could not be moved",
  inbox_reply: "An email reply could not be sent",
  slack_post_message: "A Slack message could not be posted",
  github_write: "A GitHub change could not be made",
};

/** One audit row, said in the owner's language. */
export function describeAuditEntry(entry: AuditLike): AuditDescription {
  const meta = (entry.metadata ?? {}) as Record<string, unknown>;
  const who = entry.actorName ?? "Someone";
  const summary = text(meta.summary);
  const reason = text(meta.reason);
  const error = text(meta.error);
  const trigger = text(meta.trigger);

  switch (entry.action) {
    case "tool.called":
      return describeToolCall(meta);

    case "action_item.created":
      return {
        title: "Started a task",
        detail: trigger ? `It began ${TRIGGER_WORDS[trigger] ?? trigger}.` : null,
        tone: "neutral",
        icon: "task",
      };
    case "action_item.done":
      return {
        title: "Finished a task",
        detail: summary ? clip(summary, 140) : null,
        tone: "positive",
        icon: "task",
      };
    case "action_item.failed":
      return {
        title: "A task stopped before finishing",
        detail: error ? clip(error, 140) : "The run says why under Work.",
        tone: "danger",
        icon: "task",
      };
    case "action_item.needs_approval":
      return {
        title: "A task is waiting for your approval",
        detail: "Nothing goes out until you decide.",
        tone: "warning",
        icon: "approval",
      };
    case "action_item.approved":
      return { title: `${who} approved what an agent wanted to send`, detail: null, tone: "positive", icon: "approval" };
    case "action_item.rejected":
      return {
        title: `${who} rejected what an agent wanted to send`,
        detail: reason ? `Reason: ${clip(reason, 120)}` : "Nothing was sent.",
        tone: "neutral",
        icon: "approval",
      };
    case "action_item.reopened":
      return { title: `${who} put a rejected item back in the queue`, detail: null, tone: "neutral", icon: "approval" };
    case "action_item.retried":
      return {
        title: meta.resend ? `${who} asked to send a failed item again` : `${who} retried a failed run`,
        detail: meta.resend ? "It is back in Needs you for a fresh yes." : "A new run started with the same instruction.",
        tone: "neutral",
        icon: "task",
      };
    case "action_item.cancelled":
      return { title: `${who} cancelled a task`, detail: "Nothing further ran.", tone: "neutral", icon: "task" };
    case "action_item.deleted":
      return {
        title: `${who} removed a task from Work`,
        detail: text(meta.headline) ? clip(text(meta.headline)!, 140) : null,
        tone: "neutral",
        icon: "task",
      };
    case "conversation.deleted":
      return { title: `${who} removed a conversation`, detail: null, tone: "neutral", icon: "note" };
    case "issue.deleted":
      return { title: `${who} removed an issue`, detail: null, tone: "neutral", icon: "note" };
    case "suggestion.deleted":
      return { title: `${who} removed a suggestion`, detail: null, tone: "neutral", icon: "note" };
    case "digest.deleted":
      return { title: `${who} removed an update`, detail: null, tone: "neutral", icon: "note" };
    case "action_item.refused":
      return {
        title: "A task was refused before it started",
        detail: reason ? clip(reason, 140) : "The plan's limit was reached.",
        tone: "warning",
        icon: "billing",
      };

    case "publish_post.delivered":
      return { title: "Published a post", detail: text(meta.detail), tone: "positive", icon: "publish" };
    case "send_email.delivered":
      return { title: "Sent an approved email", detail: text(meta.detail), tone: "positive", icon: "send" };
    case "calendar_create_event.delivered":
      return { title: "Added an approved calendar event", detail: text(meta.detail), tone: "positive", icon: "schedule" };
    case "calendar_reschedule.delivered":
      return { title: "Moved an approved calendar event", detail: text(meta.detail), tone: "positive", icon: "schedule" };
    case "inbox_reply.delivered":
      return { title: "Sent an approved email reply", detail: text(meta.detail), tone: "positive", icon: "send" };
    case "slack_post_message.delivered":
      return { title: "Posted an approved message to Slack", detail: text(meta.detail), tone: "positive", icon: "send" };
    case "github_write.delivered":
      return { title: "Made an approved change on GitHub", detail: text(meta.detail), tone: "positive", icon: "send" };
    case "publish_post.failed":
    case "send_email.failed":
    case "calendar_create_event.failed":
    case "calendar_reschedule.failed":
    case "inbox_reply.failed":
    case "slack_post_message.failed":
    case "github_write.failed":
      return {
        title: FAILED_DELIVERY[entry.action.slice(0, -".failed".length)] ?? "Something could not be sent",
        detail: text(meta.detail) ?? "The connection returned an error. Check it under Integrations.",
        tone: "danger",
        icon: "settings",
      };

    case "digest.created":
      return {
        title: "Wrote you an update",
        detail: summary ?? text(meta.headline),
        tone: "accent",
        icon: "note",
      };
    case "suggestion.created":
      return {
        title: "Suggested something",
        detail: summary ? clip(summary, 140) : "It is waiting in Needs you.",
        tone: "accent",
        icon: "note",
      };
    case "suggestion.accepted":
      return {
        title: `${who} accepted a suggestion`,
        detail: text(meta.addedObjective)
          ? `Added to the agent's objectives: ${clip(String(meta.addedObjective), 120)}`
          : null,
        tone: "positive",
        icon: "note",
      };
    case "suggestion.dismissed":
      return { title: `${who} dismissed a suggestion`, detail: null, tone: "neutral", icon: "note" };
    case "suggestion.snoozed":
      return { title: `${who} snoozed a suggestion`, detail: "It comes back later.", tone: "neutral", icon: "note" };

    case "draft.edited":
      return { title: `${who} edited a draft before approving it`, detail: null, tone: "neutral", icon: "draft" };
    case "support_inbox.created":
      return { title: `${who} set up the support inbox`, detail: "Customer messages sent to its address are answered by the Support agent, and each reply waits for approval.", tone: "neutral", icon: "settings" };
    case "support_inbox.updated":
      return {
        title: meta.rotated ? `${who} replaced the support inbox address` : `${who} changed the support inbox`,
        detail: meta.rotated ? "The old address stopped working at once." : null,
        tone: "neutral",
        icon: "settings",
      };
    case "support_inbox.removed":
      return { title: `${who} removed the support inbox`, detail: "Its address no longer accepts messages.", tone: "neutral", icon: "settings" };
    case "workflow.started":
      return {
        title: `${who} started the “${text(meta.name) ?? "a"}” workflow`,
        detail: typeof meta.steps === "number" ? `${meta.steps} step${meta.steps === 1 ? "" : "s"}, each handed to the next when it finishes.` : null,
        tone: "neutral",
        icon: "task",
      };
    case "agent_rule.created":
      return {
        title:
          meta.source === "rejection"
            ? `${who} turned a rejection into a rule for an agent`
            : meta.source === "edit"
              ? `${who} turned an edit into a rule for an agent`
              : `${who} gave an agent a new rule`,
        detail: text(meta.text) ? `“${clip(text(meta.text)!, 160)}” - it follows this from its next run.` : null,
        tone: "neutral",
        icon: "settings",
      };
    case "agent_rule.updated":
      return {
        title: `${who} reworded one of an agent's rules`,
        detail: text(meta.text) ? `Now: “${clip(text(meta.text)!, 160)}”` : null,
        tone: "neutral",
        icon: "settings",
      };
    case "agent_rule.removed":
      return {
        title: `${who} removed one of an agent's rules`,
        detail: text(meta.text) ? `It no longer follows “${clip(text(meta.text)!, 140)}”.` : null,
        tone: "neutral",
        icon: "settings",
      };
    case "scope_of_work.updated":
      return { title: `${who} changed what an agent does on its own`, detail: null, tone: "neutral", icon: "settings" };
    case "project.context_updated":
      return {
        title: `${who} updated the shared business context`,
        detail: "Every agent in the project reads it from its next run.",
        tone: "neutral",
        icon: "settings",
      };

    case "integration.connected":
      return {
        title: `${who} connected ${text(meta.name) ?? "an integration"}`,
        detail: text(meta.type) === "email" ? "Agents can send email once you approve a draft." : "Agents can publish once you approve a draft.",
        tone: "positive",
        icon: "settings",
      };
    case "email.unsubscribed":
      return {
        title: "Someone unsubscribed from your emails",
        detail: text(meta.email) ? `${text(meta.email)} won't receive agent emails or digests from now on.` : null,
        tone: "neutral",
        icon: "send",
      };
    case "integration.removed":
      return {
        title: `${who} removed ${text(meta.name) ?? "an integration"}`,
        detail: "Anything that needed it will stay a draft.",
        tone: "warning",
        icon: "settings",
      };

    case "organization.created":
      return { title: "Workspace created", detail: null, tone: "neutral", icon: "settings" };
    case "organization.mailing_address_updated":
      return { title: `${who} updated the mailing address on agent emails`, detail: null, tone: "neutral", icon: "settings" };
    case "user.password_reset":
      return { title: `${who} reset their password`, detail: "Every other session was signed out.", tone: "neutral", icon: "person" };
    case "organization.renamed":
      return { title: `${who} renamed the organisation`, detail: null, tone: "neutral", icon: "settings" };
    case "project.created":
      return { title: `${who} created a project`, detail: text(meta.name), tone: "neutral", icon: "settings" };
    case "project.updated":
      return { title: `${who} renamed a project`, detail: text(meta.name), tone: "neutral", icon: "settings" };
    case "project.deleted":
      return { title: `${who} deleted a project`, detail: text(meta.name), tone: "warning", icon: "settings" };
    case "membership.role_changed":
      return {
        title: `${who} changed a teammate's role`,
        detail: text(meta.role) ? `Now ${meta.role}.` : null,
        tone: "neutral",
        icon: "person",
      };
    case "invitation.created":
      return { title: `${who} invited a teammate`, detail: text(meta.email), tone: "neutral", icon: "person" };
    case "invitation.accepted":
      return { title: "A teammate accepted their invitation", detail: text(meta.email), tone: "positive", icon: "person" };
    case "invitation.revoked":
      return { title: `${who} revoked an invitation`, detail: text(meta.email), tone: "neutral", icon: "person" };

    case "billing.checkout_started":
      return { title: `${who} started a plan change`, detail: text(meta.plan), tone: "neutral", icon: "billing" };
    case "billing.subscription_updated":
      return {
        title: "The plan changed",
        detail: text(meta.plan) ? `Now on ${meta.plan}.` : null,
        tone: "accent",
        icon: "billing",
      };
    case "conversation.refused":
      return {
        title: "A client message was turned away",
        detail: reason ? clip(reason, 140) : "The plan's limit was reached.",
        tone: "warning",
        icon: "billing",
      };

    default: {
      // Never a raw verb on its own: at worst, the verb with its full stops
      // turned into words.
      const words = entry.action.replace(/[._]/g, " ");
      return {
        title: `${words.charAt(0).toUpperCase()}${words.slice(1)}`,
        detail: summary ?? reason ?? error,
        tone: "neutral",
        icon: "note",
      };
    }
  }
}

/** "09:03", the way the timeline shows a time of day in 24-hour local time. */
export function timeOfDay(iso: string, locale?: string): string {
  const date = new Date(iso);
  return date
    .toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit", hour12: false })
    .replace(/\s/g, "");
}

/** "Today" / "Yesterday" / "23 September" - the heading a day's rows sit under. */
export function dayHeading(iso: string, now = new Date(), locale?: string): string {
  const date = new Date(iso);
  const startOf = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const days = Math.round((startOf(now) - startOf(date)) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return date.toLocaleDateString(locale, {
    day: "numeric",
    month: "long",
    ...(date.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
  });
}

/** Who did it, for the line under the description. */
export function actorWords(entry: AuditLike): string {
  switch (entry.actorType) {
    case "agent":
      return entry.actorName ? `${entry.actorName} (agent)` : "An agent";
    case "schedule":
      return "A schedule";
    case "system":
      return "Desker";
    default:
      return entry.actorName ?? "A person";
  }
}
