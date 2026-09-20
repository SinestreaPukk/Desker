import type { Metadata } from "next";
import { IntegrationsView } from "./integrations-view";

export const metadata: Metadata = { title: "Integrations" };

export default async function IntegrationsPage({
  params,
}: {
  params: Promise<{ project: string }>;
}) {
  const { project } = await params;
  return <IntegrationsView project={project} />;
}
