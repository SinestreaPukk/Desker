import type { TeamMessageDto } from "@/lib/team-dto";

export const messageSelect = {
  id: true,
  content: true,
  authorName: true,
  actionItemId: true,
  createdAt: true,
  agent: { select: { id: true, name: true, jobTitle: true, avatarUrl: true } },
} as const;

export function toMessageDto(row: {
  id: string;
  content: string;
  authorName: string | null;
  actionItemId: string | null;
  createdAt: Date;
  agent: TeamMessageDto["agent"];
}): TeamMessageDto {
  return { ...row, createdAt: row.createdAt.toISOString() };
}
