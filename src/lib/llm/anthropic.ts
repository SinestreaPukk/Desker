/**
 * Claude implementation of the LlmProvider seam.
 *
 * Uses the manual streaming agentic loop (`client.messages.stream()` +
 * `finalMessage()`) rather than the beta tool runner: the runner owns the loop
 * and would have to be re-wrapped to emit provider-neutral ChatEvents anyway,
 * and the manual loop keeps `pause_turn` handling explicit.
 */
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";
import { recordTokenUsage } from "@/lib/usage";
import {
  DEFAULT_MAX_TOKENS,
  MAX_TOOL_ITERATIONS,
  ModelError,
  type AssistantMessage,
  type ChatEvent,
  type ChatMessage,
  type CompleteRequest,
  type CompleteResult,
  type LlmProvider,
  type StreamChatRequest,
  type ToolCall,
  type ToolMessage,
} from "./provider";

let client: Anthropic | null = null;
function getClient(): Anthropic {
  client ??= new Anthropic({
    apiKey: env.anthropicApiKey,
    // An organisation-level key must name the workspace on every request.
    // Workspace-scoped keys carry it implicitly, so the header is omitted.
    ...(env.anthropicWorkspaceId
      ? { defaultHeaders: { "anthropic-workspace-id": env.anthropicWorkspaceId } }
      : {}),
  });
  return client;
}

/** Neutral conversation -> Anthropic wire format. */
function toAnthropicMessages(messages: ChatMessage[]): Anthropic.MessageParam[] {
  const out: Anthropic.MessageParam[] = [];

  for (const message of messages) {
    if (message.role === "user") {
      out.push({ role: "user", content: message.content });
      continue;
    }

    if (message.role === "assistant") {
      const blocks: Anthropic.ContentBlockParam[] = [];
      if (message.content.trim()) {
        blocks.push({ type: "text", text: message.content });
      }
      for (const call of message.toolCalls ?? []) {
        blocks.push({
          type: "tool_use",
          id: call.id,
          name: call.name,
          input: call.input,
        });
      }
      // An assistant turn with no content at all is not a valid message.
      if (blocks.length > 0) out.push({ role: "assistant", content: blocks });
      continue;
    }

    // Tool results are sent back as a single user message - splitting them
    // across messages teaches the model to stop making parallel calls.
    out.push({
      role: "user",
      content: message.results.map(
        (result): Anthropic.ToolResultBlockParam => ({
          type: "tool_result",
          tool_use_id: result.id,
          content: result.content,
          ...(result.isError ? { is_error: true } : {}),
        }),
      ),
    });
  }

  return out;
}

function toAnthropicTools(tools: StreamChatRequest["tools"]): Anthropic.Tool[] {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema as Anthropic.Tool.InputSchema,
  }));
}

function describeError(error: unknown): { message: string; retryable: boolean } {
  if (error instanceof Anthropic.AuthenticationError) {
    return {
      message:
        "The Anthropic API key was rejected. Check ANTHROPIC_API_KEY in your environment.",
      retryable: false,
    };
  }
  if (error instanceof Anthropic.RateLimitError) {
    return {
      message: "Rate limited by the Anthropic API. Try again in a moment.",
      retryable: true,
    };
  }
  if (error instanceof Anthropic.APIConnectionError) {
    return {
      message: "Could not reach the Anthropic API. Check your network connection.",
      retryable: true,
    };
  }
  if (error instanceof Anthropic.APIUserAbortError) {
    return { message: "Generation cancelled.", retryable: false };
  }
  if (error instanceof Anthropic.APIError) {
    const status = error.status ?? 0;
    return {
      message: `Anthropic API error (${status || "unknown"}): ${error.message}`,
      retryable: status === 0 || status >= 500,
    };
  }
  if (error instanceof Error && error.name === "AbortError") {
    return { message: "Generation cancelled.", retryable: false };
  }
  return {
    message: error instanceof Error ? error.message : "Unknown model error.",
    retryable: true,
  };
}

async function* streamChat(request: StreamChatRequest): AsyncIterable<ChatEvent> {
  const {
    billing,
    systemPrompt,
    tools,
    executeTool,
    model,
    maxTokens = DEFAULT_MAX_TOKENS,
    signal,
  } = request;

  const resolvedModel = model || env.anthropicDefaultModel;
  const messages = toAnthropicMessages(request.messages);
  const anthropicTools = toAnthropicTools(tools);
  const usage = { inputTokens: 0, outputTokens: 0 };

  try {
    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
      const stream = getClient().messages.stream(
        {
          model: resolvedModel,
          max_tokens: maxTokens,
          system: systemPrompt,
          messages,
          ...(anthropicTools.length > 0 ? { tools: anthropicTools } : {}),
        },
        { signal },
      );

      for await (const event of stream) {
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          yield { type: "text_delta", text: event.delta.text };
        }
      }

      const final = await stream.finalMessage();
      usage.inputTokens += final.usage.input_tokens ?? 0;
      usage.outputTokens += final.usage.output_tokens ?? 0;

      // Metered per API call, not per turn: a tool loop that dies halfway has
      // still spent every token up to that point.
      await recordTokenUsage({
        ...billing,
        provider: "anthropic",
        model: final.model || resolvedModel,
        inputTokens: final.usage.input_tokens ?? 0,
        outputTokens: final.usage.output_tokens ?? 0,
      });

      // `stop_details` is populated only for refusals - always guard.
      if (final.stop_reason === "refusal") {
        yield {
          type: "error",
          message:
            "The model declined to answer this request. Try rephrasing, or escalate to a human.",
          retryable: false,
        };
        return;
      }

      const text = final.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("");

      const toolUses = final.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
      );

      const assistantTurn: AssistantMessage = {
        role: "assistant",
        content: text,
        ...(toolUses.length > 0
          ? {
              toolCalls: toolUses.map(
                (block): ToolCall => ({
                  id: block.id,
                  name: block.name,
                  // Tool inputs must be read as parsed JSON, never string-matched.
                  input: (block.input ?? {}) as Record<string, unknown>,
                }),
              ),
            }
          : {}),
      };

      messages.push({ role: "assistant", content: final.content });
      yield { type: "turn", message: assistantTurn };

      if (toolUses.length === 0) {
        yield { type: "done", stopReason: final.stop_reason, usage };
        return;
      }

      for (const call of assistantTurn.toolCalls!) {
        yield { type: "tool_call", call };
      }

      // Parallel tool calls run concurrently and all results go back together.
      const results = await Promise.all(
        assistantTurn.toolCalls!.map(async (call) => {
          const outcome = await executeTool(call);
          return {
            id: call.id,
            name: call.name,
            content: outcome.content,
            ...(outcome.isError ? { isError: true } : {}),
          };
        }),
      );

      for (const result of results) yield { type: "tool_result", result };

      const toolTurn: ToolMessage = { role: "tool", results };
      yield { type: "tool_turn", message: toolTurn };

      messages.push({
        role: "user",
        content: results.map(
          (result): Anthropic.ToolResultBlockParam => ({
            type: "tool_result",
            tool_use_id: result.id,
            content: result.content,
            ...(result.isError ? { is_error: true } : {}),
          }),
        ),
      });
    }

    yield {
      type: "error",
      message: `The agent made more than ${MAX_TOOL_ITERATIONS} tool calls without finishing. Stopped to avoid a loop.`,
      retryable: false,
    };
  } catch (error) {
    const described = describeError(error);
    yield { type: "error", ...described };
  }
}

/** A single non-streaming turn. Tool calls come back for the caller to run. */
async function complete(request: CompleteRequest): Promise<CompleteResult> {
  const resolvedModel = request.model || env.anthropicDefaultModel;
  const anthropicTools = toAnthropicTools(request.tools);

  let final: Anthropic.Message;
  try {
    final = await getClient().messages.create({
      model: resolvedModel,
      max_tokens: request.maxTokens ?? DEFAULT_MAX_TOKENS,
      system: request.systemPrompt,
      messages: toAnthropicMessages(request.messages),
      ...(anthropicTools.length > 0 ? { tools: anthropicTools } : {}),
    });
  } catch (error) {
    const described = describeError(error);
    throw new ModelError(described.message, described.retryable);
  }

  const usage = {
    inputTokens: final.usage.input_tokens ?? 0,
    outputTokens: final.usage.output_tokens ?? 0,
  };
  await recordTokenUsage({
    ...request.billing,
    provider: "anthropic",
    model: final.model || resolvedModel,
    ...usage,
  });

  if (final.stop_reason === "refusal") {
    throw new ModelError("The model declined to carry out this request.", false);
  }

  const text = final.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("");
  const toolUses = final.content.filter(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
  );

  return {
    message: {
      role: "assistant",
      content: text,
      ...(toolUses.length > 0
        ? {
            toolCalls: toolUses.map(
              (block): ToolCall => ({
                id: block.id,
                name: block.name,
                input: (block.input ?? {}) as Record<string, unknown>,
              }),
            ),
          }
        : {}),
    },
    stopReason: final.stop_reason,
    usage,
  };
}

export const anthropicProvider: LlmProvider = {
  id: "anthropic",
  get defaultModel() {
    return env.anthropicDefaultModel;
  },
  streamChat,
  complete,
};
