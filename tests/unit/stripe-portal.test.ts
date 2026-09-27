import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

describe("portalConfiguration", () => {
  it("switches cancellation on, at the end of the paid month, and reuses the setup", async () => {
    vi.resetModules();
    const { portalConfiguration } = await import("@/lib/billing/stripe");
    const create = vi.fn(async () => ({ id: "bpc_new" }));
    const list = vi.fn(async () => ({ data: [{ id: "bpc_old", metadata: { desker: "older" } }] }));
    const client = { billingPortal: { configurations: { list, create } } } as never;

    expect(await portalConfiguration(client, "https://desker.test")).toBe("bpc_new");
    type Settings = {
      features: { subscription_cancel: Record<string, unknown> };
      business_profile: { terms_of_service_url?: string };
    };
    const settings = (create.mock.calls[0] as unknown as [Settings])[0];
    expect(settings.features.subscription_cancel).toMatchObject({ enabled: true, mode: "at_period_end" });
    expect(settings.business_profile.terms_of_service_url).toBe("https://desker.test/terms");

    // Created once; later portal opens reuse it.
    expect(await portalConfiguration(client, "https://desker.test")).toBe("bpc_new");
    expect(create).toHaveBeenCalledTimes(1);
  });

  it("finds the setup it made earlier instead of making another", async () => {
    vi.resetModules();
    const { portalConfiguration } = await import("@/lib/billing/stripe");
    const create = vi.fn();
    const list = vi.fn(async () => ({ data: [{ id: "bpc_mine", metadata: { desker: "2026-09-27" } }] }));
    expect(await portalConfiguration({ billingPortal: { configurations: { list, create } } } as never, "")).toBe("bpc_mine");
    expect(create).not.toHaveBeenCalled();
  });
});
