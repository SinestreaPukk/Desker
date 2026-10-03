import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/platform/db";
import { currentUser } from "@/lib/auth/auth";
import { findProject } from "@/lib/tenancy/projects";
import { templateById } from "@/lib/site/content";
import { agentFromTemplate, scopeFromTemplate } from "@/lib/agents/hire-from-template";
import { saveScope } from "@/lib/work/scope";
import { scopeInputSchema } from "@/lib/work/validation";

export const dynamic = "force-dynamic";

/** The one agent's settings. Opens its editor, creating the agent from the template on first visit. */
export default async function AgentEntryPage({ params, searchParams }: { params: Promise<{ project: string }>; searchParams: Promise<{ section?: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const { project: handle } = await params;
  const project = await findProject(handle, user.id);
  if (!project) notFound();

  let agent = await prisma.agent.findFirst({ where: { projectId: project.id }, orderBy: { createdAt: "asc" }, select: { id: true } });
  if (!agent) {
    const template = templateById("personal-assistant")!;
    agent = await prisma.agent.create({ data: { projectId: project.id, ...agentFromTemplate(template, template.name) }, select: { id: true } });
    // Manual until the owner picks a schedule: a cron in the wrong time zone is worse than none.
    await saveScope(agent.id, scopeInputSchema.parse({ ...scopeFromTemplate(template, "UTC"), triggerType: "manual", cron: null }));
  }
  const { section } = await searchParams;
  redirect(`/p/${handle}/agents/${agent.id}${section ? `?section=${encodeURIComponent(section)}` : ""}`);
}
