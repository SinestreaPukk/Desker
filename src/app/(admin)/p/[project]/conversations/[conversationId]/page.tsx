import type { Metadata } from "next";
import { ConversationDetail } from "./conversation-detail";

export const metadata: Metadata = { title: "Conversation" };

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ project: string; conversationId: string }>;
}) {
  const { project, conversationId } = await params;
  return <ConversationDetail conversationId={conversationId} project={project} />;
}
