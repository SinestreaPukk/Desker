import type { Metadata } from "next";
import { Mail } from "lucide-react";
import { CONTACT, SITE, pageMetadata } from "@/lib/content";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = pageMetadata({
  title: CONTACT.meta.title,
  description: CONTACT.meta.description,
  path: "/contact",
});

export default function ContactPage() {
  const { details } = CONTACT;
  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
      <div className="grid gap-10 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-ink sm:text-display">{CONTACT.heading}</h1>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-ink-muted">{CONTACT.intro}</p>
          <div className="mt-8">
            <ContactForm />
          </div>
        </div>
        <aside className="rounded-panel border border-line bg-surface p-6 md:mt-16">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-ink-subtle">{details.heading}</h2>
          <address className="mt-3 not-italic text-base leading-relaxed text-ink">
            {details.lines.map((line) => (
              <div key={line}>{line}</div>
            ))}
          </address>
          <dl className="mt-5 space-y-3 text-base">
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-ink-subtle">{details.emailLabel}</dt>
              <dd>
                <a href={`mailto:${SITE.company.email}`} className="inline-flex items-center gap-1.5 text-accent hover:underline">
                  <Mail className="size-4" aria-hidden />
                  {SITE.company.email}
                </a>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-ink-subtle">{details.hoursLabel}</dt>
              <dd className="text-ink-muted">{details.hours}</dd>
            </div>
          </dl>
        </aside>
      </div>
    </div>
  );
}
