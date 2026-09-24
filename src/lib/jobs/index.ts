/** Every Inngest function the app serves. Add new jobs here and nowhere else. */
import { heartbeat } from "./heartbeat";
import { digestScheduler, digestNowFn } from "./digest";
import { executeApprovedFn, runActionItemFn, scopeScheduler } from "./work";

export const functions = [
  heartbeat,
  scopeScheduler,
  runActionItemFn,
  executeApprovedFn,
  digestScheduler,
  digestNowFn,
];
export { inngest } from "./client";
