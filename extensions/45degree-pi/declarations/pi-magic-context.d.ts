/**
 * Local declaration for @cortexkit/pi-magic-context.
 *
 * The published package ships runtime JS only (no types field, no .d.ts),
 * so this ambient module declaration restores a typed surface for the
 * default export without changing how the package is loaded at runtime.
 */
declare module "@cortexkit/pi-magic-context" {
  /**
   * Registers the Magic Context extension with the Pi host.
   * Async at runtime (returns a promise resolving to void).
   */
  const magicContext: (
    pi: import("@earendil-works/pi-coding-agent").ExtensionAPI,
  ) => Promise<void>;
  export default magicContext;
}
