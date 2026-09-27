import type { Metadata } from "next";
import { InboxView } from "./inbox-view";

export const metadata: Metadata = { title: "Inbox" };

export default async function InboxPage({
  params,
  searchParams,
}: {
  params: Promise<{ project: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { project } = await params;
  const { tab } = await searchParams;
  return <InboxView project={project} initialTab={tab} />;
}
