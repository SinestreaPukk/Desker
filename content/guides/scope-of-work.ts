export const guide = {
  audience: "business",
  slug: "scope-of-work",
  title: "Give an agent work to do on its own",
  summary: "Objectives, a trigger, and the flow view that shows what a run will actually do.",
  minutes: 2,
  body: `A scope of work is what an agent does when nobody is talking to it. One per agent, edited under **Work & schedule** in the editor - the first tab, with a summary of when it runs above every tab.

## Objectives

One per line, concrete enough to check afterwards:

> Research what competitors announced this week
> Draft a LinkedIn post about the warranty and queue it for approval

Vague objectives produce vague runs. "Help with marketing" is not an objective; the line above is.

## A trigger

- **Only when I run it** - nothing happens until you press Run now. The right default while you are still watching it.
- **On a schedule** - a cadence in the agent's own timezone. A missed tick is caught up on the next pass; an outage never replays every tick it slept through.
- **When an event arrives** - a private webhook URL. Whatever JSON you POST is handed to the agent as the event to act on. The URL is the whole credential, so treat it like a password.

## Work tools

Tick only what the job needs. Research and drafting are harmless; publishing and email are the two that can reach the outside world, and they wait for you unless you say otherwise under **Trust**.

An agent with no tools can only write a report.

## View as flow

The header of that panel has a **Flow** toggle. It draws the same configuration as a small diagram: what starts a run, the agent, one node per tool it may use, the approval gate when any tool can reach outside, and where the result lands.

Click any node to edit that setting - it opens the same control the form has, so the two views can never disagree. Nodes cannot be added, removed or rewired: the shape comes from the configuration, not the other way round. Every agent opens in the form view; the flow is there for when you have a few tools wired up and want the bird's-eye.

## Watching the first runs

Start with **Run now** and read the summary the agent writes afterwards. Once two or three runs look right, give it a cadence.`,
} as const;
