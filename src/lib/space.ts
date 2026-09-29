/**
 * What kind of space a workspace is: a business's, or one person's.
 *
 * Both are an Organization underneath (the tenancy and billing boundary), so
 * every query, limit and audit trail works the same. What changes is who it
 * is for: a personal space has one member, no invitations, no public chat
 * links, and its shared context describes a person rather than a company.
 *
 * No server imports - the shell, the forms and the prompts all read this.
 */
export const SPACE_KINDS = ["business", "personal"] as const;
export type SpaceKind = (typeof SPACE_KINDS)[number];

/** A stored value made safe: anything that is not "personal" is a business. */
export function spaceKind(value: unknown): SpaceKind {
  return value === "personal" ? "personal" : "business";
}

/** What Desker is for, asked at sign-up. "mixed" founds one space of each kind. */
export const USE_TYPES = ["business", "personal", "mixed"] as const;
export type UseType = (typeof USE_TYPES)[number];

/** The spaces a sign-up of this type starts with, first one landed on. */
export function spacesFor(useType: UseType): SpaceKind[] {
  if (useType === "mixed") return ["business", "personal"];
  return [useType];
}

/** The name a personal space gets, from the person's first name. */
export function personalSpaceName(firstName: string | null | undefined): string {
  const first = firstName?.trim();
  return first ? `${first}'s personal space` : "My personal space";
}
