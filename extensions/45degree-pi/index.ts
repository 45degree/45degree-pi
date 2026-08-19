/**
 * custom-pi: global pi extension bundle.
 *
 * Combines:
 *   - omniroute provider (src/omniroute/auth.ts)
 *   - dynamic MCP servers from security.json (src/mcp.ts)
 *   - Magic Context memory and compaction (@cortexkit/pi-magic-context)
 *   - built-in specialist delegation via src/subagents/
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import magicContext from "@cortexkit/pi-magic-context";
import retryErrors from "./src/retry";
import omnirouteAuth from "./src/omniroute/auth";
import mcpFactory from "./src/mcp";
import setupOrchestratorPrompt from "./src/orchestrator-prompt";
import setupSkills from "./src/skills";
import setupSubagents from "./src/subagents/index";

export default function customPi(pi: ExtensionAPI): void {
  retryErrors(pi);
  omnirouteAuth(pi);
  magicContext(pi);
  mcpFactory(pi);
  setupOrchestratorPrompt(pi);
  setupSkills(pi);
  setupSubagents(pi);
}
