import { prisma } from "@/lib/db";
import { handle, parseJson, requireAdmin, HttpError } from "@/lib/api";
import { agentsVisibleTo } from "@/lib/projects";
import { decideSuggestion } from "@/lib/work/suggestions";
import { suggestionPatchSchema } from "@/lib/work/validation";
import { suggestionInclude, toSuggestionDto } from "../serialize";

export const runtime = "nodejs";

type Params = { params: Promise<{ suggestionId: string }> };

/**
 * The owner's decision: accept (the proposal becomes an objective on the
 * agent's scope of work), dismiss, snooze, or put it back to open.
 */
export async function PATCH(request: Request, { params }: Params) {
  return handle(async () => {
    const { userId } = await requireAdmin();
    const { suggestionId } = await params;
    const input = await parseJson(request, suggestionPatchSchema);

    const visible = await prisma.suggestion.findFirst({
      where: { id: suggestionId, agent: agentsVisibleTo(userId) },
      select: { id: true },
    });
    if (!visible) throw new HttpError(404, "That suggestion no longer exists.");

    const decision = await decideSuggestion({
      suggestionId: visible.id,
      status: input.status,
      snoozeDays: input.snoozeDays,
      userId,
    });
    if (!decision) throw new HttpError(404, "That suggestion no longer exists.");

    const row = await prisma.suggestion.findUniqueOrThrow({
      where: { id: visible.id },
      include: suggestionInclude,
    });
    return { ...toSuggestionDto(row), addedObjective: decision.addedObjective };
  });
}
