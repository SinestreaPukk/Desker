/**
 * Tick-the-ones-that-apply answers for setting an agent up: when it stops and
 * asks, who is involved, what a good week looks like. Each is stored as the
 * plain sentence the agent reads - so a prompt, an old free-text answer and
 * a ticked list are all the same field - and read back into ticks when it
 * matches the options.
 *
 * Pure: the hire wizard, the editor and the tests share it.
 */
export interface Choices {
  selected: string[];
  /** Anything that isn't one of the options: the owner's own words. */
  other: string;
}

/** "A; B; C" then any words of the owner's own. */
export function composeChoices(choices: Choices): string {
  return [...choices.selected, choices.other.trim()].filter(Boolean).join("; ");
}

export function parseChoices(text: string | null | undefined, options: readonly string[]): Choices {
  const parts = (text ?? "")
    .split(";")
    .map((part) => part.trim().replace(/\.$/, ""))
    .filter(Boolean);
  const selected = options.filter((option) => parts.some((part) => part.toLowerCase() === option.toLowerCase()));
  const other = parts.filter((part) => !options.some((option) => option.toLowerCase() === part.toLowerCase())).join("; ");
  return { selected, other };
}

// --- escalation -----------------------------------------------------------------

const ESCALATION_LEAD = "Stop and ask a person when: ";

export const ESCALATION_OPTIONS: readonly string[] = [
    "paying, buying or signing anything",
    "agreeing to a date or plan on my behalf",
    "cancelling a subscription or contract",
    "health, legal or money decisions",
    "it involves someone else's private details",
    "it isn't sure what I'd want",
  ];

export function composeEscalation(choices: Choices): string {
  const body = composeChoices({ ...choices, other: choices.other.trim().replace(/[.\s]+$/, "") });
  return body ? `${ESCALATION_LEAD}${body}.` : "";
}

/** Ticks from a stored rule; a rule written freely becomes the "other" words. */
export function parseEscalation(rule: string | null | undefined): Choices {
  const text = (rule ?? "").trim();
  if (!text) return { selected: [], other: "" };
  if (!text.startsWith(ESCALATION_LEAD)) return { selected: [], other: text };
  return parseChoices(text.slice(ESCALATION_LEAD.length).replace(/\.$/, ""), ESCALATION_OPTIONS);
}

// --- who's involved and a good week ---------------------------------------------------

export const STAKEHOLDER_OPTIONS: readonly string[] = ["Just me", "My partner", "My family", "Friends", "My landlord or flatmates", "My employer or clients"];

export const SUCCESS_OPTIONS: readonly string[] = [
    "A plan I don't have to redo",
    "Nothing I have to chase",
    "Exact numbers, not guesses",
    "A short check-in, not a report",
    "Reminders before things are due",
  ];

/** The questions that are ticked rather than typed, by id. */
export function choicesFor(questionId: string): readonly string[] | null {
  if (questionId === "stakeholders") return STAKEHOLDER_OPTIONS;
  if (questionId === "success") return SUCCESS_OPTIONS;
  return null;
}

// --- a voice for agents that don't come with one -------------------------------------------

/** Used when an agent is hired without a role's own wording. Nobody has to write one. */
export function defaultPersonality(): string {
  return "Warm, clear and brief. Gives the answer first and the detail only when asked. Never commits you to anything without checking.";
}
