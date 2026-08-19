import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { SelectList } from "@earendil-works/pi-tui";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Type } from "typebox";
import { agents, isAgentName } from "./agents";
import { Runner, type Job } from "./runner";

const action = Type.Optional(
  Type.Union([
    Type.Literal("start"),
    Type.Literal("status"),
    Type.Literal("result"),
    Type.Literal("cancel"),
    Type.Literal("session"),
  ]),
);
const SUBAGENT_RESULT = "__45degree_subagent_result";
const SUBAGENT_RESULT_RE = /^Background subagent finished:/;

const parameters = Type.Object({
  action,
  agent: Type.Optional(Type.String()),
  task: Type.Optional(Type.String()),
  model: Type.Optional(Type.String()),
  async: Type.Optional(Type.Boolean()),
  id: Type.Optional(Type.String()),
});

function sessionText(job: Job): string {
  const file = readdirSync(job.sessionDir).find((name) => name.endsWith(".jsonl"));
  if (!file) return "Session has not written a transcript yet.";
  return readFileSync(join(job.sessionDir, file), "utf8").split("\n").flatMap((line) => {
    try {
      const record = JSON.parse(line);
      const message = record.message;
      if (!message || !["user", "assistant", "tool"].includes(message.role)) return [];
      const content = Array.isArray(message.content)
        ? message.content.map((part: { text?: string }) => part.text).filter(Boolean).join("\n")
        : typeof message.content === "string" ? message.content : "";
      return content ? [`[${message.role}]\n${content}\n`] : [];
    } catch { return []; }
  }).join("\n") || "Session has no messages yet.";
}

function jobText(job: Job): string {
  const elapsed = `${((Date.now() - job.startedAt) / 1000).toFixed(1)}s`;
  const session = `\nsessionDir: ${job.sessionDir}`;
  if (job.status === "running")
    return `id: ${job.id}\nagent: ${job.agent}\nstatus: running\nelapsed: ${elapsed}${session}`;
  const result =
    job.status === "completed"
      ? job.output || "(no output)"
      : job.error || job.status;
  return `id: ${job.id}\nagent: ${job.agent}\nstatus: ${job.status}\nelapsed: ${elapsed}${session}\nresult:\n${result}`;
}

export default function setupSubagents(pi: ExtensionAPI): void {
  if (process.env.PI_45DEGREE_SUBAGENT === "1") return;
  const runner = new Runner();

  pi.on("session_shutdown", () => runner.shutdown());
  runner.onFinished((job) => {
    if (!job.background) return;
    void pi.sendMessage(
      {
        customType: SUBAGENT_RESULT,
        content: `Background subagent finished:\n${jobText(job)}`,
        display: false,
      },
      { triggerTurn: true, deliverAs: "followUp" },
    );
  });
  pi.on("agent_end", async () => {
    await runner.waitForRunning();
  });
  pi.registerCommand("subagents", {
    description: "Browse this session's subagent sessions (Enter opens, Esc closes)",
    handler: async (_args, ctx) => {
      if (ctx.mode !== "tui") return ctx.ui.notify("/subagents requires TUI mode", "error");
      const jobs = runner.list();
      if (!jobs.length) return ctx.ui.notify("No subagents in this session", "info");
      const selected = await ctx.ui.custom<Job | undefined>((_tui, theme, _keys, done) => {
        const list = new SelectList(
          jobs.map((job) => ({
            value: job.id,
            label: `${job.agent} · ${job.status}`,
            description: `${((Date.now() - job.startedAt) / 1000).toFixed(0)}s · ${job.id.slice(0, 8)}`,
          })),
          Math.min(jobs.length, 12),
          {
            selectedPrefix: (text) => theme.fg("accent", text),
            selectedText: (text) => theme.fg("accent", text),
            description: (text) => theme.fg("muted", text),
            scrollInfo: (text) => theme.fg("muted", text),
            noMatch: (text) => theme.fg("muted", text),
          },
        );
        list.onSelect = (item) => done(jobs.find((job) => job.id === item.value));
        list.onCancel = () => done(undefined);
        return list;
      });
      if (!selected) return;
      await ctx.ui.editor(`${selected.agent} · ${selected.status} · read-only transcript`, sessionText(selected));
    },
  });
  pi.registerTool({
    name: "subagent",
    label: "Subagent",
    description:
      "Delegate a focused task to a specialist. Background completion automatically resumes the main agent with the result.",
    promptSnippet:
      "Delegate focused work to explorer, librarian, observer, oracle, fixer, or designer.",
    promptGuidelines: [
      "Use subagent for focused independent work; choose the narrowest specialist.",
      "Use async: true for independent work. Its completion automatically resumes you with the result.",
      "Do not use subagent for council, recursive delegation, or work requiring a child to outlive this session.",
    ],
    parameters,
    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const mode = params.action ?? "start";
      if (mode !== "start") {
        if (!params.id)
          return { content: [{ type: "text", text: "id is required" }] };
        const job =
          mode === "cancel" ? runner.cancel(params.id) : runner.get(params.id);
        if (!job)
          return {
            content: [
              { type: "text", text: `Unknown subagent id: ${params.id}` },
            ],
          };
        if (mode === "session")
          return {
            content: [
              {
                type: "text",
                text: `Resume with:\npi --session-dir ${job.sessionDir} --continue`,
              },
            ],
          };
        return { content: [{ type: "text", text: jobText(job) }] };
      }
      if (!params.agent || !isAgentName(params.agent)) {
        return {
          content: [
            {
              type: "text",
              text: `agent must be one of: ${Object.keys(agents).join(", ")}`,
            },
          ],
        };
      }
      if (!params.task?.trim())
        return { content: [{ type: "text", text: "task is required" }] };
      const model =
        params.model ??
        (ctx.model ? `${ctx.model.provider}/${ctx.model.id}` : undefined);
      const job = runner.start(
        params.agent,
        agents[params.agent],
        params.task,
        ctx.cwd,
        model,
        params.async === true,
      );
      if (params.async)
        return { content: [{ type: "text", text: jobText(job) }] };
      if (signal.aborted) runner.cancel(job.id);
      else
        signal.addEventListener("abort", () => runner.cancel(job.id), {
          once: true,
        });
      await job.done;
      return { content: [{ type: "text", text: jobText(job) }] };
    },
  });
}
