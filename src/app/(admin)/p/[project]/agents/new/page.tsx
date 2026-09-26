import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { findProject } from "@/lib/projects";
import { hasCoreContext } from "@/lib/work/context";
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
  // Hiring starts from the company's own answers: until the four are in,
  // this is where they get written.
  const user = await currentUser();
  const row = user ? await findProject(project, user.id) : null;
  if (row && !hasCoreContext(row)) {
    redirect(`/p/${project}/welcome${template ? `?template=${encodeURIComponent(template)}` : ""}`);
  }
  return <NewAgentWizard project={project} />;
}
