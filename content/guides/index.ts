/**
 * Every guide, in reading order. One file per guide; this is the only list of
 * them, so adding a guide is adding a file and a line here.
 */
import { guide as approvals } from "./approvals";
import { guide as integrations } from "./integrations";
import { guide as personalSpace } from "./personal-space";
import { guide as aboutYou } from "./about-you";
import { guide as personalRoutines } from "./personal-routines";
import { guide as moneyManager } from "./money-manager";
import { guide as personalPrivacy } from "./personal-privacy";

export const GUIDE_SOURCES = [
  approvals,
  integrations,
  personalSpace,
  aboutYou,
  personalRoutines,
  moneyManager,
  personalPrivacy,
];
