import type { Metadata } from "next";
import { LegalPage } from "@/components/marketing/legal-page";
import { pageMetadata } from "@/lib/content";
import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = pageMetadata({
  title: "Privacy Policy",
  description: `What ${LEGAL.companyName} collects, why, who else processes it, how long it is kept, and how to download or delete all of it yourself.`,
  path: "/privacy",
});

/**
 * Every promise here is one the product keeps in code: the export and delete
 * buttons (lib/account.ts), the private personal space (no invitations, no
 * public chat - lib/conversation.ts), masked statement numbers
 * (lib/money/statement.ts). Change the code and this page together. Counsel
 * should still review the legal framing before general availability.
 */
export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro={`${LEGAL.companyName} holds some of the most personal things you have: your plans, your messages, sometimes your money. This is exactly what we collect, why, who else sees it, and how you take it back.`}
    >
      <h2>The short version</h2>
      <ul>
        <li>We use your data to run your assistants and agents for you. That is the only reason we have it.</li>
        <li>We never sell it, never use it for advertising, and never use it to train AI models - ours or anyone else&rsquo;s.</li>
        <li>A personal space is yours alone: nobody can be invited into it and its assistants have no public link.</li>
        <li>Nothing leaves on your behalf without your approval, unless you switch that on yourself for a specific tool.</li>
        <li>You can download everything, or delete everything, yourself, at any time, from inside the app.</li>
      </ul>

      <h2>Business spaces and personal spaces</h2>
      <p>
        {LEGAL.companyName} has two kinds of space. A <strong>business space</strong> is for a company and its
        team: agents there may talk to that business&rsquo;s clients and hold the clients&rsquo; messages. For
        that client data the business decides what is collected and why, and we process it on the business&rsquo;s
        instructions; clients with a request about it should contact the business, and we will help the business
        answer. A <strong>personal space</strong> is for one person&rsquo;s own life. It has one member, cannot be
        shared, and its assistants cannot be reached from outside it. For your account and your personal space we
        are responsible for your data as described here.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Your account:</strong> name, username, email address, a one-way hash of your password (never the
          password itself), what you told us Desker is for, and when you accepted these terms.
        </li>
        <li>
          <strong>What you tell your assistants and agents:</strong> your answers to the setup questions (about your
          business, or about you), their instructions, schedules and objectives.
        </li>
        <li>
          <strong>Documents you upload:</strong> the files and the text extracted from them, so agents can search
          them. In a CSV file (usually a bank or card statement), long numbers such as account and card numbers are
          masked to their last four digits as the file is read, before the text is stored for search or seen by
          any AI model.
        </li>
        <li>
          <strong>Work and conversations:</strong> chats with your agents, the work they do, what they draft,
          research findings, digests and suggestions; in a business space, conversations with its clients.
        </li>
        <li>
          <strong>Records:</strong> an audit log of what people and agents did and when, and simple product usage
          events (which screens and features are used) kept on our own servers.
        </li>
        <li>
          <strong>Connections you choose to make:</strong> for connected apps (a calendar, an email provider, Slack)
          we keep the access credentials, encrypted.
        </li>
        <li>
          <strong>Billing:</strong> your plan and its status. Card details go straight to our payment provider; we
          never see or store your card number.
        </li>
        <li>
          <strong>Messages to us:</strong> feedback you send from inside the product and what you write on the
          contact or beta forms.
        </li>
      </ul>

      <h2>Sensitive information in a personal space</h2>
      <p>
        A personal assistant is most useful when it knows about your life, and that can include your finances,
        your health, your family or your work. You decide what to share; nothing is required beyond your account
        details. We use it only to do what you asked the assistant to do. Please never enter passwords, full card
        or account numbers, or government ID numbers: no assistant needs them, and the product never asks. The
        money manager adds up statements on our servers, so its figures are exact rather than estimated by an AI,
        and account and card numbers in a statement are masked before any AI model reads it.
      </p>

      <h2>How we use it</h2>
      <ul>
        <li>To run the service: answer your chats, carry out scheduled and requested work, search your documents, send the digests and emails you approve.</li>
        <li>To keep it safe and working: preventing abuse, rate-limiting, fixing errors, and keeping the audit log you can read.</li>
        <li>To bill the plan you chose.</li>
        <li>To decide what to improve, from usage counts and the feedback you send - never by reading your content.</li>
      </ul>
      <p>
        We do not sell personal data, share it for advertising, or build profiles of you. Your content is not used
        to train AI models. Staff do not read your spaces; the exception is when you ask us for help with a
        specific problem, or when the law requires it, and then only what is needed.
      </p>

      <h2>Who else processes it</h2>
      <p>We use a small set of providers, each only for its part of running the service:</p>
      <ul>
        <li>
          <strong>AI model providers</strong> (Anthropic; OpenAI if you choose one of its models, and for document
          search indexing) receive the text needed for each reply or task. Under their business API terms they do
          not train on it, and keep it only for a limited period for abuse and safety monitoring.
        </li>
        <li><strong>A web search provider</strong> (Brave or Tavily) receives the search queries an agent makes - never your documents.</li>
        <li><strong>Hosting, database and background jobs</strong> (Vercel, Neon, Inngest) store and process data to run the service.</li>
        <li><strong>Email delivery</strong> (Resend) sends account emails such as password resets, and the digests you ask for.</li>
        <li><strong>Payments</strong> (Stripe) handles subscriptions and card details.</li>
        <li><strong>Error monitoring</strong> (Sentry) receives technical error reports, without message content or request bodies.</li>
        <li>
          <strong>Apps you connect</strong> receive exactly what an agent sends them, after your approval unless you
          allowed that tool to act on its own.
        </li>
      </ul>
      <p>
        Some of these providers are based in, or store data in, the United States and other countries. Where
        data leaves your country we rely on the provider&rsquo;s contractual commitments to protect it.
      </p>

      <h2>Cookies and tracking</h2>
      <p>
        We set one cookie, to keep you signed in. Your browser also remembers a few display preferences (like the
        colour theme and the setup checklist) on your own device. There is no advertising or third-party
        analytics tracking and no session recording.
      </p>

      <h2>Email your agents send</h2>
      <p>
        Email from a business space goes out as that business, with its name, its postal address and an
        unsubscribe link; anyone who unsubscribes is not emailed by its agents again. Email from a personal space
        is written as you, to people you choose, and only with your approval unless you have switched that on.
      </p>

      <h2>How long we keep it</h2>
      <ul>
        <li>Your data stays while your account and spaces exist.</li>
        <li>Deleting a document, a chat or an agent removes it from the service straight away.</li>
        <li>
          Deleting your account removes it and every space you alone own - documents, chats, work, drafts, history
          and connected-app credentials - immediately. Copies in our database provider&rsquo;s backups expire on
          its normal schedule and are never restored except to recover from an outage.
        </li>
        <li>If you are a member of a business space someone else owns, deleting your account removes you from it; that business keeps its own records, such as the audit log of work done there.</li>
        <li>We keep billing records as long as tax law requires.</li>
      </ul>

      <h2>Your rights, as buttons</h2>
      <p>
        Wherever you live, you can do these yourself, without writing to us: open <strong>Your space</strong> (or
        <strong> Organisation</strong> in a business) and use <strong>Download my data</strong> for a complete
        copy of your account and the spaces you own, as a machine-readable file; or <strong>Delete my
        account</strong> to erase it. You can correct anything by editing it in the app. You may also ask us to
        restrict or stop a particular use of your data, or ask any question about it, at {LEGAL.contactEmail};
        we answer within 30 days. If you are unhappy with our answer you can complain to your data protection
        authority (in Thailand, the Personal Data Protection Committee; in the EU or UK, your national regulator).
      </p>

      <h2>Security</h2>
      <p>
        Everything travels over HTTPS. Passwords are stored as one-way hashes, password-reset links as hashes too,
        and connected-app credentials are encrypted at rest (AES-256-GCM) and decrypted only at the moment of use.
        Model and search keys never leave our servers. Every space is reachable only by its members, and a personal
        space only by you. If a breach ever puts your data at risk, we will tell you and the authorities as the law
        requires.
      </p>

      <h2>Children</h2>
      <p>
        {LEGAL.companyName} is not for children under 13 (or the higher age your country sets). If you believe a
        child has given us personal data, write to {LEGAL.contactEmail} and we will delete it.
      </p>

      <h2>Changes and contact</h2>
      <p>
        When this policy changes in a way that matters, we will tell you in the app and by email before it takes
        effect, and the version at the top of this page will change. Questions about privacy:{" "}
        {LEGAL.contactEmail}.
      </p>
    </LegalPage>
  );
}
