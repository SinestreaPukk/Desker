import "server-only";
import { prisma } from "@/lib/platform/db";
import { checkSensitiveInformation, areContradictory } from "./hygiene";
import type { MemoryKind, MemorySource, MemoryStatus } from "./types";

export interface SaveMemoryInput {
  projectId: string;
  fact: string;
  kind?: MemoryKind;
  source?: MemorySource;
  personName?: string;
  relationship?: string;
  inferred?: boolean;
  confidence?: number;
}

export interface SaveMemoryResult {
  memory: {
    id: string;
    projectId: string;
    fact: string;
    kind: string;
    source: string;
    status: string;
    confidence: number | null;
    personId: string | null;
    createdAt: Date;
    updatedAt: Date;
    lastUsedAt: Date | null;
  };
  message: string;
  needsConfirmation: boolean;
}

// Common person relationships for automatic linking
const PERSON_RELATIONS: Record<string, { name: string; relationship: string }> = {
  mom: { name: "Mom", relationship: "mother" },
  mother: { name: "Mom", relationship: "mother" },
  "my mom": { name: "Mom", relationship: "mother" },
  "my mother": { name: "Mom", relationship: "mother" },
  dad: { name: "Dad", relationship: "father" },
  father: { name: "Dad", relationship: "father" },
  "my dad": { name: "Dad", relationship: "father" },
  "my father": { name: "Dad", relationship: "father" },
  wife: { name: "Wife", relationship: "wife" },
  "my wife": { name: "Wife", relationship: "wife" },
  husband: { name: "Husband", relationship: "husband" },
  "my husband": { name: "Husband", relationship: "husband" },
  partner: { name: "Partner", relationship: "partner" },
  "my partner": { name: "Partner", relationship: "partner" },
  brother: { name: "Brother", relationship: "brother" },
  "my brother": { name: "Brother", relationship: "brother" },
  sister: { name: "Sister", relationship: "sister" },
  "my sister": { name: "Sister", relationship: "sister" },
};

export async function resolvePersonRecord(
  projectId: string,
  personName?: string,
  relationship?: string,
  factText?: string,
): Promise<string | null> {
  let targetName = personName?.trim();
  let targetRel = relationship?.trim();

  if (!targetName && factText) {
    const lower = factText.toLowerCase();
    for (const [key, val] of Object.entries(PERSON_RELATIONS)) {
      const regex = new RegExp(`\\b${key}\\b`, "i");
      if (regex.test(lower)) {
        targetName = val.name;
        targetRel = val.relationship;
        break;
      }
    }
  }

  if (!targetName) return null;

  const existing = await prisma.personRecord.findUnique({
    where: {
      projectId_name: {
        projectId,
        name: targetName,
      },
    },
  });

  if (existing) {
    if (targetRel && !existing.relationship) {
      await prisma.personRecord.update({
        where: { id: existing.id },
        data: { relationship: targetRel },
      });
    }
    return existing.id;
  }

  const created = await prisma.personRecord.create({
    data: {
      projectId,
      name: targetName,
      relationship: targetRel,
    },
    select: { id: true },
  });

  return created.id;
}

export async function saveMemory(input: SaveMemoryInput): Promise<SaveMemoryResult> {
  const { projectId, fact, kind = "fact", personName, relationship, confidence } = input;
  const cleanFact = fact.trim();
  if (!cleanFact) {
    throw new Error("Memory fact cannot be empty.");
  }

  // 1. Sensitive information guard
  const hygiene = checkSensitiveInformation(cleanFact);
  if (hygiene.forbidden) {
    throw new Error(hygiene.reason ?? "Cannot store sensitive security credentials.");
  }

  const isInferred = Boolean(input.inferred || input.source === "inferred");
  const source: MemorySource = input.source ?? (isInferred ? "inferred" : "user");
  const status: MemoryStatus = isInferred ? "pending_confirmation" : "confirmed";

  // 2. Link person record if relevant
  const personId = await resolvePersonRecord(projectId, personName, relationship, cleanFact);
  const resolvedKind: MemoryKind = personId ? "person" : kind;

  // 3. Duplicate and contradiction resolution
  const existingMemories = await prisma.memoryRecord.findMany({
    where: { projectId, status: "confirmed" },
  });

  // Check for exact duplicate
  const duplicate = existingMemories.find(
    (m) => m.fact.toLowerCase() === cleanFact.toLowerCase(),
  );
  if (duplicate) {
    const updated = await prisma.memoryRecord.update({
      where: { id: duplicate.id },
      data: { lastUsedAt: new Date() },
    });
    return {
      memory: updated,
      message: `Noted: ${cleanFact}`,
      needsConfirmation: false,
    };
  }

  // Check for contradiction (e.g. new address replacing old address)
  for (const existing of existingMemories) {
    if (areContradictory(existing.fact, cleanFact)) {
      // Replace existing contradiction rather than sitting beside it
      const updated = await prisma.memoryRecord.update({
        where: { id: existing.id },
        data: {
          fact: cleanFact,
          kind: resolvedKind,
          source,
          status,
          personId,
          confidence: confidence ?? null,
          lastUsedAt: new Date(),
        },
      });
      return {
        memory: updated,
        message: isInferred
          ? `I inferred an update: ${cleanFact}. Should I remember this?`
          : `Noted: ${cleanFact}`,
        needsConfirmation: isInferred,
      };
    }
  }

  // 4. Create new memory
  const memory = await prisma.memoryRecord.create({
    data: {
      projectId,
      fact: cleanFact,
      kind: resolvedKind,
      source,
      status,
      confidence: confidence ?? null,
      personId,
      lastUsedAt: new Date(),
    },
  });

  const message = isInferred
    ? `I inferred: ${cleanFact}. Should I remember this?`
    : `Noted: ${cleanFact}`;

  return {
    memory,
    message,
    needsConfirmation: isInferred,
  };
}

export async function forgetMemory(input: {
  projectId: string;
  id?: string;
  query?: string;
}): Promise<{ deleted: number; message: string; forgottenFact?: string }> {
  const { projectId, id, query } = input;

  if (id) {
    const memory = await prisma.memoryRecord.findFirst({
      where: { id, projectId },
    });
    if (!memory) {
      return { deleted: 0, message: "I couldn't find that memory to forget." };
    }
    await prisma.memoryRecord.delete({ where: { id: memory.id } });
    return {
      deleted: 1,
      message: `Forgotten: "${memory.fact}"`,
      forgottenFact: memory.fact,
    };
  }

  const cleanQuery = query?.trim().toLowerCase() ?? "";

  // If "forget that" or empty query, forget the most recently saved memory
  if (!cleanQuery || cleanQuery === "that" || cleanQuery === "forget that") {
    const latest = await prisma.memoryRecord.findFirst({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    });
    if (!latest) {
      return { deleted: 0, message: "There are no memories to forget." };
    }
    await prisma.memoryRecord.delete({ where: { id: latest.id } });
    return {
      deleted: 1,
      message: `Forgotten: "${latest.fact}"`,
      forgottenFact: latest.fact,
    };
  }

  // Search by query terms
  const terms = cleanQuery.replace(/^forget\s+/i, "").split(/\s+/).filter(Boolean);
  const candidates = await prisma.memoryRecord.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
  });

  const matched = candidates.find((m) => {
    const lower = m.fact.toLowerCase();
    return terms.every((term) => lower.includes(term));
  });

  if (!matched) {
    return {
      deleted: 0,
      message: `I couldn't find a memory matching "${query}".`,
    };
  }

  await prisma.memoryRecord.delete({ where: { id: matched.id } });
  return {
    deleted: 1,
    message: `Forgotten: "${matched.fact}"`,
    forgottenFact: matched.fact,
  };
}

export async function recallMemories(input: {
  projectId: string;
  query: string;
  limit?: number;
  personName?: string;
  kind?: string;
}): Promise<Array<{
  id: string;
  projectId: string;
  fact: string;
  kind: string;
  source: string;
  status: string;
  personName: string | null;
  createdAt: Date;
  lastUsedAt: Date | null;
}>> {
  const { projectId, query, limit = 5, personName, kind } = input;
  const whereClause: {
    projectId: string;
    status: string;
    kind?: string;
    person?: { name: { equals: string } };
  } = {
    projectId,
    status: "confirmed",
  };

  if (kind) whereClause.kind = kind;
  if (personName) {
    whereClause.person = { name: { equals: personName } };
  }

  const all = await prisma.memoryRecord.findMany({
    where: whereClause,
    include: { person: true },
    orderBy: { createdAt: "desc" },
  });

  const queryTerms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);

  // Score relevance
  const scored = all.map((m) => {
    let score = 0;
    const lower = m.fact.toLowerCase();
    for (const term of queryTerms) {
      if (lower.includes(term)) score += 2;
    }
    if (m.person?.name && query.toLowerCase().includes(m.person.name.toLowerCase())) {
      score += 4;
    }
    if (m.person?.relationship && query.toLowerCase().includes(m.person.relationship.toLowerCase())) {
      score += 4;
    }
    return { memory: m, score };
  });

  scored.sort((a, b) => b.score - a.score);
  const selected = (queryTerms.length === 0 ? all : scored.map((s) => s.memory)).slice(0, limit);

  // Update lastUsedAt
  if (selected.length > 0) {
    const ids = selected.map((m) => m.id);
    await prisma.memoryRecord.updateMany({
      where: { id: { in: ids } },
      data: { lastUsedAt: new Date() },
    });
  }

  return selected.map((m) => ({
    id: m.id,
    projectId: m.projectId,
    fact: m.fact,
    kind: m.kind,
    source: m.source,
    status: m.status,
    personName: m.person?.name ?? null,
    createdAt: m.createdAt,
    lastUsedAt: m.lastUsedAt,
  }));
}

export async function listMemories(projectId: string) {
  const records = await prisma.memoryRecord.findMany({
    where: { projectId },
    include: { person: true },
    orderBy: { createdAt: "desc" },
  });

  return records.map((m) => ({
    id: m.id,
    projectId: m.projectId,
    fact: m.fact,
    kind: m.kind as MemoryKind,
    source: m.source as MemorySource,
    status: m.status as MemoryStatus,
    confidence: m.confidence,
    personId: m.personId,
    person: m.person ? {
      id: m.person.id,
      name: m.person.name,
      relationship: m.person.relationship,
    } : null,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
    lastUsedAt: m.lastUsedAt?.toISOString() ?? null,
  }));
}

export async function updateMemory(
  id: string,
  projectId: string,
  data: { fact?: string; kind?: MemoryKind; status?: MemoryStatus },
) {
  if (data.fact) {
    const hygiene = checkSensitiveInformation(data.fact);
    if (hygiene.forbidden) {
      throw new Error(hygiene.reason ?? "Cannot store sensitive credentials.");
    }
  }

  return prisma.memoryRecord.update({
    where: { id },
    data: {
      ...(data.fact ? { fact: data.fact.trim() } : {}),
      ...(data.kind ? { kind: data.kind } : {}),
      ...(data.status ? { status: data.status } : {}),
      updatedAt: new Date(),
    },
  });
}

export async function deleteMemory(id: string, projectId: string) {
  return prisma.memoryRecord.deleteMany({
    where: { id, projectId },
  });
}
