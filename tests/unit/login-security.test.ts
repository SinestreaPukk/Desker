import { afterEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
import { deviceLabel } from "@/lib/login-guard";
import { isBreachedPassword, passwordProblem } from "@/lib/password-check";

const sha1 = (text: string) => createHash("sha1").update(text).digest("hex").toUpperCase();

afterEach(() => vi.unstubAllGlobals());

describe("new-device labels", () => {
  it("names the browser and system a person would recognise", () => {
    expect(deviceLabel("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36")).toBe("Chrome on macOS");
    expect(deviceLabel("Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1")).toBe("Safari on iOS");
    expect(deviceLabel("Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:130.0) Gecko/20100101 Firefox/130.0")).toBe("Firefox on Windows");
    expect(deviceLabel("")).toBe("A browser on an unknown system");
  });
});

describe("breached passwords", () => {
  it("sends only a five-character prefix, and spots the password in the answer", async () => {
    const hash = sha1("password123");
    const seen: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        seen.push(url);
        return new Response(`0000000000000000000000000000000000A:0\n${hash.slice(5)}:2254650\n`);
      }),
    );
    expect(await isBreachedPassword("password123")).toBe(true);
    expect(seen[0]).toBe(`https://api.pwnedpasswords.com/range/${hash.slice(0, 5)}`);
    expect(seen[0]).not.toContain(hash.slice(5));
  });

  it("ignores padding rows and fails open when the service is down", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(`${sha1("correct horse battery").slice(5)}:0\n`)));
    expect(await isBreachedPassword("correct horse battery")).toBe(false);
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("offline"); }));
    expect(await isBreachedPassword("anything at all")).toBe(false);
  });

  it("refuses a password built from the email address", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("")));
    expect(await passwordProblem("tigerpukk2026", "tigerpukk@gmail.com")).toMatch(/email/);
    expect(await passwordProblem("a long unrelated phrase", "tigerpukk@gmail.com")).toBeNull();
  });
});
