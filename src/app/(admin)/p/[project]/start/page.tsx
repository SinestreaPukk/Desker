import type { Metadata } from "next";
import { StartView } from "./start-view";

export const metadata: Metadata = { title: "Your first run" };

export default async function StartPage({ params }: { params: Promise<{ project: string }> }) {
  const { project } = await params;
  return <StartView project={project} />;
}
