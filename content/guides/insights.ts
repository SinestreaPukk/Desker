export const guide = {
  slug: "insights",
  title: "Read Insights without being an analyst",
  summary: "What the numbers on that page actually tell you, and which two are worth acting on.",
  minutes: 2,
  body: `Insights answers one question: is this working, and where is it not? Everything on the page is scoped to the project and the date range at the top.

## The numbers worth acting on

**Escalation rate** - how often an agent hands a conversation to a person. Climbing means the agent is out of its depth: usually a missing document, occasionally a job description that promises more than it knows.

**Retrieval hit rate** - how often a search of your documents found something useful. A low rate with plenty of searches means people are asking about things you have not uploaded. The **content gaps** list underneath names those questions directly; it is the most useful list on the page.

## The rest, in plain terms

- **Conversations** - how many clients the agent actually talked to.
- **Issues and suggestions** - what clients reported and what the agents raised themselves.
- **Runs** - autonomous tasks, split by finished, failed and waiting on you.
- **Approval turnaround** - how long things sit waiting for a person. That one is about you, not the agent.
- **Tokens and cost** - what the model calls cost, per agent, for the period. Cost comes from list prices; an unpriced model shows as unknown rather than free.

## Disliked replies

Clients can rate a reply. Every thumbs-down is listed with the question that produced it, so you can read the exchange and fix the cause - normally a document, sometimes a line of the agent's personality.

## A sensible weekly loop

1. Check the content gaps and upload one document that closes the biggest one.
2. Read the two most recent disliked replies.
3. Glance at the escalation rate against last week.

Ten minutes, and it compounds.`,
} as const;
