import type { Metadata } from "next";
import { ConversationsView } from "./conversations-view";

export const metadata: Metadata = { title: "Conversations" };

export default async function ConversationsPage({
  params,
  searchParams,
}: {
  params: Promise<{ project: string }>;
  searchParams: Promise<{ agent?: string }>;
}) {
  const { project } = await params;
  const { agent } = await searchParams;
  return <ConversationsView project={project} initialAgentId={agent} />;
}
