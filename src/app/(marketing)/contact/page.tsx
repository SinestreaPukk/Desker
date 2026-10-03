import type { Metadata } from "next";
import { Clock, Mail, MapPin } from "lucide-react";
import { PageHeader } from "@/components/marketing/page-header";
import { Panel } from "@/components/ui/panel";
import { CONTACT, SITE, pageMetadata } from "@/lib/site/content";
import { ContactForm } from "./contact-form";

export const metadata: Metadata = pageMetadata({
  title: CONTACT.meta.title,
  description: CONTACT.meta.description,
  path: "/contact",
});

export default function ContactPage() {
  const { details } = CONTACT;
  return (
    <>
      <PageHeader title={CONTACT.heading} intro={CONTACT.intro} eyebrow="Contact" />

      {/* The form rises into the horizon, the way the product window and the
          legal documents do - the band below the copy is there for it. */}
      <div className="relative z-10 mx-auto -mt-24 max-w-6xl px-4 pb-24 sm:-mt-28 sm:px-6 sm:pb-28">
        <div className="grid gap-6 md:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <Panel className="window p-6 sm:p-8">
            <ContactForm />
          </Panel>

          <aside className="flex flex-col gap-4">
            <Panel className="p-6">
              <h2 className="eyebrow">{details.heading}</h2>
              <dl className="mt-4 space-y-4 text-sm">
                <div className="flex gap-3">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-ink-subtle" aria-hidden />
                  <div>
                    <dt className="sr-only">Address</dt>
                    <dd>
                      <address className="not-italic leading-relaxed text-ink">
                        {details.lines.map((line) => (
                          <div key={line}>{line}</div>
                        ))}
                      </address>
                    </dd>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Mail className="mt-0.5 size-4 shrink-0 text-ink-subtle" aria-hidden />
                  <div>
                    <dt className="text-ink-muted">{details.emailLabel}</dt>
                    <dd>
                      <a
                        href={`mailto:${SITE.company.email}`}
                        className="text-accent underline underline-offset-4 hover:text-accent-hover"
                      >
                        {SITE.company.email}
                      </a>
                    </dd>
                  </div>
                </div>
                <div className="flex gap-3">
                  <Clock className="mt-0.5 size-4 shrink-0 text-ink-subtle" aria-hidden />
                  <div>
                    <dt className="text-ink-muted">{details.hoursLabel}</dt>
                    <dd className="leading-relaxed text-ink">{details.hours}</dd>
                  </div>
                </div>
              </dl>
            </Panel>

            {/* The same promise the hero makes, where someone about to write
                to a stranger about their documents is most likely to want it. */}
            <Panel className="bg-surface-2/50 p-6">
              <p className="text-sm leading-relaxed text-ink-muted">
                Nothing you send here trains a model, and nothing an agent writes goes out
                without your approval.
              </p>
            </Panel>
          </aside>
        </div>
      </div>
    </>
  );
}
