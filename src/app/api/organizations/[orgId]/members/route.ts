import { prisma } from "@/lib/db";
import { handle, requireAdmin, HttpError } from "@/lib/api";
import { membershipOf } from "@/lib/organizations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export interface MemberDto {
  userId: string;
  email: string;
  name: string | null;
  role: string;
  joinedAt: string;
}

export async function GET(_request: Request, { params }: { params: Promise<{ orgId: string }> }) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const { orgId } = await params;
    if (!(await membershipOf(userId, orgId))) throw new HttpError(404, "That organisation no longer exists.");
    const rows = await prisma.membership.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "asc" },
      include: { user: { select: { email: true, name: true } } },
    });
    return rows.map(
      (row): MemberDto => ({
        userId: row.userId,
        email: row.user.email,
        name: row.user.name,
        role: row.role,
        joinedAt: row.createdAt.toISOString(),
      }),
    );
  });
}
