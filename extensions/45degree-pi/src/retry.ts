import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const MAX_RETRIES = 3;
const RETRY_TRIGGER = "__45degree_retry";
const RESET_AFTER_RE = /reset after (\d+(?:\.\d+)?)s/i;

function delayFor(error: string, attempt: number): number {
  const resetAfter = RESET_AFTER_RE.exec(error)?.[1];
  return resetAfter === undefined
    ? Math.min(1_000 * 2 ** attempt, 8_000)
    : Number(resetAfter) * 1_000;
}

/**
 * Explicit per-extension retry state. Replaces the loose closure variables
 * (`attempts`, `pendingCleanup`) with named, encapsulated transitions.
 */
class RetryController {
  #attempts = 0;
  #pendingCleanup = false;

  /** A completed non-error assistant turn restores the full retry budget. */
  noteSuccess(): void {
    this.#attempts = 0;
  }

  /** Reserve the next retry attempt; returns false when the budget is spent. */
  tryAcquire(): boolean {
    if (this.#attempts >= MAX_RETRIES) return false;
    this.#attempts++;
    return true;
  }

  /** Current 1-based attempt count (set by tryAcquire). */
  get attempt(): number {
    return this.#attempts;
  }

  /** Arm the one-shot context cleanup for the injected retry trigger. */
  armCleanup(): void {
    this.#pendingCleanup = true;
  }

  /** Consume the cleanup flag; true exactly once per armCleanup call. */
  consumeCleanup(): boolean {
    if (!this.#pendingCleanup) return false;
    this.#pendingCleanup = false;
    return true;
  }
}

/** Retry any provider response that ends with an API error. */
export default function retryErrors(pi: ExtensionAPI): void {
  const controller = new RetryController();

  pi.on("turn_end", (event) => {
    const message = event.message;
    if (message.role === "assistant" && message.stopReason !== "error") {
      controller.noteSuccess();
    }
  });

  pi.on("agent_end", async (event, ctx) => {
    const message = [...event.messages]
      .reverse()
      .find((m) => m.role === "assistant");
    if (message === undefined || message.role !== "assistant") return;
    if (message.stopReason !== "error") return;

    if (!controller.tryAcquire()) return;
    const error = message.errorMessage ?? "Model API error";
    const delay = delayFor(error, controller.attempt - 1);

    ctx.ui.setStatus(
      "45degree-retry",
      `API error; retrying (${controller.attempt}/${MAX_RETRIES}) in ${(delay / 1_000).toFixed(1)}s…`,
    );
    await new Promise((resolve) => setTimeout(resolve, delay));
    ctx.ui.setStatus("45degree-retry", undefined);

    controller.armCleanup();
    pi.sendMessage(
      { customType: RETRY_TRIGGER, content: "Retrying.", display: false },
      { triggerTurn: true },
    );
  });

  pi.on("context", (event) => {
    if (!controller.consumeCleanup()) return;
    return {
      messages: event.messages.filter(
        (m) => !(m.role === "custom" && m.customType === RETRY_TRIGGER),
      ),
    };
  });
}
