import { requireAdmin } from "@/lib/platform/api";
import { subscribeAdminEvents, type AdminEvent } from "@/lib/platform/events";
import { sseHeaders } from "@/lib/platform/sse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Live admin feed. Issues, escalations and new messages arrive here the moment
 * a tool call writes them, so the dashboard updates without waiting for its
 * poll interval.
 */
export async function GET(request: Request) {
  await requireAdmin();

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      const send = (payload: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        } catch {
          closed = true;
        }
      };

      send({ type: "ready" });

      const unsubscribe = subscribeAdminEvents((event: AdminEvent) => send(event));

      // Comment frames keep intermediary proxies from closing an idle stream.
      const heartbeat = setInterval(() => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          closed = true;
        }
      }, 25_000);

      const cleanup = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // Already closed by the client disconnecting.
        }
      };

      request.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, { headers: sseHeaders() });
}
