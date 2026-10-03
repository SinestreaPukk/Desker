/**
 * Email and calendar, for Google (Gmail, Google Calendar) and Microsoft
 * (Outlook mail and calendar, through Microsoft Graph) behind one set of
 * functions - so an agent's tools, the approval queue and the audit log never
 * care which one an owner connected.
 *
 * Reads return plain text for the model. Anything that reaches another person
 * - a reply, a new event, a moved event - returns a DeliveryResult and only
 * ever runs after the approval gate (lib/work/execute.ts).
 *
 * Replies are drafted in the real thread, in the owner's own mailbox, the
 * moment the agent writes them: they can see it in Gmail or Outlook while it
 * waits in Needs you. Approval sends that draft; rejection deletes it.
 */
import { localIso } from "@/lib/local-time";
import "server-only";
import type { DeliveryResult } from "@/lib/work/integrations";
import { connectorAccess } from "./oauth";
import { call, failure } from "./providers";

type MailCalendarProvider = "google" | "microsoft";

export interface Access {
  provider: MailCalendarProvider;
  token: string;
  account: string;
}

const GMAIL = "https://gmail.googleapis.com/gmail/v1/users/me";
const GCAL = "https://www.googleapis.com/calendar/v3/calendars/primary";
const GRAPH = "https://graph.microsoft.com/v1.0/me";
const MAX_TEXT = 12_000;

/** The calendar an agent uses: Google Calendar if connected, else Outlook Calendar. */
export async function calendarAccess(organizationId: string): Promise<Access | null> {
  const google = await connectorAccess(organizationId, "google_calendar");
  if (google) return { provider: "google", token: google.accessToken, account: google.account };
  const outlook = await connectorAccess(organizationId, "outlook_calendar");
  return outlook ? { provider: "microsoft", token: outlook.accessToken, account: outlook.account } : null;
}

/** The mailbox an agent uses: Gmail if connected, else Outlook. */
export async function mailAccess(organizationId: string): Promise<Access | null> {
  const gmail = await connectorAccess(organizationId, "gmail");
  if (gmail) return { provider: "google", token: gmail.accessToken, account: gmail.account };
  const outlook = await connectorAccess(organizationId, "outlook_mail");
  return outlook ? { provider: "microsoft", token: outlook.accessToken, account: outlook.account } : null;
}

const name = (access: Access, kind: "mail" | "calendar") =>
  access.provider === "google" ? (kind === "mail" ? "Gmail" : "Google Calendar") : kind === "mail" ? "Outlook" : "Outlook Calendar";

// --- calendar -------------------------------------------------------------------

export interface CalendarEvent {
  id: string;
  /** The recurring series it belongs to, when it repeats. */
  seriesId: string | null;
  title: string;
  /** ISO. All-day events carry a date only. */
  start: string;
  end: string;
  allDay: boolean;
  attendees: string[];
}

/** Graph gives UTC times without the Z when asked for UTC. */
const utc = (value: string | undefined) => (value && !/[zZ]|[+-]\d\d:\d\d$/.test(value) ? `${value}Z` : (value ?? ""));

export async function listEvents(access: Access, window: { from: string; to: string }): Promise<CalendarEvent[]> {
  if (access.provider === "google") {
    const url = new URL(`${GCAL}/events`);
    url.searchParams.set("timeMin", window.from);
    url.searchParams.set("timeMax", window.to);
    url.searchParams.set("singleEvents", "true");
    url.searchParams.set("orderBy", "startTime");
    url.searchParams.set("maxResults", "100");
    const { ok, status, data } = await call(url.toString(), access.token);
    if (!ok) throw new Error(failure("Google Calendar", status, data));
    return ((data.items as Array<Record<string, unknown>> | undefined) ?? []).map((event) => {
      const start = (event.start as { dateTime?: string; date?: string } | undefined) ?? {};
      const end = (event.end as { dateTime?: string; date?: string } | undefined) ?? {};
      return {
        id: String(event.id),
        seriesId: typeof event.recurringEventId === "string" ? event.recurringEventId : null,
        title: String(event.summary ?? "(no title)"),
        start: start.dateTime ?? start.date ?? "",
        end: end.dateTime ?? end.date ?? "",
        allDay: !start.dateTime,
        attendees: ((event.attendees as Array<{ email?: string }> | undefined) ?? []).map((a) => a.email ?? "").filter(Boolean),
      };
    });
  }
  const url = new URL(`${GRAPH}/calendarView`);
  url.searchParams.set("startDateTime", window.from);
  url.searchParams.set("endDateTime", window.to);
  url.searchParams.set("$top", "100");
  url.searchParams.set("$orderby", "start/dateTime");
  url.searchParams.set("$select", "id,subject,start,end,isAllDay,attendees,seriesMasterId");
  const { ok, status, data } = await call(url.toString(), access.token, { headers: { prefer: 'outlook.timezone="UTC"' } });
  if (!ok) throw new Error(failure("Outlook Calendar", status, data));
  return ((data.value as Array<Record<string, unknown>> | undefined) ?? []).map((event) => ({
    id: String(event.id),
    seriesId: typeof event.seriesMasterId === "string" ? event.seriesMasterId : null,
    title: String(event.subject ?? "(no title)"),
    start: utc((event.start as { dateTime?: string } | undefined)?.dateTime),
    end: utc((event.end as { dateTime?: string } | undefined)?.dateTime),
    allDay: Boolean(event.isAllDay),
    attendees: ((event.attendees as Array<{ emailAddress?: { address?: string } }> | undefined) ?? [])
      .map((a) => a.emailAddress?.address ?? "")
      .filter(Boolean),
  }));
}

/** Timed events that overlap [start, end), leaving out the one being moved. All-day events never clash. */
export function conflictsWith(events: CalendarEvent[], start: string, end: string, except?: string): CalendarEvent[] {
  const from = Date.parse(start);
  const to = Date.parse(end);
  return events.filter(
    (event) => !event.allDay && event.id !== except && Date.parse(event.start) < to && Date.parse(event.end) > from,
  );
}

/** The events as the model reads them, in the owner's time zone: ids included, so it can move one. */
export function describeEvents(events: CalendarEvent[], timeZone = "UTC"): string {
  if (events.length === 0) return "No events in that window.";
  return events
    .slice(0, 60)
    .map(
      (event) =>
        `- ${event.allDay ? `${event.start} (all day)` : `${localIso(event.start, timeZone)} → ${localIso(event.end, timeZone)}`}: ${event.title}` +
        (event.attendees.length ? ` (with ${event.attendees.slice(0, 8).join(", ")})` : "") +
        ` [id: ${event.id}${event.seriesId ? `; repeats, series id: ${event.seriesId}` : ""}]`,
    )
    .join("\n");
}

export interface NewEvent {
  summary: string;
  start: string;
  end: string;
  description?: string;
  attendees?: string[];
}

export async function createEvent(access: Access, event: NewEvent): Promise<DeliveryResult> {
  const { ok, status, data } =
    access.provider === "google"
      ? await call(`${GCAL}/events?sendUpdates=all`, access.token, {
          method: "POST",
          body: JSON.stringify({
            summary: event.summary,
            description: event.description,
            start: { dateTime: event.start },
            end: { dateTime: event.end },
            attendees: event.attendees?.map((email) => ({ email })),
          }),
        })
      : await call(`${GRAPH}/events`, access.token, {
          method: "POST",
          body: JSON.stringify({
            subject: event.summary,
            body: { contentType: "text", content: event.description ?? "" },
            start: { dateTime: new Date(event.start).toISOString().slice(0, 19), timeZone: "UTC" },
            end: { dateTime: new Date(event.end).toISOString().slice(0, 19), timeZone: "UTC" },
            attendees: event.attendees?.map((address) => ({ emailAddress: { address }, type: "required" })),
          }),
        });
  return ok
    ? { ok, status, detail: `Added "${event.summary}" to ${name(access, "calendar")}` }
    : { ok: false, status, detail: failure(name(access, "calendar"), status, data) };
}

async function getEvent(access: Access, id: string): Promise<{ start: string; end: string } | null> {
  if (access.provider === "google") {
    const { ok, data } = await call(`${GCAL}/events/${encodeURIComponent(id)}`, access.token);
    if (!ok) return null;
    const start = data.start as { dateTime?: string } | undefined;
    const end = data.end as { dateTime?: string } | undefined;
    return start?.dateTime && end?.dateTime ? { start: start.dateTime, end: end.dateTime } : null;
  }
  const { ok, data } = await call(`${GRAPH}/events/${encodeURIComponent(id)}?$select=start,end`, access.token, {
    headers: { prefer: 'outlook.timezone="UTC"' },
  });
  if (!ok) return null;
  return {
    start: utc((data.start as { dateTime?: string } | undefined)?.dateTime),
    end: utc((data.end as { dateTime?: string } | undefined)?.dateTime),
  };
}

/** Where a move lands: the new times for one occurrence, or the whole series shifted by the same amount. */
export function shiftedSeries(
  series: { start: string; end: string },
  occurrence: { start: string },
  newStart: string,
): { start: string; end: string } {
  const delta = Date.parse(newStart) - Date.parse(occurrence.start);
  return {
    start: new Date(Date.parse(series.start) + delta).toISOString(),
    end: new Date(Date.parse(series.end) + delta).toISOString(),
  };
}

/**
 * Moves an event. For a repeating one, `wholeSeries` moves every occurrence by
 * the same amount the chosen one moves; otherwise only that occurrence moves.
 */
export async function rescheduleEvent(
  access: Access,
  move: { eventId: string; seriesId?: string | null; wholeSeries?: boolean; start: string; end: string },
): Promise<DeliveryResult> {
  let target = move.eventId;
  let times = { start: move.start, end: move.end };
  if (move.wholeSeries && move.seriesId) {
    const [series, occurrence] = await Promise.all([getEvent(access, move.seriesId), getEvent(access, move.eventId)]);
    if (!series || !occurrence) {
      return { ok: false, status: 404, detail: `${name(access, "calendar")} could not find that repeating event any more.` };
    }
    target = move.seriesId;
    times = shiftedSeries(series, occurrence, move.start);
  }
  const { ok, status, data } =
    access.provider === "google"
      ? await call(`${GCAL}/events/${encodeURIComponent(target)}?sendUpdates=all`, access.token, {
          method: "PATCH",
          body: JSON.stringify({ start: { dateTime: times.start }, end: { dateTime: times.end } }),
        })
      : await call(`${GRAPH}/events/${encodeURIComponent(target)}`, access.token, {
          method: "PATCH",
          body: JSON.stringify({
            start: { dateTime: new Date(times.start).toISOString().slice(0, 19), timeZone: "UTC" },
            end: { dateTime: new Date(times.end).toISOString().slice(0, 19), timeZone: "UTC" },
          }),
        });
  return ok
    ? { ok, status, detail: move.wholeSeries ? "Moved every occurrence of the event" : "Moved the event" }
    : { ok: false, status, detail: failure(name(access, "calendar"), status, data) };
}

/** Cancels an event, or a whole repeating series. Attendees are told by the provider. */
export async function cancelEvent(
  access: Access,
  cancel: { eventId: string; seriesId?: string | null; wholeSeries?: boolean },
): Promise<DeliveryResult> {
  const target = cancel.wholeSeries && cancel.seriesId ? cancel.seriesId : cancel.eventId;
  const { ok, status, data } =
    access.provider === "google"
      ? await call(`${GCAL}/events/${encodeURIComponent(target)}?sendUpdates=all`, access.token, { method: "DELETE" })
      : await call(`${GRAPH}/events/${encodeURIComponent(target)}`, access.token, { method: "DELETE" });
  return ok
    ? { ok, status, detail: cancel.wholeSeries ? "Cancelled every occurrence of the event" : "Cancelled the event" }
    : { ok: false, status, detail: failure(name(access, "calendar"), status, data) };
}

// --- mail -----------------------------------------------------------------------

export interface MailThread {
  id: string;
  subject: string;
  from: string;
  date: string;
  snippet: string;
}

type Header = { name?: string; value?: string };
const header = (headers: Header[] | undefined, key: string) =>
  headers?.find((h) => h.name?.toLowerCase() === key.toLowerCase())?.value ?? "";

function decodeBase64Url(value: string): string {
  return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

/** The readable text of a Gmail message: its text/plain part, or its HTML with the tags taken out. */
function gmailText(payload: Record<string, unknown> | undefined): string {
  if (!payload) return "";
  const parts: Record<string, unknown>[] = [];
  const walk = (part: Record<string, unknown>) => {
    parts.push(part);
    for (const child of (part.parts as Record<string, unknown>[] | undefined) ?? []) walk(child);
  };
  walk(payload);
  const pick = (mime: string) => parts.find((part) => part.mimeType === mime && (part.body as { data?: string })?.data);
  const plain = pick("text/plain");
  if (plain) return decodeBase64Url((plain.body as { data: string }).data);
  const html = pick("text/html");
  return html ? decodeBase64Url((html.body as { data: string }).data).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ") : "";
}

export async function listThreads(access: Access, query?: string): Promise<MailThread[]> {
  if (access.provider === "google") {
    const list = await call(`${GMAIL}/threads?maxResults=10&q=${encodeURIComponent(query?.trim() || "in:inbox")}`, access.token);
    if (!list.ok) throw new Error(failure("Gmail", list.status, list.data));
    const threads = (list.data.threads as Array<{ id: string; snippet?: string }> | undefined) ?? [];
    return Promise.all(
      threads.map(async (thread) => {
        const meta = await call(
          `${GMAIL}/threads/${thread.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
          access.token,
        );
        const messages = (meta.data.messages as Array<{ payload?: { headers?: Header[] } }> | undefined) ?? [];
        const last = messages[messages.length - 1]?.payload?.headers;
        return {
          id: thread.id,
          subject: header(last, "Subject") || "(no subject)",
          from: header(last, "From"),
          date: header(last, "Date"),
          snippet: thread.snippet ?? "",
        };
      }),
    );
  }
  const url = query?.trim()
    ? `${GRAPH}/messages?$top=10&$search=${encodeURIComponent(`"${query.trim().replace(/"/g, "")}"`)}&$select=id,subject,from,receivedDateTime,bodyPreview`
    : `${GRAPH}/mailFolders/inbox/messages?$top=10&$orderby=receivedDateTime desc&$select=id,subject,from,receivedDateTime,bodyPreview`;
  const { ok, status, data } = await call(url, access.token);
  if (!ok) throw new Error(failure("Outlook", status, data));
  return ((data.value as Array<Record<string, unknown>> | undefined) ?? []).map((message) => {
    const from = (message.from as { emailAddress?: { name?: string; address?: string } } | undefined)?.emailAddress;
    return {
      id: String(message.id),
      subject: String(message.subject ?? "(no subject)"),
      from: from ? `${from.name ?? ""} <${from.address ?? ""}>`.trim() : "",
      date: String(message.receivedDateTime ?? ""),
      snippet: String(message.bodyPreview ?? ""),
    };
  });
}

export function describeThreads(threads: MailThread[]): string {
  if (threads.length === 0) return "Nothing in the inbox matches.";
  return threads
    .map((thread) => `- ${thread.date} · ${thread.from} · ${thread.subject}\n  ${thread.snippet.slice(0, 200)}\n  [thread id: ${thread.id}]`)
    .join("\n");
}

export async function readThread(access: Access, threadId: string): Promise<string> {
  if (access.provider === "google") {
    const { ok, status, data } = await call(`${GMAIL}/threads/${encodeURIComponent(threadId)}?format=full`, access.token);
    if (!ok) throw new Error(failure("Gmail", status, data));
    const messages = (data.messages as Array<{ payload?: Record<string, unknown> & { headers?: Header[] } }> | undefined) ?? [];
    return messages
      .map((message) => {
        const headers = message.payload?.headers;
        return `From: ${header(headers, "From")}\nDate: ${header(headers, "Date")}\nSubject: ${header(headers, "Subject")}\n\n${gmailText(message.payload).trim()}`;
      })
      .join("\n\n---\n\n")
      .slice(0, MAX_TEXT);
  }
  const { ok, status, data } = await call(
    `${GRAPH}/messages/${encodeURIComponent(threadId)}?$select=subject,from,toRecipients,receivedDateTime,body`,
    access.token,
    { headers: { prefer: 'outlook.body-content-type="text"' } },
  );
  if (!ok) throw new Error(failure("Outlook", status, data));
  const from = (data.from as { emailAddress?: { name?: string; address?: string } } | undefined)?.emailAddress;
  return `From: ${from?.name ?? ""} <${from?.address ?? ""}>\nDate: ${String(data.receivedDateTime ?? "")}\nSubject: ${String(data.subject ?? "")}\n\n${String((data.body as { content?: string } | undefined)?.content ?? "").trim()}`.slice(0, MAX_TEXT);
}

/** RFC 2047, so a subject in any language survives the trip. */
function encodeHeader(value: string): string {
  return /^[\x00-\x7F]*$/.test(value) ? value : `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
}

/** A reply to the last message of a Gmail thread, as the raw message Gmail stores. */
export function gmailReplyRaw(input: { to: string; subject: string; messageId: string; references: string; body: string }): string {
  const subject = /^re:/i.test(input.subject) ? input.subject : `Re: ${input.subject}`;
  const lines = [
    `To: ${input.to}`,
    `Subject: ${encodeHeader(subject)}`,
    ...(input.messageId ? [`In-Reply-To: ${input.messageId}`, `References: ${`${input.references} ${input.messageId}`.trim()}`] : []),
    "MIME-Version: 1.0",
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 8bit",
    "",
    input.body,
  ];
  return Buffer.from(lines.join("\r\n"), "utf8").toString("base64url");
}

async function gmailReplyContext(access: Access, threadId: string) {
  const { ok, status, data } = await call(
    `${GMAIL}/threads/${encodeURIComponent(threadId)}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Reply-To&metadataHeaders=Message-ID&metadataHeaders=References`,
    access.token,
  );
  if (!ok) throw new Error(failure("Gmail", status, data));
  const messages = (data.messages as Array<{ payload?: { headers?: Header[] } }> | undefined) ?? [];
  const last = messages[messages.length - 1]?.payload?.headers;
  return {
    to: header(last, "Reply-To") || header(last, "From"),
    subject: header(last, "Subject") || "(no subject)",
    messageId: header(last, "Message-ID"),
    references: header(last, "References"),
  };
}

export interface ReplyDraft {
  /** The draft in the owner's mailbox. */
  mailboxDraftId: string;
  to: string;
  subject: string;
}

/** Writes the reply as a draft in the thread, in the owner's own mailbox. Nothing is sent. */
export async function createReplyDraft(access: Access, input: { threadId: string; body: string }): Promise<ReplyDraft> {
  if (access.provider === "google") {
    const context = await gmailReplyContext(access, input.threadId);
    const { ok, status, data } = await call(`${GMAIL}/drafts`, access.token, {
      method: "POST",
      body: JSON.stringify({ message: { raw: gmailReplyRaw({ ...context, body: input.body }), threadId: input.threadId } }),
    });
    if (!ok) throw new Error(failure("Gmail", status, data));
    return { mailboxDraftId: String(data.id), to: context.to, subject: /^re:/i.test(context.subject) ? context.subject : `Re: ${context.subject}` };
  }
  const created = await call(`${GRAPH}/messages/${encodeURIComponent(input.threadId)}/createReply`, access.token, { method: "POST" });
  if (!created.ok) throw new Error(failure("Outlook", created.status, created.data));
  const id = String(created.data.id);
  const patched = await call(`${GRAPH}/messages/${id}`, access.token, {
    method: "PATCH",
    body: JSON.stringify({ body: { contentType: "Text", content: input.body } }),
  });
  if (!patched.ok) throw new Error(failure("Outlook", patched.status, patched.data));
  const to = ((created.data.toRecipients as Array<{ emailAddress?: { address?: string } }> | undefined) ?? [])
    .map((r) => r.emailAddress?.address)
    .filter(Boolean)
    .join(", ");
  return { mailboxDraftId: id, to, subject: String(created.data.subject ?? "") };
}

/**
 * Sends the approved reply: the mailbox draft, with the text as it was
 * approved (edits included). If the draft is gone - deleted in the mailbox,
 * or by a rejection that was then undone - it is written again first.
 */
export async function sendReplyDraft(
  access: Access,
  input: { mailboxDraftId: string; threadId: string; body: string },
): Promise<DeliveryResult> {
  const first = await sendExisting(access, input);
  if (first.status !== 404) return first;
  const fresh = await createReplyDraft(access, { threadId: input.threadId, body: input.body });
  return sendExisting(access, { ...input, mailboxDraftId: fresh.mailboxDraftId });
}

async function sendExisting(
  access: Access,
  input: { mailboxDraftId: string; threadId: string; body: string },
): Promise<DeliveryResult> {
  if (access.provider === "google") {
    const context = await gmailReplyContext(access, input.threadId);
    const updated = await call(`${GMAIL}/drafts/${encodeURIComponent(input.mailboxDraftId)}`, access.token, {
      method: "PUT",
      body: JSON.stringify({ id: input.mailboxDraftId, message: { raw: gmailReplyRaw({ ...context, body: input.body }), threadId: input.threadId } }),
    });
    if (!updated.ok) return { ok: false, status: updated.status, detail: failure("Gmail", updated.status, updated.data) };
    const sent = await call(`${GMAIL}/drafts/send`, access.token, { method: "POST", body: JSON.stringify({ id: input.mailboxDraftId }) });
    return sent.ok
      ? { ok: true, status: sent.status, detail: `Replied in the thread, from ${access.account}` }
      : { ok: false, status: sent.status, detail: failure("Gmail", sent.status, sent.data) };
  }
  const id = encodeURIComponent(input.mailboxDraftId);
  const patched = await call(`${GRAPH}/messages/${id}`, access.token, {
    method: "PATCH",
    body: JSON.stringify({ body: { contentType: "Text", content: input.body } }),
  });
  if (!patched.ok) return { ok: false, status: patched.status, detail: failure("Outlook", patched.status, patched.data) };
  const sent = await call(`${GRAPH}/messages/${id}/send`, access.token, { method: "POST" });
  return sent.ok
    ? { ok: true, status: sent.status, detail: `Replied in the thread, from ${access.account}` }
    : { ok: false, status: sent.status, detail: failure("Outlook", sent.status, sent.data) };
}

/** A rejected reply leaves no draft behind in the owner's mailbox. Never throws. */
export async function discardReplyDraft(access: Access, mailboxDraftId: string): Promise<void> {
  const url =
    access.provider === "google"
      ? `${GMAIL}/drafts/${encodeURIComponent(mailboxDraftId)}`
      : `${GRAPH}/messages/${encodeURIComponent(mailboxDraftId)}`;
  await call(url, access.token, { method: "DELETE" }).catch(() => undefined);
}
