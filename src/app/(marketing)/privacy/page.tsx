import type { Metadata } from "next";
import { LEGAL, TERMS_VERSION } from "@/lib/legal";

export const metadata: Metadata = { title: "Privacy Policy" };

/**
 * TEMPLATE TEXT - see terms/page.tsx. The processing described here is what
 * the product actually does; the legal framing is for counsel to finish.
 */
export default function PrivacyPage() {
  return (
    <>
      <h1>Privacy Policy</h1>
      <p>
        Version {TERMS_VERSION}. This policy explains what {LEGAL.companyName} collects, why, and
        who else sees it.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>Account data: your name, email address and a hash of your password.</li>
        <li>Organisation data: members, roles, invitations, plan and billing status.</li>
        <li>Content you provide: agent configuration, uploaded documents, scopes of work.</li>
        <li>Conversations between your agents and your clients, and the work your agents produce, including drafts and research findings.</li>
        <li>An audit log of actions taken by people and agents, and product usage events (which screens and features are used).</li>
        <li>Feedback you send from inside the product.</li>
      </ul>

      <h2>How we use it</h2>
      <p>
        To operate the Service for you: answering your clients, running your agents&rsquo;
        work, metering your plan, and showing you what happened. Usage and feedback are used to
        decide what to improve. We do not sell personal data and do not use your content to train
        models.
      </p>

      <h2>Who else processes it</h2>
      <ul>
        <li>Model providers (Anthropic, and OpenAI if you choose it) receive the content needed to generate a reply or carry out a task.</li>
        <li>A web search provider (Brave or Tavily) receives search queries an agent makes.</li>
        <li>Our hosting, database and job-runtime providers (Vercel, Neon, Inngest) store and process data to run the Service.</li>
        <li>Our payment provider (Stripe) handles payment details; we never see your card number.</li>
        <li>Integrations you connect (a publishing webhook, an email provider) receive exactly what your agents send them after your approval.</li>
        <li>An error-monitoring service may receive technical error reports without request bodies or message content.</li>
      </ul>

      <h2>Security</h2>
      <p>
        Integration credentials are encrypted at rest and decrypted only at the moment of use.
        Model and search keys never leave the server. Access to your organisation requires a
        membership with a role.
      </p>

      <h2>Retention and your rights</h2>
      <p>
        Data is kept while your organisation exists and deleted when it is closed, subject to
        backups and legal obligations. You can ask for a copy of your data or its deletion at{" "}
        {LEGAL.contactEmail}. Your clients&rsquo; messages to your agents are your data; requests
        about them should come to us through you.
      </p>

      <h2>Changes and contact</h2>
      <p>
        We will announce material changes in the Service. Questions about privacy:{" "}
        {LEGAL.contactEmail}.
      </p>
    </>
  );
}
