/**
 * conversation-viewer.ts — Live conversation overlay for viewing subagent sessions.
 *
 * Displays a scrollable, live-updating view of a subagent's conversation.
 * Subscribes to session events for real-time streaming updates.
 * Supports steering while running and a two-press stop confirmation.
 */

import {type Component, type TUI, Input, matchesKey, truncateToWidth, visibleWidth, wrapTextWithAnsi} from "@earendil-works/pi-tui";
import {Theme} from "@earendil-works/pi-coding-agent";
import type {ExtensionCommandContext} from "@earendil-works/pi-coding-agent";
import type {Job, SubagentManager} from "./manager.ts";

/** Base lines consumed by chrome: top border + header + header sep + footer sep + footer + bottom border. */
const CHROME_LINES_BASE = 6;
const MIN_VIEWPORT = 3;

export class ConversationViewer implements Component {
  private scrollOffset = 0;
  private autoScroll = true;
  private unsubscribe?: () => void;
  private lastInnerW = 0;
  private closed = false;
  /** Two-press confirm guard for the stop key, so a stray key can't kill the agent. */
  private stopArmed = false;
  /** Steering composer — present while the user is typing a message to the agent. */
  private composer?: Input;

  constructor(
    private tui: TUI,
    private job: Job,
    private manager: SubagentManager,
    private ctx: ExtensionCommandContext,
    private theme: Theme,
    private done: () => void
  ) {
    const unsub = job.session?.subscribe(() => {
      if (this.closed) return;
      this.tui.requestRender();
    });
    // exactOptionalPropertyTypes: only assign when defined.
    if (unsub) this.unsubscribe = unsub;
  }

  handleInput(data: string): void {
    // While composing a steer message, the input owns all keys (Enter sends,
    // Esc cancels — both wired in openComposer()). Editing keys flow through.
    if (this.composer) {
      this.composer.handleInput(data);
      this.tui.requestRender();
      return;
    }

    if (matchesKey(data, "escape") || matchesKey(data, "q")) {
      this.closed = true;
      this.done();
      return;
    }

    // Enter opens the steering composer (only while the agent can still be
    // steered) — then type + Enter sends, Esc or an empty submit returns. When
    // not steerable, fall through so the key still disarms a pending stop.
    if (matchesKey(data, "enter") && this.canSteer()) {
      this.stopArmed = false;
      this.openComposer();
      return;
    }

    // Stop/abort the agent (only while it can still be stopped). Two-press:
    // first "x" arms, second confirms — any other key disarms.
    if (matchesKey(data, "x")) {
      if (this.isStoppable()) {
        if (this.stopArmed) {
          this.stopArmed = false;
          void this.doStop();
        } else {
          this.stopArmed = true;
        }
        this.tui.requestRender();
      }
      return;
    }
    if (this.stopArmed) this.stopArmed = false;

    const totalLines = this.buildContentLines(this.lastInnerW).length;
    const viewportHeight = this.viewportHeight();
    const maxScroll = Math.max(0, totalLines - viewportHeight);

    if (matchesKey(data, "up")) {
      this.scrollOffset = Math.max(0, this.scrollOffset - 1);
      this.autoScroll = this.scrollOffset >= maxScroll;
    } else if (matchesKey(data, "down")) {
      this.scrollOffset = Math.min(maxScroll, this.scrollOffset + 1);
      this.autoScroll = this.scrollOffset >= maxScroll;
    } else if (matchesKey(data, "pageUp")) {
      this.scrollOffset = Math.max(0, this.scrollOffset - viewportHeight);
      this.autoScroll = false;
    } else if (matchesKey(data, "pageDown")) {
      this.scrollOffset = Math.min(maxScroll, this.scrollOffset + viewportHeight);
      this.autoScroll = this.scrollOffset >= maxScroll;
    } else if (matchesKey(data, "home")) {
      this.scrollOffset = 0;
      this.autoScroll = false;
    } else if (matchesKey(data, "end")) {
      this.scrollOffset = maxScroll;
      this.autoScroll = true;
    }
    this.tui.requestRender();
  }

  render(width: number): string[] {
    if (width < 6) return []; // too narrow for any meaningful rendering
    const th = this.theme;
    const innerW = width - 4; // border + padding
    this.lastInnerW = innerW;
    const lines: string[] = [];

    const pad = (s: string, len: number) => {
      const vis = visibleWidth(s);
      return s + " ".repeat(Math.max(0, len - vis));
    };
    const row = (content: string) => th.fg("border", "│") + " " + truncateToWidth(pad(content, innerW), innerW, "...", true) + " " + th.fg("border", "│");
    const hrTop = th.fg("border", `╭${"─".repeat(width - 2)}╮`);
    const hrBot = th.fg("border", `╰${"─".repeat(width - 2)}╯`);
    const hrMid = row(th.fg("dim", "─".repeat(innerW)));

    // Header
    lines.push(hrTop);
    const statusIcon = this.job.status === "running" ? th.fg("accent", "●") : this.job.status === "completed" ? th.fg("success", "✓") : this.job.status === "failed" ? th.fg("error", "✗") : th.fg("dim", "○");
    const elapsed = formatElapsed(Date.now() - this.job.startedAt);
    const taskDesc = ((this.job as Job & {tasks?: string[]}).tasks?.[0] ?? "").split("\n")[0]?.slice(0, 48) ?? "";
    const toolCount = this.job.activeTools?.size ?? 0;
    const headerParts: string[] = [elapsed];
    if (toolCount > 0) headerParts.unshift(`${toolCount} tool${toolCount === 1 ? "" : "s"}`);
    const headerRight = headerParts.join(" · ");
    lines.push(row(`${statusIcon} ${th.bold(this.job.agent)} ${th.fg("dim", `· ${taskDesc}`)} ${th.fg("dim", "·")} ${th.fg("dim", headerRight)}`));
    lines.push(hrMid);

    // Content area — rebuild every render (live data, no cache needed)
    const contentLines = this.buildContentLines(innerW);
    const viewportHeight = this.viewportHeight();
    const maxScroll = Math.max(0, contentLines.length - viewportHeight);

    if (this.autoScroll) {
      this.scrollOffset = maxScroll;
    }

    const visibleStart = Math.min(this.scrollOffset, maxScroll);
    const visible = contentLines.slice(visibleStart, visibleStart + viewportHeight);

    for (let i = 0; i < viewportHeight; i++) {
      lines.push(row(visible[i] ?? ""));
    }

    // Footer
    lines.push(hrMid);
    if (this.composer) {
      // Composer row: the Input renders its own prompt and cursor.
      lines.push(row(this.composer.render(innerW)[0] ?? ""));
      const composeHint = th.fg("dim", "Enter send · Esc cancel");
      const composeLeft = th.fg("accent", "✎ steer");
      const composeGap = Math.max(1, innerW - visibleWidth(composeLeft) - visibleWidth(composeHint));
      lines.push(row(composeLeft + " ".repeat(composeGap) + composeHint));
    } else {
      // Actions on the left, navigation on the right.
      const sep = th.fg("dim", " · ");
      const actions: string[] = [];
      if (this.canSteer()) actions.push(th.fg("dim", "Enter steer"));
      if (this.isStoppable()) {
        actions.push(this.stopArmed ? th.fg("error", "x again to STOP") : th.fg("dim", "x stop"));
      }
      const footerRight = th.fg("dim", "↑↓ scroll · PgUp/PgDn · Esc close");

      const scrollPct = contentLines.length <= viewportHeight ? "100%" : `${Math.round(((visibleStart + viewportHeight) / contentLines.length) * 100)}%`;
      const count = th.fg("dim", `${contentLines.length} lines · ${scrollPct}`);
      const withCount = [count, ...actions].join(sep);
      const footerLeft = visibleWidth(withCount) + visibleWidth(footerRight) + 1 <= innerW ? withCount : actions.join(sep);

      const footerGap = Math.max(1, innerW - visibleWidth(footerLeft) - visibleWidth(footerRight));
      lines.push(row(footerLeft + " ".repeat(footerGap) + footerRight));
    }
    lines.push(hrBot);

    return lines;
  }

  invalidate(): void {
    /* no cached state to clear */
  }

  dispose(): void {
    this.closed = true;
    if (this.unsubscribe) {
      this.unsubscribe();
      delete this.unsubscribe;
    }
  }

  // ---- Private ----

  private viewportHeight(): number {
    // Cap mirrors the overlay's maxHeight — otherwise the viewer would render
    // more lines than the overlay shows and clip the footer.
    const maxRows = Math.floor((this.tui.terminal.rows * 85) / 100);
    return Math.max(MIN_VIEWPORT, maxRows - this.chromeLines());
  }

  private chromeLines(): number {
    // The composer adds one row above the footer hint while it's open.
    return CHROME_LINES_BASE + (this.composer ? 1 : 0);
  }

  /** Stoppable only when the agent is still active. */
  private isStoppable(): boolean {
    return this.job.status === "running" || this.job.status === "queued";
  }

  /** Steerable only when a session exists and the agent is still active. */
  private canSteer(): boolean {
    return !!this.job.session?.steer && (this.job.status === "running" || this.job.status === "queued");
  }

  /** Open the inline steering composer and route subsequent input to it. */
  private openComposer(): void {
    const input = new Input();
    input.focused = true;
    input.onSubmit = (value: string) => {
      const message = value.trim();
      delete this.composer;
      if (message) void this.doSteer(message);
      this.tui.requestRender();
    };
    input.onEscape = () => {
      delete this.composer;
      this.tui.requestRender();
    };
    this.composer = input;
    this.tui.requestRender();
  }

  private async doSteer(text: string): Promise<void> {
    if (!this.job.session) return;
    try {
      await this.job.session.steer(text);
      this.autoScroll = true;
      this.tui.requestRender();
    } catch (err) {
      this.ctx.ui.notify(`Steer failed: ${err instanceof Error ? err.message : String(err)}`, "error");
    }
  }

  private async doStop(): Promise<void> {
    try {
      await this.manager.cancel(this.job.id);
      this.tui.requestRender();
    } catch (err) {
      this.ctx.ui.notify(`Cancel failed: ${err instanceof Error ? err.message : String(err)}`, "error");
    }
  }

  private buildContentLines(width: number): string[] {
    if (width <= 0) return [];

    const th = this.theme;
    const messages = (this.job.session?.messages ?? []) as any[];
    const lines: string[] = [];

    if (messages.length === 0) {
      lines.push(th.fg("dim", "(waiting for first message...)"));
      return lines;
    }

    let needsSeparator = false;
    for (let mi = 0; mi < messages.length; mi++) {
      const msg = messages[mi];
      const role = (msg as any).role as string;

      if (role === "user") {
        const text = typeof msg.content === "string" ? msg.content : extractContentText(msg.content);
        if (!text.trim()) continue;
        if (needsSeparator) lines.push(th.fg("dim", "───"));
        lines.push(th.fg("accent", "[User]"));
        const wrapped = wrapTextWithAnsi(text.trim(), width);
        for (const line of wrapped) lines.push(line);
      } else if (role === "assistant") {
        const textParts: string[] = [];
        const toolCalls: Array<{name: string; args: string}> = [];
        const content = Array.isArray(msg.content) ? msg.content : [];
        for (let ci = 0; ci < content.length; ci++) {
          const c = content[ci];
          if (c.type === "text" && c.text) textParts.push(c.text);
          else if (c.type === "thinking" && c.thinking) textParts.push(c.thinking);
          else if (c.type === "toolCall") {
            const name = c.name ?? c.toolName ?? "unknown";
            let args = "";
            try {
              args = JSON.stringify(c.arguments ?? {});
            } catch {
              args = String(c.arguments ?? "");
            }
            // Cap raw args so long payloads stay readable; wrapping handles the rest.
            if (args.length > 200) args = args.slice(0, 197) + "...";
            toolCalls.push({name, args});
          }
        }
        if (needsSeparator) lines.push(th.fg("dim", "───"));
        lines.push(th.bold("[Assistant]"));
        if (textParts.length > 0) {
          const wrapped = wrapTextWithAnsi(textParts.join("\n").trim(), width);
          for (const line of wrapped) lines.push(line);
        }
        // Tool calls: one blank line after assistant text, then one call per
        // line — `▍tool: input` — continuation lines aligned under the input.
        if (toolCalls.length > 0 && textParts.length > 0) lines.push("");
        for (const tc of toolCalls) {
          const hasArgs = !!tc.args && tc.args !== "{}";
          if (hasArgs) {
            const prefix = `▍${tc.name}: `;
            const prefixW = visibleWidth(prefix);
            const wrapped = wrapTextWithAnsi(tc.args, Math.max(1, width - prefixW));
            lines.push(th.fg("muted", prefix + wrapped[0]));
            for (let wi = 1; wi < wrapped.length; wi++) {
              lines.push(th.fg("muted", " ".repeat(prefixW) + (wrapped[wi] ?? "")));
            }
          } else {
            lines.push(th.fg("muted", `▍${tc.name}`));
          }
        }
      } else if (role === "toolResult") {
        // Never render tool results — the tool-call block above shows type + input.
        continue;
      } else {
        // Unknown role — show dim fallback
        const text = extractContentText(msg.content);
        if (!text.trim()) continue;
        if (needsSeparator) lines.push(th.fg("dim", "───"));
        lines.push(th.fg("dim", `[${role}]`));
        const wrapped = wrapTextWithAnsi(text.trim(), width);
        for (const line of wrapped) lines.push(th.fg("dim", line));
      }
      needsSeparator = true;
    }

    // Streaming indicator for running agents
    if (this.job.status === "running") {
      const act = this.describeActivity();
      if (act) {
        lines.push("");
        lines.push(truncateToWidth(th.fg("accent", "▍ ") + th.fg("dim", act), width));
      }
    }

    const out: string[] = [];
    for (const line of lines) {
      out.push(truncateToWidth(line, width));
    }
    return out;
  }

  private describeActivity(): string {
    const tools = this.job.activeTools;
    if (tools && tools.size > 0) {
      const groups = new Map<string, number>();
      tools.forEach((name) => {
        groups.set(name, (groups.get(name) ?? 0) + 1);
      });
      const parts: string[] = [];
      groups.forEach((count, name) => {
        parts.push(count > 1 ? `${name} x${count}` : name);
      });
      return `Running ${parts.join(", ")}…`;
    }
    if (this.job.lastTool) return `${this.job.lastTool} done`;
    const text = this.job.responseText?.trim();
    if (text) {
      const all = text.split("\n");
      let line = "";
      for (const raw of all) {
        const t = raw.trim();
        if (t) {
          line = t;
          break;
        }
      }
      return line.length > 60 ? line.slice(0, 57) + "…" : line;
    }
    return "thinking…";
  }
}

function formatElapsed(ms: number): string {
  const s = ms / 1000;
  return s < 60 ? `${s.toFixed(1)}s` : `${Math.floor(s / 60)}m${Math.round(s % 60)}s`;
}

function extractContentText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    const out: string[] = [];
    for (let i = 0; i < content.length; i++) {
      const block = content[i];
      if (block.type === "text") out.push(block.text ?? "");
      else if (block.type === "thinking") out.push(block.thinking ?? "");
      else if (block.type === "toolCall") {
        const args = JSON.stringify(block.arguments ?? {});
        out.push(`\`${block.name ?? block.toolName ?? "tool"}(${args.length > 80 ? args.slice(0, 77) + "..." : args})\``);
      }
    }
    return out.join("\n");
  }
  return JSON.stringify(content).slice(0, 300);
}

/**
 * Open a full-session overlay for the given job.
 * Reuses the local SubagentManager for cancellation and Job.session for steering.
 */
export async function openConversationViewer(job: Job, manager: SubagentManager, ctx: ExtensionCommandContext): Promise<void> {
  await ctx.ui.custom<void>(
    (tui, theme, _keybindings, done) => {
      const viewer = new ConversationViewer(tui, job, manager, ctx, theme, done);
      return viewer;
    },
    {
      overlay: true,
      overlayOptions: {
        width: "90%",
        maxHeight: "85%",
        anchor: "center",
        margin: 1
      },
      onHandle: (handle) => {
        handle.focus();
      }
    }
  );
}
