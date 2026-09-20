/**
 * OpenAI implementation of the same seam.
 *
 * This exists to keep lib/llm/provider.ts honest: if the abstraction only ever
 * had one implementation it would inevitably drift into an Anthropic-shaped
 * interface. Feature parity with the Claude path is deliberately not a goal -
 * the tool loop, streaming, and error mapping are real, extended thinking and
 * provider-specific extras are not.
 */
import "server-only";
import OpenAI from "openai";
import { env } from "@/lib/env";
import { recordTokenUsage } from "@/lib/usage";
import {
  DEFAULT_MAX_TOKENS,
  MAX_TOOL_ITERATIONS,
  type AssistantMessage,
  type ChatEvent,
  type ChatMessage,
  type LlmProvider,
  type StreamChatRequest,
  type ToolCall,
  type ToolMessage,
} from "./provider";

let client: OpenAI | null = null;
function getClient(): OpenAI {
  client ??= new OpenAI({ apiKey: env.openaiApiKey });
  return client;
}

type ChatParam = OpenAI.Chat.Completions.ChatCompletionMessageParam;

function toOpenAiMessages(systemPrompt: string, messages: ChatMessage[]): ChatParam[] {
  const out: ChatParam[] = [{ role: "system", content: systemPrompt }];

  for (const message of messages) {
    if (message.role === "user") {
      out.push({ role: "user", content: message.content });
      continue;
    }

    if (message.role === "assistant") {
      out.push({
        role: "assistant",
        content: message.content || null,
        ...(message.toolCalls?.length
          ? {
              tool_calls: message.toolCalls.map((call) => ({
                id: call.id,
                type: "function" as const,
                function: {
                  name: call.name,
                  arguments: JSON.stringify(call.input),
                },
              })),
            }
          : {}),
      });
      continue;
    }

    // OpenAI wants one `tool` message per result, unlike Anthropic's single
    // user message carrying every tool_result block.
    for (const result of message.results) {
      out.push({
        role: "tool",
        tool_call_id: result.id,
        content: result.content,
      });
    }
  }

  return out;
}

function toOpenAiTools(
  tools: StreamChatRequest["tools"],
): OpenAI.Chat.Completions.ChatCompletionTool[] {
  return tools.map((tool) => ({
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema as unknown as Record<string, unknown>,
    },
  }));
}

function safeParseArguments(raw: string): Record<string, unknown> {
  if (!raw.trim()) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function describeError(error: unknown): { message: string; retryable: boolean } {
  if (error instanceof OpenAI.AuthenticationError) {
    return {
      message: "The OpenAI API key was rejected. Check OPENAI_API_KEY.",
      retryable: false,
    };
  }
  if (error instanceof OpenAI.RateLimitError) {
    return { message: "Rate limited by the OpenAI API.", retryable: true };
  }
  if (error instanceof OpenAI.APIConnectionError) {
    return { message: "Could not reach the OpenAI API.", retryable: true };
  }
  if (error instanceof OpenAI.APIError) {
    return {
      message: `OpenAI API error (${error.status ?? "unknown"}): ${error.message}`,
      retryable: (error.status ?? 500) >= 500,
    };
  }
  return {
    message: error instanceof Error ? error.message : "Unknown model error.",
    retryable: true,
  };
}

async function* streamChat(request: StreamChatRequest): AsyncIterable<ChatEvent> {
  const {
    systemPrompt,
    tools,
    executeTool,
    model,
    maxTokens = DEFAULT_MAX_TOKENS,
    signal,
  } = request;
  const { billing } = request;
  const resolvedModel = model || env.openaiDefaultModel;

  const messages = toOpenAiMessages(systemPrompt, request.messages);
  const openAiTools = toOpenAiTools(tools);
  const usage = { inputTokens: 0, outputTokens: 0 };

  try {
    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
      const stream = await getClient().chat.completions.create(
        {
          model: resolvedModel,
          max_tokens: maxTokens,
          messages,
          ...(openAiTools.length > 0 ? { tools: openAiTools } : {}),
          stream: true,
          stream_options: { include_usage: true },
        },
        { signal },
      );

      let text = "";
      // Tool call arguments arrive as deltas keyed by index, not id.
      const partials = new Map<number, { id: string; name: string; args: string }>();
      let finishReason: string | null = null;
      const callUsage = { inputTokens: 0, outputTokens: 0 };

      for await (const chunk of stream) {
        if (chunk.usage) {
          callUsage.inputTokens += chunk.usage.prompt_tokens ?? 0;
          callUsage.outputTokens += chunk.usage.completion_tokens ?? 0;
        }
        const choice = chunk.choices[0];
        if (!choice) continue;
        if (choice.finish_reason) finishReason = choice.finish_reason;

        const delta = choice.delta;
        if (delta?.content) {
          text += delta.content;
          yield { type: "text_delta", text: delta.content };
        }
        for (const toolDelta of delta?.tool_calls ?? []) {
          const existing = partials.get(toolDelta.index) ?? {
            id: "",
            name: "",
            args: "",
          };
          if (toolDelta.id) existing.id = toolDelta.id;
          if (toolDelta.function?.name) existing.name = toolDelta.function.name;
          if (toolDelta.function?.arguments) {
            existing.args += toolDelta.function.arguments;
          }
          partials.set(toolDelta.index, existing);
        }
      }

      usage.inputTokens += callUsage.inputTokens;
      usage.outputTokens += callUsage.outputTokens;
      // Metered per API call, not per turn, so a loop that dies halfway is
      // still charged for what it spent.
      await recordTokenUsage({
        ...billing,
        provider: "openai",
        model: resolvedModel,
        ...callUsage,
      });

      const toolCalls: ToolCall[] = [...partials.values()]
        .filter((partial) => partial.id && partial.name)
        .map((partial) => ({
          id: partial.id,
          name: partial.name,
          input: safeParseArguments(partial.args),
        }));

      const assistantTurn: AssistantMessage = {
        role: "assistant",
        content: text,
        ...(toolCalls.length > 0 ? { toolCalls } : {}),
      };

      messages.push({
        role: "assistant",
        content: text || null,
        ...(toolCalls.length > 0
          ? {
              tool_calls: toolCalls.map((call) => ({
                id: call.id,
                type: "function" as const,
                function: { name: call.name, arguments: JSON.stringify(call.input) },
              })),
            }
          : {}),
      });
      yield { type: "turn", message: assistantTurn };

      if (toolCalls.length === 0) {
        yield { type: "done", stopReason: finishReason, usage };
        return;
      }

      for (const call of toolCalls) yield { type: "tool_call", call };

      const results = await Promise.all(
        toolCalls.map(async (call) => {
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

      for (const result of results) {
        messages.push({
          role: "tool",
          tool_call_id: result.id,
          content: result.content,
        });
      }
    }

    yield {
      type: "error",
      message: `The agent made more than ${MAX_TOOL_ITERATIONS} tool calls without finishing. Stopped to avoid a loop.`,
      retryable: false,
    };
  } catch (error) {
    yield { type: "error", ...describeError(error) };
  }
}

export const openaiProvider: LlmProvider = {
  id: "openai",
  get defaultModel() {
    return env.openaiDefaultModel;
  },
  streamChat,
};
