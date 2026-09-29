import type { Metadata } from "next";
import { WorkflowsView } from "./workflows-view";

export const metadata: Metadata = { title: "Workflows" };

export default async function WorkflowsPage({ params }: { params: Promise<{ project: string }> }) {
  const { project } = await params;
  return <WorkflowsView project={project} />;
}
