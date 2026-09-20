"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api-client";
import type { ScopeDto } from "@/lib/work/scope";
import type { ScopeInputPayload, IntegrationInputPayload } from "@/lib/work/validation";
import type { ActionItemDto, IntegrationDto } from "@/lib/work/serialize";

export const workKeys = {
  scope: (agentId: string) => ["scope", agentId] as const,
  actionItems: (filters: Record<string, string>) => ["action-items", filters] as const,
  actionItem: (id: string) => ["action-items", id] as const,
  integrations: (project: string) => ["integrations", project] as const,
};

function query(filters: Record<string, string>): string {
  const params = new URLSearchParams(
    Object.entries(filters).filter(([, value]) => value && value !== "all"),
  );
  const search = params.toString();
  return search ? `?${search}` : "";
}

// --- scope of work ----------------------------------------------------------

export function useScope(agentId: string | null) {
  return useQuery({
    queryKey: workKeys.scope(agentId ?? ""),
    queryFn: () => api<ScopeDto>(`/api/agents/${agentId}/scope`),
    enabled: Boolean(agentId),
  });
}

export function useSaveScope(agentId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: ScopeInputPayload) =>
      api<ScopeDto>(`/api/agents/${agentId}/scope`, { method: "PUT", body: JSON.stringify(input) }),
    onSuccess: (scope) => client.setQueryData(workKeys.scope(agentId), scope),
  });
}

export function useRunScope(agentId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () =>
      api<{ id: string; status: string; error: string | null }>(`/api/agents/${agentId}/scope/run`, {
        method: "POST",
      }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ["action-items"] }),
  });
}

// --- action items -----------------------------------------------------------

export function useActionItems(
  filters: { project: string; status?: string; agentId?: string },
  options: { refetchInterval?: number } = {},
) {
  const clean = Object.fromEntries(
    Object.entries(filters).filter(([, v]) => v !== undefined),
  ) as Record<string, string>;
  return useQuery({
    queryKey: workKeys.actionItems(clean),
    queryFn: () => api<ActionItemDto[]>(`/api/action-items${query(clean)}`),
    enabled: Boolean(filters.project),
    refetchInterval: options.refetchInterval,
  });
}

function useDecision(verb: "approve" | "reject") {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      api<ActionItemDto>(`/api/action-items/${id}/${verb}`, {
        method: "POST",
        body: JSON.stringify(verb === "reject" ? { reason: reason ?? "" } : {}),
      }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ["action-items"] }),
  });
}
export const useApproveActionItem = () => useDecision("approve");
export const useRejectActionItem = () => useDecision("reject");

// --- integrations -----------------------------------------------------------

export function useIntegrations(project: string) {
  return useQuery({
    queryKey: workKeys.integrations(project),
    queryFn: () =>
      api<IntegrationDto[]>(`/api/integrations?project=${encodeURIComponent(project)}`),
    enabled: Boolean(project),
  });
}

export function useCreateIntegration(project: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: IntegrationInputPayload) =>
      api<IntegrationDto>(`/api/integrations?project=${encodeURIComponent(project)}`, {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: () => void client.invalidateQueries({ queryKey: workKeys.integrations(project) }),
  });
}

export function useDeleteIntegration(project: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<{ ok: true }>(`/api/integrations/${id}`, { method: "DELETE" }),
    onSuccess: () => void client.invalidateQueries({ queryKey: workKeys.integrations(project) }),
  });
}

// --- drafts -----------------------------------------------------------------

export function useUpdateDraft() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...input }: { id: string; title?: string; body?: string; to?: string }) =>
      api<import("@/lib/work/serialize").DraftDto>(`/api/drafts/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ["action-items"] }),
  });
}
