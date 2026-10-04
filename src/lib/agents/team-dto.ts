/** Wire shapes of the team room. No server imports: the Team page renders these. */
export interface TeamMessageDto {
  id: string;
  content: string;
  /** The person who wrote it; null on an agent's reply. */
  authorName: string | null;
  /** The task this message started or reports on, in Work. */
  actionItemId: string | null;
  createdAt: string;
  agent: { id: string; name: string; jobTitle: string; avatarUrl: string | null } | null;
}

/** One chat, as the history lists it. */
export interface TeamThreadDto {
  id: string;
  title: string;
  updatedAt: string;
}

/** The address value for a chat that has not been started yet. */
export const NEW_CHAT = "new";

/** A chat's name in a list or menu: the everyday chat by its short name, others from their first line. */
export function chatTitle(title: string): string {
  if (title === EVERYDAY_THREAD) return "Everyday";
  const clean = title.replace(/^(@\w+\s*)+/, "").trim() || title;
  return clean.length > 40 ? `${clean.slice(0, 40).trimEnd()}…` : clean;
}

/** The one conversation: the web chat and every messaging app share this thread. */
export const EVERYDAY_THREAD = "Everyday chat";
