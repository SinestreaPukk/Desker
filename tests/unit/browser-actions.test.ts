import { describe, expect, it } from "vitest";
import { allowedUrl, playwrightKey } from "@/lib/browser/actions";

describe("browser actions", () => {
  it("translates xdotool-style keys to Playwright's", () => {
    expect(playwrightKey("Return")).toBe("Enter");
    expect(playwrightKey("ctrl+s")).toBe("Control+s");
    expect(playwrightKey("super+Page_Down")).toBe("Meta+PageDown");
    expect(playwrightKey("a")).toBe("a");
  });

  it("only lets the browser go to ordinary public web addresses", () => {
    expect(allowedUrl("skyscanner.com")?.href).toBe("https://skyscanner.com/");
    expect(allowedUrl("https://www.google.com/travel/flights")).not.toBeNull();
    for (const bad of ["file:///etc/passwd", "chrome://settings", "javascript:alert(1)", "http://localhost:3000", "http://127.0.0.1", "http://192.168.1.1/admin", "http://169.254.169.254/latest", "intranet"]) {
      expect(allowedUrl(bad)).toBeNull();
    }
  });
});
