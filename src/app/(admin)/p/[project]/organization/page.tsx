import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { findProject } from "@/lib/projects";
import { OrganizationView } from "./organization-view";

export const metadata: Metadata = { title: "Organisation" };

export default async function OrganizationPage({ params }: { params: Promise<{ project: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const { project } = await params;
  const found = await findProject(project, user.id);
  if (!found) notFound();
  return <OrganizationView project={project} organizationId={found.organizationId} />;
}
