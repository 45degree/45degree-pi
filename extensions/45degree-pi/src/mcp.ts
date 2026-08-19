/**
 * custom-pi: global pi extension.
 *
 * Dynamically builds the MCP server config from security.json in the pi
 * agent dir (~/.pi/agent/security.json — a simple { name: secret } map), so
 * secrets never appear in mcp.json or environment variables.
 */
import { createMcpAdapter } from "pi-mcp-adapter";
import { readFileSync } from "node:fs";
import { getAgentDir } from "@earendil-works/pi-coding-agent";
import { join } from "node:path";

function loadSecrets(): Record<string, string> {
  return JSON.parse(readFileSync(join(getAgentDir(), "security.json"), "utf8"));
}

const secrets = loadSecrets();

export default createMcpAdapter({
  config: {
    mcpServers: {
      github: {
        command: "bunx",
        args: ["-y", "@modelcontextprotocol/server-github"],
        env: { GITHUB_PERSONAL_ACCESS_TOKEN: secrets.github },
        lifecycle: "eager",
      },
      context7: {
        url: "https://mcp.context7.com/mcp",
        auth: "oauth",
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
    },
  },
});
