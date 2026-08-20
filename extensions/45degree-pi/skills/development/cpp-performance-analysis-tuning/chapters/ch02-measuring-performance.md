# Chapter 2: Measuring Performance

## Core Idea
Fair performance measurement requires controlling system nondeterminism, using statistical methods, and automating regression detection -- because every run of a program produces different performance characteristics even when functionally identical.

## Frameworks Introduced

- **Active Benchmarking (Ousterhout)**: "Performance measurements should be considered guilty until proven innocent."
  - When to use: every time you present performance data.
  - How: (1) ensure proper machine configuration, (2) run extensive tests, (3) collect multiple metrics (instructions, cache misses, page faults, context switches), (4) compare generated machine code, (5) explain the underlying technical reason for results.

- **Continuous Benchmarking with CPD (Change Point Detection)**: Statistical regression detection without manual thresholds.
  - When to use: noisy environments (distributed benchmarks, production-like tests).
  - How: CPD leverages historical data to identify points where performance changed significantly, requiring multiple consecutive data points before alerting (vs. immediate threshold alerts).

- **Noise Control Strategy**: Disable nondeterministic features for stable microbenchmarks; keep them enabled for production-realistic measurements.
  - When to use: depend on your goal (precision vs. realism).
  - How (precision): disable DFS, pin processes, warm up caches, control environment. (realism): replicate target system config, measure in production.

## Key Concepts

- **Measurement Bias**: Systematic over/under-estimation caused by DFS (CPU frequency variation), filesystem cache state, memory layout, environment variable size, link order.
- **Dynamic Frequency Scaling (DFS/Turbo)**: CPU boosts frequency temporarily, then throttles due to thermal limits. Causes first-run advantage.
- **Performance Distribution**: A set of N measurements. Compare distributions using box plots (mean, median, p25/p75, outliers, whiskers).
- **Standard Deviation**: If SD ≈ mean, the average is not representative -- reduce noise or report multiple metrics.
- **Speedup Formula**: `PercentageSpeedup = (1 - NewTime/OldTime) × 100%`
- **Hardware Timer (TSC)**: `__rdtsc()` on x86, ~5ns latency, monotonic and constant-rate. Good for nanosecond-to-minute events.
- **Software Timer**: `clock_gettime` / `std::chrono::steady_clock`, ~500ns latency. Good for events >1 microsecond.
- **DoNotOptimize**: Compiler barrier idiom using inline assembly to prevent the compiler from optimizing away benchmarked code.

## Mental Models

- **The Cold/Warm Run Asymmetry**: Think of benchmarking like preheating an oven. First runs heat caches, trigger turbo, warm filesystem. Use dry runs or collect many samples and treat first runs as outliers.
- **Box Plot as Truth Serum**: Visualizing distributions prevents cherry-picking. If "before" and "after" box plots overlap significantly, the change is likely noise.
- **Threshold vs. CPD Decision**: Threshold = immediate feedback, good for quiet systems. CPD = delayed but fewer false positives, good for noisy systems. Choose based on your environment's noise level.
- **Standard Deviation as Stop Criterion**: When SD drops below a target, stop collecting samples. More samples don't always mean better statistics.

## Anti-patterns

- **Single measurement comparison**: One run is easily skewed by measurement bias. Always collect multiple samples.
- **Discarding unfavorable outliers without justification**: Outliers may be the most important metric for real-time systems (p99 matters).
- **Using unit test durations as benchmarks**: Unit test environments differ from production conditions; input data may not be realistic.
- **Benchmarking without DoNotOptimize**: Compilers may eliminate the code you intended to benchmark, leading to meaningless (or misleading) results.
- **Dismissing brief regressions**: A one-day regression that "recovered" might hide a real regression masked by an unrelated optimization in the same window.

## Code Examples

```cpp
// Hardware timer (x86) -- ~5ns latency, good for short events
#include <x86intrin.h>

uint64_t timeWithTSC() {
    uint64_t start = __rdtsc();
    // run something
    return __rdtsc() - start;
}
```

- **What it demonstrates**: Using `RDTSC` instruction for cycle-accurate timing of short-duration events.

```cpp
// Preventing compiler elimination of benchmarked code
void foo() {
    for (int i = 0; i < 1000; i++) {
        std::string s("hi");
        DoNotOptimize(s);  // compiler barrier
    }
}
```

- **What it demonstrates**: Without `DoNotOptimize`, the compiler may eliminate the entire loop since `s` is never used.

## Worked Example

**Detecting a Real Regression Hidden by Noise** (Figure 2.2 scenario):

A performance graph shows a 15% regression over 10 days (Aug 11-21), averaging ~1.5% per day. If you set a 2% threshold, every single daily regression passes the filter -- yet the cumulative effect is severe. 

CPD (Change Point Detection) would have caught this: the algorithm evaluates a large window and identifies the trend, not individual points. The lesson: long-running slow degradations are the stealthiest regressions. Track per-commit performance, not just daily snapshots.

## Key Takeaways

1. Modern systems are fundamentally nondeterministic -- control what you can, measure what you can't.
2. Use TSC (`__rdtsc`) for nanosecond-precision short events; use `std::chrono` for everything else.
3. Visualize with box plots; calculate speedups only when standard deviation is low relative to the mean.
4. Set up automated performance regression CI with either threshold-based or CPD-based alerting.
5. Always use `DoNotOptimize` or equivalent barriers in microbenchmarks.
6. Performance monitoring in production is essential but must stay under 1% overhead.
7. Treat unexpected performance *improvements* with the same scrutiny as regressions -- they may mask functional test gaps.

## Connects To

- **Ch 1 (Introduction)**: Implements the "always measure" principle.
- **Ch 4 (Terminology & Metrics)**: Defines CPI, IPC, cache misses, branch mispredictions -- the metrics you collect during active benchmarking.
- **Ch 5 (Performance Analysis Approaches)**: Sampling, instrumentation, tracing -- the tools for collecting these metrics.
- **Appendix A**: Specific techniques to reduce measurement noise on Linux.
- **Concept: SPEC CPU 2017**: Industry-standard benchmarks, but expensive to run many iterations (10+ min per run).
