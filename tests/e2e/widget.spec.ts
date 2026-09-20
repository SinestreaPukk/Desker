import { expect, test } from "@playwright/test";
import { currentProjectSlug } from "./helpers";

/**
 * The embed loader has to work on a page that knows nothing about the app, so
 * it is tested against a plain HTML document rather than one of our own React
 * routes.
 *
 * The host page is served from `localhost` while the widget points at
 * `127.0.0.1` - the same server, but a genuinely different origin, so this
 * exercises real cross-origin embedding rather than a same-origin shortcut.
 */
test("the widget loader mounts a launcher and opens the chat in an iframe", async ({
  page,
  baseURL,
}) => {
  // The session comes from the shared storage state set up by auth.setup.ts.
  const project = await currentProjectSlug(page);
  const created = await page.request.post(`/api/agents?project=${project}`, {
    data: {
      name: "Widget Bot",
      jobTitle: "Support",
      personality: "Brief and direct in every reply.",
      responsibilities: ["Answer questions"],
      allowedTools: [],
      status: "published",
    },
  });
  expect(created.ok(), await created.text()).toBe(true);
  const agent = (await created.json()) as { id: string };

  const widgetOrigin = baseURL!;
  const hostOrigin = widgetOrigin.replace("127.0.0.1", "localhost");

  await page.goto(
    `${hostOrigin}/widget-demo.html?agent=${agent.id}&origin=${encodeURIComponent(widgetOrigin)}`,
  );
  await expect(
    page.getByRole("heading", { name: "Northwind Supply Co." }),
  ).toBeVisible();

  const launcher = page.getByRole("button", { name: "Chat with support" });
  const panel = page.getByRole("dialog", { name: "Chat with support" });

  await expect(launcher).toBeVisible();
  await expect(launcher).toHaveAttribute("aria-expanded", "false");
  await expect(panel).toBeHidden();

  await launcher.click();
  // Assert on the panel rather than the launcher: on a phone the launcher is
  // deliberately hidden while the full-screen sheet is open, so it is not a
  // viewport-agnostic thing to assert against.
  await expect(panel).toBeVisible();

  const frame = page.frameLocator('iframe[title="Chat with support"]');
  await expect(
    frame.getByRole("heading", { level: 1, name: "Widget Bot" }),
  ).toBeVisible({ timeout: 30_000 });
  // The composer must be usable inside the frame.
  await expect(frame.getByRole("textbox", { name: "Message" })).toBeVisible();

  // Escape closes even with focus inside the cross-origin iframe, which only
  // works because the embedded page reports the keypress up to the loader.
  await frame.getByRole("textbox", { name: "Message" }).click();
  await page.keyboard.press("Escape");
  await expect(panel).toBeHidden();
  await expect(launcher).toBeVisible();
  await expect(launcher).toHaveAttribute("aria-expanded", "false");
});

test("the widget becomes a full-screen sheet on a phone", async ({ page, baseURL }) => {
  const project = await currentProjectSlug(page);
  const created = await page.request.post(`/api/agents?project=${project}`, {
    data: {
      name: "Mobile Bot",
      jobTitle: "Support",
      personality: "Brief and direct in every reply.",
      responsibilities: ["Answer questions"],
      allowedTools: [],
      status: "published",
    },
  });
  const agent = (await created.json()) as { id: string };

  await page.setViewportSize({ width: 360, height: 740 });
  const widgetOrigin = baseURL!;
  const hostOrigin = widgetOrigin.replace("127.0.0.1", "localhost");
  await page.goto(
    `${hostOrigin}/widget-demo.html?agent=${agent.id}&origin=${encodeURIComponent(widgetOrigin)}`,
  );

  await page.getByRole("button", { name: "Chat with support" }).click();

  const panel = page.getByRole("dialog", { name: "Chat with support" });
  const box = await panel.boundingBox();
  expect(box?.width).toBeCloseTo(360, 0);
  // The launcher hides behind a full-screen sheet so it cannot cover the input.
  await expect(page.getByRole("button", { name: "Chat with support" })).toBeHidden();
});
