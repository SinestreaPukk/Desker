import type { Metadata } from "next";
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
  return (
    <WorkView
      project={project}
      initialAgentId={agentId ?? "all"}
      initialStatus={status ?? "all"}
      focusItemId={item}
    />
  );
}
