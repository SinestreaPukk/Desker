"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { api, errorMessage, queryString } from "@/lib/api-client";
import type { OAuthProvider } from "@/lib/integrations/catalog";
import type { ScopeDto } from "@/lib/work/scope";
import type { ScopeInputPayload, IntegrationInputPayload } from "@/lib/work/validation";
import type {
  ActionItemDto,
  IntegrationDto,
  SuggestionDto,
} from "@/lib/work/serialize";
import type { ProjectCheckInDto, SuggestionStatus } from "@/lib/work/types";
import type { ContextAnswers } from "@/lib/work/context";
import type { ProjectContextDto } from "@/lib/work/project-context";
import type { AgentRuleDto } from "@/lib/work/rules";
import type { ContextDraftResult } from "@/components/builder/context-questions";

const workKeys = {
  scope: (agentId: string) => ["scope", agentId] as const,
  actionItems: (filters: Record<string, string>) => ["action-items", filters] as const,
  actionItem: (id: string) => ["action-items", id] as const,
  integrations: (project: string) => ["integrations", project] as const,
  projectContext: (project: string) => ["project-context", project] as const,
  digests: (filters: Record<string, string>) => ["digests", filters] as const,
  suggestions: (filters: Record<string, string>) => ["suggestions", filters] as const,
};

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
    // An instruction, when given, becomes this run's task on top of the agent's goals.
    mutationFn: (instruction?: string) =>
      api<{ id: string; status: string; error: string | null }>(`/api/agents/${agentId}/scope/run`, {
        method: "POST",
        body: JSON.stringify({ instruction }),
      }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ["action-items"] }),
  });
}

// --- action items -----------------------------------------------------------

export function useActionItems(
  filters: { project: string; status?: string; agentId?: string; view?: "list" },
  options: { refetchInterval?: number | ((items: ActionItemDto[] | undefined) => number) } = {},
) {
  const clean = Object.fromEntries(
    Object.entries(filters).filter(([, v]) => v !== undefined),
  ) as Record<string, string>;
  return useQuery({
    queryKey: workKeys.actionItems(clean),
    queryFn: () => api<ActionItemDto[]>(`/api/action-items${queryString(clean)}`),
    enabled: Boolean(filters.project),
    refetchInterval:
      typeof options.refetchInterval === "function"
        ? (query) => (options.refetchInterval as (items: ActionItemDto[] | undefined) => number)(query.state.data)
        : options.refetchInterval,
  });
}

/** One run, polled while it is still moving. Shares the "action-items" prefix, so decisions refresh it. */
export function useActionItem(id: string) {
  return useQuery({
    queryKey: workKeys.actionItem(id),
    queryFn: () => api<ActionItemDto>(`/api/action-items/${id}`),
    refetchInterval: (q) => (q.state.data && FINISHED.has(q.state.data.status) ? false : 5_000),
  });
}

/** A run in one of these has nothing left to do; everything else is still active. */
export const FINISHED = new Set<string>(["done", "failed", "rejected", "cancelled"]);

export function useCancelRun() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api<ActionItemDto>(`/api/action-items/${id}/cancel`, { method: "POST" }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ["action-items"] }),
  });
}

/** Every removable thing in Work and the Inbox, by the API path it lives under. */
const REMOVABLE = {
  run: { path: "action-items", key: "action-items" },
  conversation: { path: "conversations", key: "conversations" },
  issue: { path: "issues", key: "issues" },
  suggestion: { path: "suggestions", key: "suggestions" },
  update: { path: "digests", key: "digests" },
} as const;
type Removable = keyof typeof REMOVABLE;

export type RemoveTarget = { kind: Removable; id: string };

/** Deletes one item or several, of any kinds ("Clear all" in a Done list mixes them). */
export function useRemove() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (targets: RemoveTarget[]) =>
      Promise.all(
        targets.map(({ kind, id }) => api<{ ok: true }>(`/api/${REMOVABLE[kind].path}/${id}`, { method: "DELETE" })),
      ),
    onSettled: (_data, _error, targets) => {
      for (const kind of new Set(targets.map((target) => target.kind))) {
        void client.invalidateQueries({ queryKey: [REMOVABLE[kind].key] });
      }
    },
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

// --- saved corrections (AgentRule) ----------------------------------------------

const rulesKey = (agentId: string) => ["agent-rules", agentId] as const;

export function useAgentRules(agentId: string) {
  return useQuery({
    queryKey: rulesKey(agentId),
    queryFn: () => api<AgentRuleDto[]>(`/api/agents/${agentId}/rules`),
    enabled: Boolean(agentId),
  });
}

export function useSaveRule(agentId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (input: { id?: string; text: string; source?: AgentRuleDto["source"]; actionItemId?: string }) =>
      input.id
        ? api<AgentRuleDto>(`/api/agents/${agentId}/rules/${input.id}`, { method: "PATCH", body: JSON.stringify({ text: input.text }) })
        : api<AgentRuleDto>(`/api/agents/${agentId}/rules`, {
            method: "POST",
            body: JSON.stringify({ text: input.text, source: input.source ?? "manual", actionItemId: input.actionItemId }),
          }),
    onSettled: () => void client.invalidateQueries({ queryKey: rulesKey(agentId) }),
  });
}

export function useRemoveRule(agentId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (ruleId: string) => api(`/api/agents/${agentId}/rules/${ruleId}`, { method: "DELETE" }),
    onSettled: () => void client.invalidateQueries({ queryKey: rulesKey(agentId) }),
  });
}

/** Retry a failed run: a new run, or the same send back in Needs you. */
export function useRetryRun() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (runId: string) =>
      api<{ id: string; resend: boolean }>(`/api/action-items/${runId}/retry`, { method: "POST" }),
    onSettled: () => {
      void client.invalidateQueries({ queryKey: ["action-items"] });
      void client.invalidateQueries({ queryKey: ["agents"] });
      void client.invalidateQueries({ queryKey: ["issues"] });
    },
  });
}

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

export function useCheckIns(filters: Record<string, string>) {
  return useQuery({
    queryKey: ["check-ins", filters],
    queryFn: () => api<ProjectCheckInDto[]>(`/api/check-ins${queryString(filters)}`),
    enabled: Boolean(filters.project),
    refetchInterval: 60_000,
  });
}

export function useSetCheckInRead() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ checkInId, read }: { checkInId: string; read: boolean }) =>
      api<ProjectCheckInDto>(`/api/check-ins/${checkInId}`, { method: "PATCH", body: JSON.stringify({ read }) }),
    onSuccess: () => void client.invalidateQueries({ queryKey: ["check-ins"] }),
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
      setTimeout(() => {
        void client.invalidateQueries({ queryKey: ["digests"] });
        void client.invalidateQueries({ queryKey: ["check-ins"] });
      }, 4_000);
    },
  });
}

export function useSuggestions(filters: Record<string, string>) {
  return useQuery({
    queryKey: workKeys.suggestions(filters),
    queryFn: () => api<SuggestionDto[]>(`/api/suggestions${queryString(filters)}`),
    enabled: Boolean(filters.project),
    refetchInterval: 30_000,
  });
}

interface SuggestionDecision extends SuggestionDto {
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
      void client.invalidateQueries({ queryKey: ["check-ins"] });
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

/** Which OAuth providers this server can connect; changes only with a redeploy. */
export function useOAuthProviders() {
  return useQuery({
    queryKey: ["integrations", "providers"],
    queryFn: () => api<Record<OAuthProvider, boolean>>("/api/integrations/providers"),
    staleTime: Infinity,
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

const orgKeys = {
  org: (orgId: string) => ["organization", orgId] as const,
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

export function useUpdateOrganization(orgId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (changes: { name?: string }) =>
      api<{ id: string; name: string }>(`/api/organizations/${orgId}`, {
        method: "PATCH",
        body: JSON.stringify(changes),
      }),
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
