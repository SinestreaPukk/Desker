/** Request schemas for scope-of-work and integration routes. Shared with the forms. */
import { z } from "zod";
import {
  AUTONOMY_MODES,
  DIGEST_CADENCES,
  INTEGRATION_TYPES,
  SUGGESTION_STATUSES,
  TRIGGER_TYPES,
} from "./types";
import { WORK_TOOL_IDS } from "./tools";
import { MAX_CONTEXT_ANSWER } from "./context";

/**
 * The guided context answers: { questionId: answer }. Unknown ids are dropped
 * server-side when the answers are composed, so the schema only has to keep
 * the shape and the size sane.
 */
export const contextAnswersSchema = z
  .record(z.string().min(1).max(64), z.string().trim().max(MAX_CONTEXT_ANSWER))
  .default({});

export const scopeInputSchema = z.object({
  /** Legacy callers may still send the composed string; the answers win. */
  context: z.string().trim().max(20_000, "That is more context than a run can read. Trim it below 20,000 characters.").default(""),
  contextAnswers: contextAnswersSchema.optional(),
  objectives: z
    .array(z.string().trim().min(1).max(500, "Keep each objective to a line - under 500 characters."))
    .max(20, "Twenty objectives is more than one run can do well. Split them across agents.")
    .default([]),
  documentIds: z.array(z.string().min(1)).max(200).default([]),
  triggerType: z.enum(TRIGGER_TYPES).default("manual"),
  cron: z.string().trim().max(100, "That is not a schedule we can read.").nullable().default(null),
  timezone: z
    .string()
    .trim()
    .min(1, "Pick a time zone so the schedule runs when you expect.")
    .max(64, "That is not a time zone name we recognise.")
    .default("UTC"),
  enabled: z.boolean().default(true),
  autonomy: z.enum(AUTONOMY_MODES).default("draft_only"),
  toolAutonomy: z
    .object({
      publish_post: z.enum(AUTONOMY_MODES).optional(),
      send_email: z.enum(AUTONOMY_MODES).optional(),
      calendar_create_event: z.enum(AUTONOMY_MODES).optional(),
      slack_post_message: z.enum(AUTONOMY_MODES).optional(),
    })
    .nullable()
    .default(null),
  /** Null means every tool; an array is the allowlist, empty included. */
  tools: z.array(z.enum(WORK_TOOL_IDS)).max(WORK_TOOL_IDS.length).nullable().default(null),
  /** How often the agent reports on itself, unasked. */
  digestCadence: z.enum(DIGEST_CADENCES).default("weekly"),
  digestEmail: z.boolean().default(false),
  /** Comma-separated. Empty means the organisation's owners and admins. */
  digestRecipients: z
    .string()
    .trim()
    .max(500, "That is too many addresses for one update.")
    .default(""),
});
export type ScopeInputPayload = z.infer<typeof scopeInputSchema>;

export const draftPatchSchema = z.object({
  title: z.string().trim().min(1, "A draft needs a title.").max(200, "Keep the title under 200 characters.").optional(),
  body: z
    .string()
    .trim()
    .min(1, "There is nothing to send - write something first.")
    .max(60_000, "That draft is too long to send.")
    .optional(),
  /** Email only. */
  to: z.string().trim().max(1000, "That is more recipients than one email should have.").optional(),
});

export const integrationInputSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal(INTEGRATION_TYPES[0]),
    name: z.string().trim().min(1, "Give this connection a name you will recognise.").max(80, "Keep the name under 80 characters."),
    url: z
      .string()
      .trim()
      .url("That does not look like a web address. Paste the full URL, starting with https://.")
      .max(2000, "That address is too long.")
      .refine((u) => /^https?:\/\//.test(u), "The address has to start with https:// (or http:// for a local test)."),
    secret: z.string().trim().max(200, "A signing secret of up to 200 characters.").optional().or(z.literal("")),
    platform: z.string().trim().max(40, "Keep the platform name short.").optional().or(z.literal("")),
  }),
  z.object({
    type: z.literal(INTEGRATION_TYPES[1]),
    name: z.string().trim().min(1, "Give this connection a name you will recognise.").max(80, "Keep the name under 80 characters."),
    from: z
      .string()
      .trim()
      .min(3, "Add the address emails should come from.")
      .max(200, "That from-address is too long."),
    apiKey: z
      .string()
      .trim()
      .min(1, "Paste the API key from your Resend account.")
      .max(200, "That does not look like a Resend key."),
  }),
]);
export type IntegrationInputPayload = z.infer<typeof integrationInputSchema>;

export const rejectSchema = z.object({
  reason: z.string().trim().max(500, "Keep the reason to a couple of sentences.").optional().or(z.literal("")),
});

export const digestPatchSchema = z.object({
  /** Marking it read is the only edit a digest takes. */
  read: z.boolean(),
});

export const suggestionPatchSchema = z
  .object({
    status: z.enum(SUGGESTION_STATUSES),
    /** Snooze only. Defaults to a week. */
    snoozeDays: z.number().int().min(1).max(90).optional(),
  })
  .refine((value) => value.status === "snoozed" || value.snoozeDays === undefined, {
    message: "A snooze length only applies when snoozing.",
    path: ["snoozeDays"],
  });

export const projectContextSchema = z.object({
  answers: contextAnswersSchema,
});
