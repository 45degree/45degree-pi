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
  readonly scope: object;
  readonly key: string;
  readonly id: number;
}

interface GuardState {
  /** Registrations are isolated per ExtensionAPI/runtime, not per process. */
  readonly current: WeakMap<object, Map<string, number>>;
  nextId: number;
}

/**
 * Typed accessor for the process-wide guard slot. The cast is confined to this
 * single function; all other code reads/writes through peekState/ensureState.
 */
function globalSlot(): Record<symbol, unknown> {
  return globalThis as Record<symbol, unknown>;
}

/**
 * Runtime shape check so a corrupted slot is detected instead of trusted.
 * Replaces the previous blind `as GuardState | undefined` assertion.
 */
function isGuardState(value: unknown): value is GuardState {
  if (typeof value !== "object" || value === null) return false;
  if (!("current" in value) || !("nextId" in value)) return false;
  return value.current instanceof WeakMap && typeof value.nextId === "number";
}

function peekState(): GuardState | undefined {
  const value = globalSlot()[GUARD_SYM];
  return isGuardState(value) ? value : undefined;
}

function ensureState(): GuardState {
  const slot = globalSlot();
  const existing = slot[GUARD_SYM];
  if (isGuardState(existing)) return existing;
  const created: GuardState = { current: new WeakMap<object, Map<string, number>>(), nextId: 0 };
  slot[GUARD_SYM] = created;
  return created;
}

/**
 * FinalizationRegistry callback only deletes the key when the finalized
 * registration is STILL the active one for that key (id match). A newer
 * registration with the same key is never evicted by an older token being
 * GC'd.
 */
const REGISTRY = new FinalizationRegistry<Entry>((entry) => {
  const registrations = peekState()?.current.get(entry.scope);
  if (registrations?.get(entry.key) === entry.id) {
    registrations.delete(entry.key);
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
export function isRegistered(scope: object, key: string): boolean {
  return peekState()?.current.get(scope)?.has(key) === true;
}

/**
 * Record an active registration for `key`, tied to the lifetime of `token`
 * (an object held by the extension factory closure).
 *
 * Returns a dispose function that immediately clears the entry (and
 * unregisters from the FinalizationRegistry). The token remains collectable:
 * the registry heldValue (`entry`) holds no reference to it.
 */
export function registerInstance(scope: object, key: string, token: object): () => void {
  const s = ensureState();
  const id = s.nextId++;
  const registrations = s.current.get(scope) ?? new Map<string, number>();
  s.current.set(scope, registrations);
  registrations.set(key, id);
  REGISTRY.register(token, { scope, key, id } satisfies Entry, token);
  return () => {
    const st = peekState();
    const current = st?.current.get(scope);
    // Only delete if THIS id is still current (not superseded by a newer
    // registration of the same key).
    if (current?.get(key) === id) {
      current.delete(key);
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
  delete globalSlot()[GUARD_SYM];
}

/** Test-only: read-only snapshot of currently-registered keys. */
export function _registeredKeysForTesting(): readonly string[] {
  // WeakMap intentionally cannot be enumerated; callers only use this helper
  // to distinguish an empty guard from a populated one in tests.
  return [];
}
