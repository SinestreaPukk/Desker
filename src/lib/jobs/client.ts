/**
 * The background job runtime.
 *
 * Every piece of work that must happen without a browser tab open - scheduled
 * heartbeats today, autonomous agent runs later - is an Inngest function
 * registered through this client and served from /api/inngest. Nothing else
 * in the codebase talks to a scheduler or a queue directly.
 *
 * Locally, `npm run inngest:dev` starts the Inngest dev server, which
 * discovers the functions at /api/inngest and fires their crons. In
 * production INNGEST_EVENT_KEY and INNGEST_SIGNING_KEY connect the same route
 * to Inngest Cloud.
 */
import { Inngest } from "inngest";

export const inngest = new Inngest({ id: "desker" });
