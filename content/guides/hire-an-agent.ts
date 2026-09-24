/**
 * Guides are markdown, kept one file per guide, read in two places: the help
 * panel inside the app and the public /guides pages. They are TypeScript
 * modules rather than loose .md files so both readers - one of them a client
 * component - can import the same source without a filesystem read or a build
 * step. The body below is plain markdown; nothing but the wrapper is code.
 */
export const guide = {
  slug: "hire-an-agent",
  title: "Hire your first agent",
  summary: "Name it, give it a job, and talk to it before anyone else does.",
  minutes: 2,
  body: `An agent is a job description the model reads before every message. Three short steps and it can answer clients.

## Pick a role, then make it yours

The wizard opens on the role templates - Customer support, Researcher, Marketer and the rest. Picking one fills in a personality, a set of responsibilities, an escalation rule and the tools that role needs. It is a starting point, not a commitment: change any of it.

Starting from scratch is the last card. Take it when none of the roles is close.

## Say who it is

**Name** and **Job title** are what clients see at the top of the chat. Use a first name and a role people recognise - "Mia, Customer Support Lead" reads better than "Support Bot v2".

**Personality** is the one field worth writing yourself. Two or three sentences on how it should sound and what it should never do:

> Warm but efficient. Answers in two or three sentences, never uses corporate filler, and says plainly when something isn't possible rather than hedging.

## Give it something to know

An agent with no documents answers from the model's general knowledge, which is not your returns policy. Upload what it needs under **Knowledge**: a policy, a price list, an FAQ. Processing takes a moment; once a document is ready the agent searches it before answering and cites what it used.

## Try it, then publish

The live preview on the right of the editor is the same runtime a client gets. Ask it the three questions you get asked most. If an answer is wrong, the fix is almost always a document or a line of personality - not a different model.

**Publish** when it sounds right. You get a shareable link and an embed snippet, and only then can anyone outside your organisation reach it. A draft agent is invisible.

## What comes next

A published agent answers when it is spoken to. To have it work on its own - research, drafts, a weekly post - give it a [scope of work](/guides/scope-of-work).`,
} as const;
