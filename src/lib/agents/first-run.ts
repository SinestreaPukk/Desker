/**
 * The first run: one named workflow, what it produces, and a sample run of
 * it on example data - shown before anyone is asked to set up an agent from
 * a blank state. The wedge: a weekly plan from your calendar.
 *
 * Pure and free of server imports.
 */
/** One of the four controls, shown at the moment it applies. */
export type ControlKind = "sees" | "drafts" | "approval" | "review";

export const CONTROL_LABELS: Record<ControlKind, string> = {
  sees: "What it can see",
  drafts: "What it may do",
  approval: "What needs you",
  review: "Review and undo",
};

interface SampleStep {
  title: string;
  /** What happens at this step, in one or two sentences. */
  body: string;
  control: { kind: ControlKind; text: string };
}

interface SampleDecision {
  /** Who or what it is about, e.g. "Reply to jo@example.com". */
  label: string;
  title: string;
  body: string;
  /** Where it came from: the passage, or the calendar entries it read. */
  source: string;
  /** What approving would have done, had this not been example data. */
  onApprove: string;
}

export interface FirstRun {
  /** The workflow, named the way the owner would say it. */
  name: string;
  /** The result, in one line: what the owner holds at the end. */
  result: string;
  /** The role it is built on (content/templates.json). */
  templateId: string;
  /** The named workflow a real first run starts, when there is one (workflows.ts). */
  workflowId: string | null;
  /** The example data the sample run works from. */
  material: { label: string; lines: string[] };
  /** The message or trigger that starts the sample run. */
  trigger: { label: string; text: string };
  steps: SampleStep[];
  /** What waits in Needs you at the end. */
  decision: SampleDecision;
  /** The other outcome the sample shows: a case handed to a person. */
  handoff: { label: string; text: string; reason: string } | null;
  /** The one connection that makes it real, and what it does before and after. */
  connection: {
    /** Connector ids that satisfy it (catalog.ts), best first. */
    connectors: string[];
    name: string;
    withIt: string[];
    without: string;
  };
}

export const FIRST_RUN: FirstRun = {
  name: "Review your week and draft a plan, with calendar changes waiting for your approval",
  result: "Next week in a few lines - clashes, free time, what's coming up - with any change to your calendar waiting for your yes.",
  templateId: "personal-assistant",
  workflowId: null,
  material: {
    label: "Next week's calendar (example)",
    lines: [
      "Mon 18:30 · Gym",
      "Tue 12:30 · Lunch with Priya",
      "Wed 18:00 · Gym",
      "Wed 18:30 · Parents' evening at school",
      "Thu 19:00 · Sam's birthday dinner",
      "Sat 10:00 · Car service",
    ],
  },
  trigger: { label: "Sunday, 18:00", text: "Plan the week ahead." },
  steps: [
    {
      title: "Reads next week's calendar",
      body: "Six events. Wednesday's gym session runs into parents' evening, and Friday is completely free.",
      control: {
        kind: "sees",
        text: "Your calendar, and only for the week it is planning. It reads your email only if you connect it and allow that.",
      },
    },
    {
      title: "Writes the plan",
      body: "Busy Tuesday and Thursday; one clash on Wednesday evening; Friday free. Sam's birthday is Thursday and there is no gift on your list yet.",
      control: {
        kind: "drafts",
        text: "It may read your calendar and write the plan. Adding or moving anything in your calendar is a separate step that stops for you.",
      },
    },
    {
      title: "Suggests one change, and waits",
      body: "Moving Wednesday's gym session to Friday clears the clash. It asks first; nothing in your calendar changes until you approve.",
      control: {
        kind: "approval",
        text: "Every calendar change waits for your approval. Anything to do with paying, signing or agreeing to a date is always yours.",
      },
    },
    {
      title: "Does it again next Sunday",
      body: "The plan arrives every Sunday evening. What it did each week is kept, so you can see what it changed and when.",
      control: {
        kind: "review",
        text: "Every change it made, and who approved it, is in the Audit log. Your space is private: nobody else can see it.",
      },
    },
  ],
  decision: {
    label: "Calendar change",
    title: "Move Gym from Wed 18:00 to Fri 18:00",
    body: "Wednesday's gym session overlaps parents' evening at 18:30. Friday evening is free, so moving it there keeps your three sessions this week.",
    source: "Calendar: \"Wed 18:00 · Gym\" and \"Wed 18:30 · Parents' evening at school\".",
    onApprove: "Gym would move to Friday 18:00 in your calendar.",
  },
  handoff: null,
  connection: {
    connectors: ["google_calendar", "outlook_calendar"],
    name: "Calendar",
    withIt: [
      "Every Sunday it reads next week and writes you the plan",
      "Clashes are spotted, with a suggested fix that waits for your yes",
      "Birthdays, renewals and deadlines on your calendar get flagged ahead",
    ],
    without: "The plan is built from your calendar, so this is the one step it can't do without.",
  },
};

