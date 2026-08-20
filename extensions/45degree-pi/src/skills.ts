/**
 * Exposes the extension's bundled skills (skills/ directory) to sessions via
 * resources_discover, so they work without user-level discovery directories.
 *
 * Child sessions use a private resource loader with explicit skill grants.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { debug, isSubagent } from "./env.ts";

export default function setupSkills(pi: ExtensionAPI): void {
  if (isSubagent()) return;
  pi.on("resources_discover", (event) => {
    const paths = [join(dirname(fileURLToPath(import.meta.url)), "../skills")];
    debug(`resources_discover ${event.reason} -> ${paths.join(",")}`);
    return { skillPaths: paths };
  });
}
