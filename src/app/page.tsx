import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { defaultProject } from "@/lib/projects";

/** The app has no marketing page; land people where they can act. */
export default async function RootPage() {
  const user = await currentUser();
  if (!user) redirect("/login");

  const project = await defaultProject(user.id);

  // Always the roster: a new organisation sees the first-run guide there,
  // which explains the next ten minutes before the wizard asks questions.
  redirect(`/p/${project.slug}/roster`);
}
