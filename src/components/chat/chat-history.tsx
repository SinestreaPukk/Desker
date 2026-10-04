"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/shared/api-client";
import { EVERYDAY_THREAD, NEW_CHAT, chatTitle, type TeamThreadDto } from "@/lib/agents/team-dto";
import { cn } from "@/lib/shared/utils";

/** Your chats down the side, newest first, like any chat app. Opening one goes to the Chat page. */
export function ChatHistory({ project }: { project: string }) {
  const client = useQueryClient();
  const router = useRouter();
  const pathname = usePathname();
  const param = useSearchParams().get("c");
  const key = ["team-threads", project];
  const threads = useQuery({
    queryKey: key,
    queryFn: () => api<TeamThreadDto[]>(`/api/team?project=${encodeURIComponent(project)}`),
    refetchInterval: 30_000,
  });
  const [confirming, setConfirming] = React.useState<string | null>(null);
  const remove = useMutation({
    mutationFn: (id: string) => api(`/api/team/${id}`, { method: "DELETE" }),
    onSuccess: (_result, id) => {
      client.setQueryData<TeamThreadDto[]>(key, (old) => (old ?? []).filter((chat) => chat.id !== id));
      setConfirming(null);
      if (active === id) router.push(`/p/${project}/chat`);
    },
    onError: (caught) => toast.error(errorMessage(caught)),
  });

  const chats = threads.data ?? [];
  const onChat = pathname === `/p/${project}/chat`;
  const everyday = chats.find((chat) => chat.title === EVERYDAY_THREAD);
  const active = onChat ? (param ?? everyday?.id ?? null) : null;

  return (
    <div className="mt-5 flex min-h-0 flex-1 flex-col">
      <Link
        href={`/p/${project}/chat?c=${NEW_CHAT}`}
        className={cn(
          "mx-1 mb-3 flex items-center justify-center gap-2 rounded-full border border-line bg-surface px-3 py-2 text-sm font-semibold text-ink shadow-xs transition-colors hover:border-line-strong",
          onChat && param === NEW_CHAT && "border-accent-line bg-accent-soft/40",
        )}
      >
        <Plus className="size-4" aria-hidden />
        New chat
      </Link>
      <p className="px-3 pb-1 text-xs font-semibold text-ink-muted">Chats</p>
      <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto" aria-label="Chat history">
        {chats.map((chat) => {
          const isActive = chat.id === active;
          return (
            <li key={chat.id} className="group relative">
              <Link
                href={`/p/${project}/chat?c=${chat.id}`}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "block truncate rounded-md py-1.5 pl-3 pr-9 text-sm transition-colors",
                  isActive ? "bg-ink/[0.08] font-semibold text-ink" : "text-ink-muted hover:bg-ink/[0.05] hover:text-ink",
                )}
              >
                {chatTitle(chat.title)}
              </Link>
              {chat.id !== everyday?.id ? (
                confirming === chat.id ? (
                  <button
                    type="button"
                    onClick={() => remove.mutate(chat.id)}
                    className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md bg-danger-soft px-2 py-1 text-xs font-semibold text-danger"
                  >
                    Delete?
                  </button>
                ) : (
                  <button
                    type="button"
                    aria-label={`Delete ${chatTitle(chat.title)}`}
                    onClick={() => setConfirming(chat.id)}
                    onBlur={() => setConfirming((current) => (current === chat.id ? null : current))}
                    className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-ink-subtle opacity-0 transition-opacity hover:text-ink focus:opacity-100 group-hover:opacity-100"
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </button>
                )
              ) : null}
            </li>
          );
        })}
        {threads.isPending ? <li className="px-3 py-2 text-sm text-ink-muted">Loading…</li> : null}
        {!threads.isPending && chats.length === 0 ? <li className="px-3 py-2 text-sm text-ink-muted">No chats yet.</li> : null}
      </ul>
    </div>
  );
}
