/**
 * The words the hiring and editing screens use. One table, so the wizard and
 * the editor cannot drift.
 */
export const SPACE_COPY = {
agent: "assistant",
roleLabel: "What they help with",
rolePlaceholder: "Money Manager",
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
} as const;
