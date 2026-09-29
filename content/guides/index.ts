/**
 * Every guide, in reading order. One file per guide; this is the only list of
 * them, so adding a guide is adding a file and a line here. Each says who it
 * is for (business, personal or all); the help panel lists only the guides
 * for the space you are in.
 */
import { guide as hireAnAgent } from "./hire-an-agent";
import { guide as projectContext } from "./project-context";
import { guide as scopeOfWork } from "./scope-of-work";
import { guide as approvals } from "./approvals";
import { guide as insights } from "./insights";
import { guide as integrations } from "./integrations";
import { guide as personalSpace } from "./personal-space";
import { guide as aboutYou } from "./about-you";
import { guide as personalRoutines } from "./personal-routines";
import { guide as moneyManager } from "./money-manager";
import { guide as personalPrivacy } from "./personal-privacy";

export const GUIDE_SOURCES = [
  hireAnAgent,
  projectContext,
  scopeOfWork,
  approvals,
  insights,
  integrations,
  personalSpace,
  aboutYou,
  personalRoutines,
  moneyManager,
  personalPrivacy,
];
