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

/** The one conversation: the web chat and every messaging app share this thread. */
export const EVERYDAY_THREAD = "Everyday chat";
