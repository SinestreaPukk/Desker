/**
 * The legal documents' identity. Bump TERMS_VERSION when the text changes;
 * every sign-up records which version was accepted, so a later change can be
 * re-consented rather than assumed.
 *
 * The document text lives in app/(legal). It is template text until counsel
 * replaces it - the routes, links and acceptance record are the product's
 * job; the words are not.
 */
export const TERMS_VERSION = "2026-09-21";

export const LEGAL = {
  companyName: process.env.NEXT_PUBLIC_LEGAL_COMPANY_NAME?.trim() || "Desker",
  contactEmail: process.env.NEXT_PUBLIC_LEGAL_CONTACT_EMAIL?.trim() || "legal@example.com",
  jurisdiction: process.env.NEXT_PUBLIC_LEGAL_JURISDICTION?.trim() || "[jurisdiction]",
} as const;
