/**
 * Context, as questions rather than a blank box.
 *
 * "Project context" used to be one empty textarea, which is the hardest thing
 * in the product to answer well: an owner either leaves it empty or writes two
 * vague lines. The same information asked as four short questions gets
 * answered, because each one has an obvious shape and an example beside it.
 *
 * Nothing downstream learns about any of this. The answers are composed into
 * the same single string the prompt and retrieval have always read, so this is
 * an authoring change and not a runtime one.
 *
 * Two sets, one mechanism: the project's set is typed once and inherited by
 * every agent in it, and each agent's set says only what is specific to that
 * role. No server imports - the forms use this too.
 *
 */
export interface ContextQuestion {
  id: string;
  /** The question, as asked in the form. */
  label: string;
  /** One line under the field: why it matters, or how to answer. */
  hint: string;
  /** An example answer. Placeholder text only - never prefilled. */
  placeholder: string;
  /** How the answer is introduced in the composed string the model reads. */
  promptLabel: string;
  rows?: number;
}

/**
 * The space's shared context: about the person. Typed once, read by every
 * assistant in the space. Nothing here asks for an
 * account number, a password or an ID - the hints say so, because the most
 * helpful thing to type is not always the safest.
 */
export const PROJECT_CONTEXT_QUESTIONS: readonly ContextQuestion[] = [
  {
    id: "about",
    label: "Tell your assistants about you",
    hint: "Who you are, what you do, where you live and your time zone. Only what helps them help you.",
    placeholder:
      "I'm Maya, a product designer in Bangkok (GMT+7). I live with my partner Sam. I freelance on the side and I'm saving for a flat.",
    promptLabel: "About me",
    rows: 3,
  },
  {
    id: "goals",
    label: "What do you want help with right now?",
    hint: "The two or three things that would make the biggest difference this month.",
    placeholder:
      "Getting my spending under control and building a three-month emergency fund. Posting on LinkedIn every week to win better freelance clients. Planning a trip to Japan in April.",
    promptLabel: "What I want help with",
    rows: 3,
  },
  {
    id: "tone",
    label: "How should they talk to you?",
    hint: "Short or detailed, gentle or blunt. Every assistant starts from this.",
    placeholder: "Short and friendly, no lectures. Bullet points over paragraphs. Tell me the one thing to do first.",
    promptLabel: "How to talk to me",
    rows: 2,
  },
  {
    id: "never",
    label: "Anything they should never do?",
    hint: "Your limits. Each assistant can add its own underneath.",
    placeholder:
      "Never post or email in my name without asking. Never book anything non-refundable. Never mention my health or money to anyone else.",
    promptLabel: "Never",
    rows: 3,
  },
] as const;

/** More about the person, all optional. Sharpens the work; the four above are the bar. */
export const PROJECT_CONTEXT_EXTRA_QUESTIONS: readonly ContextQuestion[] = [
  {
    id: "week",
    label: "What does your week look like?",
    hint: "Working hours, busy days, when you like to get updates.",
    placeholder: "Work 9-6 weekdays, gym Tuesday and Thursday evenings. Sunday evening is when I plan my week.",
    promptLabel: "My week",
    rows: 2,
  },
  {
    id: "money",
    label: "Money basics",
    hint: "Your currency, rough monthly budget and what you're saving for. Never an account or card number - they're never needed.",
    placeholder:
      "THB. Take-home about 85,000 a month; rent 18,000. Saving 10,000 a month towards a flat deposit. Trying to spend less on food delivery.",
    promptLabel: "Money",
    rows: 3,
  },
  {
    id: "people",
    label: "People who matter",
    hint: "Names, how you know them, birthdays. So reminders, gifts and messages land right.",
    placeholder: "Sam (partner, birthday 14 March). Mum in Chiang Mai - I call her Sundays. Nok, my accountant.",
    promptLabel: "People",
    rows: 2,
  },
  {
    id: "preferences",
    label: "Likes, dislikes and limits",
    hint: "Food, travel style, brands, budgets - anything that decides between two options.",
    placeholder: "Vegetarian. Window seats, no red-eyes. Prefer small hotels over chains. Hate phone calls.",
    promptLabel: "Preferences",
    rows: 2,
  },
  {
    id: "voice",
    label: "How you sound online",
    hint: "For anything posted or written in your name: topics, phrases you use, things you'd never say.",
    placeholder: "Plain and a bit dry. I write about design systems and freelancing. No emoji walls, no 'thrilled to announce'.",
    promptLabel: "My voice online",
    rows: 2,
  },
] as const;

/** Every project question, core first: what is saved, composed and drafted. */
export const ALL_PROJECT_CONTEXT_QUESTIONS: readonly ContextQuestion[] = [
  ...PROJECT_CONTEXT_QUESTIONS,
  ...PROJECT_CONTEXT_EXTRA_QUESTIONS,
];

/** What is specific to one assistant, on top of everything above. */
export const AGENT_CONTEXT_QUESTIONS: readonly ContextQuestion[] = [
  {
    id: "project",
    label: "What should this assistant focus on?",
    hint: "The one job, in a sentence or two: the budget, the trip, the job hunt.",
    placeholder: "Keep my monthly spending under 40,000 THB and find subscriptions I've stopped using.",
    promptLabel: "About this work",
    rows: 3,
  },
  {
    id: "stakeholders",
    label: "Who else is involved?",
    hint: "People it may mention or write to. Leave it empty if it's just you.",
    placeholder: "Just me. Sam and I split rent and groceries 50/50.",
    promptLabel: "Working for",
    rows: 2,
  },
  {
    id: "success",
    label: "What does a good week look like?",
    hint: "How it should judge its own work when you're not there to ask.",
    placeholder: "One short money check-in on Monday with the three things worth changing, and nothing I have to redo.",
    promptLabel: "A good result",
    rows: 3,
  },
  {
    id: "never",
    label: "Anything this assistant should never do?",
    hint: "Limits for this role. Your general ones already apply.",
    placeholder: "Never suggest a loan, a credit card or an investment product.",
    promptLabel: "Never",
    rows: 2,
  },
] as const;

/**
 * The agent questions to show. "Never" is no longer asked - the tickboxes for
 * when it stops and asks, and the space's own limits, cover it - but an answer
 * someone already wrote stays visible, and in the prompt, until they clear it.
 */
export function shownAgentQuestions(answers: ContextAnswers): readonly ContextQuestion[] {
  return AGENT_CONTEXT_QUESTIONS.filter((question) => question.id !== "never" || Boolean(answers.never?.trim()));
}

/** Every question set, by where it is asked. */
export function contextQuestions() {
  return {
    core: PROJECT_CONTEXT_QUESTIONS,
    extra: PROJECT_CONTEXT_EXTRA_QUESTIONS,
    all: ALL_PROJECT_CONTEXT_QUESTIONS,
    agent: AGENT_CONTEXT_QUESTIONS,
  };
}

export type ContextAnswers = Record<string, string>;

/** A Json column, made safe: known ids, trimmed strings, nothing else. */
export function toContextAnswers(
  value: unknown,
  questions: readonly ContextQuestion[],
): ContextAnswers {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const source = value as Record<string, unknown>;
  const answers: ContextAnswers = {};
  for (const question of questions) {
    const answer = source[question.id];
    if (typeof answer === "string" && answer.trim()) answers[question.id] = answer.trim();
  }
  return answers;
}

/**
 * The answers as the one string everything downstream reads. Unanswered
 * questions are left out entirely rather than sent as empty headings.
 */
export function composeContext(
  answers: ContextAnswers,
  questions: readonly ContextQuestion[],
): string {
  return questions
    .map((question) => {
      const answer = answers[question.id]?.trim();
      return answer ? `${question.promptLabel}: ${answer}` : null;
    })
    .filter(Boolean)
    .join("\n\n");
}

/**
 * What a run actually reads: the project's shared context, then what is
 * specific to this agent. Labelled, because an agent that cannot tell house
 * style from its own brief will treat the two as equally negotiable.
 */
export function effectiveContext(input: {
  projectContext: string | null | undefined;
  agentContext: string | null | undefined;
}): string {
  const project = (input.projectContext ?? "").trim();
  const agent = (input.agentContext ?? "").trim();
  if (!project) return agent;
  if (!agent) return project;
  const shared = "About the person you work for - shared by all of their assistants";
  return `${shared}:\n${project}\n\nSpecific to you and this work:\n${agent}`;
}

/**
 * Answers to show in the form for a record written before the questions
 * existed: its free text becomes the first question's answer, which is where
 * it would have gone anyway, and nothing is lost on the way.
 */
export function answersFor(
  stored: unknown,
  freeText: string | null | undefined,
  questions: readonly ContextQuestion[],
): ContextAnswers {
  const answers = toContextAnswers(stored, questions);
  if (Object.keys(answers).length > 0) return answers;
  const text = (freeText ?? "").trim();
  if (!text) return {};
  return { [questions[0]!.id]: text };
}

export function answeredCount(
  answers: ContextAnswers,
  questions: readonly ContextQuestion[],
): number {
  return questions.filter((question) => Boolean(answers[question.id]?.trim())).length;
}

/** The longest an answer may be. Generous; the cap is there to stop a paste of a whole handbook. */
export const MAX_CONTEXT_ANSWER = 4_000;

/** Whether the four core questions are answered: the bar for publishing an agent. */
export function hasCoreContext(project: { context: string | null; contextAnswers: unknown }): boolean {
  const core = PROJECT_CONTEXT_QUESTIONS;
  const answers = answersFor(project.contextAnswers, project.context, core);
  return answeredCount(answers, core) === core.length;
}
