import type { Metadata } from "next";
import { AuditView } from "./audit-view";

export const metadata: Metadata = { title: "Audit log" };

export default async function AuditPage({
  params,
  searchParams,
}: {
  params: Promise<{ project: string }>;
  searchParams: Promise<{ agentId?: string; thread?: string }>;
}) {
  const { project } = await params;
  const { agentId, thread } = await searchParams;
  return <AuditView project={project} initialAgentId={agentId ?? "all"} initialThread={thread ?? ""} />;
}
