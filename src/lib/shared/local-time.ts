/**
 * Times in the owner's own time zone, for everything an agent reads or says.
 * Stored times stay UTC; what an agent is told - "now", calendar events - is
 * in the zone its schedule runs in, with the offset written out so a time it
 * passes back to a tool means the same instant.
 *
 * Pure: no server imports, so prompts, tools and tests share it.
 */

/** The zone if the platform knows it, else UTC. */
export function validTimeZone(timeZone: string | null | undefined): string {
  if (!timeZone) return "UTC";
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone }).format(0);
    return timeZone;
  } catch {
    return "UTC";
  }
}

/** "+07:00", "-04:30" or "+00:00": the zone's offset from UTC at that moment. */
export function offsetOf(date: Date, timeZone: string): string {
  const name = new Intl.DateTimeFormat("en-GB", { timeZone, timeZoneName: "longOffset" })
    .formatToParts(date)
    .find((part) => part.type === "timeZoneName")?.value;
  const match = name?.match(/GMT([+-]\d{2}):?(\d{2})?/);
  return match ? `${match[1]}:${match[2] ?? "00"}` : "+00:00";
}

function parts(date: Date, timeZone: string) {
  const values = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value]),
  );
  return values as Record<"year" | "month" | "day" | "hour" | "minute", string>;
}

/** 2026-10-05T09:00+07:00 - the local wall-clock time with its offset: exact, and what a tool expects. */
export function localIso(value: Date | string, timeZone: string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return String(value);
  const p = parts(date, timeZone);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}${offsetOf(date, timeZone)}`;
}

/** "Tuesday 30 September 2026, 20:45" in the zone. */
function localLong(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .format(date)
    .replace(" at ", ", ");
}

/** What every agent is told about time: now, in the owner's zone, and how to write times. */
export function timeNote(now: Date, zone: string | null | undefined): string {
  const timeZone = validTimeZone(zone);
  const offset = offsetOf(now, timeZone);
  return `## Time
It is now ${localLong(now, timeZone)} where the owner is (${timeZone}, UTC${offset}). Say every date and time in that zone - "Monday 09:00", never UTC - and work out "today", "this week" and "next week" from it. When you give a time to a tool, write it in ISO 8601 with that offset, e.g. ${localIso(now, timeZone)}.`;
}
