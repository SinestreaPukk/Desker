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
 * A personal space asks about the person instead (PERSONAL_*): same
 * mechanism, different questions, chosen by contextQuestionsFor(kind).
 */
import type { SpaceKind } from "@/lib/space";

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

/** What every agent in the project shares. Typed once, on the roster. */
export const PROJECT_CONTEXT_QUESTIONS: readonly ContextQuestion[] = [
  {
    id: "business",
    label: "What does this business do?",
    hint: "One or two sentences. What you sell, to whom, and what makes you different.",
    placeholder:
      "Northwind Supply Co. sells hand tools and workwear to professional tradespeople, online and from four branches. We compete on stock depth and a lifetime warranty rather than on price.",
    promptLabel: "The business",
    rows: 3,
  },
  {
    id: "audience",
    label: "Who are your customers?",
    hint: "Who your agents are ultimately writing for or talking to.",
    placeholder:
      "Self-employed tradespeople and small site crews. Busy, practical, buying tools they will use daily. They know the products better than we do.",
    promptLabel: "Customers",
    rows: 3,
  },
  {
    id: "tone",
    label: "How should your agents sound?",
    hint: "House style, in plain words. Every agent starts from this.",
    placeholder: "Plain, direct, no hype and no jargon. Short sentences. Never salesy.",
    promptLabel: "House style",
    rows: 2,
  },
  {
    id: "never",
    label: "Anything no agent should ever do or say?",
    hint: "Company-wide limits. Each agent can add its own underneath.",
    placeholder:
      "Never quote a discount or a delivery date. Never comment on a competitor by name. Never share a customer's order details with anyone else.",
    promptLabel: "Never",
    rows: 3,
  },
] as const;

/**
 * More about the business, all optional. The four above are what every agent
 * cannot work without; these sharpen it. Kept apart so "complete" still means
 * the four core answers, and the core form stays short enough to finish.
 */
export const PROJECT_CONTEXT_EXTRA_QUESTIONS: readonly ContextQuestion[] = [
  {
    id: "offer",
    label: "What do you sell, and roughly what does it cost?",
    hint: "Your main products or services and their price range, in plain words.",
    placeholder:
      "Hand tools (screwdrivers to torque wrenches, $8-$240), workwear, and site safety kit. Trade accounts get 10% off list and 30-day invoicing.",
    promptLabel: "What we sell",
    rows: 3,
  },
  {
    id: "facts",
    label: "Key facts an agent might be asked",
    hint: "Website, locations, opening hours, contact details, delivery and returns in one line each.",
    placeholder:
      "northwind.example · Branches in Leeds, York, Hull and Sheffield, 7am-5pm weekdays · Free delivery over $75 · 30-day returns, lifetime warranty on hand tools · help@northwind.example",
    promptLabel: "Key facts",
    rows: 3,
  },
  {
    id: "focus",
    label: "What are you focused on right now?",
    hint: "This quarter's goal, a launch, a campaign. Agents lean their work towards it.",
    placeholder: "Growing trade accounts in Yorkshire, and making the lifetime warranty known before Christmas.",
    promptLabel: "Current focus",
    rows: 2,
  },
  {
    id: "competitors",
    label: "Who do you compete with?",
    hint: "Names, and what makes you different from each.",
    placeholder: "Forge & Co (cheaper, no warranty), Tradeline (bigger range, slow delivery), Sitewise (online only).",
    promptLabel: "Competitors",
    rows: 2,
  },
  {
    id: "words",
    label: "Words to use or avoid",
    hint: "Product names spelled your way, phrases you like, jargon you never want to see.",
    placeholder: 'Say "trade account", never "B2B". It is "Northwind", not "NorthWind". Avoid "cheap" - say "good value".',
    promptLabel: "Wording",
    rows: 2,
  },
] as const;

/** Every project question, core first: what is saved, composed and drafted. */
export const ALL_PROJECT_CONTEXT_QUESTIONS: readonly ContextQuestion[] = [
  ...PROJECT_CONTEXT_QUESTIONS,
  ...PROJECT_CONTEXT_EXTRA_QUESTIONS,
];

/** What is specific to one role, on top of everything above. */
export const AGENT_CONTEXT_QUESTIONS: readonly ContextQuestion[] = [
  {
    id: "project",
    label: "What should this agent know about the work?",
    hint: "The push it is part of: the campaign, the accounts, this quarter's goal.",
    placeholder:
      "We are pushing the lifetime hand-tool warranty this quarter. The competitors worth watching are Forge & Co, Tradeline and Sitewise.",
    promptLabel: "About this work",
    rows: 3,
  },
  {
    id: "stakeholders",
    label: "Who is it working for?",
    hint: "The people who read its output, or the audience it writes for.",
    placeholder:
      "Priya, who runs marketing and approves every post. The posts themselves are for tradespeople on LinkedIn.",
    promptLabel: "Working for",
    rows: 2,
  },
  {
    id: "success",
    label: "What does a good week's work look like?",
    hint: "How it should judge its own output when nobody is there to ask.",
    placeholder:
      "One well-sourced piece of research and two drafts I can approve without rewriting. Specific claims with a source beat broad ones without.",
    promptLabel: "A good result",
    rows: 3,
  },
  {
    id: "never",
    label: "Anything this agent should never do or say?",
    hint: "Limits particular to this role. The company-wide ones already apply.",
    placeholder: "Never publish anything about pricing. Never email a customer directly.",
    promptLabel: "Never",
    rows: 2,
  },
] as const;

/**
 * A personal space's shared context: about the person, not a company. Typed
 * once, read by every assistant in the space. Nothing here asks for an
 * account number, a password or an ID - the hints say so, because the most
 * helpful thing to type is not always the safest.
 */
export const PERSONAL_CONTEXT_QUESTIONS: readonly ContextQuestion[] = [
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
export const PERSONAL_CONTEXT_EXTRA_QUESTIONS: readonly ContextQuestion[] = [
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

export const ALL_PERSONAL_CONTEXT_QUESTIONS: readonly ContextQuestion[] = [
  ...PERSONAL_CONTEXT_QUESTIONS,
  ...PERSONAL_CONTEXT_EXTRA_QUESTIONS,
];

/**
 * An assistant's own questions in a personal space. Same ids and prompt
 * labels as the business set - so saving, composing and every stored answer
 * work unchanged - asked in words that fit a person rather than a company.
 */
export const PERSONAL_AGENT_CONTEXT_QUESTIONS: readonly ContextQuestion[] = [
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

/** Every question set a space of this kind uses, by where it is asked. */
export function contextQuestionsFor(kind: SpaceKind) {
  return kind === "personal"
    ? {
        core: PERSONAL_CONTEXT_QUESTIONS,
        extra: PERSONAL_CONTEXT_EXTRA_QUESTIONS,
        all: ALL_PERSONAL_CONTEXT_QUESTIONS,
        agent: PERSONAL_AGENT_CONTEXT_QUESTIONS,
      }
    : {
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
  kind?: SpaceKind;
}): string {
  const project = (input.projectContext ?? "").trim();
  const agent = (input.agentContext ?? "").trim();
  if (!project) return agent;
  if (!agent) return project;
  const shared =
    input.kind === "personal"
      ? "About the person you work for - shared by all of their assistants"
      : "About this company and its customers - shared by every agent here";
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

/** Whether the four core questions for this kind of space are answered: the bar for publishing an agent. */
export function hasCoreContext(
  project: { context: string | null; contextAnswers: unknown },
  kind: SpaceKind,
): boolean {
  const { core } = contextQuestionsFor(kind);
  const answers = answersFor(project.contextAnswers, project.context, core);
  return answeredCount(answers, core) === core.length;
}
