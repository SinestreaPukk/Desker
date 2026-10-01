"use client";

import * as React from "react";

const noopSubscribe = () => () => {};

/**
 * The browser's origin, or an empty string during server rendering.
 * `useSyncExternalStore` is the hydration-safe way to read it: the server
 * snapshot on the server, the client snapshot after hydration.
 */
export function useOrigin(): string {
  return React.useSyncExternalStore(
    noopSubscribe,
    () => window.location.origin,
    () => "",
  );
}
