/**
 * Numbers, said out loud.
 *
 * A stat tile that reads "42" makes the reader do the work: 42 of what, since
 * when, is that good, and what should they do about it? Every figure on
 * Insights carries one line that answers those, and that line is written here
 * rather than in the view, so it can be tested and so two tiles cannot end up
 * phrasing the same idea two ways.
 *
 * Rules kept throughout: no jargon (nothing about tokens, models, retrieval or
 * status codes), a direction when there is a previous period to compare with,
 * and the thing to do about it when there is one.
 */

/** "up 12%" / "down 4%" / "the same as before" / null when there is nothing to compare. */
export function describeChange(current: number, previous: number): string | null {
  if (previous <= 0) return current > 0 ? "first activity in this range" : null;
  if (current === previous) return "the same as the period before";
  const change = Math.round(((current - previous) / previous) * 100);
  if (change === 0) return "about the same as the period before";
  return `${change > 0 ? "up" : "down"} ${Math.abs(change)}% on the period before`;
}

function plural(count: number, one: string, many = `${one}s`): string {
  return `${count.toLocaleString()} ${count === 1 ? one : many}`;
}

/** "Last 30 days" as it appears mid-sentence. */
function rangeWords(days: number): string {
  if (days === 1) return "in the last day";
  if (days === 7) return "this week";
  if (days === 30) return "this month";
  return `in the last ${days} days`;
}

interface ConversationCopy {
  conversations: number;
  previousConversations: number;
  escalated: number;
  days: number;
}

export function conversationsCaption(input: ConversationCopy): string {
  if (input.conversations === 0) {
    return "Nobody has chatted with a published agent in this range yet.";
  }
  const change = describeChange(input.conversations, input.previousConversations);
  const handled = input.conversations - input.escalated;
  const share = Math.round((handled / input.conversations) * 100);
  return [
    `${plural(input.conversations, "chat conversation")} ${rangeWords(input.days)}`,
    change,
    `${share}% finished without needing a person`,
  ]
    .filter(Boolean)
    .join(" · ");
}

export function escalationCaption(escalated: number, conversations: number): string {
  if (conversations === 0) return "Nothing to escalate yet.";
  if (escalated === 0) return "Every conversation was handled by the agent itself.";
  const share = Math.round((escalated / conversations) * 100);
  const verdict =
    share >= 40
      ? "That is high: the agent is out of its depth, usually for want of a document."
      : share >= 20
        ? "Worth a look at what they were asking about."
        : "Normal - some questions should reach a person.";
  return `${plural(escalated, "conversation")} needed a person (${share}%). ${verdict}`;
}

export function helpfulCaption(up: number, down: number): string {
  const rated = up + down;
  if (rated === 0) return "Nobody has rated a reply yet. Ratings appear as people use the chat.";
  const share = Math.round((up / rated) * 100);
  return down === 0
    ? `Every one of the ${rated} rated replies was marked helpful.`
    : `${share}% of ${plural(rated, "rated reply", "rated replies")} were helpful. The ${plural(down, "unhelpful one", "unhelpful ones")} are listed below.`;
}

export function searchesCaption(searches: number, misses: number): string {
  if (searches === 0) {
    return "Your agents have not needed to look anything up yet.";
  }
  const found = searches - misses;
  const share = Math.round((found / searches) * 100);
  return misses === 0
    ? `Your documents answered all ${searches.toLocaleString()} look-ups.`
    : `Your documents answered ${share}% of ${plural(searches, "look-up")}. The ${plural(misses, "miss", "misses")} are the questions listed below.`;
}

export function issuesCaption(issues: number, suggestions: number): string {
  if (issues === 0 && suggestions === 0) return "Nothing raised in a chat or by an agent in this range.";
  const parts: string[] = [];
  if (issues > 0) parts.push(`${plural(issues, "thing")} reported in chat`);
  if (suggestions > 0) parts.push(`${plural(suggestions, "suggestion")} an agent raised`);
  return `${parts.join(" and ")}. Both wait in Needs you until you deal with them.`;
}

// --- autonomous work --------------------------------------------------------

interface WorkCopy {
  runs: number;
  previousRuns: number;
  done: number;
  failed: number;
  awaiting: number;
  days: number;
}

export function tasksCaption(input: WorkCopy): string {
  if (input.runs === 0) {
    return "No agent has done work on its own in this range. Give one a scope of work to change that.";
  }
  const change = describeChange(input.runs, input.previousRuns);
  return [`${plural(input.runs, "task")} ${rangeWords(input.days)}`, change, `${input.done} finished`]
    .filter(Boolean)
    .join(" · ");
}

export function failedCaption(failed: number, runs: number): string {
  if (runs === 0) return "Nothing has run yet.";
  if (failed === 0) return "Nothing failed. Every task that started finished or is waiting on you.";
  const share = Math.round((failed / runs) * 100);
  return `${plural(failed, "task")} stopped before finishing (${share}%). Each one says why under Work.`;
}

export function awaitingCaption(awaiting: number, turnaroundMs: number | null): string {
  if (awaiting === 0) {
    return turnaroundMs === null
      ? "Nothing is waiting on you."
      : `Nothing is waiting on you. You normally decide within ${humanDuration(turnaroundMs)}.`;
  }
  return `${plural(awaiting, "post or email")} cannot go out until you approve ${awaiting === 1 ? "it" : "them"}${
    turnaroundMs === null ? "" : `. You normally decide within ${humanDuration(turnaroundMs)}`
  }.`;
}

/** "under a minute" / "about 3 hours" - never "1.4 h". */
export function humanDuration(ms: number | null): string {
  if (ms === null) return "—";
  const minutes = ms / 60_000;
  if (minutes < 1) return "under a minute";
  if (minutes < 60) return `about ${Math.round(minutes)} minute${Math.round(minutes) === 1 ? "" : "s"}`;
  const hours = minutes / 60;
  if (hours < 36) return `about ${Math.round(hours)} hour${Math.round(hours) === 1 ? "" : "s"}`;
  const dayCount = Math.round(hours / 24);
  return `about ${dayCount} day${dayCount === 1 ? "" : "s"}`;
}

/** "$1.20" / "under a penny" / "no charge yet". */
export function humanCost(usd: number | null): string {
  if (usd === null) return "not priced";
  if (usd === 0) return "no charge yet";
  if (usd < 0.01) return "under a penny";
  return `$${usd.toFixed(2)}`;
}

interface CostCopy {
  costUsd: number | null;
  runs: number;
  conversations: number;
  unpricedModels: string[];
  days: number;
}

/**
 * What the model calls cost, without a token in sight. Cost per piece of work
 * is the figure an owner can actually act on - it is what one more agent, or
 * one more schedule, will cost them.
 */
export function costCaption(input: CostCopy): string {
  if (input.unpricedModels.length > 0) {
    return "Part of this period ran on a model with no published price, so the real figure is higher than this.";
  }
  if (input.costUsd === null) return "No published price for the model in use, so this cannot be estimated.";
  if (input.costUsd === 0) return "Nothing has been spent in this range.";
  const pieces = input.runs + input.conversations;
  if (pieces === 0) return `${humanCost(input.costUsd)} ${rangeWords(input.days)}.`;
  const each = input.costUsd / pieces;
  const perPiece = each < 0.01 ? "under a penny each" : `about ${humanCost(each)} each`;
  return `${humanCost(input.costUsd)} ${rangeWords(input.days)} for ${plural(pieces, "task and conversation", "tasks and conversations")} - ${perPiece}.`;
}

/**
 * Hours a person did not spend. Deliberately conservative and deliberately
 * labelled an estimate: fifteen minutes for a conversation somebody would
 * otherwise have answered, half an hour for a task.
 */
const MINUTES_SAVED_PER_CONVERSATION = 15;
const MINUTES_SAVED_PER_TASK = 30;

export function timeSaved(conversations: number, doneRuns: number): { hours: number; caption: string } {
  const minutes =
    conversations * MINUTES_SAVED_PER_CONVERSATION + doneRuns * MINUTES_SAVED_PER_TASK;
  const hours = minutes / 60;
  if (minutes === 0) {
    return { hours: 0, caption: "Nothing handled yet, so nothing saved yet." };
  }
  return {
    hours,
    caption: `A rough estimate: ${MINUTES_SAVED_PER_CONVERSATION} minutes for each conversation answered and ${MINUTES_SAVED_PER_TASK} for each task finished.`,
  };
}

export function formatHours(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 10) return `${hours.toFixed(1)} h`;
  return `${Math.round(hours)} h`;
}
