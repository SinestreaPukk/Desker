/**
 * What a waiting action will do, in a few plain lines: the exact thing the
 * person is about to release. Pure, so the web card, a LINE prompt and the
 * tests read the same sentences. An approval prompt that hides the content
 * is not an approval, so each tool states its real payload.
 */
import type { PendingAction } from "./types";

const s = (v: unknown) => (typeof v === "string" ? v : "");
const when = (v: unknown) => (s(v) ? new Date(s(v)).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "");
const clip = (t: string, n: number) => (t.length > n ? `${t.slice(0, n - 1)}…` : t);

export function previewPending(pending: PendingAction, draft?: { title?: string | null; body?: string | null } | null): { verb: string; lines: string[] } {
  const i = pending.input;
  switch (pending.tool) {
    case "send_email":
      return { verb: "Send an email", lines: [`To: ${Array.isArray(i.to) ? i.to.join(", ") : s(i.to)}`, `Subject: ${s(i.subject) || draft?.title || ""}`, clip(draft?.body ?? "", 300)] };
    case "inbox_reply":
      return { verb: "Reply to an email", lines: [clip(draft?.body ?? "", 400)] };
    case "publish_post":
      return { verb: "Publish a post", lines: [clip(draft?.body ?? draft?.title ?? "", 400)] };
    case "calendar_create_event":
      return { verb: "Add to your calendar", lines: [s(i.summary), `${when(i.start)} – ${when(i.end)}`] };
    case "calendar_reschedule":
      return { verb: "Move a calendar event", lines: [`New time: ${when(i.start)} – ${when(i.end)}`] };
    case "calendar_cancel_event":
      return { verb: "Cancel a calendar event", lines: [s(i.title), "Attendees are told."] };
    case "tasks_write":
      return { verb: i.action === "complete" ? "Mark a task done" : "Add a reminder", lines: [s(i.title), s(i.due) ? `Due ${when(i.due)}` : ""].filter(Boolean) };
    case "phone_send":
      return { verb: i.kind === "call" ? "Place a call" : "Send a text", lines: [`To: ${s(i.to)}`, clip(s(i.message), 300)] };
    case "slack_post_message":
      return { verb: "Post to Slack", lines: [`${s(i.channel)}: ${clip(s(i.text), 300)}`] };
    case "browse_web":
      return { verb: "Do this in a browser", lines: [clip(s(i.goal), 400), "It may sign you up or fill in forms. It never pays or books."] };
    case "browse_commit":
      return { verb: "Submit in the browser", lines: [clip(s(i.plan), 500), "It never pays or books."] };
    default:
      return { verb: "Make a change", lines: [pending.note ?? ""].filter(Boolean) };
  }
}
