# Chapter 13: Optimizing Multithreaded Applications

## Core Idea
Modern CPUs pack increasing core counts (200+ server cores by 2024), but effective parallel speedup is limited by Amdahl's Law, Universal Scalability Law, and real-world bottlenecks like frequency throttling, memory bandwidth saturation, cache coherence, and thread synchronization. Mastering multithreaded optimization requires both systematic scaling analysis and targeted mitigation of contention/coherence issues.

## Frameworks Introduced

- **Causal Profiling (Coz)**:
  - When to use: when traditional profilers show hotspots but you don't know which optimization will actually improve overall throughput; traditional profilers only show where time is spent, not which speedup yields tangible results.
  - How: Coz virtually speeds up code segments by inserting pauses that slow down other concurrent code, then predicts the throughput impact of optimizing each segment. Use `coz run --- ./your_program` to generate a causal profile chart.

- **GAPP (Generic Automatic Parallel Profiler)**:
  - When to use: to identify and rank serialization bottlenecks in multithreaded applications without code changes or recompilation.
  - How: uses eBPF to trace futex system calls in the kernel, collects stack traces of both blocked and blocking threads, and ranks bottlenecks by criticality. No instrumentation required.

## Key Concepts

- **Effective CPU Utilization**: CPU utilization excluding overhead and spin time. 100% means all logical CPUs are busy doing productive work throughout execution.
- **Wait Time**: Time a thread is switched off by the OS scheduler, subdivided into Sync Wait Time (contended locks) and Preemption Wait Time (oversubscription or OS interference).
- **Spin Time**: Wait time during which the CPU is still busy (e.g., polling a lock). Excessive spin time reflects lost opportunity for productive work.
- **Amdahl's Law**: Speedup of a parallel program is limited by its serial fraction. Even 75% parallelism yields only 4x max speedup regardless of core count.
- **Universal Scalability Law (USL)**: Extends Amdahl's Law by modeling contention and coherence overhead; beyond a critical point, adding more cores yields retrograde speedup.
- **True Sharing**: Multiple cores access the same variable, causing data races and serialization. Fix with thread-local storage or atomics.
- **False Sharing**: Multiple cores modify different variables on the same cache line, triggering unnecessary cache coherence invalidations. Fix with alignment/padding.
- **MESI Protocol**: Cache coherence protocol with four states — Modified, Exclusive, Shared, Invalid. The longer a cache line stays in M or E state, the lower the coherence cost.
- **Frequency Throttling**: CPUs reduce clock speed when multiple cores generate excess heat. Major cause of suboptimal scaling in real-world systems.
- **Thread Oversubscription**: Running more threads than available hardware threads causes preemption wait time and degrades performance.

## Mental Models

- **Use thread count scaling as the primary diagnostic**: running an application with 1, 2, 4, 8, ... threads reveals frequency throttling, memory bandwidth saturation, lock contention, and scheduling issues in a single sweep.
- **Use dynamic partitioning on hybrid (P-core/E-core) systems**: static equal-sized chunks cause load imbalance because P-cores finish faster. Dynamic partitioning with fine-grained chunks enables the runtime to balance work across asymmetric cores.
- **Avoid pinning threads to cores unless absolutely necessary**: pinning prevents the OS scheduler from migrating threads to idle cores, leaving long execution tails on slower cores.
- **Use Coz's causal profiling when the "hot path" is misleading**: optimizing the most-time-consuming function may not improve overall throughput if it runs in parallel with a serial bottleneck.
- **Use TMA's Contested Accesses metric as the first signal for false sharing**: a high Memory Bound → L3 Bound → Contested Accesses metric prompts deeper investigation with Memory Access analysis or `perf c2c`.

## Anti-patterns

- **Static partitioning on hybrid architectures**: dividing work into N equal chunks on a system with P-cores and E-cores leaves E-core threads as the long tail, limiting overall speedup.
- **Pinning threads with unbalanced workloads**: prevents work stealing and forces completed threads to wait at a barrier while others lag on slower cores.
- **Ignoring frequency throttling**: adding threads may degrade performance because the CPU frequency drops faster than the benefit of additional parallelism.
- **Using a single shared atomic variable for accumulation**: serializes all threads; use `thread_local` accumulators and merge results in the main thread.
- **Blindly applying traditional profiler guidance in multithreaded code**: a function consuming 40% of CPU time may be parallel overhead, not a candidate for optimization.

## Code Examples

```cpp
// ❌ False sharing: sumA and sumB likely on same cache line
struct S {
    int sumA;
    int sumB;
};
S s;
// Thread A modifies s.sumA, Thread B modifies s.sumB
// Unintended cache line bouncing between cores

// ✅ Fix: align to cache line boundary
constexpr int CacheLineAlign = 64;
struct S {
    int sumA;
    alignas(CacheLineAlign) int sumB;
};
```

```cpp
// ❌ True sharing with data race
unsigned int sum; // shared, no synchronization
// Thread A: sum += a[i];
// Thread B: sum += b[i];

// ✅ Fix with thread-local storage
thread_local unsigned int local_sum = 0;
// Each thread accumulates into its own local_sum
// Main thread merges: result = sum(local_sum_i)
```

## Worked Example

**Thread Count Scaling Case Study on Intel Core i7-1260P (4P+8E cores, SMT):**

Five benchmarks were analyzed (Blender, Clang build, Zstd compression, CloverLeaf hydrodynamics, CPython multithreaded search) for speedup relative to single-threaded execution:

1. **Blender** — best scaler (6.1x at 16 threads, 38% efficiency). Rendering tiles are highly parallel. Scaling degrades at 4 threads (E-cores kick in) and 12 threads (SMT siblings compete for FP/SIMD units). Frequency throttling confirmed by disabling TurboBoost — scaling efficiency nearly doubles (38% → 69%).

2. **Clang build** — scaling stops at ~10 threads then degrades. Root cause: frequency throttling. Sustained P-core frequency drops from 4.7GHz (1 thread) to 3.2GHz (16 threads). E-cores run at 2.6GHz. The tipping point is where frequency penalty outweighs parallelism gain.

3. **Zstd compression** — scaling stops at ~5 threads. Root cause: complex thread interaction. Main thread cannot post new jobs when all input buffers are occupied. Workers stall waiting for jobs (ww periods). The memory pool design limits concurrency to avoid runaway memory consumption but creates 20-40ms delays between jobs.

4. **CloverLeaf hydrodynamics** — scaling stops at 3 threads. Root cause: memory bandwidth saturation. DRAM Memory Bound rises from 34.6% (1T) to 65.4% (4T). Memory bandwidth reaches 86% of practical limit (30/35 GB/s). Upgrading from 2400 MT/s to 3200 MT/s DDR4 yields 10-33% improvement. TurboBoost provides no benefit because threads are waiting for data, not computing.

5. **CPython binary search** — zero scaling (2 threads provide no speedup). Root cause: Global Interpreter Lock (GIL). VTune threading analysis shows two threads alternating via `pthread_cond_timedwait` with 5ms timeouts. Call stack leads to `take_gil` — the GIL prevents any parallel execution of compute-bound Python threads.

**Key findings**: Frequency throttling, memory bandwidth, and lock contention are the three most common scaling killers. Use VTune Platform View for frequency, TMA Memory Bound for bandwidth, and threading timeline analysis for lock contention.

## Key Takeaways

- Run thread count scaling as the first diagnostic for any multithreaded application — it surfaces frequency throttling, memory bandwidth limits, lock contention, and scheduling issues in one experiment.
- Frequency throttling is the single largest unrealized performance factor on modern systems; disabling TurboBoost doubled scaling efficiency in the case study.
- On hybrid processors, prefer dynamic partitioning with fine granularity over static partitioning; avoid pinning threads unless proven beneficial.
- Use `thread_local` storage to eliminate true sharing contention; use cache-line alignment (`alignas(64)`) to eliminate false sharing.
- Visualize worker thread timelines (VTune, ITT markers) to uncover complex thread interactions like the Zstd buffer-starvation pattern.
- Leverage new tools (Coz for causal profiling, GAPP/eBPF for futex-level contention analysis) when traditional profilers reach their limits.
- The three most common scaling killers in practice: frequency throttling, memory bandwidth saturation, and lock contention.

## Connects To

- Ch 2 (Measuring Performance): scaling methodology — always measure one level deeper; understand why scaling deviates from linear.
- Ch 3 (CPU Microarchitecture): SMT, cache hierarchy, core types (P/E cores) — the hardware substrate that determines scaling behavior.
- Ch 4 (Memory-bound): memory bandwidth saturation (CloverLeaf case); memory latency, cache misses as shared-resource bottlenecks.
- Ch 6 (TMA): Memory Bound → L3 Bound → Contested Accesses for false sharing detection; TMA metrics applied to multithreaded workloads.
- Ch 7 (Profiling Tools): VTune Platform View for frequency monitoring, Timeline View for thread interaction, ITT markers.
- Ch 12 (Low-latency): techniques from Ch 12.3 apply to latency-critical threads in multithreaded applications.
- Appendix A (Reducing Measurement Noise): disabling TurboBoost, setting CPU affinity, process priority — all essential for reproducible multithreaded benchmarking.
- Appendix C (Intel PT): reconstructing exact execution flow for analyzing short-lived multithreaded glitches.
