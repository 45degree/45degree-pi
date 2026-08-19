// Option resolution for the omniroute extension.
//
// Pure parsing/normalization only (no I/O beyond reading the config file):
// OpenCode passed options as a plugin tuple element; pi extensions have no
// options parameter, so configuration comes from a JSON file next to the
// extension's runtime state (`<agentDir>/omniroute.json`) plus an environment
// fallback. Everything else mirrors the OpenCode plugin's resolution
// semantics, including the three-tier baseURL strategy and silent-disable
// behavior:
//
//   1. Explicit direct `baseURL` in the config file, or a strict
//      `{env:VAR_NAME}` placeholder whose variable IS set - validated strictly
//      (throws on an invalid URL, a non-http(s) scheme, or a non-strict
//      placeholder form).
//   2. `process.env.OMNIROUTE_BASE_URL`, when it holds a valid http(s) URL -
//      merged on top of any other config-file options and treated EXACTLY like
//      an explicit direct `baseURL`.
//   3. null (silent disable) when none of the above yields a usable address -
//      the extension registers nothing and pi starts normally.

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

/** Identifier rules: lowercase ASCII alphanumerics and hyphens, anchored. */
const PROVIDER_ID_RE = /^[a-z0-9][a-z0-9-]*$/;

/**
 * Strict env-placeholder: exactly `{env:VAR_NAME}` where VAR_NAME matches
 * `[A-Z][A-Z0-9_]*`. Any deviation (lowercase, spaces, empty name, surrounding
 * whitespace, extra text) must NOT be treated as a placeholder and instead
 * falls through to ordinary URL parsing.
 */
const ENV_PLACEHOLDER_RE = /^\{env:([A-Z][A-Z0-9_]*)\}$/;

/** Default provider id (also the config key in auth.json / models-store). */
export const DEFAULT_PROVIDER_ID = "omniroute";
/** Default human-friendly display name used in provider UI + login prompt. */
export const DEFAULT_DISPLAY_NAME = "OmniRoute";

/**
 * Environment variable consulted as a LAST-RESORT fallback when no explicit
 * `baseURL` is usable (no direct URL, no resolved strict placeholder). Reading
 * the gateway address from the env keeps it out of the config file (and git)
 * while guaranteeing a missing address never breaks pi startup.
 *
 * The value is a gateway address, NOT a credential; API keys flow through
 * pi's native `/login` flow and are never read here.
 */
export const ENV_FALLBACK_VAR = "OMNIROUTE_BASE_URL";

/**
 * Everything the extension needs, precomputed once per load. Kept minimal:
 * only the provider id, display name, and gateway OpenAI root.
 */
export interface ResolvedOptions {
  /** Provider id used everywhere (registry key, auth, model provider). */
  readonly providerId: string;
  /** Display name for the provider block + login prompt. */
  readonly displayName: string;
  /** Normalized gateway base (origin + pathname, no trailing slash). */
  readonly baseURL: string;
  /** `${baseURL}/v1` - the OpenAI-compatible API root. */
  readonly v1URL: string;
  /** `${baseURL}/v1/models` - fetched by the refresh pipeline (catalog.ts). */
  readonly modelsURL: string;
  /**
   * Model-id provider prefixes to exclude from the compiled model list. A
   * model is dropped when its trimmed id equals a prefix OR starts with
   * `prefix + "/"`. Trimmed, non-blank, deduped. Empty array = no filtering.
   */
  readonly excludeProviders: readonly string[];
  /**
   * Gateway `owned_by` labels to exclude from the compiled model list. A
   * model is dropped when its normalized `ownedBy` exactly equals a label.
   * Trimmed, non-blank, deduped. Combined with {@link excludeProviders} as
   * OR: a model is excluded when EITHER rule fires.
   */
  readonly excludeOwnedBy: readonly string[];
}

// ---------------------------------------------------------------------------
// Agent directory + config file.
// ---------------------------------------------------------------------------

/** Expand a leading `~` in a directory path (mirrors pi's expandTildePath). */
function expandTilde(p: string): string {
  if (p === "~") return homedir();
  if (p.startsWith("~/")) return join(homedir(), p.slice(2));
  return p;
}

/**
 * pi's agent config directory: honors `PI_CODING_AGENT_DIR` (the same env
 * override pi itself uses), otherwise `~/.pi/agent`. Never throws.
 */
export function agentDir(): string {
  const envDir = process.env.PI_CODING_AGENT_DIR;
  if (typeof envDir === "string" && envDir.trim() !== "") {
    return expandTilde(envDir.trim());
  }
  return join(homedir(), ".pi", "agent");
}

/** Path to the omniroute config file. */
export function configPath(): string {
  return join(agentDir(), "omniroute.json");
}

/**
 * Read + parse the config file. Returns `{}` when the file is absent.
 * THROWS (naming only the path, never any parsed value) on malformed JSON so
 * a broken config file surfaces instead of silently disabling the extension.
 */
export function readOmnirouteConfig(path: string = configPath()): Record<string, unknown> {
  if (!existsSync(path)) return {};
  let text: string;
  try {
    text = readFileSync(path, "utf8");
  } catch {
    return {}; // unreadable (permissions, ...) -> treat as absent
  }
  const trimmed = text.trim();
  if (trimmed === "") return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    throw new Error(`omniroute: config file is not valid JSON: ${path}`);
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`omniroute: config file must contain a JSON object: ${path}`);
  }
  return parsed as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Option validation + normalization (pure).
// ---------------------------------------------------------------------------

/**
 * Validate + normalize the raw config record.
 *
 * `baseURL` is REQUIRED and never guessed: a missing/blank value throws so
 * the misconfiguration surfaces instead of silently talking to a random
 * gateway. The value is reduced to origin + pathname (query/hash dropped,
 * trailing slashes collapsed) so downstream URL concatenation is predictable.
 *
 * `baseURL` may alternatively be a strict placeholder `{env:VAR_NAME}`; in
 * that case the literal URL is read from `process.env[VAR_NAME]` so the real
 * gateway address can stay out of the config file (and thus out of git). A
 * missing or blank env value produces an error that names only the variable,
 * never any resolved value. Non-strict forms (e.g. `{env:lower}`,
 * `{env: FOO}`) are NOT special-cased and are handed to URL parsing, which
 * will reject them.
 */
export function resolveOptions(
  raw: Record<string, unknown> | undefined,
  env: Record<string, string | undefined> = process.env,
): ResolvedOptions {
  const opts = raw ?? {};
  const rawBase = opts["baseURL"];

  if (typeof rawBase !== "string" || rawBase.trim() === "") {
    throw new Error(
      'omniroute: the "baseURL" option is required (no default gateway is assumed).',
    );
  }

  // Resolve a strict {env:VAR_NAME} placeholder to its literal value before
  // URL parsing. Direct URLs and non-strict {env:...} forms pass through
  // unchanged and are validated as URLs below.
  const literalBase = resolveEnvPlaceholder(rawBase, env);

  let url: URL;
  try {
    url = new URL(literalBase.trim());
  } catch {
    // Intentionally do NOT echo the value: it may carry credentials or a real
    // gateway address the user did not want to surface.
    throw new Error('omniroute: "baseURL" is not a valid URL.');
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error(
      `omniroute: "baseURL" must use http or https, got ${url.protocol}`,
    );
  }

  const baseOrigin = url.origin;
  // Collapse trailing slashes so root becomes "" and "/api/" becomes "/api".
  const basePath = url.pathname.replace(/\/+$/, "");
  const baseURL = baseOrigin + basePath;

  return {
    providerId: resolveProviderId(opts["providerId"]),
    displayName: resolveDisplayName(opts["name"]),
    baseURL,
    v1URL: baseURL + "/v1",
    modelsURL: baseURL + "/v1/models",
    excludeProviders: resolveStringList(opts["excludeProviders"]),
    excludeOwnedBy: resolveStringList(opts["excludeOwnedBy"]),
  };
}

/**
 * Read and validate `env[OMNIROUTE_BASE_URL]`.
 *
 * Returns the trimmed value only when it parses as an http(s) URL; otherwise
 * returns undefined (treated as "no fallback available" -> silent disable).
 * Never throws. An invalid-but-present value is intentionally treated as "no
 * fallback" rather than throwing, so a malformed env entry can never break pi
 * startup.
 */
export function readEnvBaseURL(
  env: Record<string, string | undefined> = process.env,
): string | undefined {
  const raw = env[ENV_FALLBACK_VAR];
  if (typeof raw !== "string" || raw.trim() === "") return undefined;
  const trimmed = raw.trim();
  try {
    const url = new URL(trimmed);
    if (url.protocol !== "http:" && url.protocol !== "https:") return undefined;
  } catch {
    return undefined;
  }
  return trimmed;
}

/**
 * Resolve options with the three-tier `baseURL` strategy, returning null when
 * the extension should silently disable itself (instead of throwing) so a
 * missing gateway address never breaks pi startup.
 *
 * Priority:
 *   1. Explicit direct `baseURL` in the config file, or a strict `{env:VAR}`
 *      placeholder whose variable IS set - validated strictly by
 *      `resolveOptions` (throws on an invalid URL, a non-http(s) scheme, or a
 *      non-strict placeholder form). This preserves eager fail-fast for
 *      genuinely misconfigured direct URLs.
 *   2. `env[OMNIROUTE_BASE_URL]`, when it holds a valid http(s) URL - merged
 *      on top of any other config-file options (providerId, name, excludes)
 *      and then treated EXACTLY like an explicit direct `baseURL`.
 *   3. null (silent disable) when none of the above yield a usable address.
 *
 * Non-strict placeholder forms (e.g. `{env:lower}`) and invalid direct URLs
 * still take the eager-throw path at tier 1; the fallback only engages when
 * the explicit `baseURL` is absent, blank, or a strict placeholder whose
 * variable is unset/blank.
 */
export function resolveWithFallback(
  raw: Record<string, unknown> | undefined,
  env: Record<string, string | undefined> = process.env,
): ResolvedOptions | null {
  const rawBase = raw?.["baseURL"];
  const isBlank = typeof rawBase !== "string" || rawBase.trim() === "";
  if (!isBlank && !isUnsetEnvPlaceholder(rawBase, env)) {
    return resolveOptions(raw, env);
  }
  const envBase = readEnvBaseURL(env);
  if (envBase !== undefined) {
    const merged: Record<string, unknown> = { ...(raw ?? {}), baseURL: envBase };
    return resolveOptions(merged, env);
  }
  return null;
}

/**
 * Detect the single condition under which the extension should silently
 * disable itself: `raw` is a strict `{env:VAR_NAME}` placeholder AND the
 * referenced environment variable is unset or blank.
 *
 * Returns false for every other case, so direct URLs, non-strict placeholder
 * forms (lowercase name, spaces, empty name, extra text), and a strict
 * placeholder whose env var IS set all fall through to the normal
 * eager-validation path in `resolveOptions`. Never throws, never guesses an
 * address.
 */
export function isUnsetEnvPlaceholder(
  raw: unknown,
  env: Record<string, string | undefined> = process.env,
): boolean {
  if (typeof raw !== "string") return false;
  const match = ENV_PLACEHOLDER_RE.exec(raw);
  if (match === null) return false;
  const varName = match[1] as string;
  const value = env[varName];
  return typeof value !== "string" || value.trim() === "";
}

/**
 * If `raw` is a strict `{env:VAR_NAME}` placeholder, return the literal value
 * read from `env[VAR_NAME]`. Any other string is returned unchanged so it is
 * handled as a direct URL by the caller.
 *
 * Throws a non-leaky error when the placeholder matches but the env variable
 * is unset or blank: the message names only the variable, never the resolved
 * value, any neighbor env entry, or the original placeholder text.
 */
function resolveEnvPlaceholder(
  raw: string,
  env: Record<string, string | undefined>,
): string {
  const match = ENV_PLACEHOLDER_RE.exec(raw);
  if (match === null) return raw;
  const varName = match[1] as string;
  const value = env[varName];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(
      `omniroute: environment variable "${varName}" referenced by "baseURL" is not set or empty.`,
    );
  }
  return value;
}

/** Coerce the optional providerId into a safe identifier (default fallback). */
function resolveProviderId(value: unknown): string {
  if (typeof value !== "string" || value.trim() === "") return DEFAULT_PROVIDER_ID;
  const id = value.trim();
  if (!PROVIDER_ID_RE.test(id)) {
    throw new Error(
      `omniroute: invalid "providerId" (${id}); use lowercase alphanumerics and hyphens only.`,
    );
  }
  return id;
}

/** Coerce the optional display name (default fallback). */
function resolveDisplayName(value: unknown): string {
  if (typeof value !== "string" || value.trim() === "") return DEFAULT_DISPLAY_NAME;
  return value.trim();
}

/**
 * Normalize an optional string-array option (`excludeProviders` or
 * `excludeOwnedBy`) into a deduped list of trimmed, non-blank strings. Non-array
 * values and non-string / blank entries are silently ignored, so a malformed
 * option never breaks startup. The semantics of each list (id-prefix match vs
 * owned_by exact match) are applied at compile time (see catalog.ts).
 */
function resolveStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const name = item.trim();
    if (name === "") continue;
    if (seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }
  return out;
}
