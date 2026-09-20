import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { currentUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { toAgentDetail } from "@/lib/serialize";
import { findAgentFor } from "@/lib/projects";
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

  // Scoped lookup: an agent from another project - or another organisation -
  // must not resolve here, or the URL would quietly cross a tenant boundary.
  const agent = await findAgentFor(agentId, user.id);
  if (!agent) notFound();
  if (agent.project.slug !== project && agent.project.id !== project) notFound();

  return (
    <AgentBuilder
      agent={toAgentDetail(agent)}
      project={project}
      onboarding={onboarding === "1"}
    />
  );
}
