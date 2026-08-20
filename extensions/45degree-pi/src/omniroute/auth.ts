// omniroute - pi extension for an OmniRoute-style, OpenAI-compatible gateway.
//
// Registers ONE provider backed by pi's native `openai-completions`
// implementation. Everything the OpenCode plugin had to build by hand is
// native in pi:
//
//   - provider registration ........ pi.registerProvider(createProvider(...))
//   - masked API-key login ......... auth.apiKey.login with a `secret` prompt;
//                                    pi persists it in ~/.pi/agent/auth.json
//   - Bearer injection + prefix .... the openai-completions stream applies the
//                                    resolved key as the Bearer credential
//   - model catalog caching ........ createProvider's refreshModels wrapper
//                                    restores `context.stored` from
//                                    models-store.json and publishes fetched
//                                    lists transactionally
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
import { createProvider, openAICompletionsApi } from "@earendil-works/pi-ai";
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

  const provider = createProvider({
    id: resolved.providerId,
    name: resolved.displayName,
    baseUrl: resolved.v1URL,
    auth: {
      apiKey: {
        name: `${resolved.displayName} API key`,
        // Masked single-entry login: pi's `secret` prompt captures the key
        // once and persists it as an api_key credential for this provider.
        async login(interaction) {
          const key = await interaction.prompt({
            type: "secret",
            message: `${resolved.displayName} API key`,
          });
          return { type: "api_key", key };
        },
        // Hand the stored key back as the Bearer credential. undefined =
        // provider unconfigured (pi then hides the provider's models until
        // the user runs /login).
        async resolve({ credential }) {
          const key =
            credential?.type === "api_key" ? credential.key : undefined;
          if (key === undefined || key === "") return undefined;
          return { auth: { apiKey: key }, source: "stored API key" };
        },
      },
    },
    // Purely dynamic provider: the catalog comes from the gateway via
    // fetchModels below (restored from models-store.json on offline starts).
    models: [],
    api: openAICompletionsApi(),
    async fetchModels(context) {
      const key =
        context.credential?.type === "api_key"
          ? context.credential.key
          : undefined;
      // No usable credential: keep the persisted catalog untouched (pi's
      // wrapper skips the network phase entirely when resolve() returns
      // undefined, so this is only a defensive fallback).
      if (key === undefined || key === "") {
        return storedModelsFor(context, resolved.providerId);
      }
      // THROWS on failure (network error, empty/malformed list) so pi keeps
      // the previously restored catalog instead of publishing a blank one.
      return fetchGatewayModels(
        resolved.modelsURL,
        key,
        { providerId: resolved.providerId, v1URL: resolved.v1URL },
        resolved.excludeProviders,
        resolved.excludeOwnedBy,
        context.signal,
      );
    },
  });

  // Registering during the extension factory queues the provider so it is
  // available during interactive startup and to `pi --list-models`.
  pi.registerProvider(provider);
}
