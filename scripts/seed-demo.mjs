#!/usr/bin/env node
/**
 * Seeds a demo organisation through the app's own API, so every row is made
 * the way a customer would make it - sign-up, wizard fields, document
 * ingestion, scope of work, a run. Idempotent: re-running signs in instead.
 *
 *   DEMO_PASSWORD=... node scripts/seed-demo.mjs https://desker-staging.vercel.app
 *
 * Prints the demo login at the end. Meant for staging; harmless locally.
 */
const base = (process.argv[2] ?? "http://localhost:3000").replace(/\/+$/, "");
const email = process.env.DEMO_EMAIL ?? "demo@northwind.example";
const password = process.env.DEMO_PASSWORD ?? "demo-password-2026";

let cookie = "";
async function call(path, init = {}) {
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: { "content-type": "application/json", cookie, ...(init.headers ?? {}) },
    redirect: "manual",
  });
  const setCookie = res.headers.getSetCookie?.() ?? [];
  if (setCookie.length) cookie = mergeCookies(cookie, setCookie);
  return res;
}
function mergeCookies(existing, incoming) {
  const jar = new Map(existing.split("; ").filter(Boolean).map((c) => c.split("=")));
  for (const c of incoming) {
    const [pair] = c.split(";");
    const [k, ...v] = pair.split("=");
    jar.set(k, v.join("="));
  }
  return [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function signIn() {
  const csrf = await (await call("/api/auth/csrf")).json();
  const body = new URLSearchParams({ csrfToken: csrf.csrfToken, email, password, callbackUrl: `${base}/` });
  await call("/api/auth/callback/credentials", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
  const session = await (await call("/api/auth/session")).json();
  if (!session?.user) throw new Error("Sign-in failed - wrong DEMO_PASSWORD for an existing demo account?");
}

const signup = await call("/api/signup", {
  method: "POST",
  body: JSON.stringify({ name: "Demo Owner", email, password, acceptTerms: true }),
});
console.log(signup.status === 409 ? "demo account exists; signing in" : `signed up (${signup.status})`);
await signIn();

const projects = await (await call("/api/projects")).json();
const project = projects[0];
console.log(`project: /p/${project.slug}`);

const agents = await (await call(`/api/agents?project=${project.slug}`)).json();
if (agents.length > 0) {
  console.log(`already seeded (${agents.length} agents). Login: ${email} / ${password}`);
  process.exit(0);
}

const mia = await (await call(`/api/agents?project=${project.slug}`, {
  method: "POST",
  body: JSON.stringify({
    name: "Mia",
    jobTitle: "Customer Support Lead",
    department: "Customer Experience",
    personality:
      "Warm but efficient. Answers in two or three sentences, never uses corporate filler, and says plainly when something isn't possible rather than hedging.",
    responsibilities: [
      "Answer questions about orders, shipping and returns",
      "Help clients find the right product",
      "Collect enough detail on a bug for engineering to reproduce it",
    ],
    allowedTools: ["search_company_context", "log_issue", "log_suggestion", "escalate_to_human"],
    escalationRule: "Escalate if the client is angry, asks for a refund over $200, or mentions legal action.",
    welcomeMessage: "Hi, I'm Mia. Ask me anything about your order, a return, or how something works.",
    status: "published",
  }),
})).json();
console.log(`agent: Mia (${mia.id})`);

const policy = `# Northwind Supply Co. - Returns and Refunds Policy

## Return window
Unused items in original packaging may be returned within 30 days of delivery for a full refund. Items returned between 31 and 60 days receive store credit.

## Restocking fee
A 15% restocking fee applies to opened power tools returned after 14 days.

## Warranty
Power tools carry a 24-month manufacturer warranty. Hand tools carry a lifetime warranty against manufacturing defects.

## How to start a return
Reply to your order confirmation email or visit any Northwind branch with your receipt.
`;
const form = new FormData();
form.append("file", new Blob([policy], { type: "text/markdown" }), "returns-policy.md");
const upload = await fetch(`${base}/api/agents/${mia.id}/documents`, { method: "POST", headers: { cookie }, body: form });
console.log(`document: returns-policy.md (${upload.status})`);

const sam = await (await call(`/api/agents?project=${project.slug}`, {
  method: "POST",
  body: JSON.stringify({
    name: "Sam",
    jobTitle: "Content Marketer",
    department: "Marketing",
    personality: "Concise and upbeat. Plain English, no hashtags, no emoji. Writes for tradespeople who are busy.",
    responsibilities: ["Write social posts and short announcements"],
    allowedTools: ["search_company_context"],
    escalationRule: "Escalate if asked to email more than 20 people at once, or if you cannot find reliable sources.",
    status: "published",
  }),
})).json();
await call(`/api/agents/${sam.id}/scope`, {
  method: "PUT",
  body: JSON.stringify({
    context:
      "We are Northwind Supply Co., a hardware store for professional tradespeople. This month we are pushing the lifetime hand-tool warranty. Tone: plain, confident, no hype.",
    objectives: [
      "Research one recent trend in the professional hand-tool market and summarise it in three bullet points.",
      "Draft one social caption (under 200 characters) that ties the lifetime warranty to that trend, and queue it with publish_post.",
    ],
    documentIds: [],
    triggerType: "cron",
    cron: "0 9 * * 1",
    timezone: "UTC",
    enabled: true,
    autonomy: "draft_only",
    toolAutonomy: null,
  }),
});
console.log(`agent: Sam (${sam.id}) with a weekly scope of work`);

const run = await (await call(`/api/agents/${sam.id}/scope/run`, { method: "POST" })).json();
console.log(`run started: ${run.id ?? JSON.stringify(run)}`);

console.log(`\nDemo login: ${email} / ${password}\n${base}/p/${project.slug}/roster`);
