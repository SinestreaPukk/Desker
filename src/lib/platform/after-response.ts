import "server-only";
import { after } from "next/server";

/**
 * Run work once the response has been sent.
 *
 * A floating promise is not enough on a serverless host: the moment a route
 * handler returns, the invocation can be frozen, and anything still in flight -
 * an escalation webhook, a contact email - is dropped without a trace. `after`
 * hands the task to the runtime, which keeps the invocation alive for it and
 * still does not make the caller wait.
 *
 * It throws outside a request scope, which is exactly where background jobs
 * call it from: an Inngest step is already long-lived and awaits its own work,
 * so there a floating promise is the right thing and the fallback takes over.
 */
export function afterResponse(task: () => Promise<unknown>): void {
  try {
    after(task);
  } catch {
    // Caught, not floated: an unhandled rejection out here is a process-level
    // event, and none of these tasks is worth taking a worker down for.
    void task().catch((error: unknown) => {
      console.error("[afterResponse] background task failed:", error);
    });
  }
}
