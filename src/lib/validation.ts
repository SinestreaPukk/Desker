/**
 * Request schemas shared between route handlers and the forms that post to them,
 * so client-side validation cannot drift from what the server enforces.
 */
import { z } from "zod";
import { MAX_AVATAR_DATA_URI_LENGTH } from "@/lib/avatars";
import { PROVIDER_IDS } from "@/lib/llm/provider";
import { TOOL_IDS } from "@/lib/tools/registry";

export const agentInputSchema = z.object({
  name: z.string().trim().min(1, "Give your agent a name.").max(80),
  jobTitle: z.string().trim().min(1, "A job title tells the agent what it does.").max(120),
  department: z.string().trim().max(120).optional().or(z.literal("")),
  // Built-in avatars are short keys; uploaded ones are data URIs up to
  // MAX_AVATAR_DATA_URI_LENGTH, which the picker already enforces client-side.
  avatarUrl: z.string().trim().max(MAX_AVATAR_DATA_URI_LENGTH).optional().or(z.literal("")),
  personality: z
    .string()
    .trim()
    .min(10, "Describe the personality in at least a sentence.")
    .max(4000),
  responsibilities: z.array(z.string().trim().min(1).max(300)).max(25).default([]),
  allowedTools: z.array(z.enum(TOOL_IDS)).default([]),
  escalationRule: z.string().trim().max(1000).optional().or(z.literal("")),
  welcomeMessage: z.string().trim().max(500).optional().or(z.literal("")),
  status: z.enum(["draft", "published"]).default("draft"),
  modelProvider: z.enum(PROVIDER_IDS).default("anthropic"),
  model: z.string().trim().max(120).optional().or(z.literal("")),
  publicPasscode: z.string().trim().max(64).optional().or(z.literal("")),
  widgetLabel: z.string().trim().max(60).optional().or(z.literal("")),
  widgetColor: z
    .string()
    .trim()
    .regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #1800AD.")
    .optional()
    .or(z.literal("")),
  widgetSide: z.enum(["right", "left"]).optional(),
});

export type AgentInput = z.infer<typeof agentInputSchema>;

export const signupSchema = z
  .object({
    name: z.string().trim().max(120).optional(),
    email: z.string().trim().toLowerCase().email("Enter a valid email address."),
    password: z
      .string()
      .min(8, "Use at least 8 characters.")
      .max(200, "That password is too long."),
  })
  .strict();

export const chatRequestSchema = z.object({
  agentId: z.string().min(1),
  sessionId: z.string().min(8).max(128),
  message: z.string().trim().min(1, "Type a message first.").max(8000),
  passcode: z.string().max(64).optional(),
});

export const previewRequestSchema = z.object({
  agentId: z.string().min(1),
  message: z.string().trim().min(1).max(8000),
  /** Preview conversations are ephemeral and keyed by a per-tab id. */
  previewId: z.string().min(8).max(128),
});

export const issuePatchSchema = z.object({
  status: z.enum(["open", "resolved"]),
});

export const conversationPatchSchema = z.object({
  status: z.enum(["open", "escalated", "resolved"]),
});
