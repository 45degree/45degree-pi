// Model catalog compilation for the omniroute provider.
//
// The single refresh pipeline fetches the gateway's OpenAI-compatible
// `/v1/models` list, normalizes each entry, applies exclusion (drop entries by
// model-id provider prefix OR by `owned_by` exact match), parent-driven dedupe
// + intensity-suffix collapse, and compiles a final `Model<"openai-completions">[]`
// list that pi persists transactionally via the provider's `fetchModels`
// callback (createProvider restore + publish owns the on-disk cache in
// models-store.json - this module does NOT manage any cache itself).
//
// Ported from the OpenCode omniroute plugin's catalog pipeline; the output
// shape is adapted from OpenCode's StaticModelConfigMap to pi's Model list.

import type { Model, OpenAICompletionsCompat, RefreshModelsContext } from "@earendil-works/pi-ai";
import { VERSION as PI_VERSION } from "@earendil-works/pi-coding-agent";
import { dedupeModels } from "./dedupe";

/** Conservative defaults: modest context/output, zero cost, text-only. */
const DEFAULT_CONTEXT = 128_000;
const DEFAULT_OUTPUT = 8_192;

/** Default fetch timeout: 15 seconds. Combined with the refresh signal. */
export const FETCH_TIMEOUT_MS = 15_000;

/**
 * Compat flags pinning the chat-request shape to what the OpenCode omniroute
 * setup sends (Vercel AI SDK's `openai-compatible` provider, which this style
 * of gateway accepts). pi's auto-detection assumes a real OpenAI endpoint for
 * unknown URLs and emits `developer` role, `max_completion_tokens`,
 * `store: false`, and `strict` on tools - fields that many OpenAI-compatible
 * gateways reject outright (observed as HTTP 403 "request was blocked").
 *
 * Mirrored behavior:
 *   - system prompt as `system` role (not `developer`)
 *   - `max_tokens` (not `max_completion_tokens`)
 *   - no `store` field
 *   - no `strict` field on tool definitions
 *
 * `reasoning_effort` stays enabled: OpenCode sends it for effort variants and
 * the gateway advertises `effort_tiers`, so it is part of the accepted shape.
 */
export const CHAT_COMPAT: OpenAICompletionsCompat = {
  supportsDeveloperRole: false,
  supportsStore: false,
  maxTokensField: "max_tokens",
  supportsStrictMode: false,
};

/**
 * The User-Agent sent with chat requests: `pi/<version>`. pi's underlying
 * OpenAI SDK sends `User-Agent: OpenAI/JS x.y.z`, which OmniRoute-style
 * gateways block outright (observed as HTTP 403 "Your request was blocked"
 * while the same body with any other UA succeeds). Overriding the UA through
 * the SDK's defaultHeaders (where `model.headers` land) restores the accepted
 * shape: the UA identifies the actual client tool (pi), mirroring how
 * OpenCode reaches these gateways with a bare-fetch `node` UA.
 *
 * If VERSION is unavailable in some runtime, the UA degrades to `pi/unknown`,
 * which is still accepted (only the OpenAI/JS prefix is blocked).
 */
export function chatUserAgent(): string {
  return `pi/${typeof PI_VERSION === "string" && PI_VERSION !== "" ? PI_VERSION : "unknown"}`;
}

/** Per-model request headers carrying the UA override. */
export function chatHeaders(): Record<string, string> {
  return { "User-Agent": chatUserAgent() };
}

// ---------------------------------------------------------------------------
// RawModel extraction + normalization (gateway response -> RawModel).
// ---------------------------------------------------------------------------

/**
 * What we consume from a `/v1/models` entry. All optional fields fall back to
 * conservative defaults when the gateway omits them, so a sparse entry still
 * yields a usable model. Limits come from `max_input_tokens` / `max_output
 * _tokens`; capability flags from `capabilities.{vision,tool_calling,reasoning}`.
 */
export interface RawModel {
  readonly id: string;
  readonly name?: string;
  /** Gateway owner/provider label, from `owned_by`. */
  readonly ownedBy?: string;
  /** Context window, from `max_input_tokens`. */
  readonly context?: number;
  /** Max output tokens, from `max_output_tokens`. */
  readonly output?: number;
  readonly vision?: boolean;
  readonly toolcall?: boolean;
  readonly reasoning?: boolean;
  /**
   * Reasoning effort tiers the gateway exposes for this model, from
   * `capabilities.effort_tiers` (e.g. ["low","medium","high","xhigh","max",
   * "ultra"]). Each tier becomes a pi thinking level carrying the tier name
   * (see {@link buildThinkingLevelMap}).
   */
  readonly effortTiers?: readonly string[];
  /**
   * Canonical model id this entry is an alias of, from the gateway `parent`
   * field. Non-empty string when the gateway marks this entry as an alias;
   * undefined when the entry is canonical (or the gateway omits the field).
   * Used by parent-driven dedup (see dedupe.ts).
   */
  readonly parent?: string;
}

/** Coerce a positive finite number, else undefined. */
function asNum(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? v : undefined;
}

/** Coerce a boolean, else undefined. */
function asBool(v: unknown): boolean | undefined {
  return typeof v === "boolean" ? v : undefined;
}

/**
 * Coerce a non-empty array of non-empty strings, else undefined. Whitespace is
 * trimmed; empty strings are dropped. Returns undefined for an empty result so
 * absent / malformed payloads do not produce an empty-tier thinking map.
 */
function asStrArray(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: string[] = [];
  for (const item of v) {
    if (typeof item === "string" && item.trim() !== "") out.push(item.trim());
  }
  return out.length > 0 ? out : undefined;
}

/**
 * Normalize one raw `/v1/models` entry into a RawModel.
 * Returns null for non-conforming entries. Never throws.
 */
function normalizeRawEntry(entry: unknown): RawModel | null {
  if (entry === null || typeof entry !== "object") return null;
  const e = entry as Record<string, unknown>;
  if (typeof e.id !== "string") return null;
  const caps = e.capabilities as Record<string, unknown> | undefined;
  return {
    id: e.id,
    name: typeof e.name === "string" ? e.name : undefined,
    ownedBy: typeof e.owned_by === "string" && e.owned_by.trim() !== "" ? e.owned_by.trim() : undefined,
    context: asNum(e.context) ?? asNum(e.max_input_tokens),
    output: asNum(e.output) ?? asNum(e.max_output_tokens),
    vision: asBool(e.vision) ?? asBool(caps?.vision),
    toolcall: asBool(e.toolcall) ?? asBool(caps?.tool_calling),
    reasoning: asBool(e.reasoning) ?? asBool(caps?.reasoning),
    effortTiers: asStrArray(e.effortTiers) ?? asStrArray(caps?.effort_tiers),
    parent: typeof e.parent === "string" && e.parent !== "" ? e.parent : undefined,
  };
}

/**
 * Pull the model list out of a `/v1/models` response.
 *
 * Accepts either a raw array or the OpenAI-style `{ data: [...] }` envelope.
 * Non-conforming payloads yield an empty array rather than throwing.
 */
export function extractModels(data: unknown): RawModel[] {
  const rows = asArray(data) ?? asArray((data as { data?: unknown })?.data);
  if (rows === undefined) return [];
  const out: RawModel[] = [];
  for (const row of rows) {
    if (row === null || typeof row !== "object") continue;
    const m = normalizeRawEntry(row);
    if (m !== null) out.push(m);
  }
  return out;
}

function asArray(v: unknown): unknown[] | undefined {
  return Array.isArray(v) ? v : undefined;
}

// ---------------------------------------------------------------------------
// Thinking-level mapping (gateway effort tiers -> pi thinkingLevelMap).
// ---------------------------------------------------------------------------

/**
 * pi reasoning-effort levels (excluding "off") in ascending intensity order.
 * `xhigh` and `max` are opt-in in pi: they require an explicit non-null
 * thinkingLevelMap entry to be selectable.
 */
const PI_EFFORT_LEVELS = ["minimal", "low", "medium", "high", "xhigh", "max"] as const;

/**
 * Canonical intensity rank for gateway tier names, used to assign leftover
 * tiers (names pi does not use, e.g. "ultra") to the highest remaining pi
 * level. Unknown names rank after every known one (stable, lexicographic).
 */
const TIER_ORDER = ["minimal", "low", "medium", "high", "xhigh", "max", "ultra"];

function tierRank(tier: string): number {
  const idx = TIER_ORDER.indexOf(tier.toLowerCase());
  return idx === -1 ? TIER_ORDER.length : idx;
}

/**
 * Map gateway effort tiers onto a pi `thinkingLevelMap`:
 *
 *  - Direct name matches first: a gateway tier named exactly like a pi level
 *    (`low`/`medium`/`high`/`xhigh`/`max`/`minimal`) maps that level to itself.
 *  - Leftover tiers (pi has no such level name, e.g. `ultra`) are assigned to
 *    the highest unmatched pi levels by intensity rank (`ultra` -> `max`).
 *  - Every pi level with no tier gets `null` (hidden), so only gateway-declared
 *    efforts are selectable - mirroring the OpenCode plugin's variant model.
 *  - `off` is intentionally OMITTED: it stays selectable and means "send no
 *    reasoning_effort", letting the gateway apply its own default effort
 *    (the equivalent of picking the base model in the OpenCode variant list).
 *
 * Returns undefined when `tiers` is empty (flat / non-reasoning models stay
 * variant-free and use pi defaults). Pure; never throws.
 */
export function buildThinkingLevelMap(
  tiers: readonly string[] | undefined,
): Partial<Record<string, string | null>> | undefined {
  if (tiers === undefined || tiers.length === 0) return undefined;

  // Dedupe tiers while preserving gateway order.
  const tierSet = new Set<string>(tiers);

  const map: Partial<Record<string, string | null>> = {};
  const matchedLevels = new Set<string>();

  // Stage 1: direct name matches.
  for (const level of PI_EFFORT_LEVELS) {
    if (tierSet.has(level)) {
      map[level] = level;
      matchedLevels.add(level);
    }
  }

  // Stage 2: leftover tiers (highest first) -> highest unmatched pi levels.
  const piLevelNames: readonly string[] = PI_EFFORT_LEVELS;
  const leftover = Array.from(tierSet)
    .filter((tier) => !piLevelNames.includes(tier))
    .sort((a, b) => tierRank(b) - tierRank(a));
  const unmatched = PI_EFFORT_LEVELS.filter((level) => !matchedLevels.has(level));
  while (leftover.length > 0 && unmatched.length > 0) {
    const piLevel = unmatched.pop() as string; // take from the top (max first)
    map[piLevel] = leftover.shift() as string;
  }

  // Stage 3: remaining pi levels are hidden (gateway does not offer them).
  for (const level of unmatched) map[level] = null;

  return map;
}

// ---------------------------------------------------------------------------
// Model construction.
// ---------------------------------------------------------------------------

export interface BuildModelOpts {
  readonly providerId: string;
  /** OpenAI-compatible API root, e.g. "https://gw.example.com/v1". */
  readonly v1URL: string;
}

/**
 * Build a single pi `Model<"openai-completions">` from a raw gateway entry,
 * honoring the limits + capability flags the gateway reports and falling back
 * to conservative defaults when absent.
 *
 * - Display name: `name (owned_by)`, falling back to `name` / `id`.
 * - Vision drives image input; output stays text-only.
 * - `reasoning` + `effortTiers` drive the thinkingLevelMap (see
 *   {@link buildThinkingLevelMap}); tiers on a non-reasoning model are ignored.
 * - Cost is zero: the gateway is a router and per-model pricing is unknown.
 * - `compat` is pinned to {@link CHAT_COMPAT} and `headers` to
 *   {@link chatHeaders} (`User-Agent: pi/<version>`) so the chat request
 *   mirrors the OpenCode shape regardless of baseUrl auto-detection.
 */
export function buildModel(raw: RawModel, opts: BuildModelOpts): Model<"openai-completions"> {
  const vision = raw.vision === true;
  const baseName = typeof raw.name === "string" && raw.name.trim() !== "" ? raw.name.trim() : raw.id;
  const name = raw.ownedBy === undefined ? baseName : `${baseName} (${raw.ownedBy})`;
  const reasoning = raw.reasoning === true;
  const model: Model<"openai-completions"> = {
    id: raw.id,
    name,
    api: "openai-completions",
    provider: opts.providerId,
    baseUrl: opts.v1URL,
    reasoning,
    input: vision ? ["text", "image"] : ["text"],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: raw.context ?? DEFAULT_CONTEXT,
    maxTokens: raw.output ?? DEFAULT_OUTPUT,
    compat: CHAT_COMPAT,
    headers: chatHeaders(),
  };
  if (reasoning) {
    const thinkingLevelMap = buildThinkingLevelMap(raw.effortTiers);
    if (thinkingLevelMap !== undefined) model.thinkingLevelMap = thinkingLevelMap;
  }
  return model;
}

// ---------------------------------------------------------------------------
// Single refresh compile pipeline.
// ---------------------------------------------------------------------------

/**
 * Compile a final model list from raw gateway models.
 *
 * Pipeline (order matters):
 *   1. Copy + trim `id` and `parent`, drop empty id. First occurrence of a
 *      normalized id wins (metadata first-wins policy).
 *   2. Exclusion (OR of two rules, applied BEFORE dedupe/build so the
 *      persisted catalog naturally reflects it):
 *      - `excludeProviders`: drop when the trimmed id equals a prefix OR
 *        starts with `prefix + "/"` (model-id provider prefix match).
 *      - `excludeOwnedBy`: drop when the normalized `ownedBy` exactly equals a
 *        label (gateway `owned_by` exact match).
 *   3. parent-driven dedupe.
 *   4. intensity-suffix collapse.
 *   5. build one Model per surviving entry, preserving gateway order.
 *
 * Pure; never throws.
 */
export function compileModels(
  rawModels: ReadonlyArray<RawModel>,
  opts: BuildModelOpts,
  excludeProviders: readonly string[] = [],
  excludeOwnedBy: readonly string[] = [],
): Model<"openai-completions">[] {
  // Stage 1: copy + trim id & parent, drop empty id. First normalized id wins.
  const seen = new Set<string>();
  const normalized: RawModel[] = [];
  for (const raw of rawModels) {
    if (!raw || typeof raw.id !== "string") continue;
    const id = raw.id.trim();
    if (id === "") continue;
    if (seen.has(id)) continue; // first occurrence wins
    seen.add(id);
    const parentRaw = typeof raw.parent === "string" ? raw.parent.trim() : undefined;
    normalized.push({
      ...raw,
      id,
      parent: parentRaw !== undefined && parentRaw !== "" ? parentRaw : undefined,
    });
  }
  // Stage 2: exclusion (OR of id-prefix and owned_by exact). Skip the filter
  // pass entirely when both lists are empty so the common no-filter path stays
  // allocation-free.
  const hasExclude = excludeProviders.length > 0 || excludeOwnedBy.length > 0;
  const excluded = hasExclude
    ? normalized.filter((raw) => !isExcluded(raw, excludeProviders, excludeOwnedBy))
    : normalized;
  // Stage 3+4: parent dedupe -> suffix collapse.
  const deduped = dedupeModels(excluded);
  // Stage 5: build, skipping any id that somehow repeats after dedupe.
  const built: Model<"openai-completions">[] = [];
  const emitted = new Set<string>();
  for (const raw of deduped) {
    if (!raw || typeof raw.id !== "string") continue;
    const id = raw.id.trim();
    if (id === "" || emitted.has(id)) continue;
    emitted.add(id);
    built.push(buildModel(raw, opts));
  }
  return built;
}

/**
 * OR exclusion test for a single normalized entry. Returns true when EITHER:
 *  - the id equals a prefix OR starts with `prefix + "/"` (id-prefix match), or
 *  - the `ownedBy` exactly equals an owned_by label.
 * Both lists are already trimmed/deduped at resolve time; `id` is already
 * trimmed at normalize time. Case-sensitive. An undefined `ownedBy` never
 * triggers the owned_by rule.
 */
function isExcluded(
  raw: RawModel,
  excludeProviders: readonly string[],
  excludeOwnedBy: readonly string[],
): boolean {
  const id = raw.id;
  for (const prefix of excludeProviders) {
    if (id === prefix || id.startsWith(prefix + "/")) return true;
  }
  const ownedBy = raw.ownedBy;
  if (ownedBy !== undefined) {
    for (const label of excludeOwnedBy) {
      if (label === ownedBy) return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Network fetch (called by the provider's fetchModels callback).
// ---------------------------------------------------------------------------

/**
 * GET `${modelsURL}` with a Bearer header and return the parsed JSON. Throws
 * on !ok, timeout, or abort. The caller combines pi's refresh `signal` with a
 * 15s timeout so model refresh stays abortable and bounded.
 */
export async function fetchJson(
  url: string,
  apiKey: string,
  signal: AbortSignal | undefined,
  timeoutMs: number = FETCH_TIMEOUT_MS,
): Promise<unknown> {
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const combined = signal === undefined ? timeoutSignal : AbortSignal.any([signal, timeoutSignal]);
  const res = await globalThis.fetch(url, {
    method: "GET",
    headers: {
      authorization: "Bearer " + apiKey,
      accept: "application/json",
    },
    signal: combined,
  });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.json();
}

/**
 * The single refresh pipeline used by the provider's `fetchModels` callback:
 * GET /v1/models -> extract/normalize -> ID normalization -> exclusion
 * (id-prefix OR owned_by exact) -> parent dedupe -> intensity collapse ->
 * build final Model list -> validate non-empty.
 *
 * THROWS on any failure (network error, non-2xx, malformed payload, empty
 * compiled list). Throwing is deliberate: pi's createProvider wrapper keeps
 * the previously restored catalog when fetchModels throws, so a transient
 * gateway error never blanks the model list.
 */
export async function fetchGatewayModels(
  modelsURL: string,
  apiKey: string,
  opts: BuildModelOpts,
  excludeProviders: readonly string[] = [],
  excludeOwnedBy: readonly string[] = [],
  signal: AbortSignal | undefined = undefined,
  timeoutMs: number = FETCH_TIMEOUT_MS,
): Promise<Model<"openai-completions">[]> {
  const data = await fetchJson(modelsURL, apiKey, signal, timeoutMs);
  const rawModels = extractModels(data);
  if (rawModels.length === 0) {
    throw new Error("omniroute: /v1/models returned no usable entries");
  }
  const compiled = compileModels(rawModels, opts, excludeProviders, excludeOwnedBy);
  if (compiled.length === 0) {
    throw new Error("omniroute: model list compiled to empty after exclusion/dedupe");
  }
  return compiled;
}

/**
 * The persisted catalog snapshot for this provider, filtered out of the
 * shared models-store entry. Used as the no-credential fallback so a missing
 * key never wipes the previously discovered list.
 */
export function storedModelsFor(
  context: Pick<RefreshModelsContext, "stored">,
  providerId: string,
): Model<"openai-completions">[] {
  const stored = context.stored;
  if (stored === undefined) return [];
  return stored.models.filter(
    (model): model is Model<"openai-completions"> =>
      model.provider === providerId && model.api === "openai-completions",
  );
}
