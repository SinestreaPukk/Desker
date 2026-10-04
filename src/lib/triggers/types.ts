export type TriggerKind = "time" | "event" | "condition";
export type TriggerUrgency = "now" | "today" | "digest";
export type TriggerChannel = "line" | "app";
export type TriggerDecision = "fired" | "suppressed";

export interface TriggerRuleConfig {
  time?: string;
  cadence?: "daily" | "weekly" | "immediate";
  quietHoursStart?: string;
  quietHoursEnd?: string;
  maxPerDay?: number;
  suppressedTopics?: string[];
  daysOfWeek?: number[];
}

export interface TriggerRuleDto {
  id: string;
  projectId: string;
  name: string;
  description: string;
  kind: TriggerKind;
  config: TriggerRuleConfig;
  enabled: boolean;
  feedback?: {
    dismissedCount?: number;
    ignoredCount?: number;
    proposedAdjustment?: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface TriggerExecutionLogDto {
  id: string;
  projectId: string;
  ruleName: string;
  decision: TriggerDecision;
  reason: string;
  urgency: TriggerUrgency | null;
  channel: TriggerChannel | null;
  messageSent: string | null;
  dedupeKey: string | null;
  createdAt: string;
}
