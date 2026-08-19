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

/** Retry any provider response that ends with an API error. */
export default function retryErrors(pi: ExtensionAPI): void {
  let attempts = 0;
  let pendingCleanup = false;

  pi.on("turn_end", (event) => {
    const message = event.message as { role?: string; stopReason?: string };
    if (message.role === "assistant" && message.stopReason !== "error") {
      attempts = 0;
    }
  });

  pi.on("agent_end", async (event, ctx) => {
    const message = [...event.messages]
      .reverse()
      .find((item) => item.role === "assistant") as
      { stopReason?: string; errorMessage?: string } | undefined;
    if (message?.stopReason !== "error") return;

    if (attempts >= MAX_RETRIES) return;
    const attempt = ++attempts;
    const error = message.errorMessage ?? "Model API error";
    const delay = delayFor(error, attempt - 1);

    ctx.ui.setStatus(
      "45degree-retry",
      `API error; retrying (${attempt}/${MAX_RETRIES}) in ${(delay / 1_000).toFixed(1)}s…`,
    );
    await new Promise((resolve) => setTimeout(resolve, delay));
    ctx.ui.setStatus("45degree-retry", undefined);

    pendingCleanup = true;
    pi.sendMessage(
      { customType: RETRY_TRIGGER, content: "Retrying.", display: false },
      { triggerTurn: true },
    );
  });

  pi.on("context", (event) => {
    if (!pendingCleanup) return;
    pendingCleanup = false;
    return {
      messages: event.messages.filter(
        (message: any) =>
          message.role !== "custom" || message.customType !== RETRY_TRIGGER,
      ),
    };
  });
}
