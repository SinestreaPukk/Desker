/**
 * A customer message, as whatever sent it wrote it: a helpdesk webhook, a
 * website form, a Zapier or Make zap. Field names differ everywhere, so the
 * common spellings are accepted; the email address and the message are the
 * two that have to be there.
 *
 * Pure: the intake route and the tests read the same parser.
 */

export interface Ticket {
  email: string;
  name: string | null;
  subject: string | null;
  message: string;
  /** The sender's own id for it, echoed back when it is answered. */
  ticketId: string | null;
}

const EMAIL = /^[^@\s<>]+@[^@\s<>]+\.[^@\s<>]+$/;

function pick(source: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = source[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  return null;
}

/** "Jo Bloggs <jo@example.com>" -> jo@example.com, and the name. */
function splitAddress(raw: string | null): { email: string | null; name: string | null } {
  if (!raw) return { email: null, name: null };
  const angled = raw.match(/^\s*"?([^"<]*)"?\s*<([^>]+)>\s*$/);
  if (angled) return { email: angled[2]!.trim(), name: angled[1]!.trim() || null };
  return { email: raw.trim(), name: null };
}

export function parseTicket(input: unknown): { ticket: Ticket } | { error: string } {
  if (!input || typeof input !== "object" || Array.isArray(input)) return { error: "Send the message as a JSON object or a form." };
  const flat = input as Record<string, unknown>;
  // Some senders wrap it: { ticket: {...} } or { data: {...} }.
  const source = (["ticket", "data", "message"].map((key) => flat[key]).find((v) => v && typeof v === "object" && !Array.isArray(v)) ??
    flat) as Record<string, unknown>;

  const address = splitAddress(pick(source, ["email", "from", "from_email", "customer_email", "requester_email", "sender", "reply_to"]));
  const email = address.email?.toLowerCase() ?? null;
  const message = pick(source, ["message", "body", "text", "description", "content", "plain", "body_plain", "question"]);
  if (!email || !EMAIL.test(email)) return { error: "Include the customer's email address (as email or from)." };
  if (!message) return { error: "Include the customer's message (as message or body)." };

  return {
    ticket: {
      email,
      name: pick(source, ["name", "from_name", "customer_name", "requester_name"]) ?? address.name,
      subject: pick(source, ["subject", "title"]),
      message: message.slice(0, 6000),
      ticketId: pick(source, ["id", "ticket_id", "ticketId", "message_id", "conversation_id"])?.slice(0, 200) ?? null,
    },
  };
}

/** The ticket as the Support agent reads it. */
export function ticketText(ticket: Ticket): string {
  return [
    `From: ${ticket.name ? `${ticket.name} <${ticket.email}>` : ticket.email}`,
    ticket.subject ? `Subject: ${ticket.subject}` : null,
    "",
    ticket.message,
    "",
    `Reply by email to ${ticket.email}.`,
  ]
    .filter((line) => line !== null)
    .join("\n");
}
