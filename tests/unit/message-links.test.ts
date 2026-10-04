import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { MessageText } from "@/components/chat/message-text";

it("renders headings, bold and sources as links, never raw html or javascript: links", () => {
  const content = "## Bangkok Tomorrow\n\n- **High:** 33°C [1]\n\n<script>x</script>\n\nSources:\n[1] AccuWeather - https://www.accuweather.com/a\n[2] TMD - javascript:alert(1)";
  const html = renderToStaticMarkup(createElement(MessageText, { content }));
  expect(html).toContain("<h3");
  expect(html).toContain("<strong");
  expect(html).toContain('href="https://www.accuweather.com/a"');
  expect(html).not.toContain('href="javascript');
  expect(html).not.toContain("<script");
});
