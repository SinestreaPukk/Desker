/**
 * The cross-domain negotiation layer. A proposal ("a trip next week", "a new
 * commitment") is laid over the shared life context and checked by code
 * (conflicts.ts). Each specialist whose domain is touched then states a
 * position from that same context, seeing the others' - money pushes back on
 * cost, the assistant on the calendar, the coach on training, travel on the
 * plan - and one synthesis turns the disagreement into a verdict with a
 * workable alternative. Nothing here executes anything: the result is advice
 * plus drafts; real calendar or money changes still wait for approval.
 */
import "server-only";
import { env } from "@/lib/env";
import { getProvider, type LlmProvider } from "@/lib/llm/provider";
import { clamp, parseModelJson, stringField } from "@/lib/work/model-json";
import { detectConflicts, cleanWindows, type Conflict, type Domain, type Proposal } from "./conflicts";
import { renderLife, type Life } from "./context";
import * as store from "./store";

/** The specialist that speaks for each domain, matched to a hired agent by its template. */
const LENS: Record<Domain, { template: string; role: string; cares: string }> = {
  money: { template: "personal-assistant", role: "Money Manager", cares: "the monthly budget, upcoming bills and savings goals" },
  calendar: { template: "personal-assistant", role: "Life Admin", cares: "the calendar, commitments and not double-booking the person" },
  tasks: { template: "personal-assistant", role: "Life Admin", cares: "deadlines and open tasks" },
  fitness: { template: "personal-assistant", role: "Coach", cares: "training consistency, recovery and planned workouts" },
  travel: { template: "personal-assistant", role: "Travel Planner", cares: "the practicalities and best value of the trip" },
};

interface Position {
  role: string;
  agentId: string | null;
  stance: "ok" | "object" | "concede";
  point: string;
}

export interface Negotiation {
  verdict: "go" | "go_with_changes" | "hold";
  reply: string;
  proposal: Proposal | null;
  conflicts: Conflict[];
  positions: Position[];
  alternatives: { startsAt: Date; endsAt: Date }[];
}

export interface NegotiationAgent {
  id: string;
  templateId: string | null;
  name: string;
  personality: string;
  modelProvider: string;
  model: string | null;
}

const hasModel = () => env.hasAnthropicKey || env.hasOpenAiKey;
const day = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });

async function ask(provider: LlmProvider, organizationId: string, system: string, user: string, model: string | null, maxTokens = 350) {
  const turn = await provider.complete({ billing: { organizationId }, systemPrompt: system, messages: [{ role: "user", content: user }], tools: [], model, maxTokens });
  return parseModelJson(turn.message.content);
}

/** Pulls a dated proposal out of free text. Null when the message proposes nothing with dates. */
async function extractProposal(provider: LlmProvider, organizationId: string, text: string, now: Date, model: string | null): Promise<Proposal | null> {
  const parsed = await ask(
    provider,
    organizationId,
    `Today is ${now.toISOString().slice(0, 10)}. Read the person's message. If it proposes something with a time and possibly a cost (a trip, a purchase, a new commitment), reply with JSON only: {"title": string, "start": "YYYY-MM-DD", "end": "YYYY-MM-DD", "cost": number | null, "trip": boolean}. "cost" is in major currency units, null if not stated. Resolve relative dates like "next week". If it proposes nothing with dates, reply {"title": ""}.`,
    text,
    model,
    150,
  );
  const title = stringField(parsed, "title");
  const start = new Date(stringField(parsed, "start"));
  const end = new Date(stringField(parsed, "end") || start);
  if (!title || Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const cost = Number(parsed?.cost);
  return { title, startsAt: start, endsAt: new Date(Math.max(end.getTime(), start.getTime()) + (end <= start ? 86_400_000 : 0)), costMinor: Number.isFinite(cost) && cost > 0 ? Math.round(cost * 100) : 0, trip: parsed?.trip === true };
}

/** What the engine says with no model: the computed conflicts, plainly. */
function plainVerdict(conflicts: Conflict[], alternatives: Negotiation["alternatives"], title: string): Pick<Negotiation, "verdict" | "reply"> {
  const real = conflicts.filter((c) => c.severity !== "info");
  if (real.length === 0) return { verdict: "go", reply: `${title} fits: nothing clashes with your budget, calendar, workouts or deadlines.` };
  const alt = alternatives[0] ? ` A clear window: ${day(alternatives[0].startsAt)} to ${day(alternatives[0].endsAt)}.` : "";
  return { verdict: alternatives[0] ? "go_with_changes" : "hold", reply: `${title}: ${real.map((c) => c.summary).join(" ")}${alt}` };
}

export async function negotiate(input: {
  life: Life;
  organizationId: string;
  projectId: string;
  text: string;
  team: NegotiationAgent[];
  timeZone?: string;
}): Promise<Negotiation> {
  const { life, organizationId, projectId, text, team, timeZone } = input;
  const lead = team[0];
  const provider = hasModel() && lead ? await getProvider(lead.modelProvider).catch(() => null) : null;
  const model = lead?.model ?? null;

  let proposal: Proposal | null = null;
  try {
    if (provider) proposal = await extractProposal(provider, organizationId, text, life.now, model);
  } catch (error) {
    console.error("[life] proposal extraction failed", error);
  }

  const conflicts = detectConflicts(life, proposal ?? undefined);
  const alternatives = proposal ? cleanWindows(life, proposal) : [];
  const title = proposal?.title ?? "That";
  const positions: Position[] = [];

  const domains = [...new Set(conflicts.flatMap((c) => c.domains))];
  const lenses = [...new Map(domains.map((d) => [LENS[d].role, d])).values()];
  const context = renderLife(life, timeZone);
  const found = conflicts.map((c) => `- [${c.domains.join("/")}, ${c.severity}] ${c.summary}`).join("\n") || "- No conflicts found.";
  const altText = alternatives.length ? alternatives.map((a) => `${day(a.startsAt)} to ${day(a.endsAt)}`).join("; ") : "none found in the next 8 weeks";

  if (provider && proposal) {
    // Round 1: each affected specialist states a position. Round 2: each sees the others and may concede.
    for (let round = 1; round <= 2; round++) {
      const seen = positions.map((p) => `${p.role} (${p.stance}): ${p.point}`).join("\n");
      const next: Position[] = [];
      for (const domain of lenses) {
        const lens = LENS[domain];
        const agent = team[0] ?? null;
        try {
          const out = await ask(
            provider,
            organizationId,
            `You are ${agent?.name ?? lens.role}, the ${lens.role} on one person's private team. You care about ${lens.cares}.${agent ? ` Personality: ${agent.personality}` : ""}\nState your position on the proposal, from the facts only. Reply with JSON only: {"stance": "ok" | "object" | "concede", "point": "one or two plain sentences"}. In round 2, concede if another specialist's point or an alternative window resolves your concern.`,
            `Round ${round}.\nProposal: ${proposal.title}, ${day(proposal.startsAt)} to ${day(proposal.endsAt)}${proposal.costMinor ? `, about ${proposal.costMinor / 100}` : ""}.\n\nTheir life now:\n${context}\n\nConflicts found by calculation:\n${found}\n\nAlternative clear windows: ${altText}\n${seen ? `\nOther specialists said:\n${seen}` : ""}`,
            agent?.model ?? model,
            200,
          );
          const stance = stringField(out, "stance");
          next.push({ role: lens.role, agentId: agent?.id ?? null, stance: stance === "object" || stance === "concede" ? stance : "ok", point: clamp(stringField(out, "point"), 400) });
        } catch (error) {
          console.error("[life] position failed", error);
        }
      }
      if (next.length) positions.splice(0, positions.length, ...next);
      if (round === 1 && positions.every((p) => p.stance === "ok")) break;
    }
  }

  let { verdict, reply } = plainVerdict(conflicts, alternatives, title);
  if (provider && proposal) {
    try {
      const out = await ask(
        provider,
        organizationId,
        `You speak for a private AI team to one person. Synthesize the specialists' positions into ONE answer: lead with the verdict, then the real trade-off with figures from the conflicts, then a concrete alternative if one exists (a cheaper or clearer week). At most 90 words, plain words, no headings, never invent figures. Reply with JSON only: {"verdict": "go" | "go_with_changes" | "hold", "reply": string}.`,
        `Proposal: ${proposal.title}, ${day(proposal.startsAt)} to ${day(proposal.endsAt)}.\nConflicts:\n${found}\nAlternative clear windows: ${altText}\nPositions:\n${positions.map((p) => `${p.role} (${p.stance}): ${p.point}`).join("\n") || "none"}`,
        model,
        300,
      );
      const v = stringField(out, "verdict");
      const r = stringField(out, "reply");
      if (r) {
        reply = clamp(r, 1500);
        verdict = v === "go" || v === "hold" ? v : "go_with_changes";
      }
    } catch (error) {
      console.error("[life] synthesis failed", error);
    }
  }

  await store.addNote({ organizationId, projectId, source: "engine" }, `${title}: ${verdict}. ${clamp(reply, 300)}`);
  return { verdict, reply, proposal, conflicts, positions, alternatives };
}

/** The weekly brief: today's conflicts across domains, synthesized once. No proposal, just the week as it stands. */
export async function weeklyDigest(input: { life: Life; organizationId: string; team: NegotiationAgent[]; timeZone?: string }): Promise<{ title: string; body: string }> {
  const { life, organizationId, team, timeZone } = input;
  const conflicts = detectConflicts(life).filter((c) => c.severity !== "info" || c.kind === "bill_in_trip");
  const facts = [
    ...conflicts.map((c) => `- ${c.summary}`),
    ...(life.money.billsDueSoonMinor ? [`- Bills due within 7 days: ${Math.round(life.money.billsDueSoonMinor / 100).toLocaleString("en-US")} ${life.money.currency}.`] : []),
  ];
  const title = "Your week";
  const plain = facts.length ? `Here is what needs a decision this week:\n${facts.join("\n")}` : "Nothing clashes this week: your money, calendar, workouts and deadlines line up.";
  const lead = team[0];
  if (!hasModel() || !lead || facts.length === 0) return { title, body: plain };
  try {
    const provider = await getProvider(lead.modelProvider);
    const out = await ask(
      provider,
      organizationId,
      `You write one weekly brief for a person from their private AI team. Not per-agent status: one synthesis of the cross-domain conflicts and trade-offs, with the single best next step for each. Use only the facts given, never invent figures. At most 140 words, plain words, short "- " lines allowed. Reply with JSON only: {"body": string}.`,
      `Their life:\n${renderLife(life, timeZone)}\n\nConflicts found by calculation:\n${facts.join("\n")}`,
      lead.model,
      400,
    );
    return { title, body: clamp(stringField(out, "body") || plain, 1800) };
  } catch (error) {
    console.error("[life] digest failed", error);
    return { title, body: plain };
  }
}
