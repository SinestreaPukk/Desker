/**
 * Browser-side SSE frame reader.
 *
 * Separate from lib/sse.ts because that module is `server-only`; this half runs
 * in the browser and must not pull the server bundle in with it.
 */
export async function* readSseStream(
  response: Response,
  signal?: AbortSignal,
): AsyncGenerator<unknown> {
  const reader = response.body?.getReader();
  if (!reader) return;

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      if (signal?.aborted) break;
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const frames = buffer.split("\n\n");
      buffer = frames.pop() ?? "";

      for (const raw of frames) {
        const line = raw.trim();
        if (!line.startsWith("data:")) continue;
        try {
          yield JSON.parse(line.slice(5).trim());
        } catch {
          // Ignore a malformed frame rather than killing the stream.
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
