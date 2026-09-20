/**
 * Server-Sent Events transport.
 *
 * SSE rather than WebSockets: chat streaming is one-directional (the client
 * POSTs a message, the server streams the reply), it survives proxies without
 * an upgrade handshake, and it reconnects on its own. There is no presence or
 * typing-indicator requirement that would justify a second server process.
 */
import "server-only";

const encoder = new TextEncoder();

export function sseHeaders(): HeadersInit {
  return {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    // Nginx and friends buffer streamed responses unless told not to.
    "X-Accel-Buffering": "no",
  };
}

/** Serialises one event. Newlines in the payload would break the wire format. */
function frame(event: unknown): Uint8Array {
  return encoder.encode(`data: ${JSON.stringify(event)}\n\n`);
}

/**
 * Bridges an async generator to a streamed Response. Errors thrown mid-stream
 * are delivered as a final `error` event so the client always learns why the
 * stream stopped instead of seeing a truncated reply.
 */
export function sseResponse<T>(
  source: AsyncIterable<T>,
  options: { signal?: AbortSignal } = {},
): Response {
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        for await (const event of source) {
          if (options.signal?.aborted) break;
          controller.enqueue(frame(event));
        }
      } catch (error) {
        if (!options.signal?.aborted) {
          console.error("[sse] stream failed", error);
          controller.enqueue(
            frame({
              type: "error",
              message:
                error instanceof Error
                  ? error.message
                  : "The response stream failed unexpectedly.",
              retryable: true,
            }),
          );
        }
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: sseHeaders() });
}
