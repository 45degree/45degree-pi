/**
 * Central config for the 45degree-pi extension. Edit values here; no external
 * config files are read.
 *
 * - mcp.session: OMO-style patterns for MCP servers in the top-level session.
 *   "*" allows everything, "!name" excludes (["*", "!context7"] = all but context7).
 * - mcp.agents: per-subagent MCP server patterns; agents absent here get none.
 * - agents: overrides applied onto the built-in agent defaults in agents.ts.
 */
import type { AgentName } from "./subagents/agents.ts";

/** Re-export so downstream modules depend on config, not subagents internals. */
export type { AgentName };

export interface AgentOverrides {
  tools?: string[];
  skills?: string[];
  thinking?: "low" | "medium" | "high";
  model?: string;
}

/** CodeGraph root discovery marks, checked while scanning upward. */
export interface CodeGraphConfig {
  readonly rootMarks: readonly string[];
}

/** Typed shape of the static config object declared below. */
export interface ExtensionConfig {
  readonly mcp: {
    readonly session: readonly string[];
    readonly agents: Partial<Record<AgentName, readonly string[]>>;
  };
  readonly agents: Partial<Record<AgentName, AgentOverrides>>;
  readonly codegraph: CodeGraphConfig;
}

export const config: ExtensionConfig = {
  mcp: {
    session: ["*", "!context7"],
    agents: {
      librarian: ["tavily", "context7", "gh_grep"],
    },
  },
  agents: {
    explorer: { model: "omniroute/omos-explorer" },
    librarian: { model: "omniroute/omos-librarian" },
    observer: { model: "omniroute/omos-observer" },
    oracle: { skills: [], model: "omniroute/omos-oracle" },
    fixer: { model: "omniroute/omos-fixer" },
  },
  codegraph: {
    rootMarks: [".codegraph", ".git"],
  },
};
