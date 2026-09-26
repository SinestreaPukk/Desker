import type { Metadata } from "next";
import { DetailedInsightsView } from "./detailed-insights-view";

export const metadata: Metadata = { title: "Detailed Insights" };

export default async function DetailedInsightsPage({
  params,
}: {
  params: Promise<{ project: string }>;
}) {
  const { project } = await params;
  return <DetailedInsightsView project={project} />;
}
