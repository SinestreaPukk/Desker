"use client";

import * as React from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AgentChat } from "@/components/chat/agent-chat";
import { AbilitiesTab } from "@/components/agent/abilities-tab";
import { AboutTab } from "@/components/agent/about-tab";
import { ScheduleTab } from "@/components/agent/schedule-tab";
import { useUpdateAgent } from "@/hooks/use-admin-data";
import { errorMessage } from "@/lib/shared/api-client";
import { cn } from "@/lib/shared/utils";
import type { AgentDetailDto } from "@/lib/shared/serialize";

const TABS = [
  { id: "chat", label: "Chat" },
  { id: "about", label: "About you" },
  { id: "abilities", label: "Abilities" },
  { id: "schedule", label: "Schedule" },
] as const;
type TabId = (typeof TABS)[number]["id"];

/** The one assistant: talk to it, tell it about you, choose what it may do. */
export function AgentScreen({ agent, project, initialTab }: { agent: AgentDetailDto; project: string; initialTab?: string }) {
  const update = useUpdateAgent(agent.id);
  const [tab, setTab] = React.useState<TabId>(TABS.some((t) => t.id === initialTab) ? (initialTab as TabId) : "chat");
  const live = agent.status === "published";

  async function setLive(next: boolean) {
    try {
      await update.mutateAsync({ status: next ? "published" : "draft" });
    } catch (caught) {
      toast.error(errorMessage(caught));
      // Switching on needs a few lines about the person: send them to where they write them.
      if (next) setTab("about");
    }
  }

  const chat = tab === "chat";

  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-3xl flex-col px-4 sm:px-6",
        chat ? "h-[calc(100dvh-3.5rem)] pt-4" : "pb-24 pt-8 sm:pt-12",
      )}
    >
      <header className={cn("flex flex-wrap items-center justify-between gap-4", chat ? "mb-3" : "mb-8")}>
        <div className="min-w-0">
          <h1 className={cn("font-hand leading-none text-ink", chat ? "text-xl" : "text-large-title")}>{agent.name}</h1>
          {chat ? null : <p className="mt-2 text-ink-muted">{live ? "On. It answers you in chat and in your apps." : "Off. Switch it on when you're ready."}</p>}
        </div>
        <label className="flex items-center gap-3 rounded-full border border-line bg-surface py-1.5 pl-4 pr-2 text-sm font-semibold text-ink shadow-xs">
          {live ? "On" : "Off"}
          <Switch checked={live} disabled={update.isPending} onCheckedChange={(next) => void setLive(next)} aria-label="Switch the assistant on" />
        </label>
      </header>

      <Tabs value={tab} onValueChange={(value) => setTab(value as TabId)} className="flex min-h-0 flex-1 flex-col">
        <div className={cn("-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0", chat ? "mb-3" : "mb-6")}>
          <TabsList className="min-w-max">
            {TABS.map((t) => (
              <TabsTrigger key={t.id} value={t.id}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <TabsContent value="chat" className="min-h-0 flex-1">
          <AgentChat project={project} agent={{ id: agent.id, name: agent.name }} live={live} onNeedAbout={() => setTab("about")} />
        </TabsContent>
        <TabsContent value="about">
          <AboutTab agent={{ id: agent.id, name: agent.name }} project={project} />
        </TabsContent>
        <TabsContent value="abilities">
          <AbilitiesTab agentId={agent.id} project={project} />
        </TabsContent>
        <TabsContent value="schedule">
          <ScheduleTab agentId={agent.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
