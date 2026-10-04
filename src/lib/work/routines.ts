/**
 * An agent's routines: any number of "do this, then" jobs, each with its own
 * time. The scheduler claims them next to the agent's older single schedule
 * (scope.ts); this file reads and saves the list.
 */
import "server-only";
import { z } from "zod";
import { prisma } from "@/lib/platform/db";
import { localTimeZone } from "@/lib/shared/local-time";
import { HttpError } from "@/lib/platform/http-error";
import { toStringArray } from "@/lib/agents/agent-fields";
import { validCron, validTimezone } from "./scope";

export interface RoutineDto {
  id: string;
  cron: string;
  timezone: string;
  instruction: string;
  enabled: boolean;
}

export const MAX_ROUTINES = 10;

export const routinesInputSchema = z.object({
  routines: z
    .array(
      z.object({
        id: z.string().min(1).optional(),
        cron: z.string().trim().min(1).max(100),
        timezone: z.string().trim().min(1).max(64).default(localTimeZone()),
        instruction: z.string().trim().min(1, "Say what it should do.").max(500, "Keep it under 500 characters."),
        enabled: z.boolean().default(true),
      }),
    )
    .max(MAX_ROUTINES, `Up to ${MAX_ROUTINES} routines.`),
});

const select = { id: true, cron: true, timezone: true, instruction: true, enabled: true } as const;

/**
 * The agent's routines. An agent from before routines existed may still carry a
 * single cron schedule on its scope: it is moved here once, so there is one list.
 */
export async function listRoutines(agentId: string): Promise<RoutineDto[]> {
  const existing = await prisma.routine.findMany({ where: { agentId }, orderBy: { createdAt: "asc" }, select });
  if (existing.length > 0) return existing;
  const scope = await prisma.scopeOfWork.findUnique({ where: { agentId }, select: { triggerType: true, cron: true, timezone: true, objectives: true, enabled: true } });
  if (scope?.triggerType !== "cron" || !scope.cron) return [];
  const [created] = await prisma.$transaction([
    prisma.routine.create({
      data: { agentId, cron: scope.cron, timezone: scope.timezone, instruction: toStringArray(scope.objectives).join("\n") || "Carry out your standing objectives.", enabled: scope.enabled },
      select,
    }),
    prisma.scopeOfWork.update({ where: { agentId }, data: { triggerType: "manual", cron: null } }),
  ]);
  return [created];
}

/** Replaces the list: keeps (and updates) the ones with an id, adds the rest, drops what is missing. */
export async function saveRoutines(agentId: string, input: z.infer<typeof routinesInputSchema>["routines"]): Promise<RoutineDto[]> {
  for (const routine of input) {
    if (!validTimezone(routine.timezone) || !validCron(routine.cron, routine.timezone)) {
      throw new HttpError(422, "One of the times is not valid.");
    }
  }
  const keep = input.filter((routine) => routine.id).map((routine) => routine.id!);
  await prisma.$transaction([
    prisma.routine.deleteMany({ where: { agentId, id: { notIn: keep } } }),
    ...input.map((routine) =>
      routine.id
        ? prisma.routine.updateMany({
            where: { id: routine.id, agentId },
            data: { cron: routine.cron, timezone: routine.timezone, instruction: routine.instruction, enabled: routine.enabled },
          })
        : prisma.routine.create({ data: { agentId, cron: routine.cron, timezone: routine.timezone, instruction: routine.instruction, enabled: routine.enabled } }),
    ),
  ]);
  return prisma.routine.findMany({ where: { agentId }, orderBy: { createdAt: "asc" }, select });
}
