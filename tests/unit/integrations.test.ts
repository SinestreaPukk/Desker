import { beforeAll, describe, expect, it } from "vitest";
import { CONNECTORS, connectorById } from "@/lib/integrations/catalog";
import { TEMPLATES } from "@/lib/content";
import { WORK_TOOL_IDS } from "@/lib/work/tools";

describe("the connector catalog", () => {
  it("has one entry per id", () => {
    const ids = CONNECTORS.map((connector) => connector.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("only names roles that exist, and every role has something to connect", () => {
    const roles = new Set(TEMPLATES.map((template) => template.id));
    for (const connector of CONNECTORS) {
      for (const role of connector.roles) expect(roles, `${connector.id} -> ${role}`).toContain(role);
    }
    for (const template of TEMPLATES) {
      expect(CONNECTORS.some((connector) => connector.roles.includes(template.id)), template.id).toBe(true);
    }
  });

  it("wires every available OAuth connector to a provider, and every tool to a real one", () => {
    for (const connector of CONNECTORS) {
      if (connector.status === "available" && connector.auth === "oauth") {
        expect(connector.oauthProvider, connector.id).toBeTruthy();
      }
      for (const tool of connector.tools ?? []) {
        expect(WORK_TOOL_IDS as readonly string[], `${connector.id} -> ${tool}`).toContain(tool);
      }
      // Every card says what it can and cannot do.
      expect(connector.can.length, connector.id).toBeGreaterThan(0);
      expect(connector.cannot.length, connector.id).toBeGreaterThan(0);
    }
  });

  it("only suggests connectors that exist when hiring", () => {
    for (const template of TEMPLATES) {
      for (const id of template.suggestedIntegrations) {
        expect(connectorById(id), `${template.id} suggests ${id}`).toBeTruthy();
      }
    }
  });

  it("gives the Assistant and Developer roles a working connector", () => {
    const available = (role: string) =>
      CONNECTORS.filter((c) => c.status === "available" && c.auth === "oauth" && c.roles.includes(role)).map((c) => c.id);
    expect(available("secretary")).toEqual(expect.arrayContaining(["google_calendar", "slack"]));
    expect(available("dev-support")).toContain("github");
  });
});

describe("the OAuth state", () => {
  let signState: typeof import("@/lib/integrations/oauth").signState;
  let verifyState: typeof import("@/lib/integrations/oauth").verifyState;
  const base = { organizationId: "org", userId: "user", connectorId: "slack", returnTo: "/p/x/integrations" };

  beforeAll(async () => {
    process.env.AUTH_SECRET = "unit-test-secret";
    ({ signState, verifyState } = await import("@/lib/integrations/oauth"));
  });

  it("round-trips for the browser that started it", () => {
    const { token, nonce } = signState(base);
    expect(verifyState(token, nonce)).toMatchObject(base);
  });

  it("refuses another browser, a tampered token, and an off-site return address", () => {
    const { token, nonce } = signState(base);
    expect(verifyState(token, "someone-else")).toBeNull();
    expect(verifyState(token, undefined)).toBeNull();
    const [body, mac] = token.split(".");
    const forged = Buffer.from(
      JSON.stringify({ ...JSON.parse(Buffer.from(body!, "base64url").toString()), organizationId: "victim" }),
    ).toString("base64url");
    expect(verifyState(`${forged}.${mac}`, nonce)).toBeNull();

    const offsite = signState({ ...base, returnTo: "//evil.example" });
    expect(verifyState(offsite.token, offsite.nonce)).toBeNull();
  });
});
