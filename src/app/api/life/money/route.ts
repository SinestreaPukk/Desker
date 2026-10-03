import { prisma } from "@/lib/platform/db";
import { handle, requireAdmin, HttpError } from "@/lib/platform/api";
import { env } from "@/lib/platform/env";
import { findProject } from "@/lib/tenancy/projects";
import { limitOrganization } from "@/lib/platform/rate-limit";
import { readLife } from "@/lib/life/read";
import { importFiles } from "@/lib/life/slips";
import { moneyInsights } from "@/lib/life/money-insights";
import * as store from "@/lib/life/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILES = 20;

async function projectFrom(handle_: string | null, userId: string) {
  const project = handle_ ? await findProject(handle_, userId) : null;
  if (!project) throw new HttpError(404, "That space no longer exists.");
  return project;
}

/** The Money page's numbers, plus the latest entries behind them. */
export async function GET(request: Request) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const project = await projectFrom(new URL(request.url).searchParams.get("project"), userId);
    const [life, entries] = await Promise.all([
      readLife(project.id),
      prisma.lifeEntry.findMany({ where: { projectId: project.id, occurredAt: { gte: new Date(Date.now() - 200 * 86_400_000) } }, orderBy: { occurredAt: "desc" }, take: 2000 }),
    ]);
    return {
      ...moneyInsights(entries, new Date(), life.money.monthBudgetMinor),
      budgetMinor: life.money.monthBudgetMinor,
      recent: entries.slice(0, 25).map((e) => ({ id: e.id, kind: e.kind, payee: e.payee, amountMinor: e.amountMinor, category: e.category, occurredAt: e.occurredAt.toISOString(), status: e.status, source: e.source })),
    };
  });
}

/** Slips, bills, invoices (images or PDF) and CSV statements the person chose. */
export async function POST(request: Request) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const form = await request.formData().catch(() => {
      throw new HttpError(400, "Expected a multipart form upload.");
    });
    const project = await projectFrom(String(form.get("project") ?? ""), userId);
    await limitOrganization(project.organizationId, "model");
    const files = form.getAll("files").filter((f): f is File => f instanceof File).slice(0, MAX_FILES);
    if (files.length === 0) throw new HttpError(400, "Choose at least one file.");
    const ok: { name: string; type: string; data: Buffer }[] = [];
    for (const f of files) {
      if (f.size === 0 || f.size > env.maxUploadBytes) throw new HttpError(413, `"${f.name}" is empty or too large.`);
      ok.push({ name: f.name, type: f.type, data: Buffer.from(await f.arrayBuffer()) });
    }
    return { results: await importFiles({ organizationId: project.organizationId, projectId: project.id }, ok) };
  });
}

/** Marks a bill paid (the person says so; nothing is paid from here). */
export async function PATCH(request: Request) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const body = (await request.json().catch(() => ({}))) as { project?: string; id?: string };
    const project = await projectFrom(body.project ?? null, userId);
    if (!body.id) throw new HttpError(400, "Which bill?");
    await store.markBill({ organizationId: project.organizationId, projectId: project.id, source: "user" }, body.id, "paid");
    return { ok: true };
  });
}
