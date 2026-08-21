/** Builds isolated MCP extension instances for the main or per-agent session. */
import {createMcpAdapter} from "pi-mcp-adapter";
import {loadMcpConfig} from "../node_modules/pi-mcp-adapter/config.ts";
import {readFileSync} from "node:fs";
import {getAgentDir, type ExtensionFactory} from "@earendil-works/pi-coding-agent";
import {join} from "node:path";
import type {ServerEntry} from "../node_modules/pi-mcp-adapter/types.ts";
import {config, type AgentName} from "./config.ts";

/** Secrets consumed from security.json (only the fields we use are typed). */
interface Secrets {
  readonly github: string;
  readonly tavily: string;
}

/** Runtime guard: narrows JSON.parse output to a plain string-keyed object. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function loadSecrets(): Secrets {
  const raw: unknown = JSON.parse(readFileSync(join(getAgentDir(), "security.json"), "utf8"));
  if (!isRecord(raw)) {
    throw new Error("security.json: expected a JSON object");
  }
  const {github, tavily} = raw;
  if (typeof github !== "string" || typeof tavily !== "string") {
    throw new Error("security.json: expected string fields 'github' and 'tavily'");
  }
  return {github, tavily};
}

function matches(name: string, patterns: readonly string[]): boolean {
  let ok = false;
  for (const pattern of patterns) {
    const negated = pattern.startsWith("!");
    const value = negated ? pattern.slice(1) : pattern;
    if (value === "*" || value === name) ok = !negated;
  }
  return ok;
}

function servers(): Record<string, ServerEntry> {
  const secrets = loadSecrets();
  return {
    github: {command: "bunx", args: ["-y", "@modelcontextprotocol/server-github"], env: {GITHUB_PERSONAL_ACCESS_TOKEN: secrets.github}, lifecycle: "eager"},
    context7: {command: "bunx", args: ["-y", "@upstash/context7-mcp"], lifecycle: "eager"},
    tavily: {url: `https://mcp.tavily.com/mcp/?tavilyApiKey=${secrets.tavily}`, lifecycle: "eager"},
    gh_grep: {url: "https://mcp.grep.app", lifecycle: "eager"},
    ...loadMcpConfig().mcpServers
  };
}

/** `agent` omitted selects the main-session allowlist; named agents default deny. */
export default function createMcpExtension(agent?: AgentName): ExtensionFactory {
  const patterns = agent === undefined ? config.mcp.session : (config.mcp.agents[agent] ?? []);
  return createMcpAdapter({config: {mcpServers: Object.fromEntries(Object.entries(servers()).filter(([name]) => matches(name, patterns)))}});
}
