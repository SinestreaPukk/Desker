import { describe, expect, it } from "vitest";
import { FIRST_RUN } from "@/lib/agents/first-run";
import { templateById } from "@/lib/site/content";
import { workflowById } from "@/lib/work/workflows";
import { connectorById } from "@/lib/integrations/catalog";

describe("first run", () => {
  it("stands on a real role, workflow and connection", () => {
    const template = templateById(FIRST_RUN.templateId);
    for (const tool of ["calendar_list_events", "calendar_reschedule"]) expect(template?.workTools).toContain(tool);
    if (FIRST_RUN.workflowId) expect(workflowById(FIRST_RUN.workflowId)).toBeDefined();
    for (const id of FIRST_RUN.connection.connectors) expect(connectorById(id), id).toBeDefined();
    // The sample stops for a decision, and shows each of the four controls once.
    expect(FIRST_RUN.steps.map((step) => step.control.kind).sort()).toEqual(["approval", "drafts", "review", "sees"]);
  });
});
