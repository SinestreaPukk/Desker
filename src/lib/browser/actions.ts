/**
 * The computer toolset's members, performed on a Playwright page. Pure of
 * model logic: one call in, a text result or a screenshot out.
 */
import "server-only";
import type { Page } from "playwright-core";

export type ActionResult = { text: string } | { image: string };

const KEYS: Record<string, string> = {
  return: "Enter",
  enter: "Enter",
  ctrl: "Control",
  control: "Control",
  alt: "Alt",
  shift: "Shift",
  super: "Meta",
  meta: "Meta",
  cmd: "Meta",
  backspace: "Backspace",
  delete: "Delete",
  escape: "Escape",
  esc: "Escape",
  tab: "Tab",
  space: "Space",
  page_down: "PageDown",
  page_up: "PageUp",
  pagedown: "PageDown",
  pageup: "PageUp",
  home: "Home",
  end: "End",
  up: "ArrowUp",
  down: "ArrowDown",
  left: "ArrowLeft",
  right: "ArrowRight",
};

/** "ctrl+s" -> "Control+s", "Return" -> "Enter": the toolset speaks xdotool, Playwright speaks DOM. */
export function playwrightKey(combo: string): string {
  return combo
    .split("+")
    .map((part) => KEYS[part.trim().toLowerCase()] ?? (part.trim().length === 1 ? part.trim() : part.trim().replace(/^./, (c) => c.toUpperCase())))
    .join("+");
}

type Point = [number, number];
const point = (value: unknown): Point | null => (Array.isArray(value) && value.length === 2 && value.every((n) => typeof n === "number") ? (value as Point) : null);

const SETTLE_MS = 500;

export async function screenshot(page: Page): Promise<string> {
  return (await page.screenshot({ type: "png" })).toString("base64");
}

export async function perform(page: Page, name: string, input: Record<string, unknown>, cursor: { at: Point }): Promise<ActionResult> {
  const at = point(input.coordinate);
  const modifier = typeof input.text === "string" && ["left_click", "right_click", "middle_click", "double_click", "triple_click", "left_click_drag", "scroll"].includes(name) ? playwrightKey(input.text) : null;
  const click = async (button: "left" | "right" | "middle", count: number) => {
    const target = at ?? cursor.at;
    cursor.at = target;
    if (modifier) await page.keyboard.down(modifier);
    await page.mouse.click(target[0], target[1], { button, clickCount: count });
    if (modifier) await page.keyboard.up(modifier);
    await page.waitForTimeout(SETTLE_MS);
    return { text: "OK" };
  };
  switch (name) {
    case "screenshot":
      return { image: await screenshot(page) };
    case "zoom": {
      const r = Array.isArray(input.region) ? (input.region as number[]) : [0, 0, 512, 384];
      const [x0, y0, x1, y1] = r as [number, number, number, number];
      return { image: (await page.screenshot({ type: "png", clip: { x: x0, y: y0, width: Math.max(1, x1 - x0), height: Math.max(1, y1 - y0) } })).toString("base64") };
    }
    case "left_click":
      return click("left", 1);
    case "right_click":
      return click("right", 1);
    case "middle_click":
      return click("middle", 1);
    case "double_click":
      return click("left", 2);
    case "triple_click":
      return click("left", 3);
    case "left_click_drag": {
      const from = point(input.start_coordinate);
      if (!from || !at) throw new Error("left_click_drag needs start_coordinate and coordinate.");
      await page.mouse.move(from[0], from[1]);
      await page.mouse.down();
      await page.mouse.move(at[0], at[1], { steps: 8 });
      await page.mouse.up();
      cursor.at = at;
      await page.waitForTimeout(SETTLE_MS);
      return { text: "OK" };
    }
    case "mouse_move":
      if (!at) throw new Error("mouse_move needs a coordinate.");
      await page.mouse.move(at[0], at[1]);
      cursor.at = at;
      return { text: "OK" };
    case "left_mouse_down":
      await page.mouse.down();
      return { text: "OK" };
    case "left_mouse_up":
      await page.mouse.up();
      return { text: "OK" };
    case "cursor_position":
      return { text: `X=${cursor.at[0]},Y=${cursor.at[1]}` };
    case "scroll": {
      const target = at ?? cursor.at;
      await page.mouse.move(target[0], target[1]);
      const ticks = Math.min(Math.max(Number(input.scroll_amount) || 3, 1), 30) * 100;
      const dir = String(input.scroll_direction);
      if (modifier) await page.keyboard.down(modifier);
      await page.mouse.wheel(dir === "left" ? -ticks : dir === "right" ? ticks : 0, dir === "up" ? -ticks : dir === "down" ? ticks : 0);
      if (modifier) await page.keyboard.up(modifier);
      await page.waitForTimeout(SETTLE_MS);
      return { text: "OK" };
    }
    case "type":
      await page.keyboard.type(String(input.text ?? ""), { delay: 8 });
      return { text: "OK" };
    case "key": {
      const repeat = Math.min(Math.max(Number(input.repeat) || 1, 1), 100);
      for (let i = 0; i < repeat; i++) await page.keyboard.press(playwrightKey(String(input.text ?? "")));
      await page.waitForTimeout(SETTLE_MS);
      return { text: "OK" };
    }
    case "hold_key": {
      const key = playwrightKey(String(input.text ?? ""));
      await page.keyboard.down(key);
      await page.waitForTimeout(Math.min(Number(input.duration) || 1, 10) * 1000);
      await page.keyboard.up(key);
      return { text: "OK" };
    }
    case "wait":
      await page.waitForTimeout(Math.min(Number(input.duration) || 1, 10) * 1000);
      return { text: "OK" };
    default:
      throw new Error(`Unknown action ${name}.`);
  }
}

/** Only ordinary web addresses: never a local file, a browser page or an internal address. */
export function allowedUrl(raw: string): URL | null {
  let url: URL;
  try {
    url = new URL(/^[a-z]+:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".local") || host.endsWith(".internal") || !host.includes(".")) return null;
  if (/^(10\.|127\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|0\.)/.test(host) || host === "[::1]") return null;
  return url;
}
