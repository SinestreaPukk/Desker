/**
 * The legal documents' identity. Bump TERMS_VERSION when the text changes;
 * every sign-up records which version was accepted, so a later change can be
 * re-consented rather than assumed.
 *
 * The document text lives in app/(legal). It is template text until counsel
 * replaces it - the routes, links and acceptance record are the product's
 * job; the words are not.
 */
import { SITE } from "@/lib/site/content";

export const TERMS_VERSION = "2026-10-02.1";

export const LEGAL = {
  companyName: process.env.NEXT_PUBLIC_LEGAL_COMPANY_NAME?.trim() || "Desker",
  contactEmail: process.env.NEXT_PUBLIC_LEGAL_CONTACT_EMAIL?.trim() || SITE.company.email,
  /** The DMCA designated agent's address, as registered with the US Copyright Office. */
  copyrightEmail:
    process.env.NEXT_PUBLIC_LEGAL_COPYRIGHT_EMAIL?.trim() ||
    process.env.NEXT_PUBLIC_LEGAL_CONTACT_EMAIL?.trim() ||
    SITE.company.email,
  jurisdiction: process.env.NEXT_PUBLIC_LEGAL_JURISDICTION?.trim() || "Thailand",
} as const;
