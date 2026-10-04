import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { MessageText } from "@/components/chat/message-text";

it("renders headings, bold and sources as links, never raw html or javascript: links", () => {
  const content = "## Bangkok Tomorrow\n\n- **High:** 33°C [1]\n\n<script>x</script>\n\nSources:\n[1] AccuWeather - https://www.accuweather.com/a\n[2] TMD - javascript:alert(1)";
  const html = renderToStaticMarkup(createElement(MessageText, { content }));
  expect(html).toContain("<h3");
  expect(html).toContain("<strong");
  expect(html).toContain("Source 1");
  expect(html).toContain('href="https://www.accuweather.com/a"');
  expect(html).not.toContain('href="javascript');
  expect(html).not.toContain("<script");
  const shot = renderToStaticMarkup(createElement(MessageText, { content: "Found it.\n\n![Prices](/api/browser/shot?key=browser%2Fp1%2Fa-shot.png)\n\n![x](https://evil.test/a.png)" }));
  expect(shot).toContain("<img");
  expect(shot).not.toContain('<img src="https');
});

import { clampText } from "@/lib/work/model-json";

it("clampText keeps line breaks", () => {
  expect(clampText("## A\n\n\n\n- b\n- c  \n", 100)).toBe("## A\n\n- b\n- c");
});
