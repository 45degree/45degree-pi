# Chapter 2: How Computers Really Work

## Core Idea

The simple computer model C++ presents -- sequential execution, uniform byte-addressable memory, single execution address -- is a convenient fiction. Real hardware is dominated by the fact that **memory access is far slower than instruction execution**. Understanding this hierarchy (registers, L1/L2/L3 cache, main memory, disk) is the foundation of effective optimization. The computer's elaborate tricks to hide memory latency -- caches, prefetching, pipelining, out-of-order execution -- create counterintuitive performance behaviors that directly shape which code patterns are fast or slow.

## Key Techniques

- **Exploit cache locality (spatial)**: Access memory sequentially and contiguously. Arrays and vectors outperform linked structures (lists, trees) because adjacent elements are fetched together into cache lines (typically 64 bytes on desktops). Non-aligned memory access costs twice as much because it spans two cache lines.

- **Exploit cache locality (temporal)**: Frequently accessed code and data stay in cache. Tight loops with few instructions run faster than code spread across many functions with if/else branches. Smaller, denser data structures are friendlier to cache.

- **Prefer computation over branching**: Conditional branches cause pipeline stalls -- the processor must wait to know which direction to take before fetching the next instruction. When the cost of computing both paths is low (modern processors execute many instructions in parallel), branchless code can be faster.

- **Avoid false sharing in multithreaded code**: Different cores have independent caches but share main memory. Writing to shared data is slow because cores must synchronize via the memory bus. Keep per-thread data in separate cache lines.

- **Minimize system calls**: A system call costs hundreds of times more than a function call. Batch operations and use library facilities (like buffered I/O) that amortize the cost.

- **Understand thread context switch cost**: Switching threads saves/restores hundreds of bytes of registers and flushes cache. Switching processes additionally flushes TLB entries and dirty cache pages to RAM. Avoid unnecessary context switches.

- **Account for virtual memory**: Memory is finite; the OS swaps pages to disk. A function that runs in microseconds in a test harness may take milliseconds in a full program context when its code/data are not cached in physical memory. Measure performance with realistic workloads.

- **Be aware of hidden constructor costs**: In C++, a simple-looking assignment `a = b` may invoke a copy constructor with arbitrary complexity. The cost of a statement is not visible from its syntax alone.

## Optimization Rules

1. **Memory is the bottleneck**: Reducing memory accesses matters more than reducing instruction count. Count memory reads and writes per statement as a rough cost estimate.
2. **Sequential access is fast**: Access adjacent memory locations; prefer arrays of values over arrays of pointers.
3. **Keep hot code and data small**: The less cache space your hot path occupies, the more likely it stays at the fastest cache level.
4. **Compute, don't branch**: When the computation is cheaper than a branch misprediction penalty, evaluate both sides unconditionally.
5. **Align your data**: Misaligned multi-byte accesses cost 2x. Let the compiler help by ordering struct fields from largest to smallest to minimize padding holes.
6. **Measure under realistic load**: Code that runs during startup or peak load must be measured under those conditions. Idle-system benchmarks are misleading.
7. **Shared data is slow data**: Minimize cross-thread data sharing; use thread-local storage when possible.

## Key Takeaways

1. Memory access latency spans five orders of magnitude from L1 cache to disk. Each cache level is roughly 10x slower than the one above it.
2. Cache behavior makes instruction execution time unpredictable -- the same instruction may take 1ns or 100ns depending on cache state.
3. Sequential memory access triggers hardware prefetching; random access defeats it. This is why `std::vector` traversal crushes `std::list` traversal.
4. Branch prediction failures stall the pipeline. Modern processors speculatively execute both paths, but mispredictions still cost dozens of cycles.
5. Operating system context switches invalidate caches and TLB entries, causing a long recovery period of cache misses.
6. C++ hides computation: constructors, overloaded operators, and implicit conversions can make innocent-looking statements expensive. Profile to find the real cost.
