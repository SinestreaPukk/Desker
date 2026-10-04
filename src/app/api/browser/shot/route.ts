import { handle, requireAdmin, HttpError } from "@/lib/platform/api";
import { storage } from "@/lib/platform/storage";
import { findProjectById } from "@/lib/tenancy/projects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A screenshot the browser assistant kept, for its owner only. Key shape: browser/<projectId>/<file>. */
export async function GET(request: Request) {
  try {
    const { userId } = await requireAdmin();
    const key = new URL(request.url).searchParams.get("key") ?? "";
    const [root, projectId, file, ...rest] = key.split("/");
    if (root !== "browser" || !projectId || !file || rest.length > 0 || file.includes("..")) throw new HttpError(404, "Not found.");
    if (!(await findProjectById(projectId, userId))) throw new HttpError(404, "Not found.");
    const png = await storage.get(key).catch(() => null);
    if (!png) throw new HttpError(404, "Not found.");
    return new Response(new Uint8Array(png), { headers: { "content-type": "image/png", "cache-control": "private, max-age=86400" } });
  } catch (error) {
    return handle(async () => {
      throw error;
    });
  }
}
