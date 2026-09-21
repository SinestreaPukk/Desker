import { NextResponse } from "next/server";
import { handle, requireAdmin, HttpError } from "@/lib/api";
import { acceptInvitation, findOpenInvitation, InviteMismatch } from "@/lib/invites";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ token: string }> };

/** What the accept page shows before anyone signs in. Public by design; the token is the secret. */
export async function GET(_request: Request, { params }: Params) {
  const { token } = await params;
  const invitation = await findOpenInvitation(token);
  if (!invitation) return NextResponse.json({ error: "This invitation is no longer valid." }, { status: 404 });
  return NextResponse.json({
    organization: invitation.organization.name,
    email: invitation.email,
    role: invitation.role,
    expiresAt: invitation.expiresAt.toISOString(),
  });
}

/** Accept as the signed-in user. */
export async function POST(_request: Request, { params }: Params) {
  return handle(async () => {
    const { userId, email } = await requireAdmin();
    const { token } = await params;
    let invitation;
    try {
      invitation = await acceptInvitation(token, { id: userId, email });
    } catch (error) {
      if (error instanceof InviteMismatch) throw new HttpError(403, error.message);
      throw error;
    }
    if (!invitation) throw new HttpError(404, "This invitation is no longer valid.");
    const project = await prisma.project.findFirst({
      where: { organizationId: invitation.organizationId },
      orderBy: { createdAt: "asc" },
      select: { slug: true },
    });
    return { organizationId: invitation.organizationId, projectSlug: project?.slug ?? null };
  });
}
