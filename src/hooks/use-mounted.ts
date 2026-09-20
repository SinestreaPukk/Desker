"use client";

import * as React from "react";

const noopSubscribe = () => () => {};

/**
 * True once the component is running in the browser.
 *
 * Used for values that only exist client-side (the resolved theme, the page
 * origin). `useSyncExternalStore` is the hydration-safe way to express this -
 * it renders the server snapshot on the server and the client snapshot after
 * hydration, without a setState-in-effect round trip.
 */
export function useMounted(): boolean {
  return React.useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

/** The browser's origin, or an empty string during server rendering. */
export function useOrigin(): string {
  return React.useSyncExternalStore(
    noopSubscribe,
    () => window.location.origin,
    () => "",
  );
}
