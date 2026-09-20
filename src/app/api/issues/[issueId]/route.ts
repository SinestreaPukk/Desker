import { prisma } from "@/lib/db";
import { handle, parseJson, requireAdmin, HttpError } from "@/lib/api";
import { publishAdminEvent } from "@/lib/events";
import { issuePatchSchema } from "@/lib/validation";

export const runtime = "nodejs";

type Params = { params: Promise<{ issueId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  return handle(async () => {
    await requireAdmin();
    const { issueId } = await params;
    const input = await parseJson(request, issuePatchSchema);

    const issue = await prisma.issue
      .update({
        where: { id: issueId },
        data: { status: input.status },
        select: { id: true, status: true, conversationId: true },
      })
      .catch(() => {
        throw new HttpError(404, "That item no longer exists.");
      });

    publishAdminEvent({ type: "issue.updated", issueId: issue.id });

    return issue;
  });
}
