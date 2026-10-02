export const guide = {
  slug: "approvals",
  title: "Approve what goes out",
  summary: "Nothing leaves until you say so. Here is where it waits and what your options are.",
  minutes: 2,
  body: `Every agent and assistant starts in draft-only mode: it can research, write and queue work, but anything that would leave - an email, a post, a calendar event, a Slack message - stops for you.

## Where things wait

**Needs you**, at the top of the sidebar, is the one place anything waits for a person. Approvals come first: every run holding a post, an email, a calendar event or a message, with the full text - not a summary - and the agent's own account of why it is asking.

The run itself, under **Work**, says it is waiting and links straight back here. Decisions are only ever made in Needs you, so there is one list to clear, not two.

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

> Escalate if a request involves money, a legal commitment, or anything you haven't done before.

The agent judges it from what actually happens in its work or a chat, not from keywords. When it fires, the item lands in **Needs you** marked *Escalated*, with the agent's reason - and the run carries on with whatever is still safe to do.

## If nothing is waiting

An empty Needs you means nothing is waiting on you: no approval, no flag, no failed run, no question. When an agent proposes a next step, it lands there too, as a question to accept, snooze or dismiss.`,
} as const;
