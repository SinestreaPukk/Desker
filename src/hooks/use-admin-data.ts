"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, queryString } from "@/lib/api-client";
import type {
  AgentDetailDto,
  AgentSummaryDto,
  DocumentDto,
  IssueDto,
  } from "@/lib/serialize";
import type { AgentInput } from "@/lib/validation";

export const keys = {
  agents: (project: string) => ["agents", project] as const,
  agent: (id: string) => ["agents", id] as const,
  documents: (agentId: string) => ["agents", agentId, "documents"] as const,
  issues: (filters: Record<string, string>) => ["issues", filters] as const,
};

// --- agents -----------------------------------------------------------------

export function useAgents(project: string) {
  return useQuery({
    queryKey: keys.agents(project),
    queryFn: () =>
      api<AgentSummaryDto[]>(`/api/agents?project=${encodeURIComponent(project)}`),
    enabled: Boolean(project),
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

export function useIssues(filters: Record<string, string>) {
  return useQuery({
    queryKey: keys.issues(filters),
    queryFn: () => api<IssueDto[]>(`/api/issues${queryString(filters)}`),
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
      void client.invalidateQueries({ queryKey: ["agents"] });
      // A run's flag is an issue too: Work's Needs you reads off it.
      void client.invalidateQueries({ queryKey: ["action-items"] });
    },
  });
}

// --- agent utilities --------------------------------------------------------

interface PromptPreview {
  prompt: string;
  tools: { name: string; description: string }[];
  approxTokens: number;
  workPrompt?: string;
  workTools?: { name: string; description: string }[];
  approxWorkTokens?: number;
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

      // A suggestion or a digest touches only its own tab; everything else can
      // move a conversation, an issue count and an agent row at once.
      if (payload.type.startsWith("suggestion.")) {
        void client.invalidateQueries({ queryKey: ["suggestions"] });
        return;
      }
      if (payload.type.startsWith("digest.")) {
        void client.invalidateQueries({ queryKey: ["digests"] });
        return;
      }

      void client.invalidateQueries({ queryKey: ["issues"] });
      void client.invalidateQueries({ queryKey: ["agents"] });
    };

    // EventSource reconnects on its own; nothing to do but avoid noisy logs.
    source.onerror = () => {};

    return () => source.close();
  }, [client]);
}
