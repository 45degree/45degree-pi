/**
 * Exposes the extension's bundled skills (skills/ directory) to sessions via
 * resources_discover, so they work without user-level discovery directories.
 *
 * Subagents are skipped: runner.ts spawns them with --no-skills plus explicit
 * --skill grants (OMO deny-by-default parity). Guarding here also covers
 * reload paths where updateSkillsFromPaths could bypass the noSkills check.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

export default function setupSkills(pi: ExtensionAPI): void {
  if (process.env.PI_45DEGREE_SUBAGENT === "1") return;
  pi.on("resources_discover", (event) => {
    const paths = [join(dirname(fileURLToPath(import.meta.url)), "../skills")];
    if (process.env.PI_45DEGREE_DEBUG === "1") console.error(`[45d] resources_discover ${event.reason} -> ${paths.join(",")}`);
    return { skillPaths: paths };
  });
}
