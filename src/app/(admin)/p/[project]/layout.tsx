import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { findProject, projectsFor } from "@/lib/projects";
import { organizationsFor } from "@/lib/organizations";
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

  const [projectRows, organizations] = await Promise.all([
    projectsFor(user.id),
    organizationsFor(user.id),
  ]);
  const projects = projectRows.map((item) => ({
    id: item.id,
    name: item.name,
    slug: item.slug,
    organizationId: item.organizationId,
  }));

  return (
    <AdminShell
      email={user.email}
      name={user.name}
      project={{
        id: project.id,
        name: project.name,
        slug: project.slug,
        organizationId: project.organizationId,
      }}
      projects={projects}
      organizations={organizations.map((org) => ({ id: org.id, name: org.name, role: org.role }))}
    >
      {children}
    </AdminShell>
  );
}
