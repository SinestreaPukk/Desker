/**
 * Twilio calls this for the person's Desker number: an incoming call (we
 * screen it) or an incoming text (we pass it on). Authenticated by Twilio's
 * signature over the stored Auth Token, not by a session.
 */
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { messageOrganization } from "@/lib/messaging/send";
import { phoneAccessById, screenTwiml, thanksTwiml, validSignature } from "@/lib/integrations/phone";
import * as store from "@/lib/life/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const xml = (body: string, status = 200) =>
  new Response(`<?xml version="1.0" encoding="UTF-8"?>${body}`, { status, headers: { "content-type": "text/xml; charset=utf-8" } });

export async function POST(request: Request, { params }: { params: Promise<{ integrationId: string }> }) {
  const { integrationId } = await params;
  const access = await phoneAccessById(integrationId);
  if (!access) return xml("<Response/>", 404);

  const form = Object.fromEntries([...(await request.formData()).entries()].map(([k, v]) => [k, String(v)]));
  // Twilio signs the exact public URL it called.
  const url = new URL(request.url);
  const publicUrl = env.appUrl ? `${env.appUrl}${url.pathname}${url.search}` : request.url;
  if (!validSignature(access.authToken, publicUrl, form, request.headers.get("x-twilio-signature"))) return xml("<Response/>", 403);

  const project = await prisma.project.findFirst({ where: { organizationId: access.organizationId }, orderBy: { createdAt: "asc" }, select: { id: true } });
  const owner = await prisma.membership.findFirst({ where: { organizationId: access.organizationId }, select: { user: { select: { firstName: true } } } });
  const actor = project ? { organizationId: access.organizationId, projectId: project.id, source: "phone" } : null;
  const from = form.From ?? "unknown";

  // An incoming text.
  if (form.MessageSid) {
    const body = (form.Body ?? "").slice(0, 500);
    await messageOrganization(access.organizationId, "phone", { title: `Text from ${from}`, body });
    if (actor) await store.addNote(actor, `Text from ${from}: ${body}`);
    return xml("<Response/>");
  }

  // An incoming call: ask who and why, then pass the answer on.
  if (url.searchParams.get("step") === "after") {
    const said = (form.SpeechResult ?? "").trim().slice(0, 500);
    await messageOrganization(access.organizationId, "phone", {
      title: `Call from ${from}`,
      body: said ? `They said: "${said}"` : "They hung up without leaving a message.",
    });
    if (actor && said) await store.addNote(actor, `Screened a call from ${from}: ${said}`);
    return xml(thanksTwiml(access.language));
  }
  const action = `${publicUrl.split("?")[0]}?step=after`;
  return xml(screenTwiml(owner?.user.firstName ?? "the owner", action, access.language));
}
