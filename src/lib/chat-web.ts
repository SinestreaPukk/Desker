/**
 * Web search from a chat. Every agent can look things up on the public web
 * when asked in conversation (weather, news, prices, a fact check); it reuses
 * the same cached, metered, untrusted-input-safe research as work runs.
 */
import "server-only";
import { z } from "zod";
import type { ToolDefinition } from "@/lib/llm/provider";
import { researchTheWeb } from "@/lib/work/research";

export const WEB_SEARCH: ToolDefinition = {
  name: "web_search",
  description:
    "Search the public web and read the top results. Use it for anything current or outside your own knowledge - weather, news, prices, opening hours, facts. Returns findings with source links. Use a specific query; call it again for a different angle.",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string", description: "The search query." },
      focus: { type: "string", description: "Optional. What the findings should concentrate on." },
    },
    required: ["query"],
    additionalProperties: false,
  },
};

export const WEB_CHAT_NOTE = `## The web in this chat
You can search the internet with web_search. Use it whenever a question needs current or outside information (weather, news, prices, facts) - never say you have no internet access. Give the answer first, then the source link.`;

const inputSchema = z.object({ query: z.string().trim().min(1).max(300), focus: z.string().trim().max(300).optional() });

export async function webSearch(
  ctx: { organizationId: string; agentId: string; modelProvider: string; model: string | null },
  input: unknown,
): Promise<{ content: string; isError?: boolean }> {
  const parsed = inputSchema.safeParse(input);
  if (!parsed.success) return { content: "web_search needs a non-empty query.", isError: true };
  const found = await researchTheWeb({
    ...parsed.data,
    billing: { organizationId: ctx.organizationId, agentId: ctx.agentId },
    modelProvider: ctx.modelProvider,
    model: ctx.model,
  });
  const sources = found.sources.map((s, i) => `[${i + 1}] ${s.title} - ${s.url}`).join("\n");
  return { content: `${found.findings}\n\nSources:\n${sources || "(none)"}` };
}
