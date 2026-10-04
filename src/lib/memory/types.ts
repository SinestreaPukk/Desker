export type MemoryKind = "preference" | "person" | "routine" | "standing_instruction" | "fact";
export type MemorySource = "user" | "inferred" | "capture";
export type MemoryStatus = "confirmed" | "pending_confirmation" | "rejected";

export interface MemoryRecordDto {
  id: string;
  projectId: string;
  fact: string;
  kind: MemoryKind;
  source: MemorySource;
  status: MemoryStatus;
  confidence: number | null;
  personId: string | null;
  person?: {
    id: string;
    name: string;
    relationship: string | null;
  } | null;
  createdAt: string;
  updatedAt: string;
  lastUsedAt: string | null;
}
