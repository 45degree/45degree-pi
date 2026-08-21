// omniroute - pi extension for an OmniRoute-style, OpenAI-compatible gateway.
//
// Registers ONE provider through pi's native extension provider API,
// pi.registerProvider(id, config), tagged with the `openai-completions`
// API so streaming goes through pi-ai's lazy compat registry:
//
//   - provider registration ........ pi.registerProvider(id, {...})
//   - masked API-key login ......... pi's built-in api_key auth: /login shows
//                                    a `secret` prompt and persists it in
//                                    ~/.pi/agent/auth.json
//   - Bearer injection + prefix .... the openai-completions stream applies the
//                                    resolved key as the Bearer credential
//   - model catalog persistence .... refreshModels publishes fetched lists
//                                    transactionally via context.publish, so
//                                    offline starts restore them from
//                                    models-store.json
//   - refresh scheduling ........... pi calls refreshModels during model
//                                    refresh (startup, /model picker, etc.)
//                                    and skips network work when no credential
//                                    is stored
//
// What this extension actually owns:
//   - options.ts ... three-tier baseURL resolution + silent disable
//   - catalog.ts ... the /v1/models -> Model[] compile pipeline
//                    (normalize, exclude, parent dedupe, intensity collapse,
//                    thinking-level mapping)
//   - guard.ts ..... per-runtime dedup so a double module load never
//                    registers the provider twice
//
// No console logging, no timers, no background tasks, no custom commands:
// model refresh happens exclusively through pi's native model-refresh flow.

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { fetchGatewayModels, storedModelsFor } from "./catalog";
import { isRegistered, makeGuardKey, registerInstance } from "./guard";
import { readOmnirouteConfig, resolveWithFallback } from "./options";

export default function (pi: ExtensionAPI): void {
  // Three-tier resolution: config file baseURL / strict {env:VAR} placeholder /
  // OMNIROUTE_BASE_URL env fallback. null = silent disable (register nothing).
  // A malformed config file (invalid JSON / invalid explicit URL) throws here
  // and surfaces as an extension load error rather than being swallowed.
  const resolved = resolveWithFallback(readOmnirouteConfig());
  if (resolved === null) return;

  // Per-runtime dedup: a second module load with the same (providerId,
  // baseURL) registers nothing. The FinalizationRegistry in guard.ts clears
  // the entry when pi drops this factory's token (reload / rebind).
  const guardKey = makeGuardKey(resolved.providerId, resolved.baseURL);
  if (isRegistered(pi, guardKey)) return;
  const guardToken = { guard: true };
  registerInstance(pi, guardKey, guardToken);

  // Registering during the extension factory queues the provider so it is
  // available during interactive startup and to `pi --list-models`.
  pi.registerProvider(resolved.providerId, {
    name: resolved.displayName,
    baseUrl: resolved.v1URL,
    // Native openai-completions streams (Bearer auth, /chat/completions) are
    // resolved lazily by pi-ai's compat registry from this API tag.
    api: "openai-completions",
    // OmniRoute's WAF blocks the OpenAI SDK's default User-Agent. Provider
    // headers override SDK defaults while leaving Pi's native stream intact.
    headers: { "User-Agent": "pi" },
    // No `apiKey` and no static `models`: the provider is purely dynamic and
    // stays unconfigured (its models hidden) until the user completes pi's
    // masked /login secret prompt for this provider.
    async refreshModels(context) {
      const key =
        context.credential?.type === "api_key"
          ? context.credential.key
          : undefined;
      // No usable credential: keep the persisted catalog untouched (pi's
      // refresh loop skips the network phase entirely when auth resolution
      // yields nothing, so this is only a defensive fallback).
      if (key === undefined || key === "") {
        return storedModelsFor(context, resolved.providerId);
      }
      // THROWS on failure (network error, empty/malformed list) so pi keeps
      // the previously restored catalog instead of publishing a blank one.
      const models = await fetchGatewayModels(
        resolved.modelsURL,
        key,
        { providerId: resolved.providerId, v1URL: resolved.v1URL },
        resolved.excludeProviders,
        undefined,
        context.signal,
      );
      // Persist transactionally (generation-checked) so offline starts can
      // restore the catalog from models-store.json.
      await context.publish({ persist: { models, checkedAt: Date.now() } });
      return models;
    },
  });
}
