import { describe, expect, it } from "vitest";
import { MAX_ROUTINES, routinesInputSchema } from "@/lib/work/routines";
import { localTimeZone } from "@/lib/shared/local-time";

describe("routines input", () => {
  const ok = { cron: "0 8 * * 1", instruction: "Plan my week" };

  it("fills in defaults and trims", () => {
    const parsed = routinesInputSchema.parse({ routines: [{ ...ok, instruction: "  Plan my week  " }] });
    expect(parsed.routines[0]).toMatchObject({ instruction: "Plan my week", timezone: localTimeZone(), enabled: true });
  });

  it("refuses an empty instruction and too many routines", () => {
    expect(routinesInputSchema.safeParse({ routines: [{ ...ok, instruction: "  " }] }).success).toBe(false);
    expect(routinesInputSchema.safeParse({ routines: Array.from({ length: MAX_ROUTINES + 1 }, () => ok) }).success).toBe(false);
  });
});
