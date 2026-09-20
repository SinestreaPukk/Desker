import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { toAgentDetail } from "@/lib/serialize";
import { AgentBuilder } from "@/components/builder/agent-builder";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ project: string; agentId: string }>;
  searchParams: Promise<{ onboarding?: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { agentId } = await params;
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: { name: true },
  });
  return { title: agent ? agent.name : "Agent" };
}

export default async function AgentPage({ params, searchParams }: Props) {
  const user = await currentUser();
  if (!user) redirect("/login");

  const { project, agentId } = await params;
  const { onboarding } = await searchParams;

  const agent = await prisma.agent.findUnique({ where: { id: agentId } });
  // Scoped lookup: an agent id from another project must not resolve here, or
  // the URL would quietly cross a workspace boundary.
  if (!agent) notFound();
  const owner = await prisma.project.findUnique({ where: { id: agent.projectId } });
  if (!owner || (owner.slug !== project && owner.id !== project)) notFound();

  return (
    <AgentBuilder
      agent={toAgentDetail(agent)}
      project={project}
      onboarding={onboarding === "1"}
    />
  );
}
