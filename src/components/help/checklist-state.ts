"use client";

/**
 * Whether the setting-up checklist is showing, and whether the owner has
 * tried the flow view yet.
 *
 * Both live in this browser rather than on the record: dismissing a checklist
 * is a preference of the person looking at the screen, not a fact about the
 * organisation, and it must not travel to a colleague who has not seen it.
 * Every read is guarded - a private window, blocked site data or a preview
 * all make localStorage throw, and none of them should break the roster.
 */

const DISMISSED = "desker.checklist.dismissed";
const FLOW_SEEN = "desker.flow-view.seen";

/** Fired whenever any of this changes, so the store hook can re-read it. */
export const CHECKLIST_REOPEN_EVENT = "desker:checklist-changed";

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function write(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* nothing to do: the checklist is a convenience, not a record */
  }
}

export function isChecklistDismissed(): boolean {
  return read(DISMISSED) === "1";
}

export function dismissChecklist(): void {
  write(DISMISSED, "1");
  announce();
}

/** Reopen it - what the help panel's checklist entry does. */
export function showChecklist(): void {
  write(DISMISSED, null);
  announce();
}

function announce(): void {
  try {
    window.dispatchEvent(new CustomEvent(CHECKLIST_REOPEN_EVENT));
  } catch {
    /* no window: nothing is listening either */
  }
}

/**
 * For useSyncExternalStore: localStorage is not reactive, so the writers
 * above announce themselves and this passes that on. The `storage` event
 * covers the same account in a second tab.
 */
export function subscribeChecklist(listener: () => void): () => void {
  window.addEventListener(CHECKLIST_REOPEN_EVENT, listener);
  window.addEventListener("storage", listener);
  return () => {
    window.removeEventListener(CHECKLIST_REOPEN_EVENT, listener);
    window.removeEventListener("storage", listener);
  };
}

export function hasSeenFlowView(): boolean {
  return read(FLOW_SEEN) === "1";
}

export function markFlowViewSeen(): void {
  if (read(FLOW_SEEN) === "1") return;
  write(FLOW_SEEN, "1");
  announce();
}
