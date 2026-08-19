// Per-runtime instance guard: ensures the omniroute extension registers its
// provider at most once per (providerId, baseURL) pair, even when pi loads the
// extension module twice in the same JS runtime (e.g. the same directory
// reached via an auto-discovered path AND an explicit settings.json entry with
// a different path spelling / symlink).
//
// State lives on globalThis (keyed by a well-known Symbol.for) so it is shared
// across duplicate module evaluations in the same process; a plain
// module-level variable would NOT be visible to the second module instance.
//
// Self-healing: each registration is tracked by a FinalizationRegistry so the
// guard entry is cleared automatically once pi drops its reference (reload /
// session rebind), WITHOUT depending on any dispose hook. A per-registration
// integer id disambiguates stale finalizations from newer registrations of the
// same key, so a GC of an old token can never evict a newer one.
//
// Adapted from the OpenCode omniroute plugin's guard (pi has no dispose hook;
// FinalizationRegistry covers cleanup on reload).

/** Well-known symbol so duplicate module loads share the same guard state. */
const GUARD_SYM = Symbol.for("omniroute.pi.extension.guard.v1");

/** A single registration: ties a dedup key to a specific registration token. */
interface Entry {
  readonly key: string;
  readonly id: number;
}

interface GuardState {
  /** Map of dedup key -> active registration id. */
  readonly current: Map<string, number>;
  nextId: number;
}

function peekState(): GuardState | undefined {
  return (globalThis as Record<symbol, unknown>)[GUARD_SYM] as GuardState | undefined;
}

function ensureState(): GuardState {
  const g = globalThis as Record<symbol, unknown>;
  let s = g[GUARD_SYM] as GuardState | undefined;
  if (s === undefined) {
    s = { current: new Map<string, number>(), nextId: 0 };
    g[GUARD_SYM] = s;
  }
  return s;
}

/**
 * FinalizationRegistry callback only deletes the key when the finalized
 * registration is STILL the active one for that key (id match). A newer
 * registration with the same key is never evicted by an older token being
 * GC'd.
 */
const REGISTRY = new FinalizationRegistry<Entry>((entry) => {
  const s = peekState();
  if (s !== undefined && s.current.get(entry.key) === entry.id) {
    s.current.delete(entry.key);
  }
});

/**
 * Compose the dedup key from the provider id and the normalized gateway base.
 * A pair is considered "the same instance" only when BOTH match; differing
 * either allows a distinct registration.
 */
export function makeGuardKey(providerId: string, baseURL: string): string {
  // "\0" cannot appear in a URL origin/path or a provider id, so it is a safe
  // separator that resists collision crafting.
  return providerId + "\0" + baseURL;
}

/** True if this (provider, baseURL) pair already has an active registration. */
export function isRegistered(key: string): boolean {
  return peekState()?.current.has(key) === true;
}

/**
 * Record an active registration for `key`, tied to the lifetime of `token`
 * (an object held by the extension factory closure).
 *
 * Returns a dispose function that immediately clears the entry (and
 * unregisters from the FinalizationRegistry). The token remains collectable:
 * the registry heldValue (`entry`) holds no reference to it.
 */
export function registerInstance(key: string, token: object): () => void {
  const s = ensureState();
  const id = s.nextId++;
  s.current.set(key, id);
  REGISTRY.register(token, { key, id } satisfies Entry, token);
  return () => {
    const st = peekState();
    // Only delete if THIS id is still current (not superseded by a newer
    // registration of the same key).
    if (st !== undefined && st.current.get(key) === id) {
      st.current.delete(key);
    }
    try {
      REGISTRY.unregister(token);
    } catch {
      // Already unregistered or never registered; safe to ignore.
    }
  };
}

/** Test-only: deterministically wipe all guard state from this runtime. */
export function _resetGuardForTesting(): void {
  const g = globalThis as Record<symbol, unknown>;
  delete g[GUARD_SYM];
}

/** Test-only: read-only snapshot of currently-registered keys. */
export function _registeredKeysForTesting(): readonly string[] {
  const s = peekState();
  return s === undefined ? [] : Array.from(s.current.keys());
}
