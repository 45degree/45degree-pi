import { randomUUID } from "node:crypto";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { AgentDefinition, AgentName } from "./agents";

export type JobStatus = "running" | "completed" | "failed" | "cancelled";

export interface Job {
  id: string;
  agent: AgentName;
  status: JobStatus;
  startedAt: number;
  output?: string;
  error?: string;
  child: ChildProcessWithoutNullStreams;
  background: boolean;
  sessionDir: string;
  done: Promise<void>;
}

export class Runner {
  private readonly jobs = new Map<string, Job>();
  private readonly finishedListeners = new Set<(job: Job) => void>();

  onFinished(listener: (job: Job) => void): () => void {
    this.finishedListeners.add(listener);
    return () => this.finishedListeners.delete(listener);
  }

  start(
    agent: AgentName,
    definition: AgentDefinition,
    task: string,
    cwd: string,
    background = false,
  ): Job {
    const sessionDir = join(tmpdir(), "45degree-pi-subagents", randomUUID());
    mkdirSync(sessionDir, { recursive: true });
    const args = [
      "-p",
      "--session-dir",
      sessionDir,
      "--no-skills",
      "--no-prompt-templates",
      "--tools",
      definition.tools.join(","),
      "--thinking",
      definition.thinking,
      "--system-prompt",
      definition.prompt,
    ];
    for (const skillPath of definition.skills ?? []) args.push("--skill", skillPath);
    args.push(task);
    if (definition.model) args.splice(1, 0, "--model", definition.model);

    const child = spawn(
      process.execPath,
      [fileURLToPath(new URL("./child.mjs", import.meta.url)), ...args],
      {
        cwd,
        detached: process.platform !== "win32",
        env: {
          ...process.env,
          PI_45DEGREE_SUBAGENT: "1",
          PI_45DEGREE_AGENT: agent,
          PI_45DEGREE_PARENT_PID: String(process.pid),
        },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    let finish!: () => void;
    const job: Job = {
      id: randomUUID(),
      agent,
      status: "running",
      startedAt: Date.now(),
      child,
      background,
      sessionDir,
      done: new Promise<void>((resolve) => {
        finish = resolve;
      }),
    };
    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      finish();
      for (const listener of this.finishedListeners) listener(job);
    };
    this.jobs.set(job.id, job);

    let output = "";
    let error = "";
    child.stdout.on("data", (chunk: Buffer) => {
      job.output = (output += chunk).trim();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      job.error = (error += chunk).trim();
    });
    child.once("error", (cause) => {
      if (job.status === "running") {
        job.status = "failed";
        job.error = cause.message;
      }
      settle();
    });
    child.once("close", (code, signal) => {
      if (job.status === "running") {
        job.output = output.trim();
        if (code === 0) job.status = "completed";
        else
          ((job.error = (
            error.trim() ||
            `pi exited with code ${code}${signal ? ` (${signal})` : ""}`
          ).trim()),
            (job.status = "failed"));
      }
      settle();
    });
    return job;
  }

  get(id: string): Job | undefined {
    return this.jobs.get(id);
  }

  list(): Job[] {
    return [...this.jobs.values()];
  }

  async waitForRunning(): Promise<Job[]> {
    const jobs = [...this.jobs.values()].filter(
      (job) => job.status === "running",
    );
    await Promise.all(jobs.map((job) => job.done));
    return jobs;
  }

  cancel(id: string): Job | undefined {
    const job = this.jobs.get(id);
    if (!job || job.status !== "running") return job;
    job.status = "cancelled";
    this.kill(job, "SIGTERM");
    setTimeout(() => this.kill(job, "SIGKILL"), 1_000).unref();
    return job;
  }

  shutdown(): void {
    for (const job of this.jobs.values()) this.cancel(job.id);
    this.jobs.clear();
  }

  private kill(job: Job, signal: NodeJS.Signals): void {
    try {
      if (process.platform !== "win32") process.kill(-job.child.pid!, signal);
      else job.child.kill(signal);
    } catch {
      /* already exited */
    }
  }
}
