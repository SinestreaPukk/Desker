import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/auth";
import { findProject } from "@/lib/tenancy/projects";
import { AdminShell } from "@/components/admin-shell";

/** The chrome every screen sits inside: one top bar, rendered once for the whole project section. */
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

  return (
    <AdminShell
      email={user.email}
      name={user.name}
      project={{ slug: project.slug }}
    >
      {children}
    </AdminShell>
  );
}
