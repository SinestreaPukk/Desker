/**
 * Cron for people. The scope-of-work form offers a handful of cadences and
 * stores a five-field cron expression; this converts in both directions so the
 * form can reopen on what was saved.
 */

export const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

export type Cadence =
  | { kind: "hourly" }
  | { kind: "daily"; hour: number; minute: number }
  | { kind: "weekdays"; hour: number; minute: number }
  | { kind: "weekly"; weekday: number; hour: number; minute: number }
  | { kind: "custom"; cron: string };

export function cadenceToCron(cadence: Cadence): string {
  switch (cadence.kind) {
    case "hourly":
      return "0 * * * *";
    case "daily":
      return `${cadence.minute} ${cadence.hour} * * *`;
    case "weekdays":
      return `${cadence.minute} ${cadence.hour} * * 1-5`;
    case "weekly":
      return `${cadence.minute} ${cadence.hour} * * ${cadence.weekday}`;
    case "custom":
      return cadence.cron.trim();
  }
}

export function cronToCadence(cron: string | null | undefined): Cadence {
  const fields = (cron ?? "").trim().split(/\s+/);
  if (fields.length !== 5) return { kind: "daily", hour: 9, minute: 0 };
  const [m, h, dom, mon, dow] = fields as [string, string, string, string, string];
  const minute = Number(m);
  const hour = Number(h);
  const simpleTime = Number.isInteger(minute) && Number.isInteger(hour);
  if (cron === "0 * * * *") return { kind: "hourly" };
  if (simpleTime && dom === "*" && mon === "*") {
    if (dow === "*") return { kind: "daily", hour, minute };
    if (dow === "1-5") return { kind: "weekdays", hour, minute };
    if (/^[0-6]$/.test(dow)) return { kind: "weekly", weekday: Number(dow), hour, minute };
  }
  return { kind: "custom", cron: cron! };
}

function clock(hour: number, minute: number): string {
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** "Every Monday at 09:00 (Europe/London)". */
export function describeCadence(cron: string | null | undefined, timezone?: string): string {
  const cadence = cronToCadence(cron);
  const tz = timezone && timezone !== "UTC" ? ` (${timezone})` : timezone === "UTC" ? " (UTC)" : "";
  switch (cadence.kind) {
    case "hourly":
      return "Every hour, on the hour";
    case "daily":
      return `Every day at ${clock(cadence.hour, cadence.minute)}${tz}`;
    case "weekdays":
      return `Weekdays at ${clock(cadence.hour, cadence.minute)}${tz}`;
    case "weekly":
      return `Every ${WEEKDAYS[cadence.weekday]} at ${clock(cadence.hour, cadence.minute)}${tz}`;
    case "custom":
      return `Cron "${cadence.cron}"${tz}`;
  }
}
