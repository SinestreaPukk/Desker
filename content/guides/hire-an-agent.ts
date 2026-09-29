/**
 * Guides are markdown, kept one file per guide, read in two places: the help
 * panel inside the app and the public /guides pages. They are TypeScript
 * modules rather than loose .md files so both readers - one of them a client
 * component - can import the same source without a filesystem read or a build
 * step. The body below is plain markdown; nothing but the wrapper is code.
 *
 * `audience` decides whose help panel lists it: a business space, a personal
 * space, or both.
 */
export const guide = {
  slug: "hire-an-agent",
  audience: "business",
  title: "Hire your first agent",
  summary: "Pick a role, make it yours, and try it before it works on its own.",
  minutes: 2,
  body: `An agent is a member of your staff with one job: research, marketing, sales, support, operations. It reads its job description before everything it does, works on its own on a schedule, and brings you anything that would leave the business.

## Pick a role, then make it yours

The wizard opens on the business roles - Researcher, Marketer, Sales rep, Support, Assistant and the rest. Picking one fills in a personality, responsibilities, a rule for when to stop and ask you, a schedule and the tools that job needs. It is a starting point, not a commitment: change any of it.

Starting from scratch is the last card. Take it when none of the roles is close.

## Say who it is

**Name** and **Job title** are how the rest of the team knows it: on the roster, in Team chat, in hand-offs between agents and in every report. A first name and a role people recognise - "Sol, Research Analyst" - reads better than "Research Bot".

**Personality** is the one field worth writing yourself. Two or three sentences on how it should sound and what it should never do:

> Precise and plain-spoken. Leads with the finding, cites its sources, and says so when the evidence is thin.

## Give it something to know

Without documents it works from general knowledge, which is not your pricing or your brand guide. Upload what the job needs under **Knowledge**: a brief, a price list, a style guide, meeting notes. Once a document is ready the agent searches it and names the file it used.

## Give it work and a schedule

Under **Work & schedule** set its goals and when it runs - every Friday at four, every weekday morning, or when an event arrives. That is what makes it staff rather than a chat box: see [scope of work](/guides/scope-of-work).

## Try it, then publish

The chat beside the editor is a private trial. Ask it what you would ask a new hire on day one. If an answer is off, the fix is almost always a document or a line of personality.

**Publish** switches it on: it runs on its schedule, answers in **Team**, and colleagues can hand it work. Roles that talk to people outside - support, onboarding, sales - can also get a shareable chat link and a website widget under **Sharing & model**. That part is optional; most roles never need it.`,
} as const;
