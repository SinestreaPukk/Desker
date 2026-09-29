export const guide = {
  audience: "business",
  slug: "insights",
  title: "Read Insights without being an analyst",
  summary: "What the numbers on that page actually tell you, and which two are worth acting on.",
  minutes: 2,
  body: `Insights answers one question: is this working, and where is it not? Everything on the page is scoped to the project and the date range at the top.

## The numbers worth acting on

**Escalation rate** - how often an agent stops and hands something to a person. Climbing means the agent is out of its depth: usually a missing document, occasionally a job description that promises more than it knows.

**Retrieval hit rate** - how often a search of your documents found something useful. A low rate with plenty of searches means people are asking about things you have not uploaded. The **content gaps** list on the **Detailed Insights** page names those questions directly; it is the most useful diagnostic list available.

## The rest, in plain terms

- **Tokens used** - exactly how many input and output model tokens your agents consumed over the period.
- **Tasks done on their own** - autonomous tasks, split by finished, failed, and waiting on your approval.
- **Collaboration between agents** - how many tasks and conversations your agents handed off or delegated to specialized colleagues.
- **What each agent did on its own** - independent performance breakdown per employee, including tokens and cost.
- **Approval turnaround** - how long things sit waiting for a person. That one is about you, not the agent.

## Detailed Insights & Disliked replies

For deeper analysis, click **View Detailed Insights** at any time. Anyone chatting with a published agent can rate a reply; each thumbs-down is listed with the question that produced it so you can inspect the transcript and close the gap.

## A sensible weekly loop

1. Check the executive Insights dashboard to review tokens used, autonomous tasks finished, and agent collaborations.
2. Open Detailed Insights to check content gaps and upload one document closing the biggest gap.
3. Review any disliked replies and glance at the escalation rate.

Ten minutes, and it compounds.`,
} as const;
