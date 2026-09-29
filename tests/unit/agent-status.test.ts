import { describe, expect, it } from "vitest";
import { describeAgentStatus, isConnectionError, type AgentStatusFacts } from "@/lib/work/agent-status";

const links = { project: "acme", agentId: "a1" };
const fine: AgentStatusFacts = {
  published: true,
  runMode: "scheduled",
  cadence: "Every Monday at 08:00",
  nextRunAt: "2026-10-05T01:00:00.000Z",
  running: null,
  lastRun: { id: "r1", status: "done", at: "2026-09-28T01:00:00.000Z", title: "Weekly brief", error: null, deliveryFailed: false },
  waiting: null,
  flags: null,
  connections: [],
};

describe("an agent's status", () => {
  it("says on track when nothing needs doing, and asks nothing of the owner", () => {
    const status = describeAgentStatus(fine, links);
    expect(status.headline).toBe("On track");
    expect(status.actions).toEqual([]);
  });

  it("never shows a failure without something to click", () => {
    const failed = describeAgentStatus(
      { ...fine, lastRun: { ...fine.lastRun!, status: "failed", error: "The model timed out." } },
      links,
    );
    expect(failed.tone).toBe("danger");
    expect(failed.actions.map((a) => a.kind)).toEqual(["retry", "link"]);
    expect(failed.actions[1]).toMatchObject({ href: "/p/acme/work/r1", label: "Why it failed" });
  });

  it("offers a reconnect first when a connection caused the failure, and resends rather than reruns", () => {
    const status = describeAgentStatus(
      {
        ...fine,
        lastRun: { ...fine.lastRun!, status: "failed", error: "Slack is not connected.", deliveryFailed: true },
        connections: [{ connectorId: "slack", name: "Slack", state: "missing", consequence: "x" }],
      },
      links,
    );
    expect(status.headline).toBe("Couldn't send");
    expect(status.actions[0]).toMatchObject({ href: "/p/acme/integrations#slack", label: "Connect Slack" });
    expect(status.actions[1]).toMatchObject({ kind: "retry", label: "Try sending again" });
  });

  it("points waiting work and flags at Needs you, the one queue", () => {
    expect(describeAgentStatus({ ...fine, waiting: { id: "w1", count: 2 } }, links).actions[0]).toMatchObject({
      href: "/p/acme/needs-you?item=w1",
    });
    expect(describeAgentStatus({ ...fine, flags: { id: "i1", count: 1 } }, links).actions[0]).toMatchObject({
      href: "/p/acme/needs-you?item=i1",
    });
  });

  it("tells a connection problem from an ordinary failure", () => {
    expect(isConnectionError("Google Calendar token expired")).toBe(true);
    expect(isConnectionError("Request failed with status 401")).toBe(true);
    expect(isConnectionError("The model timed out.")).toBe(false);
  });
});
