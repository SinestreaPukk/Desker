import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { startRun } from "@/lib/work/scope";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Bodies larger than this are rejected rather than handed to a model. */
const MAX_BODY_BYTES = 64 * 1024;

/**
 * The event trigger: any system that can POST JSON starts a run. The token in
 * the path is the whole credential, so a scope with the trigger switched off
 * answers 404 exactly like an unknown token.
 */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const scope = await prisma.scopeOfWork.findFirst({
    where: { webhookToken: token, triggerType: "webhook", enabled: true },
    select: { agentId: true },
  });
  if (!scope) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "Payload too large (64 KB max)." }, { status: 413 });
  }
  let body: unknown = {};
  if (raw.trim()) {
    try {
      body = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: "Body must be JSON." }, { status: 400 });
    }
  }

  const item = await startRun({
    agentId: scope.agentId,
    trigger: "webhook",
    payload: { body, receivedAt: new Date().toISOString() },
    actor: { type: "system" },
  });
  if (!item) return NextResponse.json({ error: "Could not start the run." }, { status: 500 });
  return NextResponse.json({ accepted: true, actionItemId: item.id }, { status: 202 });
}
