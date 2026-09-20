import type { Metadata } from "next";
import { NewAgentWizard } from "./new-agent-wizard";

export const metadata: Metadata = { title: "New agent" };

export default async function NewAgentPage({
  params,
}: {
  params: Promise<{ project: string }>;
}) {
  const { project } = await params;
  return <NewAgentWizard project={project} />;
}
