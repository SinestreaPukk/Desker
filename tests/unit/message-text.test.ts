import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MessageText } from "@/components/chat/message-text";

const render = (content: string) => renderToStaticMarkup(createElement(MessageText, { content }));

/**
 * This component renders text a client typed, or a model repeating what a
 * client typed, into the admin dashboard and the public widget. Its safety
 * comes from structure rather than sanitising: every piece of the string ends
 * up as a React text child, and the delimiters only choose which element wraps
 * it. These tests hold that line while it learns new delimiters.
 */
describe("MessageText", () => {
  it("renders a bold run as an element, not as asterisks", () => {
    const html = render("Returns are **free** within 30 days.");
    expect(html).toContain("<strong");
    expect(html).toContain("free");
    expect(html).not.toContain("**");
  });

  it("keeps a bold run inside backticks as code", () => {
    const html = render("Write `**not bold**` in the body.");
    expect(html).toContain("<code");
    expect(html).not.toContain("<strong");
  });

  it("renders lists and inline code", () => {
    const html = render("- first\n- `second`");
    expect(html).toContain("<ul");
    expect(html).toContain("<li");
    expect(html).toContain("<code");
  });

  it("never turns markup in the content into markup in the output", () => {
    const html = render('<script>alert(1)</script> and <b>bold</b> and **real**');
    expect(html).not.toContain("<script");
    expect(html).not.toContain("<b>");
    expect(html).toContain("&lt;script&gt;");
    // The one element that does appear is the one this component chose.
    expect(html).toContain("<strong");
  });

  it("leaves an unterminated delimiter alone", () => {
    const html = render("A ** stray asterisk pair");
    expect(html).not.toContain("<strong");
    expect(html).toContain("**");
  });
});
