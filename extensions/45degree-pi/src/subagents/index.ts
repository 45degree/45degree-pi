import {getMarkdownTheme, type ExtensionAPI} from "@earendil-works/pi-coding-agent";
import {Container, Markdown, SelectList, Text} from "@earendil-works/pi-tui";
import {agentDirectory, agents, isAgentName} from "./agents.ts";
import {openConversationViewer} from "./conversation-viewer.ts";
import {SubagentManager, type Job} from "./manager.ts";
import {FleetPresenter} from "./fleet.ts";
import {tasksParameters as parameters, tasksQueryParameters as queryParameters, tasksCancelParameters as cancelParameters} from "./task-schemas.ts";
import {CodeGraphService} from "../codegraph/service.ts";
import {config} from "../config.ts";

const SUBAGENT_RESULT = "__45degree_subagent_result";
const SUBAGENT_RESULT_RE = /^Background subagent finished:/;
const SUBAGENT_QUERY = "__45degree_subagent_query";

function jobText(job: Job, includeActivity = false): string {
  const elapsed = `${((Date.now() - job.startedAt) / 1000).toFixed(1)}s`;
  const result = job.output || (includeActivity ? job.activity?.join("") : undefined) || job.error || (job.status === "completed" ? "No text result." : "Still running.");
  return `${job.agent} · ${job.status} · ${elapsed}\nid: ${job.id}\nsessionId: ${job.sessionId ?? "pending"}\nsessionFile: ${job.sessionFile ?? "pending"}\n\n${result}`;
}

export default function setupSubagents(pi: ExtensionAPI): void {
  const service = new CodeGraphService(config.codegraph.rootMarks);
  const manager = new SubagentManager(agents, {}, service);
  const fleet = new FleetPresenter(pi, manager);
  manager.onEvent((job, event) => {
    if (event.type === "status" && job.background && ["completed", "failed", "cancelled"].includes(job.status)) {
      const icon = job.status === "completed" ? "✓" : "✗";
      const first = (job.output ?? job.error ?? "No output.").split("\n")[0]?.slice(0, 80) ?? "";
      void pi.sendMessage({customType: SUBAGENT_RESULT, content: `Background task finished:\n${jobText(job)}`, display: false, details: {icon, agent: job.agent, status: job.status, preview: first, durationMs: Date.now() - job.startedAt}}, {triggerTurn: true, deliverAs: "followUp"});
    }
  });
  pi.registerMessageRenderer(SUBAGENT_RESULT, (message, _options, theme) => {
    const d = (message.details ?? {}) as {icon?: string; agent?: string; status?: string; preview?: string; durationMs?: number};
    const container = new Container();
    container.addChild(new Text(`${theme.fg(d.status === "completed" ? "success" : "error", d.icon ?? "✓")} ${theme.bold(d.agent ?? "subagent")} ${theme.fg("dim", (d.durationMs ?? 0) / 1000 >= 60 ? `${Math.floor((d.durationMs ?? 0) / 60000)}m${Math.round(((d.durationMs ?? 0) % 60000) / 1000)}s` : `${((d.durationMs ?? 0) / 1000).toFixed(1)}s`)}`, 0, 0));
    if (d.preview) container.addChild(new Text(theme.fg("dim", `  ⎿  ${d.preview}`), 0, 0));
    return container;
  });

  pi.on("session_shutdown", async () => {
    fleet.dispose();
    await manager.shutdown();
    await service.close();
  });
  pi.on("agent_end", async () => {
    await manager.waitForRunning();
  });

  pi.registerCommand("subagents", {
    description: "Monitor this session's subagents (Enter opens conversation, Esc closes)",
    handler: async (_args, ctx) => {
      if (ctx.mode !== "tui") return ctx.ui.notify("/subagents requires TUI mode", "error");
      if (!manager.list().length) return ctx.ui.notify("No subagents in this session", "info");
      const selected = await ctx.ui.custom<Job | undefined>((_tui, theme, _keys, done) => {
        const list = new SelectList(
          manager.list().map((job) => ({value: job.id, label: `${job.agent} · ${job.status}`, description: `${((Date.now() - job.startedAt) / 1000).toFixed(0)}s · ${job.id.slice(0, 8)}`})),
          12,
          {
            selectedPrefix: (text) => theme.fg("accent", text),
            selectedText: (text) => theme.fg("accent", text),
            description: (text) => theme.fg("muted", text),
            scrollInfo: (text) => theme.fg("muted", text),
            noMatch: (text) => theme.fg("muted", text)
          }
        );
        list.onSelect = (item) => done(manager.get(item.value));
        list.onCancel = () => done(undefined);
        return list;
      });
      if (!selected) return;
      await openConversationViewer(selected, manager, ctx);
    }
  });

  pi.registerCommand("codegraph-init", {
    description: "Initialize the CodeGraph index for the current project (creates .codegraph/) and keep it watched",
    handler: async (_args, ctx) => {
      const statusKey = "codegraph";
      ctx.ui.setStatus(statusKey, "Resolving project root...");
      try {
        await service.initialize(ctx.cwd, (p) => {
          ctx.ui.setStatus(statusKey, `Indexing: ${p.phase} ${p.current}/${p.total}${p.currentFile ? ` · ${p.currentFile.slice(-48)}` : ""}`);
        });
        const root = await service.resolveRoot(ctx.cwd);
        ctx.ui.setStatus(statusKey, undefined);
        ctx.ui.notify(`CodeGraph index ready: ${root}`, "info");
      } catch (error) {
        ctx.ui.setStatus(statusKey, undefined);
        ctx.ui.notify(`CodeGraph init failed: ${error instanceof Error ? error.message : String(error)}`, "error");
      }
    }
  });

  pi.registerTool({
    name: "tasks",
    label: "Tasks",
    description: "Delegate a focused task. Supply {agent, title, task} to create a new task, or {task_id, task} to continue it. Use tasks_query for status, result, or session, and tasks_cancel with task_id to cancel.",
    parameters,
    renderCall(args, theme, _context) {
      const existing = args.task_id ? manager.get(args.task_id) : undefined;
      const agent = args.agent ?? existing?.agent;
      const title = args.title ?? existing?.title;
      if (!title || !agent) return new Text("", 0, 0);
      return new Markdown(`**[${agent}]**: ${title}`, 0, 0, {
        ...getMarkdownTheme(),
        bold: (text) => theme.fg("toolTitle", theme.bold(text))
      });
    },
    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      if (signal?.aborted) throw new Error("Task request aborted");
      const input = params as {agent?: string; title?: string; task?: string; async?: boolean; task_id?: string};
      if (!input.task) throw new Error("task is required");
      let job: Job;
      if (!input.agent && input.task_id) job = manager.append(input.task_id, input.task);
      else {
        if (!input.agent || !isAgentName(input.agent)) throw new Error(`agent must be one of: ${Object.keys(agents).join(", ")}`);
        if (!input.title) throw new Error("title is required for new tasks");
        job = manager.start(input.agent, input.task, ctx.cwd, input.title, input.async === true);
      }
      if (input.async) return {content: [], details: undefined};
      await job.done;
      onUpdate?.({content: [{type: "text", text: jobText(job)}], details: undefined});
      return {content: [{type: "text", text: jobText(job)}], details: undefined};
    }
  });

  pi.registerTool({
    name: "tasks_query",
    label: "Tasks query",
    description: "Query a task without displaying successful calls. Supply {action, task_id}; action is status, result, or session.",
    parameters: queryParameters,
    renderShell: "self",
    renderCall() {
      return new Text("", 0, 0);
    },
    async execute(_toolCallId, params, signal) {
      if (signal?.aborted) throw new Error("Task query aborted");
      const input = params as {action: "status" | "result" | "session"; task_id: string};
      const job = manager.get(input.task_id);
      if (!job) throw new Error(`Unknown task id: ${input.task_id}`);
      const text = input.action === "session" ? `sessionId: ${job.sessionId ?? "pending"}\nsessionFile: ${job.sessionFile ?? "pending"}` : jobText(job);
      return {content: [{type: "text", text}], details: {internal: SUBAGENT_QUERY}};
    },
    renderResult(result, _options, _theme, context) {
      const output = result.content
        .filter((item) => item.type === "text")
        .map((item) => item.text)
        .join("\n");
      return new Text(context.isError ? output : "", 0, 0);
    }
  });

  pi.registerTool({
    name: "tasks_cancel",
    label: "Tasks cancel",
    description: "Cancel a task by id. Supply {task_id}. Use tasks_query to inspect existing work first.",
    parameters: cancelParameters,
    renderCall(args, theme, _context) {
      const job = args.task_id ? manager.get(args.task_id) : undefined;
      if (!job?.title || !job.agent) return new Text("", 0, 0);
      return new Markdown(`**[${job.agent}]**: ${job.title}`, 0, 0, {
        ...getMarkdownTheme(),
        bold: (text) => theme.fg("toolTitle", theme.bold(text))
      });
    },
    async execute(_toolCallId, params, signal) {
      if (signal?.aborted) throw new Error("Task cancel aborted");
      const input = params as {task_id: string};
      const job =
        (await manager.cancel(input.task_id)) ??
        (() => {
          throw new Error(`Unknown task id: ${input.task_id}`);
        })();
      return {content: [{type: "text", text: jobText(job)}], details: undefined};
    }
  });
}

export {agentDirectory};
