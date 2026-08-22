import {randomUUID} from "node:crypto";
import {mkdirSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createAgentSession, DefaultResourceLoader, getAgentDir, ModelRuntime, SessionManager, type AgentSession, type AgentSessionEvent, type InlineExtension} from "@earendil-works/pi-coding-agent";
import omnirouteAuth from "../omniroute/auth.ts";
import createMcpExtension from "../mcp.ts";
import type {AgentDefinition, AgentName} from "./agents.ts";

export type JobStatus = "queued" | "running" | "completed" | "failed" | "cancelled";
export interface JobEvent {
  type: "text" | "thinking" | "tool_start" | "tool_end" | "status";
  text?: string;
  tool?: string;
}
export interface Job {
  id: string;
  agent: AgentName;
  /** Short human-readable title of this run (required for new tasks; kept when continuing). */
  title: string;
  status: JobStatus;
  startedAt: number;
  output?: string;
  activity?: string[];
  error?: string;
  background: boolean;
  session?: AgentSession | undefined;
  sessionId?: string;
  // exactOptionalPropertyTypes: fields are explicitly cleared with `undefined`
  // (never deleted), so the declared type must admit it.
  sessionFile?: string | undefined;
  done: Promise<void>;
  /** Live activity state, tintinweb-style: tools currently running + response text. */
  activeTools?: Map<string, string>;
  /** Most recent tool (set on start, kept after end); cleared on next text/thinking delta. */
  lastTool?: string | undefined;
  responseText?: string;
}
/** Manager-private runtime state; extends the public Job but is never part of its API. */
interface ManagedJob extends Job {
  cwd: string;
  tasks: string[];
  resolve: () => void;
}
export interface ManagerPolicy {
  concurrency: () => number;
  maxSessions: () => number;
}
const defaultPolicy: ManagerPolicy = {
  concurrency: () => Math.min(8, Math.max(1, Number(process.env.PI_45DEGREE_SUBAGENT_CONCURRENCY) || 4)),
  maxSessions: () => 50
};

export class SubagentManager {
  private readonly jobs = new Map<string, ManagedJob>();
  private readonly queues = new Map<string, string[]>();
  private readonly listeners = new Set<(job: Job, event: JobEvent) => void>();
  private readonly sessionDir = join(tmpdir(), "45degree-pi-subagents");
  private running = 0;
  private shuttingDown = false;
  private readonly policy: ManagerPolicy;

  constructor(
    private readonly definitions: Record<AgentName, AgentDefinition>,
    policy: Partial<ManagerPolicy> = {}
  ) {
    this.policy = {...defaultPolicy, ...policy};
    mkdirSync(this.sessionDir, {recursive: true});
  }

  onEvent(listener: (job: Job, event: JobEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  list(): Job[] {
    return [...this.jobs.values()];
  }
  get(id: string): Job | undefined {
    return this.jobs.get(id);
  }

  start(agent: AgentName, task: string, cwd: string, title: string, background = false): Job {
    const job = this.makeJob(agent, background, cwd, task, title);
    this.jobs.set(job.id, job);
    this.enqueue(job.id);
    return job;
  }

  append(id: string, task: string): Job {
    const job = this.jobs.get(id);
    if (!job) throw new Error(`Unknown task id: ${id}`);
    job.tasks.push(task);
    if (job.status !== "running" && job.status !== "queued") {
      // cancelled/failed/completed IDs stay reusable (Q16): requeue the same session.
      this.resetDone(job);
      job.status = "queued";
      this.emit(job, {type: "status"});
      this.enqueue(id);
    }
    return job;
  }

  async cancel(id: string): Promise<Job | undefined> {
    const job = this.jobs.get(id);
    if (!job) return undefined;
    job.tasks.length = 0;
    this.removeQueued(id);
    const wasRunning = job.status === "running";
    if (wasRunning) await job.session?.abort();
    job.status = "cancelled";
    if (!wasRunning) job.resolve();
    this.emit(job, {type: "status"});
    return job;
  }

  async waitForRunning(): Promise<void> {
    // Q15: main session must not end before its subagents — wait for queued AND running.
    await Promise.all(
      this.list()
        .filter((job) => job.status === "running" || job.status === "queued")
        .map((job) => job.done)
    );
  }
  async shutdown(): Promise<void> {
    this.shuttingDown = true;
    await Promise.all(this.list().map((job) => this.cancel(job.id)));
    await this.waitForRunning();
    for (const job of this.list()) job.session?.dispose();
  }

  private makeJob(agent: AgentName, background: boolean, cwd: string, task: string, title: string): ManagedJob {
    let resolve!: () => void;
    const done = new Promise<void>((r) => {
      resolve = r;
    });
    return {id: randomUUID(), agent, title, status: "queued", startedAt: Date.now(), background, done, cwd, tasks: [task], resolve};
  }
  private resetDone(job: ManagedJob): void {
    let resolve!: () => void;
    job.done = new Promise<void>((r) => {
      resolve = r;
    });
    job.resolve = resolve;
  }
  private enqueue(id: string): void {
    const job = this.jobs.get(id)!;
    const queue = this.queues.get(id) ?? [];
    if (!queue.includes(id)) queue.push(id);
    this.queues.set(id, queue);
    this.pump();
  }
  private removeQueued(id: string): void {
    this.queues.delete(id);
  }
  private pump(): void {
    while (!this.shuttingDown && this.running < this.policy.concurrency()) {
      const id = [...this.queues.keys()].find((key) => this.queues.get(key)?.length);
      if (!id) return;
      this.queues.delete(id);
      const job = this.jobs.get(id)!;
      if (job.status !== "cancelled") void this.run(job);
    }
  }
  // Read status through a method so CFA does not narrow job.status to a
  // literal after assignment — cancel() can mutate it across awaits.
  private isCancelled(job: Job): boolean {
    return job.status === "cancelled";
  }
  private async run(job: ManagedJob): Promise<void> {
    this.running++;
    job.status = "running";
    this.emit(job, {type: "status"});
    try {
      if (!job.session) await this.createSession(job, job.cwd);
      while (job.tasks.length && !this.isCancelled(job)) {
        const task = job.tasks.shift()!;
        await new Promise<void>((resolve, reject) => {
          const off = job.session!.subscribe((event) => {
            this.forward(job, event);
            if (event.type === "agent_end") {
              off();
              resolve();
            }
          });
          void job.session!.sendUserMessage(task).catch((error) => {
            off();
            reject(error);
          });
        });
      }
      if (!this.isCancelled(job)) job.status = "completed";
    } catch (error) {
      if (!this.isCancelled(job)) {
        job.status = "failed";
        job.error = error instanceof Error ? error.message : String(error);
      }
    } finally {
      this.running--;
      this.emit(job, {type: "status"});
      job.resolve();
      this.evictIdle();
      this.pump();
    }
  }
  private async createSession(job: Job, cwd: string): Promise<void> {
    this.evictIdle();
    const definition = this.definitions[job.agent];
    const [provider, ...modelId] = (definition.model ?? "").split("/");
    // Single source of truth for the agent config dir: the package's own
    // getAgentDir() (respects PI_CODING_AGENT_DIR and os.homedir()). A
    // hand-built process.env.HOME path can diverge from ModelRuntime's
    // implicit default when HOME/homedir() disagree.
    const agentDir = getAgentDir();
    const runtime = await ModelRuntime.create({
      authPath: join(agentDir, "auth.json"),
      modelsPath: join(agentDir, "models.json")
    });
    const loader = new DefaultResourceLoader({
      cwd,
      agentDir,
      noExtensions: true,
      noSkills: true,
      noPromptTemplates: true,
      noContextFiles: false,
      additionalSkillPaths: definition.skills ?? [],
      systemPrompt: definition.prompt,
      // Magic Context ships no type declarations (@cortexkit/pi-magic-context has
      // no .d.ts); load it via additionalExtensionPaths so the package's own
      // pi.extensions manifest entry is resolved at runtime by the loader.
      additionalExtensionPaths: ["node_modules/@cortexkit/pi-magic-context"],
      extensionFactories: [omnirouteAuth as InlineExtension, createMcpExtension(job.agent)]
    });
    await loader.reload();
    // Inline providers register when AgentSession binds the extension runtime.
    // Resolve after that binding, not before loader creation. Passing agentDir
    // keeps sdk's own authPath/modelsPath derivation on the same directory.
    const {session} = await createAgentSession({
      cwd,
      agentDir,
      modelRuntime: runtime,
      thinkingLevel: definition.thinking,
      tools: definition.tools,
      excludeTools: ["subagent", "ctx_memory"],
      resourceLoader: loader,
      sessionManager: SessionManager.create(cwd, this.sessionDir)
    });
    // Hosts normally emit session_start via bindExtensions; do the same so
    // extension hooks (Magic Context retrieval, resource discovery) initialize.
    try {
      await session.bindExtensions({});
    } catch {
      /* non-fatal */
    }
    await runtime.refresh({allowNetwork: false});
    if (provider && !runtime.hasConfiguredAuth(provider)) {
      session.dispose();
      throw new Error(`Configured provider has no authentication: ${provider}.` + ` agentDir=${agentDir} (auth.json / models.json).`);
    }
    let model = provider && modelId.length ? runtime.getModel(provider, modelId.join("/")) : undefined;
    if (!model && modelId.length && provider) {
      // Native-provider registration kicks an async stored-models restore
      // (models-store.json); wait for it deterministically before resolving.
      // Surface refresh errors (provider, auth/models paths, configured
      // model) instead of swallowing them — errors never contain the key.
      const refreshResult = await runtime.refresh({allowNetwork: false}).catch((error: unknown) => error);
      model = runtime.getModel(provider, modelId.join("/"));
      if (!model) {
        session.dispose();
        const errors = refreshResult instanceof Error ? [`${provider}: ${refreshResult.message}`] : [...(refreshResult as {errors: ReadonlyMap<string, Error>}).errors.entries()].map(([id, err]) => `${id}: ${err.message}`);
        const detail = errors.length ? ` Refresh errors: ${errors.join("; ")}.` : "";
        throw new Error(`Configured model is unavailable: ${definition.model}.` + ` agentDir=${agentDir} (auth.json / models.json).` + `${detail}`);
      }
    }
    if (definition.model && !model) {
      session.dispose();
      throw new Error(`Configured model is unavailable: ${definition.model}`);
    }
    // setModel() persists the selection as the global default; a subagent model is session-local.
    if (model) session.agent.state.model = model;
    job.session = session;
    job.sessionId = session.sessionId;
    job.sessionFile = session.sessionFile ?? undefined;
  }
  private forward(job: Job, event: AgentSessionEvent): void {
    if (event.type === "message_update") {
      const {assistantMessageEvent} = event;
      if ((assistantMessageEvent.type === "text_delta" || assistantMessageEvent.type === "thinking_delta") && assistantMessageEvent.delta) {
        const type = assistantMessageEvent.type === "text_delta" ? "text" : "thinking";
        // New assistant output supersedes any finished tool activity.
        job.lastTool = undefined;
        const activity = (job.activity ??= []);
        activity.push(assistantMessageEvent.delta);
        if (activity.length > 200) activity.shift();
        if (type === "text") {
          job.output = (job.output ?? "") + assistantMessageEvent.delta;
          job.responseText = job.output;
        }
        this.emit(job, {type, text: assistantMessageEvent.delta});
      }
    }
    if (event.type === "tool_execution_start" || event.type === "tool_execution_end") {
      const toolName = event.toolName;
      if (event.type === "tool_execution_start") {
        const activity = (job.activity ??= []);
        activity.push(`\n[tool] ${toolName}\n`);
        if (activity.length > 200) activity.shift();
        (job.activeTools ??= new Map()).set(`${toolName}_${Date.now()}`, toolName);
        job.lastTool = toolName;
      } else {
        const tools = job.activeTools;
        if (tools)
          for (const [key, name] of tools) {
            if (name === toolName) {
              tools.delete(key);
              break;
            }
          }
      }
      this.emit(job, {type: event.type === "tool_execution_start" ? "tool_start" : "tool_end", tool: toolName});
    }
  }
  private emit(job: Job, event: JobEvent): void {
    for (const listener of this.listeners) listener(job, event);
  }
  private evictIdle(): void {
    const idle = this.list()
      .filter((job) => job.status !== "running" && job.status !== "queued" && job.session)
      .sort((a, b) => a.startedAt - b.startedAt);
    while (this.list().filter((job) => job.session).length >= this.policy.maxSessions() && idle.length) {
      const job = idle.shift()!;
      job.session?.dispose();
      job.session = undefined;
      // Audit JSONL is deliberately kept: eviction releases the in-memory session only.
    }
  }
}
