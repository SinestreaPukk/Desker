"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type {
  AgentDetailDto,
  AgentSummaryDto,
  ConversationSummaryDto,
  DocumentDto,
  IssueDto,
  MessageDto,
} from "@/lib/serialize";
import type { AgentInput } from "@/lib/validation";

export const keys = {
  agents: (project: string) => ["agents", project] as const,
  agent: (id: string) => ["agents", id] as const,
  documents: (agentId: string) => ["agents", agentId, "documents"] as const,
  conversations: (filters: Record<string, string>) =>
    ["conversations", filters] as const,
  conversation: (id: string) => ["conversations", id] as const,
  issues: (filters: Record<string, string>) => ["issues", filters] as const,
  analytics: (project: string, days: number) => ["analytics", project, days] as const,
};

function query(filters: Record<string, string>): string {
  const params = new URLSearchParams(
    Object.entries(filters).filter(([, value]) => value && value !== "all"),
  );
  const search = params.toString();
  return search ? `?${search}` : "";
}

// --- agents -----------------------------------------------------------------

export function useAgents(project: string) {
  return useQuery({
    queryKey: keys.agents(project),
    queryFn: () =>
      api<AgentSummaryDto[]>(`/api/agents?project=${encodeURIComponent(project)}`),
    enabled: Boolean(project),
  });
}

export function useAgent(agentId: string | null) {
  return useQuery({
    queryKey: keys.agent(agentId ?? ""),
    queryFn: () => api<AgentDetailDto>(`/api/agents/${agentId}`),
    enabled: Boolean(agentId),
  });
}

export function useCreateAgent(project: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<AgentInput>) =>
      api<AgentDetailDto>(`/api/agents?project=${encodeURIComponent(project)}`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: (agent) => {
      client.setQueryData(keys.agent(agent.id), agent);
      void client.invalidateQueries({ queryKey: ["agents"] });
    },
  });
}

export function useUpdateAgent(agentId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: Partial<AgentInput>) =>
      api<AgentDetailDto>(`/api/agents/${agentId}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: (agent) => {
      client.setQueryData(keys.agent(agent.id), agent);
      void client.invalidateQueries({ queryKey: ["agents"] });
    },
  });
}

export function useDeleteAgent() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (agentId: string) =>
      api<{ ok: true }>(`/api/agents/${agentId}`, { method: "DELETE" }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ["agents"] }),
  });
}

// --- documents --------------------------------------------------------------

export function useDocuments(agentId: string | null) {
  return useQuery({
    queryKey: keys.documents(agentId ?? ""),
    queryFn: () => api<DocumentDto[]>(`/api/agents/${agentId}/documents`),
    enabled: Boolean(agentId),
    // Ingestion is asynchronous; poll only while something is still processing.
    refetchInterval: (query) =>
      query.state.data?.some((document) => document.status === "pending")
        ? 1500
        : false,
  });
}

export function useUploadDocument(agentId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: async (file: File) => {
      const form = new FormData();
      form.append("file", file);
      return api<DocumentDto>(`/api/agents/${agentId}/documents`, {
        method: "POST",
        body: form,
      });
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.documents(agentId) });
      void client.invalidateQueries({ queryKey: ["agents"] });
    },
  });
}

export function useDeleteDocument(agentId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (documentId: string) =>
      api<{ ok: true }>(`/api/documents/${documentId}`, { method: "DELETE" }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.documents(agentId) });
      void client.invalidateQueries({ queryKey: ["agents"] });
    },
  });
}

// --- inbox ------------------------------------------------------------------

export function useConversations(filters: Record<string, string>) {
  return useQuery({
    queryKey: keys.conversations(filters),
    queryFn: () =>
      api<ConversationSummaryDto[]>(`/api/conversations${query(filters)}`),
    // Backstop for the live SSE feed, which is single-instance only.
    refetchInterval: 20_000,
  });
}

export interface ConversationDetail {
  id: string;
  status: string;
  mode: string;
  takenOverBy: string | null;
  summary: string | null;
  isPreview: boolean;
  agent: { id: string; name: string; jobTitle: string; avatarUrl: string | null };
  originalAgent: { id: string; name: string; jobTitle: string; avatarUrl: string | null } | null;
  createdAt: string;
  lastMessageAt: string;
  messages: MessageDto[];
  issues: IssueDto[];
}

export function useConversation(conversationId: string | null) {
  return useQuery({
    queryKey: keys.conversation(conversationId ?? ""),
    queryFn: () => api<ConversationDetail>(`/api/conversations/${conversationId}`),
    enabled: Boolean(conversationId),
    // A client can reply at any moment while a colleague has the conversation
    // open, so this view refreshes on its own as well as on the live feed.
    refetchInterval: 8_000,
  });
}

/** A colleague replying into the transcript, which reaches the client's chat. */
export function useSendReply(conversationId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { message: string; takeOver: boolean }) =>
      api<MessageDto>(`/api/conversations/${conversationId}/reply`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.conversation(conversationId) });
      void client.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}

/** Take a conversation over from the agent, or hand it back. */
export function useSetConversationMode(conversationId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (mode: "agent" | "human") =>
      api<{ id: string; mode: string }>(`/api/conversations/${conversationId}/mode`, {
        method: "PATCH",
        body: JSON.stringify({ mode }),
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: keys.conversation(conversationId) });
      void client.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}

export function useIssues(filters: Record<string, string>) {
  return useQuery({
    queryKey: keys.issues(filters),
    queryFn: () => api<IssueDto[]>(`/api/issues${query(filters)}`),
    refetchInterval: 20_000,
  });
}

export function useSetIssueStatus() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ issueId, status }: { issueId: string; status: "open" | "resolved" }) =>
      api<{ id: string }>(`/api/issues/${issueId}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["issues"] });
      void client.invalidateQueries({ queryKey: ["conversations"] });
      void client.invalidateQueries({ queryKey: ["agents"] });
    },
  });
}

export function useSetConversationStatus() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      conversationId,
      status,
    }: {
      conversationId: string;
      status: "open" | "escalated" | "resolved";
    }) =>
      api<{ id: string }>(`/api/conversations/${conversationId}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      }),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["conversations"] });
    },
  });
}

export interface AnalyticsResponse {
  days: number;
  totals: {
    conversations: number;
    escalated: number;
    issues: number;
    suggestions: number;
    searches: number;
    searchMisses: number;
    ratedUp: number;
    ratedDown: number;
  };
  agents: {
    id: string;
    name: string;
    jobTitle: string;
    avatarUrl: string | null;
    status: string;
    conversations: number;
    escalations: number;
    escalationRate: number | null;
    issues: number;
    suggestions: number;
    searches: number;
    retrievalHitRate: number | null;
    documents: number;
    ratedUp: number;
    ratedDown: number;
    satisfaction: number | null;
  }[];
  dislikedReplies: {
    messageId: string;
    conversationId: string;
    agentName: string;
    question: string | null;
    reply: string;
    ratedAt: string;
  }[];
  contentGaps: {
    query: string;
    misses: number;
    agentName: string;
    lastAskedAt: string;
  }[];
  work: {
    totals: import("@/app/api/analytics/route").WorkTotals;
    agents: import("@/app/api/analytics/route").AgentWorkStats[];
  };
}

export function useAnalytics(project: string, days = 30) {
  return useQuery({
    queryKey: keys.analytics(project, days),
    queryFn: () =>
      api<AnalyticsResponse>(
        `/api/analytics?days=${days}&project=${encodeURIComponent(project)}`,
      ),
    enabled: Boolean(project),
  });
}

// --- notes ------------------------------------------------------------------

export interface NoteDto {
  id: string;
  authorName: string;
  body: string;
  createdAt: string;
}

export function useNotes(conversationId: string) {
  return useQuery({
    queryKey: ["notes", conversationId],
    queryFn: () => api<NoteDto[]>(`/api/conversations/${conversationId}/notes`),
  });
}

export function useAddNote(conversationId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (body: string) =>
      api<NoteDto>(`/api/conversations/${conversationId}/notes`, {
        method: "POST",
        body: JSON.stringify({ body }),
      }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ["notes", conversationId] }),
  });
}

// --- agent utilities --------------------------------------------------------

export interface PromptPreview {
  prompt: string;
  tools: { name: string; description: string }[];
  approxTokens: number;
}

export function usePromptPreview(agentId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["prompt", agentId],
    queryFn: () => api<PromptPreview>(`/api/agents/${agentId}/prompt`),
    enabled,
    staleTime: 0,
  });
}

export function useDuplicateAgent(agentId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { projectId?: string; includeDocuments: boolean }) =>
      api<{
        agent: AgentDetailDto;
        project: { id: string; slug: string; name: string };
        copiedDocuments: number;
      }>(`/api/agents/${agentId}/duplicate`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ["agents"] }),
  });
}

export interface ProjectDto {
  id: string;
  name: string;
  slug: string;
  agentCount: number;
  publishedCount: number;
  createdAt: string;
}

export function useProjects() {
  return useQuery({
    queryKey: ["projects"],
    queryFn: () => api<ProjectDto[]>("/api/projects"),
  });
}

// --- live feed --------------------------------------------------------------

/**
 * Subscribes to the admin SSE feed and invalidates the affected queries, so an
 * issue logged by an agent mid-conversation appears without a manual refresh.
 */
export function useAdminLiveFeed() {
  const client = useQueryClient();

  React.useEffect(() => {
    const source = new EventSource("/api/events");

    source.onmessage = (event) => {
      let payload: { type?: string } | null = null;
      try {
        payload = JSON.parse(event.data);
      } catch {
        return;
      }
      if (!payload?.type || payload.type === "ready") return;

      void client.invalidateQueries({ queryKey: ["issues"] });
      void client.invalidateQueries({ queryKey: ["conversations"] });
      void client.invalidateQueries({ queryKey: ["agents"] });
    };

    // EventSource reconnects on its own; nothing to do but avoid noisy logs.
    source.onerror = () => {};

    return () => source.close();
  }, [client]);
}
