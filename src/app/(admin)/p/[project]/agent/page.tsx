import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/platform/db";
import { currentUser } from "@/lib/auth/auth";
import { findProject } from "@/lib/tenancy/projects";
import { templateById } from "@/lib/site/content";
import { agentFromTemplate, scopeFromTemplate } from "@/lib/agents/hire-from-template";
import { defaultAbilities, toolsFor } from "@/lib/agents/abilities";
import { saveScope } from "@/lib/work/scope";
import { scopeInputSchema } from "@/lib/work/validation";
import { readPrefs } from "@/lib/messaging/prefs";

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
    const settings = await prisma.user.findUnique({ where: { id: user.id }, select: { alertPrefs: true } });
    const timezone = readPrefs(settings?.alertPrefs).timeZone;
    agent = await prisma.agent.create({ data: { projectId: project.id, ...agentFromTemplate(template, template.name) }, select: { id: true } });
    // Manual until the owner picks a schedule: a cron in the wrong time zone is worse than none.
    await saveScope(agent.id, scopeInputSchema.parse({ ...scopeFromTemplate(template, timezone), triggerType: "manual", cron: null, tools: toolsFor(defaultAbilities()) }));
  }
  const { section } = await searchParams;
  redirect(`/p/${handle}/agents/${agent.id}${section ? `?section=${encodeURIComponent(section)}` : ""}`);
}
