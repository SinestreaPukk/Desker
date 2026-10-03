import { describe, expect, it } from "vitest";
import { afterResponse } from "@/lib/platform/after-response";

/**
 * Notifications are scheduled through this. Inside a request Next keeps the
 * invocation alive for the task; outside one - an Inngest step running a
 * scheduled agent - `after` throws, and the task must still run rather than
 * being swallowed with the error. This test covers that second path, which is
 * the one no browser ever exercises.
 */
describe("afterResponse outside a request scope", () => {
  it("still runs the task", async () => {
    let ran = false;
    afterResponse(async () => {
      ran = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(ran).toBe(true);
  });

  it("does not throw when the task rejects", async () => {
    expect(() =>
      afterResponse(async () => {
        throw new Error("webhook down");
      }),
    ).not.toThrow();
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
});
