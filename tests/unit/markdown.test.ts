import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Markdown } from "@/components/markdown";

const render = (text: string) => renderToStaticMarkup(createElement(Markdown, { text }));

/**
 * Agents' reports and research come through this renderer as well as the
 * guides, so it must turn their markdown into elements (not leave symbols
 * on screen) and must never make a link out of anything but http(s) or a
 * site-relative path - the text can repeat what a web page said.
 */
describe("Markdown", () => {
  it("renders agent markdown as elements, not symbols", () => {
    const html = render("# Title\n\n**Alibaba** shipped *AgentCore* [4].\n\n---\n\n- one\n- two");
    expect(html).toContain("<h2");
    expect(html).toContain("<strong");
    expect(html).toContain("<em>AgentCore</em>");
    expect(html).toContain("<hr");
    expect(html).toContain("<ul");
    expect(html).not.toMatch(/\*\*|---|# /);
  });

  it("links only http(s) and site-relative paths", () => {
    expect(render("[x](javascript:alert(1))")).not.toContain("href");
    expect(render("[x](//evil.example)")).not.toContain("href");
    expect(render("[x](https://a.example)")).toContain('href="https://a.example"');
    expect(render("[x](/guides/a)")).toContain('href="/guides/a"');
  });
});
