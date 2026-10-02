/**
 * Request schemas shared between route handlers and the forms that post to them,
 * so client-side validation cannot drift from what the server enforces.
 */
import { z } from "zod";
import { MAX_AVATAR_DATA_URI_LENGTH } from "@/lib/avatars";
import { PROVIDER_IDS } from "@/lib/llm/provider";
import { TOOL_IDS } from "@/lib/tools/registry";

export const agentInputSchema = z.object({
  name: z.string().trim().min(1, "Give your agent a name.").max(80, "Keep the name under 80 characters."),
  jobTitle: z
    .string()
    .trim()
    .min(1, "A job title tells the agent what it does.")
    .max(120, "Keep the job title under 120 characters."),
  department: z.string().trim().max(120, "Keep the team name under 120 characters.").optional().or(z.literal("")),
  /** The role template it was hired from; set once, by the hire wizard. */
  templateId: z.string().trim().max(64).regex(/^[a-z0-9-]*$/).optional(),
  // Built-in avatars are short keys; uploaded ones are data URIs up to
  // MAX_AVATAR_DATA_URI_LENGTH, which the picker already enforces client-side.
  avatarUrl: z.string().trim().max(MAX_AVATAR_DATA_URI_LENGTH).optional().or(z.literal("")),
  // Optional: a role brings its own voice, and anything else gets a plain default.
  personality: z
    .string()
    .trim()
    .max(4000, "That is more personality than the agent can read. Keep it under 4,000 characters.")
    .optional()
    .or(z.literal("")),
  responsibilities: z
    .array(z.string().trim().min(1).max(300, "Keep each responsibility to a line."))
    .max(25, "Twenty-five responsibilities is plenty; fewer and clearer works better.")
    .default([]),
  allowedTools: z.array(z.enum(TOOL_IDS)).default([]),
  escalationRule: z
    .string()
    .trim()
    .max(1000, "Keep the rule to a sentence or two - under 1,000 characters.")
    .optional()
    .or(z.literal("")),
  welcomeMessage: z
    .string()
    .trim()
    .max(500, "An opening line under 500 characters reads better.")
    .optional()
    .or(z.literal("")),
  status: z.enum(["draft", "published"]).default("draft"),
  modelProvider: z.enum(PROVIDER_IDS).default("anthropic"),
  model: z.string().trim().max(120).optional().or(z.literal("")),
});

export type AgentInput = z.infer<typeof agentInputSchema>;

/** One rule for every password Desker sets: sign-up and reset. */
export const passwordRule = z.string().min(8, "Use at least 8 characters.").max(200, "That password is too long.");

export const passwordResetRequestSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
});

export const passwordResetSchema = z.object({
  token: z.string().trim().min(20).max(200),
  password: passwordRule,
});

export const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,29}$/;

export const signupSchema = z
  .object({
    firstName: z.string().trim().min(1, "Enter your first name.").max(60, "That first name is too long."),
    lastName: z.string().trim().min(1, "Enter your last name.").max(60, "That last name is too long."),
    username: z
      .string()
      .trim()
      .toLowerCase()
      .regex(USERNAME_PATTERN, "Use 3-30 letters, numbers, dots, dashes or underscores, starting with a letter or number."),
    email: z.string().trim().toLowerCase().email("Enter a valid email address."),
    password: passwordRule,
    /** An invitation token; joins that organisation instead of creating one. */
    invite: z.string().trim().max(200).optional(),
    /** The consent step. Recorded with the terms version on the user. */
    acceptTerms: z.literal(true, {
      message: "Accept the Terms of Service and Privacy Policy to create an account.",
    }),
    /** The bot checks (lib/bot-check.ts), read by the route before this schema. */
    website: z.string().max(200).optional(),
    startedAt: z.number().optional(),
  })
  .strict();

export const previewRequestSchema = z.object({
  agentId: z.string().min(1),
  message: z.string().trim().min(1).max(8000),
  /** Preview conversations are ephemeral and keyed by a per-tab id. */
  previewId: z.string().min(8).max(128),
});

export const issuePatchSchema = z.object({
  status: z.enum(["open", "resolved"]),
});
