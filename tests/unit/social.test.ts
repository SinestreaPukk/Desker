import { describe, expect, it } from "vitest";
import { CAN_DELETE, CAN_EDIT, linkedinText, platformOf } from "@/lib/integrations/social";
import { authorizeUrl, pkcePair } from "@/lib/integrations/oauth";
import { createHash } from "node:crypto";

describe("social networks", () => {
  it("reads a draft's platform however it is written", () => {
    expect(platformOf("LinkedIn")).toBe("linkedin");
    expect(platformOf("Twitter")).toBe("x");
    expect(platformOf("X (Twitter)")).toBe("x");
    expect(platformOf("IG")).toBe("instagram");
    expect(platformOf("blog")).toBeNull();
    expect(platformOf(undefined)).toBeNull();
  });

  it("escapes LinkedIn's markup characters so a post reads as written", () => {
    expect(linkedinText("Save 20% (today) #launch @team")).toBe("Save 20% \\(today\\) \\#launch \\@team");
  });

  it("only offers what each network allows", () => {
    expect(CAN_EDIT.instagram).toBe(false);
    expect(CAN_EDIT.x).toBe(false);
    expect(CAN_DELETE.x).toBe(true);
    expect(CAN_EDIT.linkedin && CAN_DELETE.facebook).toBe(true);
  });

  it("sends X a PKCE challenge that matches the verifier kept back", () => {
    process.env.X_CLIENT_ID = "x-id";
    process.env.X_CLIENT_SECRET = "x-secret";
    const { verifier, challenge } = pkcePair();
    const url = new URL(authorizeUrl("x", "https://desker.test/cb", "state", "tweet.read tweet.write users.read offline.access", challenge));
    expect(url.searchParams.get("code_challenge")).toBe(createHash("sha256").update(verifier).digest("base64url"));
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("scope")).toContain("tweet.write");
  });
});
