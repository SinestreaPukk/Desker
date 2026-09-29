import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { findProject } from "@/lib/projects";
import { hasCoreContext } from "@/lib/work/context";
import { spaceKind } from "@/lib/space";
import { NewAgentWizard } from "./new-agent-wizard";

export const metadata: Metadata = { title: "New agent" };

export default async function NewAgentPage({
  params,
  searchParams,
}: {
  params: Promise<{ project: string }>;
  searchParams: Promise<{ template?: string }>;
}) {
  const [{ project }, { template }] = await Promise.all([params, searchParams]);
  // Hiring starts from the space's own answers (the company, or the person):
  // until the four are in,
  // this is where they get written.
  const user = await currentUser();
  const row = user ? await findProject(project, user.id) : null;
  if (row && !hasCoreContext(row, spaceKind(row.organization.kind))) {
    redirect(`/p/${project}/welcome${template ? `?template=${encodeURIComponent(template)}` : ""}`);
  }
  return <NewAgentWizard project={project} />;
}
