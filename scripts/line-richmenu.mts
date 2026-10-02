/**
 * Creates the Desker Personal rich menu on the LINE account and makes it the
 * default for everyone. Run once (and again after changing the tiles):
 *   npm run line:richmenu
 * Replaces the previous default menu; old menus are deleted.
 */
import sharp from "sharp";
import { LINE_API, richMenuDefinition, richMenuSvg } from "@/lib/messaging/line";

const token = process.env.LINE_CHANNEL_ACCESS_TOKEN?.trim();
if (!token) throw new Error("LINE_CHANNEL_ACCESS_TOKEN is not set.");
const auth = { authorization: `Bearer ${token}` };

const old = (await (await fetch(`${LINE_API}/richmenu/list`, { headers: auth })).json()) as { richmenus?: { richMenuId: string; name: string }[] };

const created = await fetch(`${LINE_API}/richmenu`, { method: "POST", headers: { ...auth, "content-type": "application/json" }, body: JSON.stringify(richMenuDefinition()) });
if (!created.ok) throw new Error(`Create failed: ${created.status} ${await created.text()}`);
const { richMenuId } = (await created.json()) as { richMenuId: string };

const png = await sharp(Buffer.from(richMenuSvg())).png().toBuffer();
const up = await fetch(`https://api-data.line.me/v2/bot/richmenu/${richMenuId}/content`, { method: "POST", headers: { ...auth, "content-type": "image/png" }, body: new Uint8Array(png) });
if (!up.ok) throw new Error(`Image upload failed: ${up.status} ${await up.text()}`);

const set = await fetch(`${LINE_API}/user/all/richmenu/${richMenuId}`, { method: "POST", headers: auth });
if (!set.ok) throw new Error(`Set default failed: ${set.status} ${await set.text()}`);

for (const m of old.richmenus ?? []) if (m.name === "Desker Personal") await fetch(`${LINE_API}/richmenu/${m.richMenuId}`, { method: "DELETE", headers: auth });
console.log(`Rich menu ${richMenuId} is now the default.`);
