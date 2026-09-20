/**
 * In-process pub/sub used to push admin dashboard updates over SSE.
 *
 * Single-instance only, which is exactly the MVP's deployment shape (one
 * container, or the desktop build). The dashboard also polls on an interval, so
 * a multi-instance deployment degrades to near-live rather than breaking - see
 * the `refetchInterval` on the admin queries.
 */
import "server-only";
import { EventEmitter } from "node:events";

export type AdminEvent =
  | { type: "issue.created"; conversationId: string; agentId: string; issueType: "issue" | "suggestion" | "escalation" }
  | { type: "issue.updated"; issueId: string }
  | { type: "conversation.updated"; conversationId: string; agentId: string }
  | { type: "conversation.escalated"; conversationId: string; agentId: string };

const globalForEvents = globalThis as unknown as { deskerBus?: EventEmitter };

/**
 * Pinned to globalThis in every environment, not just development.
 *
 * The obvious reason is HMR, but the load-bearing one is the production build:
 * the bundler can emit a separate copy of this module into each route's chunk,
 * and two copies means two EventEmitters. A publisher in one route then reaches
 * no subscriber in another - which showed up as a colleague's reply never
 * arriving in an open client chat window, with no error anywhere.
 */
const bus = globalForEvents.deskerBus ?? new EventEmitter();
// Each open dashboard tab and each open client chat adds a listener; the
// default cap of 10 is far too low.
bus.setMaxListeners(0);
globalForEvents.deskerBus = bus;

export function publishAdminEvent(event: AdminEvent): void {
  bus.emit("admin", event);
}


export function subscribeAdminEvents(listener: (event: AdminEvent) => void): () => void {
  bus.on("admin", listener);
  return () => bus.off("admin", listener);
}
