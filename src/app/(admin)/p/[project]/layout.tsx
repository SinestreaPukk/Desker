import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { findProject, projectsFor } from "@/lib/projects";
import { AdminShell } from "@/components/admin-shell";

/**
 * The chrome every admin page sits inside.
 *
 * It renders once for the whole project section, so moving between the roster,
 * the inbox and insights swaps only the page body - the sidebar, the project
 * switcher and the account menu are never torn down and rebuilt, and nothing
 * shifts under the cursor.
 */
export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ project: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/login");

  const { project: handle } = await params;
  // Scoped to the signed-in user's organisations: a project they cannot see
  // is indistinguishable from one that does not exist.
  const project = await findProject(handle, user.id);
  if (!project) notFound();

  const projects = (await projectsFor(user.id)).map((item) => ({
    id: item.id,
    name: item.name,
    slug: item.slug,
  }));

  return (
    <AdminShell
      email={user.email}
      name={user.name}
      project={{ id: project.id, name: project.name, slug: project.slug }}
      projects={projects}
    >
      {children}
    </AdminShell>
  );
}
