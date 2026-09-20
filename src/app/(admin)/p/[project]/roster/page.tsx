import type { Metadata } from "next";
import { RosterView } from "./roster-view";

export const metadata: Metadata = { title: "Roster" };

export default async function RosterPage({
  params,
}: {
  params: Promise<{ project: string }>;
}) {
  const { project } = await params;
  return <RosterView project={project} />;
}
