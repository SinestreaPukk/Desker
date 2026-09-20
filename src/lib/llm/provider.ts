/**
 * Provider-neutral chat abstraction.
 *
 * Nothing above this module (route handlers, the agent runtime, the UI) is
 * allowed to know which vendor is answering. Swapping a single agent from
 * Claude to GPT is a change to `Agent.modelProvider` in the database and
 * nothing else - see lib/llm/anthropic.ts and lib/llm/openai.ts for the two
 * implementations that prove the seam is real.
 */
import "server-only";
import type { BillingContext } from "@/lib/usage";

// --- conversation shape -----------------------------------------------------

export interface ToolCall {
  /** Provider-assigned id; correlates a call with its result. */
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ToolResultPayload {
  id: string;
  name: string;
  content: string;
  isError?: boolean;
}

export type AssistantMessage = {
  role: "assistant";
  content: string;
  toolCalls?: ToolCall[];
};

export type ToolMessage = {
  role: "tool";
  results: ToolResultPayload[];
};

export type ChatMessage =
  | { role: "user"; content: string }
  | AssistantMessage
  | ToolMessage;

// --- tools ------------------------------------------------------------------

export interface JsonObjectSchema {
  type: "object";
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: JsonObjectSchema;
}

// --- streaming events -------------------------------------------------------

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
}

/**
 * The event stream a provider emits. `turn` and `tool_turn` carry the durable
 * conversation records the caller persists; the rest are for live rendering.
 */
export type ChatEvent =
  | { type: "text_delta"; text: string }
  | { type: "tool_call"; call: ToolCall }
  | { type: "tool_result"; result: ToolResultPayload }
  | { type: "turn"; message: AssistantMessage }
  | { type: "tool_turn"; message: ToolMessage }
  | { type: "done"; stopReason: string | null; usage: TokenUsage }
  | { type: "error"; message: string; retryable: boolean };

export interface StreamChatRequest {
  /**
   * Who pays. Every provider records the tokens of every API call against
   * this organisation, so it is required rather than optional - a call with no
   * tenant to bill is a bug, not a free call.
   */
  billing: BillingContext;
  systemPrompt: string;
  messages: ChatMessage[];
  tools: ToolDefinition[];
  /**
   * Executes one tool call and returns the string the model should see. The
   * provider owns the agentic loop (each vendor's loop mechanics differ), so it
   * calls back here rather than handing control out mid-stream.
   */
  executeTool: (call: ToolCall) => Promise<{ content: string; isError?: boolean }>;
  /** Null/undefined falls back to the provider's default model. */
  model?: string | null;
  maxTokens?: number;
  signal?: AbortSignal;
}

/**
 * One model call, no loop. The autonomous work runner owns its own loop so
 * every model turn and tool call can be a separate durable step; the chat
 * path keeps using streamChat, where the provider owns the loop instead.
 */
export interface CompleteRequest {
  billing: BillingContext;
  systemPrompt: string;
  messages: ChatMessage[];
  tools: ToolDefinition[];
  model?: string | null;
  maxTokens?: number;
}

export interface CompleteResult {
  message: AssistantMessage;
  stopReason: string | null;
  usage: TokenUsage;
}

/** Thrown by complete(); carries whether a retry could reasonably succeed. */
export class ModelError extends Error {
  constructor(
    message: string,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "ModelError";
  }
}

export interface LlmProvider {
  readonly id: string;
  readonly defaultModel: string;
  /** Requirement from the build brief §8: streamChat -> AsyncIterable<ChatEvent>. */
  streamChat(request: StreamChatRequest): AsyncIterable<ChatEvent>;
  complete(request: CompleteRequest): Promise<CompleteResult>;
}

/** Guard against a model that loops on tool calls forever and burns credits. */
export const MAX_TOOL_ITERATIONS = 8;
export const DEFAULT_MAX_TOKENS = 8192;

// --- registry ---------------------------------------------------------------

export const PROVIDER_IDS = ["anthropic", "openai"] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

export function isProviderId(value: string): value is ProviderId {
  return (PROVIDER_IDS as readonly string[]).includes(value);
}

/**
 * Lazily imported so that a deployment with only an Anthropic key never loads
 * (or needs) the OpenAI client, and vice versa.
 */
export async function getProvider(id: string): Promise<LlmProvider> {
  switch (id) {
    case "anthropic":
      return (await import("./anthropic")).anthropicProvider;
    case "openai":
      return (await import("./openai")).openaiProvider;
    default:
      throw new Error(
        `Unknown model provider "${id}". Expected one of: ${PROVIDER_IDS.join(", ")}`,
      );
  }
}
