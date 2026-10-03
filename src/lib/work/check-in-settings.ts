import "server-only";
import { prisma } from "@/lib/platform/db";
import { isDigestCadence, type DigestCadence } from "./types";

export interface CheckInSettings {
  id: string;
  name: string;
  cadence: DigestCadence;
  timezone: string;
  email: boolean;
  recipients: string;
}

/** New project settings take precedence; existing per-agent choices seed them on first use. */
export async function checkInSettings(projectId: string): Promise<CheckInSettings> {
  const [project, scopes] = await Promise.all([
    prisma.project.findUniqueOrThrow({
      where: { id: projectId },
      select: {
        id: true, name: true, checkInCadence: true, checkInTimezone: true,
        checkInEmail: true, checkInRecipients: true,
      },
    }),
    prisma.scopeOfWork.findMany({
      where: { agent: { projectId } },
      orderBy: { createdAt: "asc" },
      select: { digestCadence: true, digestEmail: true, digestRecipients: true, timezone: true },
    }),
  ]);
  const cadence: DigestCadence = isDigestCadence(project.checkInCadence ?? "")
    ? project.checkInCadence as DigestCadence
    : scopes.some((scope) => scope.digestCadence === "daily")
      ? "daily"
      : scopes.some((scope) => scope.digestCadence === "weekly")
        ? "weekly"
        : "off";
  const mailScopes = scopes.filter((scope) => scope.digestEmail);
  const explicit = [...new Set(mailScopes.flatMap((scope) =>
    (scope.digestRecipients ?? "").split(",").map((address) => address.trim()).filter(Boolean),
  ))];
  const allExplicit = mailScopes.length > 0 && mailScopes.every((scope) => Boolean(scope.digestRecipients?.trim()));
  return {
    id: project.id,
    name: project.name,
    cadence,
    timezone: project.checkInTimezone ?? scopes[0]?.timezone ?? "UTC",
    email: project.checkInEmail ?? mailScopes.length > 0,
    recipients: project.checkInRecipients ?? (allExplicit ? explicit.join(", ") : ""),
  };
}
