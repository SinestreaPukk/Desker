import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { defaultProject } from "@/lib/projects";

/** The app has no marketing page; land people where they can act. */
export default async function RootPage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  const project = await defaultProject(user.id);

  // A workspace with no agents yet has nothing to show on the roster, so a
  // first-time admin goes straight into the wizard instead of an empty page.
  const agents = await prisma.agent.count({ where: { projectId: project.id } });
  redirect(agents === 0 ? `/p/${project.slug}/agents/new` : `/p/${project.slug}/roster`);
}
