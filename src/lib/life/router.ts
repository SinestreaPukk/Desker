/**
 * The front door: decides what a freeform message needs.
 *  - engine: touches more than one domain ("can I afford this trip next week")
 *  - specialist: one named or obvious agent's job ("remind me to renew my passport")
 *  - direct: a question or statement the front-door assistant answers from the shared context
 * Deciding is cheap and only reads the message; anything consequential that
 * follows still stops for approval in the work runner.
 */
import "server-only";
import { env } from "@/lib/env";
import { getProvider } from "@/lib/llm/provider";
import { parseModelJson, stringField } from "@/lib/work/model-json";
import { chooseResponders, mentioned, type TeamAgent } from "@/lib/team";

export type Route = "engine" | "specialist" | "direct";

export interface Plan {
  route: Route;
  /** Who answers: the specialists, or the one front-door agent for engine and direct. */
  responders: TeamAgent[];
}

/** No model: words that say the message weighs a decision against several parts of life. */
const CROSS_DOMAIN = /\b(afford|trip|travel|vacation|holiday|fit (in|with)|clash|conflict|can i (take|go|book|buy)|should i (book|take|buy)|next (week|month)|budget)\b/i;

const CLASSIFY = `Classify the person's message to their private AI team. Reply with JSON only: {"route": "engine" | "specialist" | "direct"}.
- "engine": it proposes or weighs something that touches more than one of money, calendar, fitness, deadlines, travel (a trip, a purchase, a new commitment, "can I afford...", "does this fit...").
- "specialist": one clear job for one team member (a reminder, a bill, a workout plan, a booking search).
- "direct": a question, a vague statement, or chat that can be answered straight from their context or general knowledge.`;

const frontDoor = (team: TeamAgent[]) => team.find((a) => a.templateId === "personal-assistant") ?? team[0]!;

export async function planChat(input: { text: string; team: TeamAgent[]; threadId: string; organizationId: string }): Promise<Plan> {
  const { text, team, threadId, organizationId } = input;
  const named = mentioned(text, team);
  if (named) return { route: "specialist", responders: named };
  let route: Route = CROSS_DOMAIN.test(text) ? "engine" : "specialist";
  if ((env.hasAnthropicKey || env.hasOpenAiKey) && team.length > 0) {
    try {
      const provider = await getProvider(team[0]!.modelProvider);
      const turn = await provider.complete({ billing: { organizationId }, systemPrompt: CLASSIFY, messages: [{ role: "user", content: text }], tools: [], model: team[0]!.model, maxTokens: 30 });
      const picked = stringField(parseModelJson(turn.message.content), "route");
      if (picked === "engine" || picked === "specialist" || picked === "direct") route = picked;
    } catch (error) {
      console.error("[life] routing failed", error);
    }
  }
  if (route === "specialist") return { route, responders: await chooseResponders(threadId, organizationId, team, text) };
  return { route, responders: [frontDoor(team)] };
}
