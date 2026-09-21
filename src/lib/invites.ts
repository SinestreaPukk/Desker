/**
 * Invitations: how a stranger becomes a teammate.
 *
 * The token in the link is the credential, so it is random, single-use and
 * expires. Accepting requires being signed in as the invited address - a
 * forwarded link cannot be used by someone else - and creates the Membership
 * in one transaction with closing the invitation.
 */
import "server-only";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { audit } from "@/lib/audit";
import { env } from "@/lib/env";
import type { OrganizationRole } from "@/lib/organizations";

export const INVITE_TTL_DAYS = 7;

export function inviteUrl(token: string, origin?: string): string {
  return `${env.appUrl || origin || ""}/invite/${token}`;
}

export async function createInvitation(input: {
  organizationId: string;
  email: string;
  role: OrganizationRole;
  invitedById: string;
}) {
  const email = input.email.trim().toLowerCase();
  // Re-inviting the same address replaces the pending invitation rather than
  // leaving two live tokens around.
  await prisma.invitation.deleteMany({
    where: { organizationId: input.organizationId, email, acceptedAt: null },
  });
  const invitation = await prisma.invitation.create({
    data: {
      organizationId: input.organizationId,
      email,
      role: input.role,
      token: randomBytes(24).toString("base64url"),
      invitedById: input.invitedById,
      expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000),
    },
  });
  await audit({
    organizationId: input.organizationId,
    actorType: "user",
    actorId: input.invitedById,
    action: "invitation.created",
    targetType: "invitation",
    targetId: invitation.id,
    metadata: { email, role: input.role },
  });
  return invitation;
}

/** A pending, unexpired invitation by token, with the organisation's name. */
export async function findOpenInvitation(token: string) {
  const invitation = await prisma.invitation.findUnique({
    where: { token },
    include: { organization: { select: { id: true, name: true } } },
  });
  if (!invitation || invitation.acceptedAt || invitation.expiresAt < new Date()) return null;
  return invitation;
}

export class InviteMismatch extends Error {
  constructor(readonly invitedEmail: string) {
    super(`This invitation was sent to ${invitedEmail}. Sign in with that address to accept it.`);
    this.name = "InviteMismatch";
  }
}

/** Accepts for a signed-in user. Idempotent for someone already a member. */
export async function acceptInvitation(token: string, user: { id: string; email: string }) {
  const invitation = await findOpenInvitation(token);
  if (!invitation) return null;
  if (invitation.email !== user.email.toLowerCase()) throw new InviteMismatch(invitation.email);

  await prisma.$transaction([
    prisma.membership.upsert({
      where: { userId_organizationId: { userId: user.id, organizationId: invitation.organizationId } },
      create: { userId: user.id, organizationId: invitation.organizationId, role: invitation.role },
      update: {},
    }),
    prisma.invitation.update({
      where: { id: invitation.id },
      data: { acceptedAt: new Date(), acceptedById: user.id },
    }),
  ]);
  await audit({
    organizationId: invitation.organizationId,
    actorType: "user",
    actorId: user.id,
    action: "invitation.accepted",
    targetType: "invitation",
    targetId: invitation.id,
    metadata: { role: invitation.role },
  });
  return invitation;
}

/**
 * Best effort: emails the link when the deployment has an email provider.
 * The link is always shown to the inviter too, so a missing provider only
 * means they paste it themselves.
 */
export async function sendInviteEmail(input: {
  to: string;
  organizationName: string;
  inviterName: string;
  url: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (!apiKey || !from) return false;
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: `${input.inviterName} invited you to ${input.organizationName} on Desker`,
        text:
          `${input.inviterName} has invited you to join ${input.organizationName} on Desker.\n\n` +
          `Accept the invitation here (it expires in ${INVITE_TTL_DAYS} days):\n${input.url}\n\n` +
          "If you were not expecting this, you can ignore it.",
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
