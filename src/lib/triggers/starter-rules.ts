import type { TriggerKind, TriggerRuleConfig } from "./types";

export interface StarterRuleDefinition {
  name: string;
  description: string;
  kind: TriggerKind;
  config: TriggerRuleConfig;
}

export const STARTER_TRIGGER_RULES: StarterRuleDefinition[] = [
  {
    name: "morning_brief",
    description: "Morning brief with today's events, bills, and what is due at 07:30",
    kind: "time",
    config: {
      time: "07:30",
      cadence: "daily",
      quietHoursStart: "22:00",
      quietHoursEnd: "07:00",
      maxPerDay: 5,
    },
  },
  {
    name: "conflict_alert",
    description: "Heads-up before a calendar clash or tight schedule day",
    kind: "condition",
    config: {
      cadence: "immediate",
      quietHoursStart: "22:00",
      quietHoursEnd: "07:00",
      maxPerDay: 5,
    },
  },
  {
    name: "due_soon_alert",
    description: "Due-soon alerts for bills and open commitments",
    kind: "condition",
    config: {
      cadence: "daily",
      quietHoursStart: "22:00",
      quietHoursEnd: "07:00",
      maxPerDay: 5,
    },
  },
  {
    name: "weekly_digest",
    description: "Weekly digest of cross-domain trade-offs and suggestions on Sunday evening",
    kind: "time",
    config: {
      time: "18:00",
      cadence: "weekly",
      daysOfWeek: [0], // Sunday
      quietHoursStart: "22:00",
      quietHoursEnd: "07:00",
      maxPerDay: 5,
    },
  },
  {
    name: "waiting_on_late",
    description: "Prompt when a waiting-on commitment from another person goes late",
    kind: "condition",
    config: {
      cadence: "immediate",
      quietHoursStart: "22:00",
      quietHoursEnd: "07:00",
      maxPerDay: 5,
    },
  },
];
