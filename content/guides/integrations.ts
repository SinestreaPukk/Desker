export const guide = {
  audience: "all",
  slug: "integrations",
  title: "Connect email, publishing and a support inbox",
  summary: "How work leaves Desker and comes in - what each connection does, and what it doesn't.",
  minutes: 2,
  body: `Integrations live under **Integrations**, per space. Until one is connected an agent can still research and draft - it simply has nowhere to send anything, and says so in its report.

## Email

Email goes through Resend. Paste an API key and the from-address you have verified with them. In a business, every agent email also carries your postal address, which the law requires, so set it under Organisation first.

## Publishing posts

Desker doesn't post to LinkedIn, X or Instagram by itself. It sends each post you approve - title, text and platform - to a webhook address, and a Zapier or Make zap (or your own code) does the posting. That zap is where images, scheduling and which account it goes to are decided.

When a signing secret is set, every delivery carries an \`X-Desker-Signature\` header - \`sha256=\` and an HMAC of the exact body - so your endpoint can ignore anything that didn't come from Desker. Desker never sees replies, likes or reach afterwards.

## A support inbox

The closed loop for support. Your helpdesk, a website form, or a zap on your support email sends each customer message to the inbox's private address. The Support agent answers it from your uploaded policies - or, when they don't settle it, hands it to you - and the reply waits in **Needs you**. Once you approve it, it is emailed to the customer, and the address you give for reporting back hears \`ticket.answered\` (or \`ticket.needs_human\`).

Its setup card lists what it still needs - a published agent, your policies, email, a postal address - so nothing fails quietly on the first customer.

## Testing without an audience

Point a webhook at a request-bin style URL first, or use **Send a test message** on the support inbox. Then approve what arrives in **Needs you** and check the delivery line on the run under **Work**.

## Keys and secrets

Endpoints, signing secrets and API keys are encrypted with the deployment's vault key and are never returned to the browser, written to a log, or put in an audit row. You can replace a connection at any time; you cannot read a secret back out of it.`,
} as const;
