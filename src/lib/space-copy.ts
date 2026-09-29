/**
 * The words the hiring and editing screens use, per kind of space.
 *
 * A business hires staff for every kind of job - research, marketing, ops,
 * support - so its examples are not all about answering clients. A personal
 * space adds assistants for one person, so it has no job titles, teams or
 * clients at all. One table, so the wizard and the editor cannot drift.
 */
import type { SpaceKind } from "@/lib/space";

export const SPACE_COPY = {
  business: {
    agent: "agent",
    roleLabel: "Job title",
    rolePlaceholder: "Research Analyst",
    showTeam: true,
    teamPlaceholder: "Strategy",
    personalityPlaceholder:
      "Precise and plain-spoken. Leads with the finding, cites its sources, and says so when the evidence is thin.",
    responsibilitiesPlaceholder:
      "Research competitors and the market every week\nDraft posts and emails for approval\nFlag anything that needs a decision",
    escalationHint: "Plain language. The agent judges it from what actually happens in its work or a conversation, not from keywords.",
    escalationPlaceholder: "Escalate if a request involves money, a legal commitment, or a promise to a customer.",
    ruleExamples: [
      "Escalate if a request involves money or a legal commitment.",
      "Escalate if a topic returns no reliable sources.",
      "Escalate if an action would email more than 20 people at once.",
      "Escalate if someone is upset or asks for a person.",
    ],
    objectiveExamples: [
      "Research what our three main competitors announced this week",
      "Draft one LinkedIn post about the lifetime warranty and queue it for approval",
      "Email a summary of open issues to ops@company.com",
    ],
    profileStep: "Give them a name, a job and a face.",
    noRuleYet: "No rule yet - the agent only stops for you when a tool needs your approval. Try one of these, then make it yours:",
  },
  personal: {
    agent: "assistant",
    roleLabel: "What they help with",
    rolePlaceholder: "Money Manager",
    showTeam: false,
    teamPlaceholder: "",
    personalityPlaceholder: "Calm and brief. Leads with the one thing I should do, never lectures, and asks before anything leaves.",
    responsibilitiesPlaceholder:
      "Add up my spending every week\nFlag subscriptions I no longer use\nRemind me before bills are due",
    escalationHint: "Plain language: when it should stop and check with you. It judges this from what it finds, not from keywords.",
    escalationPlaceholder: "Ask me first if anything costs money, is non-refundable, or goes to someone other than me.",
    ruleExamples: [
      "Escalate if a charge looks like fraud or a bill is overdue.",
      "Escalate before anything is sent to someone other than me.",
      "Escalate if a plan needs a non-refundable booking.",
      "Escalate if I miss two weeks in a row.",
    ],
    objectiveExamples: [
      "Every Monday, add up last week's spending from my statement",
      "Every Sunday, plan my week around my calendar",
      "Each weekday, find up to five remote design roles that fit my CV",
    ],
    profileStep: "Give them a name, what they help with, and a face.",
    noRuleYet: "No rule yet - it only stops for you when something needs your approval. Try one of these, then make it yours:",
  },
} as const satisfies Record<SpaceKind, Record<string, unknown>>;

export function spaceCopy(kind: SpaceKind) {
  return SPACE_COPY[kind];
}
