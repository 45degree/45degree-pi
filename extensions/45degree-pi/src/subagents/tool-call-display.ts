// Single-line, <=80-char rendering of a tool call for UI rows.

const PATH_TOOLS = new Set(["read", "grep", "find", "ls", "edit", "write"]);

export function formatToolCall(name: string, input: unknown): string {
  let detail: string | undefined;
  if (typeof input === "object" && input !== null) {
    const record = input as Record<string, unknown>;
    const key = name === "bash" ? "command" : PATH_TOOLS.has(name) ? "path" : undefined;
    const value = key ? record[key] : undefined;
    if (typeof value === "string") detail = value;
  }
  // Collapse whitespace (multi-line commands) into a single line.
  const line = detail ? `${name}: ${detail}` : name;
  const singleLine = line.trim().replace(/\s+/g, " ");
  return singleLine.length > 80 ? singleLine.slice(0, 77) + "…" : singleLine;
}
