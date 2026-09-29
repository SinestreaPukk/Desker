import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { checkRateLimit } from "@/lib/rate-limit";
import { RunRefused } from "@/lib/work/scope";
import { parseTicket, ticketText } from "@/lib/work/support-ticket";
import { startWorkflow } from "@/lib/work/workflow-run";
import { HttpError } from "@/lib/http-error";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 64 * 1024;

/**
 * The support inbox's intake address. A helpdesk, a website form, or a
 * Zapier/Make zap posts one customer message here (JSON or a form); the
 * Support agent answers it from the project's documents and the reply waits
 * in Needs you. The token in the path is the whole credential, so a removed
 * or switched-off inbox answers 404 like an unknown one.
 */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const inbox = await prisma.supportInbox.findFirst({
    where: { token, enabled: true },
    select: { id: true, agentId: true, projectId: true, organizationId: true },
  });
  if (!inbox) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const limit = await checkRateLimit(`intake:${inbox.id}`, 60, 60 * 60_000);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "Too many messages this hour." },
      { status: 429, headers: { "retry-after": String(limit.retryAfterSeconds) } },
    );
  }

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) return NextResponse.json({ error: "Message too large (64 KB max)." }, { status: 413 });
  let body: unknown;
  const type = request.headers.get("content-type") ?? "";
  if (type.includes("application/x-www-form-urlencoded")) {
    body = Object.fromEntries(new URLSearchParams(raw));
  } else {
    try {
      body = raw.trim() ? JSON.parse(raw) : {};
    } catch {
      return NextResponse.json({ error: "Send JSON, or a form (application/x-www-form-urlencoded)." }, { status: 400 });
    }
  }
  const parsed = parseTicket(body);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 422 });
  const { ticket } = parsed;

  try {
    const run = await startWorkflow({
      workflowId: "question-to-answer",
      projectId: inbox.projectId,
      organizationId: inbox.organizationId,
      text: ticketText(ticket),
      agentIds: [inbox.agentId],
      userId: null,
      extra: { intake: { inboxId: inbox.id, ticketId: ticket.ticketId, email: ticket.email } },
      dedupeKey: ticket.ticketId ? `intake:${inbox.id}:${ticket.ticketId}` : undefined,
    });
    if (!run) return NextResponse.json({ accepted: true, duplicate: true }, { status: 200 });
    return NextResponse.json({ accepted: true, id: run.id }, { status: 202 });
  } catch (error) {
    if (error instanceof RunRefused) {
      return NextResponse.json(
        { error: error.message },
        { status: 429, headers: error.retryAfterSeconds ? { "retry-after": String(error.retryAfterSeconds) } : {} },
      );
    }
    // The Support agent was switched off: the sender should hold the message and retry later.
    if (error instanceof HttpError) return NextResponse.json({ error: error.message }, { status: 503 });
    throw error;
  }
}
