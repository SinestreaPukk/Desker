/** Every Inngest function the app serves. Add new jobs here and nowhere else. */
import { heartbeat } from "./heartbeat";
import { digestScheduler, digestNowFn } from "./digest";
import { briefScheduler } from "./brief";
import { executeApprovedFn, fireScopeFn, runActionItemFn, scopeScheduler, workWatchdogFn } from "./work";

export const functions = [
  heartbeat,
  scopeScheduler,
  fireScopeFn,
  workWatchdogFn,
  runActionItemFn,
  executeApprovedFn,
  digestScheduler,
  digestNowFn,
  briefScheduler,
];
export { inngest } from "./client";
