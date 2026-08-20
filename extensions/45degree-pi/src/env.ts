/** Transitional marker retained for extensions that may inspect inherited environments. */
export const SUBAGENT_ENV_VAR = "PI_45DEGREE_SUBAGENT";

export function isSubagent(env: NodeJS.ProcessEnv = process.env): boolean {
  return env[SUBAGENT_ENV_VAR] === "1";
}

export function debug(msg: string): void {
  if (process.env.PI_45DEGREE_DEBUG === "1") console.error(`[45d] ${msg}`);
}
