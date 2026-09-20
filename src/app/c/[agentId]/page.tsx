import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { BRAND } from "@/lib/brand";
import { ClientChat } from "@/components/chat/client-chat";
import { ThemeToggle } from "@/components/theme-toggle";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ agentId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { agentId } = await params;
  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: { name: true, jobTitle: true, status: true },
  });

  if (!agent || agent.status !== "published") return { title: "Chat unavailable" };

  return {
    title: `Chat with ${agent.name}`,
    description: `${agent.name}, ${agent.jobTitle}`,
    // A client chat link should not end up in search results.
    robots: { index: false, follow: false },
  };
}

/** The standalone client chat: a full-height page, no admin chrome. */
export default async function ClientChatPage({ params }: Props) {
  const { agentId } = await params;

  const agent = await prisma.agent.findUnique({
    where: { id: agentId },
    select: { id: true, status: true },
  });
  if (!agent || agent.status !== "published") notFound();

  return (
    <div className="flex h-dvh flex-col bg-paper">
      <div className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col sm:py-6">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden border-line bg-surface sm:rounded-panel sm:border sm:shadow-sm">
          <ClientChat agentId={agentId} variant="page" />
        </div>

        <footer className="flex items-center justify-between gap-3 px-4 py-3 sm:px-0 sm:pt-4">
          <p className="text-xs text-ink-subtle">
            An AI assistant on {BRAND.name}. Replies may be imperfect — ask for a
            human any time.
          </p>
          <ThemeToggle />
        </footer>
      </div>
    </div>
  );
}
