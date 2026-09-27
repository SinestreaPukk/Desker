import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Field, Input } from "@/components/ui/field";

/** Every field gets its label, even when the input is wrapped for an icon. */
describe("Field", () => {
  it("labels an input passed directly", () => {
    const html = renderToStaticMarkup(h(Field, { label: "Name", htmlFor: "name", children: h(Input) }));
    expect(html).toContain('for="name"');
    expect(html).toMatch(/<input[^>]*id="name"/);
  });

  it("labels an input inside a wrapper, and leaves the wrapper without the id", () => {
    const html = renderToStaticMarkup(
      h(Field, {
        label: "Passcode",
        htmlFor: "pass",
        error: "Wrong passcode",
        children: h("div", { className: "relative" }, h(Input)),
      }),
    );
    expect(html).toMatch(/<input[^>]*id="pass"/);
    expect(html).toMatch(/<input[^>]*aria-describedby="pass-error"/);
    expect(html).toMatch(/<input[^>]*aria-invalid="true"/);
    expect(html).not.toMatch(/<div[^>]*id="pass"/);
  });
});
