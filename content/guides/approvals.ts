export const guide = {
  slug: "approvals",
  title: "Approve what an agent wants to send",
  summary: "Nothing reaches a client until you say so. Here is where it waits and what your options are.",
  minutes: 2,
  body: `Every agent starts in draft-only mode: it can research, write and queue work, but anything that would leave the building stops for you.

## Where things wait

**Inbox → Approvals** lists every run that is holding something: a post for a connected publishing webhook, or an email. You see the full text, not a summary of it, along with the agent's own account of why it is asking.

The same card appears under **Work** on the run itself, so you can approve from wherever you noticed it.

## Your three options

- **Approve** sends exactly that one thing. The run finishes and the delivery is recorded.
- **Edit and approve** - change the title, the body or the recipients first. Your edit is what goes out.
- **Reject** closes it with a reason and nothing is sent. The draft survives, and the toast offers an undo for a moment if you clicked it by mistake.

Every decision is an audit row with your name on it.

## Extending trust

**Trust** on the scope of work decides what needs you at all. It has an agent-wide setting plus a per-tool override, so posts can flow while emails still wait. Research and drafting never wait, whatever you choose - they cannot reach anyone.

Move one tool at a time, once the agent has earned it, and check the audit log afterwards.

## Escalation rules

An escalation rule is a plain sentence about when to fetch a person:

> Escalate if the client is angry, asks for a refund over $200, or mentions legal action.

The agent judges it from what actually happens in the conversation or the run, not from keywords. When it fires, the item lands in **Inbox → Issues & suggestions** marked *Escalated*, with the agent's reason - and the run carries on with whatever is still safe to do.

## If nothing is waiting

An empty Approvals tab means no agent is holding anything. Anything an agent proposes on its own - a next step it thinks you should take - shows up as a suggestion instead.`,
} as const;
