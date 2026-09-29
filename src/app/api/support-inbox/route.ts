import { randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { handle, parseJson, requireAdmin, HttpError } from "@/lib/api";
import { audit } from "@/lib/audit";
import { requireRole } from "@/lib/organizations";
import { findProject } from "@/lib/projects";
import { seal, vaultConfigured } from "@/lib/vault";
import { intakeUrl, readiness } from "@/lib/work/support-inbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function context(request: Request, userId: string) {
  const handle_ = new URL(request.url).searchParams.get("project");
  const project = handle_ ? await findProject(handle_, userId) : null;
  if (!project) throw new HttpError(404, "That project no longer exists.");
  if (project.organization.kind === "personal") {
    throw new HttpError(403, "A support inbox is for a business. Personal spaces have no customers writing in.");
  }
  return project;
}

const newToken = () => randomBytes(24).toString("base64url");

/** The project's support inbox: its address, who answers, and what it still needs. */
export async function GET(request: Request) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const project = await context(request, userId);
    const inbox = await prisma.supportInbox.findUnique({ where: { projectId: project.id } });
    // The checklist follows the agent being chosen in the form, before it is saved.
    const preview = new URL(request.url).searchParams.get("agent");
    const candidate = preview
      ? await prisma.agent.findFirst({ where: { id: preview, projectId: project.id }, select: { id: true } })
      : inbox
        ? null
        : (
            await prisma.agent.findMany({ where: { projectId: project.id, status: "published" }, select: { id: true, jobTitle: true } })
          ).find((agent) => /support|customer|service/i.test(agent.jobTitle)) ?? null;
    return {
      inbox: inbox
        ? {
            url: intakeUrl(inbox.token),
            agentId: inbox.agentId,
            callbackUrl: inbox.callbackUrl,
            signed: Boolean(inbox.callbackSecret),
            enabled: inbox.enabled,
          }
        : null,
      /** The agent the checklist is about: the one to preselect in the form. */
      checking: candidate?.id ?? inbox?.agentId ?? null,
      readiness: await readiness({
        organizationId: project.organizationId,
        projectSlug: project.slug,
        agentId: candidate?.id ?? inbox?.agentId ?? null,
      }),
    };
  });
}

const saveSchema = z.object({
  agentId: z.string().min(1).max(64),
  callbackUrl: z
    .string()
    .trim()
    .max(2000)
    .refine((url) => url === "" || /^https?:\/\//.test(url), "The report-back address has to start with https://.")
    .optional(),
  callbackSecret: z.string().trim().max(200).optional(),
  enabled: z.boolean().optional(),
  /** Replace the address; the old one stops working at once. */
  rotate: z.boolean().optional(),
});

/** Set up or change the inbox. */
export async function PUT(request: Request) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const project = await context(request, userId);
    await requireRole(userId, project.organizationId, "admin");
    const input = await parseJson(request, saveSchema);
    const agent = await prisma.agent.findFirst({ where: { id: input.agentId, projectId: project.id }, select: { id: true } });
    if (!agent) throw new HttpError(422, "Choose an agent from this project.");
    if (input.callbackSecret && !vaultConfigured()) {
      throw new HttpError(503, "A signing secret cannot be stored until the server has a VAULT_KEY.");
    }
    const existing = await prisma.supportInbox.findUnique({ where: { projectId: project.id } });
    const data = {
      agentId: input.agentId,
      ...(input.callbackUrl !== undefined ? { callbackUrl: input.callbackUrl || null } : {}),
      ...(input.callbackSecret !== undefined ? { callbackSecret: input.callbackSecret ? seal(input.callbackSecret) : null } : {}),
      ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
      ...(input.rotate ? { token: newToken() } : {}),
    };
    const inbox = existing
      ? await prisma.supportInbox.update({ where: { id: existing.id }, data })
      : await prisma.supportInbox.create({
          data: { ...data, token: newToken(), organizationId: project.organizationId, projectId: project.id },
        });
    await audit({
      organizationId: project.organizationId,
      actorType: "user",
      actorId: userId,
      action: existing ? "support_inbox.updated" : "support_inbox.created",
      targetType: "project",
      targetId: project.id,
      metadata: { agentId: inbox.agentId, rotated: Boolean(input.rotate), enabled: inbox.enabled, reportsBack: Boolean(inbox.callbackUrl) },
    });
    return { url: intakeUrl(inbox.token), enabled: inbox.enabled };
  });
}

/** Remove the inbox; its address stops working at once. */
export async function DELETE(request: Request) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const project = await context(request, userId);
    await requireRole(userId, project.organizationId, "admin");
    await prisma.supportInbox.deleteMany({ where: { projectId: project.id } });
    await audit({
      organizationId: project.organizationId,
      actorType: "user",
      actorId: userId,
      action: "support_inbox.removed",
      targetType: "project",
      targetId: project.id,
    });
    return { removed: true };
  });
}
