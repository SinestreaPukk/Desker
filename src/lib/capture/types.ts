export type CaptureInputType = "text" | "photo" | "voice" | "file" | "link" | "forwarded";
export type CaptureClassification = "task" | "event" | "bill" | "note" | "question" | "vault_file";
export type CaptureStatus = "created" | "needs_confirmation" | "confirmed" | "rejected" | "switched";

export interface BillExtractionData {
  payee: string;
  amountMinor: number;
  amountMajor: number;
  currency: string;
  dueDate?: string; // YYYY-MM-DD or ISO
  referenceNumber?: string;
  lineItems?: Array<{ description: string; amountMinor: number }>;
}

export interface EventExtractionData {
  title: string;
  startsAt: string; // ISO date
  endsAt?: string;
  location?: string;
}

export interface TaskExtractionData {
  title: string;
  dueAt?: string;
}

export interface IntakeResult {
  capturedItem: {
    id: string;
    projectId: string;
    inputType: string;
    classification: CaptureClassification;
    confidence: number;
    headline: string;
    rawContent?: string | null;
    extractedData?: unknown;
    uncertainFields?: string[] | null;
    status: string;
    targetType?: string | null;
    targetId?: string | null;
    sourceRef?: string | null;
    altClassification?: string | null;
  };
  confirmationText: string;
  isLowConfidence: boolean;
  uncertainFields: string[];
  quickReplies?: string[];
  bubbleCard?: {
    title: string;
    classification: string;
    fields: Array<{ label: string; value: string; uncertain: boolean }>;
    switchOptions?: Array<{ label: string; classification: string }>;
  };
}
