/**
 * What a token costs, per model, in USD per million. Used to turn the usage
 * counters into the cost figure Insights shows and billing will meter.
 *
 * The Anthropic rates are the first-party API list prices as of 2026-06;
 * update them when the list changes. Any model not listed - or any custom
 * rate - can be supplied through MODEL_PRICING_JSON, e.g.
 *   {"gpt-4o": {"input": 2.5, "output": 10}}
 * A model with no known price contributes null, never zero, so a missing
 * rate shows up as "unknown" rather than as free.
 */

export interface ModelPrice {
  /** USD per 1M input tokens. */
  input: number;
  /** USD per 1M output tokens. */
  output: number;
}

const BUILT_IN: Record<string, ModelPrice> = {
  "claude-fable-5-1": { input: 10, output: 50 },
  "claude-fable-5": { input: 10, output: 50 },
  "claude-opus-5": { input: 5, output: 25 },
  "claude-opus-4-8": { input: 5, output: 25 },
  "claude-opus-4-7": { input: 5, output: 25 },
  "claude-opus-4-6": { input: 5, output: 25 },
  "claude-sonnet-5": { input: 2, output: 10 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-haiku-4-5": { input: 1, output: 5 },
};

let overrides: Record<string, ModelPrice> | null = null;
function loadOverrides(): Record<string, ModelPrice> {
  if (overrides) return overrides;
  overrides = {};
  const raw = process.env.MODEL_PRICING_JSON?.trim();
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Record<string, ModelPrice>;
      for (const [model, price] of Object.entries(parsed)) {
        if (typeof price?.input === "number" && typeof price?.output === "number") {
          overrides[model] = price;
        }
      }
    } catch {
      console.error("[pricing] MODEL_PRICING_JSON is not valid JSON; ignoring it.");
    }
  }
  return overrides;
}

/** Exact id first, then the id with any date suffix removed. */
export function priceFor(model: string): ModelPrice | null {
  const all = { ...BUILT_IN, ...loadOverrides() };
  if (all[model]) return all[model];
  const undated = model.replace(/-\d{8}$/, "");
  return all[undated] ?? null;
}

/** USD, or null when the model has no known price. */
export function costOf(model: string, inputTokens: number, outputTokens: number): number | null {
  const price = priceFor(model);
  if (!price) return null;
  return (inputTokens * price.input + outputTokens * price.output) / 1_000_000;
}
