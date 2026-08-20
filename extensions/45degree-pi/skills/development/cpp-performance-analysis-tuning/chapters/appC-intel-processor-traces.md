# Appendix C: Intel Processor Traces

## Core Idea
Intel Processor Trace (PT) is a hardware feature that records the complete execution flow (every branch taken/not-taken, indirect call target) with timestamps at < 5% overhead. It enables exact instruction-level postmortem analysis and root-causing of transient performance glitches that sampling profilers miss.

## Frameworks Introduced

- **Intel PT with Linux perf**:
  - When to use: when you need exact execution history (not statistical sampling) for a short time window — analyzing performance glitches, debugging corrupted stacks, introspect whether a code path was ever executed.
  - How: use `perf record -e intel_pt/cyc=1/u -- ./a.out` to collect, `perf report -D > trace.dump` for raw packets, `perf script --ns --itrace=i1t -F time,srcline,insn,srccode` for decoded human-readable trace.

- **Intel PT with VTune Anomaly Detection**:
  - When to use: when integrated analysis with TMA metrics and PT traces is desired.
  - How: select the "Anomaly Detection" analysis type in Intel VTune Profiler.

- **magic-trace**:
  - When to use: when you need high-resolution traces of a process with easy setup.
  - How: run `magic-trace` to collect and display traces; supports OCaml and C/C++.

## Key Concepts

- **Packet Encoding**: PT records branches in compressed binary format — 1 bit for conditional branches (Taken/Not Taken), full target address for indirect calls. Unconditional branches are omitted (targets are statically known).
- **Timing Packets (CYC)**: optional cycle-accurate timestamps between control-flow packets. Since Skylake, timing packets include cycle count elapsed since the previous packet. Enables alignment with wall-clock time.
- **Trace Reconstruction**: a software decoder combines the application binary with PT packets, starting from the entry point and using each packet as a lookup reference to determine control flow. The result: an exact instruction-by-instruction execution log.
- **Address Range Filtering**: limit tracing to user/kernel space, specific functions, or even a single loop using address range filters to reduce data volume.
- **Circular Buffer Mode**: new traces overwrite old ones, always retaining the last N seconds of execution — ideal for capturing rare glitches.

## Code Examples

```shell
# Collect PT trace with cycle-accurate timing
perf record -e intel_pt/cyc=1/u -- ./a.out

# Dump raw PT packets
perf report -D > trace.dump
# Raw output example:
# 000073b3: 2d 98 8c TIP 0x8c98       # target address
# 000073b6: 13    CYC 0x2             # timing update
# 000073b7: c0    TNT TNNNNN (6)      # 6 conditional branches
# 000073b8: 43    CYC 0x8             # 8 cycles passed

# Decode to human-readable instruction trace
perf script --ns --itrace=i1t -F time,srcline,insn,srccode
# Output:
# 253.555413143: a.cpp:24 call 0x35c    foo(arr, j);
# 253.555413143: b.cpp:7  test esi, esi  for (int i = 0; i <= n; i++)
# 253.555413508: b.cpp:7  js 0x1e
# 253.555413508: b.cpp:7  movsxd rsi, esi
```

## Use Cases

1. **Performance glitch analysis**: capture the exact instruction stream during a non-responsive period; identify what the CPU was executing instead of making progress.
2. **Postmortem debugging**: replay traces in `gdb`; obtain call stack information even when the stack is corrupted. Collect traces on a remote machine and analyze offline — invaluable for hard-to-reproduce issues.
3. **Execution introspection**: verify whether a specific code path was ever executed; measure spin-loop wait time via timestamps; detect security-relevant instruction patterns.

## Key Takeaways

- Use Intel PT when you need deterministic, complete execution history (not probabilistic sampling) — especially for transient glitches, corrupted stacks, or security analysis.
- Overhead is < 5% for most workloads, making it practical for attaching to production processes for short windows.
- Be mindful of disk space: encoded traces run ~100 MB/s, decoded traces ~1 GB/s. Use circular buffers or address-range filters to limit collection.
- Decoding is computationally expensive (7ms workload can take 20s to decode into 1.3GB of output) — only collect what you need.
- PT is complementary to TMA: use TMA to identify the bottleneck category, then use PT for deep-dive instruction-level analysis on the critical path.

## Connects To

- Ch 6 (TMA): TMA identifies what type of bottleneck to investigate; PT provides the exact instruction stream to root-cause it.
- Ch 7 (Profiling Tools): PT is another profiling tool alongside VTune, perf, and LBR; best used when the problem is too short-lived or transient for sampling.
- Ch 13 (Optimizing Multithreaded Applications): PT can trace the exact interleaving of thread execution during lock contention or false sharing glitches.
