export const guide = {
  slug: "integrations",
  title: "Connect email and publishing",
  summary: "How work leaves Desker and comes in - what each connection does, and what it doesn't.",
  minutes: 2,
  body: `Integrations live under **Integrations**, per space. Until one is connected an agent can still research and draft - it simply has nowhere to send anything, and says so in its report.

## Email

Email goes through Resend. Paste an API key and the from-address you have verified with them.

## Publishing posts

Desker doesn't post to LinkedIn, X or Instagram by itself. It sends each post you approve - title, text and platform - to a webhook address, and a Zapier or Make zap (or your own code) does the posting. That zap is where images, scheduling and which account it goes to are decided.

When a signing secret is set, every delivery carries an \`X-Desker-Signature\` header - \`sha256=\` and an HMAC of the exact body - so your endpoint can ignore anything that didn't come from Desker. Desker never sees replies, likes or reach afterwards.

## Testing without an audience

Point a webhook at a request-bin style URL first. Then approve what arrives in **Needs you** and check the delivery line on the run under **Work**.

## Keys and secrets

Endpoints, signing secrets and API keys are encrypted with the deployment's vault key and are never returned to the browser, written to a log, or put in an audit row. You can replace a connection at any time; you cannot read a secret back out of it.`,
} as const;
