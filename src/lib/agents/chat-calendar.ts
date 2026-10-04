/**
 * Reading the calendar from a chat - the owner's own chat with their agent
 * only, never a client's. An agent whose runs may check the calendar can
 * look at it when asked in conversation too; anything that would change the
 * calendar still goes through a run, where it waits for approval.
 */
import "server-only";
import { z } from "zod";
import type { ToolDefinition } from "@/lib/llm/provider";
import { calendarAccess, describeEvents, listEvents } from "@/lib/integrations/mail-calendar";
import { localTimeZone } from "@/lib/shared/local-time";

export const CHECK_CALENDAR: ToolDefinition = {
  name: "check_calendar",
  description:
    "Read the events on the owner's connected calendar (Google or Outlook) between two times - to answer questions about their schedule or plan their week. Read-only: it cannot add, move or delete anything. Defaults to the next 7 days.",
  inputSchema: {
    type: "object",
    properties: {
      from: { type: "string", description: "Start, ISO 8601 with a time zone offset. Defaults to now." },
      to: { type: "string", description: "End, ISO 8601 with a time zone offset. At most 31 days after the start." },
    },
    additionalProperties: false,
  },
};

const iso = z.string().trim().refine((value) => !Number.isNaN(Date.parse(value)), "an ISO 8601 date-time").optional();
const inputSchema = z.object({ from: iso, to: iso });

export const CALENDAR_CHAT_NOTE = `## Your calendar in this chat
You can read the owner's calendar here with check_calendar - use it whenever they ask about their schedule, their week or a free slot; never say you have no calendar access. You cannot change the calendar from this chat: to add or move an event, say that it goes through a run (their weekly plan, or Run now on your page), where the change waits for their approval.`;

export async function checkCalendar(
  organizationId: string,
  input: unknown,
  timeZone = localTimeZone(),
): Promise<{ content: string; isError?: boolean }> {
  const parsed = inputSchema.safeParse(input ?? {});
  if (!parsed.success) return { content: "from and to must be ISO 8601 date-times.", isError: true };
  const from = parsed.data.from ? new Date(parsed.data.from) : new Date();
  const to = parsed.data.to ? new Date(parsed.data.to) : new Date(from.getTime() + 7 * 86_400_000);
  if (to <= from || to.getTime() - from.getTime() > 31 * 86_400_000) {
    return { content: "The window must run forwards and be at most 31 days.", isError: true };
  }
  const access = await calendarAccess(organizationId);
  if (!access) {
    return {
      content: "No calendar is connected in this space. Tell the owner to connect Google Calendar or Outlook under Integrations.",
      isError: true,
    };
  }
  const events = await listEvents(access, { from: from.toISOString(), to: to.toISOString() });
  return { content: `${access.account ? `Calendar: ${access.account}. ` : ""}${describeEvents(events, timeZone)}` };
}
