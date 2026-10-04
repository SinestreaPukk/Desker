import { storage } from "@/lib/platform/storage";
import { validShotSignature } from "@/lib/browser/shot-url";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A kept screenshot, for an app that fetches it by a signed link (LINE). */
export async function GET(request: Request) {
  const q = new URL(request.url).searchParams;
  const key = q.get("key") ?? "";
  if (!key.startsWith("browser/") || key.includes("..") || !validShotSignature(key, Number(q.get("exp")), q.get("sig") ?? "")) {
    return new Response("Not found", { status: 404 });
  }
  const image = await storage.get(key).catch(() => null);
  if (!image) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(image), { headers: { "content-type": "image/jpeg", "cache-control": "private, max-age=3600" } });
}
