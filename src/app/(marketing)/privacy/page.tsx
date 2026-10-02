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
        <li>Google data (Calendar and Gmail) is used only to check clashes, schedule meetings, and draft replies you approve. It is not sold, not used for ads, and not used to train AI models.</li>
        <li>A personal space is yours alone: nobody can be invited into it and its assistants have no public link.</li>
        <li>Nothing leaves on your behalf without your approval, unless you switch that on yourself for a specific tool.</li>
        <li>You can download everything, or delete everything, yourself, at any time, from inside the app.</li>
      </ul>

      <h2>Your personal space</h2>
      <p>
        Your space is for your own life. It has one member, cannot be shared, and its assistants cannot be
        reached from outside it. For your account and your space we are responsible for your data as described
        here.
      </p>

      <h2>What we collect</h2>
      <ul>
        <li>
          <strong>Your account:</strong> name, username, email address, a one-way hash of your password (never the
          password itself), and when you accepted these terms.
        </li>
        <li>
          <strong>What you tell your assistants and agents:</strong> your answers to the setup questions (about you), their instructions, schedules and objectives.
        </li>
        <li>
          <strong>Documents you upload:</strong> the files and the text extracted from them, so agents can search
          them. In a CSV file (usually a bank or card statement), long numbers such as account and card numbers are
          masked to their last four digits as the file is read, before the text is stored for search or seen by
          any AI model.
        </li>
        <li>
          <strong>Work and conversations:</strong> chats with your agents, the work they do, what they draft,
          research findings, digests and suggestions.
        </li>
        <li>
          <strong>Records:</strong> an audit log of what people and agents did and when, and simple product usage
          events (which screens and features are used) kept on our own servers.
        </li>
        <li>
          <strong>Connections you choose to make:</strong> for connected services (such as Google Calendar, Gmail, Slack)
          we keep the access credentials encrypted at rest. When connected, we read calendar events to check for clashes and schedule meetings,
          and email threads to draft replies you approve.
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

      <h2>Google user data and API services</h2>
      <p>
        If you choose to connect your Google account (such as Google Calendar or Gmail) to {LEGAL.companyName},
        we access and process specific Google user data solely to enable user-directed scheduling and communication
        features for your assistants and agents:
      </p>
      <ul>
        <li>
          <strong>Which Google data Desker reads and why:</strong>
          <ul>
            <li>
              <strong>Google Calendar events:</strong> We read calendar events to check for clashes and create or move meetings upon your instructions.
            </li>
            <li>
              <strong>Gmail and email data:</strong> We read email threads to understand context and draft replies you approve. Agents only prepare draft replies; no email is ever sent without your explicit review and approval.
            </li>
          </ul>
        </li>
        <li>
          <strong>Used only to provide these features:</strong> Data received from Google APIs is used strictly to provide and improve these user-facing calendar and email features. It is not used for any other purpose.
        </li>
        <li>
          <strong>Not sold:</strong> Google user data is not sold to any third party.
        </li>
        <li>
          <strong>Not used for ads:</strong> Google user data is not used for advertising, personalized marketing, or retargeting.
        </li>
        <li>
          <strong>Not used to train AI models:</strong> Information received from Google APIs is not used to train AI models—neither our own models nor those of any third party.
        </li>
        <li>
          <strong>Human access:</strong> No humans read your Google data unless you give explicit permission for technical support, it is necessary for security investigations, or we are compelled by law.
        </li>
      </ul>

      <h3>Disconnecting your Google account and deleting your data</h3>
      <p>
        You have complete control over your Google connection at all times:
      </p>
      <ul>
        <li>
          <strong>Disconnecting inside Desker:</strong> You can disconnect your Google account at any time in the app under{" "}
          <strong>Integrations</strong> by clicking <strong>Disconnect</strong>.
        </li>
        <li>
          <strong>Revoking access via Google:</strong> You can also revoke Desker&apos;s access at any time through your{" "}
          <a
            href="https://myaccount.google.com/permissions"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent underline underline-offset-4 hover:text-accent-hover"
          >
            Google Account Security permissions
          </a>.
        </li>
        <li>
          <strong>How data gets deleted:</strong> Disconnecting your Google account immediately deletes all stored OAuth access tokens and credentials from our database. Any drafts or meeting records created by agents can be deleted individually at any time. Furthermore, using <strong>Delete my account</strong> immediately and permanently purges all your account data, spaces, drafts, and connected-app credentials from our systems.
        </li>
      </ul>
      <p>
        {"Desker's use and transfer to any other app of information received from Google APIs will adhere to the "}
        <a
          href="https://developers.google.com/terms/api-services-user-data-policy"
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent underline underline-offset-4 hover:text-accent-hover"
        >
          Google API Services User Data Policy (https://developers.google.com/terms/api-services-user-data-policy)
        </a>
        {", including the Limited Use requirements."}
      </p>

      <h2>Who else processes it</h2>
      <p>We use a small set of providers, each only for its part of running the service:</p>
      <ul>
        <li>
          <strong>AI model providers</strong> (Anthropic; OpenAI if you choose one of its models, and for document
          search indexing) receive the text needed for each reply or task. Under their API terms they do
          not train on it, and keep it only for a limited period for abuse and safety monitoring.
        </li>
        <li><strong>A web search provider</strong> (Brave or Tavily) receives the search queries an agent makes - never your documents.</li>
        <li><strong>Hosting, database and background jobs</strong> (Vercel, Neon, Inngest) store and process data to run the service.</li>
        <li><strong>Email delivery</strong> (Resend) sends account emails such as password resets, and the digests you ask for.</li>
        <li>
          <strong>Messaging apps you choose</strong> (LINE, WhatsApp, Telegram, Slack, Discord, Microsoft Teams) carry the
          alerts and morning brief you set up under Alerts. Only the apps you add get messages, and you can remove them at any time.
        </li>
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
        We set one cookie, to keep you signed in. Your browser also remembers display preferences (like the
        setup checklist) on your own device. There is no advertising or third-party
        analytics tracking and no session recording.
      </p>

      <h2>Email your agents send</h2>
      <p>
        Email from your assistants is written as you, to people you choose, and only with your approval unless you
        have switched that on.
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
        <li>We keep billing records as long as tax law requires.</li>
      </ul>

      <h2>Your rights, as buttons</h2>
      <p>
        Wherever you live, you can do these yourself, without writing to us: open <strong>Your space</strong> and use <strong>Download my data</strong> for a complete
        copy of your account and the spaces you own, as a machine-readable file; or <strong>Delete my
        account</strong> to erase it. You can correct anything by editing it in the app. You may also ask us to
        restrict or stop a particular use of your data, or ask any question about it, at {LEGAL.contactEmail};
        we answer within 30 days. If you are unhappy with our answer you can complain to your data protection
        authority (in Thailand, the Personal Data Protection Committee; in the EU or UK, your national regulator).
      </p>

      <h2>If you live in California</h2>
      <p>
        We do not sell or share your personal information, as the California Consumer Privacy Act defines those
        words, and we have not done so in the past 12 months. We don&rsquo;t use sensitive personal information for
        anything beyond providing the service you asked for. You have the right to know what we hold about you, to
        get a copy, to correct it and to delete it - the buttons above do this - and to do so without being treated
        any differently. You can also ask through someone you authorise, by writing to {LEGAL.contactEmail}; we
        will verify the request before acting on it.
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
