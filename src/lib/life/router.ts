/**
 * The front door: decides what a freeform message needs.
 *  - engine: touches more than one domain ("can I afford this trip next week")
 *  - specialist: one named or obvious agent's job ("remind me to renew my passport")
 *  - direct: a statement or question the front-door assistant answers from the shared context and what it knows
 *  - reminder: "remind me to ... in 30 minutes": saved and delivered on time (life/reminders.ts)
 *  - research: an open question about the outside world, answered from a web search (life/research.ts)
 * Deciding is cheap and only reads the message; anything consequential that
 * follows still stops for approval in the work runner.
 */
import "server-only";
import { env } from "@/lib/platform/env";
import { getProvider } from "@/lib/llm/provider";
import { parseModelJson, stringField } from "@/lib/work/model-json";
import { browserConfigured } from "@/lib/browser/session";
import { REMIND } from "./reminders";
import type { TeamAgent } from "@/lib/agents/team";

type Route = "engine" | "specialist" | "direct" | "research" | "reminder";

export interface Plan {
  route: Route;
  /** Who answers: the specialists, or the one front-door agent for engine and direct. */
  responders: TeamAgent[];
}

/** No model: words that say the message weighs a decision against several parts of life. */
const CROSS_DOMAIN = /\b(afford|trip|travel|vacation|holiday|fit (in|with)|clash|conflict|can i (take|go|book|buy)|should i (book|take|buy)|next (week|month)|budget)\b/i;

const CLASSIFY = `Classify the person's message to their private AI team. Reply with JSON only: {"route": "engine" | "specialist" | "direct" | "research"}.
- "engine": it proposes or weighs something that touches more than one of money, calendar, fitness, deadlines, travel (a trip, a purchase, a new commitment, "can I afford...", "does this fit...").
- "specialist": one clear job for one team member (a reminder, a bill, a workout plan, a booking search).
- "direct": a vague statement, or chat that can be answered straight from their own context or stable general knowledge.
- "research": an open question about the outside world that needs current or looked-up facts (news, prices, how something works, comparing products, a place, a rule or law) and is not a job for a specialist or about their own data.`;

/** Words that need a real browser (see a page, search flights, sign up): never a plain web-search answer, which cannot show or do any of it. */
const BROWSE = /\b(screenshots?|screen ?caps?|browser|open (the )?(site|website|page|link)|go to \S+\.\S+|flights?|sign (me )?up|fill (in|out)|log ?in to|book(ing)? (a |the )?(flight|hotel|table))\b|https?:\/\//i;

const frontDoor = (team: TeamAgent[]) => team[0]!;

export async function planChat(input: { text: string; team: TeamAgent[]; organizationId: string }): Promise<Plan> {
  const { text, team, organizationId } = input;
  // A reminder is recognised by its words, with no model call, so it is never mistaken for a task to run.
  if (REMIND.test(text)) return { route: "reminder", responders: [frontDoor(team)] };
  // The specialist turn is the one that can start a browser task, so these never go to research or the engine.
  if (BROWSE.test(text) && browserConfigured()) return { route: "specialist", responders: [frontDoor(team)] };
  let route: Route = CROSS_DOMAIN.test(text) ? "engine" : "specialist";
  if ((env.hasAnthropicKey || env.hasOpenAiKey) && team.length > 0) {
    try {
      const provider = await getProvider(team[0]!.modelProvider);
      const turn = await provider.complete({ billing: { organizationId }, systemPrompt: CLASSIFY, messages: [{ role: "user", content: text }], tools: [], model: team[0]!.model, maxTokens: 30 });
      const picked = stringField(parseModelJson(turn.message.content), "route");
      if (picked === "engine" || picked === "specialist" || picked === "direct" || picked === "research") route = picked;
    } catch (error) {
      console.error("[life] routing failed", error);
    }
  }
  return { route, responders: [frontDoor(team)] };
}
