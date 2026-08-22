import {type ExtensionAPI, type ExtensionUIContext} from "@earendil-works/pi-coding-agent";
import {Text} from "@earendil-works/pi-tui";
import type {SubagentManager, TaskSnapshot} from "./manager.ts";
import {formatToolCall} from "./tool-call-display.ts";

const STATUS_ID = "45degree-subagents";
const WIDGET_ID = "45degree-fleet";
const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const MAX_WIDGET_LINES = 12;

// File-private stateless format helpers.

function formatElapsed(ms: number): string {
  const s = ms / 1000;
  return s < 60 ? `${s.toFixed(1)}s` : `${Math.floor(s / 60)}m${Math.round(s % 60)}s`;
}

// Last non-empty line of the response text, if any.
function lastResponseLine(text: string | undefined): string | undefined {
  if (!text) return undefined;
  for (const line of text.split("\n").reverse()) {
    const trimmed = line.trim();
    if (trimmed) return trimmed;
  }
  return undefined;
}

function fleetRow(frame: number, snapshot: TaskSnapshot, isLast: boolean, theme: {fg(c: string, t: string): string; bold(t: string): string}): string[] {
  const branch = isLast ? "└─" : "├─";
  const guide = isLast ? "   " : "│  ";
  // Description: first line of the run title.
  const desc = snapshot.title.split("\n")[0]?.slice(0, 48) ?? "";
  // Fixed-width elapsed so ticking digits never re-flow the line.
  const stats = formatElapsed(Date.now() - snapshot.startedAt).padStart(6, " ");
  const activity = snapshot.activeTool ? formatToolCall(snapshot.activeTool.name, snapshot.activeTool.input) : (lastResponseLine(snapshot.responseText) ?? "thinking…");
  return [`${theme.fg("dim", branch)} ${theme.fg("accent", SPINNER[frame] ?? "⠋")} ${theme.bold(snapshot.agent.padEnd(9))} ${theme.fg("muted", desc)} ${theme.fg("dim", "· " + stats)}`, `${theme.fg("dim", guide + "└ " + activity)}`];
}

function isActive(snapshot: TaskSnapshot): boolean {
  return snapshot.status === "queued" || snapshot.status === "running";
}

/**
 * Owns the fleet widget/status UI for a manager. Consumes only TaskSnapshots
 * via subscribeSnapshots — never calls manager.list()/get() or reads Job.
 * The UI context is captured at session_start. Call dispose() on
 * session_shutdown to stop the spinner timer and clear widget/status.
 */
export class FleetPresenter {
  private ui: ExtensionUIContext | undefined;
  private snapshots: readonly TaskSnapshot[] = [];
  private spinnerFrame = 0;
  private widgetTimer: ReturnType<typeof setInterval> | undefined;
  private lastStatus: string | undefined;
  private fleetWidget: {tui: {requestRender(): void}} | undefined;
  private readonly unsubscribe: () => void;

  constructor(pi: ExtensionAPI, manager: SubagentManager) {
    this.unsubscribe = manager.subscribeSnapshots((snapshots) => {
      this.updateStatus(snapshots);
      this.renderFleet(snapshots);
    });
    pi.on("session_start", (_event, ctx) => {
      this.ui = ctx.ui;
    });
  }

  /** Unsubscribe, stop the spinner timer, and clear widget/status. */
  dispose(): void {
    this.unsubscribe();
    if (this.widgetTimer) {
      clearInterval(this.widgetTimer);
      this.widgetTimer = undefined;
    }
    this.ui?.setWidget(WIDGET_ID, undefined);
    this.fleetWidget = undefined;
    this.ui?.setStatus(STATUS_ID, undefined);
    this.lastStatus = undefined;
  }

  private renderFleet(snapshots: readonly TaskSnapshot[]): void {
    this.snapshots = snapshots;
    const visible = snapshots.filter((snapshot) => snapshot.status === "running");
    if (!visible.length) {
      if (this.fleetWidget) {
        this.ui?.setWidget(WIDGET_ID, undefined);
        this.fleetWidget = undefined;
      }
      if (this.widgetTimer) {
        clearInterval(this.widgetTimer);
        this.widgetTimer = undefined;
      }
      return;
    }

    if (!this.fleetWidget) {
      this.ui?.setWidget(
        WIDGET_ID,
        (tui, theme) => {
          this.fleetWidget = {tui};
          // invalidate/dispose are no-ops: the 200ms timer keeps rendering via
          // requestRender; clearing fleetWidget here would make the timer
          // re-register the widget every tick (flicker). Only renderFleet's
          // no-running-jobs branch and dispose clear it.
          return {
            render: (width: number) => {
              const running = this.snapshots.filter((snapshot) => snapshot.status === "running");
              const lines: string[] = [`${theme.fg("accent", "●")} ${theme.bold("Agents")}`];
              const entries = running.flatMap((snapshot, i) => fleetRow(this.spinnerFrame, snapshot, i === running.length - 1, theme));
              const capacity = MAX_WIDGET_LINES - lines.length;
              const shown = entries.length > capacity ? Math.max(0, capacity - 1) : capacity;
              lines.push(...entries.slice(0, shown));
              if (entries.length > shown) lines.push(theme.fg("dim", `└─ +${entries.length - shown} more`));
              return lines.flatMap((line) => new Text(line, 0, 0).render(width).map((part) => (part.length > width ? part.slice(0, width) : part)));
            },
            invalidate: () => {},
            dispose: () => {}
          };
        },
        {placement: "aboveEditor"}
      );
      if (!this.widgetTimer)
        this.widgetTimer = setInterval(() => {
          this.spinnerFrame = (this.spinnerFrame + 1) % SPINNER.length;
          this.renderFleet(this.snapshots);
        }, 200);
    } else this.fleetWidget.tui.requestRender();
  }

  private updateStatus(snapshots: readonly TaskSnapshot[]): void {
    const active = snapshots.filter(isActive);
    const running = active.filter((snapshot) => snapshot.status === "running").length;
    const queued = active.length - running;
    const parts: string[] = [];
    if (running) parts.push(`${running} running`);
    if (queued) parts.push(`${queued} queued`);
    const next = parts.length ? `${parts.join(", ")} agent${active.length === 1 ? "" : "s"}` : undefined;
    if (next !== this.lastStatus) {
      this.ui?.setStatus(STATUS_ID, next);
      this.lastStatus = next;
    }
  }
}
