import type { Metadata } from "next";
import { ConversationsView } from "./conversations-view";

export const metadata: Metadata = { title: "Conversations" };

export default async function ConversationsPage({ params }: { params: Promise<{ project: string }> }) {
  const { project } = await params;
  return <ConversationsView project={project} />;
}
