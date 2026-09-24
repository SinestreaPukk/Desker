export const guide = {
  slug: "integrations",
  title: "Connect a publishing webhook or email",
  summary: "The two ways work leaves the building, and how to test one safely.",
  minutes: 2,
  body: `Integrations live under **Integrations**, per organisation. Until one is connected an agent can still research and draft - it simply has nowhere to send anything.

## A publishing webhook

Anything that accepts a JSON POST works: Zapier, Make, n8n, or your own endpoint. Paste the URL, give it a name, and optionally set a signing secret.

When a secret is set, every delivery carries an \`X-Desker-Signature\` header - \`sha256=\` followed by an HMAC of the exact body. Verify it at your end and ignore anything that fails; that is what stops somebody else posting to your endpoint.

## Email

Email goes through Resend. Paste an API key and the from-address you have verified with them. If the deployment already has a key configured, agents can send without you connecting anything.

## What a connection changes

- \`publish_post\` and \`send_email\` become available to agents whose scope of work allows them.
- Both still wait for your approval while the agent is in draft-only mode.
- Digests can be emailed as well as landing in the Inbox.

## Testing without an audience

Point the webhook at a request-bin style URL first, or at a private channel. Then:

1. Open an agent's scope of work and press **Run now**.
2. Approve what it queues under **Inbox → Approvals**.
3. Check the delivery line on the run under **Work** - it records the status your endpoint returned.

## Keys and secrets

Endpoints, signing secrets and API keys are encrypted with the deployment's vault key and are never returned to the browser, written to a log, or put in an audit row. You can replace a connection at any time; you cannot read a secret back out of it.`,
} as const;
