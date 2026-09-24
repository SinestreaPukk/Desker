"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, errorMessage } from "@/lib/api-client";
import type { ScopeDto } from "@/lib/work/scope";
import type { ScopeInputPayload, IntegrationInputPayload } from "@/lib/work/validation";
import type {
  ActionItemDto,
  DigestDto,
  IntegrationDto,
  SuggestionDto,
} from "@/lib/work/serialize";
import type { SuggestionStatus } from "@/lib/work/types";
import type { ContextAnswers } from "@/lib/work/context";
import type { ProjectContextDto } from "@/lib/work/project-context";
import type { ContextDraftResult } from "@/components/builder/context-questions";

export const workKeys = {
  scope: (agentId: string) => ["scope", agentId] as const,
  actionItems: (filters: Record<string, string>) => ["action-items", filters] as const,
  actionItem: (id: string) => ["action-items", id] as const,
  integrations: (project: string) => ["integrations", project] as const,
  projectContext: (project: string) => ["project-context", project] as const,
  digests: (filters: Record<string, string>) => ["digests", filters] as const,
  suggestions: (filters: Record<string, string>) => ["suggestions", filters] as const,
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

function useDecision(verb: "approve" | "reject" | "reopen") {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      api<ActionItemDto>(`/api/action-items/${id}/${verb}`, {
        method: "POST",
        body: JSON.stringify(verb === "reject" ? { reason: reason ?? "" } : {}),
      }),
    onMutate: async ({ id, reason }) => {
      await client.cancelQueries({ queryKey: ["action-items"] });
      const previousQueries = client.getQueriesData<ActionItemDto[]>({ queryKey: ["action-items"] });

      client.setQueriesData<ActionItemDto[]>({ queryKey: ["action-items"] }, (old) => {
        if (!old) return old;
        return old.map((item) => {
          if (item.id !== id) return item;
          if (verb === "approve") {
            return {
              ...item,
              status: "approved",
              executedAt: new Date().toISOString(),
              pendingAction: null,
            };
          }
          if (verb === "reject") {
            return {
              ...item,
              status: "rejected",
              rejectionReason: reason ?? "",
              pendingAction: null,
            };
          }
          if (verb === "reopen") {
            return {
              ...item,
              status: "needs_approval",
              rejectionReason: null,
            };
          }
          return item;
        });
      });

      return { previousQueries };
    },
    onError: (err, _variables, context) => {
      if (context?.previousQueries) {
        for (const [key, val] of context.previousQueries) {
          client.setQueryData(key, val);
        }
      }
      toast.error(`Could not ${verb} action item: ${errorMessage(err)}`);
    },
    onSettled: () => {
      void client.invalidateQueries({ queryKey: ["action-items"] });
    },
  });
}
export const useApproveActionItem = () => useDecision("approve");
export const useRejectActionItem = () => useDecision("reject");
export const useReopenActionItem = () => useDecision("reopen" as "approve");

// --- context ----------------------------------------------------------------

/** The project's shared context, inherited by every agent in it. */
export function useProjectContext(project: string) {
  return useQuery({
    queryKey: workKeys.projectContext(project),
    queryFn: () =>
      api<ProjectContextDto>(`/api/projects/${encodeURIComponent(project)}/context`),
    enabled: Boolean(project),
  });
}

export function useSaveProjectContext(project: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (answers: ContextAnswers) =>
      api<ProjectContextDto>(`/api/projects/${encodeURIComponent(project)}/context`, {
        method: "PUT",
        body: JSON.stringify({ answers }),
      }),
    onSuccess: (context) => {
      client.setQueryData(workKeys.projectContext(project), context);
      // Every agent's prompt preview now reads differently.
      void client.invalidateQueries({ queryKey: ["prompt"] });
    },
  });
}

/** Proposes answers from the project's documents. Nothing is saved. */
export function useDraftProjectContext(project: string) {
  return useMutation({
    mutationFn: () =>
      api<ContextDraftResult>(`/api/projects/${encodeURIComponent(project)}/context/draft`, {
        method: "POST",
      }),
  });
}

/** The same, for one agent's own questions and its own documents. */
export function useDraftAgentContext(agentId: string) {
  return useMutation({
    mutationFn: () =>
      api<ContextDraftResult>(`/api/agents/${agentId}/scope/context-draft`, { method: "POST" }),
  });
}

// --- digests and suggestions ------------------------------------------------

/** The Inbox's Updates tab. Polled as a backstop for the live feed. */
export function useDigests(filters: Record<string, string>) {
  return useQuery({
    queryKey: workKeys.digests(filters),
    queryFn: () => api<DigestDto[]>(`/api/digests${query(filters)}`),
    enabled: Boolean(filters.project),
    refetchInterval: 60_000,
  });
}

export function useSetDigestRead() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ digestId, read }: { digestId: string; read: boolean }) =>
      api<DigestDto>(`/api/digests/${digestId}`, {
        method: "PATCH",
        body: JSON.stringify({ read }),
      }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ["digests"] }),
  });
}

/** "Send me one now" from the agent's editor. */
export function useGenerateDigest(agentId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: () => api<{ queued: true }>(`/api/agents/${agentId}/digest`, { method: "POST" }),
    onSuccess: () => {
      // The digest is written by a background job, so the list is refreshed a
      // moment later rather than immediately.
      setTimeout(() => void client.invalidateQueries({ queryKey: ["digests"] }), 4_000);
    },
  });
}

export function useSuggestions(filters: Record<string, string>) {
  return useQuery({
    queryKey: workKeys.suggestions(filters),
    queryFn: () => api<SuggestionDto[]>(`/api/suggestions${query(filters)}`),
    enabled: Boolean(filters.project),
    refetchInterval: 30_000,
  });
}

export interface SuggestionDecision extends SuggestionDto {
  /** What accepting added to the agent's objectives, when it added anything. */
  addedObjective: string | null;
}

export function useDecideSuggestion() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      suggestionId,
      status,
      snoozeDays,
    }: {
      suggestionId: string;
      status: SuggestionStatus;
      snoozeDays?: number;
    }) =>
      api<SuggestionDecision>(`/api/suggestions/${suggestionId}`, {
        method: "PATCH",
        body: JSON.stringify({ status, ...(snoozeDays ? { snoozeDays } : {}) }),
      }),
    onMutate: async ({ suggestionId, status }) => {
      await client.cancelQueries({ queryKey: ["suggestions"] });
      const previousQueries = client.getQueriesData<SuggestionDto[]>({ queryKey: ["suggestions"] });

      client.setQueriesData<SuggestionDto[]>({ queryKey: ["suggestions"] }, (old) => {
        if (!old) return old;
        return old.map((item) => (item.id === suggestionId ? { ...item, status } : item));
      });

      return { previousQueries };
    },
    onError: (err, _variables, context) => {
      if (context?.previousQueries) {
        for (const [key, val] of context.previousQueries) {
          client.setQueryData(key, val);
        }
      }
      toast.error(`Could not update suggestion: ${errorMessage(err)}`);
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["suggestions"] });
      // Accepting writes an objective onto the scope of work.
      void client.invalidateQueries({ queryKey: ["scope"] });
    },
  });
}

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

// --- organisation -----------------------------------------------------------

import type { MemberDto } from "@/app/api/organizations/[orgId]/members/route";
import type { InviteDto } from "@/app/api/organizations/[orgId]/invites/route";

export const orgKeys = {
  org: (orgId: string) => ["organization", orgId] as const,
  members: (orgId: string) => ["organization", orgId, "members"] as const,
  invites: (orgId: string) => ["organization", orgId, "invites"] as const,
  billing: (project: string) => ["billing", project] as const,
};

export function useOrganization(orgId: string) {
  return useQuery({
    queryKey: orgKeys.org(orgId),
    queryFn: () =>
      api<{ id: string; name: string; slug: string; plan: string; role: string; members: number; projects: number }>(
        `/api/organizations/${orgId}`,
      ),
    enabled: Boolean(orgId),
  });
}

export function useMembers(orgId: string) {
  return useQuery({
    queryKey: orgKeys.members(orgId),
    queryFn: () => api<MemberDto[]>(`/api/organizations/${orgId}/members`),
    enabled: Boolean(orgId),
  });
}

export function useInvites(orgId: string, enabled = true) {
  return useQuery({
    queryKey: orgKeys.invites(orgId),
    queryFn: () => api<InviteDto[]>(`/api/organizations/${orgId}/invites`),
    enabled: Boolean(orgId) && enabled,
  });
}

export function useCreateInvite(orgId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { email: string; role: string }) =>
      api<InviteDto>(`/api/organizations/${orgId}/invites`, { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => void client.invalidateQueries({ queryKey: orgKeys.invites(orgId) }),
  });
}

export function useRevokeInvite(orgId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (inviteId: string) =>
      api<{ ok: true }>(`/api/organizations/${orgId}/invites/${inviteId}`, { method: "DELETE" }),
    onSuccess: () => void client.invalidateQueries({ queryKey: orgKeys.invites(orgId) }),
  });
}

export function useSetMemberRole(orgId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      api<{ userId: string; role: string }>(`/api/organizations/${orgId}/members/${userId}`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      }),
    onSuccess: () => void client.invalidateQueries({ queryKey: orgKeys.members(orgId) }),
  });
}

export function useRemoveMember(orgId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) =>
      api<{ ok: true }>(`/api/organizations/${orgId}/members/${userId}`, { method: "DELETE" }),
    onSuccess: () => void client.invalidateQueries({ queryKey: orgKeys.members(orgId) }),
  });
}

export function useRenameOrganization(orgId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (name: string) =>
      api<{ id: string; name: string }>(`/api/organizations/${orgId}`, { method: "PATCH", body: JSON.stringify({ name }) }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ["organization", orgId] }),
  });
}

export interface BillingSummary {
  organization: { id: string; name: string };
  role: string;
  plan: import("@/lib/billing/plans").Plan;
  subscriptionStatus: string | null;
  currentPeriodEnd: string | null;
  hasPaymentMethod: boolean;
  usage: {
    period: string;
    publishedAgents: number;
    actionItems: number;
    conversations: number;
    modelCostUsd: number;
    inputTokens: number;
    outputTokens: number;
    searches: number;
  };
  plans: (import("@/lib/billing/plans").Plan & { purchasable: boolean })[];
  stripeConfigured: boolean;
}

export function useBilling(project: string) {
  return useQuery({
    queryKey: orgKeys.billing(project),
    queryFn: () => api<BillingSummary>(`/api/billing?project=${encodeURIComponent(project)}`),
    enabled: Boolean(project),
  });
}

export function useCheckout(project: string) {
  return useMutation({
    mutationFn: (plan: "starter" | "growth") =>
      api<{ url: string }>(`/api/billing/checkout`, { method: "POST", body: JSON.stringify({ project, plan }) }),
  });
}

export function useBillingPortal(project: string) {
  return useMutation({
    mutationFn: () => api<{ url: string }>(`/api/billing/portal`, { method: "POST", body: JSON.stringify({ project }) }),
  });
}
