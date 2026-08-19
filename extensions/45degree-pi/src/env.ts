/**
 * Single home for the process-boundary seam between orchestrator and spawned
 * subagents. child.mjs reads PI_45DEGREE_PARENT_PID standalone (no imports).
 */
export const SUBAGENT_ENV_VAR = "PI_45DEGREE_SUBAGENT";

export function subagentEnv(agent: string, parentPid: number): Record<string, string> {
  return {
    [SUBAGENT_ENV_VAR]: "1",
    PI_45DEGREE_AGENT: agent,
    PI_45DEGREE_PARENT_PID: String(parentPid),
  };
}

export function isSubagent(env: NodeJS.ProcessEnv = process.env): boolean {
  return env[SUBAGENT_ENV_VAR] === "1";
}

export function subagentName(env: NodeJS.ProcessEnv = process.env): string | undefined {
  return env.PI_45DEGREE_AGENT || undefined;
}

export function debug(msg: string): void {
  if (process.env.PI_45DEGREE_DEBUG === "1") console.error(`[45d] ${msg}`);
}
