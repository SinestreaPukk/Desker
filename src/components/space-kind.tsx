"use client";

import * as React from "react";
import type { SpaceKind } from "@/lib/space";

/**
 * Which kind of space the open project belongs to, for any screen that words
 * or shows things differently for one person than for a business. Set once
 * by the project layout; a screen outside it reads "business".
 */
const SpaceKindContext = React.createContext<SpaceKind>("business");

export function SpaceKindProvider({ kind, children }: { kind: SpaceKind; children: React.ReactNode }) {
  return <SpaceKindContext.Provider value={kind}>{children}</SpaceKindContext.Provider>;
}

export function useSpaceKind(): SpaceKind {
  return React.useContext(SpaceKindContext);
}
