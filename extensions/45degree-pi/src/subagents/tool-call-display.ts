// Single-line, <=80-char rendering of a tool call for UI rows.

const ARGUMENT_TOOLS = new Set(["bash", "read", "grep", "find", "ls", "edit", "write"]);

export function formatToolCall(name: string, input: unknown): string {
  let detail: string | undefined;
  if (typeof input === "object" && input !== null) {
    const record = input as Record<string, unknown>;
    const key = !ARGUMENT_TOOLS.has(name) ? undefined : name === "bash" ? "command" : "path";
    const value = key ? record[key] : undefined;
    if (typeof value === "string") detail = value;
  }
  // Collapse whitespace (multi-line commands) into a single line.
  const line = detail ? `${name}: ${detail}` : name;
  const singleLine = line.trim().replace(/\s+/g, " ");
  return singleLine.length > 80 ? singleLine.slice(0, 77) + "…" : singleLine;
}
