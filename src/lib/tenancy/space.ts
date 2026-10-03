/**
 * A workspace is one person's space: an Organization underneath (the tenancy
 * and billing boundary) with one member, no invitations and no public chat.
 *
 * No server imports - the shell, the forms and the prompts all read this.
 */
/** The name a personal space gets, from the person's first name. */
export function personalSpaceName(firstName: string | null | undefined): string {
  const first = firstName?.trim();
  return first ? `${first}'s personal space` : "My personal space";
}
