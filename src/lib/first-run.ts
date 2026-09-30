/**
 * The first run: one named workflow per kind of space, what it produces, and
 * a sample run of it on example data - shown before anyone is asked to set
 * up an agent from a blank state. The two are the product's wedges: support
 * answered from your own documents, and a weekly plan from your calendar.
 *
 * Pure and free of server imports.
 */
import type { SpaceKind } from "@/lib/space";

/** One of the four controls, shown at the moment it applies. */
export type ControlKind = "sees" | "drafts" | "approval" | "review";

export const CONTROL_LABELS: Record<ControlKind, string> = {
  sees: "What it can see",
  drafts: "What it may do",
  approval: "What needs you",
  review: "Review and undo",
};

export interface SampleStep {
  title: string;
  /** What happens at this step, in one or two sentences. */
  body: string;
  control: { kind: ControlKind; text: string };
}

export interface SampleDecision {
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
  audience: SpaceKind;
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

export const FIRST_RUNS: Record<SpaceKind, FirstRun> = {
  business: {
    audience: "business",
    name: "Answer a customer from your policy, and hand uncertain cases to a person",
    result: "A reply drafted from your own policy, waiting for your yes - and anything the policy doesn't settle, handed to you.",
    templateId: "customer-support",
    workflowId: "question-to-answer",
    material: {
      label: "Returns policy (example)",
      lines: [
        "Unopened items can be returned within 60 days of delivery for a full refund.",
        "Opened items can be returned within 30 days if they work and are complete.",
        "Faulty items are repaired or replaced under the 2-year warranty.",
        "Refunds go back to the original payment method within 5 working days.",
      ],
    },
    trigger: {
      label: "New message from jo@example.com",
      text: "Hi - I bought a cordless drill 40 days ago and never opened it. Can I still send it back?",
    },
    steps: [
      {
        title: "Reads the question and your policy",
        body: "It looks the question up in the documents you gave it. The unopened-returns rule answers it: 60 days, and Jo is at 40.",
        control: {
          kind: "sees",
          text: "Only the documents you uploaded and this one message. Not your other files, and not other customers' messages.",
        },
      },
      {
        title: "Drafts a reply, citing the rule",
        body: "It writes a short reply in your voice and notes which part of the policy it relied on, so you can check it in seconds.",
        control: {
          kind: "drafts",
          text: "It may write drafts. It has no way to send on its own: sending is a separate step that stops for you.",
        },
      },
      {
        title: "Stops and waits for you",
        body: "The reply goes to Needs you with its full text. Approve it, edit it first, or reject it with a reason.",
        control: {
          kind: "approval",
          text: "Every reply waits for your approval. You can let a tool run on its own later, one tool at a time, once it has earned it.",
        },
      },
      {
        title: "Leaves a record",
        body: "What it read, what it drafted and who approved it is logged. A reason you give when rejecting can become a rule it follows next time.",
        control: {
          kind: "review",
          text: "Everything it did is in the Audit log. A failed or rejected run can be retried, and nothing it drafted is sent until you approve it.",
        },
      },
    ],
    decision: {
      label: "Reply to jo@example.com",
      title: "Re: returning an unopened drill",
      body:
        "Hi Jo,\n\nYes - unopened items can be returned within 60 days of delivery, so you're well within time. Reply with your order number and we'll send you a free returns label. Your refund goes back to your card within 5 working days of it reaching us.\n\nThanks,\nThe support team",
      source: "Returns policy: \"Unopened items can be returned within 60 days of delivery for a full refund.\"",
      onApprove: "The reply would go to jo@example.com.",
    },
    handoff: {
      label: "New message from sam@example.com",
      text: "The battery on my drill got very hot and started smoking. I want compensation for my workbench.",
      reason:
        "Handed to you: the policy covers repairing or replacing a faulty item, not damage to other property - and this may be a safety issue. It drafted nothing.",
    },
    connection: {
      connectors: ["support_inbox"],
      name: "Support inbox",
      withIt: [
        "Every message your helpdesk, website form or Zapier sends in is answered from your documents",
        "Each reply waits in Needs you; anything uncertain comes straight to you",
        "Your helpdesk hears back when a ticket is answered or needs a person",
      ],
      without: "Without it, paste a customer's question here and it answers the same way.",
    },
  },
  personal: {
    audience: "personal",
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
  },
};

export function firstRunFor(kind: SpaceKind): FirstRun {
  return FIRST_RUNS[kind];
}
