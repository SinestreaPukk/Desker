import { describe, expect, it } from "vitest";
import { FIRST_RUNS } from "@/lib/first-run";
import { templateById } from "@/lib/content";
import { workflowById } from "@/lib/work/workflows";
import { connectorById } from "@/lib/integrations/catalog";

// What each first run actually calls on, so the real run can do what the sample shows.
const NEEDS = {
  business: ["search_documents", "send_email", "escalate_to_human"],
  personal: ["calendar_list_events", "calendar_reschedule"],
} as const;

describe("first runs", () => {
  for (const run of Object.values(FIRST_RUNS)) {
    it(`${run.audience}: stands on a real role, workflow and connection`, () => {
      const template = templateById(run.templateId);
      expect(template?.audience).toBe(run.audience);
      for (const tool of NEEDS[run.audience]) expect(template?.workTools).toContain(tool);
      if (run.workflowId) expect(workflowById(run.workflowId)?.audience).toBe(run.audience);
      for (const id of run.connection.connectors) expect(connectorById(id), id).toBeDefined();
      // The sample stops for a decision, and shows each of the four controls once.
      expect(run.steps.map((step) => step.control.kind).sort()).toEqual(["approval", "drafts", "review", "sees"]);
    });
  }
});
