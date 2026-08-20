import { DynamicBorder, getMarkdownTheme, type ExtensionAPI, type ExtensionUIContext } from "@earendil-works/pi-coding-agent";
import { Container, Markdown, SelectList, Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import { agentDirectory, agents, isAgentName } from "./agents.ts";
import { SubagentManager, type Job } from "./manager.ts";

const action = Type.Optional(Type.Union([Type.Literal("start"), Type.Literal("status"), Type.Literal("result"), Type.Literal("cancel"), Type.Literal("session")]));
const parameters = Type.Object({ action, agent: Type.Optional(Type.String()), task: Type.Optional(Type.String()), async: Type.Optional(Type.Boolean()), task_id: Type.Optional(Type.String()) });
const SUBAGENT_RESULT = "__45degree_subagent_result";
const SUBAGENT_RESULT_RE = /^Background subagent finished:/;
const STATUS_ID = "45degree-subagents";
const PREVIEW_ID = "45degree-subagent-preview";
const SPINNER = ["⋮", "⁝", "︙", "⁝"];
const TOOL_ACTIVITY: Record<string, string> = { read: "reading", bash: "running command", edit: "editing", write: "writing", grep: "searching", find: "finding files", ls: "listing" };
interface PreviewState { markdown: Markdown; root: Container; tui: { requestRender(): void }; }
let ui: ExtensionUIContext | undefined;
let watchedJob: Job | undefined;
let preview: PreviewState | undefined;
let spinnerFrame = 0;
let widgetTimer: ReturnType<typeof setInterval> | undefined;

// Tree of ALL agents, tintinweb-style: one row per active job, spinner + name + stats + activity.
let fleetWidget: { tui: { requestRender(): void }; registered: boolean } | undefined;

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
    for (const [action, count] of groups) parts.push(count > 1 ? `${action} ×${count}` : action);
    return parts.join(", ") + "…";
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
function fleetRow(job: Job, isLast: boolean, theme: { fg(c: string, t: string): string; bold(t: string): string }): string[] {
  const branch = isLast ? "└─" : "├─";
  const guide = isLast ? "   " : "│  ";
  spinnerFrame = (spinnerFrame + 1) % SPINNER.length;
  // Description: first line of the latest task text.
  const task = (job as Job & { tasks?: string[] }).tasks?.[0] ?? "";
  const desc = task.split("\n")[0]?.slice(0, 48) ?? "";
  // Fixed-width elapsed so ticking digits never re-flow the line.
  const stats = formatElapsed(Date.now() - job.startedAt).padStart(6, " ");
  return [
    `${theme.fg("dim", branch)} ${theme.fg("accent", SPINNER[spinnerFrame])} ${theme.bold(job.agent.padEnd(9))} ${theme.fg("muted", desc)} ${theme.fg("dim", "· " + stats)}`,
    `${theme.fg("dim", guide + "└ " + toolActivity(job))}`,
  ];
}
function renderFleet(manager: SubagentManager): void {
  const active = manager.list().filter(isActive);
  const running = active.filter((j) => j.status === "running");
  const queued = active.filter((j) => j.status === "queued");
  if (!active.length) {
    if (fleetWidget?.registered) { ui?.setWidget("45degree-fleet", undefined); fleetWidget = undefined; }
    if (widgetTimer) { clearInterval(widgetTimer); widgetTimer = undefined; }
    return;
  }
  if (!fleetWidget?.registered) {
    ui?.setWidget("45degree-fleet", (tui, theme) => {
      fleetWidget = { tui, registered: true };
      return {
        render: (width: number) => {
          const nowActive = manager.list().filter(isActive);
          const nowRunning = nowActive.filter((j) => j.status === "running");
          const nowQueued = nowActive.filter((j) => j.status === "queued");
          const lines: string[] = [`${theme.fg("accent", "●")} ${theme.bold("Agents")}`];
          nowRunning.forEach((job, i) => lines.push(...fleetRow(job, i === nowRunning.length - 1 && !nowQueued.length, theme)));
          if (nowQueued.length) lines.push(theme.fg("dim", `└─ ○ ${nowQueued.length} queued`));
          // One Text per line, hard-truncated to the viewport so nothing ever wraps
          // and shifts the block (the "jumping" the user saw).
          return lines.flatMap((line) => new Text(line, 0, 0).render(width).map((l) => l.length > width ? l.slice(0, width) : l));
        },
        invalidate: () => { fleetWidget = undefined; },
        dispose: () => { fleetWidget = undefined; },
      };
    }, { placement: "aboveEditor" });
    if (!widgetTimer) widgetTimer = setInterval(() => renderFleet(manager), 200);
  } else {
    fleetWidget.tui.requestRender();
  }
}
function jobText(job: Job, includeActivity = false): string {
  const elapsed = `${((Date.now() - job.startedAt) / 1000).toFixed(1)}s`;
  const result = job.output || (includeActivity ? job.activity?.join("") : undefined) || job.error || (job.status === "completed" ? "No text result." : "Still running.");
  return `${job.agent} · ${job.status} · ${elapsed}\nid: ${job.id}\nsessionId: ${job.sessionId ?? "pending"}\nsessionFile: ${job.sessionFile ?? "pending"}\n\n${result}`;
}
function isActive(job: Job): boolean {
  return job.status === "queued" || job.status === "running";
}
function renderPreview(): void {
  if (!preview || !watchedJob) return;
  preview.markdown.setText(jobText(watchedJob, true));
  preview.root.invalidate();
  preview.tui.requestRender();
}
function showPreview(job: Job): void {
  watchedJob = job;
  ui?.setWidget(PREVIEW_ID, (tui, theme) => {
    const root = new Container();
    const markdown = new Markdown(jobText(job, true), 1, 0, getMarkdownTheme());
    // Widgets participate in Pi's normal layout, so never obscure the editor.
    // Bound to ~15% of the current terminal; retain the newest streaming lines.
    const bodyLines = Math.max(3, Math.floor(tui.terminal.rows * 0.15) - 2);
    root.addChild(new DynamicBorder((value) => theme.fg("accent", value)));
    root.addChild({ render: (width: number) => markdown.render(width).slice(-bodyLines) });
    root.addChild(new DynamicBorder((value) => theme.fg("accent", value)));
    preview = { markdown, root, tui };
    return {
      render: (width) => root.render(width),
      dispose: () => { if (preview?.root === root) preview = undefined; },
    };
  }, { placement: "aboveEditor" });
}
function clearPreview(): void {
  watchedJob = undefined;
  preview = undefined;
  ui?.setWidget(PREVIEW_ID, undefined);
}
function updateStatus(manager: SubagentManager): void {
  const active = manager.list().filter(isActive);
  const running = active.filter((j) => j.status === "running").length;
  const queued = active.length - running;
  const parts: string[] = [];
  if (running) parts.push(`${running} running`);
  if (queued) parts.push(`${queued} queued`);
  ui?.setStatus(STATUS_ID, parts.length ? `${parts.join(", ")} agent${active.length === 1 ? "" : "s"}` : undefined);
}

export default function setupSubagents(pi: ExtensionAPI): void {
  const manager = new SubagentManager(agents);
  manager.onEvent((job, event) => {
    updateStatus(manager);
    renderFleet(manager);
    // The streamed preview stays opt-in via /subagents; the fleet widget covers "what is running".
    if (job === watchedJob) {
      if (isActive(job)) renderPreview(); else clearPreview();
    }
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

  pi.on("session_start", (_event, ctx) => { ui = ctx.ui; });
  pi.on("session_shutdown", async () => { clearPreview(); ui?.setStatus(STATUS_ID, undefined); await manager.shutdown(); });
  pi.on("agent_end", async () => { await manager.waitForRunning(); });

  pi.registerCommand("subagents", {
    description: "Monitor this session's subagents (Enter watches, c cancels, Esc closes)",
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
      if (isActive(selected)) showPreview(selected);
      else ctx.ui.notify(`${selected.agent} is ${selected.status}`, "info");
    },
  });

  pi.registerTool({
    name: "subagent", label: "Subagent",
    description: "Delegate a focused task. Supply {agent, task} to create a session; supply {task_id, task} to continue it. Actions: status, result, session, cancel use task_id.",
    parameters,
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      if (signal.aborted) throw new Error("Subagent request aborted");
      const input = params as { action?: string; agent?: string; task?: string; async?: boolean; task_id?: string };
      if (input.action && input.action !== "start") {
        if (!input.task_id) throw new Error("task_id is required for this action");
        if (input.action === "cancel") {
          const job = (await manager.cancel(input.task_id)) ?? (() => { throw new Error(`Unknown subagent id: ${input.task_id}`); })();
          return { content: [{ type: "text", text: jobText(job) }] };
        }
        const job = manager.get(input.task_id); if (!job) throw new Error(`Unknown subagent id: ${input.task_id}`);
        return { content: [{ type: "text", text: input.action === "session" ? `sessionId: ${job.sessionId ?? "pending"}\nsessionFile: ${job.sessionFile ?? "pending"}` : jobText(job) }] };
      }
      if (!input.task) throw new Error("task is required");
      let job: Job;
      if (!input.agent && input.task_id) job = manager.append(input.task_id, input.task);
      else {
        if (!input.agent || !isAgentName(input.agent)) throw new Error(`agent must be one of: ${Object.keys(agents).join(", ")}`);
        job = manager.start(input.agent, input.task, ctx.cwd, input.async === true);
      }
      if (input.async) return { content: [{ type: "text", text: `Started background subagent ${job.id} (${job.agent}).` }] };
      await job.done;
      onUpdate?.({ content: [{ type: "text", text: jobText(job) }] });
      return { content: [{ type: "text", text: jobText(job) }] };
    },
    renderResult(result, _options, _theme, context) {
      const output = result.content.filter((item) => item.type === "text").map((item) => item.text).join("\n");
      const text = context.lastComponent ?? new Text("", 0, 0);
      text.setText(SUBAGENT_RESULT_RE.test(output) ? "" : output);
      return text;
    },
  });
}

export { agentDirectory };
