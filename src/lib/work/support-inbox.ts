/**
 * The support desk's closed loop (see the SupportInbox model): what it needs
 * to work, in the owner's words, and the report back to the helpdesk once a
 * ticket is answered or handed to a person.
 */
import "server-only";
import { prisma } from "@/lib/db";
import { env } from "@/lib/env";
import { open } from "@/lib/vault";
import { deliverWebhook, resolveEmail } from "./integrations";
import { scopeTools } from "./tools";

export interface ReadinessCheck {
  ok: boolean;
  label: string;
  /** What to do about it, and where. */
  fix?: { label: string; href: string };
}

export function intakeUrl(token: string): string {
  return `${env.appUrl ?? ""}/api/intake/${token}`;
}

/**
 * Everything the loop depends on, checked - so the setup card says plainly
 * what will and will not happen, instead of the first ticket failing quietly.
 */
export async function readiness(input: {
  organizationId: string;
  projectSlug: string;
  agentId: string | null;
}): Promise<ReadinessCheck[]> {
  const base = `/p/${input.projectSlug}`;
  const [agent, email, org] = await Promise.all([
    input.agentId
      ? prisma.agent.findUnique({
          where: { id: input.agentId },
          select: {
            id: true,
            name: true,
            status: true,
            scopeOfWork: { select: { tools: true } },
            _count: { select: { documents: { where: { status: "ready" } } } },
          },
        })
      : null,
    resolveEmail(input.organizationId),
    prisma.organization.findUniqueOrThrow({ where: { id: input.organizationId }, select: { mailingAddress: true } }),
  ]);
  if (!agent) return [{ ok: false, label: "Choose the Support agent that answers" }];
  const editor = `${base}/agents/${agent.id}`;
  const tools = scopeTools(agent.scopeOfWork?.tools);
  const can = (tool: string) => !tools || tools.includes(tool as never);
  return [
    {
      ok: agent.status === "published",
      label: agent.status === "published" ? `${agent.name} is switched on` : `${agent.name} isn't published yet`,
      fix: agent.status === "published" ? undefined : { label: "Publish it", href: editor },
    },
    {
      ok: agent._count.documents > 0,
      label:
        agent._count.documents > 0
          ? `${agent.name} can read ${agent._count.documents} document${agent._count.documents === 1 ? "" : "s"}`
          : `${agent.name} has no documents - without your policies it escalates every ticket`,
      fix: agent._count.documents > 0 ? undefined : { label: "Upload your policies", href: editor },
    },
    {
      ok: can("search_documents") && can("send_email") && can("escalate_to_human"),
      label:
        can("search_documents") && can("send_email") && can("escalate_to_human")
          ? "It may search documents, draft email and escalate"
          : "Its work tools must include searching documents, sending email and escalating",
      fix: can("search_documents") && can("send_email") && can("escalate_to_human") ? undefined : { label: "Change its tools", href: editor },
    },
    {
      ok: Boolean(email),
      label: email ? "Email can be sent" : "No email provider - replies stay as drafts",
      fix: email ? undefined : { label: "Connect email", href: `${base}/integrations#email` },
    },
    {
      ok: Boolean(org.mailingAddress?.trim()),
      label: org.mailingAddress?.trim() ? "Your postal address is set for email" : "No business postal address - the law requires one before email goes out",
      fix: org.mailingAddress?.trim() ? undefined : { label: "Add it", href: `${base}/organization` },
    },
  ];
}

/** What the payload of a run started by the support inbox carries. */
export interface IntakeTag {
  inboxId: string;
  ticketId: string | null;
  email: string;
}

export function intakeTag(payload: unknown): IntakeTag | null {
  const tag = (payload as { intake?: IntakeTag } | null)?.intake;
  return tag && typeof tag.inboxId === "string" ? tag : null;
}

/**
 * Tells the helpdesk what happened to a ticket: answered (the reply was
 * approved and sent) or needs_human (the agent could not settle it from the
 * documents). Signed like the publishing webhook. Never throws: a helpdesk
 * that is down does not undo a reply that went out.
 */
export async function reportToHelpdesk(actionItemId: string, status: "answered" | "needs_human"): Promise<void> {
  try {
    const item = await prisma.actionItem.findUnique({
      where: { id: actionItemId },
      select: { payload: true, pendingAction: true, escalationReason: true, drafts: { select: { title: true, body: true } } },
    });
    const tag = item ? intakeTag(item.payload) : null;
    if (!item || !tag) return;
    const inbox = await prisma.supportInbox.findUnique({ where: { id: tag.inboxId } });
    if (!inbox?.callbackUrl) return;
    const secret = inbox.callbackSecret ? open<string>(inbox.callbackSecret) : undefined;
    const draft = item.drafts[0];
    await deliverWebhook(
      { url: inbox.callbackUrl, secret },
      {
        event: status === "answered" ? "ticket.answered" : "ticket.needs_human",
        ticketId: tag.ticketId,
        customer: tag.email,
        ...(status === "answered" && draft ? { subject: draft.title, reply: draft.body } : {}),
        ...(status === "needs_human" ? { reason: item.escalationReason } : {}),
        at: new Date().toISOString(),
      },
    );
  } catch (error) {
    console.error("[support-inbox] report back failed", error);
  }
}
