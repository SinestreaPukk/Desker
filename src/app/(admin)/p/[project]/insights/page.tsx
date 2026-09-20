import type { Metadata } from "next";
import { InsightsView } from "./insights-view";

export const metadata: Metadata = { title: "Insights" };

export default async function InsightsPage({
  params,
}: {
  params: Promise<{ project: string }>;
}) {
  const { project } = await params;
  return <InsightsView project={project} />;
}
