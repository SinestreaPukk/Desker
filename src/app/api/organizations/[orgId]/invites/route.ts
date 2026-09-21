import { z } from "zod";
import { prisma } from "@/lib/db";
import { handle, parseJson, requireAdmin, HttpError } from "@/lib/api";
import { requireRole } from "@/lib/organizations";
import { createInvitation, inviteUrl, sendInviteEmail } from "@/lib/invites";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ orgId: string }> };

export interface InviteDto {
  id: string;
  email: string;
  role: string;
  url: string;
  createdAt: string;
  expiresAt: string;
  emailed: boolean;
}

const createSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  role: z.enum(["owner", "admin", "member"]).default("member"),
});

export async function GET(request: Request, { params }: Params) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const { orgId } = await params;
    await requireRole(userId, orgId, "admin");
    const rows = await prisma.invitation.findMany({
      where: { organizationId: orgId, acceptedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });
    const origin = new URL(request.url).origin;
    return rows.map(
      (row): InviteDto => ({
        id: row.id,
        email: row.email,
        role: row.role,
        url: inviteUrl(row.token, origin),
        createdAt: row.createdAt.toISOString(),
        expiresAt: row.expiresAt.toISOString(),
        emailed: false,
      }),
    );
  });
}

export async function POST(request: Request, { params }: Params) {
  return handle(async () => {
    const { userId, email: inviterEmail } = await requireAdmin();
    const { orgId } = await params;
    const actorRole = await requireRole(userId, orgId, "admin");
    const input = await parseJson(request, createSchema);
    // Only an owner can mint another owner.
    if (input.role === "owner" && actorRole !== "owner") {
      throw new HttpError(403, "Only an owner can invite another owner.");
    }
    const existing = await prisma.membership.findFirst({
      where: { organizationId: orgId, user: { email: input.email } },
    });
    if (existing) throw new HttpError(409, "That person is already a member.");

    const [org, inviter] = await Promise.all([
      prisma.organization.findUniqueOrThrow({ where: { id: orgId }, select: { name: true } }),
      prisma.user.findUnique({ where: { id: userId }, select: { name: true } }),
    ]);
    const invitation = await createInvitation({
      organizationId: orgId,
      email: input.email,
      role: input.role,
      invitedById: userId,
    });
    const url = inviteUrl(invitation.token, new URL(request.url).origin);
    const emailed = await sendInviteEmail({
      to: invitation.email,
      organizationName: org.name,
      inviterName: inviter?.name ?? inviterEmail,
      url,
    });
    const dto: InviteDto = {
      id: invitation.id,
      email: invitation.email,
      role: invitation.role,
      url,
      createdAt: invitation.createdAt.toISOString(),
      expiresAt: invitation.expiresAt.toISOString(),
      emailed,
    };
    return dto;
  });
}
