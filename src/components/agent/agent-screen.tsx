"use client";

import * as React from "react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AgentChat } from "@/components/chat/agent-chat";
import { Screen } from "@/components/screen";
import { AbilitiesTab } from "@/components/agent/abilities-tab";
import { KnowledgeTab } from "@/components/agent/knowledge-tab";
import { ProfileTab } from "@/components/agent/profile-tab";
import { ScheduleTab } from "@/components/agent/schedule-tab";
import { useUpdateAgent } from "@/hooks/use-admin-data";
import { errorMessage } from "@/lib/shared/api-client";
import type { AgentDetailDto } from "@/lib/shared/serialize";

const TABS = [
  { id: "chat", label: "Chat" },
  { id: "profile", label: "Profile" },
  { id: "abilities", label: "Abilities" },
  { id: "knowledge", label: "Knowledge" },
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
      if (next) setTab("profile");
    }
  }

  return (
    <Screen
      title={agent.name}
      hint={live ? "On. It answers you in chat and in your apps." : "Off. Switch it on when you're ready."}
      actions={
        <label className="flex items-center gap-3 rounded-full border border-line bg-surface py-1.5 pl-4 pr-2 text-sm font-semibold text-ink shadow-xs">
          {live ? "On" : "Off"}
          <Switch checked={live} disabled={update.isPending} onCheckedChange={(next) => void setLive(next)} aria-label="Switch the assistant on" />
        </label>
      }
    >
      <Tabs value={tab} onValueChange={(value) => setTab(value as TabId)}>
        <div className="-mx-4 mb-6 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <TabsList className="min-w-max">
            {TABS.map((t) => (
              <TabsTrigger key={t.id} value={t.id}>
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <TabsContent value="chat">
          <AgentChat project={project} agent={{ id: agent.id, name: agent.name }} live={live} />
        </TabsContent>
        <TabsContent value="profile">
          <ProfileTab agent={{ id: agent.id, name: agent.name }} project={project} />
        </TabsContent>
        <TabsContent value="abilities">
          <AbilitiesTab agentId={agent.id} project={project} />
        </TabsContent>
        <TabsContent value="knowledge">
          <KnowledgeTab agentId={agent.id} />
        </TabsContent>
        <TabsContent value="schedule">
          <ScheduleTab agentId={agent.id} />
        </TabsContent>
      </Tabs>
    </Screen>
  );
}
