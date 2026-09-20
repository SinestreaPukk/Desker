/** Request schemas for scope-of-work and integration routes. Shared with the forms. */
import { z } from "zod";
import { AUTONOMY_MODES, INTEGRATION_TYPES, TRIGGER_TYPES } from "./types";

export const scopeInputSchema = z.object({
  context: z.string().trim().max(20_000).default(""),
  objectives: z.array(z.string().trim().min(1).max(500)).max(20).default([]),
  documentIds: z.array(z.string().min(1)).max(200).default([]),
  triggerType: z.enum(TRIGGER_TYPES).default("manual"),
  cron: z.string().trim().max(100).nullable().default(null),
  timezone: z.string().trim().min(1).max(64).default("UTC"),
  enabled: z.boolean().default(true),
  autonomy: z.enum(AUTONOMY_MODES).default("draft_only"),
});
export type ScopeInputPayload = z.infer<typeof scopeInputSchema>;

export const integrationInputSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal(INTEGRATION_TYPES[0]),
    name: z.string().trim().min(1).max(80),
    url: z.string().trim().url().max(2000).refine((u) => /^https?:\/\//.test(u), "Must be an http(s) URL."),
    secret: z.string().trim().max(200).optional().or(z.literal("")),
  }),
  z.object({
    type: z.literal(INTEGRATION_TYPES[1]),
    name: z.string().trim().min(1).max(80),
    from: z.string().trim().min(3).max(200),
    apiKey: z.string().trim().min(1).max(200),
  }),
]);
export type IntegrationInputPayload = z.infer<typeof integrationInputSchema>;

export const rejectSchema = z.object({
  reason: z.string().trim().max(500).optional().or(z.literal("")),
});
