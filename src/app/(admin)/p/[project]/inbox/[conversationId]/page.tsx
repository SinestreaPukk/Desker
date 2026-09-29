import { redirect } from "next/navigation";

/** Conversations moved out of the Inbox; links already sent in emails still work. */
export default async function OldConversationPage({
  params,
}: {
  params: Promise<{ project: string; conversationId: string }>;
}) {
  const { project, conversationId } = await params;
  redirect(`/p/${project}/conversations/${conversationId}`);
}
