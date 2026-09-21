import Link from "next/link";
import { PageHeader } from "@/components/marketing/page-header";
import { LEGAL, TERMS_VERSION } from "@/lib/legal";

/**
 * The shell both legal documents share.
 *
 * They had none: when these pages moved into the marketing group their own
 * layout was deleted and nothing replaced it, so since then they have
 * rendered as one full-width column of undifferentiated body text with the
 * headings reset to body size and the list markers stripped. The words are
 * counsel's to write; the document they sit in is ours.
 */
export function LegalPage({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <PageHeader
        title={title}
        eyebrow={`Version ${TERMS_VERSION}`}
        intro={intro}
        className="pb-16 sm:pb-24"
      />

      {/* The document floats on the sky the same way the product window does
          on the landing page, which is what the band underneath is for. */}
      <div className="relative z-10 mx-auto -mt-16 max-w-3xl px-4 pb-20 sm:-mt-24 sm:px-6 sm:pb-28">
        <article className="window prose p-6 sm:p-10">{children}</article>

        <div className="mt-8 rounded-panel border border-line bg-surface-2/50 px-6 py-5 text-sm leading-relaxed text-ink-muted">
          Questions about this document? Write to{" "}
          <a href={`mailto:${LEGAL.contactEmail}`} className="text-accent underline underline-offset-4">
            {LEGAL.contactEmail}
          </a>
          , or read the{" "}
          <Link href={title === "Privacy Policy" ? "/terms" : "/privacy"} className="text-accent underline underline-offset-4">
            {title === "Privacy Policy" ? "Terms of Service" : "Privacy Policy"}
          </Link>
          .
        </div>
      </div>
    </>
  );
}
