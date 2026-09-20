/**
 * Client chat session identity.
 *
 * Clients never sign in, so continuity across reloads rests entirely on this
 * id. It is per-agent so one visitor talking to two agents gets two threads,
 * and it is opaque - it identifies a browser, never a person.
 *
 * Exposed as a subscribable external store rather than component state: the id
 * lives in localStorage, which is outside React, and `useSyncExternalStore` is
 * how a component reads a browser-only value without a hydration mismatch.
 */
const PREFIX = "desker:session:";
/** Pre-rename key. Read once so a client mid-conversation keeps their thread. */
const LEGACY_PREFIX = "roster:session:";

const listeners = new Set<() => void>();

function randomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().replace(/-/g, "");
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 14)}`;
}

/**
 * Cache of the resolved id per agent.
 *
 * `useSyncExternalStore` calls the snapshot on every render and bails out only
 * when the value is referentially equal, so this must not mint a new id (or a
 * new object) per call.
 */
const cache = new Map<string, string>();

export function getClientSessionId(agentId: string): string {
  const cached = cache.get(agentId);
  if (cached) return cached;

  const key = `${PREFIX}${agentId}`;
  let id: string;
  try {
    id = window.localStorage.getItem(key) ?? "";
    if (!id) {
      const legacyKey = `${LEGACY_PREFIX}${agentId}`;
      const legacy = window.localStorage.getItem(legacyKey);
      id = legacy || randomId();
      window.localStorage.setItem(key, id);
      if (legacy) window.localStorage.removeItem(legacyKey);
    }
  } catch {
    // Private browsing or blocked storage: an in-memory id still works, the
    // conversation simply does not survive a reload.
    id = randomId();
  }

  cache.set(agentId, id);
  return id;
}

/** Abandons the current thread and starts a fresh one. */
export function resetClientSession(agentId: string): void {
  try {
    window.localStorage.removeItem(`${PREFIX}${agentId}`);
  } catch {
    // Nothing to clear.
  }
  cache.delete(agentId);
  getClientSessionId(agentId);
  for (const listener of listeners) listener();
}

export function subscribeClientSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Server render has no browser storage, so there is no id yet. */
export function serverSessionSnapshot(): null {
  return null;
}
