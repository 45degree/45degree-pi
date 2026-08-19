/**
 * custom-pi: global pi extension.
 *
 * Dynamically builds the MCP server config from security.json in the pi
 * agent dir (~/.pi/agent/security.json — a simple { name: secret } map), so
 * secrets never appear in mcp.json or environment variables.
 *
 * User-discovered configs (~/.pi/agent/mcp.json, project .mcp.json, host
 * imports) are loaded via loadMcpConfig() and merged in, then filtered
 * per-agent with OMO-style patterns from config.ts.
 */
import { createMcpAdapter } from "pi-mcp-adapter";
// loadMcpConfig is not in the package exports map; import the module file directly.
import { loadMcpConfig } from "../node_modules/pi-mcp-adapter/config.ts";
import { readFileSync } from "node:fs";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { join } from "node:path";
import type { ServerEntry } from "../node_modules/pi-mcp-adapter/types.ts";
import { config } from "./config.ts";

function loadSecrets(): Record<string, string> {
  return JSON.parse(readFileSync(join(getAgentDir(), "security.json"), "utf8"));
}
const secrets = loadSecrets();

// OMO-style pattern match: ["*", "!context7"] = everything except context7.
function matches(name: string, patterns: string[]): boolean {
  let ok = false;
  for (const p of patterns) {
    const neg = p.startsWith("!");
    const pat = neg ? p.slice(1) : p;
    if (pat === "*" || pat === name) ok = !neg;
  }
  return ok;
}

const cfg = config.mcp;
const subagent = process.env.PI_45DEGREE_SUBAGENT === "1";
const patterns = subagent
  ? (cfg.agents[process.env.PI_45DEGREE_AGENT ?? ""] ?? [])
  : cfg.session;

const allServers: Record<string, ServerEntry> = {
  github: {
    command: "bunx",
    args: ["-y", "@modelcontextprotocol/server-github"],
    env: { GITHUB_PERSONAL_ACCESS_TOKEN: secrets.github },
    lifecycle: "eager",
  },
  context7: {
    command: "bunx",
    args: ["-y", "@upstash/context7-mcp"],
    lifecycle: "eager",
  },
  tavily: {
    url: `https://mcp.tavily.com/mcp/?tavilyApiKey=${secrets.tavily}`,
    lifecycle: "eager",
  },
  gh_grep: {
    url: "https://mcp.grep.app",
    lifecycle: "eager",
  },
  // user's own configs (discovery is skipped when `config` is supplied)
  ...(loadMcpConfig().mcpServers as Record<string, ServerEntry>),
};

export default createMcpAdapter({
  config: {
    mcpServers: Object.fromEntries(
      Object.entries(allServers).filter(([name]) => matches(name, patterns)),
    ),
  },
});
