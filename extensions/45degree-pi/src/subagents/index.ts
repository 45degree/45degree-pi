import { type ExtensionAPI, type ExtensionUIContext } from "@earendil-works/pi-coding-agent";
import { Container, Markdown, SelectList, Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import { agentDirectory, agents, isAgentName } from "./agents.ts";
import { openConversationViewer } from "./conversation-viewer.ts";
import { SubagentManager, type Job } from "./manager.ts";

const action = Type.Optional(Type.Union([Type.Literal("start"), Type.Literal("cancel")]));
const parameters = Type.Object({ action, agent: Type.Optional(Type.String()), task: Type.Optional(Type.String()), async: Type.Optional(Type.Boolean()), task_id: Type.Optional(Type.String()) });
const queryParameters = Type.Object({ action: Type.Union([Type.Literal("status"), Type.Literal("result"), Type.Literal("session")]), task_id: Type.String() });
const SUBAGENT_RESULT = "__45degree_subagent_result";
const SUBAGENT_RESULT_RE = /^Background subagent finished:/;
const SUBAGENT_QUERY = "__45degree_subagent_query";
const STATUS_ID = "45degree-subagents";
const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const TOOL_ACTIVITY: Record<string, string> = { read: "reading", bash: "running command", edit: "editing", write: "writing", grep: "searching", find: "finding files", ls: "listing" };
const MAX_WIDGET_LINES = 12;
// Per-setup mutable runtime state: each setupSubagents(pi) call creates one
// controller so concurrent/reloaded extension instances never share state.
type FleetController = {
  ui: ExtensionUIContext | undefined;
  spinnerFrame: number;
  widgetTimer: ReturnType<typeof setInterval> | undefined;
  lastStatus: string | undefined;
  finishedTurnAge: Map<string, number>;
  fleetWidget: { tui: { requestRender(): void }; registered: boolean } | undefined;
};

function toolActivity(job: Job): string {
  // tintinweb pi-subagents describeActivity: running tools first, grouped;
  // otherwise truncated response text; otherwise thinking…
  const tools = job.activeTools;
  if (tools && tools.size > 0) {
    const groups = new Map<string, number>();
    for (const name of tools.values()) {
      const action = TOOL_ACTIVITY[name] ?? name;
      groups.set(action, (groups.get(action) ?? 0) + 1);
    }
    const parts: string[] = [];
    for (const [action, count] of groups) parts.push(count > 1 ? `${action} ${count} ${action === "searching" ? "patterns" : "files"}` : action);
    return parts.join(", ") + "…";
  }
  // A just-finished tool still describes current activity better than stale
  // response text — the model usually pauses between tool end and next output.
  if (job.lastTool) {
    const action = TOOL_ACTIVITY[job.lastTool] ?? job.lastTool;
    return `${action} done`;
  }
  const text = job.responseText?.trim();
  if (text) {
    const line = text.split("\n").find((l) => l.trim())?.trim() ?? "";
    if (line) return line.length > 60 ? line.slice(0, 57) + "…" : line;
  }
  return "thinking…";
}
function formatElapsed(ms: number): string {
  const s = ms / 1000;
  return s < 60 ? `${s.toFixed(1)}s` : `${Math.floor(s / 60)}m${Math.round(s % 60)}s`;
}
function fleetRow(ctl: FleetController, job: Job, isLast: boolean, theme: { fg(c: string, t: string): string; bold(t: string): string }): string[] {
  const branch = isLast ? "└─" : "├─";
  const guide = isLast ? "   " : "│  ";
  ctl.spinnerFrame = (ctl.spinnerFrame + 1) % SPINNER.length;
  // Description: first line of the latest task text.
  const task = (job as Job & { tasks?: string[] }).tasks?.[0] ?? "";
  const desc = task.split("\n")[0]?.slice(0, 48) ?? "";
  // Fixed-width elapsed so ticking digits never re-flow the line.
  const stats = formatElapsed(Date.now() - job.startedAt).padStart(6, " ");
  return [
    `${theme.fg("dim", branch)} ${theme.fg("accent", SPINNER[ctl.spinnerFrame] ?? "⠋")} ${theme.bold(job.agent.padEnd(9))} ${theme.fg("muted", desc)} ${theme.fg("dim", "· " + stats)}`,
    `${theme.fg("dim", guide + "└ " + toolActivity(job))}`,
  ];
}
function finished(ctl: FleetController, job: Job): boolean {
  const age = ctl.finishedTurnAge.get(job.id);
  return age !== undefined && age < (job.status === "completed" ? 1 : 2);
}
function taskDescription(job: Job): string {
  return ((job as Job & { tasks?: string[] }).tasks?.[0] ?? "").split("\n")[0]?.slice(0, 48) ?? "";
}
function finishedRow(job: Job, theme: { fg(c: string, t: string): string; bold(t: string): string }): string {
  const success = job.status === "completed";
  const icon = success ? theme.fg("success", "✓") : job.status === "cancelled" ? theme.fg("dim", "■") : theme.fg("error", "✗");
  const detail = job.status === "failed" && job.error ? ` error: ${(job.error.split("\n")[0] ?? "").slice(0, 60)}` : job.status === "cancelled" ? " cancelled" : "";
  return `${theme.fg("dim", "├─")} ${icon} ${theme.bold(job.agent.padEnd(9))} ${theme.fg("muted", taskDescription(job))} ${theme.fg("dim", `· ${formatElapsed(Date.now() - job.startedAt)}${detail}`)}`;
}
function renderFleet(ctl: FleetController, manager: SubagentManager): void {
  const visible = manager.list().filter((job) => isActive(job) || finished(ctl, job));
  if (!visible.length) {
    if (ctl.fleetWidget?.registered) { ctl.ui?.setWidget("45degree-fleet", undefined); ctl.fleetWidget = undefined; }
    if (ctl.widgetTimer) { clearInterval(ctl.widgetTimer); ctl.widgetTimer = undefined; }
    return;
  }
  if (!ctl.fleetWidget?.registered) {
    ctl.ui?.setWidget("45degree-fleet", (tui, theme) => {
      ctl.fleetWidget = { tui, registered: true };
      return { render: (width: number) => {
        const all = manager.list();
        const running = all.filter((job) => job.status === "running");
        const queued = all.filter((job) => job.status === "queued");
        const done = all.filter((job) => finished(ctl, job));
        const lines: string[] = [`${theme.fg(running.length || queued.length ? "accent" : "dim", running.length || queued.length ? "●" : "○")} ${theme.bold("Agents")}`];
        const entries = [...running.flatMap((job, i) => fleetRow(ctl, job, i === running.length - 1 && !queued.length && !done.length, theme)), ...(queued.length ? [theme.fg("dim", `├─ ○ ${queued.length} queued`)] : []), ...done.map((job) => finishedRow(job, theme))];
        const capacity = MAX_WIDGET_LINES - lines.length;
        const shown = entries.length > capacity ? Math.max(0, capacity - 1) : capacity;
        lines.push(...entries.slice(0, shown));
        if (entries.length > shown) lines.push(theme.fg("dim", `└─ +${entries.length - shown} more`));
        return lines.flatMap((line) => new Text(line, 0, 0).render(width).map((part) => part.length > width ? part.slice(0, width) : part));
      }, invalidate: () => { ctl.fleetWidget = undefined; }, dispose: () => { ctl.fleetWidget = undefined; } };
    }, { placement: "aboveEditor" });
    if (!ctl.widgetTimer) ctl.widgetTimer = setInterval(() => renderFleet(ctl, manager), 200);
  } else ctl.fleetWidget.tui.requestRender();
}
function jobText(job: Job, includeActivity = false): string {
  const elapsed = `${((Date.now() - job.startedAt) / 1000).toFixed(1)}s`;
  const result = job.output || (includeActivity ? job.activity?.join("") : undefined) || job.error || (job.status === "completed" ? "No text result." : "Still running.");
  return `${job.agent} · ${job.status} · ${elapsed}\nid: ${job.id}\nsessionId: ${job.sessionId ?? "pending"}\nsessionFile: ${job.sessionFile ?? "pending"}\n\n${result}`;
}
function isActive(job: Job): boolean {
  return job.status === "queued" || job.status === "running";
}
function updateStatus(ctl: FleetController, manager: SubagentManager): void {
  const active = manager.list().filter(isActive);
  const running = active.filter((j) => j.status === "running").length;
  const queued = active.length - running;
  const parts: string[] = [];
  if (running) parts.push(`${running} running`);
  if (queued) parts.push(`${queued} queued`);
  const next = parts.length ? `${parts.join(", ")} agent${active.length === 1 ? "" : "s"}` : undefined;
  if (next !== ctl.lastStatus) { ctl.ui?.setStatus(STATUS_ID, next); ctl.lastStatus = next; }
}

export default function setupSubagents(pi: ExtensionAPI): void {
  const manager = new SubagentManager(agents);
  const ctl: FleetController = { ui: undefined, spinnerFrame: 0, widgetTimer: undefined, lastStatus: undefined, finishedTurnAge: new Map(), fleetWidget: undefined };
  manager.onEvent((job, event) => {
    if (event.type === "status") {
      if (isActive(job)) ctl.finishedTurnAge.delete(job.id);
      else ctl.finishedTurnAge.set(job.id, 0);
    }
    updateStatus(ctl, manager);
    renderFleet(ctl, manager);
    if (event.type === "status" && job.background && ["completed", "failed", "cancelled"].includes(job.status)) {
      const icon = job.status === "completed" ? "✓" : "✗";
      const first = (job.output ?? job.error ?? "No output.").split("\n")[0]?.slice(0, 80) ?? "";
      void pi.sendMessage({ customType: SUBAGENT_RESULT, content: `Background subagent finished:\n${jobText(job)}`, display: false, details: { icon, agent: job.agent, status: job.status, preview: first, durationMs: Date.now() - job.startedAt } }, { triggerTurn: true, deliverAs: "followUp" });
    }
  });
  pi.registerMessageRenderer(SUBAGENT_RESULT, (message, _options, theme) => {
    const d = (message.details ?? {}) as { icon?: string; agent?: string; status?: string; preview?: string; durationMs?: number };
    const container = new Container();
    container.addChild(new Text(`${theme.fg(d.status === "completed" ? "success" : "error", d.icon ?? "✓")} ${theme.bold(d.agent ?? "subagent")} ${theme.fg("dim", (d.durationMs ?? 0) / 1000 >= 60 ? `${Math.floor((d.durationMs ?? 0) / 60000)}m${Math.round(((d.durationMs ?? 0) % 60000) / 1000)}s` : `${((d.durationMs ?? 0) / 1000).toFixed(1)}s`)}`, 0, 0));
    if (d.preview) container.addChild(new Text(theme.fg("dim", `  ⎿  ${d.preview}`), 0, 0));
    return container;
  });

  pi.on("session_start", (_event, ctx) => { ctl.ui = ctx.ui; });
  pi.on("session_shutdown", async () => {
    if (ctl.widgetTimer) { clearInterval(ctl.widgetTimer); ctl.widgetTimer = undefined; }
    ctl.ui?.setWidget("45degree-fleet", undefined);
    ctl.fleetWidget = undefined;
    ctl.ui?.setStatus(STATUS_ID, undefined);
    ctl.lastStatus = undefined;
    await manager.shutdown();
  });
  pi.on("turn_end", () => {
    for (const [id, age] of ctl.finishedTurnAge) ctl.finishedTurnAge.set(id, age + 1);
    renderFleet(ctl, manager);
  });
  pi.on("agent_end", async () => { await manager.waitForRunning(); });

  pi.registerCommand("subagents", {
    description: "Monitor this session's subagents (Enter opens conversation, Esc closes)",
    handler: async (_args, ctx) => {
      if (ctx.mode !== "tui") return ctx.ui.notify("/subagents requires TUI mode", "error");
      if (!manager.list().length) return ctx.ui.notify("No subagents in this session", "info");
      const selected = await ctx.ui.custom<Job | undefined>((_tui, theme, _keys, done) => {
        const list = new SelectList(manager.list().map((job) => ({ value: job.id, label: `${job.agent} · ${job.status}`, description: `${((Date.now() - job.startedAt) / 1000).toFixed(0)}s · ${job.id.slice(0, 8)}` })), 12, {
          selectedPrefix: (text) => theme.fg("accent", text), selectedText: (text) => theme.fg("accent", text), description: (text) => theme.fg("muted", text), scrollInfo: (text) => theme.fg("muted", text), noMatch: (text) => theme.fg("muted", text),
        });
        list.onSelect = (item) => done(manager.get(item.value)); list.onCancel = () => done(undefined); return list;
      });
      if (!selected) return;
      await openConversationViewer(selected, manager, ctx);
    },
  });

  pi.registerTool({
    name: "subagent", label: "Subagent",
    description: "Delegate a focused task. Supply {agent, task} to create a session, or {task_id, task} to continue it. Use action: cancel with task_id to cancel. Use subagent_query for status, result, or session.",
    parameters,
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      if (signal?.aborted) throw new Error("Subagent request aborted");
      const input = params as { action?: string; agent?: string; task?: string; async?: boolean; task_id?: string };
      if (input.action === "cancel") {
        if (!input.task_id) throw new Error("task_id is required for this action");
        const job = (await manager.cancel(input.task_id)) ?? (() => { throw new Error(`Unknown subagent id: ${input.task_id}`); })();
        return { content: [{ type: "text", text: jobText(job) }], details: undefined };
      }
      if (!input.task) throw new Error("task is required");
      let job: Job;
      if (!input.agent && input.task_id) job = manager.append(input.task_id, input.task);
      else {
        if (!input.agent || !isAgentName(input.agent)) throw new Error(`agent must be one of: ${Object.keys(agents).join(", ")}`);
        job = manager.start(input.agent, input.task, ctx.cwd, input.async === true);
      }
      if (input.async) return { content: [{ type: "text", text: `Started background subagent ${job.id} (${job.agent}).` }], details: undefined };
      await job.done;
      onUpdate?.({ content: [{ type: "text", text: jobText(job) }], details: undefined });
      return { content: [{ type: "text", text: jobText(job) }], details: undefined };
    },
  });

  pi.registerTool({
    name: "subagent_query", label: "Subagent query",
    description: "Query a subagent without displaying successful calls. Supply {action, task_id}; action is status, result, or session.",
    parameters: queryParameters,
    renderShell: "self",
    renderCall() { return new Text("", 0, 0); },
    async execute(_toolCallId, params, signal) {
      if (signal?.aborted) throw new Error("Subagent request aborted");
      const input = params as { action: "status" | "result" | "session"; task_id: string };
      const job = manager.get(input.task_id);
      if (!job) throw new Error(`Unknown subagent id: ${input.task_id}`);
      const text = input.action === "session" ? `sessionId: ${job.sessionId ?? "pending"}\nsessionFile: ${job.sessionFile ?? "pending"}` : jobText(job);
      return { content: [{ type: "text", text }], details: { internal: SUBAGENT_QUERY } };
    },
    renderResult(result, _options, _theme, context) {
      const output = result.content.filter((item) => item.type === "text").map((item) => item.text).join("\n");
      return new Text(context.isError ? output : "", 0, 0);
    },
  });
}

export { agentDirectory };
