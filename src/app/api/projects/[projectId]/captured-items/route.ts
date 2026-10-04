import { z } from "zod";
import { prisma } from "@/lib/platform/db";
import { handle, parseJson, requireAdmin, HttpError } from "@/lib/platform/api";
import { findProject } from "@/lib/tenancy/projects";
import { processIntake } from "@/lib/capture/pipeline";
import type { CaptureClassification, CapturedItemDto } from "@/lib/capture/types";

export const runtime = "nodejs";

type Params = { params: Promise<{ projectId: string }> };

const captureInputSchema = z.object({
  text: z.string().trim().min(1).max(5000),
  sourceChannel: z.enum(["line", "app"]).optional(),
  sourceRef: z.string().optional(),
});

export async function GET(request: Request, { params }: Params) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const { projectId: handleOrId } = await params;
    const project = await findProject(handleOrId, userId);
    if (!project) throw new HttpError(404, "Project not found.");

    const url = new URL(request.url);
    const status = url.searchParams.get("status") || undefined;
    const classification = url.searchParams.get("classification") || undefined;

    const where: {
      projectId: string;
      status?: string;
      classification?: string;
    } = { projectId: project.id };

    if (status) where.status = status;
    if (classification) where.classification = classification;

    const items = await prisma.capturedItem.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const dtos: CapturedItemDto[] = items.map((item) => ({
      id: item.id,
      projectId: item.projectId,
      inputType: item.inputType as CapturedItemDto["inputType"],
      classification: item.classification as CaptureClassification,
      confidence: item.confidence,
      headline: item.headline,
      rawContent: item.rawContent,
      extractedData: item.extractedData as never,
      uncertainFields: Array.isArray(item.uncertainFields) ? (item.uncertainFields as string[]) : [],
      status: item.status as CapturedItemDto["status"],
      targetType: item.targetType,
      targetId: item.targetId,
      sourceRef: item.sourceRef,
      sourceChannel: (item.sourceChannel as "line" | "app") || "app",
      altClassification: item.altClassification as CaptureClassification | null,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    }));

    return { items: dtos };
  });
}

export async function POST(request: Request, { params }: Params) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const { projectId: handleOrId } = await params;
    const project = await findProject(handleOrId, userId);
    if (!project) throw new HttpError(404, "Project not found.");

    const input = await parseJson(request, captureInputSchema);
    const result = await processIntake({
      projectId: project.id,
      organizationId: project.organizationId,
      inputType: "text",
      text: input.text,
      sourceRef: input.sourceRef,
      sourceChannel: input.sourceChannel ?? "app",
    });

    return result;
  });
}
