import "server-only";
import { prisma } from "@/lib/platform/db";
import { transcribeAudio } from "./voice";
import { extractAndClassify } from "./extraction";
import { saveMemory } from "@/lib/memory/store";
import type { CaptureInputType, CaptureClassification, IntakeResult } from "./types";

export interface ProcessIntakeInput {
  projectId: string;
  organizationId: string;
  inputType: CaptureInputType;
  text?: string;
  file?: {
    name: string;
    type: string;
    data: Buffer;
  };
  sourceRef?: string;
  sourceChannel?: "line" | "app";
  timeZone?: string;
}

export async function processIntake(input: ProcessIntakeInput): Promise<IntakeResult> {
  const { projectId, organizationId, inputType, sourceRef, sourceChannel = "line" } = input;
  let normalizedText = (input.text ?? "").trim();

  // 1. Voice transcription
  if (inputType === "voice" && input.file) {
    const transcript = await transcribeAudio(input.file.data, input.file.type);
    normalizedText = transcript;
  }

  // 2. Classify and extract
  const extraction = await extractAndClassify(normalizedText, organizationId);
  const { classification, confidence, headline, billData, eventData, taskData, noteText, uncertainFields, altClassification } = extraction;

  const isLowConfidence = confidence < 0.75 || uncertainFields.includes("amount") || uncertainFields.includes("payee");

  let targetType: string | null = null;
  let targetId: string | null = null;
  let confirmationText = "";
  const quickReplies: string[] = [];

  // 3. Act if confident
  if (!isLowConfidence) {
    if (classification === "bill" && billData) {
      targetType = "LifeEntry";
      let occurredAt = new Date();
      if (billData.dueDate) {
        const parsedDate = new Date(billData.dueDate);
        if (!isNaN(parsedDate.getTime())) occurredAt = parsedDate;
      }

      const entry = await prisma.lifeEntry.create({
        data: {
          projectId,
          kind: "bill",
          payee: billData.payee,
          amountMinor: billData.amountMinor,
          currency: billData.currency,
          occurredAt,
          status: "unpaid",
          source: "capture",
          sourceRef: sourceRef ?? null,
          lineItems: billData.lineItems ? (billData.lineItems as object) : undefined,
        },
        select: { id: true },
      });
      targetId = entry.id;

      const duePart = billData.dueDate ? `, due ${billData.dueDate}` : "";
      confirmationText = `Added: ${billData.payee}, ${billData.amountMajor.toLocaleString()} ${billData.currency}${duePart}`;
    } else if (classification === "event" && eventData) {
      targetType = "LifeEvent";
      let startsAt = new Date();
      if (eventData.startsAt) {
        const parsed = new Date(eventData.startsAt);
        if (!isNaN(parsed.getTime())) startsAt = parsed;
      }

      const event = await prisma.lifeEvent.create({
        data: {
          projectId,
          title: eventData.title,
          startsAt,
          source: "capture",
        },
        select: { id: true },
      });
      targetId = event.id;
      confirmationText = `Added event: ${eventData.title}`;

      if (altClassification) {
        quickReplies.push(`Make it a ${altClassification} instead`);
      }
    } else if (classification === "task" && taskData) {
      targetType = "LifeTask";
      let dueAt: Date | undefined;
      if (taskData.dueAt) {
        const parsed = new Date(taskData.dueAt);
        if (!isNaN(parsed.getTime())) dueAt = parsed;
      }

      const task = await prisma.lifeTask.create({
        data: {
          projectId,
          title: taskData.title,
          kind: "task",
          dueAt,
          source: "capture",
        },
        select: { id: true },
      });
      targetId = task.id;
      confirmationText = `Added task: ${taskData.title}`;
    } else {
      // note / memory
      targetType = "MemoryRecord";
      const saved = await saveMemory({
        projectId,
        fact: noteText || headline,
        kind: "fact",
        source: "capture",
      });
      targetId = saved.memory.id;
      confirmationText = `Noted: ${noteText || headline}`;
    }
  } else {
    // Low confidence: don't create target silently. Require confirmation.
    confirmationText = `I captured this as a ${classification}, but please verify the details:`;
  }

  // 4. Save CapturedItem
  const capturedItem = await prisma.capturedItem.create({
    data: {
      projectId,
      inputType,
      classification,
      confidence,
      headline,
      rawContent: normalizedText || input.file?.name,
      extractedData: (billData || eventData || taskData || { note: noteText }) as object,
      uncertainFields: uncertainFields.length ? (uncertainFields as object) : undefined,
      status: isLowConfidence ? "needs_confirmation" : "created",
      targetType,
      targetId,
      sourceRef,
      sourceChannel,
      altClassification,
    },
  });

  // 5. Build bubble card details if low confidence or ambiguity
  const bubbleFields: Array<{ label: string; value: string; uncertain: boolean }> = [];
  if (billData) {
    bubbleFields.push({ label: "Payee", value: billData.payee, uncertain: uncertainFields.includes("payee") });
    bubbleFields.push({ label: "Amount", value: `${billData.amountMajor} ${billData.currency}`, uncertain: uncertainFields.includes("amount") });
    if (billData.dueDate) {
      bubbleFields.push({ label: "Due Date", value: billData.dueDate, uncertain: uncertainFields.includes("dueDate") });
    }
    if (billData.referenceNumber) {
      bubbleFields.push({ label: "Reference", value: billData.referenceNumber, uncertain: false });
    }
  } else if (eventData) {
    bubbleFields.push({ label: "Title", value: eventData.title, uncertain: false });
    bubbleFields.push({ label: "Time", value: eventData.startsAt, uncertain: uncertainFields.includes("startsAt") });
  } else if (taskData) {
    bubbleFields.push({ label: "Task", value: taskData.title, uncertain: false });
  }

  return {
    capturedItem: {
      id: capturedItem.id,
      projectId: capturedItem.projectId,
      inputType: capturedItem.inputType,
      classification: capturedItem.classification as CaptureClassification,
      confidence: capturedItem.confidence,
      headline: capturedItem.headline,
      rawContent: capturedItem.rawContent,
      extractedData: capturedItem.extractedData,
      uncertainFields: Array.isArray(capturedItem.uncertainFields) ? (capturedItem.uncertainFields as string[]) : [],
      status: capturedItem.status,
      targetType: capturedItem.targetType,
      targetId: capturedItem.targetId,
      sourceRef: capturedItem.sourceRef,
      altClassification: capturedItem.altClassification as CaptureClassification | null,
    },
    confirmationText,
    isLowConfidence,
    uncertainFields,
    quickReplies: quickReplies.length ? quickReplies : undefined,
    bubbleCard: isLowConfidence ? {
      title: headline,
      classification,
      fields: bubbleFields,
      switchOptions: altClassification ? [{ label: `Switch to ${altClassification}`, classification: altClassification }] : undefined,
    } : undefined,
  };
}

export async function switchClassification(
  capturedItemId: string,
  newClassification: CaptureClassification,
): Promise<{ ok: boolean; message: string }> {
  const item = await prisma.capturedItem.findUnique({
    where: { id: capturedItemId },
  });
  if (!item) return { ok: false, message: "Captured item not found." };

  // Delete previous target if created
  if (item.targetType === "LifeEvent" && item.targetId) {
    await prisma.lifeEvent.delete({ where: { id: item.targetId } }).catch(() => {});
  } else if (item.targetType === "LifeEntry" && item.targetId) {
    await prisma.lifeEntry.delete({ where: { id: item.targetId } }).catch(() => {});
  } else if (item.targetType === "LifeTask" && item.targetId) {
    await prisma.lifeTask.delete({ where: { id: item.targetId } }).catch(() => {});
  }

  let newTargetType: string | null = null;
  let newTargetId: string | null = null;

  if (newClassification === "note") {
    newTargetType = "MemoryRecord";
    const saved = await saveMemory({
      projectId: item.projectId,
      fact: item.headline,
      kind: "fact",
      source: "capture",
    });
    newTargetId = saved.memory.id;
  } else if (newClassification === "event") {
    newTargetType = "LifeEvent";
    const event = await prisma.lifeEvent.create({
      data: {
        projectId: item.projectId,
        title: item.headline,
        startsAt: new Date(),
        source: "capture",
      },
    });
    newTargetId = event.id;
  }

  await prisma.capturedItem.update({
    where: { id: capturedItemId },
    data: {
      classification: newClassification,
      targetType: newTargetType,
      targetId: newTargetId,
      status: "switched",
    },
  });

  return {
    ok: true,
    message: `Updated: switched to ${newClassification}.`,
  };
}
