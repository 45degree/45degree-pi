/**
 * Central config for the 45degree-pi extension. Edit values here; no external
 * config files are read.
 *
 * - mcp.session: OMO-style patterns for MCP servers in the top-level session.
 *   "*" allows everything, "!name" excludes (["*", "!context7"] = all but context7).
 * - mcp.agents: per-subagent MCP server patterns; agents absent here get none.
 * - agents: overrides applied onto the built-in agent defaults in agents.ts.
 */
export interface AgentOverrides {
  tools?: string[];
  skills?: string[];
  thinking?: "low" | "medium" | "high";
  model?: string;
}

export const config = {
  mcp: {
    session: ["*", "!context7"],
    agents: {
      librarian: ["tavily", "context7", "gh_grep"],
    } as Record<string, string[]>,
  },
  agents: {
    explorer: { model: "omniroute/omos-explorer" },
    librarian: { model: "omniroute/omos-librarian" },
    observer: { model: "omniroute/omos-observer" },
    oracle: { skills: [], model: "omniroute/omos-oracle" },
    fixer: { model: "omniroute/omos-fixer" },
  } as Record<string, AgentOverrides>,
};
