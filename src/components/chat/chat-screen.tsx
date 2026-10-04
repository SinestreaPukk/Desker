"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AgentChat } from "@/components/chat/agent-chat";

/** The chat as a page of its own: a slim header, then the conversation fills the rest of the screen. */
export function ChatScreen({ project, agent, live }: { project: string; agent: { id: string; name: string }; live: boolean }) {
  const router = useRouter();
  return (
    <div className="mx-auto flex h-[calc(100dvh-7.5rem)] w-full max-w-3xl flex-col px-4 pt-4 sm:px-6 lg:h-dvh">
      <header className="mb-3 flex items-center justify-between gap-3">
        <h1 className="font-hand text-xl leading-none text-ink">{agent.name}</h1>
        <Link
          href={`/p/${project}/agent`}
          className="flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-sm font-medium text-ink-muted shadow-xs hover:text-ink pointer-coarse:min-h-11"
        >
          <span className={`size-2 rounded-full ${live ? "bg-positive" : "bg-ink-subtle"}`} aria-hidden />
          {live ? "On" : "Off"}
        </Link>
      </header>
      <div className="min-h-0 flex-1">
        <AgentChat project={project} agent={agent} live={live} onNeedAbout={() => router.push(`/p/${project}/agent?section=about`)} />
      </div>
    </div>
  );
}
