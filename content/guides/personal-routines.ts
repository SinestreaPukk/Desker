export const guide = {
  audience: "personal",
  slug: "personal-routines",
  title: "Put an assistant on a routine",
  summary: "A goal, a time, and what it may do - so the work happens without you asking.",
  minutes: 2,
  body: `An assistant that only answers when you ask is a chat box. A routine is what makes it help: the Monday money check-in, the Sunday plan for the week, the morning list of new jobs. It lives under **Work & schedule** in the assistant's editor.

## Goals, one per line

Concrete enough to check afterwards:

> Every Monday, add up last week's spending and compare it with my budget
> List subscriptions I haven't used in two months

"Help me with money" is not a goal; the lines above are.

## When it runs

- **Only when I run it** - nothing happens until you press **Run now**. The right choice while you are still getting to know it.
- **On a schedule** - every Monday at 08:00, every weekday at 07:00, in your own time zone.
- **When an event arrives** - a private web address another app can call, for people who automate. Treat the address like a password.

## What it may do

Reading your documents, researching the web, drafting and adding up statements are always safe - they touch nothing outside. Sending an email, posting, or adding a calendar event waits for your yes unless you allow it under **Trust**. There is no tool for paying, buying or booking, so no assistant can do those at all.

## See it as a flow

The **Flow** toggle draws the routine as a diagram: what starts it, the assistant, each thing it may do, and where you get a say. Click any step to change it.

## Watch the first runs

Press **Run now** and read the short report it writes. Once two or three look right, give it a schedule and let it get on with it.`,
} as const;
