# Chapter 7: Overview of Performance Analysis Tools

## Core Idea

Performance analysis tools abstract the complexity of hardware performance monitoring features (PMU, LBR, PEBS, Intel PT), enabling engineers to profile programs efficiently. The choice of tool depends on CPU vendor, operating system, and the type of bottleneck being investigated.

## Frameworks Introduced

- **Intel VTune Profiler**: full-featured GUI profiler for x86 (Intel and AMD), free via oneAPI Base Toolkit.
  - When to use: you need deep microarchitectural analysis (TMA, precise events, timeline charts) on Intel CPUs.
  - How: install SEP driver on Linux (`build-driver`, `insmod-sep`); on Windows, no extra config. Use Hotspots, Microarchitecture Exploration, or Memory Access analysis types.

- **AMD uProf**: AMD's profiler for Windows/Linux/FreeBSD; supports C++, Java, .NET.
  - When to use: profiling on AMD processors with access to AMD-specific events.
  - How: CLI uses `collect` + `report` steps; GUI provides Function Hotspots, timeline, Flame Graph, and Call Graph views.

- **Apple Xcode Instruments**: macOS profiler built on DTrace, free with Xcode.
  - When to use: profiling Apple Silicon (M1/M2) Mac applications with hardware performance counters.
  - How: add PMU events via Recording Options, set target app, press record; use "CPU Counters" instrument.

- **Linux Perf**: kernel-shipped sampling profiler, supports x86/ARM/PowerPC64/SPARC.
  - When to use: quick command-line profiling on any Linux machine; deepest hardware access across vendors.
  - How: `perf stat` for event counts, `perf record/report` for sampling. Visualize with Flame Graphs, KDAB Hotspot, or Netflix Flamescope.

- **Flame Graphs**: call-stack visualization (Brendan Gregg) where bar width = relative execution time.
  - When to use: identify hottest code paths and call relationships at a glance.
  - How: use `perf script` + `FlameGraph/stackcollapse-perf.pl` + `flamegraph.pl`.

- **Event Tracing for Windows (ETW)**: OS-level tracing facility for system-wide software dynamics.
  - When to use: diagnose thread blocking, disk/network I/O, or system-wide performance; NOT for CPU microarchitectural bottlenecks.
  - How: record with `WPR.exe`, view with Windows Performance Analyzer (WPA).

- **Tracy (Hybrid Profiler)**: instrumentation + sampling profiler with marker API.
  - When to use: debugging intermittent slow frames in games/real-time applications; correlating slow events across threads.
  - How: add `#include "tracy/Tracy.hpp"`, insert `ZoneScoped` and `FrameMark` macros. Connect profiler GUI for live "flight recorder" mode.

- **Heaptrack** (Linux): heap memory profiler from KDE.
  - When to use: find largest/frequent allocations, temporary allocations, and their call stacks.
  - How: `heaptrack ./app`, then `heaptrack_gui` to visualize.

- **Continuous Profiling (Parca, Pyroscope, gProfiler)**: always-on, system-wide sampling profiler for production.
  - When to use: detect regressions over time, compare call stacks "before vs after" a deployment, debug intermittent production issues.
  - How: install runtime agent, configure sample rate (~19 samples/sec default), query Web UI.

## Key Concepts

- **Sampling Profiler**: periodically captures program state (PC, call stack) at intervals; statistical approximation.
- **Instrumentation Profiler**: inserts hooks at function entry/exit for exact timing; higher overhead.
- **Precise Event**: a hardware event that can pinpoint the exact instruction causing it (via PEBS/IBS/SPE).
- **Call Stack / Flame Graph**: visualization stacking frames from root to leaf; wide bars = more time.
- **Memory Footprint**: total unique memory bytes touched by an application during its lifetime.
- **Memory Intensity**: bytes accessed per fixed instruction interval (e.g., MB per 1B instructions).
- **Temporary Allocation**: malloc+free pair without persistent use; target for elimination.
- **Continuous Profiling (CP)**: low-overhead always-on sampling across days/weeks in production; enables differential analysis.
- **ETW (Event Tracing for Windows)**: kernel-level tracing for system-wide software dynamics (thread state, disk, network, context switches).
- **ZoneScoped (Tracy)**: C++ RAII macro that records enter/exit timestamps for a code scope.

## Mental Models

- **Sampling vs Instrumentation tradeoff**: use sampling for wide, exploratory analysis (hotspots, bottlenecks); use instrumentation (Tracy, manual timing) for deep, deterministic analysis of specific code paths.
- **CPU vendor guides tool choice**: VTune for Intel, uProf for AMD, Instruments for Apple Silicon; Linux Perf works on all but lacks GUI.
- **Timeline + filtering pattern**: zoom into a time interval where anomaly occurs → filter samples → examine updated hotspot list → drill into assembly/source.
- **Memory profiling as complement to CPU profiling**: high CPU time does not mean memory is fine; Heaptrack can reveal temporary allocations or excessive fragmentation invisible to CPU profilers.

## Anti-patterns

- **Using ETW for microarchitectural analysis**: ETW cannot expose CPU pipeline stalls, cache misses, or TMA metrics. Use VTune/uProf instead.
- **Ignoring temporary allocations**: allocating + freeing repeatedly in hot loops without reuse adds overhead; measure with Heaptrack and consider arena/pool allocators.
- **Profiling only one process on a multi-process machine**: system-wide profiling may reveal interference from other processes.
- **Sampling profiler for sub-microsecond anomalies**: sampling rate limits visibility; use instrumentation (Tracy) for short events.

## Code Examples

**VTune SEP driver install (Linux)**:
```shell
$ ./build-driver
$ sudo groupadd vtune
$ sudo usermod -a -G vtune `whoami`
$ sudo ./insmod-sep -r -g vtune
```

**Linux Perf setup**:
```shell
$ sudo apt-get install linux-tools-common linux-tools-generic linux-tools-`uname -r`
$ echo 0 | sudo tee /proc/sys/kernel/perf_event_paranoid
$ echo 0 | sudo tee /proc/sys/kernel/kptr_restrict
```

**Tracy instrumentation**:
```cpp
#include "tracy/Tracy.hpp"
void TraceRowJob() {
    ZoneScoped;
    // ...
}
void RenderFrame() {
    ZoneScoped;
    for (...) { TraceRowJob(); }
    FrameMark;
}
```

**Heaptrack usage**:
```shell
$ heaptrack ./stockfish bench 128 1 24 default depth
```

## Worked Example

**Stockfish Heap Analysis with Heaptrack (Section 7.8.2)**:

The author profiled the Stockfish chess engine's built-in benchmark:
- Total allocations: 10,614; peak heap: 204 MB.
- ~50% of allocations were **temporary** (alloc + free without reuse).
- The largest allocation (182 MB) came from `Stockfish::std_aligned_alloc`, persistent for the whole run.
- A flame graph revealed that 4,360 temporary allocations originated from `std::stable_sort`, which allocates a temporary buffer.
- Attempting to replace it with an in-place sort caused 8% performance regression, so the change was discarded.
- **Lesson**: temporary allocations may not always be fixable; measure before and after.

## Key Takeaways

1. Start with Intel VTune (Intel CPUs) or AMD uProf (AMD CPUs) for deep microarchitectural analysis; use Linux Perf as a universal fallback.
2. Flame graphs are the de facto standard for visualizing hot call stacks — learn to read them quickly.
3. ETW is complementary to CPU profilers; use it for system-level dynamics (thread waits, disk I/O), not for pipeline bottlenecks.
4. Hybrid profilers like Tracy excel at debugging intermittent performance issues (e.g., slow frames); use `ZoneScoped` markers to isolate slow zones.
5. Memory profiling (Heaptrack, memory_profiler) is essential for finding temporary allocations and understanding memory intensity/footprint.
6. Continuous profiling in production helps catch regressions and enables differential call-stack comparisons across time.
7. TMA methodology (Ch6) should guide which tool and analysis type to use.

## Connects To

- **Ch6 (TMA methodology)**: TMA provides the diagnostic framework; Ch7 provides the tools to apply it.
- **Part 2 intro (lines 4163-4250)**: tools identified here are used throughout source-code tuning chapters.
- **Appendix C (Intel PT)**: hardware trace facility that complements sampling profilers.
- **Appendix D (ETW deep dive)**: extended discussion of ETW with a case study.
- **Brendan Gregg's Flame Graphs**: external reference for visualization methodology.
