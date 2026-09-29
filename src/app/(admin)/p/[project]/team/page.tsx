import type { Metadata } from "next";
import { TeamRoom } from "./team-room";

export const metadata: Metadata = { title: "Team" };

export default async function TeamPage({ params }: { params: Promise<{ project: string }> }) {
  const { project } = await params;
  return <TeamRoom project={project} />;
}
