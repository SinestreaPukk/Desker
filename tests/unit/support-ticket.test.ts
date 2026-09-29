import { describe, expect, it } from "vitest";
import { parseTicket, ticketText } from "@/lib/work/support-ticket";

describe("a customer message from a helpdesk or form", () => {
  it("reads the common field names, including a named From header", () => {
    const result = parseTicket({ from: "Jo Bloggs <Jo@Example.com>", subject: "Returns", body: "Can I return it after 40 days?", ticket_id: 42 });
    expect(result).toEqual({
      ticket: { email: "jo@example.com", name: "Jo Bloggs", subject: "Returns", message: "Can I return it after 40 days?", ticketId: "42" },
    });
  });

  it("unwraps senders that nest the ticket", () => {
    const result = parseTicket({ ticket: { requester_email: "a@b.co", description: "Help" } });
    expect("ticket" in result && result.ticket.email).toBe("a@b.co");
  });

  it("says what is missing instead of guessing", () => {
    expect(parseTicket({ message: "Hello" })).toEqual({ error: expect.stringMatching(/email address/) });
    expect(parseTicket({ email: "a@b.co" })).toEqual({ error: expect.stringMatching(/message/) });
    expect(parseTicket("nope")).toEqual({ error: expect.any(String) });
  });

  it("tells the agent who to reply to", () => {
    const result = parseTicket({ email: "a@b.co", message: "Where is my order?" });
    expect("ticket" in result && ticketText(result.ticket)).toContain("Reply by email to a@b.co.");
  });
});
