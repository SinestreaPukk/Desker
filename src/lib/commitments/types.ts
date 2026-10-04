export type CommitmentType = "to_do" | "waiting_on" | "recurring";
export type CommitmentStatus = "open" | "waiting" | "snoozed" | "done" | "dropped";
export type CommitmentOwnerRole = "user" | "other";

export interface CommitmentActivityEntry {
  at: string;
  action: string;
  note?: string;
}

export interface CommitmentDto {
  id: string;
  projectId: string;
  type: CommitmentType;
  ownerRole: CommitmentOwnerRole;
  ownerName: string | null;
  outcome: string;
  dueAt: string | null;
  status: CommitmentStatus;
  snoozedUntil: string | null;
  sourceRef: string | null;
  checkSignal: string | null;
  activityLog: CommitmentActivityEntry[];
  nudgeCount: number;
  lastNudgeAt: string | null;
  followUpDraft: string | null;
  closedAt: string | null;
  closedReason: string | null;
  createdAt: string;
  updatedAt: string;
}
