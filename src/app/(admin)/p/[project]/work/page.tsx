import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { WorkView } from "./work-view";

export const metadata: Metadata = { title: "Work" };

export default async function WorkPage({
  params,
  searchParams,
}: {
  params: Promise<{ project: string }>;
  searchParams: Promise<{ agentId?: string; status?: string; item?: string }>;
}) {
  const { project } = await params;
  const { agentId, status, item } = await searchParams;
  // Older links (notification emails, the inbox) point at ?item=: a run has its own page now.
  if (item) redirect(`/p/${project}/work/${encodeURIComponent(item)}`);
  return <WorkView project={project} initialAgentId={agentId ?? "all"} initialStatus={status ?? "all"} />;
}
