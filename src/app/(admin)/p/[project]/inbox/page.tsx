import { redirect } from "next/navigation";

/**
 * The Inbox split in two: what needs a person is Needs you, the one action
 * queue; chat history is Conversations; agents' digests live under Work.
 * Old links (emails, bookmarks) still land in the right place.
 */
export default async function InboxPage({
  params,
  searchParams,
}: {
  params: Promise<{ project: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { project } = await params;
  const { tab } = await searchParams;
  if (tab === "conversations") redirect(`/p/${project}/conversations`);
  if (tab === "updates") redirect(`/p/${project}/work?view=digests`);
  redirect(`/p/${project}/needs-you`);
}
