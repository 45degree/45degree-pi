// Parent-driven model deduplication + intensity-suffix collapse.
//
// The gateway exposes the SAME underlying models under multiple ids, and marks
// each alias entry with a `parent` field pointing at the canonical model id.
// This module drops every entry whose `parent` target exists in the catalog,
// keeping only canonical models. Entries with no parent (null/undefined/empty)
// or a dangling parent (target absent) are always kept - safe degradation that
// never accidentally deletes a real model.
//
// After parent dedup, intensity-suffix variants (`<base>-low`, `<base>-high`,
// ...) are collapsed into their base - but ONLY when the base is also present
// AND the base declares the corresponding tier in its `effortTiers`. A base
// with no `effortTiers` keeps its suffixed siblings as independent models,
// so a model whose id happens to end in `-high` but whose base does not
// expose effort tiers is never silently dropped.
//
// Ported 1:1 from the OpenCode omniroute plugin (same gateway semantics).

import type { RawModel } from "./catalog";

/**
 * Intensity / effort suffixes the gateway appends to a base model id to expose
 * quality tiers (e.g. `codex/gpt-5.6-sol` + `-low`/`-medium`/`-high`/`-xhigh`/
 * `-max`/`-ultra`). Dedup collapses each family to its BASE by dropping every
 * id that ends in one of these suffixes - but ONLY when the base (id minus the
 * suffix) also exists in the catalog AND the base declares that tier in its
 * `effortTiers`, so a standalone `-high` model whose base is not separately
 * offered, or whose base does not expose effort tiers, is never dropped.
 *
 * Edit this list to change behavior: remove an entry to KEEP that tier (e.g.
 * drop `"high"` from the array to preserve `-high` variants alongside base).
 */
export const INTENSITY_SUFFIXES: ReadonlyArray<string> = [
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
  "ultra",
];

/**
 * Drop parent-alias duplicates: any model whose `parent` is a non-empty string
 * AND whose parent target exists in the input set is removed. Models with no
 * parent, a null/undefined parent, or a dangling parent (target absent) are
 * kept. Non-recursive: each entry is evaluated independently against the
 * original id set, so chains (A->B->C) deterministically drop A and B, leaving C.
 * Pure; never throws.
 */
export function dropParentAliases(models: ReadonlyArray<RawModel>): RawModel[] {
  const ids = new Set<string>();
  for (const m of models) ids.add(m.id);
  return models.filter((m) => {
    const parent = m.parent;
    if (typeof parent === "string" && parent !== "" && ids.has(parent)) {
      return false; // alias of an existing canonical model -> drop
    }
    return true; // canonical or dangling-parent -> keep
  });
}

/**
 * Drop intensity variants: any model whose id ends in `-<suffix>` (for a suffix
 * in {@link INTENSITY_SUFFIXES}) whose base id is ALSO present AND the base
 * declares that suffix in its `effortTiers` is removed. Bases without
 * `effortTiers`, bases that do not list the suffix, and standalone suffixed
 * ids (base absent) are all kept. Pure; never throws.
 */
export function dropIntensityVariants(
  models: ReadonlyArray<RawModel>,
): RawModel[] {
  // Map id -> effortTiers set for base lookup.
  const tiersById = new Map<string, Set<string>>();
  for (const m of models) {
    tiersById.set(m.id, new Set(m.effortTiers ?? []));
  }
  return models.filter((m) => {
    for (const suffix of INTENSITY_SUFFIXES) {
      const token = "-" + suffix;
      if (m.id.endsWith(token)) {
        const base = m.id.slice(0, m.id.length - token.length);
        if (base !== "" && tiersById.has(base)) {
          const baseTiers = tiersById.get(base);
          // Only drop when the base declares this exact tier.
          if (baseTiers !== undefined && baseTiers.has(suffix)) {
            return false; // variant of an existing base that declares this tier
          }
        }
      }
    }
    return true;
  });
}

/**
 * Full dedup pipeline applied before models are compiled into the final
 * model list: parent-alias dedup (stage 1) then intensity collapse
 * (stage 2). Order matters - parent dedup runs first so the intensity
 * base-check sees canonical ids only. Pure; never throws.
 */
export function dedupeModels(models: ReadonlyArray<RawModel>): RawModel[] {
  return dropIntensityVariants(dropParentAliases(models));
}
