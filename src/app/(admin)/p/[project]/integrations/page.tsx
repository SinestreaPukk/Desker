import type { Metadata } from "next";
import { IntegrationsScreen } from "@/components/integrations/integrations-screen";

export const metadata: Metadata = { title: "Integrations" };

export default async function IntegrationsPage({ params }: { params: Promise<{ project: string }> }) {
  const { project } = await params;
  return <IntegrationsScreen project={project} />;
}
