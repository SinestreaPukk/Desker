/**
 * Encode database and external text before placing it in a prompt. JSON string
 * literals keep attacker-controlled newlines and markup from creating prompt
 * sections; the surrounding system text must still label the value as data.
 */
export function promptData(value: string, maxChars = 4_000): string {
  const bounded = value.replace(/\0/g, "").slice(0, maxChars);
  return JSON.stringify(bounded)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}

export function promptDataList(values: readonly string[], maxItems = 30, maxChars = 500): string {
  const bounded = values.slice(0, maxItems).map((value) => value.replace(/\0/g, "").slice(0, maxChars));
  return JSON.stringify(bounded)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");
}
