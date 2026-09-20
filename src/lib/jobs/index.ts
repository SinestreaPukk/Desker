/** Every Inngest function the app serves. Add new jobs here and nowhere else. */
import { heartbeat } from "./heartbeat";

export const functions = [heartbeat];
export { inngest } from "./client";
