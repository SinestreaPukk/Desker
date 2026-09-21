import type { Metadata } from "next";
import { Mail } from "lucide-react";
import { CONTACT, SITE, absoluteUrl } from "@/lib/content";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = {
  title: CONTACT.meta.title,
  description: CONTACT.meta.description,
  alternates: { canonical: absoluteUrl("/contact") },
  openGraph: {
    title: `${CONTACT.meta.title} · ${SITE.company.name}`,
    description: CONTACT.meta.description,
    url: absoluteUrl("/contact"),
    siteName: SITE.company.name,
    type: "website",
  },
};

export default function ContactPage() {
  const { details } = CONTACT;
  return (
    <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
      <div className="grid gap-10 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">{CONTACT.heading}</h1>
          <p className="mt-4 max-w-xl text-lg leading-relaxed text-ink-muted">{CONTACT.intro}</p>
          <div className="mt-8">
            <ContactForm />
          </div>
        </div>
        <aside className="rounded-panel border border-line bg-surface p-6 md:mt-16">
          <h2 className="text-[0.75rem] font-semibold uppercase tracking-wide text-ink-subtle">{details.heading}</h2>
          <address className="mt-3 not-italic text-[0.9375rem] leading-relaxed text-ink">
            {details.lines.map((line) => (
              <div key={line}>{line}</div>
            ))}
          </address>
          <dl className="mt-5 space-y-3 text-[0.9375rem]">
            <div>
              <dt className="text-[0.75rem] font-medium uppercase tracking-wide text-ink-subtle">{details.emailLabel}</dt>
              <dd>
                <a href={`mailto:${SITE.company.email}`} className="inline-flex items-center gap-1.5 text-accent hover:underline">
                  <Mail className="size-4" aria-hidden />
                  {SITE.company.email}
                </a>
              </dd>
            </div>
            <div>
              <dt className="text-[0.75rem] font-medium uppercase tracking-wide text-ink-subtle">{details.hoursLabel}</dt>
              <dd className="text-ink-muted">{details.hours}</dd>
            </div>
          </dl>
        </aside>
      </div>
    </div>
  );
}
