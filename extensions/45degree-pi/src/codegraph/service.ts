/**
 * CodeGraphService - minimal native @colbymchenry/codegraph lifecycle:
 * upward root-mark scan, instance caching, open/init/indexAll/watch/close,
 * and availability probing.
 */
import fs from "node:fs";
import {createRequire} from "node:module";
import path from "node:path";
import type {CodeGraph as CodeGraphInstance, IndexProgress} from "@colbymchenry/codegraph";

const require = createRequire(import.meta.url);
const {CodeGraph} = require("@colbymchenry/codegraph") as typeof import("@colbymchenry/codegraph");

export class CodeGraphService {
  /** Cache of open CodeGraph instances, keyed by absolute project root. */
  private readonly graphs = new Map<string, CodeGraphInstance>();

  constructor(private readonly rootMarks: readonly string[]) {}

  /**
   * Walk up from an absolute cwd; the first ancestor containing any root mark
   * (e.g. `.codegraph`, `.git`) wins. No hit: fall back to the cwd itself.
   */
  resolveRoot(cwd: string): Promise<string> {
    let dir = path.resolve(cwd);
    for (;;) {
      if (this.rootMarks.some((mark) => fs.existsSync(path.join(dir, mark)))) {
        return Promise.resolve(dir);
      }
      const parent = path.dirname(dir);
      if (parent === dir) break; // hit the filesystem root
      dir = parent;
    }
    return Promise.resolve(path.resolve(cwd));
  }

  /**
   * Return the cached/open instance for the cwd's root, or undefined when the
   * root has no `.codegraph` index yet. Opens with sync + starts watching.
   */
  async get(cwd: string): Promise<CodeGraphInstance | undefined> {
    const root = await this.resolveRoot(cwd);
    const cached = this.graphs.get(root);
    if (cached) return cached;
    if (!CodeGraph.isInitialized(root)) return undefined;
    const graph = await CodeGraph.open(root, {sync: true});
    graph.watch();
    this.graphs.set(root, graph);
    return graph;
  }

  /**
   * Ensure an instance exists for the cwd's root: open if already initialized,
   * otherwise init (creates `.codegraph/`), then run a full indexAll and start
   * watching. Cached by absolute root.
   */
  async initialize(cwd: string, onProgress?: (progress: IndexProgress) => void): Promise<CodeGraphInstance> {
    const root = await this.resolveRoot(cwd);
    const cached = this.graphs.get(root);
    if (cached) return cached;
    const graph = CodeGraph.isInitialized(root) ? await CodeGraph.open(root, {sync: true}) : await CodeGraph.init(root);
    await graph.indexAll(onProgress ? {onProgress} : undefined);
    graph.watch();
    this.graphs.set(root, graph);
    return graph;
  }

  /** Close every cached instance (releases DB + watcher) and clear the cache. */
  async close(): Promise<void> {
    for (const graph of this.graphs.values()) graph.close();
    this.graphs.clear();
  }

  /** Availability is expressed by get(): an open instance means available. */
  async isAvailable(cwd: string): Promise<boolean> {
    return (await this.get(cwd)) !== undefined;
  }
}
