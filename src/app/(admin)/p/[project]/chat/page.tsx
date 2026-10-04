import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/platform/db";
import { currentUser } from "@/lib/auth/auth";
import { findProject } from "@/lib/tenancy/projects";
import { ChatScreen } from "@/components/chat/chat-screen";

export const metadata: Metadata = { title: "Chat" };
export const dynamic = "force-dynamic";

/** The conversation, full page. With no assistant yet, setup creates it first. */
export default async function ChatPage({ params }: { params: Promise<{ project: string }> }) {
  const user = await currentUser();
  if (!user) redirect("/login");
  const { project: handle } = await params;
  const project = await findProject(handle, user.id);
  if (!project) notFound();
  const agent = await prisma.agent.findFirst({ where: { projectId: project.id }, orderBy: { createdAt: "asc" }, select: { id: true, name: true, status: true } });
  if (!agent) redirect(`/p/${handle}/agent`);
  return <ChatScreen project={handle} agent={{ id: agent.id, name: agent.name }} live={agent.status === "published"} />;
}
