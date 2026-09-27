import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/legal-page";
import { pageMetadata } from "@/lib/content";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = pageMetadata({
  title: "Privacy Policy",
  description: `What ${LEGAL.companyName} collects, why, who else processes it, how long it is kept, and how to ask for a copy or its deletion.`,
  path: "/privacy",
});

/**
 * TEMPLATE TEXT - see terms/page.tsx. The processing described here is what
 * the product actually does; the legal framing is for counsel to finish.
 */
export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro={`What ${LEGAL.companyName} collects, why, and who else sees it.`}
    >
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
        <li>Integrations you connect (a publishing webhook, an email provider, Google Calendar, Slack, GitHub) receive exactly what your agents send them, after your approval unless you allowed that tool to act on its own.</li>
        <li>An error-monitoring service may receive technical error reports without request bodies or message content.</li>
      </ul>

      <h2>Cookies, tracking and recordings</h2>
      <p>
        We set one cookie, to keep you signed in. There is no advertising or analytics tracking,
        no session recording, and the site loads no fonts or scripts from other companies&rsquo;
        servers: everything is served from our own domain.
      </p>

      <h2>Emails and unsubscribing</h2>
      <p>
        Emails your agents send, and agent reports you choose to have emailed, go out from your
        organisation through the email provider you connect. Each one names your business, gives
        its postal address, and has an unsubscribe link. Anyone who unsubscribes is taken off that
        organisation&rsquo;s list straight away and is not emailed by its agents again.
      </p>

      <h2>Children</h2>
      <p>
        We do not knowingly collect personal data from children under 13 (or the higher age your
        country sets). If you believe a child has given us personal data, write to{" "}
        {LEGAL.contactEmail} and we will delete it.
      </p>

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
    </LegalPage>
  );
}
