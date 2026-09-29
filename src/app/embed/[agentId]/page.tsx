import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { PUBLICLY_REACHABLE } from "@/lib/conversation";
import { EmbedChat } from "./embed-chat";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Chat",
  robots: { index: false, follow: false },
};

/**
 * The document loaded inside the widget's iframe. Same component as the
 * standalone page, no page chrome, and it posts a `desker:close` message up to
 * the host page when the client dismisses it.
 */
export default async function EmbedPage({
  params,
}: {
  params: Promise<{ agentId: string }>;
}) {
  const { agentId } = await params;

  const agent = await prisma.agent.findFirst({
    where: { id: agentId, ...PUBLICLY_REACHABLE },
    select: { id: true, status: true },
  });
  if (!agent || agent.status !== "published") notFound();

  return (
    <div className="flex h-dvh flex-col bg-surface">
      <EmbedChat agentId={agentId} />
    </div>
  );
}
