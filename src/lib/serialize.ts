/**
 * DTOs returned by the API.
 *
 * Explicit shapes rather than leaking Prisma rows: the public chat endpoints
 * must never return an agent's escalation rule, passcode, or personality to a
 * client browser, and a `select` that quietly grows is how that leaks.
 */
import { toStringArray } from "@/lib/agent-fields";

export interface AgentSummaryDto {
  id: string;
  name: string;
  jobTitle: string;
  department: string | null;
  avatarUrl: string | null;
  status: string;
  modelProvider: string;
  conversationCount: number;
  documentCount: number;
  openIssueCount: number;
  updatedAt: string;
}

export interface AgentDetailDto extends Omit<AgentSummaryDto, "conversationCount" | "documentCount" | "openIssueCount"> {
  personality: string;
  responsibilities: string[];
  allowedTools: string[];
  escalationRule: string | null;
  welcomeMessage: string | null;
  model: string | null;
  publicPasscode: string | null;
  widgetLabel: string | null;
  widgetColor: string | null;
  widgetSide: string | null;
  createdAt: string;
}

/** The only agent fields a client browser is allowed to see. */
export interface PublicAgentDto {
  id: string;
  name: string;
  jobTitle: string;
  department: string | null;
  avatarUrl: string | null;
  welcomeMessage: string | null;
  requiresPasscode: boolean;
}

type AgentRow = {
  id: string;
  name: string;
  jobTitle: string;
  department: string | null;
  avatarUrl: string | null;
  personality: string;
  responsibilities: unknown;
  allowedTools: unknown;
  escalationRule: string | null;
  welcomeMessage: string | null;
  status: string;
  modelProvider: string;
  model: string | null;
  publicPasscode: string | null;
  widgetLabel: string | null;
  widgetColor: string | null;
  widgetSide: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export function toAgentDetail(agent: AgentRow): AgentDetailDto {
  return {
    id: agent.id,
    name: agent.name,
    jobTitle: agent.jobTitle,
    department: agent.department,
    avatarUrl: agent.avatarUrl,
    personality: agent.personality,
    responsibilities: toStringArray(agent.responsibilities),
    allowedTools: toStringArray(agent.allowedTools),
    escalationRule: agent.escalationRule,
    welcomeMessage: agent.welcomeMessage,
    status: agent.status,
    modelProvider: agent.modelProvider,
    model: agent.model,
    publicPasscode: agent.publicPasscode,
    widgetLabel: agent.widgetLabel,
    widgetColor: agent.widgetColor,
    widgetSide: agent.widgetSide,
    createdAt: agent.createdAt.toISOString(),
    updatedAt: agent.updatedAt.toISOString(),
  };
}

export function toPublicAgent(agent: {
  id: string;
  name: string;
  jobTitle: string;
  department: string | null;
  avatarUrl: string | null;
  welcomeMessage: string | null;
  publicPasscode: string | null;
}): PublicAgentDto {
  return {
    id: agent.id,
    name: agent.name,
    jobTitle: agent.jobTitle,
    department: agent.department,
    avatarUrl: agent.avatarUrl,
    welcomeMessage: agent.welcomeMessage,
    // The passcode itself never crosses the wire - only whether one exists.
    requiresPasscode: Boolean(agent.publicPasscode),
  };
}

export interface DocumentDto {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  status: string;
  error: string | null;
  chunkCount: number;
  createdAt: string;
}

export interface IssueDto {
  id: string;
  /** Set when a client raised it in a conversation. */
  conversationId: string | null;
  /** Set when the agent raised it during an autonomous run. */
  actionItemId: string | null;
  /** client | agent */
  source: string;
  type: string;
  summary: string;
  severity: string | null;
  details: string | null;
  status: string;
  createdAt: string;
  agent?: { id: string; name: string; avatarUrl: string | null };
}

export interface MessageDto {
  id: string;
  role: string;
  content: string;
  /** Set on a `human` turn: the colleague who wrote it. */
  authorName?: string | null;
  /** The client's rating, if they gave one. */
  rating?: number | null;
  createdAt: string;
}

export interface ConversationSummaryDto {
  id: string;
  agent: { id: string; name: string; jobTitle: string; avatarUrl: string | null };
  status: string;
  /** agent: the AI answers. human: a colleague has taken over. */
  mode: string;
  takenOverBy: string | null;
  /** Rolling summary, so the list is scannable without opening each one. */
  summary: string | null;
  messageCount: number;
  issueCount: number;
  openIssueCount: number;
  preview: string;
  createdAt: string;
  lastMessageAt: string;
}
