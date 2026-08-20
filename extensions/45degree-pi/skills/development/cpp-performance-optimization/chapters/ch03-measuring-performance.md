# Chapter 3: Measuring Performance

## Core Idea

Measurement and experimentation are the foundation of all performance improvement. Intuition about what is slow is frequently wrong. Systematic optimization requires: (1) forming testable hypotheses, (2) using the best available tools (profilers and software timers), (3) recording predictions, code changes, and experimental results in a notebook. The goal is not perfect measurement but measurement accurate enough (within a few percent) to guide optimization decisions.

## Key Techniques

- **Use a profiler to find hotspots**: A profiler instruments your program to record the cumulative time spent in each function. The output identifies the 10% of code that consumes 90% of execution time. Profilers work either by instrumenting function entry/exit or by periodically sampling the instruction pointer. Debug builds work for profiling (they include inlined functions); on Windows, set `_NO_DEBUG_HEAP=1` to avoid debug heap overhead skewing results.

- **Build a stopwatch class with RAII**: Implement a timer wrapper that starts on construction and reports elapsed time on destruction. Use `std::chrono::system_clock` (C++11+) or `clock()` for portability. Wrap the code block to measure in braces, declare a `Stopwatch` instance, and the destructor prints the duration automatically.

- **Measure relative performance**: Compute the ratio of optimized time to original time. Relative performance cancels out systematic measurement errors and is more intuitive than absolute times. A 10% improvement (ratio of 0.9 or 1.1) is the threshold of significance; improvements below 1-2% are typically noise and not worth the risk of introducing bugs.

- **Use iteration loops to amplify small costs**: Individual function calls may execute in nanoseconds -- too fast to measure accurately with millisecond-resolution timers. Run the function thousands or millions of times in a loop to accumulate measurable duration. A `typedef` for the counter type (`counter_t`) allows easy adjustment when iteration counts exceed 32-bit range.

- **Apply Amdahl's Law before investing effort**: Calculate the maximum theoretical speedup: S = 1 / ((1-P) + P/Sp). If the function you plan to optimize accounts for only 10% of runtime (P=0.1), even making it infinitely fast (Sp→∞) yields only 1.11x (11%) overall speedup. Focus on the dominant P first.

- **Measure in realistic contexts**: A function measured in isolation with warm caches runs faster than in a full program. Use module tests with fixed input data for reproducible measurements. When live data is non-reproducible, collect metrics (mean, variance, exponential moving average) over many events to detect trend improvements.

- **Manage OS non-determinism**: Raise process/thread priority during measurement (`ABOVE_NORMAL_PRIORITY_CLASS`, `THREAD_PRIORITY_HIGHEST` on Windows). Measure on a "quiet" machine (no video playback, background updates). Iteration-based measurement amortizes random scheduling jitter over many calls.

- **Understand your clock**: Know the effective resolution of your timing function (not its display resolution). On Windows: `clock()` ≈ 1ms, `GetTickCount()` ≈ 15.6ms, `QueryPerformanceCounter()` ≈ sub-microsecond. The resolution limits the minimum measurable duration. Check `CLOCKS_PER_SEC` or call `QueryPerformanceFrequency()`.

## Optimization Rules

1. **Always measure -- never guess**: Developer intuition about what code is slow is wrong more often than right. Profilers and timers are the only reliable way to identify hotspots.
2. **Follow the 90/10 rule**: A profiler reveals the 10% of functions that matter. Optimize those; ignore the rest. Optimizing all functions equally wastes time.
3. **Set a baseline and a goal**: Record pre-optimization metrics. Define a clear performance target (e.g., startup < 1s, query response < 100ms). Stop optimizing when the goal is met -- diminishing returns accelerate.
4. **Record everything**: Write down what code was changed, what was measured, and the result. This enables quick re-creation of experiments and defends optimization decisions to stakeholders.
5. **Optimize one task at a time**: When profiling a program that performs many different tasks (e.g., a database doing inserts and selects), focus on a single workload for clean hotspot identification.
6. **Profile first, time second**: Use a profiler to identify candidate functions, then use a stopwatch and test harness for rapid "edit-compile-measure" iteration on individual functions.
7. **Only significant improvements count**: A 1% speedup is indistinguishable from measurement noise and not worth the risk of code changes. Target 20%+ improvements, which are unambiguously real.
8. **Count memory accesses to estimate statement cost**: Each read or write of a variable counts as one memory access. For example, `a = b + c` costs 3 accesses (read b, read c, write a). This heuristic works across all processor types.

## Key Takeaways

1. Performance optimization is experimental science: hypothesize, measure, verify. Keep a lab notebook.
2. Amdahl's Law and the 90/10 rule tell you where to focus. Profilers tell you exactly which functions those are.
3. Timing accuracy only needs to be within a few percent. Don't obsess over clock precision -- iteration-based measurement with a millisecond-resolution clock suffices for most optimization work.
4. Computer clocks have limited effective resolution, not just display resolution. Know your platform's actual tick granularity (often 15.6ms for `GetTickCount()`, 1ms for `clock()`).
5. Use unsigned types for tick counts to avoid wraparound arithmetic bugs. 64-bit tick counters (`GetTickCount64()`) eliminate wraparound concerns for practical purposes.
6. Latency from calling the timing function itself is typically nanoseconds -- negligible when measuring milliseconds of work.
7. Relative performance measurements cancel out systematic errors; iterate many times to cancel out random jitter.
8. A function's cost estimate = number of memory accesses per invocation × number of invocations. Nested loops and implicit loops (event handlers, framework dispatch) amplify costs exponentially.
