/**
 * Every guide, in reading order. One file per guide; this is the only list of
 * them, so adding a guide is adding a file and a line here.
 */
import { guide as hireAnAgent } from "./hire-an-agent";
import { guide as projectContext } from "./project-context";
import { guide as scopeOfWork } from "./scope-of-work";
import { guide as approvals } from "./approvals";
import { guide as insights } from "./insights";
import { guide as integrations } from "./integrations";

export const GUIDE_SOURCES = [
  hireAnAgent,
  projectContext,
  scopeOfWork,
  approvals,
  insights,
  integrations,
];
