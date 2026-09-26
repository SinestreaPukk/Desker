import type { Metadata } from "next";
import { RunView } from "./run-view";

export const metadata: Metadata = { title: "Run" };

export default async function RunPage({ params }: { params: Promise<{ project: string; itemId: string }> }) {
  const { project, itemId } = await params;
  return <RunView project={project} itemId={itemId} />;
}
