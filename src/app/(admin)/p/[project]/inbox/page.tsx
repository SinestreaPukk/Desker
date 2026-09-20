import type { Metadata } from "next";
import { InboxView } from "./inbox-view";

export const metadata: Metadata = { title: "Inbox" };

export default async function InboxPage({
  params,
}: {
  params: Promise<{ project: string }>;
}) {
  const { project } = await params;
  return <InboxView project={project} />;
}
