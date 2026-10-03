import { MEMORY_FIELDS } from "@/lib/agents/memory-fields";

/** One thing it knows about you: a single line of one of the saved answers. */
export interface MemoryItem {
  fieldId: string;
  label: string;
  /** Position among the field's lines, so one line can be edited or forgotten on its own. */
  index: number;
  text: string;
}

const bullet = /^\s*[-*•]\s*/;

/** The saved answers as a flat list of facts, one per line, in the order of the fields. */
export function memoryItems(answers: Record<string, string>): MemoryItem[] {
  return MEMORY_FIELDS.flatMap((field) =>
    (answers[field.id] ?? "")
      .split("\n")
      .map((line) => line.replace(bullet, "").trim())
      .filter(Boolean)
      .map((text, index) => ({ fieldId: field.id, label: field.label, index, text })),
  );
}

/** A field's text with one line changed (a new text) or forgotten (null). Other lines are untouched. */
export function changeLine(answer: string, index: number, text: string | null): string {
  const lines = answer
    .split("\n")
    .map((line) => line.replace(bullet, "").trim())
    .filter(Boolean);
  if (text === null) lines.splice(index, 1);
  else lines[index] = text.trim();
  return lines.filter(Boolean).join("\n");
}
